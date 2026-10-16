import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cypherPieces } from './cypherWrap.ts';

test('a pattern breaks at its joints, never inside a label or a relationship name', () => {
  assert.deepEqual(cypherPieces('(m:Maintainer)-[:MAINTAINS]->(p:Package)'), ['(m:Maintainer)', '-[:MAINTAINS]', '->', '(p:Package)']);
  assert.deepEqual(cypherPieces('(p)<-[:VERSION_OF]-(v)'), ['(p)', '<-[:VERSION_OF]', '-(v)']);
});

test('a parameter list breaks after each comma; the pieces always join back to the same text', () => {
  const prefix = 'CYPHER versions=["debug@4.4.2","chalk@5.6.1"] at=1757338200000';
  assert.deepEqual(cypherPieces(prefix), ['CYPHER versions=["debug@4.4.2",', '"chalk@5.6.1"] at=1757338200000']); // the space wraps by itself
  for (const s of [prefix, 'MATCH (r:Repo {id: $repo})-[:DECLARES*1..6]->(v) RETURN r.id, count(v) AS n;', '', 'a, b']) assert.equal(cypherPieces(s).join(''), s);
});

test('no joint before a space, a closer or a separator (those wrap, or must stay, on their own)', () => {
  assert.deepEqual(cypherPieces('count(v) AS n'), ['count(v) AS n']);
  assert.deepEqual(cypherPieces('f(g(x)), y'), ['f(g(x)), y']);
  assert.deepEqual(cypherPieces('[a];'), ['[a];']);
});
