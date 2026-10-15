/* ContrastCard: "graph off" baseline vs the graph, deterministic. Three rows plus the footer figure. Landing band only:
 * once a triage runs the band collapses to the one-row scrubber and these numbers live there.
 * Props:
 *   snapshot        TimelinePoint at the scrubber time: tier counts + advisory-scanner hits (null while the timeline
 *                   loads: the same rows with dashes, so the layout is final from first paint)
 *   grepCount, grepName   name grep: "debug in 15 repos" (no path, no owner); null until known. grepName is the bad package
 *                   names ("ansi-styles, debug +17"), never a placeholder
 *   minutesAhead    advisoryAt minus the first moment the graph showed exposure: one definition, from App
 *   reveal          the playhead has passed the OSV record: only then does the figure and its scribble appear (no spoiler
 *                   at 13:05). The slot is always laid out, so nothing moves when it fills
 *   actions         ReactNode rendered under the rows (Run triage, Try axios, Paste), laid out from first paint
 * Two scribbles live here: the 74-min loop + arrow around the figure (drawn when it is revealed, sized to the measured
 * figure width so three digits fit), and `contrast-arrow`, which runs down the lane between the labels and the numbers
 * from the scanner's 0 to the first Patient Zero count, only while that contrast is true (scanner 0, graph > 0) and only
 * when the rows are wide enough to have a lane. One <dl>; every scribble is aria-hidden and the sentence is real text.
 * Left-aligned except the figure.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { TimelinePoint } from '../data/types.ts';
import { Scribble } from './Scribble.tsx';

export interface ContrastCardProps {
  snapshot: TimelinePoint | null;
  grepCount: number | null;
  grepName: string | null;
  minutesAhead: number | null;
  reveal: boolean;
  actions?: ReactNode;
}

const PEN = { '--pen-x': '62.5%', '--pen-y': '53%', '--pen-from': '282deg', animationDelay: '400ms' } as CSSProperties;
// Columns from 420px: label 9.5rem (12px caps: "ADVISORY SCANNER" fits) · the arrow's 1.75rem lane · value. Below that the label stacks over the value.
const ROW = 'grid items-baseline gap-x-3 gap-y-0.5 @min-[420px]:grid-cols-[9.5rem_1.75rem_1fr]';
const NOTE = 'basis-full text-xs text-fg-1 short:hidden lg:[@media(max-height:800px)]:hidden'; // the one plain line under a row's figures (not on a phone held sideways, nor on a 768px laptop, where the graph needs the height)
const VAL = '@min-[420px]:col-start-3';
// The loop art is drawn around "74 min" (about 150px wide at 56px) with ~34px of air each side: wider text stretches it.
const RING_W = 216;
const RING_AIR = 68;

function Num({ n, cls }: { n: number | null | undefined; cls: string }) {
  const none = n === null || n === undefined;
  return <span className={`inline-block min-w-[2ch] text-right text-xl font-bold tabular-nums ${none || n === 0 ? 'text-fg-2' : cls}`}>{none ? '–' : n}</span>;
}

/** The "74 min" figure, laid out in the 480x300 art space and scaled to fit; the ring follows the measured text width. */
function Figure({ minutes }: { minutes: number }) {
  const text = useRef<HTMLElement>(null);
  const [w, setW] = useState(150);
  useLayoutEffect(() => {
    const el = text.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.offsetWidth)); // layout width: unaffected by the parent's scale transform
    ro.observe(el);
    setW(el.offsetWidth);
    return () => ro.disconnect();
  }, [minutes]);
  const k = Math.max(1, (w + RING_AIR) / RING_W);
  const fit = { transform: `scaleX(${k})`, transformOrigin: '62.5% 53.3%' } as CSSProperties;
  return (
    <>
      <div className="absolute top-0 left-0 h-[300px] w-[480px] origin-top-left scale-[0.5417] min-[1440px]:scale-[0.6667]">
        <strong ref={text} className="absolute top-[160px] left-[300px] -translate-x-1/2 -translate-y-1/2 font-display text-4xl font-extrabold whitespace-nowrap text-fg-0">
          {minutes} min
        </strong>
        <picture aria-hidden>
          <source srcSet="/scribbles/seventy-four-min-arrow.webp" type="image/webp" />
          <img src="/scribbles/seventy-four-min-arrow.png" alt="" width={480} height={300} className="scribble scribble-wipe" style={fit} />
        </picture>
        <picture aria-hidden>
          <source srcSet="/scribbles/seventy-four-min-loop.webp" type="image/webp" />
          <img src="/scribbles/seventy-four-min-loop.png" alt="" width={480} height={300} className="scribble scribble-sweep" style={{ ...PEN, ...fit }} />
        </picture>
      </div>
      <span className="absolute top-1 left-[6%] max-w-[110px] text-xs text-fg-1">before the OSV record existed</span>
    </>
  );
}

