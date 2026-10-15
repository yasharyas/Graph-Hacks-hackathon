// Mock mode: replays shared/fixtures with realistic gaps. FIXTURE DATA, not real results.
// Only the qix scenario has a fixture; anything else is a friendly error, never silently-wrong data.
import triageFixture from '../../../shared/fixtures/triage-qix.json' with { type: 'json' };
import timelineFixture from '../../../shared/fixtures/timeline-qix.json' with { type: 'json' };
import { ApiError, type AnalyzeRequest, type ExposureResponse, type TriageRequest } from './api.ts';
import { countsKey, snapshotAt } from './snapshot.ts';
import type { AnalyzeEvent, Exposure, IncidentMeta, Report, ScenarioId, TimelinePoint, Tier, TriageEvent } from './types.ts';

// The JSON loader widens string literals ("LOCKED" becomes string), so the contract types are asserted once here.
const events = triageFixture.events as unknown as TriageEvent[];
const timeline = timelineFixture as unknown as { incident: IncidentMeta; points: TimelinePoint[] };
const report = events.find((e): e is Extract<TriageEvent, { type: 'report' }> => e.type === 'report')!.report;

const QIX: ScenarioId = 'qix-2025-09-08';
/** Gaps between events, 200-700 ms, deterministic so screenshots and tests repeat. */
const GAPS = [240, 320, 640, 280, 560, 300, 450, 260, 700, 330, 520, 380, 410, 280, 360];

function requireQix(scenario: ScenarioId | undefined): void {
  if (scenario && scenario !== QIX) {
    throw new ApiError(`Mock mode only ships the qix fixture, not ${scenario}. Open the app without ?mock to use the API.`, 404);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const t = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

async function* replay<T>(items: T[], signal: AbortSignal): AsyncGenerator<T> {
  for (const [i, item] of items.entries()) {
    await sleep(GAPS[i % GAPS.length]!, signal);
    yield structuredClone(item);
  }
}

export const mockScenarios = (): IncidentMeta[] => [timeline.incident];

export function mockTimeline(scenario: ScenarioId) {
  requireQix(scenario);
  return structuredClone(timeline);
}

/** Exposure picture at `at`, derived from the timeline: the first N exposures of each tier, N = that tier's count. */
const derived = new Map<string, ExposureResponse>();
export function mockExposureAt(at: number): ExposureResponse & { grepName: string } {
  const point = snapshotAt(timeline.points, at)!;
  const key = countsKey(point.counts);
  let hit = derived.get(key);
  if (!hit) {
    const exposures = (['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as Tier[]).flatMap((tier) =>
      report.exposures.filter((e: Exposure) => e.tier === tier).slice(0, point.counts[tier]),
    );
    hit = { at: point.at, counts: point.counts, exposures, scanner: [], grepCount: report.grepCount };
    derived.set(key, hit);
  }
  // The package the name-grep row is about: the first path's target ("debug"), as in the fixture's own narration.
  return { ...hit, grepName: report.paths[0]?.version.replace(/@[^@]*$/, '') ?? 'a bad package' };
}

export function mockTriage(input: TriageRequest, signal: AbortSignal): AsyncGenerator<TriageEvent> {
  requireQix('scenario' in input ? input.scenario : undefined);
  return replay(events, signal); // the fixture ignores `at` and free-text alerts: it is always the 13:30 qix run
}

/** A canned follow-up built from the fixture's explain_path tool call. The text is mock-only. */
export function mockAsk(signal: AbortSignal): AsyncGenerator<TriageEvent> {
  const explain = events.filter((e) => 'id' in e && e.id === 't4');
  const answer: TriageEvent[] = [
    ...explain,
    {
      type: 'narration',
      mode: 'replay',
      provider: null,
      text: '`acme/checkout-web` reaches `debug@4.4.2` through `express@5.1.0` [E1].',
    },
    { type: 'guard', verified: 3, total: 3, flagged: [] },
    { type: 'done', ms: 410 },
  ];
  return replay(answer, signal);
}

/** Simulated progress for a pasted repo or lockfile; the "ready" graph is then triaged with the same fixture. */
export async function* mockAnalyze(input: AnalyzeRequest, signal: AbortSignal): AsyncGenerator<AnalyzeEvent> {
  requireQix(input.scenario);
  const stages = ['fetch', 'parse', 'write', 'enrich', 'admits'] as const;
  for (const stage of stages) {
    for (const done of [0, 1, 2, 3]) {
      await sleep(stage === 'fetch' ? 260 : 120, signal);
      yield { type: 'progress', stage, done, total: 3 };
    }
  }
  yield { type: 'ready', graph: 'pz_guest_mock', repo: 'url' in input ? input.url.replace('https://github.com/', '') : 'lockfile', entries: 0 };
}
