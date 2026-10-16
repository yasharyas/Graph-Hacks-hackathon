/* ToolFeed: the left pane. The narrative (verdict first), then the tool calls that produced it, then each Ask
 * follow-up (question, its answer, its tool calls), with the Ask box pinned to the bottom of the pane.
 * Props:
 *   cards, followUps, narration, guard   straight from useTriage()
 *   status       TriageState['status']; drives the empty and error states and the live summary
 *   error        TriageError | null: a full-pane state when there are no cards, a banner above them otherwise
 *   scenario     for each card's "Show plan"
 *   onRun        empty / error state action, and the stale narrative's "Re-run to update"
 *   onSelectEntity(entity)   a claim chip or [E1] was clicked: highlight that path in the graph (desktop only: below
 *                1024px the graph is another panel and the proof is what the person asked for)
 *   clockAt      the scrubber's resting clock (epoch ms); passed to the narrative, which dims itself when it describes another clock
 *   guest        the run is about one pasted repo: no team routing to show (the narrative and route_owners say so instead)
 *   cypherHints  values a tool derived inside its run (the incident's maintainer), for the runnable Cypher's parameter prefix
 *   notices      each team's notice (Report.notices): the narrative's Notify roster copies one per team
 *   noticeLink   a link back to this run, appended to each copied team notice
 *   onStatus     where the feed's one status line goes: App keeps that live region mounted outside <main>, which is rebuilt
 *                below 768px when a run starts (a region inserted already holding "Starting the triage" is not read out)
 *   footer       the AskBox, pinned: sticky at the bottom of the pane, fixed above the tab bar below 1024px
 *
 * Proof: every claim chip, [E#] tag and claim-map entry calls trace(entity). The tool call that returned it (data/
 * narration.ts proofFor) opens, opens its Cypher, scrolls so its top is clear of the pinned Ask bar, takes focus and
 * flashes the row; a polite status line says what opened. Tool cards are collapsed by default (one line, one tab stop);
 * opening one shows its Cypher at once. "Expand all" opens them all.
 * A run of one tool (21 explain_path calls) shows its first 3; the rest sit behind one toggle unless opened or traced.
 * "Show N more" moves focus to the first card it revealed (the cards land above the toggle, which would strand focus).
 * (A phone held sideways has no height to spare: below 560px tall the Ask box scrolls with the feed instead.)
 * Keyboard: three skip links open the feed ("Skip to tool calls", "Skip to Ask", "Skip to exposure table").
 * ONE live region (role=status) serves the whole feed: a summary ("2 of 5 tools done"), or the last thing a card or a
 * claim asked it to say (what opened, a plan loaded). No card has a live region of its own. While a run streams, the count
 * changes at most once every 2 s (useCalm): a fast stream says "Starting the triage" and then "Triage complete", not a burst
 * of "3 of 4 tools done". An Ask answer is read out
 * once, as words (data/narration.ts spokenAnswer), when it is complete; when it lands the feed scrolls so the question and
 * the answer's first lines sit above the pinned Ask bar (reveal, components/scrollPane.ts).
 * Each Ask answer is labelled with how it was made (the graph alone, or a model whose names and numbers were checked).
 * `narration.draft` (when the state carries it) or, failing that, "still running, no guard yet" means the analyst pick may
 * still arrive: its place is reserved.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { plainError } from '../data/errors.ts';
import { nextStep, requestIdFor } from '../data/failure.ts';
import { answerLabel, proofFor, spokenAnswer } from '../data/narration.ts';
import type { Notice, ScenarioId } from '../data/types.ts';
import type { FollowUp, Guard, Narration, ToolCardState, TriageError, TriageState } from '../data/useTriage.ts';
import { Button } from './Button.tsx';
import { EmptyState } from './EmptyState.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';
import { NarrationBlock, NarrativePanel } from './NarrativePanel.tsx';
import { reveal, revealKeepingFocus } from './scrollPane.ts';
import { cardDomId, subject, ToolCard, type Trace } from './ToolCard.tsx';

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
  clockAt?: number;
  guest?: boolean;
  cypherHints?: Record<string, unknown>;
  notices?: Notice[];
  noticeLink?: string | null;
  onStatus?: (text: string) => void;
  footer?: ReactNode;
}

/** Consecutive cards of the same tool, in feed order. */
const runs = (cs: ToolCardState[]) => cs.reduce<ToolCardState[][]>((rs, c) => (rs.at(-1)?.[0].tool === c.tool ? rs.at(-1)!.push(c) : rs.push([c]), rs), []);

