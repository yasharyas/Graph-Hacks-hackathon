// What a tool card shows about its Cypher: one labelled block per statement ("2/5 · Incident · RESOLVES_TO"), and which
// statement a GRAPH.EXPLAIN plan belongs to. The server explains each tool's main query only (GET /api/plan takes a
// tool, never a statement), so the plan is matched to the statement it describes by the node labels and relationship
// types it touches, instead of being pinned to a block that did not produce it. Pure: node --test covers it.
export interface Statement {
  n: number; // 1-based
  of: number;
  label: string;
  text: string;
}

const NODE = /\(\s*[\w@]*\s*:\s*(\w+)/g; // (r:Repo)  (:Incident {..})  (@anon_0:Incident)
const REL = /\[\s*\w*\s*:\s*(\w+(?:\|\w+)*)/g; // [:OWNED_BY]  [r:REQUIRES]
const unique = <T>(xs: T[]) => [...new Set(xs)];
const labelsOf = (s: string) => [...s.matchAll(NODE)].map((m) => m[1]!);
const relsOf = (s: string) => unique([...s.matchAll(REL)].flatMap((m) => m[1]!.split('|')));
/** Labels and relationship types a statement or plan touches. */
const touched = (s: string) => new Set([...labelsOf(s), ...relsOf(s)]);

/** "Incident · RESOLVES_TO": the pattern's first node label, then the relationship types it walks (the generic ones add nothing). */
export function labelOf(q: string): string {
  const all = relsOf(q);
  const specific = all.filter((r) => r !== 'OF' && r !== 'INVOLVES');
  const rels = specific.length ? specific : all;
  return [labelsOf(q)[0], rels.slice(0, 2).join(' + ')].filter(Boolean).join(' · ') || 'query';
}

/** Node labels and relationship types a set of statements touches, in first-seen order: the schema this run actually used. */
export function schemaOf(cypher: readonly string[]): { labels: string[]; rels: string[] } {
  const all = cypher.join('\n');
  return { labels: unique(labelsOf(all)), rels: relsOf(all) };
}

export const statements = (cypher: readonly string[]): Statement[] => cypher.map((text, i) => ({ n: i + 1, of: cypher.length, label: labelOf(text), text }));

/**
 * Index of the statement a plan explains, or null when none fits. A plan fits a statement when every label and
 * relationship type in the plan is one the statement mentions; the tightest fit wins, ties go to the earlier one.
 * A single-statement tool needs no matching.
 */
export function planFor(plan: readonly string[], cypher: readonly string[]): number | null {
  if (cypher.length === 1) return 0;
  const p = touched(plan.join('\n'));
  if (!p.size) return null;
  let best: { i: number; fit: number } | null = null;
  cypher.forEach((q, i) => {
    const s = touched(q);
    if (![...p].every((t) => s.has(t))) return;
    const fit = p.size / s.size;
    if (fit > (best?.fit ?? 0)) best = { i, fit };
  });
  return (best as { i: number } | null)?.i ?? null;
}

/** A GRAPH.EXPLAIN line as depth + operator + details: "    Conditional Traverse | (a)-[r]->(b)". */
export function planLine(line: string): { depth: number; op: string; detail: string } {
  const m = /^( *)(.*?)(?: \| (.*))?$/.exec(line)!;
  return { depth: Math.floor(m[1]!.length / 4), op: m[2]!, detail: m[3] ?? '' };
}
