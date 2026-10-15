// Graph-free exposure oracle: lockfiles + admitWindow, no FalkorDB. Used to cross-check the graph queries
// (differential test) and to source proof points. Usage: node scripts/exposure-oracle.ts [scenarioId] [atISO]
import { readFileSync } from 'node:fs';
import { parseLockfile } from '../server/ingest/lockfile.ts';
import { admitWindow } from '../server/ingest/admits.ts';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
type Incident = { id: string; removedAt: string; versions: { id: string; publishedAt: string }[] };
const split = (id: string) => { const i = id.lastIndexOf('@'); return { name: id.slice(0, i), version: id.slice(i + 1) }; };

export function exposures(scenario: string, at?: number) {
  const manifest = read('data/cache/lockfiles/manifest.json')[scenario] as Record<string, { file: string }>;
  const inc = read(`data/incidents/${scenario}.json`) as Incident;
  const packuments = read('data/cache/npm/packuments.json') as Record<string, { versions: Record<string, { publishedAt: string }> }>;
  const removedAt = Date.parse(inc.removedAt);
  const bad = inc.versions.map((v) => ({ ...split(v.id), id: v.id, publishedAt: Date.parse(v.publishedAt) }));
  const out: { repo: string; tier: 'LOCKED' | 'WOULD_PULL'; version: string; via: string; range: string; dev: boolean; fromT: number; toT: number }[] = [];
  for (const [repo, { file }] of Object.entries(manifest)) {
    const { deps, edges } = parseLockfile(read(`data/cache/lockfiles/${file}`));
    const byPath = new Map(deps.map((d) => [d.path, d]));
    for (const e of edges) {
      const target = byPath.get(e.to)!;
      for (const b of bad) {
        if (target.name !== b.name) continue;
        if (target.version === b.version) out.push({ repo, tier: 'LOCKED', version: b.id, via: e.from || '(root)', range: e.range, dev: target.dev, fromT: b.publishedAt, toT: removedAt });
        const versions = Object.entries(packuments[b.name]?.versions ?? {}).map(([version, v]) => ({ version, publishedAt: Date.parse(v.publishedAt) }));
        const w = admitWindow(e.range, b, versions, removedAt);
        if (w && (at === undefined || (w.fromT <= at && at < w.toT)))
          out.push({ repo, tier: 'WOULD_PULL', version: b.id, via: e.from || '(root)', range: e.range, dev: target.dev, ...w });
      }
    }
  }
  return out;
}

if (import.meta.main) {
  const [scenario = 'qix-2025-09-08', atIso] = process.argv.slice(2);
  const rows = exposures(scenario, atIso ? Date.parse(atIso) : undefined);
  const byRepo = Map.groupBy(rows, (r) => r.repo);
  console.log(`${scenario}${atIso ? ` @ ${atIso}` : ''}: ${byRepo.size} repos exposed`);
  for (const [repo, rs] of byRepo) {
    const vs = [...new Set(rs.map((r) => r.version))];
    const direct = rs.filter((r) => r.via === '(root)').map((r) => `${r.version.split('@')[0]} ${r.range}`);
    console.log(`  ${repo.padEnd(26)} ${vs.length} bad versions; prod=${rs.some((r) => !r.dev)}; direct: ${[...new Set(direct)].join(', ') || '-'}`);
  }
}
