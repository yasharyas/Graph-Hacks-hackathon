// Checks on the committed data files written by server/ingest/fetch.ts (contract: docs/contracts.md "Data files").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = fileURLToPath(new URL('../data/', import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(DATA, p), 'utf8'));
const org = read('org/acme.json');
const manifest = read('cache/lockfiles/manifest.json');
const packuments = read('cache/npm/packuments.json');
const incidents = ['qix-2025-09-08', 'axios-2026-03-31'].map((id) => read(`incidents/${id}.json`));

test('manifest has both scenarios for every non-synthetic repo', () => {
  assert.deepEqual(Object.keys(manifest).sort(), Object.keys(org.scenarios).sort());
  for (const repo of org.repos.filter((r: { synthetic: boolean }) => !r.synthetic))
    for (const sid of Object.keys(org.scenarios)) {
      const e = manifest[sid][repo.id];
      assert.ok(e, `${repo.id} missing in ${sid}`);
      assert.match(e.sha, /^[0-9a-f]{40}$/);
      assert.ok(e.file.includes(e.sha.slice(0, 7)) && existsSync(join(DATA, 'cache/lockfiles', e.file)), `${repo.id} lockfile file`);
      assert.ok(e.deps > 0);
    }
});

test('every incident version is in the packuments with the publishedAt written in the incident', () => {
  for (const inc of incidents) {
    assert.ok(inc.versions.length > 0);
    for (const v of inc.versions) {
      const at = v.id.lastIndexOf('@');
      const p = packuments[v.id.slice(0, at)]?.versions[v.id.slice(at + 1)];
      assert.ok(p?.publishedAt, `${v.id} missing from packuments`);
      assert.equal(v.publishedAt, p.publishedAt);
    }
  }
  assert.equal(incidents[0].versions.length, 19);
});

test('debug@4.4.2 was published 2025-09-08T13:12:39Z', () => {
  const t = new Date(packuments.debug.versions['4.4.2'].publishedAt);
  assert.equal(t.toISOString().slice(0, 19) + 'Z', '2025-09-08T13:12:39Z');
});

test('no email addresses anywhere under data/', () => {
  const email = /[\w.+-]+@(?!\d)[\w-]+(\.[\w-]+)*\.[a-z]{2,}\b/i; // "debug@4.4.2" is a version, not an address
  const files = readdirSync(DATA, { recursive: true, encoding: 'utf8' }).filter((f) => statSync(join(DATA, f)).isFile());
  assert.ok(files.length > 5);
  for (const f of files) {
    const m = email.exec(readFileSync(join(DATA, f), 'utf8'));
    assert.equal(m, null, `${f} contains ${m?.[0]}`);
  }
});
