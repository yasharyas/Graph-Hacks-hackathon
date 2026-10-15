import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readUrlState, shareUrl } from './urlState.ts';

test('a share link round-trips scenario, minute, repo and the drawer tab', () => {
  const url = shareUrl('http://localhost:5173/?mock', { scenario: 'axios-2026-03-31', at: 1774920000000 + 30_000, repo: 'acme/checkout-web', open: 'notice' });
  const back = readUrlState(new URL(url).search);
  assert.deepEqual(back, { scenario: 'axios-2026-03-31', at: 1774920000000, repo: 'acme/checkout-web', guest: null, open: 'notice' });
  assert.ok(url.includes('mock'), 'keeps mock mode');
  assert.ok(url.includes('repo=acme/checkout-web'), 'owner/name stays readable');
});

test('a pasted public repo is shared as guest=, re-analysed on load; it wins over repo=', () => {
  const url = shareUrl('http://x/', { scenario: 'qix-2025-09-08', at: null, repo: 'acme/checkout-web', guest: 'axios/axios', open: 'fix' });
  assert.deepEqual(readUrlState(new URL(url).search), { scenario: 'qix-2025-09-08', at: null, repo: null, guest: 'axios/axios', open: 'fix' });
});

test('untrusted values are dropped, not passed on', () => {
  const s = readUrlState('?scenario=nope&at=-5&repo=../../etc/passwd&guest=a/..&open=<script>');
  assert.deepEqual(s, { scenario: null, at: null, repo: null, guest: null, open: null });
  assert.equal(readUrlState('?at=abc').at, null);
  assert.equal(readUrlState('?scenario=qix-2025-09-08&at=1e16').at, null, 'out of range: would throw in toISOString');
  assert.equal(readUrlState('?scenario=qix-2025-09-08&at=1774920000000').at, null, "another incident's clock");
  assert.equal(readUrlState('?scenario=qix-2025-09-08&at=1757338200000').at, 1757338200000);
});

test('no repo, no open: a dropped lockfile has nothing to reopen', () => {
  const url = shareUrl('http://x/', { scenario: 'qix-2025-09-08', at: null, repo: null, open: 'fix' });
  assert.ok(!url.includes('repo=') && !url.includes('guest=') && !url.includes('open='));
});
