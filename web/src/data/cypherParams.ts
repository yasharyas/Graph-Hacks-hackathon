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
 * Parameters this page can never know, given as a clearly marked placeholder so the statement still parses and runs (and
 * says why it finds nothing) instead of failing with "Missing parameters": recall_triage's $session is the visitor's own
 * session id, an httpOnly cookie.
 */
export const PRIVATE: Record<string, string> = { session: '<private: your session id is an httpOnly cookie this page cannot read>' };

/**
 * `CYPHER incident="qix-2025-09-08" at=1757338200000`: the parameters this statement uses, from the tool's own params, else
 * from `fallback` (a value the tool derived inside, like the incident's maintainer), else a PRIVATE placeholder. '' when the
 * statement takes none we know.
 */
export function paramPrefix(q: string, params: Record<string, unknown>, fallback: Record<string, unknown> = {}): string {
  const parts = paramNames(q).flatMap((n) => {
    const v = Object.hasOwn(params, n) ? params[n] : Object.hasOwn(fallback, n) ? fallback[n] : PRIVATE[n];
    return v === undefined ? [] : [`${n}=${literal(v)}`];
  });
  return parts.length ? `CYPHER ${parts.join(' ')}` : '';
}

/** The statement as a person can paste it into FalkorDB Browser or redis-cli: the parameter prefix, a space, the query. */
export function runnable(q: string, params: Record<string, unknown>, fallback: Record<string, unknown> = {}): string {
  const p = paramPrefix(q, params, fallback);
  return p ? `${p} ${q}` : q;
}

export interface CypherEntry {
  tool: string;
  q: string;
  params: Record<string, unknown>;
  /** Its place in its tool call's statements ("query 2 of 5"), when the call ran more than one. */
  n?: number;
  of?: number;
}

/**
 * Several statements as one text that is honest about how FalkorDB takes them: ONE statement per query (pasted together,
 * GRAPH.QUERY answers "query with more than one statement is not supported"). Each statement ends with ";" after a blank
 * line, and carries a `//` line naming it and saying to run it on its own. FalkorDB refuses a comment before the CYPHER
 * prefix (checked with GRAPH.RO_QUERY), so the comment goes after the prefix line, or after the query's first line when it
 * takes no parameters; every block, selected on its own, runs as is. An exact repeat of a statement (21 explain_path calls)
 * is listed once, with the first call's values and how many times it ran.
 */
export function cypherScript(entries: readonly CypherEntry[], fallback: Record<string, unknown> = {}): string {
  const groups = new Map<string, { e: CypherEntry; times: number }>();
  for (const e of entries) {
    const g = groups.get(e.q);
    if (g) g.times++;
    else groups.set(e.q, { e, times: 1 });
  }
  const all = [...groups.values()];
  return all
    .map(({ e, times }, i) => {
      const note = [
        `// ${e.tool}${e.of && e.of > 1 ? ` query ${e.n} of ${e.of}` : ''}`,
        all.length > 1 ? `statement ${i + 1} of ${all.length}` : null,
        times > 1 ? `ran ${times} times, these are the first call's values` : null,
        'FalkorDB runs one statement per query: run this one on its own',
      ]
        .filter(Boolean)
        .join(' · ');
      const prefix = paramPrefix(e.q, e.params, fallback);
      const lines = e.q.split('\n');
      const body = prefix ? [prefix, note, ...lines] : lines.length > 1 ? [lines[0]!, note, ...lines.slice(1)] : [e.q, note, ''];
      return `${body.join('\n')};`;
    })
    .join('\n\n');
}
