// Acceptance tests for server/ingest/lockfile.ts (arena rubric). Contract:
//   parseLockfile(lock: unknown): {
//     deps:  { path, name, version, dev, optional, depth }[]   // one per `packages` key; root has path "" and depth 0
//     edges: { from, to, range, kind }[]                       // lockfile keys; kind: prod | dev | optional | peer | workspace
//     unresolved: number                                       // required deps that resolve to nothing
//   }
// Throws an Error whose message starts with "Unsupported lockfile" for v1 / non-npm input.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseLockfile } from '../server/ingest/lockfile.ts';

const lock = (packages: Record<string, unknown>) => ({ name: 'root', lockfileVersion: 3, requires: true, packages });
const edgeSet = (r: ReturnType<typeof parseLockfile>) => new Set(r.edges.map((e) => `${e.from} -> ${e.to} ${e.range} ${e.kind}`));
const dep = (r: ReturnType<typeof parseLockfile>, path: string) => r.deps.find((d) => d.path === path);

test('nested node_modules resolve to the nearest ancestor', () => {
  const r = parseLockfile(lock({
    '': { name: 'root', dependencies: { a: '^1', b: '^1' } },
    'node_modules/a': { version: '1.0.0', dependencies: { c: '^1' } },
    'node_modules/b': { version: '1.0.0', dependencies: { c: '^2' } },
    'node_modules/c': { version: '1.0.0' },
    'node_modules/b/node_modules/c': { version: '2.0.0' },
  }));
  assert.deepEqual(edgeSet(r), new Set([
    ' -> node_modules/a ^1 prod',
    ' -> node_modules/b ^1 prod',
    'node_modules/a -> node_modules/c ^1 prod',
    'node_modules/b -> node_modules/b/node_modules/c ^2 prod',
  ]));
  assert.equal(r.unresolved, 0);
  assert.equal(dep(r, '')?.depth, 0);
  assert.equal(dep(r, 'node_modules/c')?.depth, 2);
  assert.equal(dep(r, 'node_modules/b/node_modules/c')?.name, 'c');
  assert.equal(dep(r, 'node_modules/b/node_modules/c')?.version, '2.0.0');
});

test('scoped packages: nested scoped parent and hoisted fallback', () => {
  const r = parseLockfile(lock({
    '': { dependencies: { '@s/x': '^1', y: '^1' } },
    'node_modules/@s/x': { version: '1.0.0', dependencies: { y: '^2', '@s/z': '^1' } },
    'node_modules/@s/x/node_modules/y': { version: '2.0.0' },
    'node_modules/@s/z': { version: '1.0.0' },
    'node_modules/y': { version: '1.0.0' },
  }));
  const s = edgeSet(r);
  assert.ok(s.has('node_modules/@s/x -> node_modules/@s/x/node_modules/y ^2 prod'));
  assert.ok(s.has('node_modules/@s/x -> node_modules/@s/z ^1 prod'));
  assert.ok(s.has(' -> node_modules/y ^1 prod'));
  assert.equal(dep(r, 'node_modules/@s/x')?.name, '@s/x');
  assert.equal(r.unresolved, 0);
});

test('npm aliases use the real package name and strip npm: from the range', () => {
  const r = parseLockfile(lock({
    '': { dependencies: { 'strip-ansi-cjs': 'npm:strip-ansi@^6.0.1' } },
    'node_modules/strip-ansi-cjs': { name: 'strip-ansi', version: '6.0.1' },
  }));
  assert.equal(dep(r, 'node_modules/strip-ansi-cjs')?.name, 'strip-ansi');
  assert.ok(edgeSet(r).has(' -> node_modules/strip-ansi-cjs ^6.0.1 prod'));
});

test('workspaces: root links each workspace; workspace deps walk up through plain folders', () => {
  const r = parseLockfile(lock({
    '': { workspaces: ['packages/*'], devDependencies: { d: '^1' } },
    'packages/a': { name: 'ws-a', version: '1.0.0', dependencies: { c: '^1', 'ws-b': '*' }, devDependencies: { e: '^1' } },
    'packages/b': { name: 'ws-b', version: '1.0.0' },
    'node_modules/ws-a': { resolved: 'packages/a', link: true },
    'node_modules/ws-b': { resolved: 'packages/b', link: true },
    'node_modules/c': { version: '1.0.0' },
    'packages/a/node_modules/e': { version: '1.0.0', dev: true },
    'node_modules/d': { version: '1.0.0', dev: true },
  }));
  const s = edgeSet(r);
  assert.ok(s.has(' -> packages/a * workspace'));
  assert.ok(s.has(' -> packages/b * workspace'));
  assert.ok(s.has('packages/a -> node_modules/c ^1 prod'));
  assert.ok(s.has('packages/a -> packages/b * prod'), 'link entries are followed to their target');
  assert.ok(s.has('packages/a -> packages/a/node_modules/e ^1 dev'));
  assert.ok(s.has(' -> node_modules/d ^1 dev'));
  assert.equal(dep(r, 'packages/a')?.name, 'ws-a');
  assert.equal(dep(r, 'node_modules/ws-a'), undefined, 'link entries are not deps themselves');
  assert.equal(dep(r, 'node_modules/d')?.dev, true);
  assert.equal(r.unresolved, 0);
});

