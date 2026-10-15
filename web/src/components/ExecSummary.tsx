/* ExecSummary: top of the results (docs/design.md section 5); also the future 1200x630 share card.
 * Props: report (Report), onShare (copies a link; wiring lives in App).
 * Three figures in one <dl>: exposed repos by tier (stacked bar + numbers), minutes ahead of the advisory,
 * top-3 maintainer concentration (each maintainer's share of the combined influence, bars scaled to the top value).
 * Every number is read from the report: counts.*, minutesAhead, at, concentration[].influence. Figures are Satoshi
 * bold with tabular figures (Cabinet Grotesk has no tnum), the clock is Martian Mono; Cabinet only sets the title.
 * Also exports influenceShares(), shared with InsightTabs so both views print the same percentages.
 */
import type { Concentration, Report } from '../data/types.ts';
import { signedMin, utcLabel } from '../data/format.ts';
import { Button } from './Button.tsx';
import { LinkIcon } from './icons/Glyphs.tsx';

const TIERS = [
  ['LOCKED', 'bg-tier-locked', 'text-tier-locked'],
  ['WOULD_PULL', 'bg-tier-would-pull', 'text-tier-would-pull'],
  ['MAINTAINER', 'bg-tier-maintainer', 'text-tier-maintainer'],
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
  const exposed = TIERS.reduce((n, [t]) => n + report.counts[t], 0);
  const top = influenceShares(report.concentration.slice(0, 3));
  return (
    <section aria-label="Executive summary" className="animate-enter @container m-3 rounded-md border border-line-2 bg-bg-1 p-4">
      <header className="flex items-start justify-between gap-3">
        <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-fg-0">
          <span className="font-display text-xl font-extrabold">{report.incident.maintainer ?? 'Incident'}</span>
          <span className="font-mono text-sm text-fg-1 tabular-nums">at {utcLabel(report.at)}</span>
        </h2>
        <Button variant="ghost" icon={<LinkIcon size={16} />} onClick={onShare}>
          Share
        </Button>
      </header>

      <dl className="mt-2 grid gap-4 @min-[360px]:grid-cols-[auto_1fr] @min-[360px]:gap-x-6">
        <div className="col-span-full">
          <dt className="label-caps">Exposed repos by tier</dt>
          <dd className="mt-1">
            <div className="flex h-2 gap-px overflow-hidden rounded-xs bg-bg-3" aria-hidden>
              {TIERS.map(([t, bg]) => (
                <div key={t} className={bg} style={{ flexGrow: report.counts[t] }} />
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-sans text-2xl font-bold text-fg-0 tabular-nums">
                {exposed}{' '}
                <span className="text-sm font-normal text-fg-1">of {exposed + report.counts.CLEAN} repos</span>
              </span>
              {TIERS.map(([t, , text]) => (
                <span key={t} className="inline-flex items-baseline gap-1.5">
                  <span className={`font-sans text-xl font-bold tabular-nums ${report.counts[t] ? text : 'text-fg-2'}`}>{report.counts[t]}</span>
                  <span className="font-mono text-2xs text-fg-1">{t}</span>
                </span>
              ))}
            </p>
          </dd>
        </div>
        <div>
          <dt className="label-caps">Ahead of the advisory</dt>
          <dd className="font-sans text-2xl font-bold text-fg-0 tabular-nums">{signedMin(report.minutesAhead)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="label-caps">Top maintainers by influence</dt>
          <dd className="mt-0.5 flex flex-col gap-1">
            <span className="text-xs text-fg-2">share of the top {top.length}&rsquo;s combined PageRank</span>
            {top.map((c) => (
              <div key={c.maintainer} className="grid grid-cols-[minmax(0,6.5rem)_1fr_2.75rem] items-center gap-2 text-sm">
                <span className="truncate text-fg-0">{c.maintainer}</span>
                <span className="h-1.5 rounded-xs bg-bg-3" aria-hidden>
                  <span className="block h-full rounded-xs bg-fg-1" style={{ width: `${c.bar}%` }} />
                </span>
                <span className="text-right font-sans font-bold text-fg-0 tabular-nums">{c.share}</span>
              </div>
            ))}
          </dd>
        </div>
      </dl>
    </section>
  );
}
