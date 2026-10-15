// Run: node --test web/src/data/repoLabel.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { GUEST_TEAM, lockNote, lockSourceLabel, realTeam, repoLabel, repoShort } from './repoLabel.ts';

test('server-made ids read as words', () => {
  assert.equal(repoLabel('mochajs/mocha@HEAD'), "mochajs/mocha (today's lockfile)");
  assert.equal(repoLabel('pasted/patient-zero'), 'your pasted lockfile (patient-zero)');
  assert.equal(repoLabel('acme/checkout-web'), 'acme/checkout-web');
});

test('a path chain names its root repo plainly', () => {
  assert.equal(repoShort('mochajs/mocha@HEAD'), 'mochajs/mocha');
  assert.equal(repoShort('pasted/mini-app'), 'mini-app');
  assert.equal(repoShort('acme/checkout-web'), 'acme/checkout-web');
});

test('the placeholder team is no team', () => {
  assert.equal(realTeam(GUEST_TEAM), null);
  assert.equal(realTeam(null), null);
  assert.equal(realTeam('Payments'), 'Payments');
});

test('a snapshot names its commit and day; head and pasted are counterfactuals', () => {
  const sha = '5f8e8a8c0000000000000000000000000000abcd';
  const n = lockNote({ kind: 'snapshot', sha, date: Date.UTC(2025, 8, 1, 9, 30) }, 'mochajs/mocha')!;
  assert.equal(n.text, 'Judged on the lockfile at commit 5f8e8a8 from 2025-09-01, the last change before the incident.');
  assert.equal(n.counterfactual, false);
  assert.match(lockNote({ kind: 'snapshot' }, 'a/b')!.text, /^Judged on the lockfile, the last change before the incident\.$/);
  const head = lockNote({ kind: 'head' }, 'a/b@HEAD')!;
  assert.match(head.text, /today's lockfile \(counterfactual\)/);
  assert.ok(head.counterfactual);
  const pasted = lockNote({ kind: 'pasted' }, 'pasted/x')!;
  assert.match(pasted.text, /your pasted lockfile \(counterfactual\)/);
  assert.ok(pasted.counterfactual);
});

test('no source: the repo id still tells head and pasted apart; the demo org has no note', () => {
  assert.ok(lockNote(undefined, 'a/b@HEAD')!.counterfactual);
  assert.ok(lockNote(undefined, 'pasted/x')!.counterfactual);
  assert.equal(lockNote(undefined, 'acme/checkout-web'), null);
});

test('the lockfile source as a phrase: commit and day for a snapshot, a counterfactual otherwise', () => {
  assert.equal(lockSourceLabel({ kind: 'snapshot', sha: '5f8e8a89fb4cc833290549dcb1974be06514746b', date: 1756742978000 }), 'lockfile at commit 5f8e8a8 from 2025-09-01');
  assert.equal(lockSourceLabel({ kind: 'head' }), "today's lockfile, a counterfactual");
  assert.equal(lockSourceLabel({ kind: 'pasted' }), 'your pasted lockfile, a counterfactual');
  assert.equal(lockSourceLabel(undefined), null);
});
