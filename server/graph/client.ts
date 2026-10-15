// FalkorDB connection, graph naming and the two ways in: `graph(name).ro` (GRAPH.RO_QUERY, as pz_ro when
// PZ_RO_PASSWORD is set) for every tool, and `write` (GRAPH.QUERY, default user) for ingest and triage memory.
import { createHash } from 'node:crypto';
import { FalkorDB, type Graph as FGraph } from 'falkordb';
import type { ScenarioId } from '../../shared/events.ts';
import type { Graph } from '../tools/types.ts';

const connect = (username?: string, password?: string) =>
  FalkorDB.connect({ host: process.env.FALKOR_HOST || '127.0.0.1', port: Number(process.env.FALKOR_PORT || 6380), username, password });
let rwDb: Promise<FalkorDB> | undefined;
let roDb: Promise<FalkorDB> | undefined;
export const db = () => (rwDb ??= connect(undefined, process.env.REDIS_PASSWORD || 'devpass'));
const reader = () => (roDb ??= process.env.PZ_RO_PASSWORD ? connect('pz_ro', process.env.PZ_RO_PASSWORD) : db());

// "Query internal execution time: 0.42 milliseconds" -> 0.42
export const execMs = (metadata: string[] = []) => Number(metadata.join(' ').match(/internal execution time: ([\d.]+)/)?.[1] ?? 0);
const opts = (params: Record<string, unknown>) => ({ params }) as Parameters<FGraph['query']>[1];

export function graph(name: string): Graph {
  return {
    name,
    async ro(cypher, params = {}) {
      const r = await (await reader()).selectGraph(name).roQuery<Record<string, unknown>>(cypher, opts(params));
      return { rows: r.data ?? [], ms: execMs(r.metadata) };
    },
  };
}

export async function write(name: string, cypher: string, params: Record<string, unknown> = {}) {
  const r = await (await db()).selectGraph(name).query<Record<string, unknown>>(cypher, opts(params));
  return { rows: r.data ?? [], ms: execMs(r.metadata) };
}

// Graph names are built here only, from fixed parts and a hash: never from user text (S3).
const SHORT: Record<string, string> = { 'qix-2025-09-08': 'qix', 'axios-2026-03-31': 'axios' };
function short(s: ScenarioId) {
  if (!Object.hasOwn(SHORT, s)) throw new Error('Unknown scenario');
  return SHORT[s];
}
export const registryGraph = (prefix = 'pz') => `${prefix}_registry`;
export const orgGraph = (s: ScenarioId, prefix = 'pz') => `${prefix}_acme_${short(s)}`;
export const guestGraph = (key: string, s: ScenarioId) => `pz_guest_${createHash('sha256').update(key).digest('hex').slice(0, 12)}_${short(s)}`;

export async function close() {
  const all = [...new Set([rwDb, roDb])].filter((x) => x !== undefined);
  rwDb = roDb = undefined;
  await Promise.all(all.map(async (p) => (await p).close()));
}
