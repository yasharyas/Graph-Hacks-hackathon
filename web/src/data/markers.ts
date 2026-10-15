// Timeline markers: what they say and where their labels go. Pure, so the layout is tested from 320 to 1920 px.
import type { IncidentMeta } from './types.ts';

const MIN = 60_000;

export interface Marker {
  key: 'exposed' | 'alert' | 'osv' | 'removed';
  t: number; // true instant: places the tick
  shown: number; // instant the HH:MM label prints
  long: string;
  short: string;
  bad: boolean;
}

/**
 * The four markers. The first is the first moment any repo was exposed (not the first publish: axios' first publish is
 * a dependency nobody reached, 22 minutes earlier). The figure on screen is advisory minus that instant, floored, so the
 * label prints OSV's minute minus the figure: the HH:MM arithmetic between the two labels is the figure by construction
 * (axios' exposure at 00:21:58 and its OSV record at 02:07:58 are 105.997 min apart; truncated labels alone would read 106).
 */
export function markersOf(i: IncidentMeta): Marker[] {
  const first = i.firstExposureAt ?? null;
  const osvMinute = Math.floor(i.advisoryAt / MIN) * MIN;
  const ahead = first === null ? 0 : Math.floor((i.advisoryAt - first) / MIN);
  return [
    first === null
      ? { key: 'exposed', t: i.firstPublishAt, shown: i.firstPublishAt, long: 'first publish', short: 'publish', bad: true }
      : { key: 'exposed', t: first, shown: osvMinute - ahead * MIN, long: 'exposed', short: 'exposed', bad: true },
    { key: 'alert', t: i.alertAt, shown: i.alertAt, long: 'alert', short: 'alert', bad: false },
    { key: 'osv', t: i.advisoryAt, shown: i.advisoryAt, long: 'OSV record', short: 'OSV', bad: false },
    { key: 'removed', t: i.removedAt, shown: i.removedAt, long: 'removed', short: 'removed', bad: false },
  ];
}

/**
 * Where each label goes under a track `trackW` px wide. `x` is the tick (px from the track's left), `w` the measured label
 * width. A label starts at its tick and runs right, or ends at its tick when that would pass the right edge; it is then
 * clamped inside [0, trackW]. Labels are put on the first row where they clear the previous label by `gap` px (interval
 * partitioning by left edge: no overlap, and the fewest rows). Returns the left edge and row per input, in input order.
 */
export function placeLabels(marks: { x: number; w: number }[], trackW: number, gap = 8): { left: number; row: number }[] {
  const spans = marks.map(({ x, w }, i) => {
    const left = Math.max(0, Math.min(x + w > trackW ? x - w : x, trackW - w));
    return { i, left, right: left + w };
  });
  const ends: number[] = []; // right edge of the last label on each row
  const out = marks.map(() => ({ left: 0, row: 0 }));
  for (const s of [...spans].sort((a, b) => a.left - b.left || a.i - b.i)) {
    let row = ends.findIndex((e) => s.left >= e + gap);
    if (row < 0) row = ends.length;
    ends[row] = s.right;
    out[s.i] = { left: s.left, row };
  }
  return out;
}

/** The scrub bubble's centre, kept inside the track so its box never runs off either end. */
export const clampCentre = (x: number, w: number, trackW: number): number => Math.min(Math.max(x, w / 2), Math.max(w / 2, trackW - w / 2));
