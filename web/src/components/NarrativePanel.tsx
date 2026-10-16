/* NarrativePanel: the narration as text + claim chips (docs/design.md section 5). Never innerHTML (S5).
 * The text is the deterministic Verdict / Why / Notify / Do the server builds from the report (always complete). An optional
 * `note` is the analyst pick: one observation the LLM chose; the server wrote its words from the report. Its own short
 * paragraph run in after the label "Analyst pick · LLM live" (or "replayed": the run's real mode; what the model did is the
 * label's title and screen-reader text), never mixed into the facts; no pick, no block.
 * The narration is untrusted, so a claim is "verified" ONLY if the server's guard listed that exact text with ok=true
 * (data/narration.ts decides; this file renders). No raw markdown ever reaches the screen (stripped there).
 *
 * Nothing is ever clamped mid-sentence. The Verdict reads as a headline plus one line per tier: the SAME text, broken before
 * " LOCKED, ", " WOULD_PULL, " and " Marked remediated:" (data/narration.ts verdictLines; presentation only, so chips, claim
 * checks and copy see the identical text). Its label row always says "Verdict" (a pasted repo's "Verdict (its lockfile at
 * commit ...):" is parsed so; that provenance is a small line under the label). The triage narrative (`fold`) keeps the tool
 * calls (the FalkorDB proof) near the top of the feed: Why shows whole path sentences only (data/narration.ts whyParts: one
 * on a laptop-height window, 1280x720 included, two on a tall one, all on a phone, where the feed is the page).
 * Under Why sit the agent's acts, always on the first screen (docs/design.md round 7): the analyst pick, one "Notify 7 teams"
 * line (names cut to three; "Roster" opens the fold scrolled to the roster) and, from AgentContext, one "Next qix?" line that
 * opens the Concentration tab. Where room is short (`tight`: 1280x720, 1024x768) the Next line goes first; the pick and Notify stay.
 * The rest of Why, the roster, Do and the claim map sit behind ONE disclosure that says what it reveals ("Show 2 more evidence
 * paths, who to notify, the steps and the claim map"). An Ask answer shows every line it has (`fold` is off).
 * A roster line (Notify, or an enumerating answer grouped by team) is a list, one row per team: the team (it opens its proof),
 * its channel, its repos as text, and for the demo org's Notify a "Copy notice" at the end of the row (that team's message,
 * Report.notices, plus a link back to the run; the drawer copies it one repo at a time). A pasted repo has no team to notify
 * (its Notify line, if any, is not shown). A narration for another clock is marked by a bar at its left edge and the "as of"
 * stamp, never by dimming its text (dimmed text fell under 4.5:1).
 *
 * Every verified claim leads to proof: a chip, an [E1] tag, or an entry in the claim map calls onTrace(entity); the feed
 * scrolls to the tool call that returned it, opens its Cypher and flashes the row (ToolFeed + ToolCard).
 * Only the FIRST mention of an entity can be a chip; repeats are plain text with a dotted underline (not a tab stop). A line
 * with more than LIST_MAX verified names is a list: its names get the same dotted-underline look but stay buttons (a wall of
 * boxed chips reads as noise; the click still opens the proof). "Verified" is said once, in text for screen readers.
 * On a coarse pointer a Why sentence's names are text (stacked 28px lines cannot each give a chip a 44px target): its proof is
 * a row of 44px "Evidence E1" buttons under it. Each row's chips are one Tab stop (roving: the arrow keys move between them).
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
import { createContext, Fragment, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { plural, utcLabel } from '../data/format.ts';
import { citeCount, claimMap, crowded, guardLine, lines, splitCoverage, teamStarts, verdictLines, whyParts, type ProofCard, type Segment } from '../data/narration.ts';
import type { Notice } from '../data/types.ts';
import type { Guard, Narration } from '../data/useTriage.ts';
import { pickLabel, teamNames } from './agent.ts';
import { Button } from './Button.tsx';
import { CheckDrawIcon } from './icons/CheckDrawIcon.tsx';
import { ArrowRight, ChevronDown, Copy } from './icons/Glyphs.tsx';
import { copyText } from './copy.ts';
import { reveal } from './scrollPane.ts';
import { subject } from './ToolCard.tsx';

/** A narration as the server may send it: the contract adds `note`, `at` and `draft`, which older servers omit. */
export type NarrationView = Narration & { note?: string | null; at?: number; draft?: boolean };

