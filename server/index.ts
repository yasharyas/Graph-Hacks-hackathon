// HTTP API (docs/contracts.md "HTTP API"). Every number is a live graph query: exposure re-runs its Cypher per call;
// only the timeline (static org graphs, one point a minute) and incident headers are computed once and kept in memory.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { getCookie, setCookie } from 'hono/cookie';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { streamSSE } from 'hono/streaming';
import type { AnalyzeEvent, Exposure, IncidentMeta, LockSource, ScannerHit, ScenarioId, Tier, TimelinePoint, ToolName, TriageEvent } from '../shared/events.ts';
import { ask, latestRun, recall, remember, type ChatFn, type Run } from './agent/ask.ts';
import { narrated } from './agent/replay.ts';
import { triage } from './agent/triage.ts';
import { explain, graph, orgGraph } from './graph/client.ts';
import * as guests from './ingest/guest.ts';
import * as security from './security.ts';
import { errorBody, HttpError, limited, MAX_LOCKFILE_BYTES } from './security.ts';
import * as Q from './tools/cypher.ts';
import * as T from './tools/registry.ts';
import type { Graph } from './tools/types.ts';

type Env = { Variables: RequestIdVariables & { sid: string } };
type C = Context<Env>;
export const app = new Hono<Env>();
export const hooks: { chat?: ChatFn } = {}; // tests inject a fake LLM for /api/ask

const MIN = 60_000;
const DAY = 1440 * MIN;
const TIERS: Tier[] = ['LOCKED', 'WOULD_PULL', 'MAINTAINER', 'CLEAN'];
const json = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const SNAPSHOT: Record<ScenarioId, string> = json('../data/org/acme.json').scenarios;
const SCENARIOS = Object.keys(SNAPSHOT) as ScenarioId[];
// The clock a run uses when the request names none: the moments the replays were recorded at.
const DEFAULT_AT: Record<ScenarioId, number> = { 'qix-2025-09-08': Date.parse('2025-09-08T13:30:00Z'), 'axios-2026-03-31': Date.parse('2026-03-31T01:30:00Z') };
// Tests point the API at their own pz_test_* graphs.
const prefix = () => (/^pz[a-z0-9_]*$/.test(process.env.PZ_GRAPH_PREFIX ?? '') ? process.env.PZ_GRAPH_PREFIX! : 'pz');
const org = (s: ScenarioId) => graph(orgGraph(s, prefix()));

// ---------- middleware ----------

export const STYLE_HASHES = ["'sha256-jtRRMYY2VbEXuBKbHvqM1/fPT8vazFrEooXdvwUK4y8='", "'sha256-9xjtvxMT1ApHlgn9ohbh2FNfvK5Tqtzy94BjfXBeMSY='"];
app.use(requestId({ headerName: '' })); // S12: always generated here, never taken from the client
// S5/S8: strict CSP, no framing, no referrer. No CORS middleware = same-origin only.
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      // force-graph and float-tooltip inject one fixed <style> each (test/security.test.ts recomputes these hashes)
      styleSrc: ["'self'", ...STYLE_HASHES],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: 'no-referrer',
    permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  }),
);
// gzip for API JSON over 1 KB; web/dist ships .br/.gz made at build (scripts/precompress.ts), which compress() leaves
// alone because they already carry Content-Encoding. Hono's filter never matches text/event-stream, so SSE is untouched.
app.use(compress());
// Vite's hashed /assets/* never change under the same name; the HTML shell is revalidated so a deploy shows at once.
// API responses can carry Set-Cookie (pz_sid), so no shared cache may keep them.
app.use('*', async (c, next) => {
  await next();
  if (c.req.path.startsWith('/api/')) return void c.res.headers.set('Cache-Control', 'no-store');
  if (c.res.status !== 200) return;
  const html = c.res.headers.get('content-type')?.startsWith('text/html');
  if (c.req.path.startsWith('/assets/') && !html) c.res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  else if (html) c.res.headers.set('Cache-Control', 'no-cache');
});
// S7: 8 KB everywhere, except a 5 MB lockfile once JSON-escaped (quotes and newlines grow it by up to ~25%).
app.use('/api/*', (c, next) =>
  bodyLimit({
    maxSize: c.req.path === '/api/analyze' ? Math.ceil(MAX_LOCKFILE_BYTES * 1.3) : 8 * 1024,
    onError: (c) => c.json({ error: 'Request body too large.', requestId: c.get('requestId') }, 413),
  })(c, next),
);
// S10: anonymous session, random 128-bit, scopes remediation memory, runs and guest graphs.
app.use('/api/*', async (c, next) => {
  let sid = getCookie(c, 'pz_sid');
  if (!sid || !/^[0-9a-f]{32}$/.test(sid)) {
    sid = randomBytes(16).toString('hex');
    setCookie(c, 'pz_sid', sid, { httpOnly: true, sameSite: 'Strict', secure: process.env.NODE_ENV === 'production', path: '/' });
  }
  c.set('sid', sid);
  if (c.req.method === 'POST' && !/^application\/json\b/i.test(c.req.header('content-type') ?? ''))
    return c.json({ error: 'Send JSON (Content-Type: application/json).', requestId: c.get('requestId') }, 415);
  await next();
});
app.onError((err, c) => {
  const { status, body } = errorBody(err, c.get('requestId'));
  return c.json(body, status as 400);
});

