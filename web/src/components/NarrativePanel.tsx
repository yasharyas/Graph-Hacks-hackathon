/* NarrativePanel: the narration as text + claim chips (docs/design.md section 5). Never innerHTML (S5).
 * The text is the deterministic Verdict / Why / Notify / Do the server builds from the report (always complete). An optional
 * `note` is the analyst pick: one observation the LLM chose; the server wrote its words from the report. Own block,
 * labelled "Analyst pick (LLM)" with a visible line saying what the model did, never mixed into the facts. While the verdict
 * is a draft (the model is still picking) the block's place is reserved ("Picking the analyst observation...") so nothing
 * moves when the pick lands; a final narration with no pick removes it.
 * The narration is untrusted, so a claim is "verified" ONLY if the server's guard listed that exact text with ok=true
 * (data/narration.ts decides; this file renders). No raw markdown ever reaches the screen (stripped there).
 *
 * The triage narrative folds Notify and Do behind one disclosure ("Show who to notify and the steps") so the tool calls
 * (the FalkorDB proof) stay near the top of the feed; an Ask answer shows every line it has (`fold` is off).
 *
 * Every verified claim leads to proof: a chip, an [E1] tag, or an entry in the claim map calls onTrace(entity); the feed
 * scrolls to the tool call that returned it, opens its Cypher and flashes the row (ToolFeed + ToolCard).
 * Only the FIRST mention of an entity can be a chip; repeats are plain text with a dotted underline. A line with more
 * than LIST_MAX verified names is a list: its names get the same dotted-underline look but stay buttons (a wall of boxed
 * chips reads as noise; the click still opens the proof). "Verified" is said once, in text for screen readers.
 * The "N of N claims traced" line is a native disclosure (id="flagged-claims", the header badge opens it): a compact
 * map of claim -> tool call -> queries, plus the flagged claims as text.
 *
 * NarrativePanel props:  narration, guard, onTrace(entity), cards (ToolCardState[] this narration may cite, preferred
 *                        first), clockAt (scenario clock now: when the narration's `at` differs, it is dimmed, stamped
 *                        "as of HH:MM UTC" and offers a re-run), onRerun, drafting (the pick is still coming)
 * NarrationBlock props:  the same body without the heading, reused by Ask follow-ups; idSuffix keeps ids unique.
 * A trailing "6 of 14 ..." line (the server's coverage of an enumerating answer) is set apart, not buried in the text.
 */
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { plural, utcLabel } from '../data/format.ts';
import { claimMap, crowded, lines, splitCoverage, type ProofCard, type Segment } from '../data/narration.ts';
import type { Guard, Narration } from '../data/useTriage.ts';
import { Button } from './Button.tsx';
import { CheckDrawIcon } from './icons/CheckDrawIcon.tsx';
import { ChevronDown } from './icons/Glyphs.tsx';
import { subject } from './ToolCard.tsx';

/** A narration as the server may send it: the contract adds `note`, `at` and `draft`, which older servers omit. */
export type NarrationView = Narration & { note?: string | null; at?: number; draft?: boolean };

interface BlockProps {
  narration: NarrationView;
  guard: Guard | null;
  onTrace: (entity: string) => void;
  cards?: ProofCard[];
  idSuffix?: string;
  /** The clock moved since this narration was written: shown dimmed. */
  stale?: boolean;
  /** Notify and Do sit behind one disclosure (the triage narrative). Off for Ask answers, whose lines are the answer. */
  fold?: boolean;
  /** The verdict is final but the analyst pick may still follow: reserve its place. */
  drafting?: boolean;
  /** Shown on the first label's line, above the text (the "as of" stamp). */
  stamp?: ReactNode;
}

const NOT_RETURNED = 'not returned by any graph query';
const chip = 'rounded-xs border px-1.5 py-0.5 font-mono text-xs';
const LABEL = 'label-caps text-xs';
const PICK_EXPLAINED = 'The model chose this; the words come from the graph.'; // one line at the feed's narrowest
const TRACE_TITLE = 'Verified against a graph query. Click to open the tool call that returned it.';
const summary = 'inline-flex min-h-6 items-center gap-1.5 rounded-xs text-xs pointer-coarse:min-h-11 marker:hidden [&::-webkit-details-marker]:hidden hov:text-fg-0';
const chevron = 'transition-transform duration-(--dur-base) ease-out [details[open]_&]:rotate-180';

