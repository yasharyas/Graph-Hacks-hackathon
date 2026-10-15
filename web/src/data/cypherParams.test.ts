// Run: node --test web/src/data/cypherParams.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { literal, paramNames, paramPrefix, runnable } from './cypherParams.ts';

const Q = 'MATCH (i:Incident {id: $incident})-[:INVOLVES]->(v) WHERE v.publishedAt <= $at RETURN v';

test('the prefix uses the raw params, FalkorDB style: strings quoted, epoch ms as a number', () => {
  assert.equal(paramPrefix(Q, { incident: 'qix-2025-09-08', at: 1757338200000 }), 'CYPHER incident="qix-2025-09-08" at=1757338200000');
  assert.equal(runnable(Q, { incident: 'qix-2025-09-08', at: 1757338200000 }), `CYPHER incident="qix-2025-09-08" at=1757338200000 ${Q}`);
});

test('only the parameters the statement uses, in the order it uses them; unknown ones fall back, then are left out', () => {
  assert.deepEqual(paramNames('RETURN $b, $a, $b'), ['b', 'a']);
  assert.equal(paramPrefix('MATCH (m {name: $maintainer}) RETURN $at', { at: 1, incident: 'x' }, { maintainer: 'qix' }), 'CYPHER maintainer="qix" at=1');
  assert.equal(paramPrefix('RETURN $session', {}), '');
  assert.equal(runnable('RETURN 1', { at: 1 }), 'RETURN 1');
});

test('arrays become Cypher lists, maps and nulls are literals, and quotes are escaped', () => {
  assert.equal(literal(['acme/checkout-web', 'github/docs']), '["acme/checkout-web", "github/docs"]');
  assert.equal(literal({ a: 1, 'b-c': [true, null] }), '{a: 1, `b-c`: [true, null]}');
  assert.equal(literal('say "hi" \\ there'), '"say \\"hi\\" \\\\ there"');
  assert.equal(literal(undefined), 'null');
  assert.equal(literal(Number.NaN), 'null');
});