/** The "Next qix?" line (label, the rest, from agent.ts nextAccount) and where it leads; App provides it, null when there is none. */
export const AgentContext = createContext<{ label: string; text: string; open: () => void } | null>(null);

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
  /** Each team's notice (Report.notices): the Notify roster offers "Copy notice" per team. */
  notices?: Notice[];
  /** A link back to this run, appended to each copied team notice ("Details: ..."); null when the run cannot be shared. */
  noticeLink?: string | null;
}

const NOT_RETURNED = 'not returned by any graph query';
const chip = 'rounded-xs border px-1.5 py-0.5 font-mono text-xs';
// A 44px hit area on touch: a pseudo-element reaching 11px into the line gaps (10px past the 1px border), with no change to the chip's size; lines are 28px on touch.
const HIT = 'relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-0.5 pointer-coarse:after:-inset-y-[11px]';
const LABEL = 'label-caps text-xs';
const PICK_EXPLAINED = 'The model chose this observation; the words come from the graph.';
// The pick's place while it is coming (about its usual height at each width: 5 lines in the 320px feed, 4 in 360px), so it lands
// without moving what is below it.
const PICK_ROOM = 'min-h-28 sm:min-h-[3.75rem] lg:min-h-20 fold:min-h-[5.7rem] min-[1440px]:fold:min-h-[4.6rem]';
const TRACE_TITLE = 'Verified against a graph query. Click to open the tool call that returned it.';
const summary = 'inline-flex min-h-6 items-center gap-1.5 rounded-xs text-xs pointer-coarse:min-h-11 marker:hidden [&::-webkit-details-marker]:hidden hov:text-fg-0';
const chevron = 'transition-transform duration-(--dur-base) ease-out [details[open]_&]:rotate-180';
const TIER_WORD = /^(LOCKED|WOULD_PULL)(?=, )/;
const TIER_TEXT: Record<string, string> = { LOCKED: 'text-tier-locked', WOULD_PULL: 'text-tier-would-pull' };

/** "a, b and c" */
const sayList = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** The roster's per-team copy: that team's notice text (Report.notices), the same words the drawer's Notice tab copies, plus
 * a link back to this run (the per-repo notice carries one too). Last on the team's row: 24px, 44px on a coarse pointer. */
function CopyNotice({ team, text, link }: { team: string; text: string; link?: string | null }) {
  return (
    <button
      type="button"
      onClick={() => void copyText(link ? `${text}\nDetails: ${link}` : text, `${team} notice`)}
      aria-label={`Copy notice for ${team}`}
      title={`Copy the message for ${team}'s channel (plain text, every repo of theirs with its fix, and a link to this run)`}
      className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-xs px-1 text-xs whitespace-nowrap text-fg-1 underline underline-offset-2 hov:text-fg-0 pointer-coarse:min-h-11 pointer-coarse:px-2"
    >
      <Copy size={12} />
      Copy notice
    </button>
  );
}

type Entity = Extract<Segment, { kind: 'entity' }>;
interface TeamRow {
  team: Entity;
  channel: string | null;
  rest: Segment[];
}
/**
 * A roster line ("`Payments` (`#team-payments`): `acme/checkout-web` (LOCKED); `Docs` ...") as one row per team: the team,
 * its channel and the rest of its group (the repos), with the separators trimmed. `head` is whatever precedes the first team
 * ("Complete list (prod only): 14 repos across 6 teams."). null when the line names no team. Presentation only: the
 * segments are the guard's, so chips and claim checks are unchanged.
 */
function rosterOf(segs: Segment[]): { head: Segment[]; teams: TeamRow[] } | null {
  const starts = [...teamStarts(segs)].sort((a, b) => a - b);
  if (!starts.length) return null;
  const teams = starts.map((s, k): TeamRow => {
    let rest = segs.slice(s + 1, starts[k + 1] ?? segs.length);
    let channel: string | null = null;
    const [a, b, c] = rest;
    if (a?.kind === 'text' && a.text === ' (' && b?.kind === 'entity' && c?.kind === 'text' && c.text.startsWith('):')) {
      channel = b.text;
      rest = [{ kind: 'text', text: c.text.slice(2) }, ...rest.slice(3)];
    } else if (a?.kind === 'text' && a.text.startsWith(':')) rest = [{ kind: 'text', text: a.text.slice(1) }, ...rest.slice(1)];
    const trim = (s: Segment, re: RegExp): Segment[] => (s.kind !== 'text' ? [s] : s.text.replace(re, '') ? [{ kind: 'text', text: s.text.replace(re, '') }] : []);
    if (rest[0]) rest = [...trim(rest[0], /^\s+/), ...rest.slice(1)];
    if (rest.at(-1)) rest = [...rest.slice(0, -1), ...trim(rest.at(-1)!, /[;,]?\s*$/)];
    return { team: segs[s] as Entity, channel, rest };
  });
  return { head: segs.slice(0, starts[0]), teams };
}

