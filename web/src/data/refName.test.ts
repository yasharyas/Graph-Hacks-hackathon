// Run: node --test web/src/data/refName.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { charsIn, CH_PX, scopeFit } from './refName.ts';

test('a cell holds as many characters as its width allows, mono text being a count', () => {
  assert.equal(charsIn(191), 22); // the path cell at 1440px
  assert.equal(charsIn(224), 26); // at 1920px
  assert.equal(charsIn(168), 20); // at 1280px
  assert.equal(charsIn(0), 12, 'a hidden table asks for no less than a short ref');
  assert.equal(CH_PX, 8.4);
});

test('the scope is written out when the whole ref fits', () => {
  assert.equal(scopeFit('@babel/core', '7.26.9', 22), 'whole');
  assert.equal(scopeFit('@typescript-eslint/parser', '8.30.1', 40), 'whole');
});

test('only the scope gives way: first to its two letters, then to the ellipsis alone', () => {
  // 22 characters at 1440px
  assert.equal(scopeFit('@typescript-eslint/parser', '8.30.1', 22), 'short'); // @ty…/parser@8.30.1 = 18
  assert.equal(scopeFit('@typescript-eslint/type-utils', '8.39.1', 22), 'short'); // @ty…/type-utils@8.39.1 = 22
  assert.equal(scopeFit('@typescript-eslint/eslint-plugin', '6.21.0', 22), 'tiny'); // @ty… would need 25; …/eslint-plugin@6.21.0 = 22
  assert.equal(scopeFit('@typescript-eslint/eslint-plugin', '6.21.0', 26), 'short'); // 1920px
  assert.equal(scopeFit('@codechecks/client', '0.1.12', 22), 'short');
  assert.equal(scopeFit('@cucumber/cucumber', '8.11.1', 20), 'short');
});

test('the same ref and the same width always give the same fit, and a narrower cell never shows more', () => {
  const rank = { whole: 2, short: 1, tiny: 0 };
  let last = 2;
  for (let max = 60; max >= 12; max--) {
    const fit = rank[scopeFit('@typescript-eslint/eslint-plugin', '6.21.0', max)];
    assert.ok(fit <= last, `max ${max}`);
    last = fit;
  }
});

test('nothing else is ever shortened: unscoped names, short scopes, refs without a version', () => {
  assert.equal(scopeFit('npm-run-all2', '8.0.4', 12), 'whole');
  assert.equal(scopeFit('@vue/shared', '3.5.0', 12), 'whole', '@vue is already as short as its box');
  assert.equal(scopeFit('@tapjs/run', null, 12), 'whole', '@tapjs/run = 10');
  assert.equal(scopeFit('@/odd', '1.0.0', 12), 'whole', 'a slash right after @ is not a scope');
  assert.equal(scopeFit('owner/repo', null, 12), 'whole', 'a repo id is not a scoped package');
});
