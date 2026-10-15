// Run: node --test web/src/data/failure.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { nextStep, permanent, requestIdFor } from './failure.ts';

test('a 4xx never says "try again" and hides the request id', () => {
  const e = { message: 'nope/nope is not a public repo.', status: 404, requestId: 'r1' };
  assert.equal(permanent(e), true);
  assert.doesNotMatch(nextStep(e, 'analyze'), /try again/i);
  assert.equal(requestIdFor(e), undefined);
});

test('a streamed error (no status) is judged by its message', () => {
  const gone = { message: 'nope/nope is not a public repo.', requestId: 'r2' };
  assert.equal(nextStep(gone, 'analyze'), 'Check the owner/name spelling, or try a sample repo.');
  assert.equal(requestIdFor(gone), undefined);
  const cut = { message: 'The stream ended before the run finished', requestId: 'r3' };
  assert.equal(permanent(cut), false);
  assert.equal(requestIdFor(cut), 'r3');
});

test('a message that already says what to do gets no second instruction', () => {
  assert.equal(nextStep({ message: 'That analysis has expired. Paste the repo again.', status: 404 }, 'analyze'), '');
  assert.equal(nextStep({ message: 'Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install --package-lock-only.' }, 'analyze'), '');
});

test('5xx, network and rate limits keep the retry advice; only 5xx and network show the request id', () => {
  assert.match(nextStep({ message: 'x', status: 502, requestId: 'r4' }, 'triage'), /again/);
  assert.equal(requestIdFor({ message: 'x', status: 502, requestId: 'r4' }), 'r4');
  assert.equal(requestIdFor({ message: 'x', status: 0, requestId: 'r5' }), 'r5');
  assert.equal(permanent({ message: 'Too many requests.', status: 429 }), false);
  assert.equal(requestIdFor({ message: 'Too many requests.', status: 429, requestId: 'r6' }), undefined);
});
