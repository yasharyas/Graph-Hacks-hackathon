/* AskBox: follow-up questions under the narrative (docs/design.md section 5). Bounded to 4 follow-ups per triage.
 * Props: disabled (no triage to ask about yet, or one is still running), asking (a follow-up is running),
 *        rounds (answered or running so far; a failed ask is not counted), max (default 4),
 *        error (last follow-up failure, with status and requestId), onAsk(question).
 * Answers arrive as tool cards + a guarded narration in the feed. While one runs the field is read-only (it keeps
 * focus, so a keyboard user lands back where they were) and the button shows the radar. Label always visible;
 * the counter is polite text.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { fixFor } from '../data/errors.ts';
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
  const sent = useRef('');
  // a failed follow-up (a 429, say) hands the question back instead of making a person retype it
  useEffect(() => {
    if (error && !asking) setQ((cur) => cur || sent.current);
  }, [error, asking]);
  const limit = rounds >= max;
  const ok = q.trim().length > 0 && !disabled && !asking && !limit;
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        sent.current = q.trim();
        onAsk(sent.current);
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
          readOnly={asking}
          aria-busy={asking || undefined}
          value={q}
          placeholder={limit ? 'Follow-ups used up' : 'Which team should I notify first?'}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={asking} disabled={!ok && !asking}>
          Ask
        </Button>
      </div>
      <p className="text-xs text-fg-2" role="status">
        {limit
          ? `That is all ${max} follow-ups for this triage. Run the triage again to ask more.`
          : asking
            ? 'Querying the graph, then drafting an answer. Every claim is checked against the results.'
            : disabled
              ? 'Available once the triage has finished.'
              : `Follow-up ${Math.min(rounds + 1, max)} of ${max}`}
      </p>
      {error && !asking && (
        <div role="alert" className="flex flex-col gap-0.5 text-sm">
          <p className="flex items-start gap-2 text-infect-400">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{error.message}</span>
          </p>
          <p className="text-fg-1">{fixFor(error, 'ask')}</p>
          {error.requestId && (
            <p className="font-mono text-xs text-fg-2">
              request <span className="select-all text-fg-1">{error.requestId}</span>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
