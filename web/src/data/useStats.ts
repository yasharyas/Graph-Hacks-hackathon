// useStats(scenario, active): node and edge counts of the scenario's demo graph (GET /api/stats), fetched when first
// needed and kept per scenario. These are the counts of the graph itself, before and apart from any triage run.
import { useEffect, useRef, useState } from 'react';
import { ApiError, isMock } from './api.ts';
import type { ScenarioId } from './types.ts';

export interface GraphStats {
  graph: string;
  nodes: { label: string; count: number }[];
  edges: { type: string; count: number }[];
  ms: number;
}
export interface StatsState {
  data: GraphStats | null;
  error: string | null;
  loading: boolean;
}

export function useStats(scenario: ScenarioId, active: boolean, retry = 0): StatsState {
  const cache = useRef(new Map<ScenarioId, GraphStats>());
  const [state, setState] = useState<StatsState>({ data: null, error: null, loading: false });

  useEffect(() => {
    if (!active) return;
    const hit = cache.current.get(scenario);
    if (hit) return setState({ data: hit, error: null, loading: false });
    if (isMock) return setState({ data: null, error: 'Mock mode has no live graph to count.', loading: false });
    const ctrl = new AbortController();
    setState({ data: null, error: null, loading: true });
    fetch(`/api/stats?scenario=${scenario}`, { signal: ctrl.signal, headers: { accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
        return (await res.json()) as GraphStats;
      })
      .then(
        (data) => (cache.current.set(scenario, data), setState({ data, error: null, loading: false })),
        (err: unknown) => ctrl.signal.aborted || setState({ data: null, error: err instanceof ApiError ? err.message : 'Cannot reach the Patient Zero server', loading: false }),
      );
    return () => ctrl.abort();
  }, [scenario, active, retry]);

  return state;
}
