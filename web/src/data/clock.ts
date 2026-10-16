// Clocks: each incident's default triage clock (the server's DEFAULT_AT), the "HH:MM" test the server applies to a free-text
// alert, and a local-time stamp with its zone. Absolute times in the war room are UTC (data/format.ts); the one place a
// person's own clock reads better is "when did I mark this", so that stamp says which zone it is in.
import { clockIn } from '../../../shared/clock.ts';
import type { ScenarioId } from './types.ts';

// How an alert's time is read (zone included: "6:46 PM IST" is 13:16 UTC) lives in shared/clock.ts, the one parser the
// server's clockOf also runs, so the banner's "Read ... as ..." never disagrees with the run.
export { clockIn, clockRead, type ClockRead } from '../../../shared/clock.ts';

export const DEFAULT_AT: Record<ScenarioId, number> = {
  'qix-2025-09-08': Date.parse('2025-09-08T13:30:00Z'),
  'axios-2026-03-31': Date.parse('2026-03-31T01:30:00Z'),
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Sep 8, 2025": the UTC date of a scenario clock, for the header chip beside "13:30 UTC" (the same in every locale). */
export const utcDate = (ms: number): string => {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};

/** Does the alert name a clock the server will use? (`near`: the incident's default clock; qix when unknown.) */
export const hasClock = (text: string, near: number = DEFAULT_AT['qix-2025-09-08']): boolean => clockIn(text, near) !== null;

/** "Oct 16, 06:14 PM IST": local date, time and zone name (Intl), for stamps a person made themselves. */
export const localStamp = (ms: number): string =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(ms);

/** "04:24 PM IST": the same, time and zone only, where a table cell has no room for the date (the title carries it). */
export const localTime = (ms: number): string =>
  new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(ms);
