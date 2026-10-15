/* OnboardingHint: the single inline hint that replaces the coach-mark tour (docs/design.md section 5).
 * Props: onDismiss. Shown once (the parent persists the dismissal in localStorage). role=note, no scrim, no
 * focus stealing, Esc not required. The `coach-hint` scribble (Phase 3) is not shipped yet; place it left of the
 * copy when it exists.
 */
import { Button } from './Button.tsx';

export function OnboardingHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="note" className="animate-enter mx-(--gutter) mb-3 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line-2 bg-bg-2 px-4 py-1.5 text-sm text-fg-0">
      <p>
        Click a row to see its path <span className="text-fg-2">·</span> Show Cypher on any card <span className="text-fg-2">·</span> Paste your own repo
      </p>
      <Button variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
