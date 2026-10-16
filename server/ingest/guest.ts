// Guest ingest: one public GitHub repo, or a pasted package-lock.json, into its own graph: GRAPH.COPY of the registry
// plus the same write stages as the org graphs (build.ts). Maintainers come from the committed cache only: no npm
// calls and no disk cache on this path; the server's read-only GitHub token is used for the one commits lookup only. The graph name is a server-side hash of the input, never user
// text (S3). LRU 4 + TTL 1 h with GRAPH.DELETE on eviction, one ingest at a time, each graph usable only by the
// sessions that analyzed it (S10).
import type { AnalyzeEvent, LockSource, ScenarioId } from '../../shared/events.ts';
import { db, guestGraph, registryGraph } from '../graph/client.ts';
import { HttpError, MAX_LOCKFILE_BYTES, parseRepo, safeFetch, safeJson } from '../security.ts';
import { badVersions, load, writeAdmits, writeMaintainers, writeRepos, type RepoIn } from './build.ts';
import { parseLockfile, safeRange } from './lockfile.ts';

// Same words as the UI's own checks (web/src/components/PasteBox.tsx).
export const UNSUPPORTED = 'yarn and pnpm lockfiles are not supported yet. Drop a package-lock.json (npm v2 or v3).';
export const OLD_LOCKFILE = 'Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install with npm 7 or newer to upgrade it.';
const TOO_BIG = 'That lockfile is too large. Lockfiles up to 5 MB and 6,000 entries are supported.';
const GITHUB_DOWN = 'GitHub did not answer. Try again, or drop the package-lock.json instead.';
const MAX_ENTRIES = 6000;
const TTL = 3_600_000;
const MAX_GRAPHS = 4;
const GUEST_ORG = { id: 'guest', name: 'Your repo', teams: [{ id: 'guest', name: 'Your team', channel: '#your-team' }] };

