// Run: node --test web/src/data/cypher.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { labelOf, planFor, planLine, schemaOf, statements } from './cypher.ts';

// The five statements incident_exposure ran against FalkorDB (server/tools/cypher.ts), trimmed to their patterns.
const exposure = [
  'MATCH (r:Repo) OPTIONAL MATCH (r)-[:OWNED_BY]->(t:Team) RETURN r.id AS repo, t.name AS team',
  'MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[:RESOLVES_TO]-(d:Dep) WHERE bad.publishedAt <= $at RETURN d.repo AS repo',
  'MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep) WHERE a.fromT <= $at RETURN p.repo AS repo',
  'MATCH (i:Incident {id: $incident})-[:INVOLVES]->(v:Version) OPTIONAL MATCH (i)-[:COMPROMISED]->(m:Maintainer) RETURN i.id AS id',
  "MATCH (:Maintainer {name: $maintainer})-[:MAINTAINS]->(pkg:Package)<-[:OF]-(:Version)<-[:RESOLVES_TO]-(d:Dep) RETURN d.repo AS repo",
];
// What GET /api/plan returns for that tool: the ADMITS query's plan.
const admitsPlan = [
  'Results',
  '    Aggregate',
  '        Filter',
  '            Conditional Traverse | (p)-[r:REQUIRES]->(l:Dep)',
  '                Filter',
  '                    Conditional Traverse | (bad)-[a:ADMITS]->(p:Dep)',
  '                        Conditional Traverse | (@anon_0)->(bad:Version)',
  '                            Node By Index Scan | (@anon_0:Incident)',
];

test('each statement is labelled by its first node label and the relationships it walks', () => {
  assert.deepEqual(statements(exposure).map((s) => `${s.n}/${s.of} ${s.label}`), [
    '1/5 Repo · OWNED_BY',
    '2/5 Incident · RESOLVES_TO',
    '3/5 Incident · ADMITS + REQUIRES',
    '4/5 Incident · COMPROMISED',
    '5/5 Maintainer · MAINTAINS + RESOLVES_TO',
  ]);
  assert.equal(labelOf('RETURN 1'), 'query');
});

test('a plan is matched to the statement it explains, not to the first block', () => {
  assert.equal(planFor(admitsPlan, exposure), 2);
  assert.equal(planFor(['Results', '    Node By Label Scan | (r:Repo)', '    Conditional Traverse | (r)-[:OWNED_BY]->(t:Team)'], exposure), 0);
});

test('a plan that fits no statement is null; a single statement needs no matching', () => {
  assert.equal(planFor(['Results', '    Node By Label Scan | (x:Unknown)'], exposure), null);
  assert.equal(planFor([], exposure), null);
  assert.equal(planFor(['whatever'], ['MATCH (n) RETURN n']), 0);
});

test('plan lines split into depth, operator and details', () => {
  assert.deepEqual(planLine('Results'), { depth: 0, op: 'Results', detail: '' });
  assert.deepEqual(planLine('            Conditional Traverse | (p)-[r:REQUIRES]->(l:Dep)'), { depth: 3, op: 'Conditional Traverse', detail: '(p)-[r:REQUIRES]->(l:Dep)' });
});

test('the schema a run touched is read from the Cypher it ran', () => {
  assert.deepEqual(schemaOf(exposure), {
    labels: ['Repo', 'Team', 'Incident', 'Version', 'Dep', 'Maintainer', 'Package'],
    rels: ['OWNED_BY', 'INVOLVES', 'RESOLVES_TO', 'ADMITS', 'REQUIRES', 'COMPROMISED', 'MAINTAINS', 'OF'],
  });
  assert.deepEqual(schemaOf([]), { labels: [], rels: [] });
});
