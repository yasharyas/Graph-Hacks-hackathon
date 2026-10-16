/* ToolCard: one tool call in the feed (docs/design.md section 5). A card sits directly on the panel.
 * Props:
 *   card          ToolCardState from useTriage(): tool, params, status (pending | done | error | cancelled), result, error
 *   scenario      ScenarioId for GET /api/plan ("Show plan" = GRAPH.EXPLAIN); null disables the plan button
 *   index         position in the feed, for the enter stagger (first 6 only)
 *   open, onOpenChange   the card body is open (controlled by ToolFeed so "expand all" and a clicked claim can open it);
 *                 uncontrolled when omitted. A finished card is collapsed by default: one line (name, subject, the
 *                 server's summary, ms) and ONE tab stop. Opening it shows the rows AND the Cypher at once (the Cypher
 *                 block has a toggle to hide it, not one to reveal it); the plan and copy are inside too.
 *   trace         { row, nonce }: a claim chip, [E#] tag or the claim map pointed here. The card opens, shows its Cypher,
 *                 scrolls into view, takes focus and flashes the row that holds the claim (row null: the card itself).
 *   onSay         the feed's single live region: what a card wants announced (a plan loaded). No card has its own.
 *   guest         a pasted repo's run: route_owners has no real team to show, so it says so instead of "Your team"
 *   cypherHints   parameter values a tool derived inside its run (the incident's maintainer), for the runnable prefix
 * The stable DOM id is cardDomId(card) so anything can link to a card.
 * Cypher is runnable: each statement shows the FalkorDB parameter prefix the tool ran it with (`CYPHER incident="qix-2025-09-08"
 * at=1757338200000 MATCH ...`, data/cypherParams.ts) and has its own Copy, which copies that one statement, runnable as pasted
 * in FalkorDB Browser or redis-cli. FalkorDB takes one statement per query, so a call with several offers "Copy all N" as a
 * script that says so (data/cypherParams.ts cypherScript: ";" per statement, a comment naming each). A value the page cannot
 * know ($session, an httpOnly cookie) is a marked placeholder. The code wraps at spaces and at the joints of a pattern (never
 * every ~28 characters mid-word, never a clipped sideways-scrolling box), across the card's full width; so nothing in it needs
 * scrolling, and it is not a tab stop or a landmark (21 to 75 of them flooded the landmark list). Every small control is 24px tall.
 * A traced card, an opened plan and the "Show all rows" toggle are scrolled clear of the pinned Ask bar, and whatever holds the
 * focus stays on screen (components/scrollPane.ts reveal, revealKeepingFocus).
 * A pasted repo's cards show no team column (its "team" is a placeholder), and a tier cell carries its plain meaning as a title.
 * States: pending (radar + 3 skeleton rows; after 3 s "waiting for FalkorDB... 4 s"), done (collapsed line; open:
 * table, Cypher), error (neutral alert block: red means infected on this screen), cancelled. Radar only while pending.
 * Multi-query cards label every statement ("2/5 . Incident . RESOLVES_TO"). GRAPH.EXPLAIN is matched to the statement
 * it describes (data/cypher.ts); asking for another statement says which one the server explained and offers it.
 * Rows are untrusted data: everything renders as text.
 */
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { ApiError, getPlan } from '../data/api.ts';
import { planFor, planLine, statements } from '../data/cypher.ts';
import { cypherScript, paramPrefix, runnable } from '../data/cypherParams.ts';
import { plainError } from '../data/errors.ts';
import { pinTargets } from '../data/export.ts';
import { nextStep, requestIdFor } from '../data/failure.ts';
import { fmtMs, plural, utc, utcSec } from '../data/format.ts';
import type { ExposurePath, ScenarioId } from '../data/types.ts';
import type { ToolCardState } from '../data/useTriage.ts';
import { copyText } from './copy.ts';
import { ChevronDown, CircleAlert, Copy } from './icons/Glyphs.tsx';
import { RadarIcon } from './icons/RadarIcon.tsx';
import { PathChain } from './PathChip.tsx';
import { reveal, revealKeepingFocus } from './scrollPane.ts';
import { cypherPieces } from '../data/cypherWrap.ts';
import { TIER_SUBTITLE } from './TierChip.tsx';
import { realTeam } from '../data/repoLabel.ts';

