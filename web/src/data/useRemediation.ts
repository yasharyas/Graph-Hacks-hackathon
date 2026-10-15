// "Mark remediated" with a 10 s Undo window: the row shows remediated immediately, and the write to
// POST /api/remediate is committed once the window closes (so Undo needs no server endpoint). A re-run, a
// scenario change or closing the page commits every pending mark first, so a re-run always shows what you marked.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, remediate } from './api.ts';
import type { ScenarioId } from './types.ts';

const UNDO_MS = 10_000;

export function useRemediation(scenario: ScenarioId | null, onCommitError: (repo: string, why: string) => void) {
  const [done, setDone] = useState<Record<string, number>>({}); // repo -> epoch ms, for the current scenario
  const [undoable, setUndoable] = useState<ReadonlySet<string>>(new Set());
  const pending = useRef(new Map<string, { timer: number; scenario: ScenarioId }>());
  const latest = useRef({ scenario, onCommitError });
  latest.current = { scenario, onCommitError };

  const drop = useCallback((repo: string) => {
    window.clearTimeout(pending.current.get(repo)?.timer);
    pending.current.delete(repo);
    setDone(({ [repo]: _gone, ...rest }) => rest);
    setUndoable((s) => new Set([...s].filter((r) => r !== repo)));
  }, []);

  const commit = useCallback(
    (repo: string): Promise<void> => {
      const p = pending.current.get(repo);
      if (!p) return Promise.resolve();
      window.clearTimeout(p.timer);
      pending.current.delete(repo);
      setUndoable((s) => new Set([...s].filter((r) => r !== repo)));
      return remediate({ scenario: p.scenario, repo, action: 'remediated' }).catch((err: unknown) => {
        drop(repo);
        latest.current.onCommitError(repo, err instanceof ApiError ? err.message : 'The server could not be reached.');
      });
    },
    [drop],
  );

  const mark = useCallback(
    (repo: string) => {
      if (!latest.current.scenario) return;
      setDone((d) => ({ ...d, [repo]: Date.now() }));
      setUndoable((s) => new Set(s).add(repo));
      pending.current.set(repo, { scenario: latest.current.scenario, timer: window.setTimeout(() => void commit(repo), UNDO_MS) });
    },
    [commit],
  );

  /** Commit every mark still inside its Undo window (before a re-run). */
  const flush = useCallback(() => Promise.all([...pending.current.keys()].map(commit)).then(() => undefined), [commit]);

  // marks belong to one incident's graph: a different scenario starts clean
  useEffect(() => {
    void flush();
    setDone({});
  }, [scenario, flush]);
  // closing the tab inside the window: the request is kept alive by the browser (see api.remediate)
  useEffect(() => {
    const onHide = () => void flush();
    addEventListener('pagehide', onHide);
    return () => removeEventListener('pagehide', onHide);
  }, [flush]);

  return { remediated: done, undoable, mark, undo: drop, flush, undoMs: UNDO_MS };
}
