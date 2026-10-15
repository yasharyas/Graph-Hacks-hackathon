// Builds pz_registry from the committed data files, then one org graph per scenario as GRAPH.COPY of it plus
// Acme's lockfiles, ADMITS windows and PageRank. Idempotent: the graphs are deleted and rebuilt.
// CLI: node --env-file-if-exists=.env server/ingest/build.ts [prefix]   (prefix "pz" by default; tests use pz_test_*)
import { readFileSync } from 'node:fs';
import type { ScenarioId } from '../../shared/events.ts';
import { close, db, orgGraph, registryGraph, write } from '../graph/client.ts';
import { createSchema } from '../graph/schema.ts';
import { admitWindow } from './admits.ts';
import { parseLockfile } from './lockfile.ts';

type Incident = {
  id: ScenarioId; title: string; compromised: string | null; alertAt: string; removedAt: string; sources: string[];
  versions: { id: string; publishedAt: string; advisories: string[] }[]; pullsIn: [string, string][];
};
type Packuments = Record<string, { maintainers: string[]; versions: Record<string, { publishedAt: string; removed: boolean }> }>;
type Org = { id: string; name: string; teams: { id: string; name: string; channel: string }[]; repos: { id: string; team: string; synthetic: boolean }[]; scenarios: Record<ScenarioId, string> };

const ROOT = new URL('../../', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const split = (id: string) => [id.slice(0, id.lastIndexOf('@')), id.slice(id.lastIndexOf('@') + 1)];
const human = (u: unknown): u is string => typeof u === 'string' && u !== '' && !u.includes('@'); // S11: usernames only
const uniq = <T>(rows: T[], key: (r: T) => string) => [...new Map(rows.map((r) => [key(r), r])).values()];

async function batch(g: string, cypher: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += 400) await write(g, cypher, { rows: rows.slice(i, i + 400) });
}

function load() {
  const org = read('data/org/acme.json') as Org;
  return {
    org,
    incidents: (Object.keys(org.scenarios) as ScenarioId[]).map((s) => read(`data/incidents/${s}.json`) as Incident),
    manifest: read('data/cache/lockfiles/manifest.json') as Record<string, Record<string, { sha: string; file: string }>>,
    packuments: read('data/cache/npm/packuments.json') as Packuments,
    maintainers: read('data/cache/npm/maintainers.json') as Record<string, { maintainers: string[] }>,
    osv: read('data/cache/osv.json') as Record<string, { publishedAt: string; affected: string[] }>,
  };
}
type Data = ReturnType<typeof load>;

async function buildRegistry(g: string, { incidents, packuments, osv }: Data) {
  await createSchema(g);
  const bad = new Map(incidents.flatMap((inc) => inc.versions.map((v) => [v.id, inc] as const)));
  for (const id of bad.keys()) if (!packuments[split(id)[0]]?.versions[split(id)[1]]) throw new Error(`${id} is missing from its packument`);
  // A dropped dependency (axios -> plain-crypto-js) came from the attacker's own account, not the hijacked one.
  const dropped = new Set(incidents.flatMap((inc) => inc.pullsIn.map(([, to]) => to)));
  const hijacked = (inc: Incident) => inc.versions.filter((v) => !dropped.has(v.id));

  await batch(g, 'UNWIND $rows AS r CREATE (:Package {name: r})', Object.keys(packuments));
  const versions = Object.entries(packuments).flatMap(([name, p]) =>
    Object.entries(p.versions).map(([version, v]) => {
      const inc = bad.get(`${name}@${version}`);
      const id = `${name}@${version}`;
      return { id, name, version, publishedAt: Date.parse(v.publishedAt), removed: v.removed, malicious: !!inc, publisher: inc && !dropped.has(id) ? inc.compromised : null };
    }));
  await batch(g, `UNWIND $rows AS r MATCH (p:Package {name: r.name})
    CREATE (:Version {id: r.id, name: r.name, version: r.version, publishedAt: r.publishedAt, removed: r.removed, malicious: r.malicious, publisher: r.publisher})-[:OF]->(p)`, versions);

  // MAINTAINS: the packument's current maintainers, plus the compromised account for every package of its incident.
  const maintains = uniq([
    ...Object.entries(packuments).flatMap(([p, x]) => x.maintainers.filter(human).map((m) => ({ m, p }))),
    ...incidents.flatMap((inc) => (human(inc.compromised) ? hijacked(inc).map((v) => ({ m: inc.compromised!, p: split(v.id)[0] })) : [])),
  ], (r) => `${r.m} ${r.p}`);
  await batch(g, 'UNWIND $rows AS r CREATE (:Maintainer {name: r})', [...new Set(maintains.map((r) => r.m))]);
  await batch(g, 'UNWIND $rows AS r MATCH (m:Maintainer {name: r.m}), (p:Package {name: r.p}) CREATE (m)-[:MAINTAINS]->(p)', maintains);

  const advisoryAt = (inc: Incident) => Math.min(...inc.versions.flatMap((v) => v.advisories.map((a) => Date.parse(osv[a]?.publishedAt))).filter((t) => t >= 0));
  await batch(g, `UNWIND $rows AS r CREATE (i:Incident {id: r.id, title: r.title, firstPublishAt: r.firstPublishAt, alertAt: r.alertAt,
    advisoryAt: r.advisoryAt, removedAt: r.removedAt, sources: r.sources})
    WITH i, r UNWIND r.versions AS vid MATCH (v:Version {id: vid}) CREATE (i)-[:INVOLVES]->(v)`,
  incidents.map((inc) => ({
    id: inc.id, title: inc.title, alertAt: Date.parse(inc.alertAt), removedAt: Date.parse(inc.removedAt), sources: inc.sources, advisoryAt: advisoryAt(inc),
    firstPublishAt: Math.min(...inc.versions.map((v) => Date.parse(v.publishedAt))), versions: inc.versions.map((v) => v.id),
  })));
  await batch(g, `UNWIND $rows AS r MATCH (i:Incident {id: r.id}), (m:Maintainer {name: r.m}) CREATE (i)-[:COMPROMISED]->(m)
    WITH m, r UNWIND r.versions AS vid MATCH (v:Version {id: vid}) CREATE (v)-[:PUBLISHED_BY]->(m)`,
  incidents.filter((inc) => human(inc.compromised)).map((inc) => ({ id: inc.id, m: inc.compromised, versions: hijacked(inc).map((v) => v.id) })));
  await batch(g, `UNWIND $rows AS r CREATE (a:Advisory {id: r.id, publishedAt: r.publishedAt})
    WITH a, r UNWIND r.affected AS vid MATCH (v:Version {id: vid}) CREATE (a)-[:FLAGS]->(v)`,
  Object.entries(osv).map(([id, a]) => ({ id, publishedAt: Date.parse(a.publishedAt), affected: a.affected })));
  await batch(g, 'UNWIND $rows AS r MATCH (a:Version {id: r[0]}), (b:Version {id: r[1]}) CREATE (a)-[:PULLS_IN]->(b)', incidents.flatMap((inc) => inc.pullsIn));
}

