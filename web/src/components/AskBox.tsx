/* AskBox: follow-up questions about this triage (docs/design.md section 5). A triage allows 4 model-written answers;
 * questions the graph answers (lists, a repo, is npm ci safe, what first, when ...) and questions nobody could answer are
 * free, so the box never locks: at 4 of 4 it still takes questions, and the server says when one would need the model.
 * ToolFeed pins it to the bottom of the feed pane, so it is always in view; its input has the stable id
 * `ask-question` (the feed's "Skip to Ask" link focuses it).
 * Props: disabled (no triage to ask about yet, or one is still running), asking (a follow-up is running),
 *        rounds (model-written answers used so far: useTriage().rounds, the server's own count), max (default 4),
 *        suggestions (after an unanswered question: questions the graph answers, shown as chips that ask them),
 *        error (last follow-up failure, with status and requestId), onAsk(question).
 * Answers arrive as a guarded narration + tool cards in the feed (markdown stripped, coverage line set apart). While
 * one runs the field is read-only (it keeps focus, so a keyboard user lands back where they were) and the button shows
 * the radar; while the triage itself runs the whole box is disabled. Label always visible; the counter is plain text
 * beside it (not a live region: the feed's one status line says what the follow-up is doing and reads the answer out when
 * it lands, so this counter would only repeat it).
 */
import { useEffect, useRef, useState } from 'react';
import { plainError } from '../data/errors.ts';
import { nextStep, requestIdFor } from '../data/failure.ts';
import type { TriageError } from '../data/useTriage.ts';
import { Button } from './Button.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';

export function AskBox({
  disabled,
  asking,
  rounds,
  max = 4,
  suggestions = [],
  error,
  onAsk,
}: {
  disabled: boolean;
  asking: boolean;
  rounds: number;
  max?: number;
  suggestions?: string[];
  error: TriageError | null;
  onAsk: (question: string) => void;
}) {
  const [q, setQ] = useState('');
  const sent = useRef('');
  // a failed follow-up (a 429, say) hands the question back instead of making a person retype it
  useEffect(() => {
    if (error && !asking) setQ((cur) => cur || sent.current);
  }, [error, asking]);
  const used = Math.min(rounds, max);
  const limit = rounds >= max;
  const ok = q.trim().length > 0 && !disabled && !asking;
  const ask = (question: string) => {
    sent.current = question;
    onAsk(question);
    setQ('');
  };
  const counter = asking
    ? 'Answering'
    : disabled
      ? 'Available after the run' // short: the label and this share a 296px row, and a second line would make the pinned box jump when it flips
      : `${used} of ${max} model answers`;
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) ask(q.trim());
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="ask-question" className="text-xs text-fg-1">
          Ask about this triage
        </label>
        <span className="text-xs text-fg-1 tabular-nums">
          {counter}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          id="ask-question"
          className="field placeholder:text-fg-2"
          maxLength={500}
          autoComplete="off"
          disabled={disabled}
          readOnly={asking}
          aria-busy={asking || undefined}
          value={q}
          placeholder="Which exposures are prod-only?"
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={asking} disabled={!ok && !asking}>
          Ask
        </Button>
      </div>
      {suggestions.length > 0 && !asking && !disabled && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Questions the graph answers">
          {suggestions.map((s) => (
            <button key={s} type="button" className="min-h-6 rounded-sm border border-line-3 px-2 py-0.5 text-left text-xs text-fg-0 hov:bg-bg-2" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {(limit || asking) && (
        <p className="text-xs text-fg-2">
          {asking
            ? 'Querying the graph, then drafting an answer. Every claim is checked against the results.'
            : `That is all ${max} model-written answers for this triage. Questions the graph answers still work; run the triage again for more.`}
        </p>
      )}
      {error && !asking && (
        <div role="alert" className="flex flex-col gap-0.5 rounded-sm border border-line-3 p-2 text-sm">
          <p className="flex items-start gap-2 text-fg-0">
            <CircleAlert size={16} className="mt-0.5 shrink-0 text-fg-1" />
            <span>{plainError(error)}</span>
          </p>
          {nextStep(error, 'ask') && <p className="text-fg-1">{nextStep(error, 'ask')}</p>}
          {requestIdFor(error) && (
            <p className="font-mono text-xs text-fg-2">
              request <span className="select-all text-fg-1">{requestIdFor(error)}</span>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