// ---------- validation (S1) ----------

async function body(c: C, keys: string[]): Promise<Record<string, unknown>> {
  const b = await c.req.json().catch(() => null);
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new HttpError(400, 'Expected a JSON object.');
  const extra = Object.keys(b).find((k) => !keys.includes(k));
  if (extra !== undefined) throw new HttpError(400, `Unexpected field: ${extra.slice(0, 40)}`);
  return b;
}
function scenarioOf(x: unknown): ScenarioId {
  if (typeof x !== 'string' || !Object.hasOwn(SNAPSHOT, x)) throw new HttpError(400, 'Unknown scenario.');
  return x as ScenarioId;
}
// Epoch ms, an integer within 30 days of the incident.
function atOf(t: unknown, s: ScenarioId): number {
  if (typeof t !== 'number' || !Number.isSafeInteger(t) || Math.abs(t - Date.parse(SNAPSHOT[s])) > 30 * DAY)
    throw new HttpError(400, 'at must be epoch milliseconds within 30 days of the incident.');
  return t;
}
function textOf(x: unknown, what: string): string {
  if (typeof x !== 'string' || !x.trim() || x.length > 500) throw new HttpError(400, `${what} must be 1 to 500 characters.`);
  return x.trim();
}
const REPO = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}(@HEAD)?$/; // guest repos fetched at HEAD carry "@HEAD"

// S7: per-client limits, in memory, keyed by clientKey (IPv6 grouped by /64). The client is the socket address, or
// on Render the last x-forwarded-for hop.
const { clientKey } = security;
function ip(c: C) {
  // The LAST hop is the one Render's proxy appended; earlier hops are whatever the caller sent (spoofable).
  if (process.env.RENDER) return c.req.header('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // app.request() in tests has no socket
  }
}
// Local dev only: several tools share one localhost address, so PZ_RATE_SCALE can raise limits. Ignored in production.
const RATE_SCALE = process.env.NODE_ENV === 'production' ? 1 : Math.max(1, Math.min(100, Number(process.env.PZ_RATE_SCALE) || 1));
function limit(c: C, name: string, max: number, windowMs: number) {
  if (limited(`${name}:${clientKey(ip(c))}`, max * RATE_SCALE, windowMs)) throw new HttpError(429, 'Too many requests. Wait a moment and try again.');
}

// ---------- SSE ----------

let running = 0; // S7: concurrent triage + ask streams, server-wide
const RUNS_MAX = 4;
function slot() {
  if (running >= RUNS_MAX) throw new HttpError(429, 'The server is busy with other runs. Try again in a few seconds.');
  running++;
  return () => void running--;
}

// One JSON event per data line, a heartbeat comment every 15 s, at most 60 s. When the client leaves or time runs
// out, the producer's signal aborts and the producer is abandoned. Errors become a generic event (S12).
function sse(c: C, make: (signal: AbortSignal) => AsyncIterable<TriageEvent | AnalyzeEvent>, release = () => {}) {
  return streamSSE(c, async (stream) => {
    const ac = new AbortController();
    const send = (e: unknown) => stream.writeSSE({ data: JSON.stringify(e) });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = new Promise<'timeout' | 'gone'>((res) => {
      timer = setTimeout(() => res('timeout'), 60_000);
      stream.onAbort(() => res('gone'));
    });
    const beat = setInterval(() => void stream.write(': keep-alive\n\n'), 15_000);
    let it: AsyncIterator<unknown> | undefined;
    try {
      it = make(ac.signal)[Symbol.asyncIterator]();
      for (;;) {
        const r = await Promise.race([it.next(), stop]);
        if (r === 'timeout') await send({ type: 'error', message: 'This took longer than 60 seconds and was stopped. Try again.', requestId: c.get('requestId') });
        if (typeof r === 'string' || r.done) break;
        await send(r.value);
      }
    } catch (err) {
      console.error(`[${c.get('requestId')}]`, err);
      await send({ type: 'error', message: 'Something went wrong on our side.', requestId: c.get('requestId') });
    } finally {
      clearTimeout(timer);
      clearInterval(beat);
      ac.abort();
      it?.return?.().catch(() => {});
      release();
    }
  });
}

