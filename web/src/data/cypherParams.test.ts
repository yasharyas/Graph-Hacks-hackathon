// Run: node --test web/src/data/cypherParams.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cypherScript, literal, paramNames, paramPrefix, PRIVATE, runnable } from './cypherParams.ts';

const Q = 'MATCH (i:Incident {id: $incident})-[:INVOLVES]->(v) WHERE v.publishedAt <= $at RETURN v';

test('the prefix uses the raw params, FalkorDB style: strings quoted, epoch ms as a number', () => {
  assert.equal(paramPrefix(Q, { incident: 'qix-2025-09-08', at: 1757338200000 }), 'CYPHER incident="qix-2025-09-08" at=1757338200000');
  assert.equal(runnable(Q, { incident: 'qix-2025-09-08', at: 1757338200000 }), `CYPHER incident="qix-2025-09-08" at=1757338200000 ${Q}`);
});

test('only the parameters the statement uses, in the order it uses them; unknown ones fall back, then are left out', () => {
  assert.deepEqual(paramNames('RETURN $b, $a, $b'), ['b', 'a']);
  assert.equal(paramPrefix('MATCH (m {name: $maintainer}) RETURN $at', { at: 1, incident: 'x' }, { maintainer: 'qix' }), 'CYPHER maintainer="qix" at=1');
  assert.equal(paramPrefix('RETURN $unknown', {}), '');
  assert.equal(runnable('RETURN 1', { at: 1 }), 'RETURN 1');
});

test('a value this page can never know ($session, an httpOnly cookie) is a marked placeholder, not a missing parameter', () => {
  assert.equal(paramPrefix('MATCH (t:Triage {session: $session}) RETURN t', {}), `CYPHER session=${literal(PRIVATE.session)}`);
  assert.match(PRIVATE.session!, /^<private: .*httpOnly cookie/);
  assert.equal(paramPrefix('RETURN $session', {}, { session: 'abc' }), 'CYPHER session="abc"'); // a known value wins
});

test('a script of several statements: one ";" per statement, a comment after the prefix (never before it), repeats once', () => {
  const A = 'MATCH (i:Incident {id: $incident})\nRETURN i';
  const B = 'MATCH (r:Repo)\nRETURN r.id';
  const C = 'MATCH (r:Repo {id: $repo})\nRETURN r';
  const s = cypherScript([
    { tool: 'incident_exposure', q: A, params: { incident: 'qix' }, n: 1, of: 2 },
    { tool: 'incident_exposure', q: B, params: {}, n: 2, of: 2 },
    { tool: 'explain_path', q: C, params: { repo: 'a/b' } },
    { tool: 'explain_path', q: C, params: { repo: 'c/d' } },
  ]);
  const blocks = s.split('\n\n');
  assert.equal(blocks.length, 3);
  assert.ok(blocks.every((b) => b.endsWith(';') && b.split(';').length === 2), 'one statement, one terminator, per block');
  assert.ok(blocks.every((b) => !b.startsWith('//')), 'FalkorDB refuses a leading comment');
  assert.equal(blocks[0], 'CYPHER incident="qix"\n// incident_exposure query 1 of 2 · statement 1 of 3 · FalkorDB runs one statement per query: run this one on its own\nMATCH (i:Incident {id: $incident})\nRETURN i;');
  assert.match(blocks[1]!, /^MATCH \(r:Repo\)\n\/\/ incident_exposure query 2 of 2 .*\nRETURN r\.id;$/); // no parameters: after the first line
  assert.match(blocks[2]!, /^CYPHER repo="a\/b"\n\/\/ explain_path · statement 3 of 3 · ran 2 times, these are the first call's values · /);
  assert.equal(cypherScript([{ tool: 't', q: 'RETURN 1', params: {} }]), 'RETURN 1\n// t · FalkorDB runs one statement per query: run this one on its own\n;');
});

test('arrays become Cypher lists, maps and nulls are literals, and quotes are escaped', () => {
  assert.equal(literal(['acme/checkout-web', 'github/docs']), '["acme/checkout-web", "github/docs"]');
  assert.equal(literal({ a: 1, 'b-c': [true, null] }), '{a: 1, `b-c`: [true, null]}');
  assert.equal(literal('say "hi" \\ there'), '"say \\"hi\\" \\\\ there"');
  assert.equal(literal(undefined), 'null');
  assert.equal(literal(Number.NaN), 'null');
});