function Spans({ segs, onTrace, hint, checking = false }: { segs: Segment[]; onTrace: (e: string) => void; hint: string; checking?: boolean }) {
  const list = crowded(segs); // a list of names: no boxes
  return (
    <>
      {segs.map((s, i) => {
        if (s.kind === 'text') return s.text;
        if (s.kind === 'struck') {
          return (
            <span key={i}>
              <span className="text-fg-0 line-through decoration-1">{s.text}</span>
              <span className="text-xs text-fg-1"> ({NOT_RETURNED})</span>
            </span>
          );
        }
        if (s.kind === 'cite') {
          if (s.verdict === 'verified') {
            return (
              <button key={i} type="button" aria-describedby={hint} onClick={() => onTrace(s.id)} className="-my-1.5 rounded-xs px-1 py-1.5 font-mono text-xs text-fg-1 underline underline-offset-2 hov:text-fg-0">
                [{s.id}]
              </button>
            );
          }
          return (
            <span key={i} className={`font-mono text-xs ${s.verdict === 'flagged' ? 'text-fg-1 line-through' : 'text-fg-1'}`}>
              [{s.id}]<span className="sr-only"> {s.verdict === 'flagged' ? 'is not an evidence id from this run' : 'was not checked'}</span>
            </span>
          );
        }
        if (s.verdict === 'flagged') {
          return (
            <span key={i}>
              <span className={`${chip} border-line-3 text-fg-0 line-through decoration-1`}>{s.text}</span>
              <span className="text-xs text-fg-1"> ({NOT_RETURNED})</span>
            </span>
          );
        }
        if (!s.first) {
          // a repeat: plain text, not another box
          return (
            <span key={i} className="font-mono text-[0.9em] text-fg-0 underline decoration-dotted decoration-1 underline-offset-4">
              {s.text}
            </span>
          );
        }
        if (s.verdict === 'plain' && checking) {
          // the guard has not answered yet: names are plain text (not "unchecked" boxes) until it does, so nothing jumps when it lands
          return (
            <span key={i} className="font-mono text-[0.9em] text-fg-0">
              {s.text}
            </span>
          );
        }
        if (s.verdict === 'plain') {
          return (
            <span key={i} className={`${chip} border-dashed border-line-3 text-fg-1`} title="The guard did not check this text">
              {s.text}
              <span className="sr-only"> (not checked)</span>
            </span>
          );
        }
        if (list) {
          // a name in a long list: verified and clickable like a chip, without the box
          return (
            <button
              key={i}
              type="button"
              aria-describedby={hint}
              onClick={() => onTrace(s.text)}
              title={TRACE_TITLE}
              className="-my-1.5 rounded-xs px-0.5 py-1.5 font-mono text-[0.9em] text-fg-0 underline decoration-dotted decoration-fg-1 decoration-1 underline-offset-4 transition-colors duration-(--dur-fast) ease-out hov:decoration-fg-0"
            >
              {s.text}
            </button>
          );
        }
        return (
          <button
            key={i}
            type="button"
            aria-describedby={hint}
            onClick={() => onTrace(s.text)}
            title={TRACE_TITLE}
            className={`${chip} -my-0.5 inline-flex items-center pointer-coarse:min-h-6 border-line-2 bg-bg-2 text-fg-0 transition-transform duration-(--dur-press) ease-out active:scale-(--press-scale) hov:border-line-3 hov:bg-bg-3`}
          >
            {s.text}
          </button>
        );
      })}
    </>
  );
}

