// The slice of a report the exposure table is showing. An export made while a filter is on must hold exactly those repos
// and say so; this module cuts a Report down to a view and words the filter. Pure, so it is tested without a browser.
import type { Notice, Report, Tier } from './types.ts';

/** `repos`: the repo ids the table shows, in its order. `label`: what the filter is, e.g. "prod only, 14 of 21 repos". */
export interface ReportView {
  repos: string[];
  label: string;
}

/** "prod only, tier LOCKED, search "kong", 3 of 21 repos": what is switched on in the table's filter row, then the count. */
export function viewLabel(f: { prodOnly: boolean; tier: Tier | 'ALL'; query: string; shown: number; total: number }): string {
  const q = f.query.trim().replace(/\s+/g, ' ').slice(0, 40);
  return [f.prodOnly && 'prod only', f.tier !== 'ALL' && `tier ${f.tier}`, q && `search "${q}"`, `${f.shown} of ${f.total} repo${f.total === 1 ? '' : 's'}`].filter(Boolean).join(', ');
}

/** A team notice keeps its header and footer and only the repo lines (`- repo: ...`, `- repo (dev-only): ...`) in the view; none left, no notice. */
function scopeNotice(n: Notice, keep: ReadonlySet<string>): Notice[] {
  const lines = n.text.split('\n');
  const repoOf = (l: string) => /^- (\S+?)(?::| \()/.exec(l)?.[1];
  // an older server's one-line notice has no repo lines: it stays when it names a repo of the view
  if (!lines.some((l) => repoOf(l) !== undefined)) return [...keep].some((repo) => n.text.includes(repo)) ? [n] : [];
  const kept = lines.filter((l) => {
    const repo = repoOf(l);
    return repo === undefined || keep.has(repo);
  });
  return lines.some((l) => repoOf(l) !== undefined && keep.has(repoOf(l)!)) ? [{ ...n, text: kept.join('\n') }] : [];
}

/**
 * The report cut down to the view: exposures (in the table's order), paths, fixes, owners, scanner hits and the repo lines
 * of each notice keep only the view's repos; tier counts are recounted for them (CLEAN is 0: a table lists no clean repos).
 * The incident, the clock and the maintainer concentration describe the whole run and stay. `view` records the cut.
 */
export function scopeReport(r: Report, view: ReportView): Report & { view: ReportView & { total: number; outside: number } } {
  const keep = new Set(view.repos);
  const order = new Map(view.repos.map((repo, i) => [repo, i] as const));
  const byView = <T extends { repo: string }>(xs: T[]) => xs.filter((x) => keep.has(x.repo)).sort((a, b) => order.get(a.repo)! - order.get(b.repo)!);
  const exposures = byView(r.exposures);
  const counts: Record<Tier, number> = { LOCKED: 0, WOULD_PULL: 0, MAINTAINER: 0, CLEAN: 0 };
  for (const e of exposures) counts[e.tier]++;
  return {
    ...r,
    counts,
    exposures,
    paths: byView(r.paths),
    remediations: byView(r.remediations),
    scanner: r.scanner.filter((h) => keep.has(h.repo)),
    owners: r.owners.map((o) => ({ ...o, repos: o.repos.filter((x) => keep.has(x)) })).filter((o) => o.repos.length > 0),
    notices: r.notices.flatMap((n) => scopeNotice(n, keep)),
    // `outside`: repos the table showed that this run does not list (the scrubber was on another clock than the run)
    view: { label: view.label, repos: exposures.map((e) => e.repo), total: r.exposures.length, outside: view.repos.length - exposures.length },
  };
}
