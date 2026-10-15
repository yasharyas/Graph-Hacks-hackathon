/* ExecSummary: a one-line strip at the top of the results (docs/design.md section 5), so the table is what a laptop
 * sees first. Props: report (Report), onShare (copies a link; wiring lives in App).
 * Reads: a stacked tier bar, "N of M exposed", "+N min ahead of the advisory" (only when something is exposed) and an
 * icon Share button. The incident, scope and clock are the band above and the header chip (named here for screen
 * readers only); tier counts by name live in the band (one place, not three); the top maintainers are the
 * Concentration tab. Figures are Satoshi bold with tabular figures.
 * Also exports influenceShares(), shared with InsightTabs so both views print the same percentages.
 */
import type { Concentration, Report } from '../data/types.ts';
import { signedMin, utcLabel } from '../data/format.ts';
import { IconButton } from './Button.tsx';
import { LinkIcon } from './icons/Glyphs.tsx';

const TIERS = [
  ['LOCKED', 'bg-tier-locked'],
  ['WOULD_PULL', 'bg-tier-would-pull'],
  ['MAINTAINER', 'bg-tier-maintainer'],
] as const;

/** Each maintainer's share of the listed maintainers' combined influence ("43%"), plus a bar width scaled to the top value. */
export function influenceShares(rows: Concentration[]) {
  const total = rows.reduce((n, c) => n + c.influence, 0);
  const top = Math.max(0, ...rows.map((c) => c.influence));
  return rows.map((c) => {
    const p = total > 0 ? (c.influence / total) * 100 : 0;
    return { ...c, share: p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`, bar: top > 0 ? (c.influence / top) * 100 : 0 };
  });
}

export function ExecSummary({ report, onShare }: { report: Report; onShare: () => void }) {
  const exposed = report.counts.LOCKED + report.counts.WOULD_PULL;
  const total = report.scope?.repos ?? exposed + report.counts.MAINTAINER + report.counts.CLEAN; // repos analysed: the org's, or 1 for a pasted repo
  const ahead = exposed > 0 && report.minutesAhead > 0;
  return (
    <section aria-label="Executive summary" className="animate-enter flex items-center gap-x-3 border-b border-line-1 py-0.5 pr-1 pl-3">
      <h2 className="sr-only">
        {report.incident.maintainer ?? 'Incident'} at {utcLabel(report.at)}
        {report.scope ? `, ${report.scope.label}` : ''}
      </h2>
      <dl className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-0.5">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Exposed repos by tier</dt>
          <dd className="flex items-center gap-2">
            <span className="flex h-2 w-12 shrink-0 gap-px overflow-hidden rounded-xs bg-bg-3" aria-hidden>
              {TIERS.map(([t, bg]) => (
                <span key={t} className={bg} style={{ flexGrow: report.counts[t] }} />
              ))}
            </span>
            <span className="text-sm whitespace-nowrap text-fg-0 tabular-nums">
              <b className="font-bold">{exposed}</b>
              <span className="text-fg-1"> of {total} exposed</span>
            </span>
          </dd>
        </div>
        {ahead && (
          <div className="flex items-baseline">
            <dt className="sr-only">Ahead of the advisory</dt>
            <dd className="text-sm whitespace-nowrap">
              <b className="font-bold text-fg-0 tabular-nums">{signedMin(report.minutesAhead)}</b>
              <span className="text-fg-1"> ahead of the advisory</span>
            </dd>
          </div>
        )}
      </dl>
      <IconButton label="Copy share link" icon={<LinkIcon size={16} />} onClick={onShare} className="shrink-0" />
    </section>
  );
}
