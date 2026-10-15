// HTTP API end to end through app.request() on throwaway pz_test_<pid>_* graphs (guest graphs included), skipped
// cleanly when FalkorDB is unreachable. LLM_CHAIN=replay: no network; the committed replays stand in for live narration.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connect } from 'node:net';
import type { ChatReq, ChatRes, Msg } from '../server/agent/llm.ts';
import { close, db } from '../server/graph/client.ts';
import { build } from '../server/ingest/build.ts';
import * as guests from '../server/ingest/guest.ts';
import { app, hooks } from '../server/index.ts';
import type { AnalyzeEvent, Report, TriageEvent } from '../shared/events.ts';
import { readSSE } from '../web/src/data/sse.ts';

const host = process.env.FALKOR_HOST || '127.0.0.1';
const port = Number(process.env.FALKOR_PORT || 6380);
const up = await new Promise<boolean>((res) => {
  const s = connect(port, host, () => (s.destroy(), res(true)));
  s.setTimeout(1000, () => (s.destroy(), res(false)));
  s.on('error', () => res(false));
});

const prefix = `pz_test_${process.pid}`;
process.env.PZ_GRAPH_PREFIX = prefix;
process.env.LLM_CHAIN = 'replay';
process.env.RENDER = '1'; // the client is the first x-forwarded-for hop, so every request below gets its own rate-limit bucket
const QIX = 'qix-2025-09-08';
const QAT = Date.parse('2025-09-08T13:30:00Z');
const MOCHA = readFileSync('fixtures/real/mocha-5f8e8a8.package-lock.json', 'utf8');

