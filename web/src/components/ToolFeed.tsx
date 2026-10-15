/* ToolFeed: the left pane. Tool cards (triage round), the narrative with claim chips, then each Ask follow-up
 * (question, its tool cards, its narration), then the Ask box.
 * The verdict comes first: when the narrative exists it sits above the tool calls that produced it, so the answer is
 * not buried under 17 cards (a follow-up reads the same way: question, answer, then its tool calls).
 * Props:
 *   cards, followUps, narration, guard   straight from useTriage()
 *   status       TriageState['status']; drives the empty and error states and the live summary
 *   error        TriageError | null: a full-pane state when there are no cards, a banner above them otherwise
 *   scenario     for each card's "Show plan"
 *   onRun        empty / error state action (the primary "Run triage")
 *   onSelectEntity(entity)   a claim chip or [E1] was clicked: highlight that path
 *   footer       the AskBox (rendered last)
 * The live region announces a throttled summary ("2 of 5 tools done"), never each card.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { fixFor } from '../data/errors.ts';
import type { FollowUp, Guard, Narration, ToolCardState, TriageError, TriageState } from '../data/useTriage.ts';
import type { ScenarioId } from '../data/types.ts';
import { Button } from './Button.tsx';
import { EmptyState } from './EmptyState.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';
import { NarrationBlock, NarrativePanel } from './NarrativePanel.tsx';
import { scrollPaneTo } from './scrollPane.ts';
import { ToolCard } from './ToolCard.tsx';

export interface ToolFeedProps {
  cards: ToolCardState[];
  followUps: FollowUp[];
  narration: Narration | null;
  guard: Guard | null;
  status: TriageState['status'];
  error: TriageError | null;
  scenario: ScenarioId | null;
  onRun: () => void;
  onSelectEntity: (entity: string) => void;
  footer?: ReactNode;
}

/** "Tool calls · 17 · 187.4 ms" */
const calls = (cs: ToolCardState[]) => `Tool calls · ${cs.length} · ${cs.reduce((n, c) => n + (c.result?.ms ?? 0), 0).toFixed(1)} ms`;

const failTitle = (e: TriageError) =>
  e.status === 0 ? 'The server is not reachable' : e.status === 429 ? 'Triage is rate limited' : e.status === 413 || e.status === 415 ? 'The request was refused' : 'The triage did not run';

export function ToolFeed({ cards, followUps, narration, guard, status, error, scenario, onRun, onSelectEntity, footer }: ToolFeedProps) {
  const lastRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (followUps.length && lastRef.current) scrollPaneTo(lastRef.current);
  }, [followUps.length]);

  const round = (n: number) => cards.filter((c) => c.round === n);
  const last = followUps.at(-1);
  const done = round(0).filter((c) => c.status === 'done').length;
  const summary =
    status === 'running'
      ? `${done} of ${round(0).length} tools done`
      : last?.status === 'running'
        ? `Follow-up ${followUps.length}: ${round(followUps.length).filter((c) => c.status === 'done').length} of ${round(followUps.length).length} tools done`
        : last?.status === 'done'
          ? `Follow-up ${followUps.length} answered`
          : last?.status === 'error'
            ? `Follow-up ${followUps.length} failed`
            : status === 'done'
              ? `Triage complete: ${done} tools`
              : status === 'aborted'
                ? 'Triage cancelled'
                : status === 'error'
                  ? 'Triage failed'
                  : '';

  if (cards.length === 0 && status !== 'running') {
    return (
      <div className="flex h-full flex-col">
        <h2 className="sr-only">Tool feed</h2>
        <p role="status" className="sr-only">
          {summary}
        </p>
        {status === 'error' && error ? (
          <EmptyState
            kind="error"
            title={failTitle(error)}
            cause={error.message}
            fix={fixFor(error, 'triage')}
            requestId={error.requestId}
            action={{ label: 'Run triage', onClick: onRun }}
          />
        ) : (
          <EmptyState
            title="No triage yet"
            cause="Every tool call, its Cypher and its FalkorDB time will appear here as the triage runs."
            fix="Pick a scenario or describe an alert, then run it."
            action={{ label: 'Run triage', onClick: onRun }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="sr-only">Tool feed</h2>
      <p role="status" className="sr-only">
        {summary}
      </p>
      {cards.length === 0 && <p className="p-1 text-sm text-fg-1">Connecting to the graph&hellip;</p>}
      <NarrativePanel narration={narration} guard={guard} onSelectEntity={onSelectEntity} />
      {narration && round(0).length > 0 && <h3 className="label-caps">{calls(round(0))}</h3>}
      {round(0).map((c, i) => (
        <ToolCard key={c.id} card={c} scenario={scenario} index={i} />
      ))}
      {status === 'error' && error && cards.length > 0 && (
        <div role="alert" className="flex flex-col items-start gap-1.5 text-sm">
          <p className="flex items-start gap-2 text-infect-400">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            {error.message}
          </p>
          <p className="text-fg-1">{fixFor(error, 'triage')}</p>
          {error.requestId && <p className="font-mono text-xs text-fg-2">request <span className="select-all text-fg-1">{error.requestId}</span></p>}
          <Button variant="primary" onClick={onRun}>
            Run triage again
          </Button>
        </div>
      )}
      {followUps.map((f, i) => (
        <section
          key={i}
          ref={i === followUps.length - 1 ? lastRef : undefined}
          aria-label={`Follow-up ${i + 1}`}
          className="flex scroll-mt-3 flex-col gap-3 border-t border-line-1 pt-3"
        >
          <p className="text-sm text-fg-1">
            <span className="label-caps mr-2">You asked</span>
            {f.question}
          </p>
          {f.narration && <NarrationBlock narration={f.narration} guard={f.guard} onSelectEntity={onSelectEntity} idSuffix={`-${i}`} />}
          {f.narration && round(i + 1).length > 0 && <h3 className="label-caps">{calls(round(i + 1))}</h3>}
          {round(i + 1).map((c, j) => (
            <ToolCard key={c.id} card={c} scenario={scenario} index={j} />
          ))}
          {f.status === 'error' && !f.narration && <p className="text-sm text-fg-2">This follow-up got no answer. It does not count toward the limit.</p>}
        </section>
      ))}
      {footer}
    </div>
  );
}
