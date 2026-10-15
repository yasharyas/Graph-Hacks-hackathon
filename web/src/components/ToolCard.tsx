/* ToolCard: one tool call in the feed (docs/design.md section 5). A card sits directly on the panel.
 * Props:
 *   card      ToolCardState from useTriage(): tool, params, status (pending | done | error | cancelled), result, error
 *   scenario  ScenarioId for GET /api/plan ("Show plan" = GRAPH.EXPLAIN); null disables the plan button
 *   index     position in the feed, for the enter stagger (first 6 only)
 * States: pending (radar + 3 skeleton rows; after 3 s the radar gives way to "waiting for FalkorDB... 4 s"),
 * done (summary, <= 5 rows + "+N more", "+N rows withheld", Cypher), error (alert icon + red cause, fix, requestId;
 * the spec's 2px left bar is replaced because the impeccable detector flags it as a side-tab),
 * cancelled. The radar sweeps only while this card is pending.
 * Rows are untrusted data: everything renders as text.
 */
import { useEffect, useId, useState } from 'react';
import { ApiError, getPlan } from '../data/api.ts';
import { fixFor } from '../data/errors.ts';
import { fmtMs, utc, utcSec } from '../data/format.ts';
import type { ScenarioId } from '../data/types.ts';
import type { ToolCardState } from '../data/useTriage.ts';
import { IconButton } from './Button.tsx';
import { copyText } from './copy.ts';
import { ChevronDown, CircleAlert, Copy, ListTree } from './icons/Glyphs.tsx';
import { RadarIcon } from './icons/RadarIcon.tsx';

const MAX_ROWS = 5;
const MAX_COLS = 3;
const TIME_KEY = /(At|Time)$|^(at|since|until)$/;

function fmtParam(key: string, v: unknown): string {
  if (typeof v === 'number' && TIME_KEY.test(key) && v > 1e11) return `${utc(v)} UTC`;
  if (Array.isArray(v)) return `${v.length} items`;
  if (v && typeof v === 'object') return '{...}';
  return String(v);
}

function fmtCell(key: string, v: unknown): string {
  if (typeof v === 'number' && TIME_KEY.test(key) && v > 1e11) return utcSec(v);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (v === null || v === undefined) return '–';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return '{...}';
  return String(v);
}

function RowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const shown = rows.slice(0, MAX_ROWS);
  const cols = Object.entries(shown[0] ?? {})
    .filter(([, v]) => v === null || typeof v !== 'object' || Array.isArray(v))
    .map(([k]) => k)
    .slice(0, MAX_COLS);
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
          <tr key={i} className="border-b border-line-1 last:border-0">
            {cols.map((c) => (
              <td
                key={c}
                data-num={typeof row[c] === 'number' ? '' : undefined}
                className={`py-1 pr-2 align-top [overflow-wrap:anywhere] ${typeof row[c] === 'number' ? 'tabular-nums' : 'font-mono'} text-fg-0`}
              >
                {fmtCell(c, row[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface ToolCardProps {
  card: ToolCardState;
  scenario: ScenarioId | null;
  index: number;
}

export function ToolCard({ card, scenario, index }: ToolCardProps) {
  const [cypherOpen, setCypherOpen] = useState(false);
  const [plan, setPlan] = useState<{ lines: string[] } | { error: string } | 'loading' | null>(null);
  const planId = useId();
  const [elapsed, setElapsed] = useState(0);
  const pending = card.status === 'pending';
  const r = card.result;

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - card.startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [pending, card.startedAt]);

  async function togglePlan() {
    if (plan) return setPlan(null);
    if (!scenario) return;
    setPlan('loading');
    try {
      setPlan({ lines: (await getPlan(scenario, card.tool)).plan });
    } catch (err) {
      setPlan({ error: err instanceof ApiError ? err.message : 'Could not load the plan.' });
    }
  }

  const copyCypher = async () => {
    if (r && !(await copyText(r.cypher.join('\n\n'), 'Cypher'))) setCypherOpen(true); // show it selectable
  };

  return (
    <article
      aria-busy={pending}
      aria-label={card.tool}
      className="animate-enter rounded-sm border border-line-2 bg-bg-2 p-3"
      style={{ animationDelay: `calc(var(--stagger) * ${Math.min(index, 5)})` }}
    >
      <header className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-base font-medium break-words text-fg-0">{card.tool}</h3>
        {pending && elapsed < 3 && <RadarIcon size={16} title="Query running" />}
        {r && (
          <span className="mt-0.5 font-mono text-xs text-fg-1 tabular-nums" aria-label={`FalkorDB execution time ${r.ms.toFixed(1)} ms`}>
            {fmtMs(r.ms)}
          </span>
        )}
        {r && (
          <span className="-my-1.5 -mr-2 flex">
            <IconButton label="Copy Cypher" icon={<Copy size={16} />} onClick={copyCypher} />
            <IconButton
              label={plan ? 'Hide plan' : 'Show plan'}
              icon={<ListTree size={16} />}
              aria-pressed={plan !== null}
              aria-controls={planId}
              disabled={!scenario}
              onClick={togglePlan}
            />
          </span>
        )}
      </header>

      <ul className="mt-1 flex flex-wrap gap-1" aria-label="Arguments">
        {Object.entries(card.params).map(([k, v]) => (
          <li key={k} className="rounded-xs bg-bg-3 px-1.5 font-mono text-2xs text-fg-1">
            {k}={fmtParam(k, v)}
          </li>
        ))}
      </ul>

      {pending && (
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
      )}

      {card.status === 'cancelled' && <p className="mt-2 text-sm text-fg-2">Cancelled before this query returned.</p>}
      {card.status === 'error' && card.error && (
        <div role="alert" className="mt-2 text-sm">
          <p className="flex items-start gap-2 text-infect-400">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            {card.error.message}
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
        <>
          <p className="mt-2 text-sm text-fg-0">{r.summary}</p>
          <RowsTable rows={r.rows} />
          {(r.rows.length > MAX_ROWS || r.truncated) && (
            <p className="mt-1 text-xs text-fg-2">
              {r.rows.length > MAX_ROWS && `+${r.rows.length - MAX_ROWS} more`}
              {r.rows.length > MAX_ROWS && r.truncated ? ' · ' : ''}
              {r.truncated ? `+${r.truncated} rows withheld` : ''}
            </p>
          )}

          <div id={planId} aria-live="polite">
            {plan && (
              <>
                <p className="label-caps mt-2">GRAPH.EXPLAIN</p>
                <pre tabIndex={0} aria-label="Query plan" className="mt-1 max-h-48 overflow-auto rounded-xs bg-bg-3 p-2 font-mono text-xs leading-[18px] whitespace-pre text-fg-1">
                  {plan === 'loading'
                    ? 'Loading plan…'
                    : 'error' in plan
                      ? `${plan.error} ${fixFor({ message: plan.error }, 'plan')}`
                      : plan.lines.length
                        ? plan.lines.join('\n')
                        : 'The server returned no plan lines for this tool.'}
                </pre>
              </>
            )}
          </div>

          <button
            type="button"
            aria-expanded={cypherOpen}
            onClick={() => setCypherOpen((o) => !o)}
            className="mt-2 -ml-1 inline-flex items-center gap-1 rounded-xs px-1 text-xs text-fg-1 pointer-coarse:min-h-11 hov:text-fg-0"
          >
            <ChevronDown size={14} className={`transition-transform duration-(--dur-base) ease-out ${cypherOpen ? 'rotate-180' : ''}`} />
            Cypher
          </button>
          <div className={`grid transition-[grid-template-rows] duration-(--dur-base) ease-out ${cypherOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="min-h-0 overflow-hidden" inert={!cypherOpen}>
              <pre className="mt-1 overflow-x-auto rounded-xs bg-bg-3 p-2 text-xs leading-[18px] text-fg-0">
                <code>{r.cypher.join('\n\n')}</code>
              </pre>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
