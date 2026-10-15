/* EmptyState: empty and error states state cause + next action, never "Something went wrong"
 * (docs/design.md section 5). Left-aligned.
 * Props: kind 'empty' (default; plain text, not a live region: it changes with the scenario, and an arrow key on the scenario
 * control must not read two paragraphs out) | 'error' (role=alert), title, cause, fix,
 * requestId (shown in Martian Mono when the server returned one), action / secondary ({ label, onClick }),
 * className.
 * Quiet by design: the title is Satoshi 500 in fg-1 (the data on screen is louder than its absence) and the action
 * is a secondary button, so the view keeps its one primary action elsewhere. Errors are neutral (fg-0 text, a
 * line-3 outline): red means infected on this screen, and a failed request is not a finding. Raw server and proxy
 * strings are turned into plain sentences (data/errors.ts plainError).
 * The `empty-lockfile` scribble (a magnifier over a lockfile sheet) sits left of the copy only when the state has a
 * next action and the container is at least 400px wide (the table pane; never the 320px feed, never on phones), so
 * the landing viewport stays within the two-scribbles rule. Error states and passive notes are text only.
 */
import { plainError } from '../data/errors.ts';
import { Button } from './Button.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';
import { Scribble } from './Scribble.tsx';

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
  const error = kind === 'error';
  return (
    <div role={error ? 'alert' : undefined} className={`@container animate-fade flex items-start gap-4 p-4 ${className}`}>
      {!error && action && <Scribble name="empty-lockfile" width={144} height={108} angle={135} className="hidden shrink-0 @min-[400px]:block" />}
      <div className={`flex min-w-0 flex-col items-start gap-2 ${error ? 'w-full rounded-sm border border-line-3 p-3' : ''}`}>
        <h3 className="text-md font-medium text-fg-1">{title}</h3>
        {cause && (
          <p className={`flex max-w-(--measure) items-start gap-2 text-base ${error ? 'text-fg-0' : 'text-fg-1'}`}>
            {error && <CircleAlert size={16} className="mt-1 shrink-0 text-fg-1" />}
            {error ? plainError({ message: cause }) : cause}
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
            {action && <Button onClick={action.onClick}>{action.label}</Button>}
            {secondary && (
              <Button variant="ghost" onClick={secondary.onClick}>
                {secondary.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