async function buildOrg(registry: string, g: string, scenario: ScenarioId, { org, incidents, manifest, packuments, maintainers }: Data) {
  await (await db()).selectGraph(registry).copy(g);
  const snapshotAt = Date.parse(org.scenarios[scenario]);
  const inc = incidents.find((i) => i.id === scenario)!;
  const removedAt = Date.parse(inc.removedAt);
  const bad = inc.versions.map((v) => {
    const [name, version] = split(v.id);
    const all = Object.entries(packuments[name].versions).map(([version, x]) => ({ version, publishedAt: Date.parse(x.publishedAt) }));
    return { id: v.id, name, version, publishedAt: Date.parse(v.publishedAt), all };
  });

  // Real repos use the scenario's historical lockfile; a synthetic repo joins the scenario whose bad versions it locks.
  const repos = org.repos.flatMap((r) => {
    const m = manifest[scenario]?.[r.id];
    const file = r.synthetic ? `fixtures/synthetic/${r.id.split('/')[1]}.package-lock.json` : m && `data/cache/lockfiles/${m.file}`;
    if (!file) return [];
    const lock = parseLockfile(read(file));
    if (r.synthetic && !lock.deps.some((d) => bad.some((b) => b.name === d.name && b.version === d.version))) return [];
    return [{ ...r, sha: m?.sha ?? null, ...lock }];
  });

  await write(g, 'CREATE (:Org {id: $id, name: $name, scenario: $scenario, snapshotAt: $snapshotAt})', { id: org.id, name: org.name, scenario, snapshotAt });
  await batch(g, 'UNWIND $rows AS r CREATE (:Team {id: r.id, name: r.name, channel: r.channel})', org.teams);
  await batch(g, `UNWIND $rows AS r MATCH (o:Org), (t:Team {id: r.team})
    CREATE (o)<-[:IN_ORG]-(:Repo {id: r.id, sha: r.sha, snapshotAt: r.at, synthetic: r.synthetic, depCount: r.depCount})-[:OWNED_BY]->(t)`,
  repos.map((r) => ({ id: r.id, team: r.team, sha: r.sha, synthetic: r.synthetic, depCount: r.deps.length, at: snapshotAt })));

  const id = (repo: string, path: string) => `${repo}|${path}`;
  const deps = repos.flatMap((r) => r.deps.map((d) => ({ ...d, id: id(r.id, d.path), repo: r.id })));
  await batch(g, `UNWIND $rows AS r CREATE (:Dep {id: r.id, repo: r.repo, path: r.path, name: r.name, version: r.version, dev: r.dev, optional: r.optional, depth: r.depth})`, deps);
  await batch(g, "UNWIND $rows AS r MATCH (repo:Repo {id: r}), (d:Dep {id: r + '|'}) CREATE (repo)-[:ROOT]->(d)", repos.map((r) => r.id));
  await batch(g, 'UNWIND $rows AS r MATCH (a:Dep {id: r.from}), (b:Dep {id: r.to}) CREATE (a)-[:REQUIRES {range: r.range, kind: r.kind}]->(b)',
    repos.flatMap((r) => r.edges.map((e) => ({ from: id(r.id, e.from), to: id(r.id, e.to), range: e.range, kind: e.kind }))));

  // Every installed package (not the repo root) resolves to a Version of a Package.
  const installed = deps.filter((d) => d.path !== '' && d.version !== '');
  await batch(g, 'UNWIND $rows AS r MERGE (p:Package {name: r.name}) MERGE (v:Version {id: r.id}) ON CREATE SET v.name = r.name, v.version = r.version MERGE (v)-[:OF]->(p)',
    uniq(installed.map((d) => ({ id: `${d.name}@${d.version}`, name: d.name, version: d.version })), (r) => r.id));
  await batch(g, 'UNWIND $rows AS r MATCH (d:Dep {id: r.dep}), (v:Version {id: r.v}) CREATE (d)-[:RESOLVES_TO]->(v)',
    installed.map((d) => ({ dep: d.id, v: `${d.name}@${d.version}` })));
  await batch(g, 'UNWIND $rows AS r MATCH (p:Package {name: r.p}) MERGE (m:Maintainer {name: r.m}) MERGE (m)-[:MAINTAINS]->(p)',
    [...new Set(installed.map((d) => d.name))].flatMap((p) => (maintainers[p]?.maintainers ?? []).filter(human).map((m) => ({ m, p }))));

  // ADMITS: a declared range that resolved to a bad version while it was live (same loop as scripts/exposure-oracle.ts).
  const admits = repos.flatMap((r) => {
    const byPath = new Map(r.deps.map((d) => [d.path, d]));
    return r.edges.flatMap((e) => bad.flatMap((b) => {
      if (byPath.get(e.to)?.name !== b.name) return [];
      const w = admitWindow(e.range, b, b.all, removedAt);
      return w ? [{ from: id(r.id, e.from), v: b.id, range: e.range, fromT: w.fromT, toT: Math.min(w.toT, Number.MAX_SAFE_INTEGER) }] : [];
    }));
  });
  await batch(g, 'UNWIND $rows AS r MATCH (d:Dep {id: r.from}), (v:Version {id: r.v}) CREATE (d)-[:ADMITS {range: r.range, fromT: r.fromT, toT: r.toT}]->(v)',
    uniq(admits, (a) => `${a.from} ${a.v} ${a.range}`));

  await write(g, `MATCH (a:Dep)-[:RESOLVES_TO]->(:Version)-[:OF]->(pa:Package), (a)-[:REQUIRES]->(:Dep)-[:RESOLVES_TO]->(:Version)-[:OF]->(pb:Package)
    WITH DISTINCT pa, pb WHERE pa <> pb MERGE (pa)-[:PKG_DEPENDS]->(pb)`);
  await write(g, "CALL algo.pageRank('Package', 'PKG_DEPENDS') YIELD node, score SET node.pagerank = score");
}

