/* NarrativePanel: the narration as text + claim chips (docs/design.md section 5). Never innerHTML (S5).
 * The text is the deterministic Verdict / Notify / Do the server builds from the report (always complete). An optional
 * `note` is the LLM analyst's summary: shown on its own line, labelled "Analyst note (LLM)", never mixed into the facts.
 * The narration is untrusted, so a claim is "verified" ONLY if the server's guard listed that exact text with ok=true
 * (data/narration.ts decides; this file renders). No raw markdown ever reaches the screen (stripped there).
 *
 * Every verified claim leads to proof: a chip, an [E1] tag, or an entry in the claim map calls onTrace(entity); the feed
 * scrolls to the tool call that returned it, opens its Cypher and flashes the row (ToolFeed + ToolCard).
 * Only the FIRST mention of an entity is a chip; repeats are plain text with a dotted underline. "Verified" is said
 * once, in text for screen readers (the line above the text), not after every chip.
 * The "N of N claims traced" line is a native disclosure (id="flagged-claims", the header badge opens it): a compact
 * map of claim -> tool call -> queries, plus the flagged claims as text.
 *
 * NarrativePanel props:  narration, guard, onTrace(entity), cards (ToolCardState[] this narration may cite, preferred
 *                        first), clockAt (scenario clock now: when the narration's `at` differs, it is dimmed, stamped
 *                        "as of HH:MM UTC" and offers a re-run), onRerun
 * NarrationBlock props:  the same body without the heading, reused by Ask follow-ups; idSuffix keeps ids unique.
 * A trailing "6 of 14 ..." line (the server's coverage of an enumerating answer) is set apart, not buried in the text.
 */
import { useId } from 'react';
import { plural, utcLabel } from '../data/format.ts';
import { claimMap, lines, splitCoverage, type ProofCard, type Segment } from '../data/narration.ts';
import type { Guard, Narration } from '../data/useTriage.ts';
import { Button } from './Button.tsx';
import { CheckDrawIcon } from './icons/CheckDrawIcon.tsx';
import { ChevronDown } from './icons/Glyphs.tsx';
import { subject } from './ToolCard.tsx';

/** A narration as the server may send it: the contract adds `note` and `at`, which older servers omit. */
export type NarrationView = Narration & { note?: string | null; at?: number };

interface BlockProps {
  narration: NarrationView;
  guard: Guard | null;
  onTrace: (entity: string) => void;
  cards?: ProofCard[];
  idSuffix?: string;
  /** The clock moved since this narration was written: shown dimmed. */
  stale?: boolean;
}

const NOT_RETURNED = 'not returned by any graph query';
const chip = 'rounded-xs border px-1.5 py-0.5 font-mono text-xs';

function Spans({ segs, onTrace, hint }: { segs: Segment[]; onTrace: (e: string) => void; hint: string }) {
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
        if (s.verdict === 'plain') {
          return (
            <span key={i} className={`${chip} border-dashed border-line-3 text-fg-1`} title="The guard did not check this text">
              {s.text}
              <span className="sr-only"> (not checked)</span>
            </span>
          );
        }
        return (
          <button
            key={i}
            type="button"
            aria-describedby={hint}
            onClick={() => onTrace(s.text)}
            title="Verified against a graph query. Click to open the tool call that returned it."
            className={`${chip} -my-0.5 inline-flex items-center pointer-coarse:min-h-6 border-line-2 bg-bg-2 text-fg-0 transition-transform duration-(--dur-press) ease-out active:scale-(--press-scale) hov:border-line-3 hov:bg-bg-3`}
          >
            {s.text}
          </button>
        );
      })}
    </>
  );
}

const LABEL = 'label-caps';

