/* TimelineScrubber: the time spine. Play/pause (FIRST in tab order: WCAG 2.2.2), the climbing counter, a counts strip,
 * and a native range track with incident markers.
 * Props:
 *   incident, points   from useTimeline(); the track spans points[0].at .. points.at(-1).at. `incident` null = still
 *                      loading: the same layout with placeholders, so nothing moves when the data lands
 *   at                 scrubber position (epoch ms, whole minutes)
 *   snapshot           the counts + scanner hits shown. App decides whose: the timeline sample on the landing, the exact
 *                      /api/exposure answer (or the report's) once a triage exists, the pasted repo's for a guest
 *   playing, onPlay, onPause, onSeek(at)
 *   landingEnd         where the first-load autoplay stops; a finished autoplay labels the button "Play the N minutes"
 *   compact            report mode: one row (play, headline, counts, track). Landing mode is the hero band: its counts
 *                      strip carries a plain sublabel under each count (from 640px). Both carry the tier "?" legend right
 *                      after the counts, and a tap or click on the counts opens it too (a phone reader taps "WOULD_PULL 20")
 *   scope, scopeNote, scopeNoteShort   what the numbers are about ("Acme demo org · 21 repos") and what is real in it: the sentence
 *                      in the landing band, a few words on the compact row's second line
 *   scopeSource        a pasted repo: which lockfile it was judged on ("lockfile at commit 5f8e8a8 from 2025-09-01", or a
 *                      counterfactual). The compact row's second line, in place of scopeNoteShort. Both compact lines are
 *                      one line each (truncated, full text in the title), so the band keeps its height when a pasted
 *                      repo's report replaces the demo org's labels: nothing below it shifts
 *   failed             the triage did not run: no counter, no counts (a stale number beside "did not run" reads as a result)
 *   remediated         repos marked remediated: printed beside the exposed count ("· 2 marked remediated")
 *   trailing           compact row only: the action at its end ("Run again")
 *   stale              the previous incident, dimmed while the next one loads (no skeleton flash)
 * Marker labels never collide, from 320 to 1920px: each is measured and put on the first row where it fits, flipped left of
 * its tick (and clamped) at the right edge (data/markers.ts placeLabels); short words below 520px. The layout is redone
 * whenever the incident, the track's width or the fonts change, wherever the track sits (the landing and the compact row
 * are different parents). The first marker is the first exposure, so its label to OSV's is the figure on screen. The scrub
 * bubble is clamped inside the track. Keyboard: left/right = 1 min, Shift+arrows = 10 min, Space = play/pause. Scrubbing is
 * instant. aria-valuetext reads "13:42 UTC, 5 repos exposed" (the timeline's own count at that minute).
 * Forced colors: the track, its fill and the ticks are drawn in system colours (styles.css, data-scrub-*), not backgrounds
 * the browser would drop.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { IncidentMeta, TimelinePoint } from '../data/types.ts';
import { plural, utc, utcLabel, utcSec } from '../data/format.ts';
import { clampCentre, markersOf, placeLabels } from '../data/markers.ts';
import { exposedCount, snapshotAt } from '../data/snapshot.ts';
import { Button } from './Button.tsx';
import { Pause, Play } from './icons/Glyphs.tsx';
import { TierLegend } from './TierLegend.tsx';

const MIN = 60_000;
const ROW = 16; // px per label row

export interface TimelineScrubberProps {
  incident: IncidentMeta | null;
  points: TimelinePoint[];
  at: number;
  snapshot: TimelinePoint | null;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (at: number) => void;
  landingEnd: number | null;
  compact?: boolean;
  scope?: string | null;
  scopeNote?: string | null;
  scopeNoteShort?: string | null;
  scopeSource?: string | null;
  failed?: boolean;
  remediated?: number;
  stale?: boolean;
  /** Compact row only: the action at its end ("Run again"). */
  trailing?: ReactNode;
}

