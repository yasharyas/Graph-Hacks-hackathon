/* App: the war room (docs/design.md sections 4 and 5). State wiring only; every pane is a component.
 *
 * Layout: header, optional panel row (paste / alert), the band (timeline scrubber + contrast card), the onboarding
 * hint, then the panes: tool feed | path graph | exposure table (exec summary on top). >= 1280px three panes in one
 * viewport (panes scroll, the page does not); 1024-1279 feed left, graph over table right; below 1024 one column
 * with a bottom tab bar (Feed / Graph / Table) and the page scrolls. The graph is a breadcrumb below 768px.
 *
 * Data: useTimeline + usePlayback drive the scrubber (autoplay 13:00 to 14:30 on first load); useTriage owns the
 * run; before a report exists the graph shows the scrubber's exposures, afterwards the report's. Mock mode (?mock)
 * replays shared/fixtures; see data/api.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isMock } from './data/api.ts';
import { downloadReport } from './data/export.ts';
import type { ScenarioId } from './data/types.ts';
import { useAnalyze } from './data/useAnalyze.ts';
import { usePlayback } from './data/usePlayback.ts';
import { useRemediation } from './data/useRemediation.ts';
import { useExposureAt, useTimeline } from './data/useTimeline.ts';
import { useTriage } from './data/useTriage.ts';
import { AskBox } from './components/AskBox.tsx';
import { Button } from './components/Button.tsx';
import { ContrastCard } from './components/ContrastCard.tsx';
import { copyText } from './components/copy.ts';
import { EmptyState } from './components/EmptyState.tsx';
import { ExecSummary } from './components/ExecSummary.tsx';
import { ExposureTable } from './components/ExposureTable.tsx';
import { FixDrawer, type DrawerTab } from './components/FixDrawer.tsx';
import { Header } from './components/Header.tsx';
import { InsightTabs } from './components/InsightTabs.tsx';
import { OnboardingHint } from './components/OnboardingHint.tsx';
import { PasteBox } from './components/PasteBox.tsx';
import { PathGraph } from './components/PathGraph.tsx';
import { AlertBanner, AlertField, type ScenarioChoice } from './components/ScenarioControl.tsx';
import { TimelineScrubber } from './components/TimelineScrubber.tsx';
import { toast, Toasts } from './components/Toasts.tsx';
import { ToolFeed } from './components/ToolFeed.tsx';

const QIX: ScenarioId = 'qix-2025-09-08';
const AUTOPLAY_MIN = 90; // 13:00 to 14:30
const HINT_KEY = 'pz.hint.dismissed';
type Pane = 'feed' | 'graph' | 'table';

const readHint = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false; // storage can be blocked: the hint then shows once per load
  }
};

export function App() {
  const [scenario, setScenario] = useState<ScenarioId>(QIX);
  const [choice, setChoice] = useState<ScenarioChoice>(QIX);
  const [panel, setPanel] = useState<'none' | 'paste' | 'alert'>('none');
  const [pane, setPane] = useState<Pane>('graph');
  const [turnKey, setTurnKey] = useState(0);
  const [alertText, setAlertText] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ repo: string | null; tab: DrawerTab }>({ repo: null, tab: 'fix' });
  const [userAt, setUserAt] = useState<number | null>(null);
  const [scribble, setScribble] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(readHint);
  const panesRef = useRef<HTMLDivElement>(null);

  const timeline = useTimeline(scenario);
  const first = timeline.points[0]?.at ?? null;
  const autoplayEnd = first === null ? null : first + AUTOPLAY_MIN * 60_000;
  const playback = usePlayback(first, autoplayEnd);
  const at = playback.at ?? first;
  const snapshot = at === null ? null : timeline.snapshot(at);
  const landing = useExposureAt(scenario, snapshot);
  const triage = useTriage();
  const analyze = useAnalyze();
  const { report } = triage;
  const running = triage.status === 'running';

  const remediation = useRemediation(
    triage.incident?.id ?? scenario,
    useCallback((repo: string) => toast({ message: `Could not save the remediation for ${repo}. It was reverted.`, tone: 'error' }), []),
  );

  // Scenario change: the previous run no longer describes this incident.
  useEffect(() => {
    setScribble(false);
    setUserAt(null);
  }, [scenario]);
  // The 74-min scribble draws once, when the scrubber passes the OSV marker.
  useEffect(() => {
    if (timeline.incident && at !== null && at >= timeline.incident.advisoryAt) setScribble(true);
  }, [at, timeline.incident]);
  // A new run aligns the scrubber with the run's clock, so every number on screen is true at the same time.
  useEffect(() => {
    if (triage.at !== null) playback.seek(triage.at);
  }, [triage.at]);
  // First exposure is selected when a report lands: the chain draws on straight away.
  useEffect(() => {
    if (report) setSelected(report.exposures[0]?.repo ?? null);
  }, [report]);

  /** Switch the visible pane (single-column layouts) and bring it to the top of the screen. */
  const showPane = (p: Pane) => {
    setPane(p);
    if (!matchMedia('(min-width: 1024px)').matches) requestAnimationFrame(() => panesRef.current?.scrollIntoView());
  };

  const onScenario = (v: ScenarioChoice) => {
    setChoice(v);
    if (v === 'alert') setPanel('alert');
    else {
      setScenario(v);
      setPanel((p) => (p === 'alert' ? 'none' : p));
    }
  };

  const startRun = (fn: () => void) => {
    setDrawer((d) => ({ ...d, repo: null }));
    setSelected(null);
    setTurnKey((k) => k + 1);
    showPane('feed');
    fn();
  };
  const run = () => {
    setAlertText(null);
    startRun(() => triage.run({ scenario, ...(userAt !== null && { at: userAt }) }));
  };
  const runAlert = (text: string) => {
    setAlertText(text);
    setPanel('none');
    startRun(() => triage.run({ alert: text }));
  };
  const onAnalyze = async (req: { url: string } | { lockfile: string }) => {
    const graph = await analyze.analyze({ ...req, scenario });
    if (graph) {
      setPanel('none');
      setAlertText(null);
      startRun(() => triage.run({ guest: graph, scenario }));
    }
  };

  /** A claim chip or [E1] id was clicked: select the repo whose path it names. */
  const selectEntity = (entity: string) => {
    if (!report) return;
    const repo =
      report.paths.find((p) => p.id === entity)?.repo ??
      report.exposures.find((e) => e.repo === entity)?.repo ??
      report.paths.find((p) => p.chain.includes(entity) || p.version === entity)?.repo ??
      report.exposures.find((e) => e.versions.includes(entity) || e.ranges.includes(entity))?.repo;
    if (repo) {
      setSelected(repo);
      showPane('graph');
    }
  };

  const showFlagged = () => {
    showPane('feed');
    requestAnimationFrame(() => {
      const el = document.getElementById('flagged-claims');
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: 'center' });
        el.querySelector('summary')?.focus();
      }
    });
  };

  const results = triage.toolCards.flatMap((c) => (c.result ? [c.result] : []));
  const queryTotal = results.length
    ? { ms: results.reduce((n, r) => n + r.ms, 0), queries: results.reduce((n, r) => n + r.cypher.length, 0) }
    : null;
  const incident = report?.incident ?? timeline.incident;
  const minutesAhead = report?.minutesAhead ?? (incident ? Math.floor((incident.advisoryAt - incident.firstPublishAt) / 60_000) : null);
  const graphExposures = report ? report.exposures : landing.exposures;
  const remediated = { ...Object.fromEntries((report?.exposures ?? []).flatMap((e) => (e.remediated ? [[e.repo, e.remediated.at]] : []))), ...remediation.remediated };
  const showHint = !hintDismissed && (report !== null || (!playback.playing && at !== null && autoplayEnd !== null && at >= autoplayEnd));

  const share = () => void copyText(location.href, 'Link');
  const markRemediated = (repo: string) => {
    remediation.mark(repo);
    toast({ message: `${repo} marked remediated`, tone: 'success', action: { label: 'Undo', onClick: () => remediation.undo(repo) } });
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {!playback.playing && (
        <>
          <Button variant="primary" loading={running} onClick={run}>
            {report ? 'Run again' : 'Run triage'}
          </Button>
          <Button onClick={() => onScenario('axios-2026-03-31')}>Try axios 2026</Button>
          <Button onClick={() => setPanel((p) => (p === 'paste' ? 'none' : 'paste'))}>Paste your repo</Button>
        </>
      )}
    </div>
  );

  const paneClass = (p: Pane) => (pane === p ? '' : 'max-lg:hidden');
  const lastFollowUp = triage.followUps.at(-1);

  return (
    <div className="relative flex min-h-dvh flex-col pb-(--tabbar-h) lg:pb-0 xl:h-dvh xl:overflow-hidden">
      {/* WCAG 2.2.2: the autoplay can be stopped before anything else in the tab order. */}
      {playback.playing && (
        <button
          type="button"
          onClick={playback.pause}
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-(--z-modal) focus:rounded-sm focus:bg-bg-2 focus:px-3 focus:py-2"
        >
          Pause the autoplay
        </button>
      )}
      <Header
        scenario={choice}
        onScenario={onScenario}
        onRun={run}
        running={running}
        turnKey={turnKey}
        clockAt={report ? report.at : at}
        queryTotal={queryTotal}
        mode={triage.mode}
        guard={triage.guard}
        onShowFlagged={showFlagged}
        pasteOpen={panel === 'paste'}
        onTogglePaste={() => setPanel((p) => (p === 'paste' ? 'none' : 'paste'))}
        mock={isMock}
      />
      {panel === 'paste' && <PasteBox analyze={analyze} onAnalyze={onAnalyze} onClose={() => setPanel('none')} />}
      {panel === 'alert' && (
        <section aria-label="Describe an alert" className="border-b border-line-1 bg-bg-1 px-(--gutter) py-4">
          <AlertField onRun={runAlert} disabled={running} />
        </section>
      )}
      {alertText && <AlertBanner text={alertText} pulseKey={turnKey} />}
      {triage.mode && triage.mode !== 'live' && (
        <aside aria-label="Narration mode" className="border-b border-line-1 bg-bg-1 px-(--gutter) py-1.5 text-xs text-fg-1">
          {triage.mode === 'replay' ? 'Narration replayed' : 'Narration from a template'} · graph queries live
        </aside>
      )}

      <main id="results" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        <div className="grid shrink-0 border-b border-line-1 xl:grid-cols-[4fr_6fr] min-[1440px]:grid-cols-[5fr_6fr]">
          <div className="border-b border-line-1 xl:border-r xl:border-b-0">
            {timeline.status === 'error' && timeline.error ? (
              <EmptyState
                kind="error"
                title="The timeline did not load"
                cause={timeline.error.message}
                fix={scenario === QIX ? 'Reload the page to try again.' : 'Pick the qix scenario to continue.'}
                requestId={timeline.error.requestId}
                action={scenario === QIX ? { label: 'Reload', onClick: () => location.reload() } : { label: 'Use qix', onClick: () => onScenario(QIX) }}
              />
            ) : timeline.status === 'ready' && timeline.incident && snapshot && at !== null && autoplayEnd !== null ? (
              <TimelineScrubber
                incident={timeline.incident}
                points={timeline.points}
                at={at}
                snapshot={snapshot}
                playing={playback.playing}
                onPlay={playback.play}
                onPause={playback.pause}
                onSeek={(t) => (setUserAt(t), playback.seek(t))}
                landingEnd={autoplayEnd}
              />
            ) : (
              <div className="p-4" aria-busy="true" aria-label="Loading the timeline">
                <div className="skeleton h-32 w-full" />
              </div>
            )}
          </div>
          {timeline.status === 'error' ? (
            <div className="p-4">{actions}</div>
          ) : (
            <ContrastCard
              snapshot={timeline.status === 'ready' ? snapshot : null}
              grepCount={report?.grepCount ?? landing.grepCount}
              grepName={landing.grepName}
              minutesAhead={minutesAhead}
              scribble={scribble}
              actions={actions}
            />
          )}
        </div>

        {showHint && (
          <div className="pt-3">
            <OnboardingHint
              onDismiss={() => {
                setHintDismissed(true);
                try {
                  localStorage.setItem(HINT_KEY, '1');
                } catch {
                  /* blocked storage: dismissed for this load only */
                }
              }}
            />
          </div>
        )}

        <div ref={panesRef} className="grid min-h-0 flex-1 lg:grid-cols-[var(--pane-left)_minmax(0,1fr)] lg:grid-rows-[minmax(480px,auto)_auto] xl:grid-cols-[var(--pane-left)_minmax(0,1fr)_var(--pane-right)] xl:grid-rows-[minmax(0,1fr)]">
          <section aria-label="Tool feed" className={`scroll-pane border-line-1 bg-bg-1 p-3 lg:row-span-2 lg:h-0 lg:min-h-full lg:border-r xl:row-span-1 xl:h-auto xl:min-h-0 ${paneClass('feed')}`}>
            <ToolFeed
              cards={triage.toolCards}
              followUps={triage.followUps}
              narration={triage.narration}
              guard={triage.guard}
              status={triage.status}
              error={triage.error}
              scenario={triage.incident?.id ?? scenario}
              onRun={run}
              onSelectEntity={selectEntity}
              footer={
                report && (
                  <AskBox
                    disabled={running}
                    asking={triage.asking}
                    rounds={triage.followUps.length}
                    error={lastFollowUp?.status === 'error' ? triage.error : null}
                    onAsk={triage.ask}
                  />
                )
              }
            />
          </section>

          <div className={`min-h-[420px] lg:col-start-2 lg:row-start-1 xl:h-full xl:min-h-0 ${paneClass('graph')}`}>
            <PathGraph
              exposures={graphExposures}
              paths={report?.paths ?? []}
              incident={incident}
              selectedRepo={selected}
              playing={playback.playing}
              onSelectRepo={setSelected}
            />
          </div>

          <section
            aria-label="Exposure results"
            className={`scroll-pane border-line-1 bg-bg-1 lg:col-start-2 lg:row-start-2 lg:border-t xl:col-start-3 xl:row-start-1 xl:border-t-0 xl:border-l ${paneClass('table')}`}
          >
            {!report && <h2 className="sr-only">Exposure results</h2>}
            {report ? (
              <>
                <ExecSummary report={report} onShare={share} />
                <ExposureTable
                  exposures={report.exposures}
                  paths={report.paths}
                  badVersions={new Set(report.incident.versions.map((v) => v.id))}
                  selectedRepo={selected}
                  remediated={remediated}
                  undoable={remediation.undoable}
                  onSelect={setSelected}
                  onOpenFix={(repo) => setDrawer({ repo, tab: 'fix' })}
                  onUndo={remediation.undo}
                />
                <InsightTabs report={report} cards={triage.toolCards} graph={triage.graph} totalMs={triage.ms} />
              </>
            ) : (
              <EmptyState
                title="No exposures to show yet"
                cause="The table lists every repo that reaches a malicious version, with its tier, path and owner."
                fix="Run the triage to fill it."
                action={{ label: 'Run triage', onClick: run }}
              />
            )}
          </section>
        </div>
      </main>

      <footer className="shrink-0 border-t border-line-1 px-(--gutter) py-1.5 text-xs text-fg-2">
        WOULD_PULL means a fresh install during the window would have fetched the malicious version, not that the repo was compromised. Lockfile-pinned npm ci
        builds were safe. Counts are true at the scenario clock.
        {isMock && ' Mock mode: fixture replay, not live results.'}
      </footer>

      <nav aria-label="Panels" className="fixed inset-x-0 bottom-0 z-(--z-drawer) flex h-(--tabbar-h) border-t border-line-1 bg-bg-1 lg:hidden">
        {(['feed', 'graph', 'table'] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-current={pane === p ? 'page' : undefined}
            onClick={() => showPane(p)}
            className={`flex-1 text-sm font-medium transition-colors duration-(--dur-fast) ease-out ${pane === p ? 'bg-bg-3 text-fg-0' : 'text-fg-1'}`}
          >
            {p === 'feed' ? 'Feed' : p === 'graph' ? 'Graph' : 'Table'}
          </button>
        ))}
      </nav>

      {report && (
        <FixDrawer
          repo={drawer.repo}
          report={report}
          tab={drawer.tab}
          onTab={(tab) => setDrawer((d) => ({ ...d, tab }))}
          onClose={() => setDrawer((d) => ({ ...d, repo: null }))}
          remediatedAt={drawer.repo ? (remediated[drawer.repo] ?? null) : null}
          onRemediate={markRemediated}
          running={running}
          onCancelRun={triage.abort}
          onExport={(f) => downloadReport(report, f)}
          onShare={share}
        />
      )}
      <Toasts />
    </div>
  );
}