test('missing optional and optional peers are skipped; missing required counts as unresolved', () => {
  const r = parseLockfile(lock({
    '': { dependencies: { a: '^1', gone: '^1' }, optionalDependencies: { fsevents: '^2' } },
    'node_modules/a': { version: '1.0.0', peerDependencies: { react: '^18', vue: '^3' }, peerDependenciesMeta: { vue: { optional: true } } },
    'node_modules/react': { version: '18.3.1', peer: true },
  }));
  const s = edgeSet(r);
  assert.ok(s.has('node_modules/a -> node_modules/react ^18 peer'));
  assert.ok(![...s].some((e) => e.includes('fsevents') || e.includes('vue')));
  assert.equal(r.unresolved, 1); // "gone"
});

test('optional deps that exist get kind optional', () => {
  const r = parseLockfile(lock({
    '': { optionalDependencies: { fsevents: '^2' } },
    'node_modules/fsevents': { version: '2.3.3', optional: true },
  }));
  assert.ok(edgeSet(r).has(' -> node_modules/fsevents ^2 optional'));
  assert.equal(dep(r, 'node_modules/fsevents')?.optional, true);
});

test('hostile and malformed entries: no crash, no phantom edges, no prototype lookups', () => {
  const r = parseLockfile(lock({
    '': { dependencies: { a: 1, constructor: '^1', dup: '^1' }, optionalDependencies: { dup: '^1', fsevents: '^2' } },
    'node_modules/x': null,
    'node_modules/a': { version: '1.0.0' },
    'node_modules/dup': { version: '1.0.0' },
    'node_modules/evil': { link: true, resolved: 'constructor' },
  } as Record<string, unknown>));
  const s = edgeSet(r);
  assert.ok(s.has(' -> node_modules/a 1 prod'), 'non-string specs are stringified');
  assert.equal([...s].filter((e) => e.includes('node_modules/dup')).length, 1, 'one edge per name');
  assert.ok(s.has(' -> node_modules/dup ^1 optional'), 'optional wins over prod, as in arborist');
  assert.ok(![...s].some((e) => e.endsWith('constructor prod') || e.includes('-> constructor')));
  assert.equal(r.unresolved, 1, '"constructor" is a missing required dep, not Object.prototype');
});

test('a file: dependency outside node_modules is not a workspace when the root declares none', () => {
  const r = parseLockfile(lock({
    '': { devDependencies: { fixture: 'file:test/fixture' } },
    'node_modules/fixture': { resolved: 'test/fixture', link: true },
    'test/fixture': { name: 'fixture', version: '1.0.0' },
  }));
  const s = edgeSet(r);
  assert.ok(s.has(' -> test/fixture file:test/fixture dev'));
  assert.ok(![...s].some((e) => e.endsWith('workspace')));
});

test('v1 lockfiles and non-npm input are rejected with a friendly message', () => {
  assert.throws(() => parseLockfile({ lockfileVersion: 1, dependencies: {} }), /^Error: Unsupported lockfile/);
  assert.throws(() => parseLockfile('# yarn lockfile v1'), /^Error: Unsupported lockfile/);
  assert.throws(() => parseLockfile(null), /^Error: Unsupported lockfile/);
});

// Real lockfiles (committed under fixtures/real/ by the build step). Skipped until present.
for (const f of ['mocha-5f8e8a8', 'npm-cli-3b30e0b']) {
  const p = `fixtures/real/${f}.package-lock.json`;
  test(`real lockfile ${f}: every required dep resolves`, { skip: !existsSync(p) }, () => {
    const r = parseLockfile(JSON.parse(readFileSync(p, 'utf8')));
    assert.equal(r.unresolved, 0);
    assert.ok(r.deps.length > 50);
    const reachable = new Set(['']);
    for (let grew = true; grew; ) {
      grew = false;
      for (const e of r.edges) if (reachable.has(e.from) && !reachable.has(e.to)) reachable.add(e.to), (grew = true);
    }
    assert.ok(reachable.size / r.deps.length >= 0.99, `reachable ${reachable.size}/${r.deps.length}`);
  });
}
