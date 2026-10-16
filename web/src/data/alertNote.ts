// What the alert banner says about how a free-text alert was read, so nothing about it is silent (secops round 5):
// the clock it used and how ("1:16 PM" read as 13:16 UTC; "1:16" with no AM/PM read as 01:16, with the other reading named),
// that a time with no zone is taken as UTC, and which incident ran when the alert names two. A missing time names the
// scenario default and an example from the incident that ran (axios' own alert time, never qix's). Pure: node --test covers it.
import { clockIn, clockRead, DEFAULT_AT } from './clock.ts';
import type { IncidentMeta } from './types.ts';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const utcLabel = (ms: number) => `${new Date(ms).toISOString().slice(11, 16)} UTC`;
/** "qix", "axios": the incident's short name (its title up to " npm"). */
export const incidentName = (i: IncidentMeta): string => i.title.split(/ npm\b/)[0]!.trim() || i.id;

// The server's fromAlert (server/index.ts), mirrored: the incident whose account, packages or versions the words name most;
// a tie goes to the first incident in the list.
function named(text: string, incidents: IncidentMeta[]): IncidentMeta[] {
  const words = (text.toLowerCase().match(/[a-z0-9@._/-]+/g) ?? []).map((w) => w.replace(/[.,]+$/, ''));
  const name = (w: string) => (w.lastIndexOf('@') > 0 ? w.slice(0, w.lastIndexOf('@')) : w);
  return incidents.filter((i) => {
    const terms = new Set([i.id, i.maintainer ?? '', ...i.versions.flatMap((v) => [v.id, v.id.slice(0, v.id.lastIndexOf('@'))])].filter(Boolean).map((t) => t.toLowerCase()));
    return words.some((w) => terms.has(w) || terms.has(name(w)));
  });
}

/**
 * The banner's sentences for an alert run. `ran`: the incident and clock the server used (the start event); `incidents`: every
 * incident (GET /api/scenarios), for the two-incident note (empty: that note is skipped).
 */
export function alertNotes(text: string, ran: { incident: IncidentMeta; at: number }, incidents: IncidentMeta[] = []): string[] {
  const notes: string[] = [];
  const read = clockRead(text);
  const used = clockIn(text, DEFAULT_AT[ran.incident.id]) !== null;
  const example = utcLabel(ran.incident.alertAt);
  if (!read) notes.push(`No time in the alert: using ${utcLabel(ran.at)}, the scenario default. Add one, like ${example}.`);
  else if (!used) notes.push(`“${read.raw}” is more than 30 days from this incident: using ${utcLabel(ran.at)}, the scenario default.`);
  else if (read.kind === '12h') notes.push(`Read “${read.raw}” as ${utcLabel(ran.at)}${read.zoned ? '' : ': no time zone given, so UTC'}.`);
  else if (read.kind === '24h' && read.h >= 1 && read.h <= 11 && !/^0/.test(read.raw))
    notes.push(`Read “${read.raw}” as ${utcLabel(ran.at)}, on the 24-hour clock${read.zoned ? '' : ' in UTC'}. Add PM if you meant ${hhmm(read.h + 12, read.m)}.`);
  else if (!read.zoned) notes.push(`Read “${read.raw}” as ${utcLabel(ran.at)}: no time zone given, so UTC.`);
  const both = named(text, incidents);
  if (both.length > 1) {
    const others = both.filter((i) => i.id !== ran.incident.id).map(incidentName);
    notes.push(`The alert names ${both.map(incidentName).join(' and ')}: this triage is ${incidentName(ran.incident)}. Pick ${others.join(' or ')} above to triage ${others.length === 1 ? 'that one' : 'those'}.`);
  }
  return notes;
}