const MAX_ROWS = 5;
const TIME_KEY = /(At|Time)$|^(at|since|until)$/;
/** The columns that answer "what did this tool find" (the first three scalar ones are a poor guess: `synthetic` beat `tier`). */
const COLS: Record<string, string[]> = {
  incident_exposure: ['repo', 'tier', 'team'],
  suspect_versions: ['version', 'publishedAt'],
  maintainer_blast_radius: ['repo', 'packages', 'shallowest'],
  route_owners: ['team', 'channel', 'repos'],
  concentration_risk: ['maintainer', 'influence', 'reposReached'],
};
const CAPS = /^(?:[A-Z]+_[A-Z_]+|LOCKED|MAINTAINER|CLEAN)$/; // tier constants, not a team called CLI

export interface Trace {
  row: number | null;
  nonce: number;
}

/** Stable id of a card's element: anything (a claim, a skip link) can point at it. */
export const cardDomId = (card: { id: string }) => `tool-${card.id.replace(/[^\w-]/g, '-')}`;

/** What the call was about, for the heading: "explain_path . mochajs/mocha". */
export function subject(params: Record<string, unknown>): string | null {
  if (typeof params.repo === 'string') return params.repo;
  if (typeof params.maintainer === 'string') return params.maintainer;
  if (Array.isArray(params.repos)) return plural(params.repos.length, 'repo');
  return null;
}

function fmtParam(key: string, v: unknown): string {
  if (typeof v === 'number' && TIME_KEY.test(key) && v > 1e11) return `${utc(v)} UTC`;
  if (Array.isArray(v)) return key === 'repos' ? plural(v.length, 'repo') : key === 'versions' ? plural(v.length, 'version') : plural(v.length, 'item');
  if (v && typeof v === 'object') return '{...}';
  return String(v);
}

function fmtCell(key: string, v: unknown): string {
  if (typeof v === 'number' && TIME_KEY.test(key) && v > 1e11) return utcSec(v);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(3)));
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (v === null || v === undefined) return '–';
  if (Array.isArray(v)) return key === 'repos' ? plural(v.length, 'repo') : v.join(', ');
  if (typeof v === 'object') return '{...}';
  return String(v);
}

/** Identifiers keep the mono face; words (a team name, yes/no) do not. Breaks prefer the slash. */
function Cell({ k, v }: { k: string; v: unknown }) {
  const s = fmtCell(k, v);
  const id = typeof v === 'string' && (/[/@^~]|\d\.\d/.test(v) || CAPS.test(v));
  const meaning = k === 'tier' && typeof v === 'string' ? (TIER_SUBTITLE as Record<string, string>)[v] : undefined; // the tier's plain meaning
  return (
    <td data-col={k} title={meaning} className={`py-1 pr-2 align-top ${typeof v === 'string' && CAPS.test(v) ? 'whitespace-nowrap' : 'break-words'} ${typeof v === 'number' ? 'tabular-nums' : id ? 'font-mono' : ''} text-fg-0`}>
      {id
        ? s.split('/').map((part, i) => (
            <Fragment key={i}>
              {i > 0 && <>/<wbr /></>}
              {part}
            </Fragment>
          ))
        : s}
    </td>
  );
}

// The ring sits 1px outside the row (in the card body's 12px padding): drawn inside, it covered the first letter ("E1", "debug").
const rowFlash = 'bg-bg-3 outline-2 outline-offset-1 outline-fg-0';

/** Cypher with a line-break opportunity at each joint of a pattern (`)-[:R]->(`, a list's commas); the text itself is unchanged. */
export function Wrapped({ text }: { text: string }) {
  return (
    <>
      {cypherPieces(text).map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {p}
        </Fragment>
      ))}
    </>
  );
}

