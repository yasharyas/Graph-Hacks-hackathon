/* CheckDrawIcon: circle then check draw on a verified claim, the claims badge, or "copied". At most 450ms.
 * Props: animate (default true; false = static, used past the first 6 chips), delay (seconds, for the 40ms
 * stagger), size, title, className. Reduced motion: a 120ms fade instead of the draw.
 */
import { motion, useReducedMotion } from 'motion/react';
import { IconFrame, type IconProps } from './IconFrame.tsx';
import { motionTokens } from './motionTokens.ts';

export function CheckDrawIcon({ animate = true, delay = 0, ...frame }: IconProps & { animate?: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  const { fade, easeOut } = motionTokens();
  const initial = !animate ? false : reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 };
  return (
    <IconFrame {...frame}>
      <motion.circle
        cx="12"
        cy="12"
        r="9"
        initial={initial}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: reduce ? fade : 0.24, delay, ease: easeOut }}
      />
      <motion.path
        d="M7 12.5 10.5 16 17 9"
        initial={initial}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: reduce ? fade : 0.2, delay: reduce ? delay : delay + 0.24, ease: easeOut }}
      />
    </IconFrame>
  );
}
