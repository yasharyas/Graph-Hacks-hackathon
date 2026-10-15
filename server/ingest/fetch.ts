// Data fetch for the committed graph inputs (contract: docs/contracts.md "Data files").
// Library + CLI:  node server/ingest/fetch.ts [lockfiles] [maintainers] [packuments] [incidents]   (no args = all)
// Every response is reduced (emails dropped, lockfiles minimized) and cached under .cache/http/, so reruns are free
// and an interrupted run resumes where it stopped. All traffic goes through safeFetch (outbound allowlist, no redirects).
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { parseRepo, safeFetch, safeJson } from '../security.ts';
import { parseLockfile } from './lockfile.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CACHE = join(ROOT, '.cache', 'http');
const DATA = join(ROOT, 'data');
const LOCKS = join(DATA, 'cache', 'lockfiles');
const NPM = join(DATA, 'cache', 'npm');
const SYNTHETIC = join(ROOT, 'fixtures', 'synthetic');
const REGISTRY = 'https://registry.npmjs.org';
const MAX_LOCK_BYTES = 6_000_000;

// ---------- http: cached, retrying, concurrency-limited ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (n: number) => 500 * 2 ** n * (0.5 + Math.random()); // exponential with jitter
export let githubRemaining: string | null = null; // last x-ratelimit-remaining seen from api.github.com

async function request(url: string, init: RequestInit): Promise<string | null> {
  const headers = new Headers(init.headers);
  headers.set('user-agent', 'patient-zero-ingest');
  const gh = new URL(url).hostname === 'api.github.com';
  if (gh && process.env.GH_TOKEN) headers.set('authorization', `Bearer ${process.env.GH_TOKEN}`);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await safeFetch(url, { ...init, headers });
    } catch (e) {
      if (attempt >= 4) throw e;
      await sleep(backoff(attempt));
      continue;
    }
    if (gh) githubRemaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 404) return null;
    if (res.ok) return res.text();
    if (res.headers.get('x-ratelimit-remaining') === '0')
      throw new Error(`GitHub rate limit exhausted (resets ${new Date(Number(res.headers.get('x-ratelimit-reset')) * 1000).toISOString()}); set GH_TOKEN or rerun later, the cache keeps progress`);
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 + Math.random() * 500 : backoff(attempt), 60_000));
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

// GET (or POST via init) -> reduce(body) -> cached as JSON. 404 is cached as null. `reduce` must keep no emails.
export async function getJson(url: string, reduce: (text: string) => unknown = (t) => safeJson(t, 50_000_000), init: RequestInit = {}): Promise<unknown> {
  const file = join(CACHE, createHash('sha1').update(url + String(init.body ?? '')).digest('hex') + '.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // cache miss (or torn write): fetch below
  }
  const text = await request(url, init);
  const value = text === null ? null : reduce(text);
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(value));
  return value;
}

export async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } }));
}

// ---------- small helpers ----------

type Json = Record<string, any>; // external JSON, validated where it matters
const readJson = async (p: string): Promise<any> => JSON.parse(await readFile(p, 'utf8'));
const sorted = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
async function writeJson(p: string, v: unknown, indent?: number) {
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(v, null, indent) + '\n');
}
const encodeName = (name: string) => name.replace('/', '%2F'); // @scope/name -> @scope%2Fname
const username = (m: unknown): string | null => (typeof m === 'string' ? m.replace(/\s*<.*$/, '') : (m as Json | null)?.name ?? null); // never keep an email
const usernames = (list: unknown) => (Array.isArray(list) ? list.map(username).filter((x): x is string => !!x) : []);

type Org = { repos: { id: string; team: string; synthetic: boolean }[]; scenarios: Record<string, string> };
type Manifest = Record<string, Record<string, { sha: string; committedAt: string; file: string; deps: number; unresolved: number }>>;

// ---------- 1. historical lockfiles ----------

