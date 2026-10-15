// npm package-lock.json (lockfileVersion 2/3) -> one Dep per `packages` key + the edges npm actually resolves.
// Resolution mirrors Node's lookup: from the depending entry's folder try <dir>/node_modules/<name>, then walk
// up one folder at a time until the root node_modules/<name>. `link: true` entries are followed to `resolved`.
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

export function parseLockfile(lock: unknown): { deps: Dep[]; edges: Edge[]; unresolved: number } {
  const l = lock as { name?: string; lockfileVersion?: unknown; packages?: Record<string, unknown> } | null;
  if ((l?.lockfileVersion !== 2 && l?.lockfileVersion !== 3) || typeof l.packages !== 'object' || !l.packages)
    throw new Error('Unsupported lockfile: expected an npm package-lock.json with lockfileVersion 2 or 3 (npm 7+)');
  const pkgs = new Map(Object.entries(l.packages).filter((kv): kv is [string, Entry] => !!kv[1] && typeof kv[1] === 'object'));
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
    const name = e.name ?? linked.get(path) ?? (path ? keyName(path) : l.name ?? '');
    deps.push({ path, name, version: e.version ?? '', dev: e.dev === true, optional: e.optional === true, depth: -1 });

    // Same order as npm's arborist: a later dep type overrides an earlier one for the same name.
    const want = new Map<string, { range: string; kind: Kind; optional: boolean }>();
    const add = (m: Deps | undefined, kind: Kind) => {
      for (const [n, range] of Object.entries(m ?? {}))
        want.set(n, { range: String(range), kind, optional: kind === 'optional' || (kind === 'peer' && !!e.peerDependenciesMeta?.[n]?.optional) });
    };
    add(e.peerDependencies, 'peer');
    add(e.dependencies, 'prod');
    add(e.optionalDependencies, 'optional');
    if (isTop(path)) add(e.devDependencies, 'dev');

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
