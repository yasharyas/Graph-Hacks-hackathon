/* Button + IconButton (docs/design.md section 5: Buttons).
 * Button props: variant 'primary' | 'secondary' (default) | 'ghost', loading (label stays, radar replaces the
 * icon, width kept, aria-busy), icon (leading ReactNode), plus every native <button> prop.
 * IconButton props: label (required: becomes aria-label and title), icon, plus native <button> props.
 * One primary per view. Press scale and hover colour are in styles.css (.btn / .icon-btn).
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { RadarIcon } from './icons/RadarIcon.tsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', loading = false, icon, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} ${className}`}
    >
      {loading ? <RadarIcon size={14} /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
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
