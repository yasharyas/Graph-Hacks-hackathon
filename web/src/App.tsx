/* App: the war room (docs/design.md sections 4 and 5). State wiring only; every pane is a component.
 *
 * Layout: header, optional panel row (paste / alert), the band, then the panes: tool feed | path graph | exposure table.
 * The band has two modes. Landing (nothing run yet): the purpose line, the scrubber with its counter, the contrast card
 * and the three actions. Report mode (from the click on Run triage, not from the report landing, so the layout change
 * happens inside the click and nothing shifts later): one compact row, so a laptop sees the table's header and its first
 * rows without scrolling. >= 1280px three panes in one viewport (panes scroll, the page does not); 1024-1279 feed left,
 * graph over table right; below 1024 one column with a bottom tab bar (Feed / Graph / Table) and the page scrolls.
 *
 * Data: useTimeline + usePlayback drive the scrubber (autoplay on first load, or a position restored from a share link);
 * useTriage owns the run; before a report exists the graph shows the scrubber's exposures, afterwards the report's.
 * One source of truth for numbers: once a report exists the band's counts ARE the table's (the report, or the exact
 * /api/exposure answer after scrubbing), never a second sample of the timeline. A pasted repo has its own numbers and
 * its own label; the demo org's are always labelled as such. "Minutes ahead" has one definition (advisory minus first
 * exposure) wherever it is printed. Mock mode (?mock) replays shared/fixtures; see data/api.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { isMock } from './data/api.ts';
import { downloadReport } from './data/export.ts';
import { fixFor } from './data/errors.ts';
import { isHead, plural, utcLabel } from './data/format.ts';
import type { IncidentMeta, ScenarioId, TimelinePoint } from './data/types.ts';
import { useAnalyze } from './data/useAnalyze.ts';
import { useBackClose } from './data/useBackClose.ts';
import { usePlayback } from './data/usePlayback.ts';
import { useRemediation } from './data/useRemediation.ts';
import { useExposureAt, useExposureQuery, useTimeline } from './data/useTimeline.ts';
import { useTriage } from './data/useTriage.ts';
import { readUrlState, shareUrl } from './data/urlState.ts';
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
import { PasteBox, type PasteRequest } from './components/PasteBox.tsx';
import { PathGraph } from './components/PathGraph.tsx';
import { ReportClock } from './components/ReportClock.tsx';
import { scrollPaneTo } from './components/scrollPane.ts';
import { AlertBanner, AlertField, type ScenarioChoice } from './components/ScenarioControl.tsx';
import { TimelineScrubber } from './components/TimelineScrubber.tsx';
import { toast, Toasts } from './components/Toasts.tsx';
import { ToolFeed } from './components/ToolFeed.tsx';

const QIX: ScenarioId = 'qix-2025-09-08';
const AXIOS: ScenarioId = 'axios-2026-03-31';
const AUTOPLAY_MIN = 90; // 13:00 to 14:30 (longer when the advisory lands later, so the landing story always reaches it)
const MIN = 60_000;
const sameMinute = (a: number, b: number) => Math.floor(a / MIN) === Math.floor(b / MIN);
const HINT_KEY = 'pz.hint.dismissed';
const PURPOSE = 'See which repos are one install away from a hijacked npm package — before the advisory exists.';
type Pane = 'feed' | 'graph' | 'table';
interface Guest {
  graph: string;
  repo: string;
}

const readHint = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false; // storage can be blocked: the hint then shows once per load
  }
};
const desktop = () => matchMedia('(min-width: 1024px)').matches;
/** Advisory minus the first moment any repo was exposed: the one definition of "minutes ahead" (server-provided when it knows). */
const aheadOf = (i: IncidentMeta | null) => (i?.firstExposureAt ? Math.floor((i.advisoryAt - i.firstExposureAt) / MIN) : null);
/** The bad package names the name grep looks for: "ansi-styles, debug +17". */
const grepNames = (i: IncidentMeta | null) => {
  if (!i) return null;
  const n = [...new Set(i.versions.map((v) => v.id.replace(/@[^@]*$/, '')))];
  return n.length <= 2 ? n.join(', ') : `${n.slice(0, 2).join(', ')} +${n.length - 2}`;
};

