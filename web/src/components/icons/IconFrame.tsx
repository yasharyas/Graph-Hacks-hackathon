/* IconFrame: the shared Lucide-style SVG shell for every icon (24x24 viewBox, 1.75px stroke, round caps and
 * joins, currentColor). Props: size (16 | 20 | 24, default 20), title (rendered as <title> + aria-label;
 * omit it for a decorative icon, which becomes aria-hidden), className.
 */
import type { ReactNode } from 'react';

export interface IconProps {
  size?: number;
  title?: string;
  className?: string;
}

export function IconFrame({ size = 20, title, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={className}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
