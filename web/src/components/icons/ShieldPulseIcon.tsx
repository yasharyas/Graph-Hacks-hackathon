/* ShieldPulseIcon: the alert banner icon when a free-text alert is parsed.
 * Props: alert (pulse while true), pulseKey (change it to re-arm for a new alert), size, title, className.
 * The outline scales 1 to 1.35 and fades, twice, then stays still (CSS animate-pulse-ring).
 * Reduced motion: a static shield with a 20% fill.
 */
import { useReducedMotion } from 'motion/react';
import { IconFrame, type IconProps } from './IconFrame.tsx';

const SHIELD =
  'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';

export function ShieldPulseIcon({ alert = false, pulseKey, ...frame }: IconProps & { alert?: boolean; pulseKey?: string | number }) {
  const reduce = useReducedMotion();
  return (
    <IconFrame {...frame}>
      {alert && !reduce && (
        <g key={pulseKey} className="animate-pulse-ring" style={{ transformOrigin: '12px 12px' }}>
          <path d={SHIELD} />
        </g>
      )}
      <path d={SHIELD} fill={reduce ? 'currentColor' : 'none'} fillOpacity={reduce ? 0.2 : undefined} />
    </IconFrame>
  );
}
