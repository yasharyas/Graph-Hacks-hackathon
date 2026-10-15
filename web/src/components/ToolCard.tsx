/* ToolCard: one tool call in the feed (docs/design.md section 5). A card sits directly on the panel.
 * Props:
 *   card          ToolCardState from useTriage(): tool, params, status (pending | done | error | cancelled), result, error
 *   scenario      ScenarioId for GET /api/plan ("Show plan" = GRAPH.EXPLAIN); null disables the plan button
 *   index         position in the feed, for the enter stagger (first 6 only)
 *   open, onOpenChange   the card body is open (controlled by ToolFeed so "expand all" and a clicked claim can open it);
 *                 uncontrolled when omitted. A finished card is collapsed by default: one line (name, subject, the
 *                 server's summary, ms) and ONE tab stop. Everything else (table, Cypher, plan, copy) is inside.
 *   trace         { row, nonce }: a claim chip, [E#] tag or the claim map pointed here. The card opens, opens its Cypher,
 *                 scrolls into view, takes focus and flashes the row that holds the claim (row null: the card itself).
 * The stable DOM id is cardDomId(card) so anything can link to a card.
 * States: pending (radar + 3 skeleton rows; after 3 s "waiting for FalkorDB... 4 s"), done (collapsed line; open:
 * table, Cypher), error (neutral alert block: red means infected on this screen), cancelled. Radar only while pending.
 * Multi-query cards label every statement ("2/5 . Incident . RESOLVES_TO"). GRAPH.EXPLAIN is matched to the statement
 * it describes (data/cypher.ts); asking for another statement says which one the server explained and offers it.
 * Rows are untrusted data: everything renders as text.
 */
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { ApiError, getPlan } from '../data/api.ts';
import { planFor, planLine, statements } from '../data/cypher.ts';
import { fixFor, plainError } from '../data/errors.ts';
import { pinTargets } from '../data/export.ts';
import { fmtMs, utc, utcSec } from '../data/format.ts';
import type { ExposurePath, ScenarioId } from '../data/types.ts';
import type { ToolCardState } from '../data/useTriage.ts';
import { copyText } from './copy.ts';
import { ChevronDown, CircleAlert, Copy } from './icons/Glyphs.tsx';
import { RadarIcon } from './icons/RadarIcon.tsx';
import { PathChain } from './PathChip.tsx';
import { scrollPaneTo } from './scrollPane.ts';

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
  if (Array.isArray(params.repos)) return `${params.repos.length} repos`;
  return null;
}

function fmtParam(key: string, v: unknown): string {
  if (typeof v === 'number' && TIME_KEY.test(key) && v > 1e11) return `${utc(v)} UTC`;
  if (Array.isArray(v)) return `${v.length} items`;
  if (v && typeof v === 'object') return '{...}';
  return String(v);
}

function fmtCell(key: string, v: unknown): string {
  if (typeof v === 'number' && TIME_KEY.test(key) && v > 1e11) return utcSec(v);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(3)));
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (v === null || v === undefined) return '–';
  if (Array.isArray(v)) return key === 'repos' ? `${v.length} repos` : v.join(', ');
  if (typeof v === 'object') return '{...}';
  return String(v);
}

