// Timeline hooks. useTimeline(scenario) loads the incident + minute-level counts; useExposureAt follows the
// scrubber and re-fetches the exposure list only when the tier counts change (so autoplay at 60 fps costs a
// handful of requests, not hundreds). Counts for the scrubber itself are instant: see snapshotAt().
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getExposure, getTimeline } from './api.ts';
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
    setState({ status: 'loading', incident: null, points: [], error: null });
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
  const [value, setValue] = useState<ExposureAt>(none);
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
        (r) => ctrl.signal.aborted || setValue({ exposures: r.exposures, grepCount: r.grepCount, grepName: r.grepName ?? null }),
        () => {}, // the contrast card keeps its last numbers; the triage run reports real errors
      );
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [scenario, key]);

  return value;
}