/** A [E1] id's accessible name: what it is and what it opens (the visible "[E1]" is inside it, WCAG 2.5.3). */
const citeName = (id: string) => `Evidence ${id}: open the explain_path query`;

function Spans({ segs, onTrace, hint, checking = false, still = false }: { segs: Segment[]; onTrace: (e: string) => void; hint: string; checking?: boolean; still?: boolean }) {
  const list = crowded(segs); // a list of names: no boxes
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
          if (s.verdict === 'verified' && still) return <span key={i} className="font-mono text-xs text-fg-1">[{s.id}]</span>; // its button is in the evidence row
          if (s.verdict === 'verified') {
            return (
              <button key={i} type="button" data-cite="" data-chip="" aria-label={citeName(s.id)} aria-describedby={hint} onClick={() => onTrace(s.id)} className="-my-1.5 rounded-xs px-1 py-1.5 font-mono text-xs text-fg-1 underline underline-offset-2 hov:text-fg-0 relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-0.5 pointer-coarse:after:-inset-y-[7px]">
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
        if (still) {
          // verified, but not a control here: a touch Why sentence (its proof is the evidence row under it) or a roster's repos
          return (
            <span key={i} className="font-mono text-xs text-fg-0">
              {s.text}
            </span>
          );
        }
        if (list) {
          // a name in a long list: verified and clickable like a chip, without the box
          return (
            <button
              key={i}
              type="button"
              data-chip=""
              aria-describedby={hint}
              onClick={() => onTrace(s.text)}
              title={TRACE_TITLE}
              className="-my-1.5 rounded-xs px-0.5 py-1.5 font-mono text-xs text-fg-0 underline decoration-dotted decoration-fg-1 decoration-1 underline-offset-4 transition-colors duration-(--dur-fast) ease-out hov:decoration-fg-0 relative pointer-coarse:after:absolute pointer-coarse:after:-inset-x-0.5 pointer-coarse:after:-inset-y-[7px]"
            >
              {s.text}
            </button>
          );
        }
        return (
          <button
            key={i}
            type="button"
            data-chip=""
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
        {/* each claim its own quoted item: "1 repo" and "4 repos" are two counts, not one phrase */}
        {map.unmatched.length > 0 && (
          <div className="text-xs text-fg-1">
            <p>
              {map.unmatched.length === 1 ? 'This claim was' : `These ${map.unmatched.length} claims were`} checked against the run as a whole, not one tool call:
            </p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {map.unmatched.map((c) => (
                <li key={c} className="rounded-xs bg-bg-3 px-1.5 font-mono text-fg-0">
                  &ldquo;{c}&rdquo;
                </li>
              ))}
            </ul>
          </div>
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
// to 900px tall (a laptop) it shows the Verdict, one whole Why sentence, the agent lines and the disclosure; on a taller one,
// two Why sentences. On one 800px tall or less (`low`: 1366x768), still one Why sentence with its [E1]: the verdict's headline
// drops its "In hindsight: ..." sentence instead (the band and the scrubber's marks say when), so the pick, the Notify line,
// the "Next qix?" line and the disclosure all clear the pinned Ask bar. Where there is less room still (`tight`: 720px tall or
// less, or 800px in the two-pane band where the band takes two rows: 1280x720, 1024x768) the Next line goes first; the pick
// and Notify stay. Below 1024px the feed is the page: all of Why.
type Room = 'phone' | 'tight' | 'low' | 'short' | 'tall';
const WIDE = '(min-width: 1024px)';
const SHORT = '(min-width: 1024px) and (max-height: 900px)';
const LOW = '(min-width: 1024px) and (max-height: 800px)';
const TIGHT = '(min-width: 1024px) and (max-height: 720px), (min-width: 1024px) and (max-width: 1279px) and (max-height: 800px)';
const COARSE = '(pointer: coarse)';
const subscribe = (cb: () => void) => {
  const qs = [matchMedia(WIDE), matchMedia(SHORT), matchMedia(LOW), matchMedia(TIGHT), matchMedia(COARSE)];
  qs.forEach((q) => q.addEventListener('change', cb));
  return () => qs.forEach((q) => q.removeEventListener('change', cb));
};
const room = (): Room => (!matchMedia(WIDE).matches ? 'phone' : matchMedia(TIGHT).matches ? 'tight' : matchMedia(LOW).matches ? 'low' : matchMedia(SHORT).matches ? 'short' : 'tall');
const useRoom = () => useSyncExternalStore(subscribe, room, () => 'tall' as Room);
const useCoarse = () => useSyncExternalStore(subscribe, () => matchMedia(COARSE).matches, () => false);
const WHY_SHOWN: Record<Room, number> = { phone: Infinity, tight: 1, low: 1, short: 1, tall: 2 };

/** The headline without its "In hindsight: ..." sentence (a low or tight room: the band and the scrubber's marks say when). Presentation only. */
function withoutHindsight(segs: Segment[]): Segment[] {
  const i = segs.findIndex((s) => s.kind === 'text' && s.text.includes(' In hindsight:'));
  if (i < 0) return segs;
  const s = segs[i] as { text: string };
  return [...segs.slice(0, i), { kind: 'text', text: `${s.text.slice(0, s.text.indexOf(' In hindsight:'))} ` }]; // the space before the next tier line stays
}

/**
 * Roving focus inside each narrative row (`[data-roving]`): its chips are one Tab stop, Left / Right / Home / End move between
 * them, and the row remembers the last one used. Seven chips used to be seven stops before the first tool call.
 */
function useRoving(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    for (const row of root.current?.querySelectorAll<HTMLElement>('[data-roving]') ?? []) {
      const chips = [...row.querySelectorAll<HTMLElement>('[data-chip]')];
      const active = chips.find((c) => c.dataset.active === '') ?? chips[0];
      chips.forEach((c) => {
        c.tabIndex = c === active ? 0 : -1;
        if (c === active) c.dataset.active = '';
        else delete c.dataset.active;
      });
    }
  });
}
const rovingKeys = (e: KeyboardEvent<HTMLElement>) => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-chip]');
  const row = chip?.closest('[data-roving]');
  if (!chip || !row || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
  const chips = [...row.querySelectorAll<HTMLElement>('[data-chip]')];
  const i = chips.indexOf(chip);
  const next = chips[e.key === 'Home' ? 0 : e.key === 'End' ? chips.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + chips.length) % chips.length];
  if (!next) return;
  e.preventDefault();
  chips.forEach((c) => ((c.tabIndex = c === next ? 0 : -1), c === next ? (c.dataset.active = '') : delete c.dataset.active));
  next.focus();
};
const rovingFocus = (e: FocusEvent<HTMLElement>) => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-chip]');
  const row = chip?.closest('[data-roving]');
  if (!chip || !row) return;
  row.querySelectorAll<HTMLElement>('[data-chip]').forEach((c) => ((c.tabIndex = c === chip ? 0 : -1), c === chip ? (c.dataset.active = '') : delete c.dataset.active));
};

