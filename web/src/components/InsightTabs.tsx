/* InsightTabs: the tabs under the exposure table (docs/design.md section 5).
 * Props: report (Report), cards (all ToolCardState of the run), graph (graph name from the start event or null),
 *        totalMs (server-reported run time or null), remediated (repo -> epoch ms of every mark, the server's and this
 *        screen's, so a mark made a second ago is listed).
 * Tabs: Concentration (bars, an account that is not a person glossed: "types"; for one pasted repo it is collapsed behind a button: "the next compromised account" is an org
 * question), All Cypher used (one <pre>, wrapped, scrolling down only, Copy all: one example per distinct statement with the FalkorDB parameter
 * prefix it ran with, each ";"-terminated and labelled, since FalkorDB runs one statement per query; data/cypherParams.ts
 * cypherScript), Triage history (two lists: "Marked remediated",
 * each repo with its UTC time (the app's one zone), first; and "Assessed in earlier runs": how many repos, the latest time
 * and their tiers, both from recall_triage rows {repo, tier, action, at}, one row per repo), Graph stats (graph name and
 * the graph's node / edge counts from /api/stats, per-tool queries / rows / FalkorDB ms, and the schema this run's Cypher
 * touched; the per-run figures are read from this run's real tool results). "FalkorDB time" is each query's own time added up,
 * and a cached call counts the time it first took, so it can exceed "Run total" (the run's wall clock) beside it; the tab says so.
 * The Concentration tab says where its scores come from (algo.pageRank at ingest). role=tablist, arrow keys.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { schemaOf } from '../data/cypher.ts';
import { cypherScript } from '../data/cypherParams.ts';
import { fmtMs, plural, utcStamp } from '../data/format.ts';
import { repoLabel } from '../data/repoLabel.ts';
import type { Report } from '../data/types.ts';
import { useStats } from '../data/useStats.ts';
import type { ToolCardState } from '../data/useTriage.ts';
import { ACCOUNT_NOTE, influenceShares } from './agent.ts';
import { Button } from './Button.tsx';
import { copyText } from './copy.ts';
import { EmptyState } from './EmptyState.tsx';
import { Copy } from './icons/Glyphs.tsx';
import { Wrapped } from './ToolCard.tsx';

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
  const hints = report.incident.maintainer ? { maintainer: report.incident.maintainer } : {};
  // One example per distinct statement, each ";"-terminated and labelled: FalkorDB runs one statement per query.
  const cypher = cypherScript(results.flatMap(({ card, r }) => r.cypher.map((q, i) => ({ tool: r.tool, q, params: r.params ?? card.params, n: i + 1, of: r.cypher.length }))), hints);
  const schema = schemaOf(results.flatMap(({ r }) => r.cypher));
  const cached = results.filter(({ r }) => r.cached).length;
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
  const [showConcentration, setShowConcentration] = useState(!guest); // one pasted repo: collapsed until asked for

  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
    refs.current[next]?.focus();
  };
  // the strip scrolls sideways on a phone: the chosen tab comes fully into view, 12px clear of the edge (it sat at x = -13)
  const select = (i: number) => {
    setTab(i);
    refs.current[i]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  };

  return (
    <section aria-label="Details" className="border-t border-line-1">
      <div role="tablist" aria-label="Details" className="flex scroll-px-3 gap-1 overflow-x-auto border-b border-line-1 px-3">
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => void (refs.current[i] = el)}
            id={`${base}-t${i}`}
            role="tab"
            type="button"
            aria-selected={tab === i}
            aria-controls={`${base}-panel${i}`} // every tab's panel is in the DOM (hidden unless selected), so the id always resolves
            tabIndex={tab === i ? 0 : -1}
            onClick={() => select(i)}
            onKeyDown={(e) => onKey(e, i)}
            // The ring sits inside the button: the tablist scrolls horizontally and would clip an outer ring.
            className={`-mb-px min-h-(--control-h) shrink-0 border-b-2 px-2 text-sm whitespace-nowrap focus-visible:-outline-offset-2 ${tab === i ? 'border-fg-0 text-fg-0' : 'border-transparent text-fg-1 hov:text-fg-0'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* the three unselected panels are empty and hidden: their ids exist for aria-controls, their content is built on selection */}
      {TABS.map((t, i) =>
        i === tab ? null : <div key={t} role="tabpanel" id={`${base}-panel${i}`} aria-labelledby={`${base}-t${i}`} hidden />,
      )}
      <div
        role="tabpanel"
        id={`${base}-panel${tab}`}
        aria-labelledby={`${base}-t${tab}`}
        tabIndex={tab === 1 ? undefined : 0} // panels without a focusable child are reachable by keyboard themselves
        className="p-3 text-sm"
      >
        {tab === 0 &&
          (shares.length && !showConcentration ? (
            <div className="flex flex-col items-start gap-2">
              <p className="max-w-(--measure) text-fg-1">
                Which maintainer account could be the next one hijacked is a question about a whole org&rsquo;s dependencies. For one pasted repo it ranks the
                maintainers in its own tree.
              </p>
              <Button onClick={() => setShowConcentration(true)}>Show the {plural(shares.length, 'maintainer')} in this repo&rsquo;s tree</Button>
            </div>
          ) : shares.length ? (
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
                      {ACCOUNT_NOTE[c.maintainer] && <span className="block text-fg-0">{ACCOUNT_NOTE[c.maintainer]}</span>}
                      {plural(c.packages, 'package')} · reaches {c.reposReached} of {plural(repos, 'repo')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 max-w-(--measure) text-xs text-fg-2">
                The scores come from <code className="font-mono text-xs text-fg-1">algo.pageRank(&apos;Package&apos;, &apos;PKG_DEPENDS&apos;)</code>, run once when the graph was ingested and stored on each package. The
                concentration_risk query sums them per maintainer.
              </p>
            </>
          ) : (
            <EmptyState className="p-0" title="No concentration data" cause="The concentration_risk tool returned no maintainers for this run." />
          ))}
        {tab === 1 && (
          <div className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button icon={<Copy size={16} />} onClick={() => void copyText(cypher, 'All statements')} disabled={!cypher}>
                Copy all
              </Button>
              <p className="text-xs text-fg-1">One example per distinct statement. FalkorDB runs one statement per query: paste and run each on its own.</p>
            </div>
            {cypher ? (
              // wrapped like the cards' Cypher (nothing clipped sideways); it scrolls down only, so it keeps one tab stop
              <pre tabIndex={0} role="region" aria-label="Cypher queries" className="max-h-72 w-full overflow-y-auto rounded-xs bg-bg-3 p-2 text-xs leading-[18px] whitespace-pre-wrap text-fg-0 [overflow-wrap:anywhere]">
                <code>
                  <Wrapped text={cypher} />
                </code>
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
                <h3 id={`${base}-marked`} className="label-caps mb-1.5">
                  Marked remediated
                </h3>
                {marks.length ? (
                  <ul className="flex flex-col gap-1">
                    {marks.map(([repo, at]) => (
                      <li key={repo} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="font-mono text-fg-0 [overflow-wrap:anywhere]">{repoLabel(repo)}</span>
                        <time dateTime={new Date(at).toISOString()} className="text-fg-1">
                          {utcStamp(at)}
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
                <h3 id={`${base}-earlier`} className="label-caps mb-1.5">
                  Assessed in earlier runs
                </h3>
                {earlier.length ? (
                  <p className="text-fg-0">
                    {plural(earlier.length, 'repo')} <span className="text-fg-1">· latest </span>
                    <time dateTime={new Date(latest).toISOString()}>{utcStamp(latest)}</time>
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
            {guest && (
              <>
                <dt className="text-fg-1">Graph size</dt>
                <dd className="max-w-(--measure) text-xs text-fg-1">
                  Not counted for a pasted repo: its graph is a temporary one built from its lockfile (deleted after an hour unused). The node
                  and edge counts (/api/stats) cover the demo org&rsquo;s graphs.
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
            <dt className="text-fg-1">FalkorDB time, summed over queries</dt>
            <dd className="font-mono text-xs text-fg-0 tabular-nums">
              {fmtMs(results.reduce((n, { r }) => n + r.ms, 0))}
              {/* a cached call carries the time it first took, so this sum can read above the run total beside it: say so */}
              {cached > 0 && <span className="block font-sans text-fg-1">includes {plural(cached, 'cached call')}, each at the time it first took</span>}
            </dd>
            {totalMs !== null && (
              <>
                <dt className="text-fg-1">Run total, wall clock</dt>
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
                  {r.cypher.length} {r.cypher.length === 1 ? 'query' : 'queries'} · {r.rows.length} rows · {fmtMs(r.ms)}{r.cached && ' · cached'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
