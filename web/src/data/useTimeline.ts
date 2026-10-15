// Timeline hooks. useTimeline(scenario) loads the incident + minute-level counts; useExposureAt follows the
// scrubber and re-fetches the exposure list only when the tier counts change (so autoplay at 60 fps costs a
// handful of requests, not hundreds). Counts for the scrubber itself are instant: see snapshotAt().
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getExposure, getTimeline, type ExposureResponse } from './api.ts';
import { countsKey, snapshotAt } from './snapshot.ts';
import type { Exposure, IncidentMeta, ScenarioId, TimelinePoint } from './types.ts';

export interface TimelineState {
  status: 'loading' | 'ready' | 'error';
  incident: IncidentMeta | null;
  points: TimelinePoint[];
  error: { message: string; requestId?: string } | null;
}

export function useTimeline(scenario: ScenarioId) {
  const [state, setState] = useState<TimelineState>({ status: 'loading', incident: null, points: [], error: null });

  useEffect(() => {
    const ctrl = new AbortController();
    // The previous incident stays in `state` while the next one loads: the screen dims it (incident.id tells which one it is)
    // instead of wiping the whole dashboard to skeletons.
    setState((s) => ({ ...s, status: 'loading', error: null }));
    getTimeline(scenario, ctrl.signal).then(
      (t) => setState({ status: 'ready', incident: t.incident, points: t.points, error: null }),
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        const error =
          err instanceof ApiError ? { message: err.message, requestId: err.requestId } : { message: 'Could not load the timeline' };
        setState({ status: 'error', incident: null, points: [], error });
      },
    );
    return () => ctrl.abort();
  }, [scenario]);

  /** Instant, synchronous: the counts at `at` straight from the loaded timeline. */
  const snapshot = useCallback((at: number) => snapshotAt(state.points, at), [state.points]);
  return { ...state, snapshot };
}

export interface ExposureAt {
  exposures: Exposure[];
  grepCount: number | null;
  grepName: string | null;
}
const none: ExposureAt = { exposures: [], grepCount: null, grepName: null };

/** Exposure list for the scrubber position (debounced 150 ms, re-fetched only when `point`'s counts change). */
export function useExposureAt(scenario: ScenarioId, point: TimelinePoint | null): ExposureAt {
  const [value, setValue] = useState<ExposureAt & { scenario: ScenarioId | null }>({ ...none, scenario: null });
  const key = point ? countsKey(point.counts) : null;
  const atRef = useRef<number | undefined>(undefined);
  atRef.current = point?.at; // read when the counts change; the position alone never re-fetches

  useEffect(() => {
    if (key === null || atRef.current === undefined) return;
    const at = atRef.current;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      getExposure(scenario, at, ctrl.signal).then(
        // an aborted request must not overwrite a newer answer (the mock ignores the signal)
        (r) => ctrl.signal.aborted || setValue({ scenario, exposures: r.exposures, grepCount: r.grepCount, grepName: r.grepName ?? null }),
        () => {}, // the contrast card keeps its last numbers; the triage run reports real errors
      );
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [scenario, key]);

  // Another incident's answer is never shown for this one (no stale graph flash on a scenario switch).
  return value.scenario === scenario ? value : none;
}

export interface ExposureQuery {
  /** The last answer received, true at `data.at` (which can lag the scrubber while a request is in flight). */
  data: ExposureResponse | null;
  /** The scrubber position a request is pending for, or null when the answer is current. */
  loadingAt: number | null;
  error: { message: string; status?: number; requestId?: string; at: number } | null;
}

/**
 * Re-queries /api/exposure whenever the scrubber settles on a new time (debounced 250 ms, the previous request is
 * aborted). Used after a triage report: every number on screen must be true at a clock the UI can name, so the
 * caller labels the data with `data.at`, never with the scrubber position. `at` null disables it; bump `retry`
 * to re-ask the same time after an error.
 */
export function useExposureQuery(scenario: ScenarioId, at: number | null, retry = 0): ExposureQuery {
  const [state, setState] = useState<ExposureQuery>({ data: null, loadingAt: null, error: null });

  useEffect(() => {
    if (at === null) return setState({ data: null, loadingAt: null, error: null });
    setState((s) => ({ ...s, loadingAt: at, error: null }));
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      getExposure(scenario, at, ctrl.signal).then(
        (data) => ctrl.signal.aborted || setState({ data, loadingAt: null, error: null }),
        (err: unknown) => {
          if (ctrl.signal.aborted) return;
          const e = err instanceof ApiError ? { message: err.message, status: err.status, requestId: err.requestId } : { message: 'Could not update the exposure list' };
          setState((s) => ({ ...s, loadingAt: null, error: { ...e, at } }));
        },
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [scenario, at, retry]);

  return state;
}
