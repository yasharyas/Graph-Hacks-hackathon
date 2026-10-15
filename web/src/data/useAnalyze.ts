// useAnalyze(): paste-a-repo flow. POST /api/analyze streams AnalyzeEvents (fetch -> parse -> write -> enrich ->
// admits); resolves with the guest graph name so the caller can start a triage with `{ guest, scenario }`.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, streamAnalyze, type AnalyzeRequest } from './api.ts';
import type { AnalyzeEvent } from './types.ts';

export interface AnalyzeState {
  status: 'idle' | 'running' | 'ready' | 'error';
  stage: Extract<AnalyzeEvent, { type: 'progress' }> | null;
  repo: string | null;
  error: { message: string; requestId?: string; status?: number } | null;
}
const idle: AnalyzeState = { status: 'idle', stage: null, repo: null, error: null };

export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>(idle);
  const ctl = useRef<AbortController | null>(null);

  const analyze = useCallback(async (req: AnalyzeRequest): Promise<string | null> => {
    ctl.current?.abort();
    const ctrl = (ctl.current = new AbortController());
    setState({ ...idle, status: 'running' });
    try {
      for await (const e of streamAnalyze(req, ctrl.signal)) {
        if (e.type === 'progress') setState((s) => ({ ...s, stage: e }));
        else if (e.type === 'error') {
          setState({ ...idle, status: 'error', error: { message: e.message, requestId: e.requestId } });
          return null;
        } else {
          setState({ status: 'ready', stage: null, repo: e.repo, error: null });
          return e.graph;
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) return null;
      const error =
        err instanceof ApiError
          ? { message: err.message, requestId: err.requestId, status: err.status }
          : { message: 'Unexpected error while analyzing' };
      setState({ ...idle, status: 'error', error });
    }
    return null;
  }, []);

  const reset = useCallback(() => {
    ctl.current?.abort();
    setState(idle);
  }, []);

  useEffect(() => () => ctl.current?.abort(), []);
  return { ...state, analyze, reset };
}
