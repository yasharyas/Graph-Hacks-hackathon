// useTriage(): the single owner of a triage run's state. Consumes the SSE (or mock) stream, folds each
// TriageEvent into state, and exposes run / ask / abort. Components only read this state.
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ApiError, streamAsk, streamTriage, type TriageRequest } from './api.ts';
import type { IncidentMeta, LlmMode, Report, ToolName, ToolResult, TriageEvent } from './types.ts';

export interface TriageError {
  message: string;
  requestId?: string;
  /** HTTP status when the failure was a response (0 = network down); absent for stream events. */
  status?: number;
}
export interface ToolCardState {
  /** `${round}:${event id}`: unique across the triage (round 0) and its Ask follow-ups. */
  id: string;
  tool: ToolName;
  params: Record<string, unknown>;
  status: 'pending' | 'done' | 'error' | 'cancelled';
  result?: ToolResult;
  error?: TriageError;
  /** Date.now() when tool_start arrived, for the "waiting for FalkorDB... 4 s" staged text. */
  startedAt: number;
  /** 0 for the triage run, 1..n for Ask follow-ups. */
  round: number;
}
export interface Narration {
  mode: LlmMode;
  provider: string | null;
  /** The deterministic Verdict / Notify / Do built from the report. */
  text: string;
  /** An optional short analyst summary written by the LLM (server-guarded); `mode` / `provider` describe it. */
  note?: string | null;
  /** The scenario clock this narration describes (epoch ms): the narrative dims when the scrubber is elsewhere. */
  at?: number;
}
export interface Guard {
  verified: number;
  total: number;
  flagged: string[];
  /** Every claim the server checked. The UI marks a span verified only if it is listed here with ok=true. */
  claims: { text: string; ok: boolean }[];
}
export interface FollowUp {
  question: string;
  narration: Narration | null;
  guard: Guard | null;
  status: 'running' | 'done' | 'error';
}
export interface TriageState {
  status: 'idle' | 'running' | 'done' | 'error' | 'aborted';
  runId: string | null;
  graph: string | null;
  incident: IncidentMeta | null;
  /** Scenario clock of the run (epoch ms). */
  at: number | null;
  toolCards: ToolCardState[];
  report: Report | null;
  narration: Narration | null;
  guard: Guard | null;
  /** LLM mode of the triage narration: live / replay / template. */
  mode: LlmMode | null;
  followUps: FollowUp[];
  error: TriageError | null;
  /** Total run time reported by the server (ms). */
  ms: number | null;
}

const initial: TriageState = {
  status: 'idle',
  runId: null,
  graph: null,
  incident: null,
  at: null,
  toolCards: [],
  report: null,
  narration: null,
  guard: null,
  mode: null,
  followUps: [],
  error: null,
  ms: null,
};

type Action =
  | { kind: 'reset' }
  | { kind: 'ask'; question: string }
  | { kind: 'event'; event: TriageEvent }
  | { kind: 'fail'; error: TriageError }
  | { kind: 'abort' }
  | { kind: 'end' };

const asking = (s: TriageState) => s.followUps.at(-1)?.status === 'running';
const patchLast = (s: TriageState, patch: Partial<FollowUp>): FollowUp[] =>
  s.followUps.map((f, i) => (i === s.followUps.length - 1 ? { ...f, ...patch } : f));
const settle = (cards: ToolCardState[], status: 'error' | 'cancelled', error?: TriageError): ToolCardState[] =>
  cards.map((c) => (c.status === 'pending' ? { ...c, status, error } : c));

