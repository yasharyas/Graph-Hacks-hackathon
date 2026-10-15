/* Button + IconButton (docs/design.md section 5: Buttons).
 * Button props: variant 'primary' | 'secondary' (default) | 'ghost', loading (label stays, radar replaces the
 * icon, width kept, aria-busy), icon (leading ReactNode), plus every native <button> prop.
 * A loading button is aria-disabled, not disabled: it ignores clicks but keeps the keyboard focus (a disabled button drops
 * it to <body>, WCAG 2.4.3), and screen readers still hear it is unavailable.
 * IconButton props: label (required: becomes aria-label and title), icon, plus native <button> props (a ref too).
 * One primary per view. Press scale and hover colour are in styles.css (.btn / .icon-btn).
 */
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { RadarIcon } from './icons/RadarIcon.tsx';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', loading = false, icon, className = '', children, disabled, onClick, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      className={`btn btn-${variant} ${className}`}
    >
      {loading ? <RadarIcon size={14} /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ComponentPropsWithRef<'button'> {
  label: string;
  icon: ReactNode;
}

export function IconButton({ label, icon, className = '', ...rest }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={`icon-btn ${className}`}>
      {icon}
    </button>
  );
}