type Parsed = ReturnType<typeof parseLockfile>;
// Lockfile text (pasted or fetched) -> parsed deps and edges, or a friendly 400/413 (S1).
export function checkLock(text: string): Parsed & { name: unknown } {
  if (Buffer.byteLength(text) > MAX_LOCKFILE_BYTES) throw new HttpError(413, TOO_BIG);
  if (!/^\s*\{/.test(text)) throw new HttpError(400, UNSUPPORTED); // yarn.lock and pnpm-lock.yaml are not JSON
  const lock = safeJson(text) as { name?: unknown; packages?: unknown } | null;
  if (lock?.packages && typeof lock.packages === 'object' && Object.keys(lock.packages).length > MAX_ENTRIES) throw new HttpError(413, TOO_BIG);
  try {
    return { ...parseLockfile(lock), name: lock?.name };
  } catch (e) {
    const big = /too large/i.test(String((e as Error)?.message)); // parseLockfile's own caps: "Lockfile too large ..."
    throw new HttpError(big ? 413 : 400, big ? TOO_BIG : OLD_LOCKFILE);
  }
}

export type Input = { key: string; repo: string; github?: { owner: string; repo: string }; parsed?: Parsed; source?: LockSource };
// Validates the request before any SSE starts, so bad input gets a real 400/413.
export function prepare(b: { url?: unknown; lockfile?: unknown }): Input {
  if (b.url !== undefined) {
    const r = parseRepo(b.url);
    if (!r) throw new HttpError(400, 'Use a public repo URL like https://github.com/owner/name');
    return { key: `github:${r.owner}/${r.repo}`.toLowerCase(), repo: `${r.owner}/${r.repo}`, github: r };
  }
  if (typeof b.lockfile !== 'string') throw new HttpError(400, 'Send a GitHub repo URL or the contents of a package-lock.json.');
  const { name, ...parsed } = checkLock(b.lockfile);
  const base = String(name ?? '').split('/').pop()!;
  return { key: `lockfile:${b.lockfile}`, repo: `pasted/${/^[A-Za-z0-9._-]{1,100}$/.test(base) && !/^\.+$/.test(base) ? base : 'lockfile'}`, parsed, source: { kind: 'pasted' } };
}

// ---------- GitHub ----------

// `api`: the commits API, with the server's read-only token when set (unauthenticated is 60 an hour per IP, shared on a
// hosting provider) and one same-host redirect (a renamed repo). Raw files need neither: raw.githubusercontent follows renames.
async function get(url: string, signal: AbortSignal, api = false) {
  const headers: Record<string, string> = { 'user-agent': 'patient-zero' };
  if (api && process.env.GH_TOKEN) headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
  try {
    return await safeFetch(url, { headers, sameHost: api, signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
  } catch {
    throw new HttpError(502, GITHUB_DOWN);
  }
}

export type Today = { deps: Record<string, string>; dev: Record<string, string>; versions?: Record<string, string[]> };
// Today's package.json (raw, no API quota): only its direct dependency names and ranges, sanitized and capped.
async function fetchToday(owner: string, repo: string, signal: AbortSignal): Promise<Today | undefined> {
  const res = await get(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`, signal).catch(() => null);
  if (!res?.ok) return void res?.body?.cancel().catch(() => {});
  let pkg: { dependencies?: unknown; devDependencies?: unknown } | null;
  try {
    pkg = safeJson(await capped(res).catch(() => ''), 1_000_000) as typeof pkg;
  } catch {
    return undefined; // a broken or huge package.json only skips the today check, never the analysis
  }
  // Ranges are quoted in the Fix tab and the export: the same semver-token filter as the lockfile (S4).
  const pick = (m: unknown) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {}).slice(0, 2000)
    .filter(([k, v]) => /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(k) && k.length <= 214 && typeof v === 'string')
    .map(([k, v]) => [k, safeRange(v as string)]).filter(([, v]) => v));
  return pkg ? { deps: pick(pkg.dependencies), dev: pick(pkg.devDependencies) } : undefined;
}

// Streams the body and stops at 5 MB: never buffers an unbounded response.
async function capped(res: Response): Promise<string> {
  if (Number(res.headers.get('content-length')) > MAX_LOCKFILE_BYTES) throw new HttpError(413, TOO_BIG);
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    n += r.value.length;
    if (n > MAX_LOCKFILE_BYTES) {
      void reader.cancel().catch(() => {});
      throw new HttpError(413, TOO_BIG);
    }
    chunks.push(r.value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// The lockfile as of the scenario snapshot (commits API). Without a historical commit (none before the incident, or the
// API unavailable) it falls back to today's lockfile, labelled in the repo id and with the reason in `source`.
async function fetchLock({ owner, repo }: { owner: string; repo: string }, snapshotAt: number, signal: AbortSignal, bad: string[] = []) {
  const commits = await get(`https://api.github.com/repos/${owner}/${repo}/commits?path=package-lock.json&until=${new Date(snapshotAt).toISOString()}&per_page=1`, signal, true).catch(() => null);
  if (commits?.status === 404) throw new HttpError(404, `github.com/${owner}/${repo} is not a public repo.`);
  let sha: unknown;
  let date: unknown;
  let url: unknown;
  if (commits?.ok) {
    const c = (safeJson(await capped(commits), 1_000_000) as { sha?: unknown; html_url?: unknown; commit?: { committer?: { date?: unknown } } }[] | null)?.[0];
    sha = c?.sha;
    date = c?.commit?.committer?.date;
    url = c?.html_url;
  } else void commits?.body?.cancel().catch(() => {});
  const ref = typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
  const when = typeof date === 'string' ? Date.parse(date) : NaN;
  // A renamed repo: GitHub redirected the commits call, and the commit's own link names where the repo lives now.
  const moved = typeof url === 'string' ? /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100})\/commit\//.exec(url)?.[1] : undefined;
  const now = moved && moved.toLowerCase() !== `${owner}/${repo}`.toLowerCase() ? moved : undefined;
  const res = await get(`https://raw.githubusercontent.com/${owner}/${repo}/${ref ?? 'HEAD'}/package-lock.json`, signal);
  if (res.status === 404) throw new HttpError(404, await noLockfile(owner, repo, signal, bad));
  if (!res.ok) throw new HttpError(502, GITHUB_DOWN);
  const { name: _name, ...parsed } = checkLock(await capped(res));
  const source: LockSource = ref ? { kind: 'snapshot', sha: ref, ...(Number.isFinite(when) && { date: when }), ...(now && { now }) } : { kind: 'head', reason: commits?.ok ? 'no-history' : 'unavailable' };
  const today = ref ? await fetchToday(owner, repo, signal) : undefined; // only a snapshot can differ from today
  return { parsed, sha: ref, source, today, repo: ref ? `${owner}/${repo}` : `${owner}/${repo}@HEAD` }; // @HEAD: today's lockfile, a counterfactual
}

// Which lockfile the repo uses instead, so the error says what to do (HEAD requests only: nothing is downloaded).
async function noLockfile(owner: string, repo: string, signal: AbortSignal, bad: string[] = []): Promise<string> {
  const list = bad.length ? `${bad.slice(0, 6).map((v) => v.replace(/@(?=[^@]*$)/, ' ')).join(', ')}${bad.length > 6 ? ` and ${bad.length - 6} more (the timeline lists them all)` : ''}` : '';
  for (const [file, tool] of [['yarn.lock', 'yarn'], ['pnpm-lock.yaml', 'pnpm']] as const) {
    const r = await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`, { method: 'HEAD', signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) }).catch(() => null);
    // The by-hand check first: npm install --package-lock-only fails on workspace: and catalog: dependencies (most pnpm and yarn monorepos).
    if (r?.ok) return `${owner}/${repo} uses ${tool} (${file}), and Patient Zero reads only npm's package-lock.json (v2 or v3) so far. To check it by hand, search ${file} at a commit from before the incident for the malicious versions${list ? `: ${list}` : ' (the timeline lists them)'}. Only for a plain npm project (no workspace: or catalog: dependencies): run npm install --package-lock-only in a checkout and drop the generated file here.`;
  }
  return `No package-lock.json at the root of ${owner}/${repo}. In a checkout, run npm install --package-lock-only (it writes the lockfile without installing anything) and drop the generated package-lock.json here.`;
}

// ---------- graphs ----------

type Entry = { graph: string; scenario: ScenarioId; repo: string; entries: number; used: number; sessions: Set<string>; source: LockSource; today?: Today };
const guests = new Map<string, Entry>(); // insertion order = LRU order: a touch re-inserts
const inflight = new Map<string, Promise<void>>();
let data: ReturnType<typeof load> | undefined;

async function drop(g: string) {
  guests.delete(g);
  await (await db()).selectGraph(g).delete().catch(() => {}); // already gone is fine
}
async function sweep() {
  for (const [g, e] of guests) if (Date.now() - e.used > TTL) await drop(g);
  while (guests.size > MAX_GRAPHS) await drop(guests.keys().next().value!);
}
setInterval(() => void sweep().catch(() => {}), 60_000).unref();

/** At boot: guest graphs from an earlier process are in no LRU, so the cap and TTL would never reach them. */
export async function dropOrphans(prefix = 'pz') {
  const fdb = await db();
  for (const g of await fdb.list()) if (g.startsWith(`${prefix}_guest_`) && !guests.has(g)) await drop(g);
}

// A live entry, moved to the LRU's fresh end.
function touch(name: string): Entry | undefined {
  const e = guests.get(name);
  if (!e || Date.now() - e.used > TTL) return undefined;
  guests.delete(name);
  guests.set(name, Object.assign(e, { used: Date.now() }));
  return e;
}
// A guest graph the caller's session analyzed, still live.
export const guest = (name: unknown, session: string): Entry | undefined =>
  typeof name === 'string' && guests.get(name)?.sessions.has(session) ? touch(name) : undefined;
export const busy = () => inflight.size >= 1; // S7: one ingest at a time on a 160 MB heap

const progress = (stage: Extract<AnalyzeEvent, { type: 'progress' }>['stage'], done: number): AnalyzeEvent => ({ type: 'progress', stage, done, total: 1 });

export async function* analyze(input: Input, scenario: ScenarioId, session: string, requestId: string, signal: AbortSignal, prefix = 'pz'): AsyncGenerator<AnalyzeEvent> {
  // Tests run under their own prefix; the hash part is the same either way.
  const name = guestGraph(input.key, scenario).replace(/^pz_/, `${prefix}_`);
  const pending = inflight.get(name);
  if (pending) await pending; // the same input is being built: wait for it, then reuse it
  let e = touch(name);
  if (e) {
    e.sessions.add(session);
    yield { type: 'ready', graph: name, repo: e.repo, entries: e.entries };
    return;
  }
  let release = () => {};
  inflight.set(name, new Promise((r) => (release = r)));
  let built = false;
  try {
    data ??= load();
    const inc = data.incidents.find((i) => i.id === scenario)!;
    const snapshotAt = Date.parse(data.org.scenarios[scenario]);
    let { parsed, repo } = input;
    let sha: string | null = null;
    let source: LockSource = input.source ?? { kind: 'pasted' };
    let today: Today | undefined;
    if (input.github) {
      yield progress('fetch', 0);
      ({ parsed, repo, sha, source, today } = await fetchLock(input.github, snapshotAt, signal, inc.versions.map((v) => v.id)));
      // what a fresh resolve of each affected package gets today: its clean releases in the committed npm cache
      const bad = new Set(inc.versions.map((v) => v.id));
      if (today) today.versions = Object.fromEntries([...new Set(inc.versions.map((v) => v.id.slice(0, v.id.lastIndexOf('@'))))]
        .map((n) => [n, Object.keys(data!.packuments[n]?.versions ?? {}).filter((v) => !bad.has(`${n}@${v}`))]));
      yield progress('fetch', 1);
    }
    yield progress('parse', 1);
    const repos: RepoIn[] = [{ id: repo, team: 'guest', synthetic: false, sha, ...parsed! }];

    yield progress('write', 0);
    const fdb = await db();
    if ((await fdb.list()).includes(name)) await fdb.selectGraph(name).delete(); // orphan from a restart
    // GRAPH.COPY forks; a fork that collides with another (a background save) fails once in a while: retry once
    const copy = () => fdb.selectGraph(registryGraph(prefix)).copy(name);
    await copy().catch(async (err: unknown) => {
      if (!/could not fork/i.test(String((err as Error)?.message))) throw err;
      await new Promise((r) => setTimeout(r, 300));
      return copy();
    });
    await writeRepos(name, GUEST_ORG, scenario, snapshotAt, repos);
    yield progress('write', 1);
    yield progress('enrich', 0);
    await writeMaintainers(name, repos, data.maintainers);
    yield progress('enrich', 1);
    yield progress('admits', 0);
    await writeAdmits(name, repos, badVersions(inc, data.packuments), Date.parse(inc.removedAt));
    yield progress('admits', 1);

    guests.set(name, (e = { graph: name, scenario, repo, entries: parsed!.deps.length, used: Date.now(), sessions: new Set([session]), source, today }));
    built = true;
    await sweep();
    yield { type: 'ready', graph: name, repo, entries: e.entries };
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(`[${requestId}]`, err); // S12: details stay in the log
    yield { type: 'error', message: err instanceof HttpError ? err.message : 'Analysis failed on our side.', requestId };
  } finally {
    if (!built) await drop(name); // a failed or abandoned ingest leaves no graph behind
    inflight.delete(name);
    release();
  }
}
