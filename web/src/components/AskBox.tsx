/* AskBox: follow-up questions about this triage (docs/design.md section 5). Bounded to 4 follow-ups per triage.
 * ToolFeed pins it to the bottom of the feed pane, so it is always in view; its input has the stable id
 * `ask-question` (the feed's "Skip to Ask" link focuses it).
 * Props: disabled (no triage to ask about yet, or one is still running), asking (a follow-up is running),
 *        rounds (answered or running so far; a failed ask is not counted), max (default 4),
 *        error (last follow-up failure, with status and requestId), onAsk(question).
 * Answers arrive as a guarded narration + tool cards in the feed (markdown stripped, coverage line set apart). While
 * one runs the field is read-only (it keeps focus, so a keyboard user lands back where they were) and the button shows
 * the radar; while the triage itself runs the whole box is disabled. Label always visible; "Follow-up N of 4" is
 * polite text beside it.
 */
import { useEffect, useRef, useState } from 'react';
import { fixFor, plainError } from '../data/errors.ts';
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
  const [q, setQ] = useState('');
  const sent = useRef('');
  // a failed follow-up (a 429, say) hands the question back instead of making a person retype it
  useEffect(() => {
    if (error && !asking) setQ((cur) => cur || sent.current);
  }, [error, asking]);
  const limit = rounds >= max;
  const ok = q.trim().length > 0 && !disabled && !asking && !limit;
  const counter = limit
    ? `${max} of ${max} used`
    : asking
      ? `Follow-up ${Math.min(rounds, max)} of ${max}, answering`
      : disabled
        ? 'Available once the triage has finished'
        : `Follow-up ${Math.min(rounds + 1, max)} of ${max}`;
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
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="ask-question" className="text-xs text-fg-1">
          Ask about this triage
        </label>
        <span role="status" className="text-xs text-fg-1 tabular-nums">
          {counter}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          id="ask-question"
          className="field placeholder:text-fg-2"
          maxLength={500}
          autoComplete="off"
          disabled={disabled || limit}
          readOnly={asking}
          aria-busy={asking || undefined}
          value={q}
          placeholder={limit ? 'Follow-ups used up' : 'Which exposures are prod-only?'}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={asking} disabled={!ok && !asking}>
          Ask
        </Button>
      </div>
      {(limit || asking) && (
        <p className="text-xs text-fg-2">
          {limit ? `That is all ${max} follow-ups for this triage. Run the triage again to ask more.` : 'Querying the graph, then drafting an answer. Every claim is checked against the results.'}
        </p>
      )}
      {error && !asking && (
        <div role="alert" className="flex flex-col gap-0.5 rounded-sm border border-line-3 p-2 text-sm">
          <p className="flex items-start gap-2 text-fg-0">
            <CircleAlert size={16} className="mt-0.5 shrink-0 text-fg-1" />
            <span>{plainError(error)}</span>
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