/** Identifiers keep the mono face; words (a team name, yes/no) do not. Breaks prefer the slash. */
function Cell({ k, v }: { k: string; v: unknown }) {
  const s = fmtCell(k, v);
  const id = typeof v === 'string' && (/[/@^~]|\d\.\d/.test(v) || CAPS.test(v));
  return (
    <td data-col={k} className={`py-1 pr-2 align-top break-words ${typeof v === 'number' ? 'tabular-nums' : id ? 'font-mono' : ''} text-fg-0`}>
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

const rowFlash = 'bg-bg-3 outline-2 -outline-offset-2 outline-fg-0';

function RowsTable({ tool, rows, flash, showAll, onShowAll }: { tool: string; rows: Record<string, unknown>[]; flash: number | null; showAll: boolean; onShowAll: () => void }) {
  const shown = showAll ? rows : rows.slice(0, MAX_ROWS);
  const first = rows[0] ?? {};
  const cols = (COLS[tool] ?? Object.keys(first)).filter((k) => k in first && (first[k] === null || typeof first[k] !== 'object' || Array.isArray(first[k]))).slice(0, 3);
  if (!shown.length || !cols.length) return null;
  return (
    <table className="mt-2 w-full table-fixed border-collapse text-left text-xs">
      <thead>
        <tr>
          {cols.map((c, j) => (
            <th key={c} scope="col" className={`label-caps border-b border-line-1 py-1 pr-2 font-medium ${j === 0 ? 'w-[46%]' : ''}`}>
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
      {rows.length > shown.length && (
        <tfoot>
          <tr>
            <td colSpan={cols.length} className="pt-1.5">
              <button type="button" className="inline-flex min-h-6 items-center rounded-xs text-xs text-fg-1 underline underline-offset-2 pointer-coarse:min-h-11 hov:text-fg-0" onClick={onShowAll}>
                Show all {rows.length} rows
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
}

export function ToolCard({ card, scenario, index, open: openProp, onOpenChange, trace }: ToolCardProps) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInner(o));
  const [cypherOpen, setCypherOpen] = useState(false);
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
    const raf = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      scrollPaneTo(cardRef.current);
      if (trace.row !== null) cardRef.current.querySelector(`[data-row="${trace.row}"]`)?.scrollIntoView({ block: 'nearest' });
      headRef.current?.focus({ preventScroll: true });
    });
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [trace?.nonce]);

  async function loadPlan(): Promise<Plan | null> {
    if (plan && plan !== 'loading') return plan;
    if (!scenario || plan === 'loading') return null;
    setPlan('loading');
    try {
      const lines = (await getPlan(scenario, card.tool)).plan;
      const p: Plan = { lines, at: planFor(lines, r?.cypher ?? []) };
      setPlan(p);
      return p;
    } catch (err) {
      const p: Plan = { error: err instanceof ApiError ? plainError(err) : 'Could not load the plan.' };
      setPlan(p);
      return p;
    }
  }
  async function togglePlan(i: number) {
    if (planOpen.has(i)) return setPlanOpen(new Set([...planOpen].filter((x) => x !== i)));
    setPlanOpen(new Set([...planOpen, i]));
    await loadPlan();
  }
  const showPlan = (i: number) => setPlanOpen((s) => new Set([...s, i]));

  const copyCypher = async () => {
    if (r && !(await copyText(r.cypher.join('\n\n'), 'Cypher'))) setCypherOpen(true); // show it selectable
  };

  const title = (
    <>
      <span className="font-medium text-fg-0">{card.tool}</span>
      {sub && <span className="font-mono text-xs text-fg-1"> · {sub}</span>}
    </>
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
            <button ref={headRef} type="button" aria-expanded={open} aria-controls={bodyId} className="flex min-w-0 flex-1 items-start gap-1.5 rounded-xs text-left break-words [overflow-wrap:anywhere]">
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
          <p className={`pl-[22px] text-sm text-fg-0 ${open ? '' : 'truncate'}`} title={open ? undefined : r.summary}>
            {r.summary}
          </p>
        )}
      </div>

      {pending && (
        <div className="px-3 pb-3">
          <ul className="flex flex-wrap gap-1" aria-label="Arguments">
            {Object.entries(card.params).map(([k, v]) => (
              <li key={k} className="rounded-xs bg-bg-3 px-1.5 font-mono text-2xs text-fg-1">
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
          <p className="text-fg-1">{fixFor(card.error, card.round ? 'ask' : 'triage')}</p>
          {card.error.requestId && (
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
                  <li key={k} className="rounded-xs bg-bg-3 px-1.5 font-mono text-2xs text-fg-1">
                    {k}={fmtParam(k, v)}
                  </li>
                ))}
              </ul>

              {card.tool === 'explain_path' ? (
                <PathRows rows={r.rows} flash={flash?.row ?? null} />
              ) : card.tool === 'draft_remediation' ? (
                <PinRows rows={r.rows} flash={flash?.row ?? null} />
              ) : (
                <RowsTable tool={card.tool} rows={r.rows} flash={flash?.row ?? null} showAll={showAll} onShowAll={() => setShowAll(true)} />
              )}
              {r.truncated ? <p className="mt-1 text-xs text-fg-2">+{r.truncated} rows withheld from the summary</p> : null}

              <div role="group" aria-label="Query" className="mt-2 -ml-1 flex flex-wrap items-center gap-x-3">
                <button
                  type="button"
                  aria-expanded={cypherOpen}
                  onClick={() => setCypherOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded-xs px-1 text-xs text-fg-1 pointer-coarse:min-h-11 hov:text-fg-0"
                >
                  <ChevronDown size={14} className={`transition-transform duration-(--dur-base) ease-out ${cypherOpen ? 'rotate-180' : ''}`} />
                  Cypher{stmts.length > 1 ? ` (${stmts.length} queries)` : ''}
                </button>
                <button type="button" onClick={copyCypher} className="inline-flex items-center gap-1 rounded-xs px-1 text-xs text-fg-1 pointer-coarse:min-h-11 hov:text-fg-0">
                  <Copy size={14} />
                  Copy Cypher
                </button>
              </div>
              <div className={`grid transition-[grid-template-rows] duration-(--dur-base) ease-out ${cypherOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="min-h-0 overflow-hidden" inert={!cypherOpen}>
                  <div className="mt-1 flex flex-col gap-3">
                    {stmts.map((s, i) => {
                      const id = `${bodyId}-s${i}`;
                      const wanted = planOpen.has(i);
                      return (
                        <section key={i} aria-label={stmts.length > 1 ? `Query ${s.n} of ${s.of}` : 'Query'}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="label-caps">{stmts.length > 1 ? `${s.n}/${s.of} · ${s.label}` : s.label}</p>
                            {scenario && (
                              <button
                                type="button"
                                aria-expanded={wanted}
                                aria-controls={id}
                                aria-label={stmts.length > 1 ? `Show plan for query ${s.n} of ${s.of}` : 'Show plan'}
                                onClick={() => void togglePlan(i)}
                                className="shrink-0 rounded-xs px-1 text-xs text-fg-1 underline underline-offset-2 pointer-coarse:min-h-11 hov:text-fg-0"
                              >
                                Show plan
                              </button>
                            )}
                          </div>
                          <pre className="rounded-xs bg-bg-3 p-2 text-xs leading-[18px] whitespace-pre-wrap text-fg-0 [overflow-wrap:anywhere]">
                            <code>{s.text}</code>
                          </pre>
                          <div id={id} aria-live="polite">
                            {wanted && (
                              <div className="mt-2">
                                <p className="label-caps mb-1">GRAPH.EXPLAIN{stmts.length > 1 ? ` · ${s.n}/${s.of}` : ''}</p>
                                {plan === 'loading' || plan === null ? (
                                  <p className="font-mono text-xs text-fg-1">Loading plan&hellip;</p>
                                ) : 'error' in plan ? (
                                  <p className="text-xs text-fg-0">
                                    {plan.error} {fixFor({ message: plan.error }, 'plan')}
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
                                        onClick={() => {
                                          showPlan(plan.at!);
                                          document.getElementById(`${bodyId}-s${plan.at}`)?.scrollIntoView({ block: 'nearest' });
                                        }}
                                      >
                                        Show that plan
                                      </button>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </section>
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
