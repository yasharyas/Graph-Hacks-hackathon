// The rules require the README to carry every Cypher query the product depends on: it must match the code verbatim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Q from '../server/tools/cypher.ts';

test('README contains every query exported by cypher.ts, verbatim', () => {
  const readme = readFileSync('README.md', 'utf8');
  for (const [name, cypher] of Object.entries(Q)) {
    assert.ok(readme.includes(cypher as string), `${name} is missing or stale in README.md (run: node scripts/gen-readme-cypher.ts)`);
  }
});
