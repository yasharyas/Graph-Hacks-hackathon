/* The agent lines on the first screen after a triage (NarrativePanel, AskBox) and the Concentration tab they point at: pure, so
 * node --test covers them. Everything is read from the Report, never invented, and the tab and the "Next qix?" line print the
 * same share from the same function (influenceShares).
 */
import { plural } from '../data/format.ts';
import type { Concentration, IncidentMeta, LlmMode, Report } from '../data/types.ts';

/** npm accounts that are not a person: a bare name would read as one (the Ask answer uses the same gloss). */
export const ACCOUNT_NOTE: Record<string, string> = { types: 'The account that publishes DefinitelyTyped’s @types packages.' };

/** Each maintainer's share of the listed maintainers' combined influence ("43%"), plus a bar width scaled to the top value. */
export function influenceShares(rows: Concentration[]) {
  const total = rows.reduce((n, c) => n + c.influence, 0);
  const top = Math.max(0, ...rows.map((c) => c.influence));
  return rows.map((c) => {
    const p = total > 0 ? (c.influence / total) * 100 : 0;
    return { ...c, share: p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`, bar: top > 0 ? (c.influence / top) * 100 : 0 };
  });
}

type Scoped = Pick<Report, 'concentration' | 'counts' | 'scope'>;

/**
 * "Next qix?": the Concentration tab's first row as one line, "sindresorhus: 43% of top-3 PageRank, reaches 21 of 21 repos".
 * The share is a part of the listed maintainers' combined PageRank (the tab says so), so the line says "top-3", not "of
 * PageRank". null for a pasted repo (the tab is collapsed there: "the next compromised account" is an org question) or no data.
 */
export function nextAccount(r: Scoped): string | null {
  const [first] = influenceShares(r.scope?.kind === 'guest' ? [] : r.concentration);
  if (!first) return null;
  const repos = Object.values(r.counts).reduce((a, b) => a + b, 0); // the tab's own "of N repos"
  const of = r.concentration.length > 1 ? `top-${r.concentration.length} ` : '';
  return `${first.maintainer}: ${first.share} of ${of}PageRank, reaches ${first.reposReached} of ${plural(repos, 'repo')}`;
}

/** The incident as the scenario control names it ("qix", "axios"): the account of the title, else the compromised account. */
export const nextLabel = (i: Pick<IncidentMeta, 'title' | 'maintainer'>): string => `Next ${/^(\S+) npm account takeover/.exec(i.title)?.[1] ?? i.maintainer ?? 'account'}?`;

/** A maintainer to name in the Ask placeholder ("If ljharb were hijacked next, ..."): the runner-up that is a person, not the line's own. */
export const askExample = (r: Scoped): string | null =>
  r.scope?.kind === 'guest' ? null : (r.concentration.slice(1).find((c) => !ACCOUNT_NOTE[c.maintainer]) ?? r.concentration[0])?.maintainer ?? null;

export const askPlaceholder = (maintainer: string | null | undefined): string =>
  maintainer ? `If ${maintainer} were hijacked next, which repos would it reach?` : 'Which exposures are prod-only?';

/** "Analyst pick · LLM live": the label says how the pick was made, from the run's own mode. */
export const pickLabel = (mode: LlmMode): string => `Analyst pick · LLM ${mode === 'replay' ? 'replayed' : 'live'}`;

/** "Payments, Docs, QA +4": the first names of a roster, then how many more. */
export function teamNames(teams: string[], shown = 3): string {
  const rest = teams.length - shown;
  return rest > 0 ? `${teams.slice(0, shown).join(', ')} +${rest}` : teams.join(', ');
}
