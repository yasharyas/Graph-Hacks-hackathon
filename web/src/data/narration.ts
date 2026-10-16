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

// Tolerates "**Verdict:**", "## Do:" and a pasted repo's "Verdict (its package-lock.json at commit 5f8e8a8 ...):", whose
// parenthetical is where the verdict came from: it is kept apart (`source`) so the label is still "Verdict".
const LABEL = /^[*_#\s]*(Verdict|Why|Notify|Do)\s*(?:\(([^()]*)\)\s*)?(?:[*_]+\s*)?:\s*[*_]*\s*/; // no two adjacent \s* runs: linear
/** One narration as lines: "Verdict: ..." / "Why: ..." / "Notify: ..." / "Do: ..." split into label and body, anything else is a plain line. */
export function lines(text: string, guard: GuardClaims | null): { label: string | null; source: string | null; segs: Segment[] }[] {
  const seen = new Set<string>(); // chips are first mentions across the whole narration, not per line
  return text
    .split('\n')
    .map((l) => lead(l.trim()))
    .filter(Boolean)
    .map((l) => {
      const m = LABEL.exec(l);
      return { label: m ? m[1]! : null, source: m?.[2]?.trim() || null, segs: segments(m ? l.slice(m[0].length) : l, guard, seen) };
    });
}

/**
 * The Why line as whole path sentences: "`a/b` locks `debug@4.4.2` through `express@5.1.0` [E1]; `c/d` declares ..." breaks
 * at each "; " that is followed by a name (the next path), never inside a parenthetical like "(paths for 3 of 21; +18 more
 * in the table)". Each piece is its own line, so the "; " between them goes (left at a line's end after a name it read as a
 * stray "chalk@5.6.1 ;"). Presentation only: chips and claim checks are unchanged.
 */
export function whyParts(segs: Segment[]): Segment[][] {
  const out: Segment[][] = [[]];
  segs.forEach((s, i) => {
    const next = segs[i + 1];
    if (s.kind === 'text' && next?.kind === 'entity' && /; $/.test(s.text)) {
      if (s.text.length > 2) out.at(-1)!.push({ kind: 'text', text: s.text.slice(0, -2) });
      out.push([]);
      return;
    }
    out.at(-1)!.push(s);
  });
  return out.filter((p) => p.length > 0);
}

/** How many evidence ids ([E2]) a set of segments carries: what a folded Why hides, so the disclosure can say it. */
export const citeCount = (parts: Segment[][]): number => parts.flat().filter((s) => s.kind === 'cite').length;

/** More verified names than this in one line is a list, not a sentence: the chips would be a wall, so the line uses the light treatment. */
export const LIST_MAX = 4;
export const crowded = (segs: Segment[]): boolean => segs.filter((s) => s.kind === 'entity' && s.verdict === 'verified' && s.first).length > LIST_MAX;

// The Verdict is one long paragraph: a headline, then one sentence per tier. It is shown as lines by breaking the SAME
// segments before each tier sentence (presentation only: the text, its chips and the claim checks are unchanged, and the
// pieces join back to the identical text).
const VERDICT_BREAK = / (?=LOCKED, |WOULD_PULL, |Marked remediated:)/;
export function verdictLines(segs: Segment[]): Segment[][] {
  const out: Segment[][] = [[]];
  for (const s of segs) {
    if (s.kind !== 'text') {
      out.at(-1)!.push(s);
      continue;
    }
    const parts = s.text.split(VERDICT_BREAK);
    parts.forEach((p, i) => {
      if (i) out.push([]);
      const text = i < parts.length - 1 ? `${p} ` : p; // the space the break consumed stays at the end of the line before
      if (text) out.at(-1)!.push({ kind: 'text', text });
    });
  }
  return out.filter((l) => l.length > 0);
}

/**
 * In a roster line ("`QA`: `mochajs/mocha`, ...; `CLI` (`#team-cli`): ..."), the entities that open a team's group: each
 * starts its own line, so an enumerating answer reads as one row per team instead of a wall of names.
 */
export function teamStarts(segs: Segment[]): Set<number> {
  const out = new Set<number>();
  const text = (i: number) => {
    const s = segs[i];
    return s?.kind === 'text' ? s.text : null;
  };
  segs.forEach((s, i) => {
    if (s.kind !== 'entity') return;
    if (text(i + 1)?.startsWith(':') || (text(i + 1) === ' (' && segs[i + 2]?.kind === 'entity' && text(i + 3)?.startsWith('):'))) out.add(i);
  });
  return out;
}

/** What the feed's live region says when an Ask answer lands: the answer itself in plain words, cut at a sentence near `max` characters. */
export function spokenAnswer(text: string, max = 280): string {
  const plain = stripMarkdown(text)
    .replace(/\s*\[E\d+(?:\s*,\s*E\d+)*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return `${end > max / 3 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`} The full answer is in the feed.`;
}

/** Model-written Ask answers a triage allows (server/agent/ask.ts MAX_ANSWERS); graph answers and refusals are free. */
export const MAX_ANSWERS = 4;
/** Above each Ask answer: how it was produced, so a person can tell a graph lookup from a model's words. */
export function answerLabel(n: { mode: 'live' | 'replay' | 'template'; provider: string | null; unanswered?: boolean; used?: number }): string {
  if (n.unanswered) return (n.used ?? 0) >= MAX_ANSWERS ? `Not answered: this triage’s ${MAX_ANSWERS} model answers are used` : 'Not answered: no language model is available';
  const by = n.provider ? ` · ${n.provider}` : '';
  return n.mode === 'template' ? `Answered from the graph${by}` : `${n.mode === 'replay' ? 'Recorded LLM answer' : 'LLM answer'}: the model wrote the words${by}`;
}

/**
 * The claim-check line under a narration. A graph answer (template) is checked claim by claim; a model's answer is not
 * verified prose: the check only found its names and numbers in the graph results, and it says so.
 */
export function guardLine(g: { verified: number; total: number }, modelWords: boolean): string {
  return modelWords
    ? `${g.verified} of ${g.total} names and numbers found in the graph results; the wording is the model’s`
    : `${g.verified} of ${g.total === 1 ? '1 claim' : `${g.total} claims`} traced to a graph query`;
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