/** "Tool calls . 17 . 187.4 ms" */
const calls = (cs: ToolCardState[]) => `Tool calls · ${cs.length} · ${cs.reduce((n, c) => n + (c.result?.ms ?? 0), 0).toFixed(1)} ms`;

const failTitle = (e: TriageError) =>
  e.status === 0 ? 'The server is not reachable' : e.status === 429 ? 'Triage is rate limited' : e.status === 413 || e.status === 415 ? 'The request was refused' : 'The triage did not run';

const skip =
  'sr-only focus:not-sr-only focus:rounded-sm focus:bg-bg-3 focus:px-3 focus:py-2 focus:text-sm focus:text-fg-0';
const wide = () => matchMedia('(min-width: 1024px)').matches;
const RUN = 3; // cards of one tool shown before "Show N more"
const CALM_MS = 2000;

/** `text`, but while `calm` it changes at most once per `ms` (the first value of a calm stretch at once, the latest value wins); when `calm` ends it follows at once. */
function useCalm(text: string, calm: boolean, ms: number): string {
  const [out, setOut] = useState(text);
  const last = useRef(-Infinity);
  useEffect(() => {
    if (!calm) {
      last.current = -Infinity;
      return setOut(text);
    }
    const now = () => ((last.current = Date.now()), setOut(text));
    const wait = last.current + ms - Date.now();
    if (wait <= 0) return now();
    const t = setTimeout(now, wait);
    return () => clearTimeout(t);
  }, [text, calm, ms]);
  return out;
}