/** "Show 2 more evidence paths, the analyst pick, who to notify and the steps": what the one disclosure reveals. */
const revealLabel = (parts: (string | null | false)[]) => {
  const xs = parts.filter((x): x is string => !!x);
  return xs.length ? `Show ${sayList(xs)}` : 'Show the rest';
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function NarrationBlock({ narration, guard, onTrace, cards = [], idSuffix = '', stale = false, fold = false, drafting = false, awaitingGuard = false, stamp, modelWords = false, guest = false, notices, noticeLink = null }: BlockProps) {
  const hint = useId();
  const more = useId();
  const space = useRoom();
  const coarse = useCoarse();
  const root = useRef<HTMLDivElement>(null);
  useRoving(root);
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
  // The agent's acts under Why (the triage narrative only): the pick, the Notify summary, the Next line (never on a `tight` window).
  const next = useContext(AgentContext);
  const notifyRow = fold ? folded.find((r) => r.label === 'Notify') : undefined;
  const notifyTeams = notifyRow ? (rosterOf(notifyRow.segs)?.teams.map((t) => t.team.text) ?? []) : [];
  const [toRoster, setToRoster] = useState(0); // "Roster": open the fold, then scroll to the roster once it is there
  useEffect(() => {
    const el = toRoster ? root.current?.querySelector<HTMLElement>('[data-roster]') : null;
    if (!el) return;
    el.focus({ preventScroll: true });
    reveal(el, 'top');
  }, [toRoster]);
  // The claim map ("62 of 62 claims traced", which the header badge also counts) folds with the rest, except on a tall window.
  const claimsFolded = fold && !full && space !== 'tall' && (checking || (guard !== null && guard.total > 0));
  const evidence = `${cites} ${whyShown === 0 ? '' : 'more '}evidence ${cites === 1 ? 'path' : 'paths'}`;
  const reveals = revealLabel([
    whyHidden.length > 0 && (whyShown === 0 ? (cites > 0 ? `why (${evidence})` : 'why') : cites > 0 ? evidence : 'the rest of why'),
    folded.some((r) => r.label === 'Notify') && 'who to notify',
    folded.some((r) => r.label === 'Do') && 'the steps',
    claimsFolded && 'the claim map',
  ]);
  const expandable = fold && (full || folded.length > 0 || whyHidden.length > 0 || claimsFolded);
  const tight = `pointer-coarse:leading-7 ${fold ? 'fold:leading-[18px]' : ''}`; // a laptop-height window: 13px lines a step closer

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
  const noticeFor = (team: string) => (guest ? undefined : notices?.find((n) => n.team === team)?.text);
  // On a coarse pointer the Why sentence's names are text, not 28px chips stacked on 28px lines: its proof is a row of 44px
  // evidence buttons under it ([E1] opens the explain_path call, which returns every name in that sentence).
  const whyCites = (parts: Segment[][]) => parts.flat().filter((s): s is Extract<Segment, { kind: 'cite' }> => s.kind === 'cite' && s.verdict === 'verified').map((s) => s.id);
  const roster = (r: Row, i: number) => {
    const ro = (r.label === 'Notify' || crowded(r.segs)) && !guest ? rosterOf(r.segs) : null;
    if (!ro) return null;
    const notify = r.label === 'Notify';
    return (
      // the Notify roster is where "Roster" lands (focus, then scroll): a labelled group, so the move is announced
      <div key={`${r.label}-${i}`} {...(notify ? { 'data-roster': '', tabIndex: -1, role: 'group', 'aria-label': 'Who to notify' } : {})} className="flex max-w-(--measure) flex-col gap-1 text-sm text-fg-0">
        {(r.label || ro.head.length > 0) && (
          <p data-roving="">
            {label(r)}
            <Spans segs={ro.head} onTrace={onTrace} hint={hint} checking={checking} />
          </p>
        )}
        <ul className="flex flex-col">
          {ro.teams.map(({ team, channel, rest }, k) => {
            const text = noticeFor(team.text);
            return (
              <li key={`${team.text}-${k}`} className="flex items-start gap-3 border-t border-line-1 py-1 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2">
                    {team.verdict === 'verified' ? (
                      <button type="button" aria-describedby={hint} onClick={() => onTrace(team.text)} title={TRACE_TITLE} className="inline-flex min-h-6 items-center rounded-xs font-medium text-fg-0 underline-offset-2 hov:underline pointer-coarse:min-h-11">
                        {team.text}
                      </button>
                    ) : (
                      <Spans segs={[team]} onTrace={onTrace} hint={hint} checking={checking} />
                    )}
                    {channel && <span className="font-mono text-xs text-fg-1">{channel}</span>}
                  </p>
                  {/* a repo name never breaks at its hyphen ("swagger-" / "ui"): the line wraps between names */}
                  {rest.length > 0 && (
                    <p className="font-mono text-xs text-fg-1 [&>span]:whitespace-nowrap">
                      <Spans segs={rest} onTrace={onTrace} hint={hint} checking={checking} still />
                    </p>
                  )}
                </div>
                {text && <CopyNotice team={team.text} text={text} link={noticeLink} />}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };
  const row = (r: Row, i: number) => {
    const head = r.label === 'Verdict' || (i === 0 && stamp);
    const verdict = r.label === 'Verdict' ? verdictLines(r.segs) : null;
    if (!verdict && r !== why) {
      const listed = roster(r, i);
      if (listed) return listed;
    }
    const whyNow = r === why ? whyAll.slice(0, whyShown) : [];
    const evidenceRow = coarse && r === why ? whyCites(whyNow) : [];
    // a low room: one Why sentence and the agent lines instead of the headline's hindsight clause (the scrubber's marks say when)
    const trim = compact && (space === 'tight' || space === 'low');
    return (
      <Fragment key={`${r.label}-${i}`}>
        {head && (
          <p className="flex max-w-(--measure) items-baseline justify-between gap-2">
            {r.label ? <span className={LABEL}>{r.label}</span> : <span />} {stamp}
          </p>
        )}
        {r.source && <p className="-mt-1 max-w-(--measure) text-xs text-fg-1">{cap(r.source)}</p>}
        <p data-roving="" className={`max-w-(--measure) text-fg-0 ${r.label === 'Verdict' || !r.label ? `text-md ${fold && r.label === 'Verdict' ? 'fold:text-base' : ''}` : `text-sm ${tight}`}`}>
          {!head && label(r)}
          {verdict ? (
            verdict.map((segs, j) =>
              j === 0 ? (
                <Spans key={j} segs={trim ? withoutHindsight(segs) : segs} onTrace={onTrace} hint={hint} checking={checking} />
              ) : (
                // a tier's sentence on its own line: the same paragraph, so it is read as one
                <span key={j} className={`mt-1 block text-sm ${fold ? 'fold:mt-0.5' : ''} ${tight}`}>
                  <Spans segs={segs} onTrace={onTrace} hint={hint} checking={checking} />
                </span>
              ),
            )
          ) : r === why ? (
            whyNow.map((segs, j) => (
              <Fragment key={j}>
                {j > 0 && ' '}
                <Spans segs={segs} onTrace={onTrace} hint={hint} checking={checking} still={evidenceRow.length > 0} />
              </Fragment>
            ))
          ) : (
            <Spans segs={r.segs} onTrace={onTrace} hint={hint} checking={checking} />
          )}
        </p>
        {evidenceRow.length > 0 && (
          <div data-roving="" role="group" aria-label="Evidence for the paths above" className="flex flex-wrap gap-2">
            {evidenceRow.map((id) => (
              <button key={id} type="button" data-chip="" aria-label={citeName(id)} aria-describedby={hint} onClick={() => onTrace(id)} className="inline-flex min-h-11 items-center rounded-sm border border-line-2 bg-bg-2 px-3 text-sm text-fg-0 transition-transform duration-(--dur-press) ease-out active:scale-(--press-scale)">
                Evidence <span className="ml-1 font-mono text-xs">{id}</span>
              </button>
            ))}
          </div>
        )}
      </Fragment>
    );
  };
  // The analyst pick, run in after its label; what the model did is the label's title and screen-reader text. Nothing at all
  // when no observation was picked. While it is coming, its place is held.
  const pick =
    note !== null ? (
      note.map((r, i) => (
        <p key={`pick-${i}`} data-roving="" className={`max-w-(--measure) text-sm text-fg-1 ${tight}`}>
          {i === 0 && (
            <>
              <span className={`${LABEL} mr-1`} title={PICK_EXPLAINED}>
                {pickLabel(narration.mode)}
              </span>{' '}
              <span className="sr-only">{PICK_EXPLAINED} </span>
            </>
          )}
          <Spans segs={r.segs} onTrace={onTrace} hint={hint} checking={checking} />
        </p>
      ))
    ) : pending ? (
      <p className={`max-w-(--measure) text-sm text-fg-2 ${fold ? PICK_ROOM : ''}`}>
        <span className={`${LABEL} mr-1`}>Analyst pick · LLM</span> Picking an observation&hellip;
      </p>
    ) : null;
  // "Notify 7 teams": the roster's headcount and first names on one line; "Roster" opens the fold scrolled to the roster.
  const notify =
    notifyTeams.length > 0 ? (
      <p data-agent="notify" className={`flex items-center gap-x-2 text-sm ${tight}`}>
        <span className="shrink-0 whitespace-nowrap">
          <span className={LABEL}>Notify</span> <span className="text-fg-0 tabular-nums">{plural(notifyTeams.length, 'team')}</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-fg-1" title={notifyTeams.join(', ')}>
          {teamNames(notifyTeams)}
        </span>
        <button
          type="button"
          onClick={() => (setFull(true), setToRoster((n) => n + 1))}
          aria-label={`Open the roster of ${plural(notifyTeams.length, 'team')} to notify`}
          className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-xs px-1 text-xs whitespace-nowrap text-fg-1 underline underline-offset-2 hov:text-fg-0 pointer-coarse:min-h-11 pointer-coarse:px-2"
        >
          Roster
          <ChevronDown size={12} aria-hidden />
        </button>
      </p>
    ) : null;
  // "Next qix? sindresorhus: 43% of top-3 PageRank, reaches 21 of 21 repos": the Concentration tab's first row, which it opens.
  const nextLine =
    next && fold && space !== 'tight' ? (
      <button type="button" data-agent="next" onClick={next.open} className={`flex min-h-6 w-full items-start gap-1.5 rounded-xs text-left text-sm underline-offset-2 hov:underline pointer-coarse:min-h-11 pointer-coarse:items-center ${tight}`}>
        <span className="min-w-0 flex-1">
          <span className="font-medium text-fg-0">{next.label}</span> <span className="text-fg-1">{next.text}</span>
          <span className="sr-only"> Opens the Concentration tab.</span>
        </span>
        <ArrowRight size={12} aria-hidden className="mt-[3px] shrink-0 text-fg-1 pointer-coarse:mt-0" />
      </button>
    ) : null;

  return (
    // Another clock: a bar in the feed's gutter and the stamp say so; the text keeps its colours (and its contrast).
    <div ref={root} onKeyDown={rovingKeys} onFocus={rovingFocus} className={`relative flex flex-col gap-1.5 ${stale ? 'before:absolute before:inset-y-0 before:-left-2 before:w-0.5 before:rounded-xs before:bg-line-3' : ''}`}>
      <span id={hint} className="sr-only">
        {checked
          ? modelWords
            ? `${guard.verified} of ${guard.total} names and numbers in this answer were found in the graph results; the wording is the model’s. Checked names and evidence ids open the tool call and query that returned them; the arrow keys move between them.`
            : `${guard.verified} of ${plural(guard.total, 'claim')} verified against the graph. Verified names and evidence ids open the tool call and query that returned them; the arrow keys move between them.`
          : 'Not checked against the graph.'}
      </span>
      {shown.map((r, i) => (r === why && whyShown === 0 ? null : row(r, i)))}
      {fold ? (
        (pick || notify || nextLine) && (
          <div role="group" aria-label="What the agent did" className="flex flex-col gap-1 tight:gap-0.5">
            {pick}
            {notify}
            {nextLine}
          </div>
        )
      ) : (
        pick
      )}

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

/**
 * The agent lines' place while the verdict is still coming. ToolFeed's placeholder is about the verdict's own height; this adds
 * what the pick, Notify and Next lines will take (about, per room), so the tool calls do not jump down when the verdict lands.
 */
function AgentRoom() {
  return (
    <div aria-hidden className="flex flex-col gap-2 max-sm:min-h-[16.3rem] sm:max-lg:hidden lg:min-h-[14rem] fold:min-h-[8.8rem] low:min-h-[5.8rem] tight:min-h-[7.3rem]">
      {['w-full', 'w-11/12', 'w-3/4'].map((w) => (
        <div key={w} className={`skeleton h-3 ${w}`} />
      ))}
    </div>
  );
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
  notices,
  noticeLink,
}: Omit<BlockProps, 'narration' | 'idSuffix' | 'stale' | 'fold' | 'stamp' | 'modelWords'> & { narration: NarrationView | null; clockAt?: number; onRerun?: () => void }) {
  // `clockAt` is the scrubber's resting clock (App: it follows a scrub once it stops, and a run's own clock at once), so this
  // line changes once per scrub and never claims the clock moved while a run is aligning it. Not a live region: the report
  // clock strip beside the table says it once, for screen readers.
  const stale = useHeld(narration !== null && asOf(narration.at, clockAt), 250);
  if (!narration) return awaitingGuard && !guest ? <AgentRoom /> : null;
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
        notices={notices}
        noticeLink={noticeLink}
        stamp={narration.at !== undefined ? <span className={`font-mono text-xs tabular-nums ${stale ? 'text-fg-0' : 'text-fg-1'}`}>as of {utcLabel(narration.at)}</span> : undefined}
      />
    </section>
  );
}
