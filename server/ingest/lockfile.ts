// npm package-lock.json (lockfileVersion 2/3) -> one Dep per `packages` key + the edges npm actually resolves.
// Resolution mirrors Node's lookup: from the depending entry's folder try <dir>/node_modules/<name>, then walk
// up one folder at a time until the root node_modules/<name>. `link: true` entries are followed to `resolved`.
import semver from 'semver';

type Deps = Record<string, string>;
type Entry = {
  name?: string; version?: string; dev?: boolean; optional?: boolean; link?: boolean; resolved?: string; workspaces?: unknown;
  dependencies?: Deps; optionalDependencies?: Deps; peerDependencies?: Deps; devDependencies?: Deps;
  peerDependenciesMeta?: Record<string, { optional?: boolean } | undefined>;
};
export type Kind = 'prod' | 'dev' | 'optional' | 'peer' | 'workspace';
export type Dep = { path: string; name: string; version: string; dev: boolean; optional: boolean; depth: number };
export type Edge = { from: string; to: string; range: string; kind: Kind };

const NM = 'node_modules/';
// Index of the last "node_modules/" segment in key k, or -1.
const lastNM = (k: string) => ('/' + k).lastIndexOf('/' + NM);
// Root and local folders (workspaces, `file:` deps) live outside node_modules/ and install their devDependencies.
const isTop = (k: string) => lastNM(k) < 0;
// "a/node_modules/@s/x" -> "a", "node_modules/x" -> "", plain folder "packages/a" -> "packages".
const parent = (k: string) => {
  const i = lastNM(k);
  return k.slice(0, Math.max(0, i >= 0 ? i - 1 : k.lastIndexOf('/')));
};
// "a/node_modules/@s/x" -> "@s/x", plain folder "packages/a" -> "a".
const keyName = (k: string) => {
  const i = lastNM(k);
  return k.slice(i >= 0 ? i + NM.length : k.lastIndexOf('/') + 1);
};

export const LIMITS = { entries: 6000, segments: 40, depsPerEntry: 1000, edges: 50_000, range: 128 };