const KEEP = ['name', 'version', 'dev', 'optional', 'link', 'dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'devDependencies'];

// Contract minimization: only what parseLockfile and the graph need (no integrity/resolved/engines/licenses).
function minimize(text: string): unknown {
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_LOCK_BYTES) return { skipped: bytes };
  const lock = safeJson(text, MAX_LOCK_BYTES) as Json;
  if ((lock.lockfileVersion !== 2 && lock.lockfileVersion !== 3) || !lock.packages) return { unsupported: lock.lockfileVersion ?? null };
  const packages: Json = {};
  for (const [k, e] of Object.entries<Json>(lock.packages)) {
    const m: Json = {};
    for (const f of KEEP) if (e[f] !== undefined) m[f] = e[f];
    if (e.link) m.resolved = e.resolved;
    if (k === '' && e.workspaces) m.workspaces = e.workspaces;
    packages[k] = m;
  }
  return { lockfileVersion: lock.lockfileVersion, name: lock.name, packages };
}

async function snapshot(repo: string, until: string) {
  const r = parseRepo(repo);
  if (!r) throw new Error(`bad repo id ${repo}`);
  const commits = (await getJson(
    `https://api.github.com/repos/${r.owner}/${r.repo}/commits?path=package-lock.json&until=${encodeURIComponent(until)}&per_page=1`,
    (t) => (safeJson(t, 5_000_000) as Json[]).map((c) => ({ sha: String(c.sha), committedAt: String(c.commit.committer.date) })),
  )) as { sha: string; committedAt: string }[] | null;
  const c = commits?.[0];
  if (!c) throw new Error(`no package-lock.json commit before ${until}`);
  if (!/^[0-9a-f]{40}$/.test(c.sha)) throw new Error(`unexpected sha ${c.sha}`);
  const lock = (await getJson(`https://raw.githubusercontent.com/${r.owner}/${r.repo}/${c.sha}/package-lock.json`, minimize)) as Json | null;
  if (!lock) throw new Error(`package-lock.json missing at ${c.sha}`);
  if (lock.skipped) throw new Error(`lockfile is ${lock.skipped} bytes (> 6 MB)`);
  if (lock.unsupported !== undefined) throw new Error(`lockfileVersion ${lock.unsupported} (need 2 or 3)`);
  const { deps, unresolved } = parseLockfile(lock);
  // npm itself only warns about missing peers/optionals; a handful is normal in real lockfiles. Recorded, not fatal.
  if (unresolved > 10) throw new Error(`${unresolved} unresolved deps`);
  return { ...c, lock, deps: deps.length, unresolved, file: `${r.owner}__${r.repo}__${c.sha.slice(0, 7)}.json` };
}

export async function fetchLockfiles(org: Org) {
  const repos = org.repos.filter((r) => !r.synthetic).map((r) => r.id);
  const scenarios = Object.entries(org.scenarios);
  const jobs = repos.flatMap((repo) => scenarios.map(([sid, until]) => ({ repo, sid, until })));
  const results = new Map<string, Awaited<ReturnType<typeof snapshot>> | Error>();
  await pool(jobs, 4, async ({ repo, sid, until }) => {
    results.set(`${sid}|${repo}`, await snapshot(repo, until).catch((e: Error) => e));
  });

  const manifest: Manifest = Object.fromEntries(scenarios.map(([sid]) => [sid, {}]));
  const failures: string[] = [];
  for (const repo of repos) {
    const rs = scenarios.map(([sid]) => [sid, results.get(`${sid}|${repo}`)!] as const);
    const bad = rs.filter(([, r]) => r instanceof Error);
    if (bad.length) { // a repo is kept only if both scenarios work, so a spare replaces it as a whole
      failures.push(`${repo}: ${bad.map(([sid, r]) => `${sid}: ${(r as Error).message}`).join('; ')}`);
      continue;
    }
    for (const [sid, r] of rs) {
      const s = r as Awaited<ReturnType<typeof snapshot>>;
      manifest[sid][repo] = { sha: s.sha, committedAt: s.committedAt, file: s.file, deps: s.deps, unresolved: s.unresolved };
      await mkdir(LOCKS, { recursive: true });
      await writeFile(join(LOCKS, s.file), JSON.stringify(s.lock));
    }
  }
  await writeJson(join(LOCKS, 'manifest.json'), manifest, 1);
  const used = new Set(Object.values(manifest).flatMap((s) => Object.values(s).map((e) => e.file)));
  for (const f of await readdir(LOCKS)) if (f !== 'manifest.json' && !used.has(f)) await rm(join(LOCKS, f)); // repos swapped out of acme.json
  return { manifest, failures };
}

