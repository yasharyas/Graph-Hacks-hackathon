// FalkorDB connection, graph naming and the two ways in: `graph(name).ro` (GRAPH.RO_QUERY) for every tool, and
// `write` (GRAPH.QUERY) for ingest and triage memory. With FALKOR_ACL=1 (set by start.sh once it has created the ACL
// users) reads run as pz_ro and writes as pz_rw; without it (dev, bake) both use the default user (S8).
import { createHash } from 'node:crypto';
import { FalkorDB, type Graph as FGraph } from 'falkordb';
import type { ScenarioId } from '../../shared/events.ts';
import type { Graph } from '../tools/types.ts';

const secret = (name: string) => {
  const v = process.env[name];
  if (v) return v;
  if (process.env.NODE_ENV === 'production') throw new Error(`${name} is required`);
  return 'devpass'; // dev container only (docker run … --requirepass devpass)
};
const connect = (username?: string, password?: string) =>
  FalkorDB.connect({ host: process.env.FALKOR_HOST || '127.0.0.1', port: Number(process.env.FALKOR_PORT || 6380), username, password });
const acl = () => process.env.FALKOR_ACL === '1';
let rwDb: Promise<FalkorDB> | undefined;
let roDb: Promise<FalkorDB> | undefined;
export const db = () => (rwDb ??= acl() ? connect('pz_rw', secret('PZ_RW_PASSWORD')) : connect(undefined, secret('REDIS_PASSWORD')));
const reader = () => (roDb ??= acl() ? connect('pz_ro', secret('PZ_RO_PASSWORD')) : db());

// "Query internal execution time: 0.42 milliseconds" -> 0.42
export const execMs = (metadata: string[] = []) => Number(metadata.join(' ').match(/internal execution time: ([\d.]+)/)?.[1] ?? 0);

// S3: the falkordb client inlines params into the query text (`CYPHER k=v …`) and escapes strings but NOT map keys,
// so only plain data may pass: identifier keys and string / finite number / boolean / null leaves.
const KEY = /^[A-Za-z_]\w{0,63}$/;
export function assertSafeParams(v: unknown, depth = 0): void {
  if (depth > 8) throw new Error('Unsafe query params: nested too deep');
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return;
  if (Array.isArray(v)) {
    for (const x of v) assertSafeParams(x, depth + 1);
    return;
  }
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    for (const [k, x] of Object.entries(v as object)) {
      if (!KEY.test(k)) throw new Error('Unsafe query params: bad key');
      assertSafeParams(x, depth + 1);
    }
    return;
  }
  throw new Error('Unsafe query params: bad value');
}
const opts = (params: Record<string, unknown>) => (assertSafeParams(params), { params }) as Parameters<FGraph['query']>[1];

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

// GRAPH.EXPLAIN (as pz_ro) has no params argument, so they ride in FalkorDB's `CYPHER k=v` prefix.
// Only fixed, server-chosen sample values come through here (GET /api/plan), never request data.
export async function explain(name: string, cypher: string, params: Record<string, string | number | string[]>): Promise<string[]> {
  const prefix = Object.entries(params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
  return (await reader()).selectGraph(name).explain(`CYPHER ${prefix} ${cypher}`);
}
