// Runnable Cypher. FalkorDB takes query parameters as a `CYPHER name=value ...` prefix on the query text (GRAPH.QUERY in
// redis-cli and FalkorDB Browser both accept it), so a copied statement carries the exact values the tool ran it with:
// the RAW params from the tool result (epoch ms, arrays as Cypher lists), never the display strings ("13:30 UTC").
// Pure: node --test covers it.

const PARAM = /\$([A-Za-z_]\w*)/g;
const BARE_KEY = /^[A-Za-z_]\w*$/;

/** The parameter names a statement uses, in first-seen order. */
export const paramNames = (q: string): string[] => [...new Set([...q.matchAll(PARAM)].map((m) => m[1]!))];

/** A value as a Cypher literal: "text" (escaped), numbers, true/false, null, [lists] and {maps}. */
export function literal(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  if (Array.isArray(v)) return `[${v.map(literal).join(', ')}]`;
  if (typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${BARE_KEY.test(k) ? k : `\`${k.replace(/`/g, '``')}\``}: ${literal(x)}`)
      .join(', ')}}`;
  }
  return 'null';
}

/**
 * `CYPHER incident="qix-2025-09-08" at=1757338200000`: the parameters this statement uses, from the tool's own params, else
 * from `fallback` (a value the tool derived inside, like the incident's maintainer). '' when the statement takes none we know.
 */
export function paramPrefix(q: string, params: Record<string, unknown>, fallback: Record<string, unknown> = {}): string {
  const parts = paramNames(q).flatMap((n) => {
    const v = Object.hasOwn(params, n) ? params[n] : fallback[n];
    return v === undefined ? [] : [`${n}=${literal(v)}`];
  });
  return parts.length ? `CYPHER ${parts.join(' ')}` : '';
}

/** The statement as a person can paste it into FalkorDB Browser or redis-cli: the parameter prefix, a space, the query. */
export function runnable(q: string, params: Record<string, unknown>, fallback: Record<string, unknown> = {}): string {
  const p = paramPrefix(q, params, fallback);
  return p ? `${p} ${q}` : q;
}
