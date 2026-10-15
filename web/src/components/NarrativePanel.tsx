/* NarrativePanel: the narration as text + claim chips (docs/design.md section 5). Never innerHTML (S5).
 * The text is the deterministic Verdict / Why / Notify / Do the server builds from the report (always complete). An optional
 * `note` is the analyst pick: one observation the LLM chose; the server wrote its words from the report. Its own short
 * paragraph run in after the label "Analyst pick (LLM)" (what the model did is the label's title and screen-reader text),
 * never mixed into the facts; no pick, no block.
 * The narration is untrusted, so a claim is "verified" ONLY if the server's guard listed that exact text with ok=true
 * (data/narration.ts decides; this file renders). No raw markdown ever reaches the screen (stripped there).
 *
 * Nothing is ever clamped mid-sentence. The Verdict reads as a headline plus one line per tier: the SAME text, broken before
 * " LOCKED, ", " WOULD_PULL, " and " Marked remediated:" (data/narration.ts verdictLines; presentation only, so chips, claim
 * checks and copy see the identical text). Its label row always says "Verdict" (a pasted repo's "Verdict (its lockfile at
 * commit ...):" is parsed so; that provenance is a small line under the label). The triage narrative (`fold`) keeps the tool
 * calls (the FalkorDB proof) near the top of the feed: Why shows whole path sentences only (data/narration.ts whyParts: one
 * on a laptop-height window, two on a tall one, all on a phone, where the feed is the page), and Notify, Do, the rest of Why
 * and (except on a tall desktop window) the analyst pick sit behind ONE disclosure that says what it reveals ("Show 2 more
 * evidence paths, the analyst pick, who to notify and the steps"). An Ask answer shows every line it has (`fold` is off).
 * A pasted repo has no team to notify (its Notify line, if any, is not shown); the demo org's Notify says its teams are demo
 * teams. A narration for another clock is marked by a bar at its left edge and the "as of" stamp, never by dimming its text
 * (dimmed text fell under 4.5:1).
 *
 * Every verified claim leads to proof: a chip, an [E1] tag, or an entry in the claim map calls onTrace(entity); the feed
 * scrolls to the tool call that returned it, opens its Cypher and flashes the row (ToolFeed + ToolCard).
 * Only the FIRST mention of an entity can be a chip; repeats are plain text with a dotted underline (not a tab stop). A line
 * with more than LIST_MAX verified names is a list: its names get the same dotted-underline look but stay buttons (a wall of
 * boxed chips reads as noise; the click still opens the proof), and in a roster each team opens its own line, its name in
 * Satoshi. "Verified" is said once, in text for screen readers.
 * The "N of N claims traced" line is a native disclosure (id="flagged-claims", the header badge opens it): a compact map of
 * claim -> tool call -> queries, plus the flagged claims as text. For a model's answer (`modelWords`) it says what the check
 * did: "12 of 12 names and numbers found in the graph results; the wording is the model's", not "verified".
 *
 * NarrativePanel props:  narration, guard, onTrace(entity), cards (ToolCardState[] this narration may cite, preferred
 *                        first), clockAt (the scrubber's resting clock: when the narration's `at` differs, it is marked,
 *                        stamped "as of HH:MM UTC" and offers a re-run), onRerun, drafting (the pick is still coming),
 *                        awaitingGuard (the run has not checked its claims yet: their line keeps its place), guest
 * NarrationBlock props:  the same body without the heading, reused by Ask follow-ups; idSuffix keeps ids unique.
 * A trailing "6 of 14 ..." line (the server's coverage of an enumerating answer) is set apart, not buried in the text.
 * A run-in label is followed by a real space, so a screen reader says "Why acme/web", not "Whyacme/web".
 */
import { Fragment, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { plural, utcLabel } from '../data/format.ts';
import { citeCount, claimMap, crowded, guardLine, lines, splitCoverage, teamStarts, verdictLines, whyParts, type ProofCard, type Segment } from '../data/narration.ts';
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
  /** The claims have not been checked yet (the run is still going): their line keeps its place, so nothing moves when it lands. */
  awaitingGuard?: boolean;
  /** Shown on the first label's line, above the text (the "as of" stamp). */
  stamp?: ReactNode;
  /** An LLM wrote the words (an Ask answer in live or replay mode): the claim line says what was checked, not "verified". */
  modelWords?: boolean;
  /** A pasted repo: no team routing to show. */
  guest?: boolean;
}

