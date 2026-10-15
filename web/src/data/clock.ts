// Clocks: each incident's default triage clock (the server's DEFAULT_AT), the "HH:MM" test the server applies to a free-text
// alert, and a local-time stamp with its zone. Absolute times in the war room are UTC (data/format.ts); the one place a
// person's own clock reads better is "when did I mark this", so that stamp says which zone it is in.
import type { ScenarioId } from './types.ts';

export const DEFAULT_AT: Record<ScenarioId, number> = {
  'qix-2025-09-08': Date.parse('2025-09-08T13:30:00Z'),
  'axios-2026-03-31': Date.parse('2026-03-31T01:30:00Z'),
};

/** The server finds a clock in an alert text with this pattern; without one the run uses the scenario default. */
export const hasClock = (text: string): boolean => /\b([01]?\d|2[0-3]):[0-5]\d\b/.test(text);

/** "Oct 16, 06:14 PM IST": local date, time and zone name (Intl), for stamps a person made themselves. */
export const localStamp = (ms: number): string =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(ms);

/** "04:24 PM IST": the same, time and zone only, where a table cell has no room for the date (the title carries it). */
export const localTime = (ms: number): string =>
  new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(ms);
