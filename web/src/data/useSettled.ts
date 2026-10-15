// useSettled(value, ms, hold): `value` once it has stopped changing for `ms`, and frozen while `hold` (autoplay). The
// scrubber moves the playhead every frame; anything that is announced to a screen reader or reflows the page because the
// clock moved waits for this instead (the slider reads its own aria-valuetext on every step).
import { useEffect, useState } from 'react';

export function useSettled<T>(value: T, ms: number, hold = false): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (hold) return;
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms, hold]);
  return settled;
}
