// The exposure table's filter, and why it came up empty. "Prod only" alone can empty a table only when every repo that matches
// the rest of the filter is dev-only; any other empty result is just "nothing matches". Pure, so the wording is tested.
import { plural } from './format.ts';
import type { Exposure, Tier } from './types.ts';

export interface RowFilter {
  prodOnly: boolean;
  tier: Tier | 'ALL';
  query: string;
}

type Row = Pick<Exposure, 'repo' | 'team' | 'tier' | 'dev'>;

/** The rows the filter keeps. `ignoreProd`: the same filter with "Prod only" switched off. */
export function filterRows<T extends Row>(exposures: readonly T[], f: RowFilter, ignoreProd = false): T[] {
  const q = f.query.trim().toLowerCase();
  return exposures.filter(
    (e) => (ignoreProd || !f.prodOnly || !e.dev) && (f.tier === 'ALL' || e.tier === f.tier) && (!q || e.repo.toLowerCase().includes(q) || (e.team ?? '').toLowerCase().includes(q)),
  );
}

export type EmptyWhy =
  | { kind: 'none' } // nothing was exposed at all
  | { kind: 'devOnly'; hidden: number; bare: boolean } // "Prod only" hides every match; `bare`: it is the only filter on
  | { kind: 'nomatch' };

/** Why the table shows no rows. Call it only when the filtered list is empty. */
export function whyEmpty(exposures: readonly Row[], f: RowFilter): EmptyWhy {
  if (exposures.length === 0) return { kind: 'none' };
  if (f.prodOnly) {
    const matching = filterRows(exposures, f, true);
    if (matching.length > 0 && matching.every((e) => e.dev)) return { kind: 'devOnly', hidden: matching.length, bare: f.tier === 'ALL' && !f.query.trim() };
  }
  return { kind: 'nomatch' };
}

/** The empty state's words. */
export function emptyCopy(why: EmptyWhy): { title: string; cause: string; action: string } {
  switch (why.kind) {
    case 'none':
      return { title: 'No exposed repos', cause: 'At this clock, no repo reaches a malicious version, and none depends on the compromised account’s packages.', action: '' };
    case 'devOnly':
      return why.bare
        ? { title: 'No prod exposures', cause: 'Every exposed repo here reaches the bad version through dev dependencies only.', action: `Show dev-only (${why.hidden})` }
        : { title: 'No matching prod repos', cause: `The ${plural(why.hidden, 'repo')} matching your search ${why.hidden === 1 ? 'is' : 'are'} dev-only. Turn off Prod only to see ${why.hidden === 1 ? 'it' : 'them'}.`, action: `Show dev-only (${why.hidden})` };
    default:
      return { title: 'No matching repos', cause: 'No repo matches these filters.', action: 'Clear filters' };
  }
}

/** What a screen reader hears when the sort changes. */
export const sortStatus = (label: string, dir: 1 | -1): string => `Sorted by ${label.toLowerCase()}, ${dir === 1 ? 'ascending' : 'descending'}`;
