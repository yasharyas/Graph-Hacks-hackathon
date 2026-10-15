/* OnboardingHint: the single inline hint that replaces the coach-mark tour (docs/design.md section 5). Three steps,
 * each naming the control it points at, in the order a first visit should take them; the only action is Dismiss.
 * Props: onDismiss. Shown once (the parent persists the dismissal in localStorage). role=note, no scrim, no focus
 * stealing, Esc not required. The `coach-hint` scribble underlines step 1 and hooks down toward the panes; it hangs
 * below the card into its own margin, so it is hidden under 1024px where the steps can wrap onto two lines.
 */
import { Button } from './Button.tsx';
import { Scribble } from './Scribble.tsx';

const STEPS: [string, string][] = [
  ['Click a row', ' to see its path'],
  ['Click Cypher', ' on a tool card to read the query'],
  ['Paste your repo', ' to triage it'],
];

export function OnboardingHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="note" className="animate-enter mx-(--gutter) mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-sm border border-line-2 bg-bg-2 px-4 py-1.5 text-sm text-fg-0">
      <ol className="flex flex-wrap gap-x-5 gap-y-1">
        {STEPS.map(([verb, rest], i) => (
          <li key={verb} className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xs text-fg-2 tabular-nums" aria-hidden>
              {i + 1}
            </span>
            <span>
              {i === 0 ? (
                <span className="relative inline-block">
                  {verb}
                  <Scribble name="coach-hint" width={96} height={32} duration={400} className="absolute top-4 left-0 hidden lg:block" />
                </span>
              ) : (
                verb
              )}
              {rest}
            </span>
          </li>
        ))}
      </ol>
      <Button variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