export function TimelineScrubber({ incident, points, at, snapshot, playing, onPlay, onPause, onSeek, landingEnd, compact = false, scope = null, scopeNote = null, scopeNoteShort = null, scopeSource = null, failed = false, remediated = 0, stale = false, trailing }: TimelineScrubberProps) {
  const ready = incident !== null && points.length > 0;
  const start = ready ? points[0]!.at : 0;
  const end = ready ? points.at(-1)!.at : 1;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
  const exposed = snapshot && !failed ? exposedCount(snapshot.counts) : null;
  const sample = ready ? snapshotAt(points, at) : null; // the slider speaks for the timeline, whoever's numbers the band shows

  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null); // state, not a ref: the track is re-parented when the band collapses
  const [trackW, setTrackW] = useState(0);
  const [fonts, setFonts] = useState(0);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [bubbleW, setBubbleW] = useState(0);
  const [placed, setPlaced] = useState<{ left: number; row: number }[]>([]);
  const [legend, setLegend] = useState(false);
  const wide = trackW >= 520;
  const marks = incident ? markersOf(incident).map((m) => ({ ...m, label: wide ? m.long : m.short })) : [];
  const sig = `${start}|${end}|${marks.map((m) => `${m.t}${m.label}`).join()}`;

  // Measure whichever track is mounted now, and again when it resizes.
  useLayoutEffect(() => {
    if (!trackEl) return;
    const ro = new ResizeObserver(() => setTrackW(Math.floor(trackEl.clientWidth)));
    ro.observe(trackEl);
    setTrackW(Math.floor(trackEl.clientWidth));
    return () => ro.disconnect();
  }, [trackEl]);
  // Label widths depend on the fonts: place them again when they arrive.
  useEffect(() => {
    void document.fonts?.ready.then(() => setFonts((n) => n + 1));
  }, []);
  // Place every label before the first paint (no visible jump, no layout shift).
  useLayoutEffect(() => {
    if (!trackW || !marks.length) return;
    const next = placeLabels(
      marks.map((m, i) => ({ x: (pct(m.t) / 100) * trackW, w: labelRefs.current[i]?.offsetWidth ?? 0 })),
      trackW,
    );
    setPlaced((prev) => (prev.length === next.length && prev.every((p, i) => p.left === next[i]!.left && p.row === next[i]!.row) ? prev : next));
    setBubbleW(bubbleRef.current?.offsetWidth ?? 0);
  }, [trackW, sig, fonts]);
  const positioned = placed.length === marks.length && marks.length > 0;
  const rows = Math.max(2, ...placed.map((p) => p.row + 1));
  const bubbleX = clampCentre((pct(at) / 100) * trackW, bubbleW, trackW);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ') {
      e.preventDefault();
      playing ? onPause() : onPlay();
    } else if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const next = at + (e.key === 'ArrowRight' ? 10 : -10) * MIN;
      onSeek(Math.min(end, Math.max(start, next)));
    }
  };

  const num = (n: number | undefined) => (n === undefined || !snapshot || failed ? '–' : n);
  const stats: { label: string; value: number | undefined; cls: string; sub: string }[] = [
    { label: 'LOCKED', value: snapshot?.counts.LOCKED, cls: 'text-tier-locked', sub: 'lockfile pins it' },
    { label: 'WOULD_PULL', value: snapshot?.counts.WOULD_PULL, cls: 'text-tier-would-pull', sub: 'a fresh install fetches it' },
    { label: 'MAINTAINER', value: snapshot?.counts.MAINTAINER, cls: 'text-tier-maintainer', sub: 'uses the account’s packages, nothing malicious yet' },
    { label: 'OSV advisories', value: snapshot?.scanner, cls: 'text-fg-1', sub: 'OSV records published' },
  ];
  const minutes = landingEnd !== null && ready ? Math.round((landingEnd - start) / MIN) : 90;
  const playLabel = playing ? 'Pause' : ready && landingEnd !== null && at >= landingEnd ? `Play the ${minutes} minutes` : 'Play';

  const playButton = (
    <Button
      variant="secondary"
      icon={playing ? <Pause size={16} /> : <Play size={16} />}
      onClick={playing ? onPause : onPlay}
      disabled={!ready}
      aria-label={compact ? playLabel : undefined}
      className={compact ? 'min-w-20' : 'min-w-[12rem]'} // wide enough for "Play the 163 minutes": the label changes when the autoplay ends and must not push the counter
    >
      {compact ? (playing ? 'Pause' : 'Play') : playLabel}
    </Button>
  );

  const headline = (
    <div className="flex min-w-0 flex-col">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`inline-block min-w-[2ch] text-right font-bold text-fg-0 tabular-nums ${compact ? 'text-2xl' : 'text-3xl'}`}>{exposed ?? '–'}</span>
        <span className="text-sm text-fg-1">{failed ? 'no result: the triage did not run' : `${exposed === 1 ? 'repo' : 'repos'} one install from malware`}</span>
        {remediated > 0 && !failed && <span className="text-sm whitespace-nowrap text-tier-clean">· {remediated} marked remediated</span>}
      </p>
      {scope &&
        (compact ? (
          <>
            <p className="truncate text-xs text-fg-1" title={scope}>
              {scope}
            </p>
            <p className="truncate text-xs text-fg-1" title={scopeSource ?? scopeNoteShort ?? undefined}>
              {scopeSource ?? scopeNoteShort ?? ' '}
            </p>
          </>
        ) : (
          <p className="text-xs text-fg-1">
            {scope}
            {scopeNote && <span className="text-fg-2"> · {scopeNote}</span>}
          </p>
        ))}
    </div>
  );

  // Compact: one run of numbers. Landing: a strip with a plain sublabel under each count (from 640px). The "?" legend sits
  // right after the counts in both, and a tap on the counts opens it (the "?" is the keyboard and screen-reader way in).
  const openLegend = () => setLegend(true);
  const counts = compact ? (
    <div className="flex items-center gap-2">
      <dl data-legend-trigger="" onClick={openLegend} className="flex cursor-help flex-wrap gap-x-5 gap-y-1">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <dt className="font-mono text-2xs text-fg-1">{s.label}</dt>
            <dd className={`min-w-[1.5ch] text-right text-md font-bold tabular-nums ${s.value && !failed ? s.cls : 'text-fg-2'}`}>{num(s.value)}</dd>
          </div>
        ))}
      </dl>
      <TierLegend open={legend} onOpenChange={setLegend} />
    </div>
  ) : (
    <div className="flex items-start gap-2 border-y border-line-1 py-1.5">
      <dl data-legend-trigger="" onClick={openLegend} className="flex min-w-0 flex-1 cursor-help flex-wrap gap-x-4 gap-y-1 sm:grid sm:grid-cols-4 sm:gap-x-5 short:grid-cols-2 xl:grid-cols-2 xl:[@media(max-height:800px)]:flex">
        {stats.map((s) => (
          <div key={s.label} className="grid min-w-0 grid-cols-[auto_1fr] items-baseline gap-x-1.5">
            <dt className="font-mono text-2xs whitespace-nowrap text-fg-1">{s.label}</dt>
            <dd className={`text-md font-bold tabular-nums ${s.value && !failed ? s.cls : 'text-fg-2'}`}>{num(s.value)}</dd>
            <dd className="col-span-2 text-xs text-fg-1 max-sm:hidden short:hidden lg:[@media(max-height:800px)]:hidden">{s.sub}</dd>
          </div>
        ))}
      </dl>
      <TierLegend open={legend} onOpenChange={setLegend} />
    </div>
  );

  const track = (
    <div className="relative pt-5" style={{ paddingBottom: rows * ROW + 4 }}>
      <div ref={setTrackEl} className="pointer-events-none absolute inset-x-2 top-5 h-6">
        <div data-scrub-track="" className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line-3" />
        {ready && <div data-scrub-fill="" className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full bg-fg-1" style={{ width: `${pct(at)}%` }} />}
        <span
          ref={bubbleRef}
          className="absolute -top-5 -translate-x-1/2 rounded-xs bg-bg-2 px-1.5 font-mono text-2xs text-fg-0 tabular-nums"
          style={{ left: ready ? bubbleX : 0 }}
          aria-hidden
        >
          {ready ? utc(at) : '--:--'}
        </span>
        {marks.map((m) => (
          <span key={m.key} data-scrub-tick={m.bad ? 'bad' : ''} className={`absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 ${m.bad ? 'bg-infect-400' : 'bg-fg-2'}`} style={{ left: `${pct(m.t)}%` }} />
        ))}
        {marks.map((m, i) => (
          <span
            key={m.key}
            ref={(el) => void (labelRefs.current[i] = el)}
            title={`${utcSec(m.t)} UTC ${m.key === 'exposed' ? 'first repo exposed' : m.long}`}
            className={`absolute top-full h-4 font-mono text-2xs whitespace-nowrap ${m.bad ? 'text-infect-400' : 'text-fg-1'}`}
            style={{ left: positioned ? placed[i]!.left : (pct(m.t) / 100) * trackW, marginTop: (positioned ? placed[i]!.row : 0) * ROW + 2, visibility: positioned ? undefined : 'hidden' }}
          >
            {utc(m.shown)}
            <span className="font-sans"> {m.label}</span>
          </span>
        ))}
      </div>
      <input
        type="range"
        className="scrub relative pointer-coarse:-my-2.5 pointer-coarse:h-11"
        aria-label="Scenario time, UTC"
        min={start}
        max={end}
        step={MIN}
        value={ready ? at : start}
        disabled={!ready}
        aria-valuetext={ready ? `${utcLabel(at)}, ${plural(sample ? exposedCount(sample.counts) : 0, 'repo')} exposed` : 'Loading'}
        onChange={(e) => onSeek(Number(e.target.value))}
        onKeyDown={onKeyDown}
      />
    </div>
  );

  return (
    <section aria-label="Incident timeline" aria-busy={stale || !ready || undefined} className={`flex flex-col gap-2 transition-opacity duration-(--dur-fast) ease-out ${compact ? 'px-(--gutter) py-1' : 'p-3 sm:p-4'} ${stale ? 'pointer-events-none opacity-50' : ''}`}>
      {compact ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 xl:flex-nowrap">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 xl:shrink-0 xl:flex-nowrap">
            {playButton}
            {headline}
            {counts}
          </div>
          <div className="min-w-64 flex-1 basis-72">{track}</div>
          {trailing}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {playButton}
            {headline}
            {/* a phone shows the time on the track's bubble (and in the header): the band's own chip would only push the actions down */}
            <p className="ml-auto rounded-xs bg-bg-2 px-2 py-0.5 font-mono text-xs text-fg-0 tabular-nums max-sm:hidden short:hidden lg:[@media(max-height:800px)]:hidden">
              {ready ? <time dateTime={new Date(at).toISOString()}>{utcLabel(at)}</time> : '--:-- UTC'}
            </p>
          </div>
          {counts}
          {track}
        </>
      )}
    </section>
  );
}
