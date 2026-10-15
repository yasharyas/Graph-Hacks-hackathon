/* RadarIcon: sweeps only while a query is actually running (the pending tool card, never the header).
 * Props: active (default true; false = still), size, title, className.
 * The sweep and blip are CSS keyframes (animate-radar-sweep / animate-radar-blip) so they stay smooth while
 * React renders tool results. Reduced motion or inactive: a still ring and dot at 60% opacity.
 */
import { useReducedMotion } from 'motion/react';
import { IconFrame, type IconProps } from './IconFrame.tsx';

export function RadarIcon({ active = true, ...frame }: IconProps & { active?: boolean }) {
  const reduce = useReducedMotion();
  const still = !active || reduce;
  return (
    <IconFrame {...frame}>
      <g opacity={still ? 0.6 : 1}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" strokeDasharray="2 2" />
        {!still && (
          <g className="animate-radar-sweep" style={{ transformOrigin: '12px 12px' }}>
            <path d="M12 12V3" />
          </g>
        )}
        <circle cx="16" cy="9" r="1.5" fill="currentColor" stroke="none" className={still ? undefined : 'animate-radar-blip'} />
      </g>
    </IconFrame>
  );
}
