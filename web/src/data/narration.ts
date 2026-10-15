// Narration text -> typed segments. The text is untrusted (an LLM read hostile lockfile names), so the UI must not
// believe it: a span is "verified" only if the server's guard listed that exact text with ok=true. A backticked
// span the guard did not list stays plain; one it rejected is struck. Pure: the component only renders segments.
//
// Also here (pure, so node --test covers them): markdown stripping (the UI never shows raw markdown), the coverage
// line the server appends to Ask answers, and the claim -> tool call lookup behind every clickable claim.
export interface GuardClaims {
  claims: { text: string; ok: boolean }[];
  flagged: string[];
}
export type Verdict = 'verified' | 'flagged' | 'plain';
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; text: string; verdict: Verdict; first: boolean } // `backticked`; first = first mention in this narration
  | { kind: 'cite'; id: string; verdict: Verdict } // [E1] or each id in [E1, E2]
  | { kind: 'struck'; text: string }; // an unverified claim written in prose, e.g. "47 repos"

const TOKEN = /(`[^`\n]+`|\[E\d+(?:\s*,\s*E\d+)*\])/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Plain text for a stretch with no backticked entity in it: no bold, stray asterisks or a dangling backtick (a cut-off answer). */
const plainPart = (s: string): string => s.replace(/__([^_\n]+)__/g, '$1').replace(/[*`]/g, '');
/** Line-start markdown: heading hashes and list bullets. */
const lead = (l: string): string => l.replace(/^(?:#{1,6}[ \t]+|[-*•][ \t]+)/, '');

/** Strips markdown from a whole text (entities in backticks are kept as written, minus the backticks). */
export const stripMarkdown = (text: string): string =>
  text
    .split('\n')
    .map((l) => lead(l.trim()))
    .join('\n')
    .split(TOKEN)
    .map((p, i) => (i % 2 ? p.replace(/`/g, '') : plainPart(p)))
    .join('');

export function segments(text: string, guard: GuardClaims | null, seen: Set<string> = new Set()): Segment[] {
  const ok = new Set(guard?.claims.filter((c) => c.ok).map((c) => c.text));
  const bad = new Set([...(guard?.claims.filter((c) => !c.ok).map((c) => c.text) ?? []), ...(guard?.flagged ?? [])]);
  const verdict = (t: string): Verdict => (bad.has(t) ? 'flagged' : ok.has(t) ? 'verified' : 'plain');
  // Prose claims the guard rejected (not backticked, not [E#]) are struck where they appear.
  const prose = [...bad].filter((t) => t.length > 1).sort((a, b) => b.length - a.length);
  const proseRe = prose.length ? new RegExp(`(?<![\\w@/.+~^-])(${prose.map(escape).join('|')})(?![\\w@/+~^-])`) : null;

  return text.split(TOKEN).flatMap((part, i): Segment[] => {
    if (i % 2 === 0) {
      const clean = plainPart(part);
      if (!clean) return [];
      return proseRe ? clean.split(proseRe).flatMap((s, j): Segment[] => (!s ? [] : j % 2 ? [{ kind: 'struck', text: s }] : [{ kind: 'text', text: s }])) : [{ kind: 'text', text: clean }];
    }
    if (part.startsWith('`')) {
      const t = part.slice(1, -1).trim();
      const v = verdict(t);
      const first = v === 'flagged' || !seen.has(t); // a flagged claim is always shown struck, wherever it repeats
      seen.add(t);
      return [{ kind: 'entity', text: t, verdict: v, first }];
    }
    return [...part.matchAll(/E\d+/g)].flatMap((m, j): Segment[] => [...(j ? [{ kind: 'text' as const, text: ' ' }] : []), { kind: 'cite', id: m[0], verdict: verdict(m[0]) }]);
  });
}

const LABEL = /^[*_#\s]*(Verdict|Why|Notify|Do)\s*[*_]*\s*:\s*[*_]*\s*/; // tolerates "**Verdict:**" and "## Do:"
/** One narration as lines: "Verdict: ..." / "Why: ..." / "Notify: ..." / "Do: ..." split into label and body, anything else is a plain line. */
export function lines(text: string, guard: GuardClaims | null): { label: string | null; segs: Segment[] }[] {
  const seen = new Set<string>(); // chips are first mentions across the whole narration, not per line
  return text
    .split('\n')
    .map((l) => lead(l.trim()))
    .filter(Boolean)
    .map((l) => {
      const m = LABEL.exec(l);
      return { label: m ? m[1]! : null, segs: segments(m ? l.slice(m[0].length) : l, guard, seen) };
    });
}

/** More verified names than this in one line is a list, not a sentence: the chips would be a wall, so the line uses the light treatment. */
export const LIST_MAX = 4;
export const crowded = (segs: Segment[]): boolean => segs.filter((s) => s.kind === 'entity' && s.verdict === 'verified' && s.first).length > LIST_MAX;

/** Above each Ask answer: how it was produced, so a person can tell a graph lookup from a model's words. */
export function answerLabel(n: { mode: 'live' | 'replay' | 'template'; provider: string | null }): string {
  const by = n.provider ? ` · ${n.provider}` : '';
  return n.mode === 'template' ? `Answered from the graph${by}` : `${n.mode === 'replay' ? 'Recorded LLM answer' : 'LLM answer'} · names and numbers checked against the graph${by}`;
}

/** The server appends a coverage line to enumerating Ask answers ("6 of 14 prod-only repos listed"): split it off so it can be shown on its own. */
export function splitCoverage(text: string): { body: string; coverage: string | null } {
  const ls = text.trimEnd().split('\n');
  const last = (ls.at(-1) ?? '').trim();
  const plain = stripMarkdown(last);
  if (ls.length > 1 && /\b\d[\d,]*\s+of\s+\d[\d,]*\b/i.test(plain) && plain.length <= 240 && !LABEL.test(last)) {
    return { body: ls.slice(0, -1).join('\n').trimEnd(), coverage: plain.replace(/^coverage\s*:\s*/i, '') };
  }
  return { body: text, coverage: null };
}

// ── claim -> tool call ─────────────────────────────────────────────────────────────────────────────────────────
// The structural bits of a tool card this file needs (ToolCardState satisfies it).
export interface ProofCard {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  result?: { summary: string; rows: Record<string, unknown>[]; evidence: string[]; cypher?: string[]; ms?: number };
}

const holds = (v: unknown, entity: string): boolean => v === entity || (Array.isArray(v) && v.includes(entity));

/**
 * The tool call (and result row) that backs a claim. Best match wins, ties go to the earlier card: an [E#] id is the
 * explain_path row that carries it; otherwise a row whose first column is the entity (that card is about it), then
 * any row that holds it, then the card's evidence, arguments or summary. null when no card returned it.
 */
export function proofFor<C extends ProofCard>(entity: string, cards: readonly C[]): { card: C; row: number | null } | null {
  let best: { card: C; row: number | null; score: number } | null = null;
  for (const card of cards) {
    const r = card.result;
    if (!r) continue;
    let row: number | null = null;
    let score = 0;
    if (/^E\d+$/.test(entity)) {
      const i = r.rows.findIndex((x) => x.id === entity);
      if (i >= 0) [row, score] = [i, 4];
    } else {
      for (let i = 0; i < r.rows.length && score < 3; i++) {
        const vals = Object.values(r.rows[i]!);
        const at = vals.findIndex((v) => holds(v, entity));
        const s = at < 0 ? 0 : at === 0 ? 3 : 2;
        if (s > score) [row, score] = [i, s];
      }
      if (!score && (r.evidence.includes(entity) || Object.values(card.params).some((v) => holds(v, entity)))) score = 1;
      if (!score && new RegExp(`(?<![\\w@/.-])${escape(entity)}(?![\\w@/-])`).test(r.summary)) score = 1;
    }
    if (score > (best?.score ?? 0)) best = { card, row, score };
  }
  return best && { card: best.card, row: best.row };
}

/** Every verified claim grouped by the tool call that backs it, in feed order, plus claims no single card returned (counts, ids). */
export function claimMap<C extends ProofCard>(claims: GuardClaims['claims'], cards: readonly C[]): { groups: { card: C; claims: string[] }[]; unmatched: string[] } {
  const groups = new Map<C, string[]>();
  const unmatched: string[] = [];
  for (const text of new Set(claims.filter((c) => c.ok).map((c) => c.text))) {
    const hit = proofFor(text, cards);
    if (!hit) unmatched.push(text);
    else groups.set(hit.card, [...(groups.get(hit.card) ?? []), text]);
  }
  return { groups: [...groups].sort(([a], [b]) => cards.indexOf(a) - cards.indexOf(b)).map(([card, cl]) => ({ card, claims: cl })), unmatched };
}