// ---------- graph reads ----------

function memo<T>(cache: Map<string, Promise<T>>, key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => (cache.delete(key), Promise.reject(e))));
  return cache.get(key)!;
}

const incidents = new Map<string, Promise<IncidentMeta>>();
const incident = (g: Graph, s: ScenarioId) => memo(incidents, g.name, async () => {
  const h = await T.incidentHeader(g, s);
  if (!h) throw new Error(`Incident ${s} is not in graph ${g.name}`);
  return h.incident;
});

const rank = (e: Exposure) => ({ LOCKED: 0, WOULD_PULL: e.dev ? 2 : 1, MAINTAINER: 3, CLEAN: 4 })[e.tier];

// The tiering triage() reports: incident_exposure (MAINTAINER included) plus the scanner baselines.
async function exposureAt(g: Graph, s: ScenarioId, at: number) {
  const rows = T.rowsOf<T.ExposureRow>(await T.incidentExposure(g, { incident: s, at }));
  const scan = await T.scannerView(g, { incident: s, at });
  return {
    at,
    counts: Object.fromEntries(TIERS.map((t) => [t, rows.filter((r) => r.tier === t).length])) as Record<Tier, number>,
    exposures: rows.filter((r) => r.tier !== 'CLEAN').sort((a, b) => rank(a) - rank(b) || a.depth - b.depth || a.repo.localeCompare(b.repo))
      .map(({ since: _since, ...e }): Exposure => e),
    scanner: T.rowsOf<ScannerHit>(scan.result),
    grepCount: scan.grepCount,
  };
}

// Every minute from the lockfile snapshot to 30 min after removal, from the same exposureAt as /api/exposure. Answers
// only change at CHANGE_TIMES, so exposureAt runs once per segment between them (once per change, not once per
// minute) and its result is exact for every minute in that segment.
const timelines = new Map<string, Promise<{ incident: IncidentMeta; points: TimelinePoint[] }>>();
const timeline = (s: ScenarioId) => {
  const g = org(s);
  return memo(timelines, g.name, async () => {
    const inc = await incident(g, s);
    const changes = (await g.ro(Q.CHANGE_TIMES, { incident: s })).rows.map((r) => Number(r.t)).filter(Number.isFinite);
    const points: TimelinePoint[] = [];
    let segment = -1;
    let x: Awaited<ReturnType<typeof exposureAt>> | undefined;
    for (let at = Date.parse(SNAPSHOT[s]); at <= inc.removedAt + 30 * MIN; at += MIN) {
      const seg = changes.filter((t) => t <= at).length; // same count of changes behind = same answer
      if (seg !== segment || !x) [segment, x] = [seg, await exposureAt(g, s, at)];
      points.push({ at, counts: x.counts, scanner: x.scanner.length });
    }
    return { incident: inc, points };
  });
};

// A free-text alert picks the incident whose account, packages or versions it names most; "HH:MM" sets the clock
// on the incident's day.
const TERMS = SCENARIOS.map((s) => {
  const inc = json(`../data/incidents/${s}.json`) as { compromised: string | null; versions: { id: string }[] };
  const names = inc.versions.flatMap((v) => [v.id, v.id.slice(0, v.id.lastIndexOf('@'))]);
  return { s, terms: new Set([s, inc.compromised ?? '', ...names].filter(Boolean)) };
});
function fromAlert(text: string): { s: ScenarioId; at?: number } {
  const words = (text.toLowerCase().match(/[a-z0-9@._/-]+/g) ?? []).map((w) => w.replace(/[.,]+$/, ''));
  const name = (w: string) => (w.lastIndexOf('@') > 0 ? w.slice(0, w.lastIndexOf('@')) : w);
  const [best] = TERMS.map(({ s, terms }) => ({ s, n: words.filter((w) => terms.has(w) || terms.has(name(w))).length })).sort((a, b) => b.n - a.n);
  if (!best?.n) throw new HttpError(400, 'The alert names no known incident, account or package. Try "qix compromised, 13:16 UTC".');
  const m = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  return { s: best.s, at: m ? Date.parse(`${SNAPSHOT[best.s].slice(0, 10)}T${m[1].padStart(2, '0')}:${m[2]}:00Z`) : undefined };
}

