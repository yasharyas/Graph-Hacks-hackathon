// Acceptance tests for server/agent/guard.ts (arena rubric). The guard checks an LLM narrative against the
// evidence returned by graph tools. Contract:
//   type Evidence = { entities: Set<string>; numbers: Set<number>; pathIds: Set<string> }
//   type Claim = { text: string; start: number; end: number; kind: 'entity' | 'number' | 'cite'; ok: boolean }
//   guard(text: string, ev: Evidence): { verified: number; total: number; flagged: string[]; claims: Claim[] }
// Claims, counted per occurrence, in text order, never overlapping:
//   - anything in backticks                         -> entity (the text inside the backticks)
//   - bare npm name@version, scoped or not            -> entity (e.g. debug@4.4.2, @ctrl/tinycolor@4.1.1)
//   - bare GitHub owner/repo (owner has a letter)     -> entity; common words like and/or, w/o, n/a, i/o are not claims
//   - a number (digits or one..twenty, any case) directly before repo(s)|repository|repositories|package(s)|
//     version(s)|team(s)|path(s)|maintainer(s)        -> number (the numeric value must be in ev.numbers)
//   Trailing sentence punctuation is never part of a claim ("octo/cat." -> "octo/cat").
//   - [E<n>] citation                                 -> cite (E<n> must be in ev.pathIds)
// Entity matching is case-insensitive. `start`/`end` index into `text` and cover the whole claim token
// (backticks included). `flagged` lists the claim texts (number claims as e.g. "6 repos", cites as "E99").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard } from '../server/agent/guard.ts';

const ev = {
  entities: new Set(['acme/checkout-web', 'debug@4.4.2', 'mochajs/mocha', '^4.3.5', 'qix', 'Payments', '@ctrl/tinycolor@4.1.1']),
  numbers: new Set([4, 1]),
  pathIds: new Set(['E1', 'E2']),
};

test('a faithful narrative verifies every claim', () => {
  const text = '`acme/checkout-web` has `debug@4.4.2` locked [E1]. 4 repos would pull it, e.g. mochajs/mocha via `^4.3.5` [E2].';
  const r = guard(text, ev);
  assert.deepEqual(r.flagged, []);
  assert.equal(r.total, 7);
  assert.equal(r.verified, 7);
  assert.deepEqual(r.claims.map((c) => c.kind), ['entity', 'entity', 'cite', 'number', 'entity', 'entity', 'cite']);
});

test('hallucinated entities, numbers and citations are flagged', () => {
  const r = guard('Upgrade `lodash@4.17.21`; 6 repos are affected [E99], also left-pad@1.3.0 and octo/cat.', ev);
  assert.deepEqual(r.flagged, ['lodash@4.17.21', '6 repos', 'E99', 'left-pad@1.3.0', 'octo/cat']);
  assert.equal(r.verified, 0);
  assert.equal(r.total, 5);
});

test('spans cover the token, backticks included', () => {
  const text = 'See `debug@4.4.2` now';
  const [c] = guard(text, ev).claims;
  assert.equal(text.slice(c.start, c.end), '`debug@4.4.2`');
  assert.equal(c.text, 'debug@4.4.2');
});

test('spelled-out numbers and case-insensitive entities', () => {
  const r = guard('Four repos are exposed; notify one team about MochaJS/Mocha. Five teams own nothing.', ev);
  assert.deepEqual(r.flagged, ['Five teams']);
  assert.equal(r.verified, 3);
});

test('scoped bare name@version is an entity', () => {
  const r = guard('Shai-Hulud shipped @ctrl/tinycolor@4.1.1 first.', ev);
  assert.equal(r.total, 1);
  assert.equal(r.verified, 1);
});

test('ordinary prose is not a claim', () => {
  const r = guard('Rotate secrets and/or rebuild w/o cache; status n/a, i/o fine, 24/7 on-call, ~74 minutes ahead.', ev);
  assert.equal(r.total, 0);
});

test('regressions from the arena judge', () => {
  const e = { ...ev, numbers: new Set([1234]), entities: new Set([...ev.entities, 'npm', 'debug@^4.3.5']) };
  // thousands separators are one number, not "234 packages"
  assert.deepEqual(guard('1,234 packages reachable.', e).flagged, []);
  // a stray backtick does not pair across prose
  const r = guard('Use ` carefully and `npm` here.', e);
  assert.deepEqual(r.claims.map((c) => c.text), ['npm']);
  // file paths and tool pairs are not repo claims
  assert.equal(guard('Edit lib/index.js and package.json; npm/yarn both work, dev/prod too.', e).total, 0);
  // cite lists
  assert.deepEqual(guard('See [E1, E2].', e).claims.map((c) => [c.text, c.ok]), [['E1', true], ['E2', true]]);
  // a declared range attached to a name
  assert.equal(guard('mocha declares debug@^4.3.5.', e).verified, 1);
});

test('empty text', () => {
  assert.deepEqual(guard('', ev), { verified: 0, total: 0, flagged: [], claims: [] });
});
