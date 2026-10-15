// Run: node --test web/src/data/pasteError.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { pasteProblem } from './pasteError.ts';

const ID = '2f6c1c1e-0000-4000-8000-000000000000';

test('a verdict about the input is shown whole, with no "try again" and no request id', () => {
  for (const message of [
    'github.com/foo/bar is not a public repo.',
    'Use a public repo URL like https://github.com/owner/name',
    'yarn and pnpm lockfiles are not supported yet. Drop a package-lock.json (npm v2 or v3).',
    'That lockfile is too large. Lockfiles up to 5 MB and 6,000 entries are supported.',
  ]) {
    const p = pasteProblem({ message, requestId: ID });
    assert.equal(p.message, message);
    assert.equal(p.retry, false);
    assert.equal(p.requestId, null);
    assert.equal(p.wait, 0);
  }
  assert.equal(pasteProblem({ message: 'github.com/foo/bar is not a public repo. Try again, or try a sample repo.', status: 404 }).message, 'github.com/foo/bar is not a public repo.');
});

test('no lockfile: the command the server names can be copied', () => {
  const message = 'No package-lock.json at the root of a/b. In a checkout, run npm install --package-lock-only (it writes the lockfile without installing anything) and drop the generated package-lock.json here.';
  const p = pasteProblem({ message, requestId: ID });
  assert.equal(p.message, message, 'whole, not cut');
  assert.equal(p.command, 'npm install --package-lock-only');
  assert.equal(p.retry, false);
});

test('a failure on our side or the network is worth a retry and a request id', () => {
  const down = pasteProblem({ message: 'GitHub did not answer. Try again, or drop the package-lock.json instead.', requestId: ID });
  assert.equal(down.retry, true);
  assert.equal(down.requestId, ID);
  assert.equal(down.message, 'GitHub did not answer. Try again, or drop the package-lock.json instead.');
  const ours = pasteProblem({ message: 'Analysis failed on our side.', requestId: ID });
  assert.equal(ours.message, 'Analysis failed on our side. Try again.');
  assert.equal(ours.requestId, ID);
  const net = pasteProblem({ message: 'Cannot reach the Patient Zero server', status: 0 });
  assert.equal(net.message, 'Cannot reach the Patient Zero server. Check your connection and that the API is running. Try again.');
  assert.equal(net.requestId, null, 'none was issued');
  assert.equal(pasteProblem({ message: 'x', status: 503, requestId: ID }).requestId, ID);
});

test('rate limits show the server sentence only, with a wait that fits it, and no request id', () => {
  const busy = pasteProblem({ message: 'Another repo is being analyzed right now. Try again in a few seconds.', status: 429, requestId: ID });
  assert.equal(busy.message, 'Another repo is being analyzed right now. Try again in a few seconds.');
  assert.equal(busy.wait, 5);
  assert.equal(busy.requestId, null);
  const limit = pasteProblem({ message: 'Too many requests. Wait a moment and try again.', status: 429 });
  assert.equal(limit.message, 'Too many requests. Wait a moment and try again.');
  assert.equal(limit.wait, 20);
  assert.ok(!/20 seconds/.test(busy.message + limit.message), 'one rate-limit sentence, the server\'s');
});