/** The claim -> tool call -> queries map, and the flagged claims as text. */
function ClaimMap({ guard, cards, onTrace, id }: { guard: Guard; cards: ProofCard[]; onTrace: (e: string) => void; id: string }) {
  const map = claimMap(guard.claims, cards);
  const all = guard.verified >= guard.total;
  return (
    <details id={id} className="text-sm">
      <summary className={`inline-flex min-h-6 items-center gap-1.5 rounded-xs text-xs ${all ? 'text-fg-1' : 'text-tier-would-pull'} marker:hidden [&::-webkit-details-marker]:hidden hov:text-fg-0`}>
        <CheckDrawIcon size={14} className={all ? 'text-tier-clean' : 'text-tier-would-pull'} />
        <span>
          {guard.verified} of {plural(guard.total, 'claim')} traced to a graph query
          {guard.flagged.length > 0 && ` · ${guard.flagged.length} flagged`}
        </span>
        <ChevronDown size={12} aria-hidden className="transition-transform duration-(--dur-base) ease-out [details[open]_&]:rotate-180" />
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
                      <span className="text-xs text-fg-1">{plural(n, 'query', 'queries')}, open it</span>
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

export function NarrationBlock({ narration, guard, onTrace, cards = [], idSuffix = '', stale = false }: BlockProps) {
  const hint = useId();
  const { body, coverage } = splitCoverage(narration.text);
  const rows = lines(body, guard);
  const note = narration.note?.trim() ? lines(narration.note, guard) : null;
  const unchecked = [...rows, ...(note ?? [])].some((l) => l.segs.some((s) => s.kind === 'entity' && s.verdict === 'plain'));
  const checked = guard !== null && guard.total > 0;

  return (
    <div className={`flex flex-col gap-2 transition-opacity duration-(--dur-slow) ${stale ? 'opacity-70' : ''}`}>
      <span id={hint} className="sr-only">
        {checked ? `${guard.verified} of ${plural(guard.total, 'claim')} verified against the graph. Verified names and evidence ids open the tool call and query that returned them.` : 'Not checked against the graph.'}
      </span>
      {rows.map((r, i) =>
        r.label ? (
          <div key={i} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2">
            <span className={`${LABEL} pt-1.5`}>{r.label}</span>
            <p className="max-w-(--measure) text-md text-fg-0">
              <Spans segs={r.segs} onTrace={onTrace} hint={hint} />
            </p>
          </div>
        ) : (
          <p key={i} className="max-w-(--measure) text-md text-fg-0">
            <Spans segs={r.segs} onTrace={onTrace} hint={hint} />
          </p>
        ),
      )}

      {coverage && (
        <p className="max-w-(--measure) rounded-xs bg-bg-2 px-2 py-1.5 text-sm text-fg-0">
          <span className={`${LABEL} mr-2`}>Coverage</span>
          {coverage}
        </p>
      )}

      {note && (
        <div className="mt-1 flex flex-col gap-1">
          <p className={LABEL}>Analyst note (LLM){narration.mode === 'replay' ? ', replayed' : ''}</p>
          {note.map((r, i) => (
            <p key={i} className="max-w-(--measure) text-sm text-fg-1">
              <Spans segs={r.segs} onTrace={onTrace} hint={hint} />
            </p>
          ))}
        </div>
      )}

      {guard && guard.total === 0 && <p className="text-xs text-fg-1">Unverified: no claim in this text was checked against the graph.</p>}
      {guard && guard.total > 0 && <ClaimMap guard={guard} cards={cards} onTrace={onTrace} id={`flagged-claims${idSuffix}`} />}
      {unchecked && <p className="text-xs text-fg-2">Dashed names were not checked by the guard.</p>}
    </div>
  );
}

const asOf = (at: number | undefined, clock: number | undefined) => at !== undefined && clock !== undefined && Math.floor(at / 60_000) !== Math.floor(clock / 60_000);

export function NarrativePanel({
  narration,
  guard,
  onTrace,
  cards,
  clockAt,
  onRerun,
}: Omit<BlockProps, 'narration' | 'idSuffix' | 'stale'> & { narration: NarrationView | null; clockAt?: number; onRerun?: () => void }) {
  if (!narration) return null;
  const stale = asOf(narration.at, clockAt);
  return (
    <section aria-label="Narrative" className="animate-enter flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={LABEL}>Narrative</h3>
        {narration.at !== undefined && <span className="font-mono text-xs text-fg-1 tabular-nums">as of {utcLabel(narration.at)}</span>}
      </div>
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
      <NarrationBlock narration={narration} guard={guard} onTrace={onTrace} cards={cards} stale={stale} />
    </section>
  );
}