export function ToolFeed({ cards, followUps, narration, guard, status, error, scenario, onRun, onSelectEntity, clockAt, guest = false, cypherHints, notices, noticeLink, onStatus, footer }: ToolFeedProps) {
  const lastRef = useRef<HTMLElement>(null);
  const nonce = useRef(0);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [target, setTarget] = useState<(Trace & { id: string }) | null>(null);
  const [said, setSaid] = useState('');
  const [more, setMore] = useState<ReadonlySet<string>>(new Set()); // runs shown in full, keyed by their first card id
  const revealed = useRef<string | null>(null); // the first card a "Show N more" just revealed: focus goes there
  // A question: bring its echo into view. Its answer: scroll again once it is laid out, so the question and the answer's first
  // lines sit above the pinned Ask bar (at the echo the answer does not exist yet, and the pane may not scroll that far).
  const answered = followUps.at(-1)?.narration != null;
  useEffect(() => {
    const el = lastRef.current;
    if (!followUps.length || !el) return;
    // the Ask field keeps the focus while the answer lands: on a short or zoomed window it stays on screen, the answer gives way
    const raf = requestAnimationFrame(() => revealKeepingFocus(el, answered ? 'top' : 'nearest'));
    return () => cancelAnimationFrame(raf);
  }, [followUps.length, answered]);
  useEffect(() => {
    const id = revealed.current;
    revealed.current = null;
    if (id) document.getElementById(cardDomId({ id }))?.querySelector<HTMLElement>('h3 button')?.focus();
  }, [more]);
  // A new run starts with no cards; card ids repeat from run to run, so what was open (or pointed at) must not carry over.
  const empty = cards.length === 0;
  useEffect(() => {
    if (!empty) return;
    setOpen(new Set());
    setMore(new Set());
    setTarget(null);
    setSaid('');
  }, [empty]);

  const round = (n: number) => cards.filter((c) => c.round === n);
  const pool = (n: number) => [...round(n), ...cards.filter((c) => c.round !== n)]; // a follow-up may cite the triage's cards too
  const last = followUps.at(-1);
  const done = round(0).filter((c) => c.status === 'done').length;
  // A follow-up says two things: that it is querying, then its answer (its one or two tool calls are not worth a count each).
  const summary =
    status === 'running'
      ? round(0).length === 0
        ? 'Starting the triage'
        : `${done} of ${round(0).length} tools done`
      : last?.status === 'running'
        ? `Follow-up ${followUps.length}: querying the graph`
        : last?.status === 'done'
          ? last.narration
            ? `Answer to follow-up ${followUps.length}: ${spokenAnswer(last.narration.text)}`
            : `Follow-up ${followUps.length} cancelled`
          : last?.status === 'error'
            ? `Follow-up ${followUps.length} failed`
            : status === 'done'
              ? `Triage complete: ${done} tools${guard && guard.total > 0 ? `, ${guard.verified} of ${guard.total} claims traced to graph queries` : ''}.`
              : status === 'aborted'
                ? 'Triage cancelled'
                : status === 'error'
                  ? 'Triage failed'
                  : '';
  // A new summary replaces what a card or claim said, so progress still announces; until then the last message stands.
  useEffect(() => setSaid(''), [summary]);
  const spoken = useCalm(summary, status === 'running', CALM_MS);
  const drafting = (narration as { draft?: boolean } | null)?.draft ?? (status === 'running' && guard === null);

  /** A claim was clicked: open the tool call that returned it, and (desktop) highlight its path in the graph. */
  const trace = (entity: string, n: number) => {
    if (wide()) onSelectEntity(entity);
    const hit = proofFor(entity, pool(n));
    if (!hit) return setSaid(`No single tool call returned ${entity}: it was checked against the run as a whole.`);
    const sub = subject(hit.card.params);
    setOpen((s) => new Set(s).add(hit.card.id));
    setTarget({ id: hit.card.id, row: hit.row, nonce: ++nonce.current });
    setSaid(`Opened ${hit.card.tool}${sub ? `, ${sub}` : ''}, the call that returned ${entity}. Its Cypher is shown${hit.row !== null ? ' and the matching row is highlighted' : ''}.`);
  };

  /**
   * "Skip to tool calls": past the narrative's chips to the first tool call (the FalkorDB proof). Focus moves FIRST: the skip
   * links take room only while one has focus, so the moment the link loses it everything below moves up by their height, and
   * a scroll measured before that would leave the card above the visible area.
   */
  const toCalls = (e: MouseEvent) => {
    e.preventDefault();
    const target = document.querySelector<HTMLElement>('#tool-calls-list article h3 button') ?? document.getElementById('tool-calls');
    if (!target) return;
    target.focus({ preventScroll: true });
    reveal(target.closest('article') ?? target, 'top');
  };
  const toAsk = (e: MouseEvent) => {
    e.preventDefault();
    const field = document.getElementById('ask-question');
    field?.focus({ preventScroll: true });
    if (field) reveal(field, 'nearest');
  };
  /** Below 1024px: the Feed / Graph / Table bar is last in the page, after every card. */
  const toPanels = (e: MouseEvent) => {
    e.preventDefault();
    document.querySelector<HTMLButtonElement>('nav[aria-label="Panels"] button[aria-pressed="true"]')?.focus();
  };
  const toTable = (e: MouseEvent) => {
    e.preventDefault();
    const focus = () => document.getElementById('exposures')?.focus();
    if (wide()) return focus();
    document.querySelector<HTMLButtonElement>('nav[aria-label="Panels"] button:last-child')?.click(); // below 1024px the table is another panel
    requestAnimationFrame(() => requestAnimationFrame(focus));
  };

  const list = (n: number) => {
    const cs = round(n);
    if (!cs.length) return null;
    const every = cs.every((c) => c.status !== 'done' || open.has(c.id));
    const cached = cs.find((c) => c.result?.cached)?.id; // what "cached" means is said once, under the first such call
    return (
      <div id={n === 0 ? 'tool-calls-list' : undefined} className="flex flex-col gap-3">
        <div className="-mb-1 flex items-baseline justify-between gap-2">
          <h3 id={n === 0 ? 'tool-calls' : undefined} tabIndex={n === 0 ? -1 : undefined} className="label-caps text-xs">
            {calls(cs)}
          </h3>
          {cs.some((c) => c.status === 'done') && (
            <button
              type="button"
              className="inline-flex min-h-6 items-center rounded-xs text-xs text-fg-1 underline underline-offset-2 pointer-coarse:min-h-11 hov:text-fg-0"
              onClick={() => setOpen((s) => (every ? new Set([...s].filter((id) => !cs.some((c) => c.id === id))) : new Set([...s, ...cs.filter((c) => c.status === 'done').map((c) => c.id)])))}
            >
              {every ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>
        {runs(cs).map((run) => {
          const full = more.has(run[0].id);
          const hidden = full ? [] : run.slice(RUN).filter((c) => !open.has(c.id) && target?.id !== c.id);
          return (
            <Fragment key={run[0].id}>
              {run.filter((c) => !hidden.includes(c)).map((c) => (
                <Fragment key={c.id}>
                  <ToolCard
                    card={c}
                    scenario={scenario}
                    index={cs.indexOf(c)}
                    open={open.has(c.id)}
                    onOpenChange={(o) => setOpen((s) => new Set(o ? [...s, c.id] : [...s].filter((id) => id !== c.id)))}
                    trace={target?.id === c.id ? target : null}
                    onSay={setSaid}
                    guest={guest}
                    cypherHints={cypherHints}
                  />
                  {c.id === cached && <p className="-mt-1.5 px-1 text-xs text-fg-2">“cached”: the same read-only query ran earlier on this server; its result was reused.</p>}
                </Fragment>
              ))}
              {(full || hidden.length > 0) && (
                <button
                  type="button"
                  aria-expanded={full}
                  className="inline-flex min-h-6 items-center self-start rounded-xs text-xs text-fg-1 underline underline-offset-2 pointer-coarse:min-h-11 hov:text-fg-0"
                  onClick={() => {
                    if (!full) {
                      revealed.current = hidden[0]?.id ?? null;
                      setSaid(`Showing ${hidden.length} more ${run[0].tool} ${hidden.length === 1 ? 'call' : 'calls'}. Focus is on the first of them.`);
                    }
                    setMore((s) => (full ? new Set([...s].filter((id) => id !== run[0].id)) : new Set(s).add(run[0].id)));
                  }}
                >
                  {full ? `Show fewer ${run[0].tool} calls` : `Show ${hidden.length} more ${run[0].tool} ${hidden.length === 1 ? 'call' : 'calls'}`}
                </button>
              )}
            </Fragment>
          );
        })}
      </div>
    );
  };

  // The fixed Ask bar's height, for the page's bottom padding below 1024px (App): it grows by a line for an error or "4 of 4 used".
  const askRef = useRef<HTMLDivElement>(null);
  const hasFooter = !!footer;
  useLayoutEffect(() => {
    const el = askRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--ask-live', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasFooter, cards.length === 0]);

  // ONE status region for both states (empty and running): the element stays mounted, so the first thing it says
  // ("Starting the triage") is a change a screen reader speaks, not a region inserted already holding its text. With
  // onStatus the region is App's (outside <main>, which a phone rebuilds when a run starts); this one is the fallback.
  const line = said || spoken;
  useEffect(() => onStatus?.(line), [line, onStatus]);
  const region = onStatus ? null : (
    <p role="status" className="sr-only">
      {line}
    </p>
  );
  if (cards.length === 0 && status !== 'running') {
    return (
      <>
        {region}
        <div className="flex h-full flex-col">
          <h2 className="sr-only">Tool feed</h2>
          {status === 'error' && error ? (
            <EmptyState
              kind="error"
              title={failTitle(error)}
              cause={error.message}
              fix={nextStep(error, 'triage')}
              requestId={requestIdFor(error)}
              action={{ label: 'Run triage', onClick: onRun }}
            />
          ) : (
            <EmptyState
              title="No triage yet"
              cause="Every tool call, its Cypher and its FalkorDB time will appear here as the triage runs."
              fix="Pick a scenario or describe an alert, then run it."
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {region}
      <div className="flex flex-col gap-3">
        <h2 className="sr-only">Tool feed</h2>
        {/* the skip links take no room until one has focus (the feed's gap would cost the fold 12px) */}
        <nav aria-label="Skip links" className="flex flex-wrap gap-2 [&:not(:focus-within)]:-mb-3">
          {cards.length > 0 && (
            <a href="#tool-calls" onClick={toCalls} className={skip}>
              Skip to tool calls
            </a>
          )}
          {footer && (
            <a href="#ask-question" onClick={toAsk} className={skip}>
              Skip to Ask
            </a>
          )}
          <a href="#exposures" onClick={toTable} className={skip}>
            Skip to exposure table
          </a>
          <a href="#panels" onClick={toPanels} className={`${skip} lg:hidden`}>
            Skip to the Feed, Graph and Table bar
          </a>
        </nav>
        {/* The verdict streams in after the tool calls: its place is held from the start of the run (about its usual height),
            so the cards below do not jump down when it lands. */}
        {/* Shaped like the narrative it stands for (headline, two tier lines, the Why sentences, the disclosure) and about its
            height on each layout, so the reserved space reads as a verdict loading, not as a gap. */}
        {status === 'running' && !narration && (
          <div aria-hidden className="flex min-h-[34rem] flex-col gap-2 max-[359px]:min-h-[42rem] sm:min-h-[26rem] short:min-h-[17.5rem] lg:min-h-96 tight:min-h-80">
            <p className="label-caps text-xs">Verdict</p>
            <p className="text-sm text-fg-1">{cards.length === 0 ? 'Connecting to the graph…' : 'Writing the verdict from the graph…'}</p>
            {[
              ['w-11/12', 'w-full', 'w-full', 'w-3/5'], // the headline
              ['w-full', 'w-5/6', 'w-full', 'w-4/5'], // LOCKED and WOULD_PULL lines
              ['w-full', 'w-11/12', 'w-full', 'w-5/6', 'w-full', 'w-2/3'], // Why: all of it on a phone, one sentence on a laptop
              ['w-1/2'], // the disclosure
            ].map((group, g) => (
              <div key={g} className={`flex flex-col short:[&>:nth-child(n+3)]:hidden ${g === 0 ? 'gap-2.5' : 'mt-2 gap-2 max-lg:gap-4 short:gap-2'} ${g === 0 || g === 1 ? 'lg:[&>:nth-child(n+3)]:hidden' : g === 2 ? 'lg:[&>:nth-child(n+4)]:hidden tight:hidden' : ''}`}>
                {group.map((w, i) => (
                  <div key={i} className={`skeleton ${g === 0 ? 'h-4' : 'h-3'} ${w}`} />
                ))}
              </div>
            ))}
          </div>
        )}
        <NarrativePanel
          narration={narration}
          guard={guard}
          onTrace={(e) => trace(e, 0)}
          cards={pool(0)}
          clockAt={clockAt}
          onRerun={onRun}
          drafting={drafting}
          awaitingGuard={status === 'running' && guard === null}
          guest={guest}
          notices={notices}
          noticeLink={noticeLink}
        />
        {list(0)}
        {status === 'error' && error && cards.length > 0 && (
          <div role="alert" className="flex flex-col items-start gap-1.5 rounded-sm border border-line-3 p-3 text-sm">
            <p className="flex items-start gap-2 text-fg-0">
              <CircleAlert size={16} className="mt-0.5 shrink-0 text-fg-1" />
              {plainError(error)}
            </p>
            {nextStep(error, 'triage') && <p className="text-fg-1">{nextStep(error, 'triage')}</p>}
            {requestIdFor(error) && (
              <p className="font-mono text-xs text-fg-2">
                request <span className="select-all text-fg-1">{requestIdFor(error)}</span>
              </p>
            )}
            <Button onClick={onRun}>Run triage again</Button>
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
              <span className="label-caps text-xs mr-1">You asked</span> {f.question}
            </p>
            {f.narration && (
              <>
                <p className="text-xs text-fg-1">{answerLabel(f.narration)}</p>
                <NarrationBlock narration={f.narration} guard={f.guard} onTrace={(e) => trace(e, i + 1)} cards={pool(i + 1)} idSuffix={`-${i}`} modelWords={f.narration.mode !== 'template'} />
              </>
            )}
            {list(i + 1)}
            {f.status === 'error' && !f.narration && <p className="text-sm text-fg-2">This follow-up got no answer. It does not count toward the limit.</p>}
          </section>
        ))}
        {footer && (
          <>
            <div
              ref={askRef}
              id="ask"
              className="z-(--z-sticky) -mx-3 -mb-3 border-t border-line-1 bg-bg-1 px-3 pt-2 pb-3 max-lg:mx-0 max-lg:mb-0 max-lg:[@media(min-height:560px)]:fixed max-lg:[@media(min-height:560px)]:inset-x-0 max-lg:[@media(min-height:560px)]:bottom-(--tabbar-h) lg:sticky lg:-bottom-3"
            >
              {footer}
            </div>
          </>
        )}
      </div>
    </>
  );
}
