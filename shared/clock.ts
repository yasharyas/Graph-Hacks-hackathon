// The time a free-text alert names, read once for the server (the run's clock) and the web app (the banner that says how it
// was read), so the two can never disagree. An ISO instant ("2025-09-08T13:16:00Z"), else a 12-hour time ("6:46 PM",
// "1:16 p.m."), else a 24-hour one ("13:16"), each with an optional zone right after it: Z/UTC/GMT, a common abbreviation
// (IST, EDT, CEST ...) or an offset ("+05:30", "UTC+5:30"). No zone means UTC. HH:MM falls on the incident's day in the
// alert's own zone; a time more than 30 days from the incident is ignored. Every regex is linear (S7): anchored or bounded,
// no nested quantifiers.
const ISO = /\b(\d{4}-\d\d-\d\d)T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?/i;
const H12 = /(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])\s*([ap])\.?\s?m\b\.?/i;
const H24 = /(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/;
// minutes east of UTC; IST is India's (the zone an on-call engineer there writes), CST the US one
const ZONES: Record<string, number> = { utc: 0, gmt: 0, z: 0, ist: 330, est: -300, edt: -240, cst: -360, cdt: -300, mst: -420, mdt: -360, pst: -480, pdt: -420, cet: 60, cest: 120, bst: 60, jst: 540 };
const ZONE = /^\s*(?:(utc|gmt|z|ist|est|edt|cst|cdt|mst|mdt|pst|pdt|cet|cest|bst|jst)\b(?:\s?([+-])(\d\d?)(?::?([0-5]\d))?\b)?|([+-])(\d\d):?([0-5]\d)\b)/i;
const DAY = 86_400_000;

/** How an alert's time was written: the matched time, its form, the time it means in its own zone, and its zone. */
export interface ClockRead {
  raw: string; // the time as written, without its zone ("6:46 PM")
  kind: 'iso' | '12h' | '24h';
  h: number; // 0-23, after AM/PM, in the alert's own zone
  m: number;
  date: string | null; // the ISO form's own day
  zoned: boolean; // a zone or offset next to the time
  zone: string | null; // that zone as written ("IST", "+05:30", "UTC")
  offset: number; // minutes east of UTC: IST 330, EDT -240; 0 for UTC or no zone
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
  const z = ZONE.exec(text.slice(hit.index + hit[0].length));
  const sign = z?.[2] ?? z?.[5];
  const shift = sign ? (sign === '-' ? -1 : 1) * (Number(z![3] ?? z![6]) * 60 + Number(z![4] ?? z![7] ?? 0)) : 0;
  const offset = (z?.[1] ? ZONES[z[1].toLowerCase()]! : 0) + shift;
  return { raw: hit[0].trim(), kind: iso ? 'iso' : ap ? '12h' : '24h', h, m: Number(iso ? iso[3] : m![2]), date: iso ? iso[1]! : null, zoned: z !== null, zone: z ? z[0].trim() : null, offset };
}

/** The UTC instant an alert names, for the incident whose default clock is `near` (epoch ms), or null: then the run uses that default. */
export function clockIn(text: string, near: number): number | null {
  const c = clockRead(text);
  if (!c) return null;
  const day = c.date ?? new Date(near + c.offset * 60_000).toISOString().slice(0, 10); // the incident's day in the alert's zone
  const t = Date.parse(`${day}T${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}:00Z`) - c.offset * 60_000;
  return Math.abs(t - near) <= 30 * DAY ? t : null;
}
