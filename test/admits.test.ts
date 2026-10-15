// Acceptance tests for server/ingest/admits.ts (arena rubric). Contract:
//   type V = { version: string; publishedAt: number }            // publishedAt = epoch ms (packument `time`)
//   admitWindow(range, bad: V, versions: V[], removedAt): { fromT, toT } | null
//     The window during which a FRESH resolve of `range` picks `bad`: semver.maxSatisfying over versions
//     published at or before t equals bad. fromT = bad.publishedAt; toT = the earlier of removedAt and the first
//     later-published version that satisfies the range and outranks bad. null if bad is never picked.
//     Non-semver specs (git, file:, link:, http(s), workspace:, unknown tags) -> null. "" and "*" mean any version.
//     "latest" -> picked iff bad is the highest non-prerelease version at its publish time (it was the dist-tag).
//   safeVersion(ranges: string[], versions: (V & { malicious?: boolean })[], at): string | null
//     Highest non-malicious version published at or before `at` that satisfies every range; null if none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admitWindow, safeVersion } from '../server/ingest/admits.ts';

const t = (iso: string) => Date.parse(iso);
const v = (version: string, iso: string, malicious = false) => ({ version, publishedAt: t(iso), malicious });

// Fixture times: real for the bad releases, illustrative for the rest.
const debug = [
  v('3.2.7', '2020-12-09T00:00:00Z'), v('4.3.4', '2022-03-17T00:00:00Z'), v('4.3.5', '2024-05-31T00:00:00Z'),
  v('4.3.7', '2024-09-06T00:00:00Z'), v('4.4.0', '2024-12-06T00:00:00Z'), v('4.4.1', '2025-05-13T00:00:00Z'),
  v('4.4.2', '2025-09-08T13:12:39Z', true), v('4.4.3', '2025-09-08T15:00:00Z'), v('5.0.0-beta.1', '2025-09-08T14:00:00Z'),
];
const debugBad = debug.find((x) => x.version === '4.4.2')!;
const debugRemoved = t('2025-09-08T15:15:00Z');

const axios = [
  v('0.30.3', '2025-07-01T00:00:00Z'), v('0.30.4', '2026-03-31T01:00:57Z', true), v('1.13.2', '2025-10-01T00:00:00Z'),
  v('1.14.0', '2026-02-01T00:00:00Z'), v('1.14.1', '2026-03-31T00:21:58Z', true), v('0.33.0', '2026-01-10T00:00:00Z'),
];
const axiosRemoved = t('2026-03-31T03:30:00Z');
const ax = (ver: string) => axios.find((x) => x.version === ver)!;

test('debug@4.4.2: ranges that pick it while live, until the clean 4.4.3 lands', () => {
  for (const range of ['^4.3.5', '4', '^4', '>=4.0.0 <5', '*', '', '4.x', '^4.4.1']) {
    assert.deepEqual(admitWindow(range, debugBad, debug, debugRemoved), { fromT: debugBad.publishedAt, toT: t('2025-09-08T15:00:00Z') }, range);
  }
});

test('debug@4.4.2: ranges that never pick it', () => {
  for (const range of ['~4.3.1', '4.4.1', '^3.2.7', '~4.4.3', '>=5.0.0-0', 'file:../debug', 'git+https://github.com/debug-js/debug.git', 'link:../x', 'https://example.com/x.tgz', 'workspace:*', 'next']) {
    assert.equal(admitWindow(range, debugBad, debug, debugRemoved), null, range);
  }
});

test('"latest" tag picks the bad version when it was the highest stable release', () => {
  assert.deepEqual(admitWindow('latest', debugBad, debug, debugRemoved), { fromT: debugBad.publishedAt, toT: t('2025-09-08T15:00:00Z') });
});

test('removal ends the window when no newer satisfying version arrives first', () => {
  const noFix = debug.filter((x) => x.version !== '4.4.3');
  assert.deepEqual(admitWindow('^4.3.5', debugBad, noFix, debugRemoved), { fromT: debugBad.publishedAt, toT: debugRemoved });
});

test('axios: tilde and caret ranges against both malicious releases', () => {
  assert.deepEqual(admitWindow('~0.30.3', ax('0.30.4'), axios, axiosRemoved), { fromT: ax('0.30.4').publishedAt, toT: axiosRemoved });
  assert.deepEqual(admitWindow('^1.6.5', ax('1.14.1'), axios, axiosRemoved), { fromT: ax('1.14.1').publishedAt, toT: axiosRemoved });
  assert.equal(admitWindow('~0.33.0', ax('0.30.4'), axios, axiosRemoved), null);
  assert.equal(admitWindow('^0.30.0', ax('1.14.1'), axios, axiosRemoved), null);
  assert.equal(admitWindow('1.14.0', ax('1.14.1'), axios, axiosRemoved), null);
});

test('prereleases never outrank or end a window for a stable range', () => {
  const w = admitWindow('^4.3.5', debugBad, debug, debugRemoved);
  assert.equal(w?.toT, t('2025-09-08T15:00:00Z')); // 5.0.0-beta.1 at 14:00 is ignored
});

test('regressions from the arena judge', () => {
  // null removedAt = still live: the window must stay open, not disappear (hiding real exposure is the worse error)
  assert.deepEqual(admitWindow('^4.3.5', debugBad, debug, null), { fromT: debugBad.publishedAt, toT: t('2025-09-08T15:00:00Z') });
  assert.deepEqual(admitWindow('^4.3.5', debugBad, debug.filter((x) => x.version !== '4.4.3'), undefined), { fromT: debugBad.publishedAt, toT: Infinity });
  // an undeclared package has no spec at all
  assert.equal(admitWindow(undefined, debugBad, debug, debugRemoved), null);
  // a duplicate unflagged entry of the malicious version must never become the pin
  assert.equal(safeVersion(['^4.3.5'], [...debug, v('4.4.2', '2025-09-08T13:12:39Z')], t('2025-09-08T13:30:00Z')), '4.4.1');
});

test('safeVersion: highest clean version live at `at` that satisfies every range', () => {
  assert.equal(safeVersion(['^4.3.5'], debug, t('2025-09-08T13:30:00Z')), '4.4.1');
  assert.equal(safeVersion(['^4.3.5'], debug, t('2025-09-08T16:00:00Z')), '4.4.3');
  assert.equal(safeVersion(['^4.3.5', '~4.3.0'], debug, t('2025-09-08T13:30:00Z')), '4.3.7');
  assert.equal(safeVersion(['^1.6.5'], axios, t('2026-03-31T01:00:00Z')), '1.14.0');
  assert.equal(safeVersion(['^9'], debug, t('2025-09-08T13:30:00Z')), null);
  assert.equal(safeVersion(['git+https://x'], debug, t('2025-09-08T13:30:00Z')), null);
});