// ---------- 2. npm maintainers (one version manifest per package name) ----------

const maxVersion = (vs: string[]) => vs.filter((v) => semver.valid(v)).sort(semver.rcompare)[0] ?? vs[0];

// Exported for guest ingest: maintainers + publisher of name@version, usernames only. 404 -> empty.
export async function fetchMaintainer(name: string, version: string) {
  const v = (await getJson(`${REGISTRY}/${encodeName(name)}/${encodeURIComponent(version)}`, (t) => {
    const m = safeJson(t, 5_000_000) as Json;
    return { maintainers: usernames(m.maintainers), publisher: username(m._npmUser) };
  })) as { maintainers: string[]; publisher: string | null } | null;
  let maintainers = v?.maintainers ?? [];
  if (!maintainers.length) // some version manifests carry no maintainers, and removed versions have no manifest: use the package's current ones
    maintainers = ((await getJson(`${REGISTRY}/${encodeName(name)}`, reducePackument)) as Packument | null)?.maintainers ?? [];
  return { version, maintainers, publisher: v?.publisher ?? null, found: v !== null };
}

export async function fetchMaintainers() {
  const manifest = (await readJson(join(LOCKS, 'manifest.json'))) as Manifest;
  const files = [
    ...new Set(Object.values(manifest).flatMap((s) => Object.values(s).map((e) => join(LOCKS, e.file)))),
    ...(await readdir(SYNTHETIC)).filter((f) => f.endsWith('.package-lock.json')).map((f) => join(SYNTHETIC, f)),
  ];
  // name -> locked versions, and whether it ever appears under node_modules/ (a registry package). Root and workspace
  // folders are the repo's own code: a private workspace called "docs" must not inherit the maintainers of npm's "docs".
  const seen = new Map<string, { versions: Set<string>; registry: boolean }>();
  for (const f of files) {
    for (const d of parseLockfile(await readJson(f)).deps) {
      if (!d.name || !d.version) continue;
      const s = seen.get(d.name) ?? { versions: new Set(), registry: false };
      s.versions.add(d.version);
      s.registry ||= d.path.includes('node_modules/');
      seen.set(d.name, s);
    }
  }
  const out: Record<string, { version: string; maintainers: string[]; publisher: string | null }> = {};
  const todo: [string, string][] = [];
  for (const [name, s] of seen) {
    const version = maxVersion([...s.versions]);
    if (s.registry) todo.push([name, version]);
    else out[name] = { version, maintainers: [], publisher: null };
  }
  let done = 0;
  let missing = 0;
  await pool(todo, 8, async ([name, version]) => {
    const { found, ...m } = await fetchMaintainer(name, version);
    if (!found) missing++;
    out[name] = m;
    if (++done % 500 === 0) console.error(`maintainers ${done}/${todo.length}`);
  });
  await writeJson(join(NPM, 'maintainers.json'), sorted(out));
  return { names: seen.size, fetched: todo.length, missing };
}

// ---------- 3. packuments ----------

const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/;
type Packument = { maintainers: string[]; versions: Record<string, { publishedAt: string; removed: boolean }> };

// Keep usernames and, per version, publish time from the `time` map; removed = in `time` but not in `versions`.
function reducePackument(text: string): Packument {
  const p = safeJson(text, 100_000_000) as Json;
  const versions: Packument['versions'] = {};
  for (const [v, t] of Object.entries(p.time ?? {}))
    if (v !== 'created' && v !== 'modified' && typeof t === 'string' && ISO.test(t)) versions[v] = { publishedAt: t, removed: !(p.versions && v in p.versions) };
  return { maintainers: usernames(p.maintainers), versions };
}