type H = Record<string, string>;
let n = 0;
const fresh = () => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n++ & 255}`;
const post = (path: string, body: unknown, h: H = {}) => app.request(path, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': fresh(), ...h }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const get = (path: string, h: H = {}) => app.request(path, { headers: { 'x-forwarded-for': fresh(), ...h } });
async function sse<T>(res: Response): Promise<T[]> {
  if (res.status !== 200) assert.fail(`${res.status} ${await res.text()}`);
  const out: T[] = [];
  for await (const e of readSSE<T>(res.body!)) out.push(e);
  return out;
}
const cookie = (res: Response) => res.headers.get('set-cookie')?.split(';')[0]; // "pz_sid=<hex>"
const of = <K extends TriageEvent['type']>(evs: TriageEvent[], k: K) => evs.find((e) => e.type === k) as Extract<TriageEvent, { type: K }>;
async function triageRun(body: object, h: H = {}) {
  const res = await post('/api/triage', body, h);
  const evs = await sse<TriageEvent>(res);
  return { evs, sid: cookie(res) ?? h.cookie, report: of(evs, 'report')?.report as Report };
}
const tiny = (name: string) => JSON.stringify({ name, lockfileVersion: 3, packages: { '': { name, dependencies: { debug: '^4.3.5' } }, 'node_modules/debug': { version: '4.3.5' } } });
const quiet = async (fn: () => Promise<void>) => {
  const orig = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = orig;
  }
};

describe('api', { skip: !up && `FalkorDB unreachable at ${host}:${port}` }, () => {
  before(() => build(prefix), { timeout: 180_000 });
  after(async () => {
    for (const g of await (await db()).list()) if (g.startsWith(`${prefix}_`)) await (await db()).selectGraph(g).delete().catch(() => {});
    await close();
  });

  test('health, scenarios, JSON 404 for unknown /api routes, server-side request ids (S12)', async () => {
    assert.deepEqual(await (await get('/api/health')).json(), { ok: true });
    assert.deepEqual((await (await get('/api/scenarios')).json()).map((s: { id: string }) => s.id), [QIX, 'axios-2026-03-31']);
    const nf = await get('/api/nope', { 'x-request-id': 'attacker-chosen' });
    assert.equal(nf.status, 404);
    const body = await nf.json();
    assert.deepEqual(Object.keys(body).sort(), ['error', 'requestId']);
    assert.notEqual(body.requestId, 'attacker-chosen');
    assert.equal(nf.headers.get('x-request-id'), null);
  });

  test('timeline is a 2-minute grid and its 13:30Z point equals /api/exposure at 13:30Z', async () => {
    const t = await (await get(`/api/timeline?scenario=${QIX}`)).json();
    assert.equal(t.points[0].at, Date.parse('2025-09-08T13:00:00Z'));
    assert.ok(t.points.every((p: { at: number }, i: number) => i === 0 || p.at - t.points[i - 1].at === 120_000));
    assert.ok(t.points.at(-1).at > t.incident.removedAt + 28 * 60_000);
    const p = t.points.find((x: { at: number }) => x.at === QAT);
    const x = await (await get(`/api/exposure?scenario=${QIX}&at=${QAT}`)).json();
    assert.deepEqual(p.counts, x.counts);
    assert.equal(p.scanner, x.scanner.length);
    assert.ok(x.counts.WOULD_PULL > 0);
  });

  for (const [scenario, at, key] of [[QIX, QAT, '2025-09-08T13:30Z'], ['axios-2026-03-31', undefined, '2026-03-31T01:30Z']] as const) {
    test(`triage SSE ${scenario}: start, tools, report, replayed narration, guard with claims, done; counts equal /api/exposure`, async () => {
      const { evs, report } = await triageRun({ scenario, ...(at && { at }) });
      assert.equal(evs[0].type, 'start');
      assert.deepEqual(evs.slice(-4).map((e) => e.type), ['report', 'narration', 'guard', 'done']);
      const tools = evs.slice(1, -4);
      assert.ok(tools.length > 0 && tools.every((e, i) => e.type === (i % 2 ? 'tool_result' : 'tool_start')), tools.map((e) => e.type).join());
      const narration = of(evs, 'narration');
      assert.equal(narration.mode, 'replay');
      assert.equal(narration.text, JSON.parse(readFileSync(`data/replays/${scenario}.json`, 'utf8'))[key].text);
      const g = of(evs, 'guard') as Extract<TriageEvent, { type: 'guard' }> & { claims: { text: string; ok: boolean }[] };
      assert.deepEqual(g.flagged, []);
      assert.equal(g.claims.length, g.total);
      const x = await (await get(`/api/exposure?scenario=${scenario}&at=${report.at}`)).json();
      assert.deepEqual(x.counts, report.counts);
      assert.deepEqual(x.exposures.map((e: { repo: string; tier: string }) => [e.repo, e.tier]), report.exposures.map((e) => [e.repo, e.tier]));
    });
  }

  test('ask: a fake LLM is cut at 4 calls and 6 tool calls, pinned after the first tool call, and its answer is guarded', async () => {
    const t = await triageRun({ scenario: QIX, at: QAT });
    const runId = of(t.evs, 'start').runId;
    const calls: { messages: Msg[]; tools: number; provider?: string }[] = [];
    hooks.chat = async (req: ChatReq, provider?: string): Promise<ChatRes> => {
      calls.push({ messages: req.messages.map((m) => ({ ...m })), tools: req.tools?.length ?? 0, provider });
      const k = calls.length;
      const toolCalls = [1, 2, 3].map((i) => ({ id: `c${k}${i}`, name: 'incident_exposure', args: {} }));
      const raw = { role: 'assistant', content: null, tool_calls: toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: '{}' } })) };
      return { text: k === 4 ? 'Notify `QA`: `mochajs/mocha` would fetch `debug@4.4.2`. Also `evil/repo`.' : '', toolCalls, provider: 'groq:fake', raw };
    };
    try {
      const evs = await sse<TriageEvent>(await post('/api/ask', { runId, question: 'Who should I notify about mocha?' }, { cookie: t.sid! }));
      assert.equal(calls.length, 4);
      assert.deepEqual(calls.map((c) => c.provider), [undefined, 'groq:fake', 'groq:fake', 'groq:fake']);
      assert.equal(evs.filter((e) => e.type === 'tool_start').length, 6);
      assert.equal(evs.filter((e) => e.type === 'tool_result').length, 6);
      assert.deepEqual(evs.slice(-3).map((e) => e.type), ['narration', 'guard', 'done']);
      assert.equal(of(evs, 'narration').mode, 'live');
      assert.deepEqual(of(evs, 'guard').flagged, ['evil/repo']);
      const toolMsgs = calls[3].messages.filter((m) => m.role === 'tool');
      assert.equal(toolMsgs.length, 9); // every tool_call id is answered, run or skipped
      assert.ok(toolMsgs.every((m) => String(m.content).length <= 1200));
      assert.match(String(calls[3].messages.at(-1)?.content), /Answer now/);
      assert.equal((await post('/api/ask', { runId, question: 'q' })).status, 404); // another session (S10)

      // The pinned provider fails mid-loop: one last call on the whole chain, no tools, history as plain data.
      calls.length = 0;
      hooks.chat = async (req: ChatReq, provider?: string): Promise<ChatRes> => {
        calls.push({ messages: req.messages, tools: req.tools?.length ?? 0, provider });
        if (calls.length === 1) return { text: '', toolCalls: [{ id: 'x', name: 'route_owners', args: { repos: ['mochajs/mocha'] } }], provider: 'groq:fake', raw: { role: 'assistant', content: null, tool_calls: [{ id: 'x', type: 'function', function: { name: 'route_owners', arguments: '{}' } }] } };
        if (provider) throw new Error('HTTP 429');
        return { text: 'Notify `QA`.', toolCalls: [], provider: 'gemini:fake', raw: {} };
      };
      const fb = await sse<TriageEvent>(await post('/api/ask', { runId, question: 'Who owns mocha?' }, { cookie: t.sid! }));
      assert.deepEqual(calls.map((c) => [c.provider, c.tools]), [[undefined, 10], ['groq:fake', 10], [undefined, 0]]);
      assert.deepEqual([of(fb, 'narration').mode, of(fb, 'narration').provider, of(fb, 'guard').flagged], ['live', 'gemini:fake', []]);
    } finally {
      delete hooks.chat;
    }
  });

  test('analyze a pasted lockfile: guest graph, triage shows the root ^4.3.5 range WOULD_PULL debug@4.4.2, owner session only', async () => {
    const res = await post('/api/analyze', { lockfile: MOCHA, scenario: QIX });
    const sid = cookie(res)!;
    const evs = await sse<AnalyzeEvent>(res);
    const ready = evs.at(-1) as Extract<AnalyzeEvent, { type: 'ready' }>;
    assert.equal(ready.type, 'ready', JSON.stringify(ready));
    assert.match(ready.graph, new RegExp(`^${prefix}_guest_[0-9a-f]{12}_qix$`));
    assert.equal(ready.repo, 'pasted/mocha');
    assert.deepEqual([...new Set(evs.flatMap((e) => (e.type === 'progress' ? [e.stage] : [])))], ['parse', 'write', 'enrich', 'admits']);

    const t = await triageRun({ guest: ready.graph, scenario: QIX, at: QAT }, { cookie: sid });
    const e = t.report.exposures.find((x) => x.repo === 'pasted/mocha')!;
    assert.equal(e.tier, 'WOULD_PULL');
    assert.ok(e.ranges.includes('^4.3.5') && e.versions.includes('debug@4.4.2'));
    const p = t.report.paths.find((x) => x.repo === 'pasted/mocha' && x.version === 'debug@4.4.2')!;
    assert.deepEqual([p.kind, p.range, p.hops], ['ADMITS', '^4.3.5', 0]);
    assert.equal(of(t.evs, 'narration').mode, 'template'); // no recording describes a guest graph

    const again = await sse<AnalyzeEvent>(await post('/api/analyze', { lockfile: MOCHA, scenario: QIX })); // reused, not rebuilt
    assert.deepEqual(again.map((x) => x.type), ['ready']);
    assert.equal((await post('/api/triage', { guest: ready.graph, scenario: QIX })).status, 404); // S10: not this session's graph
  });

  test('analyze rejects SSRF-shaped URLs, yarn.lock, lockfile v1 and oversized input', async () => {
    for (const url of ['https://169.254.169.254/x', 'https://github.com.evil.com/a/b', 'http://github.com/a/b', 'https://github.com/../etc', 'https://github.com/a/b?x=1'])
      assert.equal((await post('/api/analyze', { url, scenario: QIX })).status, 400, url);
    const yarn = await post('/api/analyze', { lockfile: '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n# yarn lockfile v1\n\ndebug@^4.3.5:\n  version "4.4.1"\n', scenario: QIX });
    assert.equal(yarn.status, 400);
    assert.equal((await yarn.json()).error, guests.UNSUPPORTED);
    const v1 = await post('/api/analyze', { lockfile: JSON.stringify({ name: 'x', lockfileVersion: 1, dependencies: {} }), scenario: QIX });
    assert.equal(v1.status, 400);
    assert.equal((await v1.json()).error, guests.OLD_LOCKFILE);
    assert.equal((await post('/api/analyze', { lockfile: 'x'.repeat(6_000_000), scenario: QIX })).status, 413);
    assert.equal((await post('/api/analyze', 'x'.repeat(7_000_000))).status, 413);
    const many = { lockfileVersion: 3, packages: Object.fromEntries(Array.from({ length: 6001 }, (_, i) => [`node_modules/p${i}`, { version: '1.0.0' }])) };
    assert.equal((await post('/api/analyze', { lockfile: JSON.stringify(many), scenario: QIX })).status, 413);
  });

  test('S1: every field is validated against a fixed schema', async () => {
    const cases: [string, unknown, number][] = [
      ['/api/triage', { scenario: '__proto__' }, 400],
      ['/api/triage', { scenario: 'constructor' }, 400],
      ['/api/triage', { scenario: QIX, at: QAT + 31 * 86_400_000 }, 400],
      ['/api/triage', { scenario: QIX, at: 1.5 }, 400],
      ['/api/triage', { scenario: QIX, at: String(QAT) }, 400],
      ['/api/triage', { scenario: QIX, extra: 1 }, 400],
      ['/api/triage', { alert: 'x'.repeat(501) }, 400],
      ['/api/triage', { alert: 'something nobody has heard of' }, 400],
      ['/api/triage', { guest: `${prefix}_acme_qix`, scenario: QIX }, 404], // only guest graphs this session built
      ['/api/triage', [1], 400],
      ['/api/ask', { runId: 'nope', question: 'q' }, 400],
      ['/api/ask', { runId: randomUUID(), question: 'x'.repeat(501) }, 400],
      ['/api/ask', { runId: randomUUID(), question: 'q' }, 404],
      ['/api/remediate', { scenario: QIX, repo: 'mochajs/mocha', action: 'delete' }, 400],
      ['/api/remediate', { scenario: QIX, repo: "x'}) MATCH (n) DETACH DELETE n //", action: 'remediated' }, 400],
      ['/api/analyze', { url: 'https://github.com/a/b', lockfile: '{}', scenario: QIX }, 400],
      ['/api/analyze', { url: 'https://github.com/a/b' }, 400],
    ];
    for (const [path, body, status] of cases) assert.equal((await post(path, body)).status, status, `${path} ${JSON.stringify(body).slice(0, 80)}`);
    const plain = await app.request('/api/triage', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-forwarded-for': fresh() }, body: JSON.stringify({ scenario: QIX }) });
    assert.equal(plain.status, 415);
    for (const q of [`scenario=${QIX}&at=abc`, `scenario=${QIX}&at=-1`, 'scenario=nope&at=1', `scenario=${QIX}`])
      assert.equal((await get(`/api/exposure?${q}`)).status, 400, q);
    for (const tool of ['MATCH%20(n)%20RETURN%20n', '__proto__', 'record_triage'])
      assert.equal((await get(`/api/plan?scenario=${QIX}&tool=${tool}`)).status, 400, tool);
  });

  test('S7: a burst gets 429; x-forwarded-for is trusted only on Render', async () => {
    const h = { 'x-forwarded-for': fresh() };
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await post('/api/triage', { scenario: 'nope' }, h)).status);
    assert.deepEqual(codes, [400, 400, 400, 400, 400, 429]);
    delete process.env.RENDER; // now two "different" forwarded clients are one socket client
    try {
      assert.equal((await post('/api/analyze', { scenario: 'nope' })).status, 400);
      assert.equal((await post('/api/analyze', { scenario: 'nope' })).status, 429);
    } finally {
      process.env.RENDER = '1';
    }
  });

  test("S10: session cookie; session A's remediation is invisible to session B; 50 marks per session", async () => {
    const a = await triageRun({ scenario: QIX, at: QAT });
    const set = (await get('/api/health')).headers.get('set-cookie')!;
    assert.match(set, /^pz_sid=[0-9a-f]{32}; Path=\/; HttpOnly; SameSite=Strict$/);
    assert.deepEqual(await (await post('/api/remediate', { scenario: QIX, repo: 'mochajs/mocha', action: 'remediated' }, { cookie: a.sid! })).json(), { ok: true });
    const a2 = await triageRun({ scenario: QIX, at: QAT }, { cookie: a.sid! });
    assert.equal(a2.report.exposures.find((e) => e.repo === 'mochajs/mocha')!.remediated?.action, 'remediated');
    const b = await triageRun({ scenario: QIX, at: QAT });
    assert.notEqual(b.sid, a.sid);
    assert.equal(b.report.exposures.find((e) => e.repo === 'mochajs/mocha')!.remediated, null);
    assert.equal((await post('/api/remediate', { scenario: QIX, repo: 'mochajs/mocha', action: 'remediated' })).status, 404); // no triage in this session
    for (let i = 1; i < 50; i++) assert.equal((await post('/api/remediate', { scenario: QIX, repo: 'github/docs', action: 'remediated' }, { cookie: a.sid! })).status, 200);
    assert.equal((await post('/api/remediate', { scenario: QIX, repo: 'github/docs', action: 'remediated' }, { cookie: a.sid! })).status, 429);
    assert.match((await get('/api/health', { cookie: 'pz_sid=forged' })).headers.get('set-cookie')!, /^pz_sid=[0-9a-f]{32};/);
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.match((await get('/api/health')).headers.get('set-cookie')!, /; Secure/);
    } finally {
      if (env === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = env;
    }
  });

  test('S7/S2 guest fetch: one ingest at a time, streamed and cut at 5 MB, no GH_TOKEN, no npm, HEAD fallback labelled', async () => {
    const realFetch = globalThis.fetch;
    const seen: { url: string; auth: string | null }[] = [];
    let pulled = 0;
    let open = () => {};
    const gate = new Promise<void>((r) => (open = r));
    const sha = 'a'.repeat(40);
    process.env.GH_TOKEN = 'ghp_test_SECRET_never_sent';
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      seen.push({ url, auth: new Headers(init?.headers).get('authorization') });
      if (url.includes('/octo/slow/')) await gate;
      if (url.startsWith('https://api.github.com/repos/octo/big/')) return new Response(JSON.stringify([{ sha }]));
      if (url.startsWith('https://api.github.com/')) return new Response('{"message":"API rate limit exceeded"}', { status: 403 });
      if (url.includes('/octo/big/')) return new Response(new ReadableStream({ pull: (c) => void (pulled++, c.enqueue(new Uint8Array(1 << 20))) }));
      if (url.includes('/octo/small/HEAD/')) return new Response(tiny('small'));
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;
    try {
      const slow = await post('/api/analyze', { url: 'https://github.com/octo/slow', scenario: QIX });
      assert.equal((await post('/api/analyze', { url: 'https://github.com/octo/small', scenario: QIX })).status, 429);
      open();
      assert.match((await sse<Extract<AnalyzeEvent, { type: 'error' }>>(slow)).at(-1)!.message, /No package-lock.json at the root of octo\/slow/);

      const big = (await sse<AnalyzeEvent>(await post('/api/analyze', { url: 'https://github.com/octo/big', scenario: QIX }))).at(-1)!;
      assert.equal(big.type, 'error');
      assert.match((big as Extract<AnalyzeEvent, { type: 'error' }>).message, /too large/);
      assert.ok(pulled <= 8, `read ${pulled} MB`);
      assert.ok(seen.some((s) => s.url === `https://raw.githubusercontent.com/octo/big/${sha}/package-lock.json`)); // the historical commit

      const small = (await sse<AnalyzeEvent>(await post('/api/analyze', { url: 'https://github.com/octo/small', scenario: QIX }))).at(-1)!;
      assert.equal(small.type, 'ready', JSON.stringify(small));
      assert.equal((small as Extract<AnalyzeEvent, { type: 'ready' }>).repo, 'octo/small@HEAD');
      assert.ok(seen.every((s) => s.auth === null), 'GH_TOKEN must never leave on the guest path');
      assert.ok(seen.every((s) => /^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//.test(s.url)), 'no npm registry calls');
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.GH_TOKEN;
      open();
    }
  });

  test('S7: at most 4 triage/ask streams at once, server-wide', async () => {
    const t = await triageRun({ scenario: QIX, at: QAT });
    const runId = of(t.evs, 'start').runId;
    let open = () => {};
    const gate = new Promise<void>((r) => (open = r));
    hooks.chat = async () => (await gate, { text: 'Notify `QA`.', toolCalls: [], provider: 'groq:fake', raw: {} });
    try {
      const streams = [];
      for (let i = 0; i < 4; i++) streams.push(await post('/api/ask', { runId, question: 'q' }, { cookie: t.sid! }));
      assert.deepEqual(streams.map((r) => r.status), [200, 200, 200, 200]);
      assert.equal((await post('/api/ask', { runId, question: 'q' }, { cookie: t.sid! })).status, 429);
      assert.equal((await post('/api/triage', { scenario: QIX })).status, 429);
      open();
      for (const r of streams) assert.equal((await sse<TriageEvent>(r)).at(-1)?.type, 'done');
      assert.equal((await sse<TriageEvent>(await post('/api/ask', { runId, question: 'q' }, { cookie: t.sid! }))).at(-1)?.type, 'done');
    } finally {
      delete hooks.chat;
      open();
    }
  });

  test('plan returns GRAPH.EXPLAIN lines for a tool query', async () => {
    const { plan } = await (await get(`/api/plan?scenario=${QIX}&tool=explain_path`)).json();
    assert.ok(plan.length >= 1 && plan.some((l: string) => /Index Scan|Traverse/.test(l)), plan.join('\n'));
  });

  test('S12: a forced failure gives a generic error and request id, never a stack', () => quiet(async () => {
    process.env.PZ_GRAPH_PREFIX = `pz_test_missing_${process.pid}`;
    try {
      const r = await get(`/api/exposure?scenario=${QIX}&at=${QAT}`);
      assert.equal(r.status, 500);
      const body = await r.json();
      assert.deepEqual(Object.keys(body).sort(), ['error', 'requestId']);
      assert.doesNotMatch(JSON.stringify(body), /pz_test|Error|\.ts|empty key/);
      const evs = await sse<TriageEvent>(await post('/api/triage', { scenario: QIX, at: QAT }));
      assert.equal(of(evs, 'error').message, 'Triage failed on our side.');
      assert.doesNotMatch(JSON.stringify(evs), /pz_test_missing|stack|\.ts:/);
    } finally {
      process.env.PZ_GRAPH_PREFIX = prefix;
    }
  }));

  test('guest LRU keeps 4 graphs and GRAPH.DELETEs the oldest when a 5th arrives', async () => {
    const names: string[] = [];
    for (let i = 0; i < 5; i++) {
      const evs: AnalyzeEvent[] = [];
      for await (const e of guests.analyze(guests.prepare({ lockfile: tiny(`lru-${i}`) }), QIX, 'lru-session', 'test', new AbortController().signal, prefix)) evs.push(e);
      const ready = evs.at(-1) as Extract<AnalyzeEvent, { type: 'ready' }>;
      assert.equal(ready.type, 'ready');
      names.push(ready.graph);
    }
    const live = new Set(await (await db()).list());
    assert.equal(live.has(names[0]), false);
    assert.ok(names.slice(1).every((g) => live.has(g)));
    assert.equal(guests.guest(names[0], 'lru-session'), undefined);
    assert.ok(guests.guest(names[4], 'lru-session'));
    assert.equal(guests.guest(names[4], 'another-session'), undefined);
  });
});
