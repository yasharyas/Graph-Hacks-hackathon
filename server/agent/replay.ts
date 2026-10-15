// Recorded narration (data/replays/<scenario>.json, keyed by the scenario clock rounded to the minute). The tools
// always re-run live: a recording replaces the template only when the guard passes it against the fresh evidence.
// RECORD=1 saves every live narration. Fallback chain: live -> replay -> template.
import { readFileSync, writeFileSync } from 'node:fs';
import type { ScenarioId, TriageEvent } from '../../shared/events.ts';
import { guard, type Evidence } from './guard.ts';
import { evidenceSet } from './narrate.ts';

type Recording = { text: string; provider: string | null };
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

// Wraps a triage stream: records or replays the narration (`replay` false for guest graphs, whose evidence no recording
// describes) and re-emits the guard event with claims for whichever text was shown.
export async function* narrated(events: AsyncIterable<TriageEvent>, s: ScenarioId, at: number, replay: boolean): AsyncGenerator<TriageEvent> {
  let ev: Evidence | undefined;
  let text = '';
  for await (const e of events) {
    if (e.type === 'report') ev = evidenceSet(e.report);
    if (e.type === 'narration') {
      if (e.mode === 'live' && process.env.RECORD === '1') record(s, at, { text: e.text, provider: e.provider });
      const r = e.mode === 'template' && replay && ev ? recorded(s, at) : undefined;
      // Same bar as a live narration in triage.ts: no unverified entity or citation (an unverified number is struck in the UI).
      if (r && ev && !guard(r.text, ev).claims.some((c) => !c.ok && c.kind !== 'number')) {
        text = r.text;
        yield { type: 'narration', mode: 'replay', provider: r.provider, text };
        continue;
      }
      text = e.text;
    }
    if (e.type === 'guard' && ev) {
      const g = guardEvent(text, ev); // a variable, not a literal: `claims` is not in the contract type yet
      yield g;
      continue;
    }
    yield e;
  }
}
