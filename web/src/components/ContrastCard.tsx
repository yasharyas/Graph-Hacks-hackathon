/* ContrastCard: "graph off" baseline vs the graph, deterministic. Three rows plus the footer figure.
 * Props:
 *   snapshot        TimelinePoint at the scrubber time: tier counts + advisory-scanner hits (null while the
 *                   timeline loads: skeleton rows). Numbers follow the scrubber instantly.
 *   grepCount, grepName   name grep: "debug in 15 repos" (no path, no owner); null until known
 *   minutesAhead    Report.minutesAhead, or advisoryAt - firstPublishAt derived from the incident
 *   scribble        true = draw the 74-min scribble once (arrow wipe, then loop sweep); the parent latches it
 *                   when the scrubber passes the OSV marker. Reduced motion shows it whole.
 *   actions         ReactNode rendered under the rows (the landing buttons: Run triage, Try axios, Paste)
 * One <dl>; the scribble images are aria-hidden and the sentence is real text. Left-aligned except the 74 min.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { TimelinePoint } from '../data/types.ts';

export interface ContrastCardProps {
  snapshot: TimelinePoint | null;
  grepCount: number | null;
  grepName: string | null;
  minutesAhead: number | null;
  scribble: boolean;
  actions?: ReactNode;
}

const PEN = { '--pen-x': '62.5%', '--pen-y': '53%', '--pen-from': '282deg', animationDelay: '400ms' } as CSSProperties;
const ROW = 'grid items-baseline gap-x-3 gap-y-0.5 @min-[420px]:grid-cols-[8.5rem_1fr]';

function Num({ n, cls }: { n: number; cls: string }) {
  return <span className={`text-xl font-bold tabular-nums ${n === 0 ? 'text-fg-2' : cls}`}>{n}</span>;
}

export function ContrastCard({ snapshot, grepCount, grepName, minutesAhead, scribble, actions }: ContrastCardProps) {
  const c = snapshot?.counts;
  const tiers = c
    ? ([
        ['LOCKED', c.LOCKED, 'text-tier-locked'],
        ['WOULD_PULL', c.WOULD_PULL, 'text-tier-would-pull'],
        ['MAINTAINER', c.MAINTAINER, 'text-tier-maintainer'],
      ] as const)
    : [];
  return (
    <section aria-label="Scanner versus graph" className="@container p-4">
      <div className="flex flex-col gap-3 @min-[600px]:flex-row @min-[600px]:items-center @min-[600px]:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <dl className="flex min-w-0 flex-col gap-2">
            {!snapshot ? (
              [0, 1, 2].map((i) => <div key={i} className="skeleton h-7 w-64" aria-hidden />)
            ) : (
              <>
                <div className={ROW}>
                  <dt className="label-caps">Advisory scanner</dt>
                  <dd className="flex items-baseline gap-2">
                    <Num n={snapshot.scanner} cls="text-fg-0" />
                    <span className="text-sm text-fg-1">OSV advisories</span>
                  </dd>
                </div>
                <div className={ROW}>
                  <dt className="label-caps">Name grep</dt>
                  <dd className="flex flex-wrap items-baseline gap-x-2 text-sm text-fg-1">
                    {grepCount === null ? (
                      <span className="skeleton inline-block h-5 w-40" aria-hidden />
                    ) : (
                      <>
                        <span className="font-mono text-xs text-fg-0">{grepName ?? 'a bad package'}</span> in
                        <Num n={grepCount} cls="text-fg-0" /> repos
                        <span className="text-fg-2">(no path, no owner)</span>
                      </>
                    )}
                  </dd>
                </div>
                <div className={ROW}>
                  <dt className="label-caps">Patient Zero</dt>
                  <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {tiers.map(([name, n, cls]) => (
                      <span key={name} className="inline-flex items-baseline gap-1.5">
                        <Num n={n} cls={cls} />
                        <span className="font-mono text-2xs text-fg-1">{name}</span>
                      </span>
                    ))}
                    <span className="text-sm text-fg-2">paths + owners</span>
                  </dd>
                </div>
              </>
            )}
          </dl>
          {actions}
        </div>

        {/* The one centred element in the app: the 74 min figure. The 480x300 scribble canvas is scaled (0.54, or 0.67 from
            1440px) with the figure inside it, so the loop always fits the number; the caption stays at a readable 12px. */}
        {minutesAhead !== null && (
          <div className="relative h-[140px] w-[260px] max-w-full shrink-0 overflow-hidden min-[1440px]:h-[170px] min-[1440px]:w-[320px]">
            <div className="absolute top-0 left-0 h-[300px] w-[480px] origin-top-left scale-[0.5417] min-[1440px]:scale-[0.6667]">
              <strong className="absolute top-[160px] left-[300px] -translate-x-1/2 -translate-y-1/2 font-display text-4xl font-extrabold whitespace-nowrap text-fg-0">
                {minutesAhead} min
              </strong>
              {scribble && (
                <>
                  <picture aria-hidden>
                    <source srcSet="/scribbles/seventy-four-min-arrow.webp" type="image/webp" />
                    <img src="/scribbles/seventy-four-min-arrow.png" alt="" width={480} height={300} className="scribble scribble-wipe" />
                  </picture>
                  <picture aria-hidden>
                    <source srcSet="/scribbles/seventy-four-min-loop.webp" type="image/webp" />
                    <img src="/scribbles/seventy-four-min-loop.png" alt="" width={480} height={300} className="scribble scribble-sweep" style={PEN} />
                  </picture>
                </>
              )}
            </div>
            <span className="absolute top-1 left-[6%] max-w-[110px] text-xs text-fg-1">before the OSV record existed</span>
          </div>
        )}
      </div>
    </section>
  );
}
