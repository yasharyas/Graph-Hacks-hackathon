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
 *   compact            report mode: one row (play, headline, counts, track). Landing mode is the hero band
 *   scope              what the numbers are about ("Acme demo org", "remy/nodemon, pasted repo"), always printed
 *   trailing           compact row only: the action at its end ("Run again")
 *   stale             the previous incident, dimmed while the next one loads (no skeleton flash)
 * Marker labels never collide: each is measured and put on the first of up to three rows where it fits, flipping to
 * the left of its tick when it would run off the track; short words below 520px. Keyboard: left/right = 1 min,
 * Shift+arrows = 10 min, Space = play/pause. Scrubbing is instant. aria-valuetext reads "13:42 UTC, 5 repos exposed".
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { IncidentMeta, TimelinePoint } from '../data/types.ts';
import { plural, utc, utcLabel } from '../data/format.ts';
import { exposedCount } from '../data/snapshot.ts';
import { Button } from './Button.tsx';
import { Pause, Play } from './icons/Glyphs.tsx';

const MIN = 60_000;
const ROW = 16; // px per label row
const MARKERS = [
  { key: 'publish', at: (i: IncidentMeta) => i.firstPublishAt, long: 'first publish', short: 'publish', bad: true },
  { key: 'alert', at: (i: IncidentMeta) => i.alertAt, long: 'alert', short: 'alert', bad: false },
  { key: 'osv', at: (i: IncidentMeta) => i.advisoryAt, long: 'OSV record', short: 'OSV', bad: false },
  { key: 'removed', at: (i: IncidentMeta) => i.removedAt, long: 'removed', short: 'removed', bad: false },
] as const;

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
  stale?: boolean;
  /** Compact row only: the action at its end ("Run again"). */
  trailing?: ReactNode;
}

