/* ExecSummary: top of the results (docs/design.md section 5); also the future 1200x630 share card.
 * Props: report (Report), onShare (copies a link; wiring lives in App).
 * Three figures in one <dl>: exposed repos by tier (stacked bar + numbers), minutes ahead of the advisory,
 * top-3 maintainer concentration (bars with their values beside them). Figures are Cabinet Grotesk (static once
 * the report lands: Cabinet has no tabular figures, so nothing here ticks).
 */
import type { Report } from '../data/types.ts';
import { signedMin, utcLabel } from '../data/format.ts';
import { Button } from './Button.tsx';
import { LinkIcon } from './icons/Glyphs.tsx';

const TIERS = [
  ['LOCKED', 'bg-tier-locked', 'text-tier-locked'],
  ['WOULD_PULL', 'bg-tier-would-pull', 'text-tier-would-pull'],
  ['MAINTAINER', 'bg-tier-maintainer', 'text-tier-maintainer'],
] as const;

export function ExecSummary({ report, onShare }: { report: Report; onShare: () => void }) {
  const exposed = TIERS.reduce((n, [t]) => n + report.counts[t], 0);
  const top = report.concentration.slice(0, 3);
  const max = Math.max(...top.map((c) => c.influence), 0.01);
  return (
    <section aria-label="Executive summary" className="animate-enter @container m-3 rounded-md border border-line-2 bg-bg-1 p-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold text-fg-0">
          {report.incident.maintainer ?? 'Incident'} <span className="text-fg-1">at {utcLabel(report.at)}</span>
        </h2>
        <Button variant="ghost" icon={<LinkIcon size={16} />} onClick={onShare}>
          Share
        </Button>
      </header>

      <dl className="mt-2 grid gap-3 @min-[360px]:grid-cols-[auto_1fr] @min-[360px]:gap-x-5">
        <div className="col-span-full">
          <dt className="label-caps">Exposed repos by tier</dt>
          <dd className="mt-1">
            <div className="flex h-2 gap-px overflow-hidden rounded-xs bg-bg-3" aria-hidden>
              {TIERS.map(([t, bg]) => (
                <div key={t} className={bg} style={{ flexGrow: report.counts[t] }} />
              ))}
            </div>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-display text-2xl font-extrabold text-fg-0">
                {exposed}
                <span className="ml-1 font-sans text-sm font-normal text-fg-1">of {exposed + report.counts.CLEAN} repos</span>
              </span>
              {TIERS.map(([t, , text]) => (
                <span key={t} className="inline-flex items-baseline gap-1.5">
                  <span className={`font-display text-xl font-extrabold ${text}`}>{report.counts[t]}</span>
                  <span className="font-mono text-2xs text-fg-1">{t}</span>
                </span>
              ))}
            </p>
          </dd>
        </div>
        <div>
          <dt className="label-caps">Ahead of the advisory</dt>
          <dd className="font-display text-2xl font-extrabold text-fg-0">{signedMin(report.minutesAhead)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="label-caps">Top maintainer concentration</dt>
          <dd className="mt-1 flex flex-col gap-1">
            {top.map((c) => (
              <div key={c.maintainer} className="grid grid-cols-[minmax(0,6rem)_1fr_auto] items-center gap-2 text-sm">
                <span className="truncate text-fg-0">{c.maintainer}</span>
                <span className="h-1.5 rounded-xs bg-bg-3" aria-hidden>
                  <span className="block h-full rounded-xs bg-fg-1" style={{ width: `${(c.influence / max) * 100}%` }} />
                </span>
                <span className="font-mono text-xs text-fg-1 tabular-nums">{c.influence.toFixed(2)}</span>
              </div>
            ))}
          </dd>
        </div>
      </dl>
    </section>
  );
}
