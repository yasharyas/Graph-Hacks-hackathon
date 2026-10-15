// Icon timings come from the CSS tokens (--dur-draw, --dur-fade, --ease-out), read once, so icons never
// hardcode numbers (docs/design.md section 7). Under prefers-reduced-motion the CSS already zeroes --dur-draw.
export interface MotionTokens {
  draw: number; // seconds
  fade: number; // seconds
  easeOut: [number, number, number, number];
}

const fallback: MotionTokens = { draw: 0.6, fade: 0.12, easeOut: [0.23, 1, 0.32, 1] };
let cached: MotionTokens | null = null;

const seconds = (v: string, dflt: number) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? dflt : v.trim().endsWith('ms') ? n / 1000 : n;
};

export function motionTokens(): MotionTokens {
  if (cached) return cached;
  if (typeof document === 'undefined') return fallback;
  const css = getComputedStyle(document.documentElement);
  const bezier = css.getPropertyValue('--ease-out').match(/-?\d*\.?\d+/g)?.map(Number);
  cached = {
    draw: seconds(css.getPropertyValue('--dur-draw'), fallback.draw),
    fade: seconds(css.getPropertyValue('--dur-fade'), fallback.fade),
    easeOut: bezier?.length === 4 ? (bezier as MotionTokens['easeOut']) : fallback.easeOut,
  };
  return cached;
}