/** The claim -> tool call -> queries map, and the flagged claims as text. */
function ClaimMap({ guard, cards, onTrace, id }: { guard: Guard; cards: ProofCard[]; onTrace: (e: string) => void; id: string }) {
  const map = claimMap(guard.claims, cards);
  const all = guard.verified >= guard.total;
  return (
    <details id={id} className="text-sm">
      <summary className={`${summary} ${all ? 'text-fg-1' : 'text-tier-would-pull'}`}>
        <CheckDrawIcon size={14} className={all ? 'text-tier-clean' : 'text-tier-would-pull'} />
        <span>
          {guard.verified} of {plural(guard.total, 'claim')} traced to a graph query
          {guard.flagged.length > 0 && ` · ${guard.flagged.length} flagged`}
        </span>
        <ChevronDown size={12} aria-hidden className={chevron} />
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        {map.groups.length > 0 && (
          <div>
            <p className={LABEL}>Claim, tool call, queries</p>
            <ul className="mt-1.5 flex flex-col gap-2">
              {map.groups.map(({ card, claims }) => {
                const sub = subject(card.params);
                const n = card.result?.cypher?.length ?? 0;
                return (
                  <li key={card.id} className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => onTrace(claims[0]!)} className="inline-flex min-h-6 w-fit max-w-full flex-wrap items-baseline gap-x-2 rounded-xs text-left underline-offset-2 pointer-coarse:min-h-11 hov:underline">
                      <span className="font-medium text-fg-0">{card.tool}</span>
                      {sub && <span className="font-mono text-xs break-all text-fg-1">{sub}</span>}
                      <span className="text-xs text-fg-1">{plural(n, 'query', 'queries')}, click to open this call</span>
                    </button>
                    <p className="font-mono text-xs break-words text-fg-1">{claims.join(', ')}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {map.unmatched.length > 0 && (
          <p className="text-xs text-fg-1">
            Checked against the run as a whole, no single tool call: <span className="font-mono">{map.unmatched.join(', ')}</span>
          </p>
        )}
        {guard.flagged.length > 0 && (
          <div>
            <p className={LABEL}>Flagged claims ({guard.flagged.length})</p>
            <ul className="mt-1.5 flex flex-col gap-1 text-fg-1">
              {guard.flagged.map((f, i) => (
                <li key={`${f}-${i}`}>
                  <span className="font-mono text-xs text-fg-0 line-through">{f}</span> was {NOT_RETURNED}.
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

type Row = ReturnType<typeof lines>[number];

// How much of each line the compact narrative shows, in the war room's three-pane layout (from 1024px wide), where the feed
// is a 320 to 360px column and the tool calls must stay above the fold: the Verdict is clamped only on a short window (a
// 768px laptop has room for about 350px of narrative above them); Why and the pick are clamped throughout. Below 1024px the
// feed is the whole page and nothing is clamped. `line-clamp` is purely visual: screen readers read every word, and keyboard
// focus inside a clamped line opens the full narrative.
const CLAMP: Record<string, string> = {
  Verdict: 'lg:[@media(min-height:740px)_and_(max-height:879px)]:line-clamp-5 lg:[@media(max-height:739px)]:line-clamp-4',
  Why: 'lg:[@media(min-height:740px)_and_(max-height:999px)]:line-clamp-2 lg:[@media(max-height:739px)]:line-clamp-1 lg:[@media(min-height:1000px)]:line-clamp-3',
};
const PICK_CLAMP = 'lg:line-clamp-2';

export function NarrationBlock({ narration, guard, onTrace, cards = [], idSuffix = '', stale = false, fold = false, drafting = false, stamp }: BlockProps) {
  const hint = useId();
  const more = useId();
  const [full, setFull] = useState(false); // the compact narrative opened: clamps off, Notify and Do shown
  const { body, coverage } = splitCoverage(narration.text);
  const rows = lines(body, guard);
  const note = narration.note?.trim() ? lines(narration.note, guard) : null;
  const folded = fold ? rows.filter((r) => r.label === 'Notify' || r.label === 'Do') : [];
  const shown = fold ? rows.filter((r) => !folded.includes(r)) : rows;
  const unchecked = [...rows, ...(note ?? [])].some((l) => l.segs.some((s) => s.kind === 'entity' && s.verdict === 'plain'));
  const checked = guard !== null && guard.total > 0;
  const pending = drafting && !note; // the final narration with no pick removes the block; a draft reserves it
  const checking = drafting && guard === null; // the model is still picking and the guard has not run: names are not "unchecked" yet
  const clamp = fold && !full;
  // Is any clamped line actually cut? (A short narrative has nothing behind "Show the rest" but Notify and Do, if it has them.)
  const box = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !clamp) return;
    const measure = () => setCut([...el.querySelectorAll<HTMLElement>('[data-clamp]')].some((p) => p.scrollHeight > p.clientHeight + 1));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clamp, narration.text, narration.note]);
  // Keyboard focus inside a clamped line (a person tabbing to a chip) opens it: focus is never clipped. A mouse click does not.
  const open = (e: FocusEvent<HTMLElement>) => {
    if (clamp && (e.target as HTMLElement).matches(':focus-visible')) setFull(true);
  };

  // A labelled line runs the label into the text: the 320px feed has no width for a label column.
  // The "as of" stamp shares the first label's line, above the text, so it never sits mid-sentence.
  const row = (r: Row, i: number, first = false) => {
    const head = first && stamp;
    return (
      <Fragment key={`${r.label}-${i}`}>
        {head && (
          <p className="flex max-w-(--measure) items-baseline justify-between gap-2">
            {r.label ? <span className={LABEL}>{r.label}</span> : <span />}
            {stamp}
          </p>
        )}
        <p onFocus={open} data-clamp={clamp && r.label && CLAMP[r.label] ? '' : undefined} className={`max-w-(--measure) text-fg-0 ${r.label === 'Verdict' || !r.label ? 'text-md' : 'text-sm'} ${clamp && r.label ? (CLAMP[r.label] ?? '') : ''}`}>
          {!head && r.label && <span className={`${LABEL} mr-2`}>{r.label}</span>}
          <Spans segs={r.segs} onTrace={onTrace} hint={hint} checking={checking} />
        </p>
      </Fragment>
    );
  };

  return (
    <div ref={box} className={`flex flex-col gap-1.5 transition-opacity duration-(--dur-slow) ${stale ? 'opacity-70' : ''}`}>
      <span id={hint} className="sr-only">
        {checked ? `${guard.verified} of ${plural(guard.total, 'claim')} verified against the graph. Verified names and evidence ids open the tool call and query that returned them.` : 'Not checked against the graph.'}
      </span>
      {shown.map((r, i) => row(r, i, i === 0))}

      {coverage && (
        <p className="max-w-(--measure) rounded-xs bg-bg-2 px-2 py-1.5 text-sm text-fg-0">
          <span className={`${LABEL} mr-2`}>Coverage</span>
          {coverage}
        </p>
      )}

      {(note || pending) && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          <p className={LABEL}>
            Analyst pick (LLM){narration.mode === 'replay' ? ', replayed' : ''}
          </p>
          <p className="text-xs text-fg-1">{PICK_EXPLAINED}</p>
          {note ? (
            note.map((r, i) => (
              <p key={i} onFocus={open} data-clamp={clamp ? '' : undefined} className={`max-w-(--measure) text-sm text-fg-1 ${clamp ? PICK_CLAMP : ''}`}>
                <Spans segs={r.segs} onTrace={onTrace} hint={hint} checking={checking} />
              </p>
            ))
          ) : (
            <p className={`min-h-15 text-sm text-fg-2 ${clamp ? 'lg:min-h-10' : ''}`}>Picking the analyst observation&hellip;</p>
          )}
        </div>
      )}

      {fold && (folded.length > 0 || cut || full) && (
        <>
          {/* One expander for everything the compact narrative leaves out: the rest of the clamped lines, who to notify, the steps. */}
          <button
            type="button"
            aria-expanded={full}
            aria-controls={folded.length ? more : undefined}
            onClick={() => setFull((f) => !f)}
            className={`${summary} self-start text-fg-1`}
          >
            <span>{full ? 'Show less' : `Show the rest${folded.length ? ': who to notify and the steps' : ''}`}</span>
            <ChevronDown size={12} aria-hidden className={`transition-transform duration-(--dur-base) ease-out ${full ? 'rotate-180' : ''}`} />
          </button>
          {full && folded.length > 0 && (
            <div id={more} className="flex flex-col gap-2">
              {folded.map((r, i) => row(r, i + shown.length))}
            </div>
          )}
        </>
      )}

      {/* the "N of N claims traced" row has this place once the guard answers: reserved, so it adds no shift */}
      {checking && <p className="min-h-6 text-xs leading-6 text-fg-2">Checking the claims against the graph&hellip;</p>}
      {guard && guard.total === 0 && <p className="text-xs text-fg-1">Unverified: no claim in this text was checked against the graph.</p>}
      {guard && guard.total > 0 && <ClaimMap guard={guard} cards={cards} onTrace={onTrace} id={`flagged-claims${idSuffix}`} />}
      {unchecked && !checking && <p className="text-xs text-fg-2">Dashed names were not checked by the guard.</p>}
    </div>
  );
}

const asOf = (at: number | undefined, clock: number | undefined) => at !== undefined && clock !== undefined && Math.floor(at / 60_000) !== Math.floor(clock / 60_000);

/** True only once `on` has held for `ms`: a one-frame mismatch (the scrubber syncing to a new run's clock) never flashes a banner. */
function useSettled(on: boolean, ms: number): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!on) return setSettled(false);
    const t = setTimeout(() => setSettled(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return on && settled;
}

export function NarrativePanel({
  narration,
  guard,
  onTrace,
  cards,
  clockAt,
  onRerun,
  drafting,
}: Omit<BlockProps, 'narration' | 'idSuffix' | 'stale' | 'fold' | 'stamp'> & { narration: NarrationView | null; clockAt?: number; onRerun?: () => void }) {
  const stale = useSettled(narration !== null && asOf(narration.at, clockAt), 250);
  if (!narration) return null;
  return (
    <section aria-label="Narrative" className="animate-enter flex flex-col gap-2">
      <h3 className="sr-only">Narrative</h3>
      {stale && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-0">
          The clock moved to {utcLabel(clockAt!)}.
          {onRerun ? (
            <Button variant="secondary" onClick={onRerun}>
              Re-run to update
            </Button>
          ) : (
            ' Re-run to update.'
          )}
        </p>
      )}
      <NarrationBlock
        narration={narration}
        guard={guard}
        onTrace={onTrace}
        cards={cards}
        stale={stale}
        fold
        drafting={drafting ?? narration.draft ?? false}
        stamp={narration.at !== undefined ? <span className="font-mono text-xs text-fg-1 tabular-nums">as of {utcLabel(narration.at)}</span> : undefined}
      />
    </section>
  );
}
