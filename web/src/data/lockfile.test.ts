// Run: node --test web/src/data/lockfile.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BAD_JSON,
  inspectLockfile,
  lockfileProblem,
  looksLikeLockfile,
  MAX_LOCKFILE_BYTES,
  NOT_A_LOCKFILE,
  NPM_FIX,
  OLD_LOCKFILE,
  PACKAGE_JSON,
  repoFromInput,
  TOO_BIG,
  UNSUPPORTED,
} from './lockfile.ts';

test('yarn and pnpm lockfiles get the friendly message and the way out, by name or by content', () => {
  assert.equal(lockfileProblem('yarn.lock', '{}'), UNSUPPORTED);
  assert.equal(lockfileProblem('pnpm-lock.yaml', '{}'), UNSUPPORTED);
  assert.equal(lockfileProblem('pasted', '# yarn lockfile v1\n\ndebug@^4.3.4:\n  version "4.4.2"\n'), UNSUPPORTED);
  assert.equal(lockfileProblem('pasted', "lockfileVersion: '9.0'\n\nimporters:\n  .:\n"), UNSUPPORTED);
  assert.equal(lockfileProblem('pasted', '__metadata:\n  version: 8\n'), UNSUPPORTED);
  assert.ok(UNSUPPORTED.includes(NPM_FIX) && OLD_LOCKFILE.includes(NPM_FIX) && PACKAGE_JSON.includes(NPM_FIX));
});

test('npm lockfiles: v2 and v3 pass, v1 and unversioned are told to upgrade', () => {
  assert.equal(lockfileProblem('package-lock.json', '{"lockfileVersion": 3, "packages": {}}'), null);
  assert.equal(lockfileProblem('package-lock.json', '  {\n "lockfileVersion":2}'), null);
  assert.equal(lockfileProblem('package-lock.json', '{"lockfileVersion": 1}'), OLD_LOCKFILE);
  assert.equal(lockfileProblem('package-lock.json', '{"name":"x"}'), OLD_LOCKFILE);
});

test('a pasted package.json gets the right diagnosis, not "upgrade npm"', () => {
  assert.equal(lockfileProblem('pasted', '{"name":"x","version":"1.0.0","dependencies":{"debug":"^4.3.4"}}'), PACKAGE_JSON);
  assert.equal(lockfileProblem('pasted', '{"scripts":{"test":"node --test"}}'), PACKAGE_JSON);
});

test('truncated JSON, plain text and non-objects are told apart', () => {
  assert.equal(lockfileProblem('pasted', '{"lockfileVersion": 3, "packages": {"": {'), BAD_JSON);
  assert.equal(lockfileProblem('pasted', 'hello world\nsecond line'), NOT_A_LOCKFILE);
  assert.equal(lockfileProblem('pasted', '[1,2]'), NOT_A_LOCKFILE);
});

test('"Parsed N packages" counts entries without the root', () => {
  const lock = JSON.stringify({ lockfileVersion: 3, packages: { '': { name: 'x' }, 'node_modules/a': {}, 'node_modules/b': {}, 'node_modules/a/node_modules/c': {} } });
  assert.deepEqual(inspectLockfile('package-lock.json', lock), { problem: null, packages: 3, version: 3 });
  assert.deepEqual(inspectLockfile('package-lock.json', '{"lockfileVersion":3}'), { problem: null, packages: 0, version: 3 });
  assert.equal(inspectLockfile('yarn.lock', '{}').packages, 0);
});

test('size is judged in bytes, not characters', () => {
  assert.equal(lockfileProblem('package-lock.json', '{"lockfileVersion":3}', MAX_LOCKFILE_BYTES + 1), TOO_BIG);
  assert.equal(lockfileProblem('package-lock.json', '{"lockfileVersion":3}', MAX_LOCKFILE_BYTES), null);
});

test('only multi-line pastes are treated as a lockfile', () => {
  assert.equal(looksLikeLockfile('https://github.com/remy/nodemon'), false);
  assert.equal(looksLikeLockfile('https://github.com/remy/nodemon\n'), false);
  assert.equal(looksLikeLockfile('# yarn lockfile v1\n\ndebug@^4.3.4:'), true);
});

test('every way people write a repo becomes https://github.com/owner/name', () => {
  const want = { url: 'https://github.com/mochajs/mocha' };
  for (const s of [
    'mochajs/mocha',
    ' mochajs/mocha ',
    'github.com/mochajs/mocha',
    'www.github.com/mochajs/mocha',
    'https://github.com/mochajs/mocha',
    'http://github.com/mochajs/mocha/',
    'https://github.com/mochajs/mocha.git',
    'https://github.com/mochajs/mocha/tree/main/lib',
    'https://github.com/mochajs/mocha/blob/main/package.json?plain=1#L3',
    'https://github.com/mochajs/mocha/pull/42',
    'git@github.com:mochajs/mocha.git',
    'git+https://github.com/mochajs/mocha.git',
    'ssh://git@github.com/mochajs/mocha',
    '<https://github.com/mochajs/mocha>',
    '"mochajs/mocha"',
    'mochajs/mocha.git',
  ]) {
    assert.deepEqual(repoFromInput(s), want, s);
  }
  assert.deepEqual(repoFromInput('socketio/socket.io'), { url: 'https://github.com/socketio/socket.io' });
  assert.deepEqual(repoFromInput('FalkorDB/falkordb-ts'), { url: 'https://github.com/FalkorDB/falkordb-ts' });
});

test('anything else is a plain error, never a request', () => {
  for (const s of [
    '',
    '   ',
    'hello world',
    'http://169.254.169.254/latest',
    'https://gitlab.com/a/b',
    'gitlab.com/a/b',
    'github.com.evil.example/a/b',
    'https://github.com.evil.example/a/b',
    'https://evil.example/github.com/a/b',
    'localhost:3000/a/b',
    'github.com',
    'github.com/onlyowner',
    'a/b/c',
    '../etc/passwd',
    'a/..',
    'bad owner/x',
    'under_score/x',
    'user@host/a',
  ]) {
    const r = repoFromInput(s);
    assert.ok('error' in r, `${JSON.stringify(s)} -> ${JSON.stringify(r)}`);
  }
});
