// "Mark remediated" with a 10 s Undo window: the row shows remediated immediately, and the write to
// POST /api/remediate is committed only once the window closes (so Undo needs no server endpoint).
// ponytail: closing the tab inside the 10 s window drops the write; add a keepalive/sendBeacon if that matters.
import { useCallback, useEffect, useRef, useState } from 'react';
import { remediate } from './api.ts';
import type { ScenarioId } from './types.ts';

const UNDO_MS = 10_000;

export function useRemediation(scenario: ScenarioId | null, onCommitError: (repo: string) => void) {
  const [done, setDone] = useState<Record<string, number>>({}); // repo -> epoch ms
  const [undoable, setUndoable] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, number>());

  const drop = useCallback((repo: string) => {
    window.clearTimeout(timers.current.get(repo));
    timers.current.delete(repo);
    setDone(({ [repo]: _gone, ...rest }) => rest);
    setUndoable((s) => new Set([...s].filter((r) => r !== repo)));
  }, []);

  const mark = useCallback(
    (repo: string) => {
      setDone((d) => ({ ...d, [repo]: Date.now() }));
      setUndoable((s) => new Set(s).add(repo));
      timers.current.set(
        repo,
        window.setTimeout(() => {
          timers.current.delete(repo);
          setUndoable((s) => new Set([...s].filter((r) => r !== repo)));
          if (scenario) remediate({ scenario, repo, action: 'remediated' }).catch(() => (drop(repo), onCommitError(repo)));
        }, UNDO_MS),
      );
    },
    [scenario, drop, onCommitError],
  );

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return { remediated: done, undoable, mark, undo: drop, undoMs: UNDO_MS };
}
