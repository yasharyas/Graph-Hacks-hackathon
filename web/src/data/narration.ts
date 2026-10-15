// Narration text -> typed segments. The text is untrusted (an LLM read hostile lockfile names), so the UI must not
// believe it: a span is "verified" only if the server's guard listed that exact text with ok=true. A backticked
// span the guard did not list stays plain; one it rejected is struck. Pure: the component only renders segments.
export interface GuardClaims {
  claims: { text: string; ok: boolean }[];
  flagged: string[];
}
export type Verdict = 'verified' | 'flagged' | 'plain';
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; text: string; verdict: Verdict } // `backticked`
  | { kind: 'cite'; id: string; verdict: Verdict } // [E1] or each id in [E1, E2]
  | { kind: 'struck'; text: string }; // an unverified claim written in prose, e.g. "47 repos"

const TOKEN = /(`[^`\n]+`|\[E\d+(?:\s*,\s*E\d+)*\])/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function segments(text: string, guard: GuardClaims | null): Segment[] {
  const ok = new Set(guard?.claims.filter((c) => c.ok).map((c) => c.text));
  const bad = new Set([...(guard?.claims.filter((c) => !c.ok).map((c) => c.text) ?? []), ...(guard?.flagged ?? [])]);
  const verdict = (t: string): Verdict => (bad.has(t) ? 'flagged' : ok.has(t) ? 'verified' : 'plain');
  // Prose claims the guard rejected (not backticked, not [E#]) are struck where they appear.
  const prose = [...bad].filter((t) => t.length > 1).sort((a, b) => b.length - a.length);
  const proseRe = prose.length ? new RegExp(`(?<![\\w@/.+~^-])(${prose.map(escape).join('|')})(?![\\w@/+~^-])`) : null;

  return text.split(TOKEN).flatMap((part, i): Segment[] => {
    if (i % 2 === 0) {
      if (!part) return [];
      return proseRe ? part.split(proseRe).flatMap((s, j): Segment[] => (!s ? [] : j % 2 ? [{ kind: 'struck', text: s }] : [{ kind: 'text', text: s }])) : [{ kind: 'text', text: part }];
    }
    if (part.startsWith('`')) {
      const t = part.slice(1, -1).trim();
      return [{ kind: 'entity', text: t, verdict: verdict(t) }];
    }
    return [...part.matchAll(/E\d+/g)].flatMap((m, j): Segment[] => [...(j ? [{ kind: 'text' as const, text: ' ' }] : []), { kind: 'cite', id: m[0], verdict: verdict(m[0]) }]);
  });
}
