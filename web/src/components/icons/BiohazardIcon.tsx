/* BiohazardIcon: scenario segments. Turns ONCE when a run starts, never loops, never while merely selected.
 * Props: turn (true = play the single turn), turnKey (change it to turn again for the next run), size, title,
 * className. Reduced motion: still.
 * Geometry: a centre circle, three spokes and three arcs, drawn Lucide-style (not the Unicode glyph).
 */
import { useReducedMotion } from 'motion/react';
import { IconFrame, type IconProps } from './IconFrame.tsx';

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
};
const SPOKE_ANGLES = [-90, 30, 150];
const SPOKES = SPOKE_ANGLES.map((a) => `M${pt(3.6, a)}L${pt(9, a)}`).join('');
const ARCS = SPOKE_ANGLES.map((a) => `M${pt(9, a - 40)}A9 9 0 0 1 ${pt(9, a + 40)}`).join('');

export function BiohazardIcon({ turn = false, turnKey, ...frame }: IconProps & { turn?: boolean; turnKey?: string | number }) {
  const reduce = useReducedMotion();
  return (
    <IconFrame {...frame}>
      <g key={turnKey} className={turn && !reduce ? 'animate-turn-once' : undefined} style={{ transformOrigin: '12px 12px' }}>
        <circle cx="12" cy="12" r="2" />
        <path d={SPOKES} />
        <path d={ARCS} />
      </g>
    </IconFrame>
  );
}
