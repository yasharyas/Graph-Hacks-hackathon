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

test('a repo that is not public says what else to try, besides the server sentence kept whole', () => {
  const p = pasteProblem({ message: 'github.com/foo/bar is not a public repo.', status: 404 });
  assert.equal(p.message, 'github.com/foo/bar is not a public repo.');
  assert.equal(p.hint, 'Check the spelling, or paste its package-lock.json below if the repo is private.');
  assert.equal(pasteProblem({ message: 'No package-lock.json at the root of a/b.' }).hint, null);
  assert.equal(pasteProblem({ message: 'Analysis failed on our side.' }).hint, null);
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

// The three long messages the server writes (server/ingest/guest.ts noLockfile).
const YARN =
  "facebook/react uses yarn (yarn.lock), and Patient Zero reads only npm's package-lock.json (v2 or v3); yarn lockfiles are on the roadmap. To check it by hand, search yarn.lock at a commit from before the incident for the malicious versions: ansi-styles 6.2.2, debug 4.4.2, chalk 5.6.1, supports-color 10.2.1, strip-ansi 7.1.1, ansi-regex 6.2.1 and 13 more (the timeline lists them all). If the project also installs with npm (no workspace: dependencies), run npm install --package-lock-only in a checkout and drop the generated file here.";
const NONE = 'No package-lock.json at the root of lodash/lodash. In a checkout, run npm install --package-lock-only (it writes the lockfile without installing anything) and drop the generated package-lock.json here.';

test('a short message is its own lead, with nothing behind a disclosure', () => {
  for (const message of ['Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install with npm 7 or newer to upgrade it.', 'github.com/foo/bar is not a public repo.']) {
    const p = pasteProblem({ message });
    assert.equal(p.lead, message);
    assert.equal(p.details, null);
  }
});

test('a yarn or pnpm message opens with one line; the versions to search for and the command wait behind a disclosure', () => {
  const p = pasteProblem({ message: YARN });
  assert.equal(p.message, YARN, 'the server sentence stays whole for anything that wants it');
  assert.equal(p.lead, "facebook/react uses yarn (yarn.lock). Only npm's package-lock.json can be read so far.");
  assert.ok(p.lead.length < 100, 'two or three lines at 320 px');
  assert.match(p.details!, /^To check it by hand, search yarn\.lock/);
  assert.match(p.details!, /ansi-styles 6\.2\.2, debug 4\.4\.2/, 'the versions are in the details');
  assert.match(p.details!, /run npm install --package-lock-only in a checkout/);
  assert.equal(p.detailsLabel, 'How to check it by hand');
  assert.equal(p.command, 'npm install --package-lock-only', 'the Copy command button stays');
  assert.equal(`${p.lead} ${p.details}`.includes('roadmap'), false, 'the roadmap clause moved into "so far"');
  assert.match(pasteProblem({ message: YARN.replace('facebook/react uses yarn (yarn.lock)', 'vuejs/core uses pnpm (pnpm-lock.yaml)') }).lead, /^vuejs\/core uses pnpm \(pnpm-lock\.yaml\)\./);
});

test('no lockfile: one line, with the longer instruction behind a disclosure and the command still copyable', () => {
  const p = pasteProblem({ message: NONE });
  assert.equal(p.lead, 'No package-lock.json at the root of lodash/lodash. Generate one and drop it here.');
  assert.match(p.details!, /^In a checkout, run npm install --package-lock-only \(it writes the lockfile without installing anything\)/);
  assert.equal(p.detailsLabel, 'How to generate it');
  assert.equal(p.command, 'npm install --package-lock-only');
});

test('any other long message is cut at its first sentence', () => {
  const message = 'The lockfile could not be read because the file is not valid JSON at line 3. Open it in an editor, find the line the parser stopped at, and compare it with the same file in a fresh checkout before you try again; a merge conflict marker is the usual cause.';
  const p = pasteProblem({ message });
  assert.equal(p.lead, 'The lockfile could not be read because the file is not valid JSON at line 3.');
  assert.match(p.details!, /^Open it in an editor/);
  assert.equal(p.detailsLabel, 'More detail');
  assert.equal(pasteProblem({ message: 'x'.repeat(200) }).details, null, 'no sentence to cut at: shown whole');
});