// qix's user list misses packages he reaches through orgs (chalk, ansi-styles, ...), so every incident package is added explicitly.
export async function fetchPackuments(extra = [...new Set(INCIDENTS.flatMap((i) => i.versions.map((p) => splitPair(p).name)))]) {
  const owned = Object.keys((await getJson(`${REGISTRY}/-/user/qix/package`)) as Json);
  const names = [...new Set([...owned, ...extra])].sort();
  const out: Record<string, Packument> = {};
  const missing: string[] = [];
  await pool(names, 4, async (name) => {
    const p = (await getJson(`${REGISTRY}/${encodeName(name)}`, reducePackument)) as Packument | null;
    if (p) out[name] = p;
    else missing.push(name);
  });
  await writeJson(join(NPM, 'packuments.json'), sorted(out));
  return { qix: owned.length, packuments: Object.keys(out).length, missing };
}

// ---------- 4. OSV + incidents ----------

type Pair = `${string}@${string}`;
const splitPair = (p: string) => ({ name: p.slice(0, p.lastIndexOf('@')), version: p.slice(p.lastIndexOf('@') + 1) });

export async function fetchOsv(pairs: Pair[]) {
  const body = JSON.stringify({ queries: pairs.map((p) => ({ package: { name: splitPair(p).name, ecosystem: 'npm' }, version: splitPair(p).version })) });
  const res = (await getJson('https://api.osv.dev/v1/querybatch', undefined, { method: 'POST', body, headers: { 'content-type': 'application/json' } })) as { results: { vulns?: { id: string }[] }[] };
  if (res?.results?.length !== pairs.length) throw new Error('OSV querybatch returned an unexpected shape');
  const advisories = new Map<string, Pair[]>(); // id -> the queried name@version it flags
  res.results.forEach((r, i) => { for (const v of r.vulns ?? []) advisories.set(v.id, [...(advisories.get(v.id) ?? []), pairs[i]]); });
  const osv: Record<string, { publishedAt: string; affected: string[] }> = {};
  for (const [id, affected] of advisories) {
    if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(`odd OSV id ${id}`);
    const v = (await getJson(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`)) as Json | null;
    if (!v?.published) throw new Error(`OSV ${id} has no published time`);
    // Keep malware advisories only: MAL-* and GitHub's copies that alias one. Axios has ~45 unrelated CVE/GHSA records that also list these versions.
    if (!id.startsWith('MAL-') && !(v.aliases ?? []).some((a: string) => a.startsWith('MAL-'))) continue;
    osv[id] = { publishedAt: v.published, affected: affected.sort() };
  }
  return osv;
}

// Facts below are hand-verified against the cited sources; publishedAt and advisories are computed.
const QIX_PKGS = 'ansi-styles@6.2.2 debug@4.4.2 chalk@5.6.1 supports-color@10.2.1 strip-ansi@7.1.1 ansi-regex@6.2.1 wrap-ansi@9.0.1 color-convert@3.1.1 color-name@2.0.1 is-arrayish@0.3.3 color@5.0.1 slice-ansi@7.1.1 error-ex@1.3.3 color-string@2.1.1 simple-swizzle@0.2.3 supports-hyperlinks@4.1.1 has-ansi@6.0.1 chalk-template@1.1.1 backslash@0.2.1'.split(' ') as Pair[];
const INCIDENTS = [
  {
    id: 'qix-2025-09-08',
    title: 'qix npm account takeover: 19 malicious versions of chalk, debug, ansi-styles and 16 other packages',
    compromised: 'qix',
    alertAt: '2025-09-08T13:16:00Z', // Aikido intel feed first alert
    removedAt: '2025-09-08T15:15:00Z',
    removedAtNote: 'approximate; the maintainer acknowledged the compromise and began removing versions at 15:15 UTC (https://www.aikido.dev/blog/npm-debug-and-chalk-packages-compromised); Wiz gives the exposure window as 13:16 to ~15:15 UTC (https://www.wiz.io/blog/widespread-npm-supply-chain-attack-breaking-down-impact-scope-across-debug-chalk)',
    versions: QIX_PKGS,
    pullsIn: [] as [Pair, Pair][],
    sources: [
      'https://www.aikido.dev/blog/npm-debug-and-chalk-packages-compromised',
      'https://www.wiz.io/blog/widespread-npm-supply-chain-attack-breaking-down-impact-scope-across-debug-chalk',
      'https://osv.dev/vulnerability/MAL-2025-46974',
    ],
  },
  {
    id: 'axios-2026-03-31',
    title: 'axios npm account takeover: 1.14.1 and 0.30.4 depend on the plain-crypto-js@4.2.1 RAT dropper',
    compromised: 'jasonsaayman', // named by StepSecurity, Datadog Security Labs, Endor Labs, SafeDep and Tenable
    alertAt: '2026-03-31T02:19:00Z', // first public report of the axios compromise (StepSecurity, axios/axios#10597, per Datadog)
    removedAt: '2026-03-31T03:15:00Z',
    removedAtNote: 'approximate; npm unpublished both axios versions at ~03:15 UTC, inferred from the registry modified field 03:15:30Z (https://www.stepsecurity.io/blog/axios-compromised-on-npm-malicious-versions-drop-remote-access-trojan); other reports say 03:00 to 03:40',
    versions: ['axios@1.14.1', 'axios@0.30.4', 'plain-crypto-js@4.2.1'] as Pair[],
    pullsIn: [['axios@1.14.1', 'plain-crypto-js@4.2.1'], ['axios@0.30.4', 'plain-crypto-js@4.2.1']] as [Pair, Pair][], // both declare "plain-crypto-js": "^4.2.1"
    sources: [
      'https://www.stepsecurity.io/blog/axios-compromised-on-npm-malicious-versions-drop-remote-access-trojan',
      'https://securitylabs.datadoghq.com/articles/axios-npm-supply-chain-compromise',
      'https://www.endorlabs.com/learn/npm-axios-compromise',
      'https://tenable.com/blog/faq-about-the-axios-npm-supply-chain-attack-by-north-korea-nexus-threat-actor-unc1069',
    ],
  },
];

export async function fetchIncidents() {
  const packuments = (await readJson(join(NPM, 'packuments.json'))) as Record<string, Packument>;
  const pairs = INCIDENTS.flatMap((i) => i.versions);
  const missing = pairs.filter((p) => { const { name, version } = splitPair(p); return !packuments[name]?.versions[version]?.publishedAt; });
  if (missing.length) throw new Error(`malicious versions missing from packument time maps: ${missing.join(', ')}`);

  const osv = await fetchOsv(pairs);
  await writeJson(join(DATA, 'cache', 'osv.json'), sorted(osv), 1);
  for (const inc of INCIDENTS) {
    const versions = inc.versions.map((id) => {
      const { name, version } = splitPair(id);
      return { id, publishedAt: packuments[name].versions[version].publishedAt, advisories: Object.keys(osv).filter((a) => osv[a].affected.includes(id)).sort() };
    });
    await writeJson(join(DATA, 'incidents', `${inc.id}.json`), { ...inc, versions }, 1);
  }
  return { advisories: Object.keys(osv).length, missing };
}

// ---------- CLI ----------

async function main(steps: string[]) {
  const run = (step: string) => steps.length === 0 || steps.includes(step);
  if (run('lockfiles')) {
    const { manifest, failures } = await fetchLockfiles((await readJson(join(DATA, 'org', 'acme.json'))) as Org);
    console.error(`lockfiles: ${Object.values(manifest).map((s) => Object.keys(s).length).join(' + ')} repos per scenario; GitHub requests remaining ${githubRemaining}`);
    if (failures.length) { // swap these repos for spares in data/org/acme.json, then rerun (the cache makes it cheap)
      for (const f of failures) console.error(`FAILED ${f}`);
      return 1;
    }
  }
  if (run('maintainers')) console.error('maintainers:', await fetchMaintainers());
  if (run('packuments')) console.error('packuments:', await fetchPackuments());
  if (run('incidents')) console.error('incidents:', await fetchIncidents());
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