function reduce(s: TriageState, a: Action): TriageState {
  switch (a.kind) {
    case 'reset':
      return { ...initial, status: 'running' };
    case 'ask':
      return { ...s, error: null, followUps: [...s.followUps, { question: a.question, narration: null, guard: null, status: 'running' }] };
    case 'fail':
      return asking(s)
        ? { ...s, error: a.error, followUps: patchLast(s, { status: 'error' }), toolCards: settle(s.toolCards, 'error', a.error) }
        : { ...s, status: 'error', error: a.error, toolCards: settle(s.toolCards, 'error', a.error) };
    case 'abort':
      return asking(s)
        ? { ...s, followUps: patchLast(s, { status: 'done' }), toolCards: settle(s.toolCards, 'cancelled') }
        : s.status === 'running'
          ? { ...s, status: 'aborted', toolCards: settle(s.toolCards, 'cancelled') }
          : s;
    case 'end': // stream closed: if the server never sent `done`, say so rather than spin forever
      return s.status === 'running' || asking(s)
        ? reduce(s, { kind: 'fail', error: { message: 'The stream ended before the run finished' } })
        : s;
    case 'event':
      return fold(s, a.event);
  }
}

function fold(s: TriageState, e: TriageEvent): TriageState {
  const round = s.followUps.length;
  switch (e.type) {
    case 'start':
      return { ...s, runId: e.runId, graph: e.graph, incident: e.incident, at: e.at };
    case 'tool_start':
      return {
        ...s,
        toolCards: [...s.toolCards, { id: `${round}:${e.id}`, tool: e.tool, params: e.params, status: 'pending', startedAt: Date.now(), round }],
      };
    case 'tool_result':
      return {
        ...s,
        toolCards: s.toolCards.map((c) => (c.id === `${round}:${e.id}` ? { ...c, status: 'done', result: e.result } : c)),
      };
    case 'report':
      return { ...s, report: e.report };
    case 'narration': {
      const narration = { mode: e.mode, provider: e.provider, text: e.text, note: e.note ?? null, at: e.at };
      return asking(s) ? { ...s, followUps: patchLast(s, { narration }) } : { ...s, narration, mode: e.mode };
    }
    case 'guard': {
      const guard = { verified: e.verified, total: e.total, flagged: e.flagged, claims: e.claims ?? [] };
      return asking(s) ? { ...s, followUps: patchLast(s, { guard }) } : { ...s, guard };
    }
    case 'error':
      return reduce(s, { kind: 'fail', error: { message: e.message, requestId: e.requestId } });
    case 'done':
      return asking(s) ? { ...s, followUps: patchLast(s, { status: 'done' }) } : { ...s, status: 'done', ms: e.ms };
  }
}

const toError = (err: unknown): TriageError =>
  err instanceof ApiError
    ? { message: err.message, requestId: err.requestId, status: err.status }
    : { message: err instanceof Error ? err.message : 'Unexpected error' };

export function useTriage() {
  const [state, dispatch] = useReducer(reduce, initial);
  const ctl = useRef<AbortController | null>(null);

  const consume = useCallback(async (stream: AsyncIterable<TriageEvent>, ctrl: AbortController) => {
    try {
      for await (const event of stream) dispatch({ kind: 'event', event });
      dispatch({ kind: 'end' });
    } catch (err) {
      if (!ctrl.signal.aborted) dispatch({ kind: 'fail', error: toError(err) });
    }
  }, []);

  const start = useCallback(() => {
    ctl.current?.abort();
    return (ctl.current = new AbortController());
  }, []);

  /** Start a triage for a scenario, a free-text alert, or a guest graph. Replaces any run in flight. */
  const run = useCallback(
    (input: TriageRequest) => {
      const ctrl = start();
      dispatch({ kind: 'reset' });
      void consume(streamTriage(input, ctrl.signal), ctrl);
    },
    [consume, start],
  );

  /** Ask a follow-up about the current triage (the server bounds this at 4 rounds). */
  const ask = useCallback(
    (question: string) => {
      if (!state.runId) return;
      const ctrl = start();
      dispatch({ kind: 'ask', question });
      void consume(streamAsk({ runId: state.runId, question }, ctrl.signal), ctrl);
    },
    [consume, start, state.runId],
  );

  const abort = useCallback(() => {
    ctl.current?.abort();
    dispatch({ kind: 'abort' });
  }, []);

  useEffect(() => () => ctl.current?.abort(), []);

  return { ...state, asking: asking(state), run, ask, abort };
}
