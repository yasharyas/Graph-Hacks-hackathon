/// <reference types="vite/client" />
// HTTP layer for docs/contracts.md. Mock mode (`?mock` in the URL or VITE_MOCK=1) swaps every call for
// the fixture replay in mock.ts, imported lazily so the fixtures stay out of the main bundle.
import { readSSE } from './sse.ts';
import type {
  AnalyzeEvent,
  Exposure,
  IncidentMeta,
  Report,
  ScenarioId,
  TimelinePoint,
  ToolName,
  TriageEvent,
} from './types.ts';

export const isMock: boolean =
  (typeof location !== 'undefined' && new URLSearchParams(location.search).has('mock')) ||
  import.meta.env?.VITE_MOCK === '1';

const mock = () => import('./mock.ts');

/** Server failures are `{ error, requestId }` with no stack (S12); `requestId` is shown next to the cause. */
export class ApiError extends Error {
  status: number;
  requestId: string | undefined;
  constructor(message: string, status = 0, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

export type TriageRequest =
  | { scenario: ScenarioId; at?: number }
  | { alert: string; at?: number }
  | { guest: string; scenario: ScenarioId; at?: number };
export type AnalyzeRequest = ({ url: string } | { lockfile: string }) & { scenario: ScenarioId };
export interface ExposureResponse extends Pick<Report, 'at' | 'counts' | 'scanner' | 'grepCount'> {
  exposures: Exposure[];
  /** Mock mode only: the package the name-grep row talks about (the server contract carries no name yet). */
  grepName?: string;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    if (init.signal?.aborted) throw err; // an abort is not a failure
    throw new ApiError('Cannot reach the Patient Zero server', 0);
  }
  if (res.ok) return res;
  const body = (await res.json().catch(() => ({}))) as { error?: string; requestId?: string };
  const fallback = res.status >= 500 ? 'The Patient Zero server is not responding' : `Request failed (${res.status})`;
  throw new ApiError(body.error ?? fallback, res.status, body.requestId);
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await request(path, { signal, headers: { accept: 'application/json' } })).json() as Promise<T>;
}

async function* postSSE<T>(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<T> {
  const res = await request(path, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new ApiError('The server sent an empty stream', res.status);
  yield* readSSE<T>(res.body);
}

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]]))).toString();

// ── GET helpers ─────────────────────────────────────────────────────────────────────────────

export async function getScenarios(signal?: AbortSignal): Promise<IncidentMeta[]> {
  return isMock ? (await mock()).mockScenarios() : getJSON('/api/scenarios', signal);
}

export async function getTimeline(
  scenario: ScenarioId,
  signal?: AbortSignal,
): Promise<{ incident: IncidentMeta; points: TimelinePoint[] }> {
  return isMock ? (await mock()).mockTimeline(scenario) : getJSON(`/api/timeline?${qs({ scenario })}`, signal);
}

export async function getExposure(scenario: ScenarioId, at: number, signal?: AbortSignal): Promise<ExposureResponse> {
  return isMock ? (await mock()).mockExposureAt(at) : getJSON(`/api/exposure?${qs({ scenario, at })}`, signal);
}

/** `GRAPH.EXPLAIN` lines for one tool's query. */
export async function getPlan(scenario: ScenarioId, tool: ToolName, signal?: AbortSignal): Promise<{ plan: string[] }> {
  return isMock ? { plan: [] } : getJSON(`/api/plan?${qs({ scenario, tool })}`, signal);
}

// ── SSE streams (consumed with `for await`) ─────────────────────────────────────────────────

export async function* streamTriage(body: TriageRequest, signal: AbortSignal): AsyncGenerator<TriageEvent> {
  if (isMock) yield* (await mock()).mockTriage(body, signal);
  else yield* postSSE<TriageEvent>('/api/triage', body, signal);
}

export async function* streamAsk(
  body: { runId: string; question: string },
  signal: AbortSignal,
): AsyncGenerator<TriageEvent> {
  if (isMock) yield* (await mock()).mockAsk(signal);
  else yield* postSSE<TriageEvent>('/api/ask', body, signal);
}

export async function* streamAnalyze(body: AnalyzeRequest, signal: AbortSignal): AsyncGenerator<AnalyzeEvent> {
  if (isMock) yield* (await mock()).mockAnalyze(body, signal);
  else yield* postSSE<AnalyzeEvent>('/api/analyze', body, signal);
}

export async function remediate(body: { scenario: ScenarioId; repo: string; action: string }): Promise<void> {
  if (isMock) return;
  await request('/api/remediate', {
    method: 'POST',
    keepalive: true, // survives a page close inside the Undo window
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
