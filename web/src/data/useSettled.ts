// useSettled(value, ms, hold): `value` once it has stopped changing for `ms`, and frozen while `hold` (autoplay). The
// scrubber moves the playhead every frame; anything that is announced to a screen reader or reflows the page because the
// clock moved waits for this instead (the slider reads its own aria-valuetext on every step).
// `snap(v)` settles at once: a move the app made itself (a run aligning the scrubber with its own clock, "Back to 13:30")
// is not a scrub, and waiting `ms` would leave the old clock on screen, claiming the clock moved when it had not.
import { useCallback, useEffect, useState } from 'react';

export function useSettled<T>(value: T, ms: number, hold = false): [T, (v: T) => void] {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (hold) return;
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms, hold]);
  const snap = useCallback((v: T) => setSettled(v), []);
  return [settled, snap];
}
