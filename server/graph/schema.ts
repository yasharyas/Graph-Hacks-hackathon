// Indexes and unique constraints (docs/contracts.md). Run on the registry before any bulk write, so every
// GRAPH.COPY of it starts with them.
import { ConstraintType, EntityType } from 'falkordb';
import { db, write } from './client.ts';

const INDEXES = [['Dep', 'id'], ['Dep', 'repo'], ['Dep', 'name'], ['Version', 'id'], ['Version', 'name'], ['Package', 'name'], ['Maintainer', 'name'], ['Repo', 'id'], ['Incident', 'id']];
const UNIQUE = [['Dep', 'id'], ['Version', 'id']];

export async function createSchema(name: string) {
  for (const [label, prop] of INDEXES) await write(name, `CREATE INDEX FOR (n:${label}) ON (n.${prop})`);
  const g = (await db()).selectGraph(name);
  for (const [label, prop] of UNIQUE) await g.constraintCreate(ConstraintType.UNIQUE, EntityType.NODE, label, prop);
}