const NOT_RETURNED = 'not returned by any graph query';
const chip = 'rounded-xs border px-1.5 py-0.5 font-mono text-xs';
// A 44px hit area on touch (a pseudo-element reaching into the line gaps), with no change to the chip's size or the text's density.
const HIT = 'relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-0.5 pointer-coarse:after:-inset-y-[7px]';
const LABEL = 'label-caps text-xs';
const PICK_EXPLAINED = 'The model chose this observation; the words come from the graph.';
const TRACE_TITLE = 'Verified against a graph query. Click to open the tool call that returned it.';
const summary = 'inline-flex min-h-6 items-center gap-1.5 rounded-xs text-xs pointer-coarse:min-h-11 marker:hidden [&::-webkit-details-marker]:hidden hov:text-fg-0';
const chevron = 'transition-transform duration-(--dur-base) ease-out [details[open]_&]:rotate-180';
const TIER_WORD = /^(LOCKED|WOULD_PULL)(?=, )/;
const TIER_TEXT: Record<string, string> = { LOCKED: 'text-tier-locked', WOULD_PULL: 'text-tier-would-pull' };

/** "a, b and c" */
const sayList = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

function Spans({ segs, onTrace, hint, checking = false }: { segs: Segment[]; onTrace: (e: string) => void; hint: string; checking?: boolean }) {
  const list = crowded(segs); // a list of names: no boxes
  const teams = list ? teamStarts(segs) : new Set<number>(); // a roster: one line per team
  return (
    <>
      {segs.map((s, i) => {
        if (s.kind === 'text') {
          const tier = i === 0 ? TIER_WORD.exec(s.text) : null; // a verdict line led by its tier: the word in the tier's colour
          return tier ? (
            <Fragment key={i}>
              <span className={`font-mono font-medium ${TIER_TEXT[tier[1]!]}`}>{tier[1]}</span>
              {s.text.slice(tier[1]!.length)}
            </Fragment>
          ) : (
            s.text
          );
        }
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
              <button key={i} type="button" data-cite="" aria-describedby={hint} onClick={() => onTrace(s.id)} className="-my-1.5 rounded-xs px-1 py-1.5 font-mono text-xs text-fg-1 underline underline-offset-2 hov:text-fg-0 relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-0.5 pointer-coarse:after:-inset-y-[7px]">
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
            <span key={i} className="font-mono text-xs text-fg-0 underline decoration-dotted decoration-1 underline-offset-4">
              {s.text}
            </span>
          );
        }
        if (s.verdict === 'plain' && checking) {
          // the guard has not answered yet: names are plain text (not "unchecked" boxes) until it does, so nothing jumps when it lands
          return (
            <span key={i} className="font-mono text-xs text-fg-0">
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
          // a name in a long list: verified and clickable like a chip, without the box. A team opens its own line, in Satoshi.
          const team = teams.has(i);
          return (
            <Fragment key={i}>
              {team && i > 0 && <br />}
              <button
                type="button"
                aria-describedby={hint}
                onClick={() => onTrace(s.text)}
                title={TRACE_TITLE}
                className={
                  team
                    ? 'relative rounded-xs text-sm font-medium text-fg-1 transition-colors duration-(--dur-fast) ease-out hov:text-fg-0 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-3'
                    : '-my-1.5 rounded-xs px-0.5 py-1.5 font-mono text-xs text-fg-0 underline decoration-dotted decoration-fg-1 decoration-1 underline-offset-4 transition-colors duration-(--dur-fast) ease-out hov:decoration-fg-0 relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-0.5 pointer-coarse:after:-inset-y-[7px]'
                }
              >
                {s.text}
              </button>
            </Fragment>
          );
        }
        return (
          <button
            key={i}
            type="button"
            aria-describedby={hint}
            onClick={() => onTrace(s.text)}
            title={TRACE_TITLE}
            className={`${chip} -my-0.5 inline-flex fold:py-0 items-center pointer-coarse:min-h-6 ${HIT} border-line-2 bg-bg-2 text-fg-0 transition-transform duration-(--dur-press) ease-out active:scale-(--press-scale) hov:border-line-3 hov:bg-bg-3`}
          >
            {s.text}
          </button>
        );
      })}
    </>
  );
}

