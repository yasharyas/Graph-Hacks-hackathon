/* EmptyState: empty and error states state cause + next action, never "Something went wrong"
 * (docs/design.md section 5). Left-aligned.
 * Props: kind 'empty' (role=status, default) | 'error' (role=alert, cause line in red), title, cause, fix,
 * requestId (shown in Martian Mono when the server returned one), action / secondary ({ label, onClick }),
 * className. The `empty-lockfile` scribble (Phase 3) is not yet shipped; add it left of the copy when it is.
 */
import { Button } from './Button.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';

interface Act {
  label: string;
  onClick: () => void;
}
export interface EmptyStateProps {
  kind?: 'empty' | 'error';
  title: string;
  cause?: string;
  fix?: string;
  requestId?: string;
  action?: Act;
  secondary?: Act;
  className?: string;
}

export function EmptyState({ kind = 'empty', title, cause, fix, requestId, action, secondary, className = '' }: EmptyStateProps) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`animate-fade flex flex-col items-start gap-2 p-4 ${className}`}>
      <h3 className="font-display text-xl font-extrabold text-fg-0">{title}</h3>
      {cause && (
        <p className={`flex max-w-(--measure) items-start gap-2 text-base ${kind === 'error' ? 'text-infect-400' : 'text-fg-1'}`}>
          {kind === 'error' && <CircleAlert size={16} className="mt-1 shrink-0" />}
          {cause}
        </p>
      )}
      {fix && <p className="max-w-(--measure) text-base text-fg-1">{fix}</p>}
      {requestId && (
        <p className="font-mono text-xs text-fg-2">
          request <span className="select-all text-fg-1">{requestId}</span>
        </p>
      )}
      {(action || secondary) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {action && (
            <Button variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondary && <Button onClick={secondary.onClick}>{secondary.label}</Button>}
        </div>
      )}
    </div>
  );
}
