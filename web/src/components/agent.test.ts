// Run: node --test web/src/components/agent.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { askExample, askPlaceholder, influenceShares, nextAccount, nextLabel, pickLabel, teamNames } from './agent.ts';

// qix at 13:30 UTC as the server reported it (Report.concentration), and the repo counts of that run
const concentration = [
  { maintainer: 'sindresorhus', influence: 0.0147567075018742, packages: 307, reposReached: 21 },
  { maintainer: 'ljharb', influence: 0.0100363969559112, packages: 183, reposReached: 20 },
  { maintainer: 'types', influence: 0.00990114872183767, packages: 234, reposReached: 20 },
];
const org = { concentration, counts: { LOCKED: 1, WOULD_PULL: 20, MAINTAINER: 0, CLEAN: 0 }, scope: { kind: 'org' as const, label: 'Acme demo org', repos: 21 } };

test('"Next qix?" is the Concentration tab\'s first row, number for number', () => {
  const tab = influenceShares(concentration)[0]!; // what the tab prints for its first maintainer
  assert.equal(tab.share, '43%');
  assert.equal(nextAccount(org), 'sindresorhus: 43% of top-3 PageRank, reaches 21 of 21 repos');
  assert.ok(nextAccount(org)!.includes(`${tab.maintainer}: ${tab.share}`) && nextAccount(org)!.includes(`reaches ${tab.reposReached} of `));
});

test('no line for a pasted repo, no data, or a share under 1%', () => {
  assert.equal(nextAccount({ ...org, scope: { kind: 'guest', label: 'a/b', repos: 1 } }), null);
  assert.equal(nextAccount({ ...org, concentration: [] }), null);
  const tiny = [{ maintainer: 'x', influence: 0.001, packages: 1, reposReached: 1 }, { maintainer: 'y', influence: 0.5, packages: 1, reposReached: 1 }];
  assert.equal(nextAccount({ ...org, concentration: tiny }), 'x: <1% of top-2 PageRank, reaches 1 of 21 repos');
  const one = [{ maintainer: 'solo', influence: 0.2, packages: 3, reposReached: 1 }];
  assert.equal(nextAccount({ ...org, concentration: one, counts: { LOCKED: 1, WOULD_PULL: 0, MAINTAINER: 0, CLEAN: 0 } }), 'solo: 100% of PageRank, reaches 1 of 1 repo');
});

test('the label names the incident like the scenario control does', () => {
  assert.equal(nextLabel({ title: 'qix npm account takeover: 19 malicious versions of chalk', maintainer: 'qix' }), 'Next qix?');
  assert.equal(nextLabel({ title: 'axios npm account takeover: 1.14.1 and 0.30.4', maintainer: 'jasonsaayman' }), 'Next axios?');
  assert.equal(nextLabel({ title: 'a different headline', maintainer: 'someone' }), 'Next someone?');
  assert.equal(nextLabel({ title: 'a different headline', maintainer: null }), 'Next account?');
});

test('the Ask placeholder names a person who is not the line\'s own', () => {
  assert.equal(askPlaceholder(askExample(org)), 'If ljharb were hijacked next, which repos would it reach?');
  const axios = [concentration[0]!, concentration[2]!, concentration[1]!]; // axios: types ranks second, ljharb third
  assert.equal(askExample({ ...org, concentration: axios }), 'ljharb'); // "types" is an account, not a person
  assert.equal(askExample({ ...org, concentration: [concentration[0]!] }), 'sindresorhus');
  assert.equal(askExample({ ...org, scope: { kind: 'guest', label: 'a/b', repos: 1 } }), null);
  assert.equal(askPlaceholder(null), 'Which exposures are prod-only?');
});

test('the pick label says how the pick was made', () => {
  assert.equal(pickLabel('live'), 'Analyst pick · LLM live');
  assert.equal(pickLabel('replay'), 'Analyst pick · LLM replayed');
});

test('the roster line shows three names and how many more', () => {
  const teams = ['Payments', 'Docs', 'QA', 'CLI', 'Platform', 'API Clients', 'Web'];
  assert.equal(teamNames(teams), 'Payments, Docs, QA +4');
  assert.equal(teamNames(teams.slice(0, 3)), 'Payments, Docs, QA');
  assert.equal(teamNames(['Web']), 'Web');
});
