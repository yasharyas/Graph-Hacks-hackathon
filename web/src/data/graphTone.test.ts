// Run: node --test web/src/data/graphTone.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { chainVar } from './graphTone.ts';

test('the selected chain wears its tier: LOCKED red, WOULD_PULL amber, MAINTAINER steel', () => {
  assert.equal(chainVar('LOCKED'), '--tier-locked');
  assert.equal(chainVar('WOULD_PULL'), '--tier-would-pull');
  assert.equal(chainVar('MAINTAINER'), '--tier-maintainer');
  assert.equal(chainVar('CLEAN'), '--tier-clean');
});

test('with no known tier the chain keeps the graph link colour', () => {
  assert.equal(chainVar(undefined), '--graph-link-active');
  assert.equal(chainVar(null), '--graph-link-active');
});
