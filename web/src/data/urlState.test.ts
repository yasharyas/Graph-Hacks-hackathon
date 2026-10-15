import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readUrlState, shareUrl } from './urlState.ts';

test('a share link round-trips scenario, minute and repo', () => {
  const url = shareUrl('http://localhost:5173/?mock', { scenario: 'axios-2026-03-31', at: 1774920000000 + 30_000, repo: 'acme/checkout-web' });
  const back = readUrlState(new URL(url).search);
  assert.deepEqual(back, { scenario: 'axios-2026-03-31', at: 1774920000000, repo: 'acme/checkout-web' });
  assert.ok(url.includes('mock'), 'keeps mock mode');
});

test('untrusted values are dropped, not passed on', () => {
  const s = readUrlState('?scenario=nope&at=-5&repo=../../etc/passwd');
  assert.deepEqual(s, { scenario: null, at: null, repo: null });
  assert.equal(readUrlState('?at=abc').at, null);
});

test('a pasted repo is not encoded', () => {
  assert.ok(!shareUrl('http://x/', { scenario: 'qix-2025-09-08', at: null, repo: null }).includes('repo='));
});