/** The claim -> tool call -> queries map, and the flagged claims as text. */
function ClaimMap({ guard, cards, onTrace, id, modelWords }: { guard: Guard; cards: ProofCard[]; onTrace: (e: string) => void; id: string; modelWords: boolean }) {
  const map = claimMap(guard.claims, cards);
  const all = guard.verified >= guard.total;
  return (
    <details id={id} className="text-sm">
      <summary className={`${summary} ${all ? 'text-fg-1' : 'text-tier-would-pull'}`}>
        {/* a model's answer gets no green tick: its names were found, its prose was not verified */}
        <CheckDrawIcon size={14} className={!all ? 'text-tier-would-pull' : modelWords ? 'text-fg-1' : 'text-tier-clean'} />
        <span>
          {guardLine(guard, modelWords)}
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

// How much room the triage narrative has. From 1024px wide the feed is a 320 to 360px column beside the graph: on a window up
// to 900px tall (a laptop) it shows the Verdict, one whole Why sentence and the disclosure, so the first tool call stays on
// screen; on a taller one, two Why sentences and the analyst pick. Below 1024px the feed is the page: all of Why.
type Room = 'phone' | 'short' | 'tall';
const WIDE = '(min-width: 1024px)';
const SHORT = '(min-width: 1024px) and (max-height: 900px)';
const subscribe = (cb: () => void) => {
  const qs = [matchMedia(WIDE), matchMedia(SHORT)];
  qs.forEach((q) => q.addEventListener('change', cb));
  return () => qs.forEach((q) => q.removeEventListener('change', cb));
};
const room = (): Room => (!matchMedia(WIDE).matches ? 'phone' : matchMedia(SHORT).matches ? 'short' : 'tall');
const useRoom = () => useSyncExternalStore(subscribe, room, () => 'tall' as Room);
const WHY_SHOWN: Record<Room, number> = { phone: Infinity, short: 1, tall: 2 };

/** "Show 2 more evidence paths, the analyst pick, who to notify and the steps": what the one disclosure reveals. */
const revealLabel = (parts: (string | null | false)[]) => {
  const xs = parts.filter((x): x is string => !!x);
  return xs.length ? `Show ${sayList(xs)}` : 'Show the rest';
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function NarrationBlock({ narration, guard, onTrace, cards = [], idSuffix = '', stale = false, fold = false, drafting = false, awaitingGuard = false, stamp, modelWords = false, guest = false }: BlockProps) {
  const hint = useId();
  const more = useId();
  const space = useRoom();
  const [full, setFull] = useState(false); // the compact narrative opened: all of Why, the pick, Notify and Do
  const { body, coverage } = splitCoverage(narration.text);
  const rows = lines(body, guard).filter((r) => !(guest && r.label === 'Notify')); // a pasted repo has no team to route to
  const note = narration.note?.trim() ? lines(narration.note, guard) : null;
  const folded = fold ? rows.filter((r) => r.label === 'Notify' || r.label === 'Do') : [];
  const shown = fold ? rows.filter((r) => !folded.includes(r)) : rows;
  const unchecked = [...rows, ...(note ?? [])].some((l) => l.segs.some((s) => s.kind === 'entity' && s.verdict === 'plain'));
  const checked = guard !== null && guard.total > 0;
  const pending = drafting && !note; // the model is still picking
  const checking = (drafting || awaitingGuard) && guard === null; // the guard has not run: names are not "unchecked" yet, and its line is reserved
  const compact = fold && !full;
  // Why, as whole path sentences: the compact narrative shows the first one or two, never a sentence cut in half.
  const why = rows.find((r) => r.label === 'Why');
  const whyAll = why ? whyParts(why.segs) : [];
  const whyShown = compact ? Math.min(whyAll.length, WHY_SHOWN[space]) : whyAll.length;
  const whyHidden = whyAll.slice(whyShown);
  const cites = citeCount(whyHidden);
  // The pick: in place on a tall window (and in an Ask answer); elsewhere in the triage narrative it is behind the disclosure.
  const pickInline = !fold || space === 'tall';
  const hasPick = note !== null || pending;
  // The claim map ("62 of 62 claims traced", which the header badge also counts) folds with the rest, except on a tall window.
  const claimsFolded = fold && !full && space !== 'tall' && (checking || (guard !== null && guard.total > 0));
  const reveals = revealLabel([
    whyHidden.length > 0 && (cites > 0 ? `${cites} more evidence ${cites === 1 ? 'path' : 'paths'}` : 'the rest of why'),
    !pickInline && hasPick && 'the analyst pick',
    folded.some((r) => r.label === 'Notify') && 'who to notify',
    folded.some((r) => r.label === 'Do') && 'the steps',
    claimsFolded && 'the claim map',
  ]);
  const expandable = fold && (full || folded.length > 0 || whyHidden.length > 0 || (!pickInline && hasPick) || claimsFolded);
  const tight = fold ? 'fold:leading-[18px]' : ''; // a laptop-height window: 13px lines a step closer

  // A labelled line runs the label into the text (the 320px feed has no width for a label column), with a real space after
  // it. The Verdict's label has its own row, shared with the "as of" stamp, so the stamp never sits mid-sentence.
  const label = (r: Row) =>
    r.label && (
      <>
        <span className={`${LABEL} mr-1`}>
          {r.label}
          {r.label === 'Notify' && <span className="ml-1.5 font-sans tracking-normal normal-case text-fg-2">demo teams</span>}
        </span>{' '}
      </>
    );
  const row = (r: Row, i: number) => {
    const head = r.label === 'Verdict' || (i === 0 && stamp);
    const verdict = r.label === 'Verdict' ? verdictLines(r.segs) : null;
    return (
      <Fragment key={`${r.label}-${i}`}>
        {head && (
          <p className="flex max-w-(--measure) items-baseline justify-between gap-2">
            {r.label ? <span className={LABEL}>{r.label}</span> : <span />} {stamp}
          </p>
        )}
        {r.source && <p className="-mt-1 max-w-(--measure) text-xs text-fg-1">{cap(r.source)}</p>}
        <p className={`max-w-(--measure) text-fg-0 ${r.label === 'Verdict' || !r.label ? `text-md ${fold && r.label === 'Verdict' ? 'fold:text-base' : ''}` : `text-sm ${tight}`}`}>
          {!head && label(r)}
          {verdict ? (
            verdict.map((segs, j) =>
              j === 0 ? (
                <Spans key={j} segs={segs} onTrace={onTrace} hint={hint} checking={checking} />
              ) : (
                // a tier's sentence on its own line: the same paragraph, so it is read as one
                <span key={j} className={`mt-1 block text-sm ${fold ? 'fold:mt-0.5' : ''} ${tight}`}>
                  <Spans segs={segs} onTrace={onTrace} hint={hint} checking={checking} />
                </span>
              ),
            )
          ) : r === why ? (
            whyAll.slice(0, whyShown).map((segs, j) => (
              <Fragment key={j}>
                {j > 0 && ' '}
                <Spans segs={segs} onTrace={onTrace} hint={hint} checking={checking} />
              </Fragment>
            ))
          ) : (
            <Spans segs={r.segs} onTrace={onTrace} hint={hint} checking={checking} />
          )}
        </p>
      </Fragment>
    );
  };
  // The analyst pick, run in after its label; what the model did is the label's title and screen-reader text. Nothing at all
  // when no observation was picked. While it is coming, its place is held (where it is shown in place).
  const pick =
    note !== null ? (
      note.map((r, i) => (
        <p key={`pick-${i}`} className="max-w-(--measure) text-sm text-fg-1">
          {i === 0 && (
            <>
              <span className={`${LABEL} mr-1`} title={PICK_EXPLAINED}>
                Analyst pick (LLM{narration.mode === 'replay' ? ', replayed' : ''})
              </span>{' '}
              <span className="sr-only">{PICK_EXPLAINED} </span>
            </>
          )}
          <Spans segs={r.segs} onTrace={onTrace} hint={hint} checking={checking} />
        </p>
      ))
    ) : pending ? (
      <p className={`max-w-(--measure) text-sm text-fg-2 ${pickInline && fold ? 'min-h-10' : ''}`}>
        <span className={`${LABEL} mr-1`}>Analyst pick (LLM)</span> Picking an observation&hellip;
      </p>
    ) : null;

  return (
    // Another clock: a bar in the feed's gutter and the stamp say so; the text keeps its colours (and its contrast).
    <div className={`relative flex flex-col gap-1.5 ${stale ? 'before:absolute before:inset-y-0 before:-left-2 before:w-0.5 before:rounded-xs before:bg-line-3' : ''}`}>
      <span id={hint} className="sr-only">
        {checked
          ? modelWords
            ? `${guard.verified} of ${guard.total} names and numbers in this answer were found in the graph results; the wording is the model’s. Checked names and evidence ids open the tool call and query that returned them.`
            : `${guard.verified} of ${plural(guard.total, 'claim')} verified against the graph. Verified names and evidence ids open the tool call and query that returned them.`
          : 'Not checked against the graph.'}
      </span>
      {shown.map((r, i) => row(r, i))}
      {pickInline && pick}

      {coverage && (
        <p className="max-w-(--measure) rounded-xs bg-bg-2 px-2 py-1.5 text-sm text-fg-0">
          <span className={`${LABEL} mr-1`}>Coverage</span> {coverage}
        </p>
      )}

      {expandable && (
        <>
          {/* One expander for everything the compact narrative leaves out, and its label says what that is. */}
          <button
            type="button"
            data-narrative-more=""
            aria-expanded={full}
            aria-controls={full ? more : undefined}
            onClick={() => setFull((f) => !f)}
            className={`${summary} self-start text-left text-fg-1`}
          >
            <span>{full ? 'Show less' : reveals}</span>
            <ChevronDown size={12} aria-hidden className={`shrink-0 transition-transform duration-(--dur-base) ease-out ${full ? 'rotate-180' : ''}`} />
          </button>
          {full && (
            <div id={more} className="flex flex-col gap-2">
              {!pickInline && pick}
              {folded.map((r, i) => row(r, i + shown.length))}
            </div>
          )}
        </>
      )}

      {/* the "N of N claims traced" row has this place once the guard answers: reserved at its height, so it adds no shift */}
      {checking && !claimsFolded && <p className="flex min-h-6 items-center text-xs text-fg-2 pointer-coarse:min-h-11">Checking the claims against the graph&hellip;</p>}
      {guard && guard.total === 0 && <p className="text-xs text-fg-1">Unverified: no claim in this text was checked against the graph.</p>}
      {guard && guard.total > 0 && !claimsFolded && <ClaimMap guard={guard} cards={cards} onTrace={onTrace} id={`flagged-claims${idSuffix}`} modelWords={modelWords} />}
      {unchecked && !checking && <p className="text-xs text-fg-2">Dashed names were not checked by the guard.</p>}
    </div>
  );
}

const asOf = (at: number | undefined, clock: number | undefined) => at !== undefined && clock !== undefined && Math.floor(at / 60_000) !== Math.floor(clock / 60_000);

/** True only once `on` has held for `ms`: a one-frame mismatch (the scrubber syncing to a new run's clock) never flashes a banner. */
function useHeld(on: boolean, ms: number): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on) return setHeld(false);
    const t = setTimeout(() => setHeld(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return on && held;
}

export function NarrativePanel({
  narration,
  guard,
  onTrace,
  cards,
  clockAt,
  onRerun,
  drafting,
  awaitingGuard,
  guest,
}: Omit<BlockProps, 'narration' | 'idSuffix' | 'stale' | 'fold' | 'stamp' | 'modelWords'> & { narration: NarrationView | null; clockAt?: number; onRerun?: () => void }) {
  // `clockAt` is the scrubber's resting clock (App: it follows a scrub once it stops, and a run's own clock at once), so this
  // line changes once per scrub and never claims the clock moved while a run is aligning it. Not a live region: the report
  // clock strip beside the table says it once, for screen readers.
  const stale = useHeld(narration !== null && asOf(narration.at, clockAt), 250);
  if (!narration) return null;
  return (
    <section aria-label="Narrative" className="animate-enter flex flex-col gap-2">
      <h3 className="sr-only">Narrative</h3>
      {stale && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-0">
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
        awaitingGuard={awaitingGuard}
        guest={guest}
        stamp={narration.at !== undefined ? <span className={`font-mono text-xs tabular-nums ${stale ? 'text-fg-0' : 'text-fg-1'}`}>as of {utcLabel(narration.at)}</span> : undefined}
      />
    </section>
  );
}