export function App() {
  const urlInit = useRef(readUrlState(location.search)).current; // a share link: scenario, minute, selected repo
  const [scenario, setScenario] = useState<ScenarioId>(urlInit.scenario ?? QIX);
  const [choice, setChoice] = useState<ScenarioChoice>(urlInit.scenario ?? QIX);
  const [startAt, setStartAt] = useState<number | null>(urlInit.at); // opens the track here, paused, instead of autoplaying
  const [panel, setPanel] = useState<'none' | 'paste' | 'alert'>('none');
  const [pane, setPane] = useState<Pane>('feed'); // phones start on the Feed, the only pane with the Run triage action
  const [turnKey, setTurnKey] = useState(0);
  const [alertText, setAlertText] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [drawer, setDrawer] = useState<{ repo: string | null; tab: DrawerTab }>({ repo: null, tab: 'fix' });
  const [userAt, setUserAt] = useState<number | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null); // the pasted repo the current run is about
  const [retry, setRetry] = useState(0);
  const [hintDismissed, setHintDismissed] = useState(readHint);
  const guestReq = useRef<PasteRequest | null>(null); // what was pasted, so another incident can re-analyze it
  const restoreRepo = useRef(urlInit.repo); // the share link's selected repo, applied to the first report
  const rerun = useRef(0);
  const paneRef = useRef<Pane>('feed');
  const panesRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLElement>(null);
  paneRef.current = pane;

  const timeline = useTimeline(scenario);
  const stale = timeline.status === 'loading' && timeline.incident !== null && timeline.incident.id !== scenario; // the previous incident, dimmed
  const first = timeline.points[0]?.at ?? null;
  const last = timeline.points.at(-1)?.at ?? null;
  const autoplayEnd =
    first === null || last === null || !timeline.incident
      ? null
      : Math.min(last, Math.max(first + AUTOPLAY_MIN * MIN, Math.floor(timeline.incident.advisoryAt / MIN) * MIN + 3 * MIN));
  const playback = usePlayback(first, autoplayEnd, 12_000, startAt);
  const at = playback.at ?? first;
  const rawSnapshot = at === null ? null : timeline.snapshot(at);
  const triage = useTriage();
  const { report } = triage;
  const running = triage.status === 'running';
  const compact = triage.status !== 'idle';
  const landing = useExposureAt(scenario, report || stale ? null : rawSnapshot); // after a report the table has its own query
  const analyze = useAnalyze();

  const remediation = useRemediation(
    triage.incident?.id ?? scenario,
    useCallback((repo: string, why: string) => toast({ message: `Could not save ${repo} as remediated: ${why} It was reverted.`, tone: 'error' }), []),
  );

  // After a report, scrubbing re-queries the org graph at the new clock. Not for a pasted repo (its graph is its
  // own) and not when the scrubber now shows a different incident than the report.
  const isGuest = guest !== null || report?.scope?.kind === 'guest';
  const other = report && report.incident.id !== scenario ? report.incident.id : null;
  const wantAt = report && at !== null && !sameMinute(at, report.at) ? at : null;
  const follow = !isGuest && !other && wantAt !== null;
  const live = useExposureQuery(scenario, follow ? wantAt : null, retry);
  const scrubbed = follow && live.data ? live.data : null;
  const incident = stale ? null : (report?.incident ?? timeline.incident);
  // One definition of "minutes ahead": a pasted repo's own, else advisory minus first exposure, else the server's figure.
  const minutesAhead = isGuest
    ? (report?.minutesAhead ?? null)
    : (aheadOf(report?.incident ?? null) ?? report?.minutesAhead ?? aheadOf(timeline.incident) ?? (timeline.incident ? Math.floor((timeline.incident.advisoryAt - timeline.incident.firstPublishAt) / MIN) : null));
  const view = report && { ...report, ...scrubbed, paths: scrubbed ? [] : report.paths, minutesAhead: minutesAhead ?? report.minutesAhead }; // paths describe the run's clock only
  const liveError = live.error && live.error.at === wantAt ? { message: live.error.message, fix: fixFor(live.error, 'exposure'), requestId: live.error.requestId } : null;

  // The numbers in the band are the table's numbers (or, before a report, the scrubber's own sample): never a second source.
  const failed = triage.status === 'error' && !report;
  const bandPoint: TimelinePoint | null = isGuest
    ? report
      ? { at: report.at, counts: report.counts, scanner: report.scanner.length }
      : null
    : view && !other
      ? { at: view.at, counts: view.counts, scanner: view.scanner.length }
      : rawSnapshot;
  // The label and size come from the report's own scope: the demo org ("Acme demo org · 21 repos") or the pasted repo.
  const sc = report?.scope;
  const scope = isGuest ? `${sc?.label ?? guest?.repo ?? 'Pasted repo'}, pasted repo` : `${sc?.label ?? 'Acme demo org'}${sc ? ` · ${plural(sc.repos, 'repo')}` : ''}`;
  const scopeLine = failed ? `${scope} · triage did not run` : scope;

  // Scenario change: the previous run no longer describes this incident.
  useEffect(() => {
    setUserAt(null);
  }, [scenario]);
  // A new run aligns the scrubber with the run's clock, so every number on screen is true at the same time (and says so).
  useEffect(() => {
    if (triage.at === null) return;
    if (at !== null && !sameMinute(at, triage.at) && !playback.playing && !stale) {
      toast({ message: `Scrubber moved from ${utcLabel(at)} to ${utcLabel(triage.at)}, the clock this triage ran at.` });
    }
    playback.seek(triage.at);
  }, [triage.at]);
  // First exposure is selected when a report lands (or the share link's repo): the chain draws on straight away.
  useEffect(() => {
    if (!report) return;
    const want = restoreRepo.current;
    restoreRepo.current = null;
    setSelected(want && report.exposures.some((e) => e.repo === want) ? want : (report.exposures[0]?.repo ?? null));
  }, [report]);
  // A share link that names a repo reopens its answer: the triage runs at the link's minute.
  const autoRan = useRef(false);
  useEffect(() => {
    if (urlInit.repo && !autoRan.current) {
      autoRan.current = true;
      void runAt(urlInit.at ?? undefined, null);
    }
  }, []);

  // Back closes the open drawer or paste panel (the default dismiss gesture on a phone) instead of leaving the app.
  useBackClose(drawer.repo !== null, () => setDrawer((d) => ({ ...d, repo: null })));
  useBackClose(panel === 'paste', () => setPanel('none'));

  /** Switch the visible pane (single-column layouts), bring it to the top of the screen, and (from a tab press) move focus into it. */
  const showPane = (p: Pane, focus = false) => {
    if (focus) flushSync(() => setPane(p));
    else setPane(p);
    const target = p === 'feed' ? feedRef : p === 'table' ? tableRef : graphRef;
    if (!desktop()) {
      requestAnimationFrame(() => requestAnimationFrame(() => (panesRef.current?.scrollIntoView(), focus && target.current?.focus({ preventScroll: true }))));
    } else if (focus) target.current?.focus({ preventScroll: true });
  };

  const dismissHint = () => {
    setHintDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* blocked storage: dismissed for this load only */
    }
  };
  /** A repo picked by a person (table row, claim chip): select it, retire the hint, say so for screen readers. */
  const pick = (repo: string) => {
    setSelected(repo);
    dismissHint();
    const p = report?.paths.find((x) => x.repo === repo);
    const e = report?.exposures.find((x) => x.repo === repo);
    setAnnounce(
      p
        ? `Selected ${repo}: ${p.chain.join(', then ')}${p.chain.at(-1) === p.version ? '' : `, then ${p.version}`}.`
        : e
          ? `Selected ${repo}: reaches ${e.versions.slice(0, 3).join(', ') || 'the hijacked account’s packages'}. No drafted path for it.`
          : `Selected ${repo}.`,
    );
  };

  const closePaste = () => {
    setPanel('none');
    document.querySelector<HTMLElement>('[aria-controls="paste-panel"]')?.focus(); // the panel's Close button is about to unmount
  };

  const startRun = (fn: () => void) => {
    setDrawer((d) => ({ ...d, repo: null }));
    setSelected(null);
    setTurnKey((k) => k + 1);
    showPane('feed');
    fn();
  };
  // The button that started a run is disabled while it runs, which would drop keyboard focus to the page top: land in the feed instead.
  useEffect(() => {
    if (turnKey > 0) feedRef.current?.focus({ preventScroll: true });
  }, [turnKey]);
  /** Run (or re-run) the triage at a clock, for a scenario. A re-run first commits any "mark remediated" still inside its Undo window, so it shows. */
  const runAt = async (clock?: number, g: Guest | null = guest, scn: ScenarioId = scenario) => {
    setAlertText(null);
    if (g === null) {
      setGuest(null);
      guestReq.current = null;
    }
    await remediation.flush();
    const when = clock !== undefined ? { at: clock } : {};
    startRun(() => triage.run(g ? { guest: g.graph, scenario: scn, ...when } : { scenario: scn, ...when }));
  };
  const run = () => (alertText !== null && !guest ? runAlert(alertText) : void runAt(userAt ?? undefined));
  const runAlert = async (text: string) => {
    setAlertText(text);
    setGuest(null);
    guestReq.current = null;
    setPanel('none');
    await remediation.flush();
    startRun(() => triage.run({ alert: text }));
  };
  /** Analyze a pasted repo or lockfile for an incident, then triage it. The request is kept so another incident can re-run it. */
  const onAnalyze = async (req: PasteRequest, scn: ScenarioId = scenario) => {
    const g = await analyze.analyze({ ...req, scenario: scn });
    if (g) {
      guestReq.current = req;
      setGuest(g);
      setPanel('none');
      setAlertText(null);
      startRun(() => triage.run({ guest: g.graph, scenario: scn }));
    }
  };

  /** Another incident: the timeline follows at once; whatever was on screen (a report, a pasted repo) is re-run for it, after a short pause so arrowing through the control does not start three runs. */
  const switchTo = (v: ScenarioId, now = false) => {
    window.clearTimeout(rerun.current);
    setStartAt(null);
    setScenario(v);
    setChoice(v);
    setAlertText(null);
    setPanel((p) => (p === 'alert' ? 'none' : p));
    const go = () => (guestReq.current ? void onAnalyze(guestReq.current, v) : void runAt(undefined, null, v));
    if (now) go();
    else if (v !== scenario && (guestReq.current || triage.status !== 'idle')) rerun.current = window.setTimeout(go, 450);
  };
  const onScenario = (v: ScenarioChoice) => {
    if (v === 'alert') {
      window.clearTimeout(rerun.current);
      setChoice('alert');
      setPanel('alert');
    } else if (v !== scenario || choice === 'alert') switchTo(v);
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
      pick(repo);
      showPane('graph');
    }
  };

  const showFlagged = () => {
    showPane('feed');
    requestAnimationFrame(() => {
      const el = document.getElementById('flagged-claims');
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        scrollPaneTo(el);
        el.querySelector('summary')?.focus();
      }
    });
  };
  /** "Built on FalkorDB": open the Graph stats tab under the table. */
  const openStats = () => {
    if (!report) return toast({ message: 'Graph stats appear once a triage has run. Press Run triage first.' });
    flushSync(() => setPane('table'));
    const tab = [...document.querySelectorAll<HTMLElement>('#exposures [role="tab"]')].find((t) => /graph stats/i.test(t.textContent ?? ''));
    tab?.click();
    tab?.focus({ preventScroll: true });
    if (tab) scrollPaneTo(tab, 48);
  };

  // Phones: when the verdict arrives, bring it into view once the layout has settled (the band collapsed, the cards streamed).
  const hasNarration = triage.narration !== null;
  useEffect(() => {
    if (!hasNarration || desktop() || paneRef.current !== 'feed') return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector('section[aria-label="Narrative"]');
        if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 20 }); // the card is still 6px into its enter animation
      }),
    );
  }, [hasNarration]);

  const results = triage.toolCards.flatMap((c) => (c.result ? [c.result] : []));
  const queryTotal = results.length
    ? { ms: results.reduce((n, r) => n + r.ms, 0), queries: results.reduce((n, r) => n + r.cypher.length, 0) }
    : null;
  const graphExposures = view ? view.exposures : landing.exposures;
  // marks the server already holds come from the run (a scrubbed /api/exposure answer carries none), plus this screen's own
  const remediated = { ...Object.fromEntries((report?.exposures ?? []).flatMap((e) => (e.remediated ? [[e.repo, e.remediated.at]] : []))), ...remediation.remediated };
  const inRun = new Set(report?.exposures.map((e) => e.repo));
  // exports describe the run, plus the marks made on this screen (some may still be inside the Undo window)
  const exported = report && { ...report, exposures: report.exposures.map((e) => (remediation.remediated[e.repo] ? { ...e, remediated: { at: remediation.remediated[e.repo]!, action: 'remediated' } } : e)) };
  const showHint = report !== null && !hintDismissed;
  const reveal = !stale && incident !== null && at !== null && at >= incident.advisoryAt; // the figure waits for the playhead to pass the OSV record

  /** Share = the state: scenario, the minute on screen, and the selected repo (a pasted repo has no org graph to reopen). */
  const link = () => shareUrl(location.href, { scenario: report?.incident.id ?? scenario, at: view?.at ?? at, repo: isGuest ? null : selected });
  const share = () => void copyText(link(), 'Link');
  // The drawer is a modal dialog, so it reports and offers Undo itself; a toast would sit dimmed and inert under its scrim.
  const markRemediated = (repo: string) => remediation.mark(repo);

  const actions = (
    <div className="flex min-h-(--control-h) flex-wrap items-center gap-2">
      <Button variant="primary" loading={running} onClick={run}>
        {report ? 'Run again' : 'Run triage'}
      </Button>
      <Button onClick={() => switchTo(scenario === QIX ? AXIOS : QIX, true)}>{scenario === QIX ? 'Try axios 2026' : 'Try qix 2025'}</Button>
      <Button onClick={() => setPanel((p) => (p === 'paste' ? 'none' : 'paste'))}>Paste your repo</Button>
    </div>
  );

  const paneClass = (p: Pane) => (pane === p ? '' : 'max-lg:hidden');
  const lastFollowUp = triage.followUps.at(-1);
  const skipLink =
    'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-(--z-modal) focus:rounded-sm focus:bg-bg-2 focus:px-3 focus:py-2';
  // The narrative dims a narration whose clock differs from the scrubber's and offers a re-run (ToolFeed hands both to
  // NarrativePanel). A spread, not named props, so this file compiles whichever side of the ToolFeed change it is built on.
  const feedExtra = { clockAt: at, onRerun: run, onShowFlagged: showFlagged };

  return (
    <div className="relative flex min-h-dvh flex-col pb-(--tabbar-h) lg:pb-0 xl:h-dvh xl:overflow-clip">
      {/* Tab order: skip link first, then (WCAG 2.2.2) the autoplay can be stopped before anything else. */}
      <a href="#results" className={skipLink}>
        Skip to results
      </a>
      {/* 17 tool cards sit between the header and the table: a keyboard user can jump straight to it. */}
      {report && (
        <a
          href="#exposures"
          onClick={(e) => {
            e.preventDefault();
            flushSync(() => setPane('table'));
            tableRef.current?.focus();
          }}
          className={skipLink}
        >
          Skip to exposure table
        </a>
      )}
      {/* Always mounted: it flips its label instead of unmounting under the user's focus. */}
      <button type="button" disabled={first === null} onClick={playback.playing ? playback.pause : playback.play} className={skipLink}>
        {playback.playing ? 'Pause the autoplay' : 'Resume the autoplay'}
      </button>
      <Header
        scenario={choice}
        onScenario={onScenario}
        onRun={() => void runAt(userAt ?? undefined, null)}
        running={running}
        turnKey={turnKey}
        clockAt={view ? view.at : at}
        queryTotal={queryTotal}
        mode={triage.mode}
        guard={triage.guard}
        onShowFlagged={showFlagged}
        onOpenStats={openStats}
        pasteOpen={panel === 'paste'}
        onTogglePaste={() => setPanel((p) => (p === 'paste' ? 'none' : 'paste'))}
        mock={isMock}
      />
      {panel === 'paste' && <PasteBox analyze={analyze} onAnalyze={(req) => void onAnalyze(req)} onClose={closePaste} />}
      {panel === 'alert' && (
        <section aria-label="Describe an alert" className="border-b border-line-1 bg-bg-1 px-(--gutter) py-4">
          <AlertField onRun={runAlert} disabled={running} />
        </section>
      )}
      {alertText && <AlertBanner text={alertText} pulseKey={turnKey} />}
      <p role="status" className="sr-only">
        {announce}
      </p>

      <main id="results" tabIndex={-1} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-line-1">
          {!compact && <p className="px-(--gutter) pt-3 text-base text-fg-1">{PURPOSE}</p>}
          <div className={compact ? '' : 'grid xl:grid-cols-[4fr_6fr] min-[1440px]:grid-cols-[5fr_6fr]'}>
            <div className={compact ? '' : 'border-b border-line-1 xl:border-r xl:border-b-0'}>
              {timeline.status === 'error' && timeline.error ? (
                <EmptyState
                  kind="error"
                  title="The timeline did not load"
                  cause={timeline.error.message}
                  fix={scenario === QIX ? 'Reload the page to try again.' : 'Pick the qix scenario to continue.'}
                  requestId={timeline.error.requestId}
                  action={scenario === QIX ? { label: 'Reload', onClick: () => location.reload() } : { label: 'Use qix', onClick: () => onScenario(QIX) }}
                />
              ) : (
                <TimelineScrubber
                  incident={timeline.incident}
                  points={timeline.points}
                  at={at ?? 0}
                  snapshot={bandPoint}
                  playing={playback.playing}
                  onPlay={playback.play}
                  onPause={playback.pause}
                  onSeek={(t) => (setUserAt(t), setStartAt(null), playback.seek(t))}
                  landingEnd={autoplayEnd}
                  compact={compact}
                  scope={scopeLine}
                  stale={stale}
                  trailing={
                    // the empty icon slot is where the radar goes while it runs: the button keeps its width
                    <Button loading={running} icon={<span className="size-3.5" />} onClick={run} className="shrink-0 pl-2">
                      Run again
                    </Button>
                  }
                />
              )}
            </div>
            {!compact &&
              (timeline.status === 'error' ? (
                <div className="p-4">{actions}</div>
              ) : (
                <div className={`transition-opacity duration-(--dur-fast) ease-out ${stale ? 'opacity-50' : ''}`}>
                  <ContrastCard
                    snapshot={rawSnapshot}
                    grepCount={landing.grepCount}
                    grepName={landing.grepName ?? grepNames(incident ?? timeline.incident)}
                    minutesAhead={minutesAhead}
                    reveal={reveal}
                    actions={actions}
                  />
                </div>
              ))}
          </div>
        </div>

        <div ref={panesRef} className="grid min-h-0 flex-1 lg:grid-cols-[var(--pane-left)_minmax(0,1fr)] lg:grid-rows-[minmax(480px,auto)_auto] xl:grid-cols-[var(--pane-left)_minmax(0,1fr)_var(--pane-right)] xl:grid-rows-[minmax(0,1fr)]">
          <section
            ref={feedRef}
            tabIndex={-1}
            aria-label="Tool feed"
            onClickCapture={(e) => {
              // Reading a query is "first use" too: retire the hint.
              const b = (e.target as HTMLElement).closest('button');
              if (b && /cypher/i.test(`${b.textContent} ${b.getAttribute('aria-label') ?? ''}`)) dismissHint();
            }}
            // Below 1024px the Ask box is fixed above the tab bar: keep the last cards clear of it.
            className={`scroll-pane border-line-1 bg-bg-1 p-3 lg:row-span-2 lg:h-0 lg:min-h-full lg:border-r xl:row-span-1 xl:h-auto xl:min-h-0 ${report ? 'max-lg:pb-36' : ''} ${paneClass('feed')}`}
          >
            {/* Reserved from the click on Run triage, so the mode line never pushes the cards down when it arrives. */}
            {compact && (
              <aside aria-label="Narration mode" className="mb-2 min-h-5 text-xs text-fg-1">
                {triage.mode === 'replay' && 'Narration replayed · graph queries live'}
                {triage.mode === 'template' && 'Narration from a template · graph queries live'}
                {triage.mode === 'live' && 'Narration written live · graph queries live'}
              </aside>
            )}
            <ToolFeed
              {...feedExtra}
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
                    rounds={triage.followUps.filter((f) => f.status !== 'error').length}
                    error={lastFollowUp?.status === 'error' ? triage.error : null}
                    onAsk={triage.ask}
                  />
                )
              }
            />
          </section>

          <div ref={graphRef} tabIndex={-1} className={`md:min-h-[420px] lg:col-start-2 lg:row-start-1 xl:h-full xl:min-h-0 ${paneClass('graph')}`}>
            <PathGraph exposures={graphExposures} paths={view?.paths ?? []} incident={incident} selectedRepo={selected} playing={playback.playing} onSelectRepo={pick} />
          </div>

          <section
            ref={tableRef}
            id="exposures"
            tabIndex={-1}
            aria-label="Exposure results"
            className={`scroll-pane border-line-1 bg-bg-1 lg:col-start-2 lg:row-start-2 lg:border-t xl:col-start-3 xl:row-start-1 xl:border-t-0 xl:border-l ${paneClass('table')}`}
          >
            {!report && <h2 className="sr-only">Exposure results</h2>}
            {report && view ? (
              <>
                {showHint && <OnboardingHint onDismiss={dismissHint} />}
                <ReportClock
                  runAt={report.at}
                  viewAt={view.at}
                  wantAt={wantAt}
                  loading={live.loadingAt !== null}
                  error={liveError}
                  guest={isGuest}
                  head={guest !== null && isHead(guest.repo)}
                  other={other}
                  onBack={() => (setUserAt(report.at), playback.seek(report.at), tableRef.current?.focus({ preventScroll: true }))} // the strip unmounts: keep focus in the pane
                  onRerun={(t) => void runAt(t)}
                  onRetry={() => (setRetry((n) => n + 1), tableRef.current?.focus({ preventScroll: true }))}
                />
                <ExecSummary report={view} onShare={share} />
                <ExposureTable
                  exposures={view.exposures}
                  paths={view.paths}
                  badVersions={new Set(report.incident.versions.map((v) => v.id))}
                  selectedRepo={selected}
                  remediated={remediated}
                  undoable={remediation.undoable}
                  fixable={inRun}
                  onSelect={pick}
                  onOpenFix={(repo) => (dismissHint(), setDrawer({ repo, tab: 'fix' }))}
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
        LOCKED: the lockfile pins a malicious version. WOULD_PULL: only a fresh install in the window would have fetched it; npm ci from a lockfile that never pinned it was safe.
        Counts are true at the scenario clock.
        {isMock && ' Mock mode: fixture replay, not live results.'}
      </footer>

      <nav aria-label="Panels" className="fixed inset-x-0 bottom-0 z-(--z-drawer) flex h-(--tabbar-h) border-t border-line-1 bg-bg-1 lg:hidden">
        {(['feed', 'graph', 'table'] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pane === p}
            onClick={() => showPane(p, true)}
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
          canUndo={drawer.repo !== null && remediation.undoable.has(drawer.repo)}
          onUndo={remediation.undo}
          onRemediate={markRemediated}
          running={running}
          onCancelRun={triage.abort}
          onExport={(f) => downloadReport(exported ?? report, f)}
          onShare={() => copyText(link(), 'Link', true)}
        />
      )}
      <Toasts />
    </div>
  );
}