export function TimelineScrubber({ incident, points, at, snapshot, playing, onPlay, onPause, onSeek, landingEnd, compact = false, scope = null, stale = false, trailing }: TimelineScrubberProps) {
  const ready = incident !== null && points.length > 0;
  const start = ready ? points[0]!.at : 0;
  const end = ready ? points.at(-1)!.at : 1;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
  const exposed = snapshot ? exposedCount(snapshot.counts) : null;

  const trackRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [trackW, setTrackW] = useState(0);
  const [layout, setLayout] = useState<{ row: number; flip: boolean }[]>(MARKERS.map((_, i) => ({ row: i % 2, flip: false })));
  const wide = trackW >= 520;
  const marks = incident ? MARKERS.map((m) => ({ ...m, t: m.at(incident), label: wide ? m.long : m.short })) : [];
  const sig = marks.map((m) => `${m.t}${m.label}`).join();

  // Measure the track, then place every label before the first paint (useLayoutEffect: no visible jump, no layout shift).
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(Math.floor(el.clientWidth)));
    ro.observe(el);
    setTrackW(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!trackW || !marks.length) return;
    const items = marks
      .map((m, i) => {
        const x = (pct(m.t) / 100) * trackW;
        const w = labelRefs.current[i]?.offsetWidth ?? 0;
        const flip = x + w > trackW;
        return { i, flip, l: flip ? x - w : x, r: flip ? x : x + w };
      })
      .sort((a, b) => a.l - b.l);
    const ends: number[] = []; // right edge of the last label on each row
    const next = marks.map(() => ({ row: 0, flip: false }));
    for (const it of items) {
      let row = ends.findIndex((e) => it.l >= e + 8);
      if (row < 0) row = ends.length;
      ends[row] = it.r;
      next[it.i] = { row, flip: it.flip };
    }
    setLayout((prev) => (prev.length === next.length && prev.every((p, i) => p.row === next[i]!.row && p.flip === next[i]!.flip) ? prev : next));
  }, [trackW, sig, start, end]);
  const rows = Math.max(2, ...layout.map((l) => l.row + 1));

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

  const num = (n: number | undefined) => (n === undefined || !snapshot ? '–' : n);
  const stats: { label: string; value: number | undefined; cls: string }[] = [
    { label: 'LOCKED', value: snapshot?.counts.LOCKED, cls: 'text-tier-locked' },
    { label: 'WOULD_PULL', value: snapshot?.counts.WOULD_PULL, cls: 'text-tier-would-pull' },
    { label: 'MAINTAINER', value: snapshot?.counts.MAINTAINER, cls: 'text-tier-maintainer' },
    { label: 'OSV advisories', value: snapshot?.scanner, cls: 'text-fg-1' },
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
      <p className="flex items-baseline gap-2">
        <span className={`inline-block min-w-[2ch] text-right font-bold text-fg-0 tabular-nums ${compact ? 'text-2xl' : 'text-3xl'}`}>{exposed ?? '–'}</span>
        <span className="text-sm text-fg-1">{exposed === 1 ? 'repo' : 'repos'} one install from malware</span>
      </p>
      {scope && <p className="text-xs text-fg-1">{scope}</p>}
    </div>
  );

  const counts = (
    <dl className={`flex flex-wrap gap-x-5 gap-y-1 ${compact ? '' : 'border-y border-line-1 py-1.5'}`}>
      {stats.map((s) => (
        <div key={s.label} className="flex items-baseline gap-1.5">
          <dt className="font-mono text-2xs text-fg-1">{s.label}</dt>
          <dd className={`min-w-[1.5ch] text-right text-md font-bold tabular-nums ${s.value ? s.cls : 'text-fg-2'}`}>{num(s.value)}</dd>
        </div>
      ))}
    </dl>
  );

  const track = (
    <div className="relative pt-5" style={{ paddingBottom: rows * ROW + 4 }}>
      <div ref={trackRef} className="pointer-events-none absolute inset-x-2 top-5 h-6">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line-3" />
        {ready && <div className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full bg-fg-1" style={{ width: `${pct(at)}%` }} />}
        <span
          className="absolute -top-5 -translate-x-1/2 rounded-xs bg-bg-2 px-1.5 font-mono text-2xs text-fg-0 tabular-nums"
          style={{ left: `${ready ? pct(at) : 0}%` }}
          aria-hidden
        >
          {ready ? utc(at) : '--:--'}
        </span>
        {marks.map((m, i) => (
          <div key={m.key} className="absolute top-0 h-full" style={{ left: `${pct(m.t)}%` }} title={`${utc(m.t)} UTC ${m.long}`}>
            <span className={`absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 ${m.bad ? 'bg-infect-400' : 'bg-fg-2'}`} />
            <span
              ref={(el) => void (labelRefs.current[i] = el)}
              className={`absolute top-full whitespace-nowrap font-mono text-2xs ${m.bad ? 'text-infect-400' : 'text-fg-1'}`}
              style={{ marginTop: (layout[i]?.row ?? 0) * ROW + 2, transform: layout[i]?.flip ? 'translateX(0)' : 'translateX(-2px)', right: layout[i]?.flip ? '-1px' : undefined }}
            >
              {utc(m.t)}
              <span className="font-sans"> {m.label}</span>
            </span>
          </div>
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
        aria-valuetext={ready ? `${utcLabel(at)}, ${plural(exposed ?? 0, 'repo')} exposed` : 'Loading'}
        onChange={(e) => onSeek(Number(e.target.value))}
        onKeyDown={onKeyDown}
      />
    </div>
  );

  return (
    <section aria-label="Incident timeline" aria-busy={stale || !ready || undefined} className={`flex flex-col gap-2 transition-opacity duration-(--dur-fast) ease-out ${compact ? 'px-(--gutter) py-1' : 'p-4'} ${stale ? 'pointer-events-none opacity-50' : ''}`}>
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
            <p className="ml-auto rounded-xs bg-bg-2 px-2 py-0.5 font-mono text-xs text-fg-0 tabular-nums">
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
