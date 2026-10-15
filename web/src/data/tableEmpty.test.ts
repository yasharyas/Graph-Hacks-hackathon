// Run: node --test web/src/data/tableEmpty.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyCopy, filterRows, sortStatus, whyEmpty, type RowFilter } from './tableEmpty.ts';
import type { Exposure } from './types.ts';

const row = (repo: string, tier: Exposure['tier'], dev: boolean, team: string | null = null) => ({ repo, tier, dev, team });
const rows = [row('a/prod', 'WOULD_PULL', false, 'Payments'), row('b/dev', 'WOULD_PULL', true, 'Web'), row('c/dev', 'MAINTAINER', true), row('d/prod', 'LOCKED', false)];
const all: RowFilter = { prodOnly: false, tier: 'ALL', query: '' };

test('the filter keeps prod repos, one tier, and a search on repo or team', () => {
  assert.deepEqual(filterRows(rows, { ...all, prodOnly: true }).map((r) => r.repo), ['a/prod', 'd/prod']);
  assert.deepEqual(filterRows(rows, { ...all, tier: 'MAINTAINER' }).map((r) => r.repo), ['c/dev']);
  assert.deepEqual(filterRows(rows, { ...all, query: ' WEB ' }).map((r) => r.repo), ['b/dev']);
  assert.deepEqual(filterRows(rows, { ...all, prodOnly: true }, true).length, 4, 'ignoreProd keeps the dev repos');
});

test('Prod only plus a search that matches nothing is "no match", not "dev dependencies only"', () => {
  const f: RowFilter = { prodOnly: true, tier: 'ALL', query: 'zzzz' };
  assert.equal(filterRows(rows, f).length, 0);
  assert.deepEqual(whyEmpty(rows, f), { kind: 'nomatch' });
  const c = emptyCopy(whyEmpty(rows, f));
  assert.equal(c.title, 'No matching repos');
  assert.equal(c.action, 'Clear filters');
  assert.ok(!c.cause.includes('dev dependencies only'));
});

test('Prod only is blamed only when it alone empties the table', () => {
  const devs = [row('b/dev', 'WOULD_PULL', true), row('c/dev', 'MAINTAINER', true)];
  const bare = whyEmpty(devs, { prodOnly: true, tier: 'ALL', query: '' });
  assert.deepEqual(bare, { kind: 'devOnly', hidden: 2, bare: true });
  assert.equal(emptyCopy(bare).title, 'No prod exposures');
  assert.equal(emptyCopy(bare).cause, 'Every exposed repo here reaches the bad version through dev dependencies only.');
  assert.equal(emptyCopy(bare).action, 'Show dev-only (2)');
  // mixed repos, but the tier picks only dev ones: the prod switch is still the reason, and the words say "matching"
  const tierDev = whyEmpty(rows, { prodOnly: true, tier: 'MAINTAINER', query: '' });
  assert.deepEqual(tierDev, { kind: 'devOnly', hidden: 1, bare: false });
  assert.equal(emptyCopy(tierDev).title, 'No matching prod repos');
  assert.match(emptyCopy(tierDev).cause, /^The 1 repo matching your search is dev-only\. Turn off Prod only to see it\.$/);
  // the original bug: some dev repos exist, but the search matches none of them
  assert.deepEqual(whyEmpty(rows, { prodOnly: true, tier: 'ALL', query: 'zzzz' }), { kind: 'nomatch' });
  // a mix of prod and dev matches can never be empty under Prod only
  assert.deepEqual(whyEmpty(rows, { prodOnly: false, tier: 'LOCKED', query: 'nope' }), { kind: 'nomatch' });
});

test('nothing exposed is its own state', () => {
  assert.deepEqual(whyEmpty([], { prodOnly: true, tier: 'ALL', query: '' }), { kind: 'none' });
  assert.equal(emptyCopy({ kind: 'none' }).title, 'No exposed repos');
});

test('a sort change is spoken in words', () => {
  assert.equal(sortStatus('Repo', 1), 'Sorted by repo, ascending');
  assert.equal(sortStatus('Tier', -1), 'Sorted by tier, descending');
});