function RowsTable({ tool, rows, flash, showAll, onToggleAll, guest }: { tool: string; rows: Record<string, unknown>[]; flash: number | null; showAll: boolean; onToggleAll: () => void; guest: boolean }) {
  const shown = showAll ? rows : rows.slice(0, MAX_ROWS);
  const first = rows[0] ?? {};
  // a pasted repo's "team" is the placeholder "Your team" (#your-team): no team or channel column for it
  const placeholder = guest || (typeof first.team === 'string' && !realTeam(first.team));
  const cols = (COLS[tool] ?? Object.keys(first)).filter((k) => k in first && !(placeholder && (k === 'team' || k === 'channel')) && (first[k] === null || typeof first[k] !== 'object' || Array.isArray(first[k]))).slice(0, 3);
  // The toggle moves (19 rows appear above it, or go away): it keeps the keyboard focus, so it is kept on screen too.
  const toggle = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    const raf = requestAnimationFrame(() => toggle.current && reveal(toggle.current, 'nearest'));
    return () => cancelAnimationFrame(raf);
  }, [showAll]);
  if (!shown.length || !cols.length) return null;
  return (
    <table className="mt-2 w-full table-fixed border-collapse text-left text-xs">
      <thead>
        <tr>
          {cols.map((c, j) => (
            // the tier column fits "WOULD_PULL" in Martian Mono on one line
            <th key={c} scope="col" className={`label-caps text-xs border-b border-line-1 py-1 pr-2 font-medium ${j === 0 ? 'w-[46%]' : c === 'tier' ? 'w-[6.5rem]' : ''}`}>
              {c.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {shown.map((row, i) => (
          <tr key={i} data-row={i} className={`border-b border-line-1 transition-colors duration-(--dur-slow) last:border-0 ${flash === i ? rowFlash : ''}`}>
            {cols.map((c) => (
              <Cell key={c} k={c} v={row[c]} />
            ))}
          </tr>
        ))}
      </tbody>
      {rows.length > MAX_ROWS && (
        <tfoot>
          <tr>
            <td colSpan={cols.length} className="pt-1.5">
              {/* One button that flips its label, so it is never unmounted under the keyboard focus it is holding. */}
              <button
                ref={toggle}
                type="button"
                aria-expanded={showAll}
                className="inline-flex min-h-6 items-center rounded-xs text-xs text-fg-1 underline underline-offset-2 pointer-coarse:min-h-11 hov:text-fg-0"
                onClick={() => {
                  toggled.current = true;
                  onToggleAll();
                }}
              >
                {showAll ? `Show the first ${MAX_ROWS} rows` : `Show all ${rows.length} rows`}
              </button>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** explain_path rows: the range that admits the version, the hop count and the chain, once each (the query returns one row per route). */
function PathRows({ rows, flash }: { rows: Record<string, unknown>[]; flash: number | null }) {
  const seen = new Set<string>();
  const items = rows.flatMap((r, i) => {
    const chain = Array.isArray(r.chain) ? r.chain.map(String) : [];
    const key = `${r.kind}|${r.range}|${chain.join('>')}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ r, i, chain }];
  });
  if (!items.length) return null;
  return (
    <ul className="mt-2 flex flex-col text-xs" aria-label="Paths found">
      {items.map(({ r, i, chain }) => {
        const version = String(r.version ?? '');
        const path: ExposurePath = { id: String(r.id ?? ''), repo: String(r.repo ?? ''), version, kind: r.kind === 'ADMITS' ? 'ADMITS' : 'RESOLVES_TO', range: typeof r.range === 'string' ? r.range : null, hops: Number(r.hops ?? 0), chain, lockPaths: [] };
        return (
          <li key={i} data-row={i} className={`flex flex-col gap-1 border-b border-line-1 py-1.5 transition-colors duration-(--dur-slow) last:border-0 ${flash === i ? rowFlash : ''}`}>
            <span className="flex flex-wrap items-baseline gap-x-2 text-fg-1">
              {path.id && <span className="font-mono text-fg-0">{path.id}</span>}
              <span>{path.kind === 'ADMITS' ? `range ${path.range ?? 'n/a'} admits it` : 'the lockfile resolves to it'}</span>
              <span className="tabular-nums">{path.hops === 0 ? 'declared by the repo' : `${path.hops} ${path.hops === 1 ? 'hop' : 'hops'}`}</span>
            </span>
            <PathChain path={path} badVersions={new Set([version])} />
          </li>
        );
      })}
    </ul>
  );
}

/** draft_remediation rows: what the overrides pin (the object column is not a table cell). */
function PinRows({ rows, flash }: { rows: Record<string, unknown>[]; flash: number | null }) {
  return (
    <ul className="mt-2 flex flex-col text-xs" aria-label="Drafted pins">
      {rows.map((r, i) => (
        <li key={i} data-row={i} className={`flex flex-col gap-0.5 border-b border-line-1 py-1.5 transition-colors duration-(--dur-slow) last:border-0 ${flash === i ? rowFlash : ''}`}>
          <span className="font-mono text-fg-0 break-words">{String(r.repo ?? '')}</span>
          <span className="font-mono text-fg-1 break-words">{r.overrides && typeof r.overrides === 'object' ? pinTargets(r.overrides as Record<string, string>).join(', ') || 'no pins' : ''}</span>
        </li>
      ))}
    </ul>
  );
}

type Plan = { lines: string[]; at: number | null } | { error: string };

function PlanTree({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-xs bg-bg-3 p-2 font-mono text-xs leading-[18px]">
      {lines.map((l, i) => {
        const { depth, op, detail } = planLine(l);
        return (
          <div key={i} style={{ paddingLeft: `calc(${depth} * 1.25ch + 2ch)`, textIndent: '-2ch' }} className="[overflow-wrap:anywhere]">
            <span className="text-fg-0">{op}</span>
            {detail && <span className="text-fg-1"> {detail}</span>}
          </div>
        );
      })}
    </div>
  );
}

export interface ToolCardProps {
  card: ToolCardState;
  scenario: ScenarioId | null;
  index: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trace?: Trace | null;
  onSay?: (message: string) => void;
  guest?: boolean;
  cypherHints?: Record<string, unknown>;
}

export function ToolCard({ card, scenario, index, open: openProp, onOpenChange, trace, onSay, guest = false, cypherHints }: ToolCardProps) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInner(o));
  const [cypherOpen, setCypherOpen] = useState(true); // the proof is the point of opening a card: no second click
  const [plan, setPlan] = useState<Plan | 'loading' | null>(null);
  const [planOpen, setPlanOpen] = useState<ReadonlySet<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [flash, setFlash] = useState<{ row: number | null } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const bodyId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLButtonElement>(null);
  const pending = card.status === 'pending';
  const r = card.result;
  const collapsible = card.status === 'done' && !!r;
  const stmts = statements(r?.cypher ?? []);
  const sub = subject(card.params);
  const named = sub ? `${card.tool} · ${sub}` : card.tool; // distinct names for the query groups of 21 explain_path cards
  const params = r?.params ?? card.params; // the raw values the queries ran with (epoch ms, arrays), not the display strings
  const planWanted = useRef<number | null>(null); // a plan was just asked for: bring it into view once it is there
  // a pasted repo's route_owners can only answer with the placeholder team: say what that means instead of naming "Your team"
  // (whatever this card was told: its own rows show it, data/repoLabel.ts realTeam)
  const noRouting = card.tool === 'route_owners' && (guest || (!!r && r.rows.length > 0 && r.rows.every((x) => !realTeam(typeof x.team === 'string' ? x.team : null))));
  const summary = noRouting ? 'No team to notify: a pasted repo has no owner in the graph' : r?.summary;

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - card.startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [pending, card.startedAt]);

  // A claim pointed here: open Cypher, bring the card into view, take focus, flash the row that holds the claim.
  useEffect(() => {
    if (!trace || !r) return;
    setCypherOpen(true);
    if (trace.row !== null && trace.row >= MAX_ROWS) setShowAll(true);
    setFlash({ row: trace.row });
    const t = setTimeout(() => setFlash(null), 2200);
    // The card's top goes to the top of the visible area (clear of the pinned Ask bar), so its Cypher is below it on screen;
    // again once the body has finished opening (the pane may not have had the room to scroll that far before). The row that
    // holds the claim is then brought into view only if it is further down than that.
    // The header takes the focus first, so the row's scroll can keep it on screen (a short or zoomed window cannot show both).
    const place = () => {
      const el = cardRef.current;
      if (!el) return;
      reveal(el, 'top');
      const row = trace.row !== null ? el.querySelector(`[data-row="${trace.row}"]`) : null;
      if (row) revealKeepingFocus(row, 'nearest');
    };
    const raf = requestAnimationFrame(() => {
      headRef.current?.focus({ preventScroll: true });
      place();
    });
    const settle = setTimeout(place, 260); // the body's grid-rows transition is --dur-base (200 ms)
    return () => {
      clearTimeout(t);
      clearTimeout(settle);
      cancelAnimationFrame(raf);
    };
  }, [trace?.nonce]);
  useEffect(() => {
    const i = planWanted.current;
    if (i === null || plan === 'loading') return;
    planWanted.current = null;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`${bodyId}-s${i}`);
      if (el) revealKeepingFocus(el, 'nearest'); // "Hide plan" keeps the focus above it: it stays on screen
    });
    return () => cancelAnimationFrame(raf);
  }, [plan, planOpen]);

  async function loadPlan(): Promise<Plan | null> {
    if (plan && plan !== 'loading') return plan;
    if (!scenario || plan === 'loading') return null;
    setPlan('loading');
    try {
      const lines = (await getPlan(scenario, card.tool)).plan;
      const p: Plan = { lines, at: planFor(lines, r?.cypher ?? []) };
      setPlan(p);
      onSay?.(`Query plan loaded for ${card.tool}.`);
      return p;
    } catch (err) {
      const p: Plan = { error: err instanceof ApiError ? plainError(err) : 'Could not load the plan.' };
      setPlan(p);
      onSay?.(`${card.tool}: ${p.error}`);
      return p;
    }
  }
  async function togglePlan(i: number) {
    if (planOpen.has(i)) return setPlanOpen(new Set([...planOpen].filter((x) => x !== i)));
    planWanted.current = i;
    setPlanOpen(new Set([...planOpen, i]));
    await loadPlan();
  }
  const showPlan = (i: number) => {
    planWanted.current = i;
    setPlanOpen((s) => new Set([...s, i]));
  };

  // One statement: runnable as pasted. Several ("Copy all N"): a script that says FalkorDB runs them one at a time.
  const copyCypher = async () => {
    if (!r) return;
    const text = r.cypher.length === 1 ? runnable(r.cypher[0]!, params, cypherHints) : cypherScript(r.cypher.map((q, i) => ({ tool: card.tool, q, params, n: i + 1, of: r.cypher.length })), cypherHints);
    if (!(await copyText(text, r.cypher.length === 1 ? 'Cypher' : `All ${r.cypher.length} statements`))) setCypherOpen(true); // show it selectable
  };
  const copyOne = async (i: number) => {
    if (r && !(await copyText(runnable(r.cypher[i]!, params, cypherHints), `Query ${i + 1} of ${r.cypher.length}`))) setCypherOpen(true);
  };

  // One line: the tool name keeps its width, the subject (a repo, a maintainer) truncates and says the rest in its title.
  const title = (
    <span className="flex min-w-0 items-baseline">
      <span className="shrink-0 font-medium text-fg-0">{card.tool}</span>
      {sub && (
        <span className="min-w-0 truncate pl-1 font-mono text-xs text-fg-1" title={sub}>
          · {sub}
        </span>
      )}
    </span>
  );

  return (
    <article
      ref={cardRef}
      id={cardDomId(card)}
      aria-busy={pending}
      aria-label={sub ? `${card.tool} · ${sub}` : card.tool}
      className={`animate-enter scroll-mt-3 rounded-sm border bg-bg-2 transition-colors duration-(--dur-slow) ${flash ? 'border-fg-1' : 'border-line-2'}`}
      style={{ animationDelay: `calc(var(--stagger) * ${Math.min(index, 5)})` }}
    >
      {/* The whole header line toggles; the button inside is the one tab stop and carries the semantics. */}
      <div className={`flex flex-col gap-0.5 p-3 ${collapsible ? 'cursor-pointer' : ''}`} onClick={collapsible ? () => !getSelection()?.toString() && setOpen(!open) : undefined}>
        <h3 className="flex items-start gap-2 text-base">
          {collapsible ? (
            // on touch the button grows into the card's own padding (negative margin) to a 44px target without moving anything
            <button ref={headRef} type="button" aria-expanded={open} aria-controls={bodyId} className="flex min-h-6 min-w-0 flex-1 items-start gap-1.5 rounded-xs text-left break-words [overflow-wrap:anywhere] pointer-coarse:-my-3 pointer-coarse:min-h-11 pointer-coarse:py-3">
              <ChevronDown size={16} className={`mt-0.5 shrink-0 text-fg-1 transition-transform duration-(--dur-base) ease-out ${open ? '' : '-rotate-90'}`} />
              <span className="min-w-0">{title}</span>
            </button>
          ) : (
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{title}</span>
          )}
          {pending && elapsed < 3 && <RadarIcon size={16} title="Query running" />}
          {r && (
            <span className="mt-0.5 shrink-0 font-mono text-xs text-fg-1 tabular-nums">
              <span aria-hidden title={r.cached ? 'Same query, same immutable demo graph: served from this server\'s cache. The time is from when it ran.' : undefined}>
                {fmtMs(r.ms)}
                {r.cached && ' · cached'}
              </span>
              <span className="sr-only">, FalkorDB execution time {r.ms.toFixed(1)} ms{r.cached ? ', cached result of the same query' : ''}</span>
            </span>
          )}
        </h3>
        {r && (
          <p className={`pl-[22px] text-sm text-fg-0 ${open ? '' : 'truncate'}`} title={open ? undefined : summary}>
            {summary}
          </p>
        )}
      </div>

      {pending && (
        <div className="px-3 pb-3">
          <ul className="flex flex-wrap gap-1" aria-label="Arguments">
            {Object.entries(card.params).map(([k, v]) => (
              <li key={k} className="rounded-xs bg-bg-3 px-1.5 font-mono text-xs text-fg-1">
                {k}={fmtParam(k, v)}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            {elapsed < 3 ? (
              <div aria-hidden className="flex flex-col gap-2">
                {['w-5/6', 'w-2/3', 'w-3/4'].map((w) => (
                  <div key={w} className={`skeleton h-4 ${w}`} />
                ))}
              </div>
            ) : (
              <p className="font-mono text-xs text-fg-1">waiting for FalkorDB&hellip; {elapsed} s</p>
            )}
          </div>
        </div>
      )}

      {card.status === 'cancelled' && <p className="px-3 pb-3 text-sm text-fg-2">Cancelled before this query returned.</p>}
      {card.status === 'error' && card.error && (
        <div role="alert" className="px-3 pb-3 text-sm">
          <p className="flex items-start gap-2 text-fg-0">
            <CircleAlert size={16} className="mt-0.5 shrink-0 text-fg-1" />
            {plainError(card.error)}
          </p>
          {nextStep(card.error, card.round ? 'ask' : 'triage') && <p className="text-fg-1">{nextStep(card.error, card.round ? 'ask' : 'triage')}</p>}
          {requestIdFor(card.error) && (
            <p className="mt-1 font-mono text-xs text-fg-2">
              request{' '}
              <button type="button" className="select-all rounded-xs text-fg-1" onClick={() => void copyText(card.error!.requestId!, 'Request id')}>
                {card.error.requestId}
              </button>
            </p>
          )}
        </div>
      )}

      {r && (
        <div id={bodyId} className={`grid transition-[grid-template-rows] duration-(--dur-base) ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="min-h-0 overflow-hidden" inert={!open}>
            <div className="px-3 pb-3">
              <ul className="flex flex-wrap gap-1" aria-label="Arguments">
                {Object.entries(card.params).map(([k, v]) => (
                  <li key={k} className="rounded-xs bg-bg-3 px-1.5 font-mono text-xs text-fg-1">
                    {k}={fmtParam(k, v)}
                  </li>
                ))}
              </ul>

              {card.tool === 'explain_path' ? (
                <PathRows rows={r.rows} flash={flash?.row ?? null} />
              ) : noRouting ? (
                <p className="mt-2 text-xs text-fg-1">Team routing is for the demo org: a pasted repo has no team or channel in the graph, so there is no one to route it to.</p>
              ) : card.tool === 'draft_remediation' ? (
                <PinRows rows={r.rows} flash={flash?.row ?? null} />
              ) : (
                <RowsTable tool={card.tool} rows={r.rows} flash={flash?.row ?? null} showAll={showAll} onToggleAll={() => setShowAll((a) => !a)} guest={guest} />
              )}
              {r.truncated ? <p className="mt-1 text-xs text-fg-2">+{r.truncated} rows withheld from the summary</p> : null}

              <div role="group" aria-label={`Cypher for ${named}`} className="mt-2 -ml-1 flex flex-wrap items-center gap-x-3">
                <button
                  type="button"
                  aria-expanded={cypherOpen}
                  onClick={() => setCypherOpen((o) => !o)}
                  className="inline-flex min-h-6 items-center gap-1 rounded-xs px-1 text-xs text-fg-1 pointer-coarse:min-h-11 hov:text-fg-0"
                >
                  <ChevronDown size={14} className={`transition-transform duration-(--dur-base) ease-out ${cypherOpen ? 'rotate-180' : ''}`} />
                  Cypher{stmts.length > 1 ? ` (${stmts.length} queries)` : ''}
                </button>
                <button
                  type="button"
                  onClick={copyCypher}
                  title={stmts.length > 1 ? 'One text, one statement after another: FalkorDB runs one statement per query, so paste and run each on its own' : undefined}
                  className="inline-flex min-h-6 items-center gap-1 rounded-xs px-1 text-xs text-fg-1 pointer-coarse:min-h-11 hov:text-fg-0"
                >
                  <Copy size={14} />
                  {stmts.length > 1 ? `Copy all ${stmts.length}` : 'Copy Cypher'}
                </button>
              </div>
              <div className={`grid transition-[grid-template-rows] duration-(--dur-base) ease-out ${cypherOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="min-h-0 overflow-hidden" inert={!cypherOpen}>
                  <div className="mt-1 flex flex-col gap-3">
                    {stmts.map((s, i) => {
                      const id = `${bodyId}-s${i}`;
                      const wanted = planOpen.has(i);
                      const prefix = paramPrefix(s.text, params, cypherHints);
                      return (
                        <div key={i} role="group" aria-label={`${named}, query ${s.n} of ${s.of}`}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="label-caps text-xs">{stmts.length > 1 ? `${s.n}/${s.of} · ${s.label}` : s.label}</p>
                            <span className="flex shrink-0 items-center gap-2">
                              {stmts.length > 1 && (
                                // each statement copies on its own: FalkorDB runs one statement per query
                                <button
                                  type="button"
                                  onClick={() => void copyOne(i)}
                                  aria-label={`Copy query ${s.n} of ${s.of}`}
                                  className="inline-flex min-h-6 items-center gap-1 rounded-xs px-1 text-xs text-fg-1 pointer-coarse:min-h-11 hov:text-fg-0"
                                >
                                  <Copy size={14} />
                                  Copy
                                </button>
                              )}
                              {scenario && (
                                <button
                                  type="button"
                                  aria-expanded={wanted}
                                  aria-controls={id}
                                  aria-label={stmts.length > 1 ? `${wanted ? 'Hide' : 'Show'} plan for query ${s.n} of ${s.of}` : undefined}
                                  onClick={() => void togglePlan(i)}
                                  className="inline-flex min-h-6 shrink-0 items-center rounded-xs px-1 text-xs text-fg-1 underline underline-offset-2 pointer-coarse:min-h-11 hov:text-fg-0"
                                >
                                  {wanted ? 'Hide plan' : 'Show plan'}
                                </button>
                              )}
                            </span>
                          </div>
                          {/* Wrapped at spaces, then at the pattern's own joints (data/cypherWrap.ts: <wbr>, so a selection copies the
                              exact text), across the card's full width: nothing is clipped and nothing scrolls sideways, so the block
                              needs no tab stop of its own. The group above names it. */}
                          <pre className="-mx-3 bg-bg-3 px-3 py-2 text-xs leading-[18px] whitespace-pre-wrap text-fg-0 [overflow-wrap:anywhere]">
                            {/* the parameters it ran with, as FalkorDB's CYPHER prefix: the block is runnable as selected */}
                            {prefix && (
                              <code className="text-xs text-fg-1" title="The parameters this query ran with, in FalkorDB's CYPHER prefix form">
                                <Wrapped text={prefix} />
                                {'\n'}
                              </code>
                            )}
                            <code className="text-xs">
                              <Wrapped text={s.text} />
                            </code>
                          </pre>
                          <div id={id}>
                            {wanted && (
                              <div className="mt-2">
                                <p className="label-caps text-xs mb-1">GRAPH.EXPLAIN{stmts.length > 1 ? ` · ${s.n}/${s.of}` : ''}</p>
                                {plan === 'loading' || plan === null ? (
                                  <p className="font-mono text-xs text-fg-1">Loading plan&hellip;</p>
                                ) : 'error' in plan ? (
                                  <p className="text-xs text-fg-0">
                                    {plan.error} {nextStep({ message: plan.error }, 'plan')}
                                  </p>
                                ) : plan.lines.length === 0 ? (
                                  <p className="text-xs text-fg-1">The server returned no plan lines for this tool.</p>
                                ) : plan.at === i ? (
                                  <PlanTree lines={plan.lines} />
                                ) : (
                                  <p className="text-xs text-fg-1">
                                    The server explains this tool&rsquo;s main query only, which is {plan.at === null ? 'not one of these statements' : `query ${plan.at + 1} of ${stmts.length}`}.{' '}
                                    {plan.at !== null && (
                                      <button
                                        type="button"
                                        className="rounded-xs text-fg-0 underline underline-offset-2"
                                        onClick={() => showPlan(plan.at!)}
                                      >
                                        Show that plan
                                      </button>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