// Keeps each finished report (by runId, with its session and graph) for Ask and remediation.
async function* remembering(events: AsyncIterable<TriageEvent>, ctx: Omit<Run, 'runId' | 'report'>): AsyncGenerator<TriageEvent> {
  let runId = '';
  for await (const e of events) {
    if (e.type === 'start') runId = e.runId;
    if (e.type === 'report') remember({ ...ctx, runId, report: e.report });
    yield e;
  }
}

// GET /api/plan: each tool's main query, EXPLAINed with fixed sample values. Never Cypher from the request (S3).
const PLAN: Record<ToolName, string> = {
  find_target: Q.FIND_TARGET, suspect_versions: Q.SUSPECT_VERSIONS, incident_exposure: Q.EXPOSURE_ADMITS, maintainer_blast_radius: Q.MAINTAINER_BLAST_RADIUS,
  explain_path: Q.EXPLAIN_PATH, route_owners: Q.ROUTE_OWNERS, concentration_risk: Q.CONCENTRATION_RISK, draft_remediation: Q.REMEDIATION_RANGES,
  scanner_view: Q.SCANNER_VIEW, filter_exposures: Q.EXPOSURE_ADMITS, recall_triage: Q.RECALL_TRIAGE,
};
const SAMPLE = { terms: ['qix'], maintainer: 'qix', since: 0, until: 0, incident: 'qix-2025-09-08', at: 0, repo: 'mochajs/mocha', version: 'debug@4.4.2', repos: ['mochajs/mocha'], top: 3, versions: ['debug@4.4.2'], session: 'sample' };

// ---------- routes ----------

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/scenarios', async (c) => c.json(await Promise.all(SCENARIOS.map((s) => incident(org(s), s)))));

app.get('/api/timeline', async (c) => c.json(await timeline(scenarioOf(c.req.query('scenario')))));

app.get('/api/exposure', async (c) => {
  limit(c, 'exposure', 120, MIN);
  const s = scenarioOf(c.req.query('scenario'));
  const at = c.req.query('at') ?? '';
  return c.json(await exposureAt(org(s), s, atOf(/^\d{1,15}$/.test(at) ? Number(at) : NaN, s)));
});

app.post('/api/triage', async (c) => {
  limit(c, 'triage', 5, 10 * MIN);
  const b = await body(c, ['scenario', 'at', 'alert', 'guest']);
  const session = c.get('sid');
  let s: ScenarioId;
  let at: number | undefined;
  let alert: string | undefined;
  let guestGraph: string | undefined;
  let source: LockSource | undefined;
  if (b.guest !== undefined) {
    s = scenarioOf(b.scenario);
    const e = guests.guest(b.guest, session);
    if (!e || e.scenario !== s) throw new HttpError(404, 'That analysis has expired. Paste the repo again.');
    guestGraph = e.graph;
    source = e.source;
  } else if (b.alert !== undefined) {
    if (b.scenario !== undefined) throw new HttpError(400, 'Send an alert or a scenario, not both.');
    alert = textOf(b.alert, 'The alert');
    ({ s, at } = fromAlert(alert));
  } else s = scenarioOf(b.scenario);
  at = b.at !== undefined ? atOf(b.at, s) : (at ?? DEFAULT_AT[s]);
  const name = guestGraph ?? orgGraph(s, prefix());
  const release = slot();
  return sse(c, (signal) => remembering(narrated(triage({ graph: graph(name), scenario: s, at, alert, session, source, signal }), s, at, !guestGraph), { session, graph: name, scenario: s, at }), release);
});

app.post('/api/ask', async (c) => {
  limit(c, 'ask', 10, 10 * MIN);
  const b = await body(c, ['runId', 'question']);
  if (typeof b.runId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.runId)) throw new HttpError(400, 'runId is not valid.');
  const question = textOf(b.question, 'The question');
  const run = recall(b.runId, c.get('sid'));
  if (!run) throw new HttpError(404, 'That triage has expired. Run it again to ask follow-ups.');
  const release = slot();
  return sse(c, (signal) => ask({ run, question, signal, chatFn: hooks.chat }), release);
});

