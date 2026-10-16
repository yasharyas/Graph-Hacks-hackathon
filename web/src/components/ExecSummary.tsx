/* ExecSummary: a one-line strip at the top of the results (docs/design.md section 5), so the table is what a laptop
 * sees first. Props: report (Report), onShare (copies a link; wiring lives in App), marked (repos marked remediated: said
 * beside the exposed count, with the one line that marks are kept for this browser session only).
 * Reads: a stacked tier bar, "N of M exposed", "+N min ahead of the advisory" (only when something is exposed; at a clock
 * before the advisory: "No advisory yet · in hindsight, it came N min after the first exposure"; below 1440px the hindsight
 * half is screen-reader text, so the strip is one row and the band above is not said a third time) and an icon Share button.
 * Past the removal (15:15 for qix) the count is past tense: "1 of 21 exposed until 15:15 UTC". The incident, scope and clock are the band above and the header chip (named here for screen
 * readers only); tier counts by name live in the band (one place, not three); the top maintainers are the
 * Concentration tab. Figures are Satoshi bold with tabular figures.
 * (influenceShares(), the percentages the Concentration tab and the "Next qix?" line share, lives in agent.ts.)
 */
import type { Report } from '../data/types.ts';
import { signedMin, utcLabel } from '../data/format.ts';
import { repoLabel } from '../data/repoLabel.ts';
import { IconButton } from './Button.tsx';
import { LinkIcon } from './icons/Glyphs.tsx';

const TIERS = [
  ['LOCKED', 'bg-tier-locked'],
  ['WOULD_PULL', 'bg-tier-would-pull'],
  ['MAINTAINER', 'bg-tier-maintainer'],
] as const;

export function ExecSummary({ report, onShare, marked = 0 }: { report: Report; onShare: () => void; marked?: number }) {
  const exposed = report.counts.LOCKED + report.counts.WOULD_PULL;
  const total = report.scope?.repos ?? exposed + report.counts.MAINTAINER + report.counts.CLEAN; // repos analysed: the org's, or 1 for a pasted repo
  const ahead = exposed > 0 && report.minutesAhead > 0;
  // As of the clock (docs/decisions.md, rounds 4 and 5): before the advisory there is no advisory to be ahead of; the lead
  // time is a later fact, so it is said as hindsight.
  const before = report.at < report.incident.advisoryAt;
  const gone = exposed > 0 && report.at >= report.incident.removedAt; // npm no longer serves the malicious versions
  return (
    <section aria-label="Executive summary" className="animate-enter flex items-center gap-x-3 border-b border-line-1 py-0.5 pr-1 pl-3">
      <h2 className="sr-only">
        {report.incident.maintainer ?? 'Incident'} at {utcLabel(report.at)}
        {report.scope ? `, ${repoLabel(report.scope.label)}` : ''}
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
              <span className="text-fg-1">
                {' '}
                of {total} exposed{gone ? ` until ${utcLabel(report.incident.removedAt)}` : ''}
              </span>
            </span>
          </dd>
        </div>
        {marked > 0 && (
          <div className="flex items-baseline">
            <dt className="sr-only">Remediation marks</dt>
            <dd className="text-sm text-fg-1">
              <span className="text-tier-clean">{marked} marked remediated.</span> Marks are saved for this browser session only.
            </dd>
          </div>
        )}
        {ahead &&
          (before ? (
            <div className="flex min-w-0 items-baseline">
              <dt className="sr-only">Advisory</dt>
              <dd className="text-sm">
                <b className="font-bold whitespace-nowrap text-fg-0">No advisory yet</b>
                <span className="text-fg-1 max-[1439px]:sr-only">
                  {' '}
                  · in hindsight, it came <span className="tabular-nums">{report.minutesAhead}</span> min after the first exposure
                </span>
              </dd>
            </div>
          ) : (
            <div className="flex items-baseline">
              <dt className="sr-only">Ahead of the advisory</dt>
              <dd className="text-sm whitespace-nowrap">
                <b className="font-bold text-fg-0 tabular-nums">{signedMin(report.minutesAhead)}</b>
                <span className="text-fg-1"> ahead of the advisory</span>
              </dd>
            </div>
          ))}
      </dl>
      <IconButton label="Copy share link" icon={<LinkIcon size={16} />} onClick={onShare} className="shrink-0" />
    </section>
  );
}
