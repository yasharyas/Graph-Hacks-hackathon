// Run: node --test web/src/data/lockfile.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { lockfileProblem, looksLikeLockfile, MAX_LOCKFILE_BYTES, OLD_LOCKFILE, TOO_BIG, UNSUPPORTED } from './lockfile.ts';

test('yarn and pnpm lockfiles get the friendly message, by name or by content', () => {
  assert.equal(lockfileProblem('yarn.lock', '{}'), UNSUPPORTED);
  assert.equal(lockfileProblem('pnpm-lock.yaml', '{}'), UNSUPPORTED);
  assert.equal(lockfileProblem('pasted', '# yarn lockfile v1\n\ndebug@^4.3.4:\n  version "4.4.2"\n'), UNSUPPORTED);
  assert.equal(lockfileProblem('pasted', "lockfileVersion: '9.0'\n\nimporters:\n  .:\n"), UNSUPPORTED);
});

test('npm lockfiles: v2 and v3 pass, v1 and unversioned are told to upgrade', () => {
  assert.equal(lockfileProblem('package-lock.json', '{"lockfileVersion": 3, "packages": {}}'), null);
  assert.equal(lockfileProblem('package-lock.json', '  {\n "lockfileVersion":2}'), null);
  assert.equal(lockfileProblem('package-lock.json', '{"lockfileVersion": 1}'), OLD_LOCKFILE);
  assert.equal(lockfileProblem('package-lock.json', '{"name":"x"}'), OLD_LOCKFILE);
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
