// Regenerates the "Every Cypher query" section of README.md from server/tools/cypher.ts (single source of truth).
// Usage: node scripts/gen-readme-cypher.ts   (test/readme.test.ts fails if the README drifts from the code)
import { readFileSync, writeFileSync } from 'node:fs';

const START = '<!-- cypher:start -->';
const END = '<!-- cypher:end -->';

export function cypherSection(src = readFileSync('server/tools/cypher.ts', 'utf8')): string {
  const out: string[] = [];
  // Each query: the run of `//` comment lines directly above `export const NAME = \`...\`;`
  for (const m of src.matchAll(/((?:^\/\/ .*\n)+)export const (\w+) = `([\s\S]*?)`;/gm)) {
    const note = m[1].split('\n').filter(Boolean).map((l) => l.replace(/^\/\/ ?/, '')).join(' ');
    out.push(`#### \`${m[2]}\`\n\n${note}\n\n\`\`\`cypher\n${m[3]}\n\`\`\``);
  }
  return out.join('\n\n');
}

if (import.meta.main) {
  const readme = readFileSync('README.md', 'utf8');
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error(`README.md needs ${START} … ${END} markers`);
  writeFileSync('README.md', `${readme.slice(0, a + START.length)}\n\n${cypherSection()}\n\n${readme.slice(b)}`);
  console.log('README.md Cypher section regenerated');
}
