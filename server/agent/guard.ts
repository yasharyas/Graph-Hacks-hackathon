// Narrative guard: extracts factual claims from untrusted LLM text and checks each against graph-tool evidence.
// Contract: test/guard.test.ts. One left-to-right tokenizer pass (every alternative starts on a different character,
// no nested quantifiers), then each token is classified by an anchored regex. Tokens are disjoint, so claims never
// overlap and nothing backtracks quadratically, whatever the model emits.
// reach: exposed repos per malicious version, for the note's count-to-version pairing check (narrate.ts).
export type Evidence = { entities: Set<string>; numbers: Set<number>; pathIds: Set<string>; reach?: Map<string, number> };
export type Claim = { text: string; start: number; end: number; kind: 'entity' | 'number' | 'cite'; ok: boolean };

// `one-line backtick span` (no space just inside the ticks, so a stray tick can't pair across prose) | [E<n>] or
// [E1, E2] | 1,234 | any run of name/path/version characters (^ and ~ included for debug@^4.3.5)
const TOKEN = /`(?!\s)([^`\n]+)(?<!\s)`|\[(E\d+(?:\s*,\s*E\d+)*)\]|\d{1,3}(?:,\d{3})+|[\w.@/+~^-]+/g;
const NPM = /^(?:@[\w.-]+\/)?[a-z0-9][\w.-]*@[\^~]?\d[\w.+-]*$/i; // debug@4.4.2, debug@^4.3.5, @ctrl/tinycolor@4.1.1 (not user@example.com)
const REPO = /^(?=[^/]*[a-z])[a-z0-9][a-z0-9-]+\/[\w.-]{2,}$/i; // owner has a letter, both sides 2+ chars: no n/a, w/o, i/o, 24/7
// File paths look like owner/repo; only a known entity with an extension (highlightjs/highlight.js) still counts.
const PATHLIKE = /\.(?:[cm]?js|tsx?|jsx|json|md|ya?ml|css|html|lock)$/i;
// ponytail: stoplist for slash-pairs that look like owner/repo; add words here when prose gets struck.
const PROSE = new Set('and/or yes/no on/off true/false read/write input/output either/or he/she his/her pass/fail client/server ci/cd tcp/ip npm/yarn npm/pnpm yarn/pnpm ui/ux dev/prod w/out pros/cons'.split(' '));
const NOUN = new Set('repo repos repository repositories package packages version versions team teams path paths maintainer maintainers'.split(' '));
const WORDS = new Map('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ').map((w, i) => [w, i + 1]));

export function guard(text: string, ev: Evidence): { verified: number; total: number; flagged: string[]; claims: Claim[] } {
  text = typeof text === 'string' ? text : '';
  const known = new Set([...ev.entities].map((e) => e.toLowerCase()));
  const claims: Claim[] = [];
  const add = (kind: Claim['kind'], t: string, start: number, end: number, ok: boolean) => claims.push({ text: t, start, end, kind, ok });
  // end of a plain token without trailing sentence punctuation ("octo/cat." -> "octo/cat")
  const stop = (m: RegExpExecArray) => {
    let e = m.index + m[0].length;
    while (e > m.index && '.-'.includes(text[e - 1])) e--;
    return e;
  };
  const ms = [...text.matchAll(TOKEN)];
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i], start = m.index;
    if (m[1] !== undefined) {
      const t = m[1].trim();
      if (t) add('entity', t, start, start + m[0].length, known.has(t.toLowerCase()));
      continue;
    }
    if (m[2] !== undefined) {
      if (!m[2].includes(',')) add('cite', m[2], start, start + m[0].length, ev.pathIds.has(m[2]));
      else for (const c of m[2].matchAll(/E\d+/g)) add('cite', c[0], start + 1 + c.index, start + 1 + c.index + c[0].length, ev.pathIds.has(c[0]));
      continue;
    }
    const end = stop(m), tok = text.slice(start, end), low = tok.toLowerCase();
    const n = /^[\d,]+$/.test(tok) ? Number(tok.replace(/,/g, '')) : WORDS.get(low);
    const nx = n === undefined ? undefined : ms[i + 1];
    if (nx && nx[1] === undefined && nx[2] === undefined) {
      const nend = stop(nx);
      if (NOUN.has(text.slice(nx.index, nend).toLowerCase()) && /^\s+$/.test(text.slice(end, nx.index))) {
        add('number', `${tok} ${text.slice(nx.index, nend)}`, start, nend, ev.numbers.has(n!));
        i++;
        continue;
      }
    }
    if (NPM.test(tok) || (REPO.test(tok) && !PROSE.has(low) && (!PATHLIKE.test(tok) || known.has(low)))) add('entity', tok, start, end, known.has(low));
  }
  const bad = claims.filter((c) => !c.ok);
  return { verified: claims.length - bad.length, total: claims.length, flagged: bad.map((c) => c.text), claims };
}
