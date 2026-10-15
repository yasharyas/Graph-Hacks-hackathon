/* OnboardingHint: the single inline hint that replaces the coach-mark tour (docs/design.md section 5).
 * Props: onDismiss. Rendered by App only once a report exists, inside the table pane, aimed at the table (it names the
 * two things to do with it), and dismissed for good on the first row click, Fix or Cypher use (App decides) or Dismiss.
 * Desktop only (>= 1024px): `hidden lg:flex` keeps it out of the layout and the accessibility tree on phones and tablets,
 * where there is no hover and "Click" would be wrong. role=note, no scrim, no focus stealing.
 */
import { Button } from './Button.tsx';

export function OnboardingHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="note" className="animate-enter hidden items-center justify-between gap-3 border-b border-line-1 bg-bg-2 py-0.5 pr-1 pl-3 text-sm text-fg-0 lg:flex">
      <p>
        Click a row to draw its path. Open <span className="font-mono text-xs">Cypher</span> in the feed.
      </p>
      <Button variant="ghost" onClick={onDismiss} className="h-8 shrink-0 px-2">
        Dismiss
      </Button>
    </div>
  );
}
