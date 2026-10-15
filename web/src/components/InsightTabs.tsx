/* InsightTabs: the tabs under the exposure table (docs/design.md section 5).
 * Props: report (Report), cards (all ToolCardState of the run), graph (graph name from the start event or null),
 *        totalMs (server-reported run time or null).
 * Tabs: Concentration (bars), All Cypher used (one <pre>, Copy all), Triage history (recall_triage rows; empty
 * until that tool has run), Graph stats (counts from this run's real tool results). role=tablist, arrow keys.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { fmtMs, utc } from '../data/format.ts';
import type { Report } from '../data/types.ts';
import type { ToolCardState } from '../data/useTriage.ts';
import { Button } from './Button.tsx';
import { copyText } from './copy.ts';
import { EmptyState } from './EmptyState.tsx';
import { Copy } from './icons/Glyphs.tsx';

const TABS = ['Concentration', 'All Cypher used', 'Triage history', 'Graph stats'] as const;

export interface InsightTabsProps {
  report: Report;
  cards: ToolCardState[];
  graph: string | null;
  totalMs: number | null;
}

export function InsightTabs({ report, cards, graph, totalMs }: InsightTabsProps) {
  const [tab, setTab] = useState(0);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const results = cards.flatMap((c) => (c.result ? [{ card: c, r: c.result }] : []));
  const cypher = results.flatMap(({ r }) => r.cypher.map((q) => `// ${r.tool}\n${q}`)).join('\n\n');
  const history = results.find(({ r }) => r.tool === 'recall_triage')?.r.rows ?? [];
  const max = Math.max(...report.concentration.map((c) => c.influence), 0.01);

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + TABS.length) % TABS.length;
    setTab(next);
    refs.current[next]?.focus();
  };

  return (
    <section aria-label="Details" className="border-t border-line-1">
      <div role="tablist" aria-label="Details" className="flex gap-1 overflow-x-auto border-b border-line-1 px-3">
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => void (refs.current[i] = el)}
            id={`${base}-t${i}`}
            role="tab"
            type="button"
            aria-selected={tab === i}
            aria-controls={`${base}-p${i}`}
            tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            onKeyDown={(e) => onKey(e, i)}
            className={`-mb-px shrink-0 border-b-2 px-2 py-2.5 text-sm whitespace-nowrap ${tab === i ? 'border-fg-0 text-fg-0' : 'border-transparent text-fg-1 hov:text-fg-0'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${base}-p${tab}`} aria-labelledby={`${base}-t${tab}`} className="p-3 text-sm">
        {tab === 0 && (
          <ul className="flex flex-col gap-2">
            {report.concentration.map((c) => (
              <li key={c.maintainer} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2">
                <span className="truncate text-fg-0">{c.maintainer}</span>
                <span className="h-1.5 rounded-xs bg-bg-3" aria-hidden>
                  <span className="block h-full rounded-xs bg-fg-1" style={{ width: `${(c.influence / max) * 100}%` }} />
                </span>
                <span className="font-mono text-xs text-fg-1 tabular-nums">
                  {c.influence.toFixed(2)} · {c.packages} pkgs · {c.reposReached} repos
                </span>
              </li>
            ))}
          </ul>
        )}
        {tab === 1 && (
          <div className="flex flex-col items-start gap-2">
            <Button icon={<Copy size={16} />} onClick={() => void copyText(cypher, 'Cypher')} disabled={!cypher}>
              Copy all
            </Button>
            {cypher ? (
              <pre className="max-h-72 w-full overflow-auto rounded-xs bg-bg-3 p-2 text-xs leading-[18px] text-fg-0">
                <code>{cypher}</code>
              </pre>
            ) : (
              <p className="text-fg-1">No queries have run yet.</p>
            )}
          </div>
        )}
        {tab === 2 &&
          (history.length ? (
            <ul className="flex flex-col gap-1.5">
              {history.map((row, i) => (
                <li key={i} className="font-mono text-xs text-fg-0">
                  {typeof row.at === 'number' ? `${utc(row.at)} UTC` : '–'} · {String(row.session ?? 'session')} ·{' '}
                  {row.remediated ? 'remediated' : 'open'}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState className="p-0" title="No saved triages yet" cause="The recall_triage tool has not returned any earlier runs in this session." />
          ))}
        {tab === 3 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-fg-1">Graph</dt>
            <dd className="font-mono text-xs text-fg-0">{graph ?? '–'}</dd>
            <dt className="text-fg-1">Queries run</dt>
            <dd className="font-mono text-xs text-fg-0 tabular-nums">{results.reduce((n, { r }) => n + r.cypher.length, 0)}</dd>
            <dt className="text-fg-1">FalkorDB time</dt>
            <dd className="font-mono text-xs text-fg-0 tabular-nums">{fmtMs(results.reduce((n, { r }) => n + r.ms, 0))}</dd>
            {totalMs !== null && (
              <>
                <dt className="text-fg-1">Run total</dt>
                <dd className="font-mono text-xs text-fg-0 tabular-nums">{totalMs} ms</dd>
              </>
            )}
            <dt className="text-fg-1">Repos analysed</dt>
            <dd className="font-mono text-xs text-fg-0 tabular-nums">{Object.values(report.counts).reduce((a, b) => a + b, 0)}</dd>
            {results.map(({ card, r }) => (
              <div key={card.id} className="contents">
                <dt className="font-mono text-xs text-fg-2">{r.tool}</dt>
                <dd className="font-mono text-xs text-fg-1 tabular-nums">
                  {r.rows.length} rows · {fmtMs(r.ms)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