export function ContrastCard({ snapshot, grepCount, grepName, minutesAhead, reveal, actions }: ContrastCardProps) {
  const c = snapshot?.counts;
  const tiers = ([
    ['LOCKED', c?.LOCKED, 'text-tier-locked'],
    ['WOULD_PULL', c?.WOULD_PULL, 'text-tier-would-pull'],
    ['MAINTAINER', c?.MAINTAINER, 'text-tier-maintainer'],
  ] as const).map(([name, n, cls]) => ({ name, n, cls }));
  const found = (c?.LOCKED ?? 0) + (c?.WOULD_PULL ?? 0); // the arrow lands on a hit, never on "0 LOCKED 0 WOULD_PULL"
  const arrow = snapshot !== null && snapshot.scanner === 0 && found > 0;
  return (
    <section aria-label="Scanner versus graph" className="@container p-3 sm:p-4">
      <div className="flex flex-col gap-3 @min-[600px]:flex-row @min-[600px]:items-center @min-[600px]:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          {/* On a phone the one primary action sits above the numbers: it is on screen without scrolling (sideways too). */}
          <div className="order-2 @min-[420px]:order-3 short:order-1">{actions}</div>
          <dl className="relative order-3 flex min-w-0 flex-col gap-2 @min-[420px]:order-2">
            <div className={ROW}>
              <dt className="label-caps">Advisory scanner</dt>
              <dd className={`flex items-baseline gap-2 ${VAL}`}>
                <Num n={snapshot?.scanner} cls="text-fg-0" />
                <span className="text-sm text-fg-1">OSV advisories</span>
              </dd>
            </div>
            <div className={ROW}>
              <dt className="label-caps">Name grep</dt>
              <dd className={`flex flex-wrap items-baseline gap-x-2 text-sm text-fg-1 ${VAL}`}>
                {grepName ? <span className="font-mono text-xs text-fg-0">{grepName}</span> : <span className="text-fg-0">a bad package name</span>} in
                <Num n={grepCount} cls="text-fg-0" /> {grepCount === 1 ? 'repo' : 'repos'}
                <span className={NOTE}>A plain text search for the bad package names: no version, no path, no owner.</span>
              </dd>
            </div>
            <div className={ROW}>
              <dt className="label-caps">Patient Zero</dt>
              <dd className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${VAL}`}>
                {tiers.map((t, i) => (
                  <span key={t.name} className={`inline-flex items-baseline gap-1.5 ${i === 0 ? '[anchor-name:--pz1]' : ''}`}>
                    <Num n={t.n} cls={t.cls} />
                    <span className="font-mono text-2xs text-fg-1">{t.name}</span>
                  </span>
                ))}
                {/* its own line, never beside MAINTAINER's count, where it read as that tier's label */}
                <span className={NOTE}>With paths and owners: it follows the dependency graph from the hijacked account to each repo, so every hit has a path, a tier and a team.</span>
              </dd>
            </div>
            {/* The lane runs from the top of row 1 to the bottom of the first tier count (CSS anchor positioning, so the
                tip still lands on the number when the name-grep row wraps); the 28x100 stroke stretches to fit. Browsers
                without anchor() get the 100px box, which is exact while nothing wraps. */}
            {arrow && (
              <Scribble
                name="contrast-arrow"
                width={28}
                height={100}
                angle={180}
                className="absolute top-0 left-[calc(9.5rem+0.75rem)] hidden h-[100px] [bottom:anchor(--pz1_bottom)] supports-[bottom:anchor(--a_bottom)]:h-auto @min-[420px]:block"
              />
            )}
          </dl>
        </div>

        {/* The one centred element in the app: the figure. Its slot is always laid out; the 480x300 scribble canvas is
            scaled (0.54, or 0.67 from 1440px) with the figure inside it, so the loop always fits the number. */}
        <div className="relative h-[140px] w-[260px] max-w-full shrink-0 overflow-hidden min-[1440px]:h-[170px] min-[1440px]:w-[320px]">
          {reveal && minutesAhead !== null && <Figure minutes={minutesAhead} />}
        </div>
      </div>
    </section>
  );
}
