/* AskBox: follow-up questions under the narrative (docs/design.md section 5). Bounded to 4 rounds.
 * Props: disabled (no triage to ask about yet), asking (a follow-up is running), rounds (used so far),
 *        max (default 4), error (last follow-up failure, shown with requestId), onAsk(question).
 * Answers arrive as tool cards + narration in the feed. Label always visible; the round counter is polite text.
 */
import { useId, useState } from 'react';
import type { TriageError } from '../data/useTriage.ts';
import { Button } from './Button.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';

export function AskBox({
  disabled,
  asking,
  rounds,
  max = 4,
  error,
  onAsk,
}: {
  disabled: boolean;
  asking: boolean;
  rounds: number;
  max?: number;
  error: TriageError | null;
  onAsk: (question: string) => void;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const limit = rounds >= max;
  const ok = q.trim().length > 0 && !disabled && !asking && !limit;
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        onAsk(q.trim());
        setQ('');
      }}
    >
      <label htmlFor={id} className="text-xs text-fg-1">
        Ask about this triage
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="field"
          maxLength={500}
          autoComplete="off"
          disabled={disabled || limit}
          value={q}
          placeholder="Which team should I notify first?"
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={asking} disabled={!ok && !asking}>
          Ask
        </Button>
      </div>
      <p className="text-xs text-fg-2" role="status">
        {limit ? `Follow-up limit reached (${max} per triage). Run the triage again to ask more.` : `Round ${Math.min(rounds + 1, max)} of ${max}`}
      </p>
      {error && !asking && (
        <p role="alert" className="flex items-start gap-2 text-sm text-infect-400">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            {error.message}
            {error.requestId && <span className="ml-2 font-mono text-xs text-fg-2">request {error.requestId}</span>}
          </span>
        </p>
      )}
    </form>
  );
}
