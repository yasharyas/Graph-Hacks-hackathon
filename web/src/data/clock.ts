// Clocks: each incident's default triage clock (the server's DEFAULT_AT), the "HH:MM" test the server applies to a free-text
// alert, and a local-time stamp with its zone. Absolute times in the war room are UTC (data/format.ts); the one place a
// person's own clock reads better is "when did I mark this", so that stamp says which zone it is in.
import type { ScenarioId } from './types.ts';

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

// The server's clockOf (server/index.ts), mirrored so the "No time in the alert" note never disagrees with the run: an ISO
// instant ("2025-09-08T13:16:00Z"), else a 12-hour time ("1:16 PM", "1:16 p.m.", read as UTC), else a 24-hour one ("13:16",
// "13:16UTC"); HH:MM falls on the incident's day, and a time more than 30 days from the incident is ignored.
const ISO = /\b(\d{4}-\d\d-\d\d)T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?Z?/i;
const H12 = /(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])\s*([ap])\.?\s?m\b\.?/i;
const H24 = /(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/;
const DAY = 86_400_000;

/** How an alert's time was written: the matched text, its form, the 24-hour time it means, and whether it names a zone. */
export interface ClockRead {
  raw: string;
  kind: 'iso' | '12h' | '24h';
  h: number; // 0-23, after AM/PM
  m: number;
  date: string | null; // the ISO form's own day
  zoned: boolean; // "Z", "UTC" or "GMT" next to the time
}

export function clockRead(text: string): ClockRead | null {
  const iso = ISO.exec(text);
  const m = iso ? null : (H12.exec(text) ?? H24.exec(text));
  if (!iso && !m) return null;
  const hit = (iso ?? m)!;
  let h = Number(iso ? iso[2] : m![1]);
  const ap = m?.[3]?.toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  const after = text.slice(hit.index + hit[0].length);
  const zoned = (iso !== null && /z$/i.test(iso[0])) || /^\s*(?:utc|gmt|z)\b/i.test(after);
  return { raw: hit[0].trim(), kind: iso ? 'iso' : ap ? '12h' : '24h', h, m: Number(iso ? iso[3] : m![2]), date: iso ? iso[1]! : null, zoned };
}

/** The clock an alert text names for the incident around `near` (epoch ms), or null: then the run uses the scenario default. */
export function clockIn(text: string, near: number): number | null {
  const c = clockRead(text);
  if (!c) return null;
  const t = Date.parse(`${c.date ?? new Date(near).toISOString().slice(0, 10)}T${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}:00Z`);
  return Math.abs(t - near) <= 30 * DAY ? t : null;
}

/** Does the alert name a clock the server will use? (`near`: the incident's default clock; qix when unknown.) */
export const hasClock = (text: string, near: number = DEFAULT_AT['qix-2025-09-08']): boolean => clockIn(text, near) !== null;

/** "Oct 16, 06:14 PM IST": local date, time and zone name (Intl), for stamps a person made themselves. */
export const localStamp = (ms: number): string =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(ms);

/** "04:24 PM IST": the same, time and zone only, where a table cell has no room for the date (the title carries it). */
export const localTime = (ms: number): string =>
  new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(ms);
