/* ToolFeed: the left pane. Tool cards (triage round), the narrative with claim chips, then each Ask follow-up
 * (question, its tool cards, its narration), then the Ask box.
 * Props:
 *   cards, followUps, narration, guard   straight from useTriage()
 *   status       TriageState['status']; drives the empty and error states and the live summary
 *   error        TriageError | null (only shown as a full-pane state when there are no cards)
 *   scenario     for each card's "Show plan"
 *   onRun        empty state action (the primary "Run triage")
 *   onSelectEntity(entity)   a claim chip or [E1] was clicked: highlight that path
 *   footer       the AskBox (rendered last)
 * The live region announces a throttled summary ("2 of 5 tools done"), never each card.
 */
import type { ReactNode } from 'react';
import type { FollowUp, Guard, Narration, ToolCardState, TriageError, TriageState } from '../data/useTriage.ts';
import type { ScenarioId } from '../data/types.ts';
import { EmptyState } from './EmptyState.tsx';
import { NarrationBlock, NarrativePanel } from './NarrativePanel.tsx';
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

export function ToolFeed({ cards, followUps, narration, guard, status, error, scenario, onRun, onSelectEntity, footer }: ToolFeedProps) {
  const done = cards.filter((c) => c.status === 'done').length;
  const summary =
    status === 'running'
      ? `${done} of ${cards.length} tools done`
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
            title="The triage did not run"
            cause={error.message}
            fix="Check that the API is running, then run the triage again."
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

  const roundCards = (round: number) => cards.filter((c) => c.round === round);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="sr-only">Tool feed</h2>
      <p role="status" className="sr-only">
        {summary}
      </p>
      {cards.length === 0 && <p className="p-1 text-sm text-fg-1">Connecting to the graph&hellip;</p>}
      {roundCards(0).map((c, i) => (
        <ToolCard key={c.id} card={c} scenario={scenario} index={i} />
      ))}
      <NarrativePanel narration={narration} guard={guard} onSelectEntity={onSelectEntity} />
      {followUps.map((f, i) => (
        <section key={i} aria-label={`Follow-up ${i + 1}`} className="flex flex-col gap-3 border-t border-line-1 pt-3">
          <p className="text-sm text-fg-1">
            <span className="label-caps mr-2">You asked</span>
            {f.question}
          </p>
          {roundCards(i + 1).map((c, j) => (
            <ToolCard key={c.id} card={c} scenario={scenario} index={j} />
          ))}
          {f.narration && <NarrationBlock narration={f.narration} guard={f.guard} onSelectEntity={onSelectEntity} idSuffix={`-${i}`} />}
        </section>
      ))}
      {footer}
    </div>
  );
}
