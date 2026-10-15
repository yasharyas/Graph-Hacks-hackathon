/* TimelineScrubber: the time spine. Play/pause (FIRST in tab order: WCAG 2.2.2), the climbing counter with the
 * scenario clock beside it, a counts strip, and a native range track with incident markers.
 * Props:
 *   incident, points   from useTimeline(); the track spans points[0].at .. points.at(-1).at
 *   at                 scrubber position (epoch ms, whole minutes)
 *   snapshot           the TimelinePoint at `at` (counts + scanner), from useTimeline().snapshot(at)
 *   playing, onPlay, onPause, onSeek(at)
 *   landingEnd         where the first-load autoplay stops (14:30); a finished autoplay labels the button
 *                      "Play the 90 minutes"
 * Keyboard: left/right = 1 min, Shift+arrows = 10 min, Space = play/pause. Scrubbing is instant (no easing).
 * Reduced motion is handled by usePlayback (final state at once, stepped playback).
 * aria-valuetext reads "13:42 UTC, 5 repos exposed".
 */
import type { KeyboardEvent } from 'react';
import type { IncidentMeta, TimelinePoint } from '../data/types.ts';
import { plural, utc, utcLabel } from '../data/format.ts';
import { exposedCount } from '../data/snapshot.ts';
import { Button } from './Button.tsx';
import { Pause, Play } from './icons/Glyphs.tsx';

const MIN = 60_000;

export interface TimelineScrubberProps {
  incident: IncidentMeta;
  points: TimelinePoint[];
  at: number;
  snapshot: TimelinePoint;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (at: number) => void;
  landingEnd: number;
}

export function TimelineScrubber({ incident, points, at, snapshot, playing, onPlay, onPause, onSeek, landingEnd }: TimelineScrubberProps) {
  const start = points[0]!.at;
  const end = points.at(-1)!.at;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
  const exposed = exposedCount(snapshot.counts);

  const markers = [
    { key: 'publish', at: incident.firstPublishAt, label: 'first publish', bad: true, row: 0 },
    { key: 'alert', at: incident.alertAt, label: 'alert', bad: false, row: 1 },
    { key: 'osv', at: incident.advisoryAt, label: 'OSV record', bad: false, row: 0 },
    { key: 'removed', at: incident.removedAt, label: 'removed', bad: false, row: 1 },
  ];

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

  const stats: { label: string; value: number; cls: string }[] = [
    { label: 'LOCKED', value: snapshot.counts.LOCKED, cls: 'text-tier-locked' },
    { label: 'WOULD_PULL', value: snapshot.counts.WOULD_PULL, cls: 'text-tier-would-pull' },
    { label: 'MAINTAINER', value: snapshot.counts.MAINTAINER, cls: 'text-tier-maintainer' },
    { label: 'OSV advisories', value: snapshot.scanner, cls: 'text-fg-1' },
  ];

  return (
    <section aria-label="Incident timeline" className="flex flex-col gap-2.5 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          variant="secondary"
          icon={playing ? <Pause size={16} /> : <Play size={16} />}
          onClick={playing ? onPause : onPlay}
          className="min-w-28"
        >
          {playing ? 'Pause' : at >= landingEnd ? 'Play the 90 minutes' : 'Play'}
        </Button>
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="text-3xl font-bold text-fg-0 tabular-nums" aria-hidden>
            {exposed}
          </span>
          <span className="text-sm text-fg-1">repos one install from malware</span>
        </p>
        <p className="ml-auto rounded-xs bg-bg-2 px-2 py-0.5 font-mono text-xs text-fg-0 tabular-nums">
          <time dateTime={new Date(at).toISOString()}>{utcLabel(at)}</time>
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 border-y border-line-1 py-1.5">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <dt className="font-mono text-2xs text-fg-1">{s.label}</dt>
            <dd className={`text-md font-bold tabular-nums ${s.value === 0 ? 'text-fg-2' : s.cls}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="relative pt-5 pb-9">
        <div className="pointer-events-none absolute inset-x-2 top-5 h-6">
          <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line-3" />
          <div className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full bg-fg-1" style={{ width: `${pct(at)}%` }} />
          <span
            className="absolute -top-5 -translate-x-1/2 rounded-xs bg-bg-2 px-1.5 font-mono text-2xs text-fg-0 tabular-nums"
            style={{ left: `${pct(at)}%` }}
            aria-hidden
          >
            {utc(at)}
          </span>
          {markers.map((m) => (
            <div key={m.key} className="absolute top-0 h-full" style={{ left: `${pct(m.at)}%` }} title={`${utc(m.at)} UTC ${m.label}`}>
              <span className={`absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 ${m.bad ? 'bg-infect-400' : 'bg-fg-2'}`} />
              <span
                className={`absolute top-full whitespace-nowrap font-mono text-2xs ${m.bad ? 'text-infect-400' : 'text-fg-1'} ${
                  pct(m.at) > 75 ? '-translate-x-full text-right' : '-translate-x-0.5'
                }`}
                style={{ marginTop: m.row * 16 + 2 }}
              >
                {utc(m.at)}
                <span className="hidden font-sans md:inline"> {m.label}</span>
              </span>
            </div>
          ))}
        </div>
        <input
          type="range"
          className="scrub relative"
          aria-label="Scenario time, UTC"
          min={start}
          max={end}
          step={MIN}
          value={at}
          aria-valuetext={`${utcLabel(at)}, ${plural(exposed, 'repo')} exposed`}
          onChange={(e) => onSeek(Number(e.target.value))}
          onKeyDown={onKeyDown}
        />
      </div>
    </section>
  );
}