app.post('/api/analyze', async (c) => {
  limit(c, 'analyze', 1, 20_000);
  const b = await body(c, ['url', 'lockfile', 'scenario']);
  const s = scenarioOf(b.scenario);
  if ((b.url === undefined) === (b.lockfile === undefined)) throw new HttpError(400, 'Send a GitHub repo URL or the contents of a package-lock.json.');
  const input = guests.prepare(b);
  if (guests.busy()) throw new HttpError(429, 'Another repo is being analyzed right now. Try again in a few seconds.');
  return sse(c, (signal) => guests.analyze(input, s, c.get('sid'), c.get('requestId'), signal, prefix()));
});

// S10: "mark remediated" writes to the graph of this session's latest run that lists the repo; 50 marks per session.
const marks = new Map<string, number>();
app.post('/api/remediate', async (c) => {
  limit(c, 'remediate', 30, 10 * MIN);
  const b = await body(c, ['scenario', 'repo', 'action']);
  const s = scenarioOf(b.scenario);
  if (typeof b.repo !== 'string' || !REPO.test(b.repo)) throw new HttpError(400, 'repo must be owner/name.');
  if (b.action !== 'remediated') throw new HttpError(400, 'Unknown action.');
  const session = c.get('sid');
  const run = latestRun(session, s, b.repo);
  const e = run?.report.exposures.find((x) => x.repo === b.repo);
  if (!run || !e) throw new HttpError(404, 'Run a triage that lists this repo first.');
  if ((marks.get(session) ?? 0) >= 50) throw new HttpError(429, 'This session has reached its 50 remediation marks.');
  if (marks.size > 10_000) marks.clear(); // ponytail: crude bound, like the limiter's
  marks.set(session, (marks.get(session) ?? 0) + 1);
  await T.recordTriage(run.graph, { session, incident: s, at: Date.now(), summary: `${b.repo} marked remediated`, assessed: [{ repo: b.repo, tier: e.tier, action: 'remediated' }] });
  return c.json({ ok: true });
});

app.get('/api/plan', async (c) => {
  limit(c, 'plan', 60, MIN);
  const s = scenarioOf(c.req.query('scenario'));
  const tool = c.req.query('tool') ?? '';
  if (!Object.hasOwn(PLAN, tool)) throw new HttpError(400, 'Unknown tool.');
  return c.json({ plan: await explain(orgGraph(s, prefix()), PLAN[tool as ToolName], SAMPLE) });
});

// Node and edge counts of a demo graph (immutable apart from session triage records, so counted once per process).
const statsCache = new Map<string, Promise<{ graph: string; nodes: { label: string; count: number }[]; edges: { type: string; count: number }[]; ms: number }>>();
const stats = (s: ScenarioId) => {
  const g = org(s);
  return memo(statsCache, g.name, async () => {
    const [n, e] = [await g.ro(Q.NODE_COUNTS), await g.ro(Q.EDGE_COUNTS)];
    return { graph: g.name, nodes: n.rows as { label: string; count: number }[], edges: e.rows as { type: string; count: number }[], ms: n.ms + e.ms };
  });
};
app.get('/api/stats', async (c) => {
  limit(c, 'stats', 60, MIN);
  return c.json(await stats(scenarioOf(c.req.query('scenario'))));
});

app.all('/api/*', (c) => c.json({ error: 'Not found.', requestId: c.get('requestId') }, 404));

app.use('/*', serveStatic({ root: './web/dist', precompressed: true }));
app.all('/assets/*', (c) => c.text('Not found.', 404)); // a stale chunk after a deploy must 404, not get the SPA shell
app.get('*', serveStatic({ path: './web/dist/index.html', precompressed: true }));

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 8080);
  serve({ fetch: app.fetch, port }, () => console.log(`patient-zero on :${port}`));
  for (const s of SCENARIOS) timeline(s).catch((e) => console.error('timeline warm-up failed', e)); // first visitor gets it cached
  for (const s of SCENARIOS) stats(s).catch((e) => console.error('stats warm-up failed', e));
  // Fill the path/fix memo for each scenario's default clock, so the first demo run after a cold start is fast too.
  (async () => {
    for (const s of SCENARIOS) for await (const _ of triage({ graph: org(s), scenario: s, at: DEFAULT_AT[s], signal: AbortSignal.abort() }));
  })().catch((e) => console.error('triage warm-up failed', e));
}
