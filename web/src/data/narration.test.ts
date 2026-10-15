// Run: node --test web/src/data/narration.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { segments } from './narration.ts';

const verdicts = (text: string, g: Parameters<typeof segments>[1]) =>
  segments(text, g).flatMap((s) => (s.kind === 'entity' ? [[s.text, s.verdict]] : s.kind === 'cite' ? [[s.id, s.verdict]] : s.kind === 'struck' ? [[s.text, 'struck']] : []));

test('verified only when the guard lists the exact text with ok=true', () => {
  const g = { claims: [{ text: 'debug@4.4.2', ok: true }, { text: 'E1', ok: true }, { text: 'ghost/repo', ok: false }], flagged: ['ghost/repo'] };
  assert.deepEqual(verdicts('`debug@4.4.2` via [E1]; `ghost/repo`; `unlisted@1.0.0`; [E9]', g), [
    ['debug@4.4.2', 'verified'],
    ['E1', 'verified'],
    ['ghost/repo', 'flagged'],
    ['unlisted@1.0.0', 'plain'],
    ['E9', 'plain'],
  ]);
});

test('no claims from the server means nothing is verified; guard.flagged still strikes', () => {
  assert.deepEqual(verdicts('`a/b` and `c/d`', { claims: [], flagged: ['c/d'] }), [['a/b', 'plain'], ['c/d', 'flagged']]);
  assert.deepEqual(verdicts('`a/b`', null), [['a/b', 'plain']]);
});

test('a near-miss is not a match: case and version must be exact', () => {
  const g = { claims: [{ text: 'debug@4.4.2', ok: true }], flagged: [] };
  assert.deepEqual(verdicts('`Debug@4.4.2` `debug@4.4.20`', g), [['Debug@4.4.2', 'plain'], ['debug@4.4.20', 'plain']]);
});

test('unverified prose claims are struck, verified ones are left alone; [E1, E2] splits', () => {
  const g = { claims: [{ text: '21 repos', ok: true }, { text: '47 repos', ok: false }, { text: 'E1', ok: true }, { text: 'E2', ok: false }], flagged: ['47 repos', 'E2'] };
  assert.deepEqual(verdicts('21 repos are exposed, not 47 repos. See [E1, E2].', g), [['47 repos', 'struck'], ['E1', 'verified'], ['E2', 'flagged']]);
});

test('hostile text stays text: regex metacharacters in a flagged claim do not throw or match elsewhere', () => {
  const g = { claims: [{ text: 'a.b(c)', ok: false }], flagged: ['a.b(c)'] };
  assert.deepEqual(verdicts('axb(c) and a.b(c)', g), [['a.b(c)', 'struck']]);
});