async function stats(g: string) {
  const [n] = (await write(g, 'MATCH (n) RETURN count(n) AS c')).rows;
  const [e] = (await write(g, 'MATCH ()-[e]->() RETURN count(e) AS c')).rows;
  const mem = await (await db()).selectGraph(g).memoryUsage();
  return { nodes: n.c as number, edges: e.c as number, mb: Number(mem[mem.indexOf('total_graph_sz_mb') + 1]) };
}

export async function build(prefix = 'pz') {
  if (!/^pz[a-z0-9_]*$/.test(prefix)) throw new Error('Graph prefix must match ^pz[a-z0-9_]*$');
  const data = load();
  const registry = registryGraph(prefix);
  const targets = data.incidents.map((i) => ({ scenario: i.id, g: orgGraph(i.id, prefix) }));
  const existing = new Set(await (await db()).list());
  for (const g of [registry, ...targets.map((t) => t.g)]) if (existing.has(g)) await (await db()).selectGraph(g).delete();

  const out: Record<string, { ms: number; nodes: number; edges: number; mb: number }> = {};
  let t = performance.now();
  await buildRegistry(registry, data);
  out[registry] = { ms: Math.round(performance.now() - t), ...(await stats(registry)) };
  for (const { scenario, g } of targets) {
    t = performance.now();
    await buildOrg(registry, g, scenario, data);
    out[g] = { ms: Math.round(performance.now() - t), ...(await stats(g)) };
  }
  return out;
}

if (import.meta.main) {
  try {
    const out = await build(process.argv[2]);
    for (const [g, s] of Object.entries(out)) console.log(`${g.padEnd(22)} ${String(s.ms).padStart(6)} ms  ${s.nodes} nodes  ${s.edges} edges  ${s.mb} MB`);
  } finally {
    await close();
  }
}
