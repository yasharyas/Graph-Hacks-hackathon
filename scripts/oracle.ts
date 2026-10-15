// Compares parseLockfile edges with `npm ls --all --package-lock-only --json` (npm's own resolver).
// Usage: node scripts/oracle.ts fixtures/real/mocha-5f8e8a8   (expects <prefix>.package.json + <prefix>.package-lock.json)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseLockfile } from '../server/ingest/lockfile.ts';

type Node = { version?: string; missing?: boolean; dependencies?: Record<string, Node> };

export function oracle(prefix: string): { npm: number; ours: number; agree: number; ratio: number; onlyNpm: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'pz-oracle-'));
  try {
    copyFileSync(`${prefix}.package.json`, join(dir, 'package.json'));
    copyFileSync(`${prefix}.package-lock.json`, join(dir, 'package-lock.json'));
    let out: string;
    try {
      out = execFileSync('npm', ['ls', '--all', '--package-lock-only', '--json'], { cwd: dir, encoding: 'utf8', shell: true, maxBuffer: 1 << 28 });
    } catch (e: any) {
      out = e.stdout; // npm ls exits 1 on peer/extraneous warnings but still prints the tree
    }
    const npm = new Set<string>();
    const walk = (parent: string, n: Node) => {
      for (const [name, c] of Object.entries(n.dependencies ?? {})) {
        if (!c.version || c.missing) continue;
        const child = `${name}@${c.version}`;
        if (!npm.has(`${parent} -> ${child}`)) npm.add(`${parent} -> ${child}`), walk(child, c);
      }
    };
    const tree = JSON.parse(out) as Node & { name: string };
    walk('ROOT', tree);

    const r = parseLockfile(JSON.parse(readFileSync(`${prefix}.package-lock.json`, 'utf8')));
    const byPath = new Map(r.deps.map((d) => [d.path, d.path === '' ? 'ROOT' : `${d.name}@${d.version}`]));
    // npm ls names children by their install name; aliases differ, so compare on resolved name@version pairs.
    const ours = new Set(r.edges.map((e) => `${byPath.get(e.from)} -> ${byPath.get(e.to)}`));
    const onlyNpm = [...npm].filter((e) => !ours.has(e));
    const agree = npm.size - onlyNpm.length;
    return { npm: npm.size, ours: ours.size, agree, ratio: agree / npm.size, onlyNpm: onlyNpm.slice(0, 15) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  for (const p of process.argv.slice(2)) console.log(p, JSON.stringify(oracle(p), null, 1));
}
