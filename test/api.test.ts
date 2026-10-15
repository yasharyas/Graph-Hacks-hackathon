// HTTP API end to end through app.request() on throwaway pz_test_<pid>_* graphs (guest graphs included), skipped
// cleanly when FalkorDB is unreachable. LLM_CHAIN=replay: no network; the committed replays stand in for live narration.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { guard } from '../server/agent/guard.ts';
import type { ChatReq, ChatRes, Msg } from '../server/agent/llm.ts';
import { evidenceSet, observations } from '../server/agent/narrate.ts';
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
// the first event of a kind; a draft narration (the verdict before the analyst pick) is skipped for the final one
const of = <K extends TriageEvent['type']>(evs: TriageEvent[], k: K) => evs.find((e) => e.type === k && !(e.type === 'narration' && e.draft)) as Extract<TriageEvent, { type: K }>;
const final = (evs: TriageEvent[]) => evs.filter((e) => !(e.type === 'narration' && e.draft));
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
    const scenarios = await (await get('/api/scenarios')).json();
    assert.deepEqual(scenarios.map((s: { id: string }) => s.id), [QIX, 'axios-2026-03-31']);
    // One "minutes ahead" everywhere: advisoryAt - firstExposureAt, computed per graph (axios: 00:21:58, not 23:59).
    assert.deepEqual(scenarios.map((s: { advisoryAt: number; firstExposureAt: number }) => Math.floor((s.advisoryAt - s.firstExposureAt) / 60_000)), [74, 105]);
    assert.deepEqual(scenarios.map((s: { firstExposureAt: number }) => new Date(s.firstExposureAt).toISOString()), ['2025-09-08T13:12:10.343Z', '2026-03-31T00:21:58.168Z']);
    // graph stats before any triage: counts per label and edge type
    const stats = await (await get(`/api/stats?scenario=${QIX}`)).json();
    const count = (xs: { count: number }[], k: string, key: 'label' | 'type') => (xs as Record<string, unknown>[]).find((x) => x[key] === k)?.count;
    assert.equal(count(stats.nodes, 'Repo', 'label'), 21);
    assert.ok(Number(count(stats.nodes, 'Dep', 'label')) > 1000 && Number(count(stats.edges, 'ADMITS', 'type')) > 0);
    assert.equal((await get('/api/stats?scenario=nope')).status, 400);
    const nf = await get('/api/nope', { 'x-request-id': 'attacker-chosen' });
    assert.equal(nf.status, 404);
    const body = await nf.json();
    assert.deepEqual(Object.keys(body).sort(), ['error', 'requestId']);
    assert.notEqual(body.requestId, 'attacker-chosen');
    assert.equal(nf.headers.get('x-request-id'), null);
  });

  test('timeline is a 1-minute grid; every point checked equals /api/exposure at that minute (both scenarios)', async () => {
    const t0 = performance.now();
    const t = await (await get(`/api/timeline?scenario=${QIX}`)).json();
    const ms = performance.now() - t0;
    assert.ok(ms < 5000, `timeline took ${Math.round(ms)} ms`);
    assert.equal(t.points[0].at, Date.parse('2025-09-08T13:00:00Z'));
    assert.ok(t.points.every((p: { at: number }, i: number) => i === 0 || p.at - t.points[i - 1].at === 60_000));
    assert.ok(t.points.at(-1).at >= t.incident.removedAt + 29 * 60_000);
    const point = (tl: typeof t, at: number) => tl.points.find((x: { at: number }) => x.at === at);
    const same = async (tl: typeof t, scenario: string, at: number) => {
      const x = await (await get(`/api/exposure?scenario=${scenario}&at=${at}`)).json();
      assert.deepEqual(point(tl, at).counts, x.counts, new Date(at).toISOString());
      assert.equal(point(tl, at).scanner, x.scanner.length, new Date(at).toISOString());
      return x;
    };
    // the minutes QA saw disagree (13:13, 15:15), the advisory minute, and every 7th minute across the window
    for (const hhmm of ['13:12', '13:13', '13:14', '13:30', '14:26', '14:27', '15:14', '15:15', '15:30']) await same(t, QIX, Date.parse(`2025-09-08T${hhmm}:00Z`));
    for (let i = 0; i < t.points.length; i += 7) await same(t, QIX, t.points[i].at);
    assert.ok((await same(t, QIX, QAT)).counts.WOULD_PULL > 0);
    // The first exposed minute is the first one at or after firstExposureAt, in both scenarios.
    for (const scenario of [QIX, 'axios-2026-03-31']) {
      const tl = scenario === QIX ? t : await (await get(`/api/timeline?scenario=${scenario}`)).json();
      const exposed = (p: { counts: Record<string, number> }) => p.counts.LOCKED + p.counts.WOULD_PULL > 0;
      assert.equal(tl.points.find(exposed).at, Math.ceil(tl.incident.firstExposureAt / 60_000) * 60_000, scenario);
      await same(tl, scenario, tl.points.find(exposed).at - 60_000);
    }
  });

  for (const [scenario, at, key] of [[QIX, QAT, '2025-09-08T13:30Z'], ['axios-2026-03-31', undefined, '2026-03-31T01:30Z']] as const) {
    test(`triage SSE ${scenario}: start, tools, report, deterministic text + replayed note, guard over both, done; counts equal /api/exposure`, async () => {
      const { evs, report } = await triageRun({ scenario, ...(at && { at }) });
      assert.equal(evs[0].type, 'start');
      assert.deepEqual(final(evs).slice(-4).map((e) => e.type), ['report', 'narration', 'guard', 'done']);
      const tools = final(evs).slice(1, -4);
      // the verdict shows right after the report, before the model picks; the final narration carries the same text
      const draft = evs[evs.findIndex((e) => e.type === 'report') + 1] as Extract<TriageEvent, { type: 'narration' }>;
      assert.deepEqual([draft.type, draft.draft, draft.note], ['narration', true, null]);
      assert.equal(draft.text, of(evs, 'narration').text);
      assert.ok(tools.length > 0 && tools.every((e, i) => e.type === (i % 2 ? 'tool_result' : 'tool_start')), tools.map((e) => e.type).join());
      const narration = of(evs, 'narration');
      assert.equal(narration.mode, 'replay');
      const pick = JSON.parse(readFileSync(`data/replays/${scenario}.json`, 'utf8'))[key].pick; // the recorded id, worded fresh
      assert.equal(narration.note, observations(report).find((o) => o.id === pick)!.text);
      assert.match(narration.text, /^Verdict: .*\nWhy: .*\nNotify: .*\nDo: 1\) /s);
      assert.doesNotMatch(narration.text + narration.note, /\*\*/);
      assert.equal(narration.at, report.at);
      const g = of(evs, 'guard') as Extract<TriageEvent, { type: 'guard' }> & { claims: { text: string; ok: boolean }[] };
      assert.deepEqual(g.flagged, []);
      assert.equal(g.claims.length, g.total);
      assert.equal(g.total, guard(`${narration.text}\n${narration.note}`, evidenceSet(report)).total, 'claims cover the text and the note');
      // one "minutes ahead", stamped on start and report alike; scope; a path and a fix for every exposed repo
      const start = of(evs, 'start');
      assert.equal(start.incident.firstExposureAt, report.incident.firstExposureAt);
      assert.equal(report.minutesAhead, Math.floor((report.incident.advisoryAt - report.incident.firstExposureAt!) / 60_000));
      assert.deepEqual(report.scope, { kind: 'org', label: 'Acme demo org', repos: Object.values(report.counts).reduce((a, b) => a + b, 0) });
      const exposed = report.exposures.filter((e) => e.tier === 'LOCKED' || e.tier === 'WOULD_PULL').map((e) => e.repo).sort();
      assert.deepEqual([...new Set(report.paths.map((p) => p.repo))].sort(), exposed);
      assert.deepEqual(report.remediations.map((m) => m.repo).sort(), exposed);
      assert.ok(report.remediations.every((m) => Object.keys(m.overrides).every((k) => /^(@[^/]+\/)?[^@]+@\d/.test(k))), 'override keys are version-qualified');
      for (const e of exposed) assert.ok(narration.text.includes(`\`${e}\``), `${e} missing from the narration`);
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
      // an open question (no list, repo, rotate, notify or timing intent) is the model's: tools it picks, capped at 6
      const evs = await sse<TriageEvent>(await post('/api/ask', { runId, question: 'Which maintainer is the biggest risk next?' }, { cookie: t.sid! }));
      assert.equal(calls.length, 4);
      assert.deepEqual(calls.map((c) => c.provider), [undefined, 'groq:fake', 'groq:fake', 'groq:fake']);
      const starts = evs.filter((e) => e.type === 'tool_start') as Extract<TriageEvent, { type: 'tool_start' }>[];
      assert.deepEqual([starts.length, starts[0].tool], [6, 'incident_exposure']);
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
      const fb = await sse<TriageEvent>(await post('/api/ask', { runId, question: 'Is anything else worth checking?' }, { cookie: t.sid! }));
      assert.deepEqual(calls.map((c) => [c.provider, c.tools]), [[undefined, 11], ['groq:fake', 11], [undefined, 0]]);
      assert.deepEqual([of(fb, 'narration').mode, of(fb, 'narration').provider, of(fb, 'guard').flagged], ['live', 'gemini:fake', []]);
      assert.equal(of(fb, 'narration').text, 'Notify `QA`.');
    } finally {
      delete hooks.chat;
    }
  });

  test('ask truthfulness: list, repo, rotate and timing questions get the graph\'s own answer; the model is never asked', async () => {
    const t = await triageRun({ scenario: QIX, at: QAT });
    const runId = of(t.evs, 'start').runId;
    const prod = t.report.exposures.filter((e) => e.tier !== 'CLEAN' && !e.dev);
    assert.deepEqual([prod.length, new Set(prod.map((e) => e.team)).size], [14, 6]); // what the table's Prod-only filter shows
    let asked = 0;
    hooks.chat = async (): Promise<ChatRes> => (asked++, { text: '**`acme/checkout-web`** is the only prod-only exposure; npm ci is not safe.', toolCalls: [], provider: 'groq:fake', raw: {} });
    const askQ = async (question: string) => sse<TriageEvent>(await post('/api/ask', { runId, question }, { cookie: t.sid! }));
    try {
      const evs = await askQ('which exposures are prod-only and who owns them?');
      const filter = of(evs, 'tool_result').result;
      assert.deepEqual([filter.tool, filter.params.prod_only, filter.rows.length], ['filter_exposures', true, 14]);
      assert.ok(filter.rows.every((r) => typeof r.team === 'string' && Array.isArray(r.locked) && /^E\d+$/.test(String(r.path))), 'team, locked versions and path id on every row');
      const n = of(evs, 'narration');
      assert.equal(n.mode, 'template');
      assert.match(n.text, /^Complete list \(prod only\): 14 repos across 6 teams\. /);
      for (const e of prod) assert.ok(n.text.includes(`\`${e.repo}\``), `${e.repo} missing`);
      for (const team of new Set(prod.map((e) => e.team!))) assert.ok(n.text.includes(`\`${team}\``), `${team} missing`);
      assert.deepEqual(of(evs, 'guard').flagged, []);
      assert.match(of(await askQ('list all exposed repos with their owners'), 'narration').text, /^Complete list \(no filter\): 21 repos across 7 teams\. /);

      // "is npm ci safe?": rotate only for LOCKED, npm ci safe for the rest (a model said the opposite, three times out of three)
      const rot = of(await askQ('Which repos need secrets rotated, and is npm ci safe for the rest?'), 'narration');
      assert.match(rot.text, /^Rotate secrets for the 1 LOCKED repo: `acme\/checkout-web`\./);
      assert.match(rot.text, /For the other 20 WOULD_PULL repos, installing from the committed lockfile \(npm ci\) is safe/);
      assert.doesNotMatch(rot.text, /not safe/);

      // a named repo: tier in words, its path and owner, its own steps in order (rotate included for LOCKED)
      const repoEvs = await askQ('What should acme/checkout-web do?');
      assert.deepEqual(repoEvs.filter((e) => e.type === 'tool_start').map((e) => (e as { tool: string }).tool), ['explain_path', 'draft_remediation']);
      const fix = of(repoEvs, 'narration');
      assert.match(fix.text, /^`acme\/checkout-web` \(owned by `Payments`, `#team-payments`\) is LOCKED: /);
      assert.match(fix.text, /Do: 1\) Your lockfile pins .*Rotate secrets/);
      assert.deepEqual(of(repoEvs, 'guard').flagged, []);

      // when: start, the OSV gap, and only what is known at the scenario clock
      const when = of(await askQ('When did this start, and how far ahead of the advisory were we?'), 'narration');
      assert.match(when.text, /^Exposure began at 13:12 UTC, when `ansi-styles@6\.2\.2` was published\. The first OSV record came at 14:26 UTC, 74 minutes later\. At 13:30 UTC they were still live\.$/);

      // a list already groups its repos by team: no second, unfiltered Notify roster under it
      assert.doesNotMatch(n.text, /Notify:/);
      // how bad / tell my CISO: the verdict's headline with the team count (7, not a model's 6)
      for (const q of ['how bad is this?', 'what do I tell my CISO?']) {
        const s = of(await askQ(q), 'narration');
        assert.match(s.text, /^21 of 21 repos are exposed .* The exposed repos belong to 7 teams\.$/s, q);
        assert.doesNotMatch(s.text, /^Notify:/m, q);
      }
      // dev-only is not safe to ignore, and npm ci stays safe for WOULD_PULL
      const dev = of(await askQ('can I ignore the dev-only ones?'), 'narration');
      assert.match(dev.text, /^7 of the exposed repos are dev-only: .*Dev-only is not safe to ignore: npm install and npm ci install devDependencies by default/);
      // what first: the verdict's own Notify and Do lines (rotate for the LOCKED repo included), never a tool name
      const first = of(await askQ('what should I do first in the next hour?'), 'narration');
      assert.match(first.text, /^Notify: .*\nDo: .*[Rr]otate secrets/s);
      assert.doesNotMatch(first.text, /draft_remediation|filter_exposures/);
      // which team: open exposures by team, most first, every count from the graph
      const teams = of(await askQ('which team has the most work?'), 'narration');
      assert.match(teams.text, /^Open exposures by team, most first: `[^`]+` \d+ repos/);
      for (const q of ['how bad is this?', 'can I ignore the dev-only ones?', 'which team has the most work?']) assert.deepEqual(of(await askQ(q), 'guard').flagged, [], q);
      assert.equal(asked, 0);
      // customers are not in the graph: the model answers (not the team roster)
      const cust = of(await askQ('do I need to notify customers?'), 'narration');
      assert.equal(asked, 1);
      assert.doesNotMatch(cust.text, /^Notify:/);
    } finally {
      delete hooks.chat;
    }
  });

  test('ask: explain_path and draft_remediation work for any exposed repo, whatever casing or version the model sends', async () => {
    const t = await triageRun({ scenario: QIX, at: QAT });
    const runId = of(t.evs, 'start').runId;
    let k = 0;
    hooks.chat = async (): Promise<ChatRes> => {
      if (++k > 1) return { text: 'Path and fix for `Kong/insomnia` are above.', toolCalls: [], provider: 'groq:fake', raw: {} };
      const toolCalls = [
        { id: 'a', name: 'explain_path', args: { repo: 'kong/insomnia', version: 'lodash@4.17.21' } },
        { id: 'b', name: 'draft_remediation', args: { repo: 'KONG/insomnia', versions: [] } },
      ];
      return { text: '', toolCalls, provider: 'groq:fake', raw: { role: 'assistant', content: null, tool_calls: toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) } };
    };
    try {
      const evs = await sse<TriageEvent>(await post('/api/ask', { runId, question: 'show the path and fix for Kong/insomnia' }, { cookie: t.sid! }));
      const results = evs.filter((e) => e.type === 'tool_result').map((e) => (e as Extract<TriageEvent, { type: 'tool_result' }>).result);
      const kong = t.report.exposures.find((e) => e.repo === 'Kong/insomnia')!;
      const path = results.find((r) => r.tool === 'explain_path')!;
      assert.deepEqual([path.params.repo, path.params.version], ['Kong/insomnia', kong.versions[0]]);
      assert.ok(path.rows.length >= 1 && path.rows.every((r) => Array.isArray(r.chain) && 'range' in r && 'hops' in r));
      assert.equal(new Set(path.rows.map((r) => JSON.stringify([r.kind, r.range, r.chain]))).size, path.rows.length, 'explain_path rows are deduplicated');
      const fix = results.find((r) => r.tool === 'draft_remediation')!;
      assert.deepEqual(fix.params.versions, kong.versions);
      assert.ok(Object.keys(fix.rows[0].overrides as object).length > 0);
      assert.deepEqual(of(evs, 'guard').flagged, []);
    } finally {
      delete hooks.chat;
    }
  });

  test('triage history: each run in a session is remembered (tiers, no action) without hiding a later remediation mark', async () => {
    const a = await triageRun({ scenario: QIX, at: QAT });
    const recall = (evs: TriageEvent[]) => evs.filter((e) => e.type === 'tool_result').map((e) => (e as Extract<TriageEvent, { type: 'tool_result' }>).result).find((r) => r.tool === 'recall_triage')!;
    assert.equal(recall(a.evs).summary, 'no earlier assessments in this session');
    const b = await triageRun({ scenario: QIX, at: QAT }, { cookie: a.sid! });
    assert.equal(recall(b.evs).rows.length, 21);
    assert.match(recall(b.evs).summary, /^21 repos assessed earlier in this session; 0 marked remediated$/);
    assert.ok(recall(b.evs).rows.every((r) => r.action === null && typeof r.tier === 'string'));
    await post('/api/remediate', { scenario: QIX, repo: 'remy/nodemon', action: 'remediated' }, { cookie: a.sid! });
    await triageRun({ scenario: QIX, at: QAT }, { cookie: a.sid! }); // writes a newer plain record for nodemon
    const d = await triageRun({ scenario: QIX, at: QAT }, { cookie: a.sid! });
    assert.match(recall(d.evs).summary, /1 marked remediated: remy\/nodemon/);
    assert.equal(d.report.exposures.find((e) => e.repo === 'remy/nodemon')!.remediated?.action, 'remediated');
    assert.match(of(d.evs, 'narration').text, /Marked remediated: `remy\/nodemon`\./);
  });

  test('responses: gzip for JSON, precompressed static, never for SSE; immutable assets, no-cache HTML, no-store API, 404 for a stale chunk', async () => {
    const created = !existsSync('web/dist');
    if (created) {
      mkdirSync('web/dist/assets', { recursive: true });
      writeFileSync('web/dist/index.html', `<!doctype html><title>t</title>${' '.repeat(2048)}`);
      writeFileSync('web/dist/assets/app-0a1b2c3d.js', `console.log(1);${' '.repeat(4096)}`);
    }
    try {
      const gz = { 'accept-encoding': 'gzip, deflate, br' };
      const tl = await get(`/api/timeline?scenario=${QIX}`, gz);
      assert.equal(tl.headers.get('content-encoding'), 'gzip');
      assert.equal(tl.headers.get('cache-control'), 'no-store'); // API responses can carry Set-Cookie
      const body = await new Response(tl.body!.pipeThrough(new DecompressionStream('gzip'))).json(); // app.request() returns the encoded bytes
      assert.ok(body.points.length > 100);
      const sseRes = await post('/api/triage', { scenario: QIX, at: QAT }, gz);
      assert.equal(sseRes.headers.get('content-type'), 'text/event-stream');
      assert.equal(sseRes.headers.get('content-encoding'), null);
      await sse<TriageEvent>(sseRes);
      const asset = readdirSync('web/dist/assets').find((f) => /\.js$/.test(f))!;
      const js = await get(`/assets/${asset}`, gz);
      assert.equal(js.status, 200);
      assert.equal(js.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      assert.equal(js.headers.get('content-encoding'), existsSync(`web/dist/assets/${asset}.br`) ? 'br' : 'gzip'); // .br from scripts/precompress.ts, else compress()
      const stale = await get('/assets/index-00000000.js', gz);
      assert.equal(stale.status, 404); // never the SPA shell under an immutable asset URL
      assert.equal(stale.headers.get('cache-control'), null);
      for (const path of ['/', '/index.html', '/some/client/route']) {
        const html = await get(path, gz);
        assert.equal(html.status, 200, path);
        assert.equal(html.headers.get('cache-control'), 'no-cache', path);
      }
    } finally {
      if (created) rmSync('web/dist', { recursive: true, force: true });
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
    const n = of(t.evs, 'narration');
    assert.deepEqual([n.mode, n.note], ['template', null]); // no recording describes a guest graph
    assert.deepEqual(t.report.scope, { kind: 'guest', label: 'pasted/mocha', repos: 1, source: { kind: 'pasted' } });
    assert.deepEqual(t.report.notices, []);
    assert.match(n.text, /^Verdict \(counterfactual: this checks the lockfile you pasted as if it had been committed on 2025-09-08\): `pasted\/mocha` would have been exposed to the `qix` account compromise only on a fresh install since \d\d:\d\d UTC on \d{4}-\d\d-\d\d \(still live at 13:30 UTC; npm removed them around \d\d:\d\d UTC\); installing from that lockfile would have been safe: it pins .*`debug@4\.3\.5`/);
    assert.doesNotMatch(n.text, /Notify|#your-team/);
    assert.ok(e.locked!.length > 0 && e.locked!.every((v) => !e.versions.includes(v)), 'a WOULD_PULL lockfile pins only safe versions');
    assert.equal(t.report.minutesAhead, Math.floor((t.report.incident.advisoryAt - t.report.incident.firstExposureAt!) / 60_000)); // its own first exposure

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
