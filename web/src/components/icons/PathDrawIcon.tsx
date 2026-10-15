/* PathDrawIcon: a chain that draws itself when a path is explained or a row is selected.
 * Props: play (default true), replayKey (change it to replay for a new selection, interrupting the last),
 * size, title, className. Reduced motion: appears complete.
 */
import { motion, useReducedMotion } from 'motion/react';
import { IconFrame, type IconProps } from './IconFrame.tsx';
import { motionTokens } from './motionTokens.ts';

const NODES: [number, number][] = [
  [3, 17],
  [9, 7],
  [15, 17],
  [21, 7],
];

export function PathDrawIcon({ play = true, replayKey, ...frame }: IconProps & { play?: boolean; replayKey?: string | number }) {
  const reduce = useReducedMotion();
  const draw = play && !reduce;
  const { draw: dur, easeOut } = motionTokens();
  return (
    <IconFrame {...frame}>
      <g key={`${draw}-${replayKey}`}>
        <motion.path
          d="M3 17 L9 7 L15 17 L21 7"
          initial={draw ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: dur, ease: easeOut }}
        />
        {NODES.map(([cx, cy], i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r={2}
            fill="currentColor"
            stroke="none"
            initial={draw ? { scale: 0.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.16, delay: draw ? 0.12 * i : 0, ease: easeOut }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
      </g>
    </IconFrame>
  );
}
