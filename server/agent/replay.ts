// Recorded analyst notes (data/replays/<scenario>.json, keyed by the scenario clock rounded to the minute). The tools
// and the deterministic narration text always re-run live: a recorded note is shown only when no live note exists and
// it passes the guard in full against the fresh evidence. RECORD=1 saves every live note. Note chain: live -> replay -> none.
import { readFileSync, writeFileSync } from 'node:fs';
import type { ScenarioId, TriageEvent } from '../../shared/events.ts';
import { guard, type Evidence } from './guard.ts';
import { acceptNote, evidenceSet } from './narrate.ts';

type Recording = { note: string; provider: string | null };
const file = (s: ScenarioId) => new URL(`../../data/replays/${s}.json`, import.meta.url); // s is a validated enum value
const minute = (at: number) => new Date(Math.round(at / 60_000) * 60_000).toISOString().slice(0, 16) + 'Z';

function all(s: ScenarioId): Record<string, Recording> {
  try {
    return JSON.parse(readFileSync(file(s), 'utf8'));
  } catch {
    return {};
  }
}
export const recorded = (s: ScenarioId, at: number): Recording | undefined => all(s)[minute(at)];
const record = (s: ScenarioId, at: number, r: Recording) => writeFileSync(file(s), JSON.stringify({ ...all(s), [minute(at)]: r }, null, 1) + '\n');

// The guard event as the UI wants it: totals plus each claim's span text and verdict.
export function guardEvent(text: string, ev: Evidence) {
  const g = guard(text, ev);
  return { type: 'guard' as const, verified: g.verified, total: g.total, flagged: g.flagged, claims: g.claims.map((c) => ({ text: c.text, ok: c.ok })) };
}

// Wraps a triage stream: records or replays the note (`replay` false for guest graphs, whose evidence no recording
// describes) and re-emits the guard event over the text plus whichever note was shown.
export async function* narrated(events: AsyncIterable<TriageEvent>, s: ScenarioId, at: number, replay: boolean): AsyncGenerator<TriageEvent> {
  let ev: Evidence | undefined;
  let checked = '';
  for await (const e of events) {
    if (e.type === 'report') ev = evidenceSet(e.report);
    if (e.type === 'narration') {
      if (e.mode === 'live' && e.note && process.env.RECORD === '1') record(s, at, { note: e.note, provider: e.provider });
      const r = e.mode === 'template' && replay && ev ? recorded(s, at) : undefined;
      const note = r && ev ? acceptNote(r.note, ev) : null;
      const shown = note ? { ...e, mode: 'replay' as const, provider: r!.provider, note } : e;
      checked = shown.note ? `${shown.text}\n${shown.note}` : shown.text;
      yield shown;
      continue;
    }
    if (e.type === 'guard' && ev) {
      yield guardEvent(checked, ev);
      continue;
    }
    yield e;
  }
}