// A pasted repo's lockfile is attacker text, and names, versions and ranges are quoted in verdicts, fix steps and exports
// (S1/S4): names keep npm's name characters, versions semver's, and a range keeps only its semver tokens (loose semver
// would accept "^5.6.0 <any prose>"), with no control, format or bidi characters. Every input is cut to a few times its
// cap BEFORE any regex or semver call (S7: an uncapped 5 MB range made a backtracking regex take hours), and every regex
// here is linear.
const safeName = (s: string) => s.slice(0, 214).replace(/[^A-Za-z0-9@/._~*-]/g, '');
const safeVersion = (s: string) => semver.valid(s.slice(0, 64), { loose: true }) ?? ''; // not a version: nothing to match or quote
const PROTOCOL = /^(file|link|workspace|portal|git(\+[a-z]+)?|https?|github|gitlab|bitbucket):/i; // not a semver range at all
export const safeRange = (s: string) => {
  const spec = s.slice(0, 4 * LIMITS.range).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/^\s*npm:@?[^@\s]+@/, '').trim();
  if (PROTOCOL.test(spec)) return spec.replace(/[^A-Za-z0-9._~:/?#@!$&+,;=%*-]/g, '').slice(0, LIMITS.range); // a path or URL: one token
  return spec.replace(/(?<=[<>=~^])\s+/g, '').split(/\s+/)
    .filter((t) => t === '||' || t === '-' || t === 'latest' || (t.length <= 64 && semver.validRange(t, { loose: true }) !== null))
    .join(' ').slice(0, LIMITS.range);
};

export function parseLockfile(lock: unknown): { deps: Dep[]; edges: Edge[]; unresolved: number } {
  const l = lock as { name?: string; lockfileVersion?: unknown; packages?: Record<string, unknown> } | null;
  if ((l?.lockfileVersion !== 2 && l?.lockfileVersion !== 3) || typeof l.packages !== 'object' || !l.packages)
    throw new Error('Unsupported lockfile: expected an npm package-lock.json with lockfileVersion 2 or 3 (npm 7+)');
  const pkgs = new Map(Object.entries(l.packages).filter((kv): kv is [string, Entry] => !!kv[1] && typeof kv[1] === 'object'));
  // S7: hostile lockfiles (huge key depth x many deps) can make resolution quadratic; real ones sit far below these.
  if (pkgs.size > LIMITS.entries) throw new Error(`Lockfile too large: ${pkgs.size} entries (max ${LIMITS.entries})`);
  for (const k of pkgs.keys()) if (k.split('/').length > LIMITS.segments) throw new Error('Lockfile too large: path nested too deep');
  // Only a root that declares `workspaces` has them; a `file:` dep is also outside node_modules but is not one.
  const isWorkspace = (k: string) => !!pkgs.get('')?.workspaces && k !== '' && isTop(k);
  // npm omits `name` on workspace entries; the node_modules link pointing at the folder carries it.
  const linked = new Map<string, string>();
  for (const [k, e] of pkgs) if (e.link && e.resolved) linked.set(e.resolved, keyName(k));

  const resolve = (from: string, name: string): string | undefined => {
    for (let base = from; ; base = parent(base)) {
      const k = base ? `${base}/${NM}${name}` : NM + name;
      const e = pkgs.get(k);
      if (e?.link) return e.resolved && pkgs.has(e.resolved) ? e.resolved : undefined;
      if (e) return k;
      if (!base) return undefined;
    }
  };

  const deps: Dep[] = [];
  const edges: Edge[] = [];
  let unresolved = 0;
  for (const [path, e] of pkgs) {
    if (e.link) continue; // a symlink, not a package: resolve() follows it to the target
    // String() so a hostile object in `name`/`version` can never reach a query as a map (S3).
    const name = safeName(String(e.name ?? linked.get(path) ?? (path ? keyName(path) : l.name ?? '')));
    deps.push({ path, name, version: safeVersion(String(e.version ?? '')), dev: e.dev === true, optional: e.optional === true, depth: -1 });

    // Same order as npm's arborist: a later dep type overrides an earlier one for the same name.
    const want = new Map<string, { range: string; kind: Kind; optional: boolean }>();
    const add = (m: Deps | undefined, kind: Kind) => {
      for (const [n, range] of Object.entries(m ?? {}))
        want.set(n, { range: safeRange(String(range)), kind, optional: kind === 'optional' || (kind === 'peer' && !!e.peerDependenciesMeta?.[n]?.optional) });
    };
    add(e.peerDependencies, 'peer');
    add(e.dependencies, 'prod');
    add(e.optionalDependencies, 'optional');
    if (isTop(path)) add(e.devDependencies, 'dev');

    if (want.size > LIMITS.depsPerEntry) throw new Error(`Lockfile too large: ${want.size} dependencies on one entry`);
    if (edges.length + want.size > LIMITS.edges) throw new Error(`Lockfile too large: over ${LIMITS.edges} edges`);
    for (const [n, { range, kind, optional }] of want) {
      const to = resolve(path, n);
      if (to !== undefined) edges.push({ from: path, to, range: range.replace(/^npm:@?[^@]+@/, ''), kind });
      else if (!optional) unresolved++;
    }
    if (isWorkspace(path)) edges.push({ from: '', to: path, range: '*', kind: 'workspace' });
  }

  // Depth = shortest hop count from the root; -1 if unreachable.
  const out = Map.groupBy(edges, (x) => x.from);
  const depth = new Map([['', 0]]);
  const queue = [''];
  for (let i = 0; i < queue.length; i++)
    for (const { to } of out.get(queue[i]) ?? []) if (!depth.has(to)) depth.set(to, depth.get(queue[i])! + 1), queue.push(to);
  for (const d of deps) d.depth = depth.get(d.path) ?? -1;

  return { deps, edges, unresolved };
}
