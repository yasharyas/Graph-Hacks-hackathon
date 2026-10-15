// Scrubber clock. Autoplays `from` to `to` over `durationMs` on first load (docs/design.md: the 12 s landing
// autoplay). The position is floored to whole minutes, so a 12 s run is ~90 React updates, not 720.
// Reduced motion: the final state renders at once; pressing Play then steps in 5-minute jumps.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const MIN = 60_000;
const floorMin = (ms: number) => Math.floor(ms / MIN) * MIN;

/** `startAt`: a position restored from a shared link (epoch ms, clamped by the caller): the track opens there, paused, instead of autoplaying. */
export function usePlayback(from: number | null, to: number | null, durationMs = 12_000, startAt: number | null = null) {
  const reduce = useReducedMotion();
  const [at, setAt] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const startRef = useRef(startAt);
  startRef.current = startAt;

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    setPlaying(false);
  }, []);

  const playFrom = useCallback(
    (origin: number) => {
      if (from === null || to === null) return;
      cancelAnimationFrame(raf.current);
      const span = to - origin;
      const duration = (durationMs * span) / (to - from);
      const t0 = performance.now();
      setPlaying(true);
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const next = origin + span * p;
        setAt(reduce ? Math.floor(next / (5 * MIN)) * 5 * MIN : floorMin(next));
        if (p < 1) raf.current = requestAnimationFrame(tick);
        else setPlaying(false);
      };
      raf.current = requestAnimationFrame(tick);
    },
    [from, to, durationMs, reduce],
  );

  /** Play from the current position, or from the start when already at the end. */
  const play = useCallback(() => {
    if (from !== null && to !== null) playFrom(at === null || at >= to ? from : at);
  }, [at, from, to, playFrom]);

  const seek = useCallback(
    (next: number) => {
      stop();
      setAt(next);
    },
    [stop],
  );

  // First load (and each scenario change): autoplay, or jump to the end under reduced motion.
  useEffect(() => {
    if (from === null || to === null) return;
    if (startRef.current !== null && startRef.current >= from) setAt(floorMin(Math.min(startRef.current, to)));
    else if (reduce) setAt(to);
    else {
      setAt(from);
      playFrom(from);
    }
    return () => cancelAnimationFrame(raf.current);
    // restart only when the track changes, not when playFrom's identity does
  }, [from, to]);

  return { at, playing, play, pause: stop, seek };
}
