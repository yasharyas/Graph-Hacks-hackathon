/* InsightTabs: the tabs under the exposure table (docs/design.md section 5).
 * Props: report (Report), cards (all ToolCardState of the run), graph (graph name from the start event or null),
 *        totalMs (server-reported run time or null), remediated (repo -> epoch ms of every mark, the server's and this
 *        screen's, so a mark made a second ago is listed).
 * Tabs: Concentration (bars), All Cypher used (one <pre>, Copy all), Triage history (two lists: "Marked remediated",
 * each repo with the time in the person's own zone, first; and "Assessed in earlier runs": how many repos, the latest time
 * and their tiers, both from recall_triage rows {repo, tier, action, at}, one row per repo), Graph stats (graph name and
 * the graph's node / edge counts from /api/stats, per-tool queries / rows / FalkorDB ms, and the schema this run's Cypher
 * touched; the per-run figures are read from this run's real tool results). The Concentration tab says where its scores
 * come from (algo.pageRank at ingest). role=tablist, arrow keys.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { localStamp } from '../data/clock.ts';
import { schemaOf } from '../data/cypher.ts';
import { fmtMs, plural } from '../data/format.ts';
import type { Report } from '../data/types.ts';
import { useStats } from '../data/useStats.ts';
import type { ToolCardState } from '../data/useTriage.ts';
import { Button } from './Button.tsx';
import { copyText } from './copy.ts';
import { EmptyState } from './EmptyState.tsx';
import { influenceShares } from './ExecSummary.tsx';
import { Copy } from './icons/Glyphs.tsx';

const TABS = ['Concentration', 'All Cypher used', 'Triage history', 'Graph stats'] as const;

export interface InsightTabsProps {
  report: Report;
  cards: ToolCardState[];
  graph: string | null;
  totalMs: number | null;
  remediated: Record<string, number>;
}

const count = (n: number) => n.toLocaleString('en-US');

export function InsightTabs({ report, cards, graph, totalMs, remediated }: InsightTabsProps) {
  const [tab, setTab] = useState(0);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const results = cards.flatMap((c) => (c.result ? [{ card: c, r: c.result }] : []));
  const cypher = results.flatMap(({ r }) => r.cypher.map((q) => `// ${r.tool}\n${q}`)).join('\n\n');
  const schema = schemaOf(results.flatMap(({ r }) => r.cypher));
  const earlier = (results.find(({ r }) => r.tool === 'recall_triage')?.r.rows ?? []).flatMap((row) =>
    typeof row.repo === 'string' ? [{ repo: row.repo, tier: String(row.tier ?? ''), action: typeof row.action === 'string' ? row.action : null, at: typeof row.at === 'number' ? row.at : 0 }] : [],
  );
  // marks: the earlier runs' (the server remembers them per session), overridden by this screen's, newest first
  const marks = Object.entries({ ...Object.fromEntries(earlier.filter((r) => r.action === 'remediated').map((r) => [r.repo, r.at])), ...remediated }).sort((a, b) => b[1] - a[1]);
  const tiers = ['LOCKED', 'WOULD_PULL', 'MAINTAINER', 'CLEAN'].map((t) => [t, earlier.filter((r) => r.tier === t).length] as const).filter(([, n]) => n > 0);
  const latest = Math.max(0, ...earlier.map((r) => r.at));
  const guest = report.scope?.kind === 'guest';
  const [retry, setRetry] = useState(0);
  const stats = useStats(report.incident.id, tab === 3 && !guest, retry);
  const shares = influenceShares(report.concentration);
  const repos = Object.values(report.counts).reduce((a, b) => a + b, 0);

  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
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
            aria-controls={tab === i ? `${base}-panel` : undefined} // only the selected tab has a panel in the DOM
            tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            onKeyDown={(e) => onKey(e, i)}
            // The ring sits inside the button: the tablist scrolls horizontally and would clip an outer ring.
            className={`-mb-px min-h-(--control-h) shrink-0 border-b-2 px-2 text-sm whitespace-nowrap focus-visible:-outline-offset-2 ${tab === i ? 'border-fg-0 text-fg-0' : 'border-transparent text-fg-1 hov:text-fg-0'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-t${tab}`}
        tabIndex={tab === 1 ? undefined : 0} // panels without a focusable child are reachable by keyboard themselves
        className="p-3 text-sm"
      >
        {tab === 0 &&
          (shares.length ? (
            <>
              <p className="mb-3 max-w-(--measure) text-fg-1">
                Who could be the next compromised account: each share is that maintainer&rsquo;s part of the top {shares.length}&rsquo;s combined PageRank
                across the org&rsquo;s dependency graph.
              </p>
              <ul className="flex flex-col gap-3">
                {shares.map((c) => (
                  <li key={c.maintainer} className="grid grid-cols-[minmax(0,8rem)_1fr_2.75rem] items-center gap-x-2 gap-y-1">
                    <span className="truncate text-fg-0">{c.maintainer}</span>
                    <span className="h-1.5 rounded-xs bg-bg-3" aria-hidden>
                      <span className="block h-full rounded-xs bg-fg-1" style={{ width: `${c.bar}%` }} />
                    </span>
                    <span className="text-right font-sans font-bold text-fg-0 tabular-nums">{c.share}</span>
                    <span className="col-span-3 text-xs text-fg-1 tabular-nums">
                      {c.packages} packages · reaches {c.reposReached} of {repos} repos
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 max-w-(--measure) text-xs text-fg-2">
                The scores come from <code className="font-mono text-fg-1">algo.pageRank(&apos;Package&apos;, &apos;PKG_DEPENDS&apos;)</code>, run once when the graph was ingested and stored on each package. The
                concentration_risk query sums them per maintainer.
              </p>
            </>
          ) : (
            <EmptyState className="p-0" title="No concentration data" cause="The concentration_risk tool returned no maintainers for this run." />
          ))}
        {tab === 1 && (
          <div className="flex flex-col items-start gap-2">
            <Button icon={<Copy size={16} />} onClick={() => void copyText(cypher, 'Cypher')} disabled={!cypher}>
              Copy all
            </Button>
            {cypher ? (
              <pre tabIndex={0} role="region" aria-label="Cypher queries" className="max-h-72 w-full overflow-auto rounded-xs bg-bg-3 p-2 text-xs leading-[18px] whitespace-pre-wrap text-fg-0 [overflow-wrap:anywhere]">
                <code>{cypher}</code>
              </pre>
            ) : (
              <p className="text-fg-1">No queries have run yet.</p>
            )}
          </div>
        )}
        {tab === 2 &&
          (marks.length || earlier.length ? (
            <div className="flex flex-col gap-4">
              <section aria-labelledby={`${base}-marked`}>
                <h4 id={`${base}-marked`} className="label-caps mb-1.5">
                  Marked remediated
                </h4>
                {marks.length ? (
                  <ul className="flex flex-col gap-1">
                    {marks.map(([repo, at]) => (
                      <li key={repo} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="font-mono text-fg-0 [overflow-wrap:anywhere]">{repo}</span>
                        <time dateTime={new Date(at).toISOString()} className="text-fg-1">
                          {localStamp(at)}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-fg-1">No repo marked remediated yet.</p>
                )}
                <p className="mt-1.5 text-xs text-fg-2">Marks are saved for this browser session only.</p>
              </section>
              <section aria-labelledby={`${base}-earlier`}>
                <h4 id={`${base}-earlier`} className="label-caps mb-1.5">
                  Assessed in earlier runs
                </h4>
                {earlier.length ? (
                  <p className="text-fg-0">
                    {plural(earlier.length, 'repo')} <span className="text-fg-1">· latest </span>
                    <time dateTime={new Date(latest).toISOString()}>{localStamp(latest)}</time>
                    <span className="mt-1 block font-mono text-xs text-fg-1">{tiers.map(([t, n]) => `${t} ${n}`).join(' · ')}</span>
                  </p>
                ) : (
                  <p className="text-fg-1">No earlier run in this session.</p>
                )}
              </section>
            </div>
          ) : (
            <EmptyState className="p-0" title="No saved triages yet" cause="The recall_triage tool has not returned any earlier runs in this session." />
          ))}
        {tab === 3 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-fg-1">FalkorDB graph</dt>
            <dd className="font-mono text-xs text-fg-0">{graph ?? '–'}</dd>
            {stats.data && (
              <>
                <dt className="text-fg-1">Graph size</dt>
                <dd className="font-mono text-xs text-fg-0 tabular-nums">
                  {count(stats.data.nodes.reduce((n, x) => n + x.count, 0))} nodes · {count(stats.data.edges.reduce((n, x) => n + x.count, 0))} edges
                  <span className="block text-fg-1">{stats.data.nodes.slice(0, 5).map((x) => `${x.label} ${count(x.count)}`).join(' · ')}</span>
                </dd>
              </>
            )}
            {stats.error && (
              <>
                <dt className="text-fg-1">Graph size</dt>
                <dd className="text-xs text-fg-1">
                  {stats.error}{' '}
                  <button type="button" className="text-link underline underline-offset-2 pointer-coarse:min-h-11" onClick={() => setRetry((n) => n + 1)}>
                    Retry
                  </button>
                </dd>
              </>
            )}
            <dt className="text-fg-1">Queries run</dt>
            <dd className="font-mono text-xs text-fg-0 tabular-nums">{results.reduce((n, { r }) => n + r.cypher.length, 0)}</dd>
            <dt className="text-fg-1">Time in FalkorDB</dt>
            <dd className="font-mono text-xs text-fg-0 tabular-nums">{fmtMs(results.reduce((n, { r }) => n + r.ms, 0))}</dd>
            {totalMs !== null && (
              <>
                <dt className="text-fg-1">Run total</dt>
                <dd className="font-mono text-xs text-fg-0 tabular-nums">{totalMs} ms</dd>
              </>
            )}
            <dt className="text-fg-1">Repos analysed</dt>
            <dd className="font-mono text-xs text-fg-0 tabular-nums">{repos}</dd>
            {schema.labels.length > 0 && (
              <>
                <dt className="text-fg-1">Schema these queries touch</dt>
                <dd className="font-mono text-xs break-words text-fg-0">
                  {schema.labels.join(', ')}
                  <span className="text-fg-1"> · </span>
                  {schema.rels.join(', ')}
                </dd>
              </>
            )}
            {results.map(({ card, r }) => (
              <div key={card.id} className="contents">
                <dt className="font-mono text-xs break-words text-fg-2">{r.tool}</dt>
                <dd className="font-mono text-xs text-fg-1 tabular-nums">
                  {r.cypher.length} {r.cypher.length === 1 ? 'query' : 'queries'} · {r.rows.length} rows · {fmtMs(r.ms)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
