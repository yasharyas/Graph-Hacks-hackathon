/* App: the war room (docs/design.md sections 4 and 5). State wiring only; every pane is a component.
 *
 * Layout: header, optional alert row, the band, then the panes: tool feed | path graph | exposure table.
 * The band has two modes. Landing (nothing run yet): the purpose line, the scrubber with its counter, the contrast card
 * and the three actions. Report mode (from the click on Run triage, not from the report landing, so the layout change
 * happens inside the click and nothing shifts later): one compact row, so a laptop sees the table's header and its first
 * rows without scrolling. >= 1280px three panes in one viewport (panes scroll, the page does not); 1024-1279 feed left,
 * graph over table right, also one viewport once the band is compact (the graph row is bounded, the feed and the table scroll
 * inside: a page that scrolled 3,000px left the table under the fold and the focus logic measuring a pane taller than the
 * window); below 1024 one column with a bottom tab bar (Feed / Graph / Table) and the page scrolls.
 * "Paste your repo" and the graph stats open in a Sheet (a modal drawer; a full-height sheet on a phone), never in the flow:
 * the panes keep their size, Esc and Back close it, and the autoplay pauses while it is open.
 *
 * Data: useTimeline + usePlayback drive the scrubber (autoplay on first load, or a position restored from a share link);
 * useTriage owns the run; before a report exists the graph shows the scrubber's exposures, afterwards the report's.
 * One source of truth for numbers: once a report exists the band's counts ARE the table's (the report, or the exact
 * /api/exposure answer after scrubbing), never a second sample of the timeline. A pasted repo has its own numbers and
 * its own label; the demo org's are always labelled as such. "Minutes ahead" has one definition (advisory minus first
 * exposure) wherever it is printed. Mock mode (?mock) replays shared/fixtures; see data/api.ts.
 *
 * Every run starts at ONE clock, named on its button ("Run triage at 13:30 UTC"): the minute the person scrubbed to, else
 * the last run's, else the scenario's default (the autoplay's resting place does not count: it is where the story ends).
 * An alert typed in "Describe an alert" (not yet run) takes over every Run button ("Run triage on this alert"). A run stops
 * the scrubber at its clock as it starts; while it streams, the band's action is "Cancel run"; a run that failed leaves one
 * action, the feed's.
 * Arrow keys on the scenario control only move the selection; running is a click, Enter or the Run button.
 *
 * Share links (data/urlState.ts): ?scenario&at, plus &repo (an org repo: the page is laid out compact from the first paint,
 * the triage reruns at that minute, the row is selected with its path drawn, &open names the drawer tab, and a one-line strip
 * says which repo the link is about, or that it is not in this scenario) or &guest (a pasted public repo: NOT fetched on load, since a widely shared link
 * would spend the server's GitHub quota per visitor; a strip asks for one click, then analyses, triages, selects, opens).
 * A dropped lockfile has nothing to reopen, so it says so instead of copying a link that would open the demo org.
 *
 * Screen readers: one polite status region (selections). Nothing is announced while the autoplay runs; what the panes say
 * about the clock moving waits for the scrub to rest (useSettled, 1500 ms: longer than a person's key cadence on the slider,
 * whose own aria-valuetext speaks each step), and a move the app makes itself (a run aligning the scrubber, "Back to")
 * settles at once, so nothing ever claims the clock moved when it did not.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { alertNotes } from './data/alertNote.ts';
import { getScenarios, isMock } from './data/api.ts';
import { DEFAULT_AT } from './data/clock.ts';
import { downloadReport } from './data/export.ts';
import { minutesBetween } from './data/markers.ts';
import { nextStep, requestIdFor } from './data/failure.ts';
import { isHead, plural, utcLabel } from './data/format.ts';
import { lockSourceLabel, repoLabel } from './data/repoLabel.ts';
import type { IncidentMeta, ScenarioId, TimelinePoint } from './data/types.ts';
import { useAnalyze } from './data/useAnalyze.ts';
import { useBackClose } from './data/useBackClose.ts';
import { usePlayback } from './data/usePlayback.ts';
import { useRemediation } from './data/useRemediation.ts';
import { useSettled } from './data/useSettled.ts';
import { useExposureAt, useExposureQuery, useTimeline } from './data/useTimeline.ts';
import { useTriage } from './data/useTriage.ts';
import { readUrlState, shareUrl, type OpenTab } from './data/urlState.ts';
import { askExample, nextAccount, nextLabel } from './components/agent.ts';
import { AskBox } from './components/AskBox.tsx';
import { Button } from './components/Button.tsx';
import { ContrastCard } from './components/ContrastCard.tsx';
import { copyText } from './components/copy.ts';
import { EmptyState } from './components/EmptyState.tsx';
import { ExecSummary } from './components/ExecSummary.tsx';
import { ExposureTable } from './components/ExposureTable.tsx';
import { FixDrawer, type DrawerTab } from './components/FixDrawer.tsx';
import { GraphStatsSheet } from './components/GraphStatsSheet.tsx';
import { Header } from './components/Header.tsx';
import { InsightTabs } from './components/InsightTabs.tsx';
import { AgentContext } from './components/NarrativePanel.tsx';
import { OnboardingHint } from './components/OnboardingHint.tsx';
import { PasteBox, type PasteRequest } from './components/PasteBox.tsx';
import { PathGraph } from './components/PathGraph.tsx';
import { clockSaid, ReportClock } from './components/ReportClock.tsx';
import { reveal as revealEl, scrollPaneTo } from './components/scrollPane.ts';
import { AlertBanner, AlertField, type ScenarioChoice } from './components/ScenarioControl.tsx';
import { SharedPrompt, SharedRepoNote } from './components/SharedPrompt.tsx';
import { TimelineScrubber } from './components/TimelineScrubber.tsx';
import { toast, Toasts } from './components/Toasts.tsx';
import { ToolFeed } from './components/ToolFeed.tsx';
import { RadarIcon } from './components/icons/RadarIcon.tsx';

const QIX: ScenarioId = 'qix-2025-09-08';
const AXIOS: ScenarioId = 'axios-2026-03-31';
const AUTOPLAY_MIN = 90; // 13:00 to 14:30 (longer when the advisory lands later, so the landing story always reaches it)
const MIN = 60_000;
const sameMinute = (a: number, b: number) => Math.floor(a / MIN) === Math.floor(b / MIN);
const HINT_KEY = 'pz.hint.dismissed';
const PURPOSE = 'See which repos are one install away from a hijacked npm package — before the advisory exists.';
// The demo org: real public repos and lockfiles (snapshots), made-up teams and channels. Said beside its name, never only in a tooltip.
const DEMO_NOTE = 'Real public repos and lockfiles (snapshots); teams and channels are synthetic.';
const DEMO_NOTE_SHORT = 'teams synthetic';
const NO_SHARE_LOCKFILE = 'A dropped lockfile can’t be shared: it exists only in this tab, and a link would open the demo org instead. Share the repo’s URL, or send the file.';
type Pane = 'feed' | 'graph' | 'table';
interface Guest {
  graph: string;
  repo: string;
  scenario: ScenarioId; // the incident the analysis was built for (the server refuses a triage of it for another)
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
const aheadOf = (i: IncidentMeta | null) => (i?.firstExposureAt ? minutesBetween(i.firstExposureAt, i.advisoryAt) : null);
/** The bad package names the name grep looks for: "ansi-styles, debug +17". */
const grepNames = (i: IncidentMeta | null) => {
  if (!i) return null;
  const n = [...new Set(i.versions.map((v) => v.id.replace(/@[^@]*$/, '')))];
  return n.length <= 2 ? n.join(', ') : `${n.slice(0, 2).join(', ')} +${n.length - 2}`;
};

export function App() {
  const urlInit = useRef(readUrlState(location.search)).current; // a share link: scenario, minute, repo or guest, drawer tab
  const [scenario, setScenario] = useState<ScenarioId>(urlInit.scenario ?? QIX);
  const [choice, setChoice] = useState<ScenarioChoice>(urlInit.scenario ?? QIX);
  const [startAt, setStartAt] = useState<number | null>(urlInit.at); // opens the track here, paused, instead of autoplaying
  const [panel, setPanel] = useState<'none' | 'paste' | 'alert' | 'stats'>('none');
  const [pane, setPane] = useState<Pane>('feed'); // phones start on the Feed, the only pane with the Run triage action
  const [turnKey, setTurnKey] = useState(0);
  const [alertText, setAlertText] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [feedSaid, setFeedSaid] = useState(''); // the feed's status line, spoken from a region outside <main> (see ToolFeed onStatus)
  const [drawer, setDrawer] = useState<{ repo: string | null; tab: DrawerTab }>({ repo: null, tab: 'fix' });
  const [userAt, setUserAt] = useState<number | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null); // the pasted repo the current run is about
  const [shared, setShared] = useState<string | null>(urlInit.guest); // a share link's pasted repo, waiting for its one click
  const [sharedDone, setSharedDone] = useState(false); // its re-check worked: the strip stays, at its height, and says so
  const [retry, setRetry] = useState(0);
  const [hintDismissed, setHintDismissed] = useState(readHint);
  const guestReq = useRef<PasteRequest | null>(null); // what was pasted, so another incident can re-analyze it
  const orgRepo = urlInit.guest ? null : urlInit.repo;
  const restoreRepo = useRef(orgRepo); // the share link's repo, selected when its report lands...
  const restoreOpen = useRef<OpenTab | null>(orgRepo ? urlInit.open : null); // ...with this drawer tab open
  // The share link's repo, said in a strip from the first paint: found (selected, path drawn), or not in this scenario.
  const [linked, setLinked] = useState<{ repo: string; found: boolean | null } | null>(orgRepo ? { repo: orgRepo, found: null } : null);
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
  const [settledAt, snapSettled] = useSettled(at, 1500, playback.playing); // what is announced about the clock follows this, not every step
  const rawSnapshot = at === null ? null : timeline.snapshot(at);
  const triage = useTriage();
  const analyze = useAnalyze();
  const { report } = triage;
  const running = triage.status === 'running';
  // The band collapses to one row from the click that starts a run, an analysis included (behind the sheet): a collapse when the
  // analysis ends, seconds later, would be a layout shift nobody asked for. It expands again when the sheet is closed.
  // Below 768px the sheet covers the whole page: the page behind it stays as it is (nothing moves under a sheet the person is
  // reading), and the band collapses when the sheet closes on the result, the moment the page changes anyway.
  // A share link that names an org repo runs its triage on load: it is laid out compact from the first paint, not collapsed after it.
  const [covered, setCovered] = useState(() => matchMedia('(max-width: 767px)').matches); // a sheet is full-screen here
  useEffect(() => {
    const mq = matchMedia('(max-width: 767px)');
    const on = () => setCovered(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const compact = triage.status !== 'idle' || orgRepo !== null || (analyze.status !== 'idle' && ((panel === 'paste' && !covered) || shared !== null));
  const landing = useExposureAt(scenario, report || stale ? null : rawSnapshot); // after a report the table has its own query

  const remediation = useRemediation(
    triage.incident?.id ?? scenario,
    useCallback((repo: string, why: string) => toast({ message: `Could not save ${repo} as remediated: ${why} It was reverted.`, tone: 'error' }), []),
  );

  // The one clock a run starts at, and the button that says so. The minute the person scrubbed to, else (a share link's
  // minute, else) this incident's last run, else its default. After the autoplay the playhead rests at the end of the story
  // (14:30): that is not a choice, so it does not move the run.
  const lastRunAt = triage.incident?.id === scenario ? triage.at : null;
  const clockFor = (scn: ScenarioId) => (scn === scenario ? (userAt ?? lastRunAt ?? (startAt !== null ? Math.floor(startAt / MIN) * MIN : null) ?? DEFAULT_AT[scn]) : DEFAULT_AT[scn]);
  const runClock = clockFor(scenario);
  // An alert typed in the "Describe an alert" box (not yet run): while it is there, every Run button runs it and says so.
  const [draft, setDraft] = useState('');
  const typedAlert = panel === 'alert' ? draft.trim() : '';
  const runLabel = typedAlert ? 'Run triage on this alert' : `Run triage at ${utcLabel(runClock)}`;

  // After a report, scrubbing re-queries the org graph at the new clock. Not for a pasted repo (its graph is its
  // own) and not when the scrubber now shows a different incident than the report.
  const isGuest = guest !== null || report?.scope?.kind === 'guest';
  const other = report && report.incident.id !== scenario ? report.incident.id : null;
  const wantAt = report && at !== null && !sameMinute(at, report.at) ? at : null;
  // The strip that says "showing exposure at X, run triage at X" is a live region whose button text carries X: it follows
  // the settled clock, so a scrub or the autoplay changes it once, when it stops, not on every minute.
  const settledWant = report && settledAt !== null && !sameMinute(settledAt, report.at) ? settledAt : null;
  const follow = !isGuest && !other && wantAt !== null;
  const live = useExposureQuery(scenario, follow ? wantAt : null, retry);
  const scrubbed = follow && live.data ? live.data : null;
  const incident = stale ? null : (report?.incident ?? timeline.incident);
  // One definition of "minutes ahead": a pasted repo's own, else advisory minus first exposure, else the server's figure.
  const minutesAhead = isGuest
    ? (report?.minutesAhead ?? null)
    : (aheadOf(report?.incident ?? null) ?? report?.minutesAhead ?? aheadOf(timeline.incident) ?? (timeline.incident ? minutesBetween(timeline.incident.firstPublishAt, timeline.incident.advisoryAt) : null));
  const view = report && { ...report, ...scrubbed, paths: scrubbed ? [] : report.paths, minutesAhead: minutesAhead ?? report.minutesAhead }; // paths describe the run's clock only
  const liveError = live.error && live.error.at === wantAt ? { message: live.error.message, fix: nextStep(live.error, 'exposure'), requestId: requestIdFor(live.error) } : null;
  // The report clock strip is a live region: it is fed the resting clock only, so a scrub changes it once, when it stops.
  const stripLoading = live.loadingAt !== null && settledWant !== null && sameMinute(live.loadingAt, settledWant);
  const stripViewAt = view ? (stripLoading || settledWant === null ? view.at : settledWant) : null;

  // The numbers in the band are the table's numbers (or, before a report, the scrubber's own sample): never a second source.
  // A run that failed has none: the band says so instead of keeping the timeline's sample as if it were a result.
  const failed = triage.status === 'error' && !report;
  const bandPoint: TimelinePoint | null = isGuest
    ? report
      ? { at: report.at, counts: report.counts, scanner: report.scanner.length }
      : null
    : view && !other
      ? { at: view.at, counts: view.counts, scanner: view.scanner.length }
      : rawSnapshot;
  // The label and size come from the report's own scope: the demo org ("Acme demo org · 21 repos") or the pasted repo.
  // A pasted repo also says which lockfile it was judged on (Report.scope.source): the commit before the incident, or a counterfactual.
  const sc = report?.scope;
  // Two lines in the compact band: what (the pasted repo, labelled as the file it is) and which lockfile.
  const guestName = sc?.label ?? guest?.repo ?? 'Pasted repo';
  const scope = isGuest
    ? sc?.source?.kind === 'head'
      ? `${guestName.replace(/@HEAD$/, '')}, pasted repo`
      : guestName.startsWith('pasted/')
        ? repoLabel(guestName)
        : `${repoLabel(guestName)}, pasted repo`
    : `${sc?.label ?? 'Acme demo org'}${sc ? ` · ${plural(sc.repos, 'repo')}` : ''}`;
  const scopeSource = isGuest ? lockSourceLabel(sc?.source) : null;

  // Scenario change: the previous run no longer describes this incident.
  useEffect(() => {
    setUserAt(null);
  }, [scenario]);
  // A free-text alert can name the other incident: the timeline follows it, opening at the run's clock (no autoplay over it).
  useEffect(() => {
    const id = triage.incident?.id;
    if (alertText !== null && id && id !== scenario && triage.at !== null) {
      setStartAt(triage.at);
      setScenario(id);
    }
  }, [triage.incident?.id]);
  // A new run aligns the scrubber with the run's clock, so every number on screen is true at the same time (and says so).
  useEffect(() => {
    if (triage.at === null) return;
    if (userAt !== null && at !== null && !sameMinute(at, triage.at) && !playback.playing && !stale) {
      toast({ message: `Scrubber moved from ${utcLabel(at)} to ${utcLabel(triage.at)}, the clock this triage ran at.` });
    }
    playback.seek(triage.at);
    snapSettled(triage.at); // the app moved it, not a person: no "the clock moved" while the run aligns it
  }, [triage.at]);
  // First exposure is selected when a report lands (or the share link's repo, with its drawer tab): the chain draws on straight away.
  useEffect(() => {
    if (!report) return;
    const want = restoreRepo.current;
    const tab = restoreOpen.current;
    restoreRepo.current = restoreOpen.current = null;
    const hit = want ? report.exposures.find((e) => e.repo === want || e.repo.startsWith(`${want}@`)) : undefined; // a pasted repo read at HEAD is "owner/name@HEAD"
    setSelected(hit?.repo ?? report.exposures[0]?.repo ?? null);
    if (hit && tab) setDrawer({ repo: hit.repo, tab });
    if (want && report.scope?.kind !== 'guest') {
      setLinked((l) => (l && l.repo === want ? { repo: want, found: !!hit } : l));
      // the linked row may sit far down the table: bring it into its pane (the page itself does not move)
      if (hit && !tab) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const row = document.querySelector('#exposures [aria-current="true"]')?.closest('tr');
            const pane = tableRef.current;
            if (row && pane && pane.scrollHeight > pane.clientHeight + 1) revealEl(row, 'nearest');
          }),
        );
      }
    }
  }, [report]);
  // A share link that names an org repo reopens its answer: the triage runs at the link's minute.
  const autoRan = useRef(false);
  useEffect(() => {
    if (orgRepo && !autoRan.current) {
      autoRan.current = true;
      void runAt(urlInit.at ?? undefined, null);
    }
  }, []);

  // Back closes the open drawer or sheet (the default dismiss gesture on a phone) instead of leaving the app.
  const sheet = panel === 'paste' || panel === 'stats';
  const closeSheet = () => {
    if (panel === 'paste' && analyze.status === 'running') analyze.reset(); // closing the sheet abandons the analysis it started
    setPanel('none');
  };
  useBackClose(drawer.repo !== null, () => setDrawer((d) => ({ ...d, repo: null })));
  useBackClose(sheet, closeSheet);
  useEffect(() => {
    // the autoplay would keep ticking behind a sheet nobody can see it through, or under an alert someone is typing
    if (sheet || panel === 'alert') playback.pause();
  }, [sheet, panel === 'alert']);
  // Hover tips (.tip) can be dismissed without moving the pointer (WCAG 1.4.13): Esc hides them until the pointer moves again.
  useEffect(() => {
    const root = document.documentElement;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && root.setAttribute('data-tips-off', '');
    const move = () => root.hasAttribute('data-tips-off') && root.removeAttribute('data-tips-off');
    addEventListener('keydown', key);
    addEventListener('pointermove', move);
    return () => (removeEventListener('keydown', key), removeEventListener('pointermove', move));
  }, []);

  /** Switch the visible pane (single-column layouts), bring it to the top of the screen (unless `scroll` is false: a share
   * link's strip must stay in view), and (from a tab press) move focus into it. */
  const showPane = (p: Pane, focus = false, scroll = true) => {
    if (focus) flushSync(() => setPane(p));
    else setPane(p);
    const target = p === 'feed' ? feedRef : p === 'table' ? tableRef : graphRef;
    if (!desktop()) {
      requestAnimationFrame(() => requestAnimationFrame(() => (scroll && panesRef.current?.scrollIntoView(), focus && target.current?.focus({ preventScroll: true }))));
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
  /** A repo picked by a person (table row, claim chip): select it, retire the hint, say so for screen readers (`say`: a claim
   * chip's own status line already says what it opened, so it picks quietly: one click, one sentence). */
  const pick = (repo: string, say = true) => {
    setSelected(repo);
    dismissHint();
    if (!say) return;
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

  /**
   * Every run starts here. The scrubber stops and goes to the run's clock at once (when it is known): a run that fails before
   * its first event must not leave the autoplay running behind its error, and one that works lands there anyway.
   */
  const runStarted = useRef(0);
  const startRun = (fn: () => void, clock?: number) => {
    setDrawer((d) => ({ ...d, repo: null }));
    setSelected(null);
    setTurnKey((k) => k + 1);
    // A share link's own run keeps the page where it is, so its strip ("Shared link: ... is not one of the 21 repos") is seen.
    showPane('feed', false, !restoreRepo.current);
    runStarted.current = performance.now();
    if (!restoreRepo.current) setLinked(null); // a run of its own: the share link's note no longer describes the screen
    // A new run starts a fresh set of follow-ups: the old answers go, and the screen says so instead of dropping them silently.
    const asked = triage.followUps.filter((f) => f.narration !== null).length;
    if (asked > 0 && triage.at !== null)
      toast({ message: `${plural(asked, 'follow-up')} from the ${utcLabel(triage.at)} run cleared: this run starts a fresh set of 4.`, ms: 6000 });
    if (clock === undefined) playback.pause();
    else {
      playback.seek(clock);
      snapSettled(clock);
    }
    fn();
  };
  // "Cancel run" takes the place of "Run again" under the pointer: the second click of a double click must not cancel the run it started.
  const cancelRun = () => {
    if (performance.now() - runStarted.current > 600) triage.abort();
  };
  // A run starts in the feed: keyboard focus lands there (where its progress and its verdict are), whichever button started it.
  // Before paint: the control that started it may unmount in the same commit (a share link's Re-check), and a passive effect
  // left one frame with the focus on <body>.
  useLayoutEffect(() => {
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
    const when = { at: clock ?? clockFor(scn) };
    startRun(() => triage.run(g ? { guest: g.graph, scenario: scn, ...when } : { scenario: scn, ...when }), when.at);
  };
  const runAlert = async (text: string) => {
    setAlertText(text);
    setGuest(null);
    guestReq.current = null;
    setPanel('none');
    await remediation.flush();
    startRun(() => triage.run({ alert: text }));
  };
  /** Analyze a pasted repo or lockfile for an incident, then triage it. The request is kept so another incident can re-run it. */
  const onAnalyze = async (req: PasteRequest, scn: ScenarioId = scenario, fromShare = false) => {
    const g = await analyze.analyze({ ...req, scenario: scn });
    if (g) {
      guestReq.current = req;
      setGuest({ ...g, scenario: scn });
      setPanel('none');
      setAlertText(null);
      if (fromShare) setSharedDone(true); // the share strip stays where it is (removing it moved the page), saying it is done
      else setShared(null);
      const at = clockFor(scn);
      startRun(() => triage.run({ guest: g.graph, scenario: scn, at }), at);
    }
  };
  /** The one action behind every Run button, Enter on a scenario and "Re-run to update": what is on screen, run again at the run clock. */
  const run = () => {
    if (typedAlert) return void runAlert(typedAlert);
    if (alertText !== null && !guest && choice === 'alert') return void runAlert(alertText);
    if (guestReq.current && guest?.scenario !== scenario) return void onAnalyze(guestReq.current, scenario); // a pasted repo is built per incident
    void runAt();
  };
  /** The share link's pasted repo: the one click that fetches it. Its result is then selected, with the link's drawer tab open. */
  const recheck = () => {
    if (!shared) return;
    restoreRepo.current = shared;
    restoreOpen.current = urlInit.open;
    void onAnalyze({ url: `https://github.com/${shared}` }, scenario, true);
  };

  /** Another incident. `rerun`: whatever was on screen (a report, a pasted repo) is run again for it; the timeline follows either way. */
  const switchTo = (v: ScenarioId, rerun: boolean) => {
    setStartAt(rerun ? DEFAULT_AT[v] : null); // a run opens the new track at its own clock instead of autoplaying over it
    setScenario(v);
    setChoice(v);
    setAlertText(null);
    setPanel((p) => (p === 'alert' ? 'none' : p));
    if (rerun) void (guestReq.current ? onAnalyze(guestReq.current, v) : runAt(undefined, null, v));
  };
  /** A click or Space on a segment: choose it, and (when there is a result on screen) run it for the new incident. */
  const onScenario = (v: ScenarioChoice) => {
    if (v === 'alert') {
      setChoice('alert');
      setPanel('alert');
    } else if (v !== scenario || choice === 'alert') switchTo(v, guestReq.current !== null || triage.status !== 'idle');
  };
  /** An arrow key: the selection moves (the timeline follows) and nothing runs, opens or takes focus. */
  const onMove = (v: ScenarioChoice) => {
    setChoice(v);
    if (v === 'alert') return;
    setPanel((p) => (p === 'alert' ? 'none' : p));
    if (v !== scenario) {
      setStartAt(null);
      setScenario(v);
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
      pick(repo, false);
      showPane('graph');
    }
  };

  const showFlagged = () => {
    showPane('feed');
    // on a laptop-height window the claim map is folded into the narrative's "Show ..." disclosure: open that first
    if (!document.getElementById('flagged-claims')) flushSync(() => document.querySelector<HTMLButtonElement>('section[aria-label="Narrative"] [data-narrative-more][aria-expanded="false"]')?.click());
    requestAnimationFrame(() => {
      const el = document.getElementById('flagged-claims');
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        scrollPaneTo(el);
        el.querySelector('summary')?.focus();
      }
    });
  };
  /** A tab under the table, opened from elsewhere: the Table pane first on a phone, then the tab pressed, focused and scrolled to. */
  const openInsight = (name: RegExp) => {
    flushSync(() => setPane('table'));
    const tab = [...document.querySelectorAll<HTMLElement>('#exposures [role="tab"]')].find((t) => name.test(t.textContent ?? ''));
    tab?.click();
    tab?.focus({ preventScroll: true });
    if (tab) scrollPaneTo(tab, 48);
  };
  /** "Built on FalkorDB": the Graph stats tab under the table after a triage; before one, the graph's own counts in a sheet. */
  const openStats = () => (report ? openInsight(/graph stats/i) : setPanel('stats'));
  // "Next qix?" under the verdict: the Concentration tab's first row, which it opens (a pasted repo has no such line).
  const nextText = report && !isGuest ? nextAccount(report) : null;
  const agentNext = report && nextText ? { label: nextLabel(report.incident), text: nextText, open: () => openInsight(/concentration/i) } : null;
  const skipToTable = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    flushSync(() => setPane('table'));
    tableRef.current?.focus();
  };

  // Phones: when the verdict arrives, bring it into view once the layout has settled (the band collapsed, the cards streamed).
  // Not under a share link's strip: it says what the link is about (or that its repo is not here), and it must be seen first.
  const hasNarration = triage.narration !== null;
  const linkedRef = useRef(linked);
  linkedRef.current = linked;
  useEffect(() => {
    if (!hasNarration || desktop() || paneRef.current !== 'feed' || linkedRef.current) return;
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
  const marked = view ? view.exposures.filter((e) => remediated[e.repo] !== undefined).length : 0;
  const inRun = new Set(report?.exposures.map((e) => e.repo));
  // exports describe the run, plus the marks made on this screen (some may still be inside the Undo window)
  const exported = report && { ...report, exposures: report.exposures.map((e) => (remediation.remediated[e.repo] ? { ...e, remediated: { at: remediation.remediated[e.repo]!, action: 'remediated' } } : e)) };
  const showHint = report !== null && !hintDismissed;
  const reveal = !stale && incident !== null && at !== null && at >= incident.advisoryAt; // the figure waits for the playhead to pass the OSV record
  // How the alert was read, never silently: the clock it used and how, that a zoneless time is UTC, which incident ran when
  // it names two (data/alertNote.ts). Every incident's names come from /api/scenarios, fetched once an alert has run.
  const [incidents, setIncidents] = useState<IncidentMeta[]>([]);
  useEffect(() => {
    if (alertText === null || incidents.length) return;
    const ctrl = new AbortController();
    getScenarios(ctrl.signal).then(setIncidents, () => {}); // without them the two-incident note is skipped, nothing else
    return () => ctrl.abort();
  }, [alertText]);
  const alertNote = alertText !== null && triage.incident && triage.at !== null ? alertNotes(alertText, { incident: triage.incident, at: triage.at }, incidents).join(' ') || null : null;

  /**
   * Share = the state: scenario, the minute on screen, the selected repo (and the drawer tab when one is open). A pasted
   * public repo is shared as `guest` (the link re-checks it on one click); a dropped lockfile has nothing to reopen: null.
   */
  const guestRepo = guestReq.current && 'url' in guestReq.current ? guestReq.current.url.replace(/^https:\/\/github\.com\//i, '') : null;
  const link = (repo: string | null = selected, open: OpenTab | null = null): string | null => {
    const base = { scenario: report?.incident.id ?? scenario, at: view?.at ?? at, open };
    const url = isGuest ? shareUrl(location.href, { ...base, guest: guestRepo }) : shareUrl(location.href, { ...base, repo });
    return isGuest && !new URL(url).searchParams.has('guest') ? null : url;
  };
  const share = () => {
    // what its creator sees: the repo selected with its path drawn (the drawer is a modal, so it is never open behind this
    // button; the drawer's own share link carries its tab)
    const url = link(selected, null);
    if (url) void copyText(url, 'Link');
    else toast({ message: NO_SHARE_LOCKFILE });
  };
  // The drawer is a modal dialog, so it reports and offers Undo itself; a toast would sit dimmed and inert under its scrim.
  const markRemediated = (repo: string) => remediation.mark(repo);

  const actions = (
    <div className="flex min-h-(--control-h) flex-wrap items-center gap-2">
      {/* one primary on screen: the alert box's own Run while it is open, the share strip's Re-check when there is one */}
      <Button variant={shared || panel === 'alert' ? 'secondary' : 'primary'} loading={running} onClick={run}>
        {runLabel}
      </Button>
      <Button onClick={() => switchTo(scenario === QIX ? AXIOS : QIX, true)}>{scenario === QIX ? 'Try axios 2026' : 'Try qix 2025'}</Button>
      <Button aria-haspopup="dialog" onClick={() => setPanel('paste')}>
        Paste your repo
      </Button>
    </div>
  );

  const paneClass = (p: Pane) => (pane === p ? '' : 'max-lg:hidden');
  const lastFollowUp = triage.followUps.at(-1);
  const skipLink =
    'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-(--z-modal) focus:rounded-sm focus:bg-bg-2 focus:px-3 focus:py-2';
  // The narrative dims a narration whose clock differs from the scrubber's and offers a re-run (ToolFeed hands both to
  // NarrativePanel). A spread, not named props, so this file compiles whichever side of the ToolFeed change it is built on.
  // `clockAt` is the resting clock: that line must not change on every step of a scrub or the autoplay, nor while a run aligns it.
  // `cypherHints`: what a tool derived inside its run (incident_exposure looks up the maintainer), for the runnable Cypher.
  const maintainer = (report?.incident ?? triage.incident)?.maintainer;
  // Each copied team notice ends with a link back to this run (the scenario and its clock; no repo, no drawer).
  const noticeLink = report && !isGuest ? link(null, null) : null;
  const feedExtra = { clockAt: settledAt ?? undefined, onRerun: run, onShowFlagged: showFlagged, guest: isGuest, cypherHints: maintainer ? { maintainer } : undefined, notices: report?.notices, noticeLink, onStatus: setFeedSaid };
  // "Back to 13:30 UTC" right after the slider in the tab order (the strip's own button is 30 stops away, in the Table pane):
  // shown when it has focus, like a skip link. It unmounts once the clock is back, so focus returns to the slider.
  const backToRun =
    report && settledWant !== null && !other ? (
      <button
        type="button"
        onClick={() => {
          setUserAt(report.at);
          playback.seek(report.at);
          snapSettled(report.at);
          document.querySelector<HTMLInputElement>('input[aria-label="Scenario time, UTC"]')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:right-2 focus:z-(--z-dropdown) focus:rounded-sm focus:bg-bg-2 focus:px-3 focus:py-1 focus:text-sm focus:text-fg-0"
      >
        Back to {utcLabel(report.at)}
      </button>
    ) : null;
  // What the mode badge means for this run: the badge's title and screen-reader text, not a line above the verdict.
  const modeNote =
    triage.narration === null
      ? undefined
      : `${
          triage.mode === 'live'
            ? 'Verdict from the graph · analyst pick by the LLM'
            : triage.mode === 'replay'
              ? 'Verdict from the graph · analyst pick replayed'
              : triage.mode === 'template'
                ? 'Verdict from the graph · no analyst pick'
                : 'Verdict from the graph · analyst pick pending'
        }${results.some((r) => r.cached) ? '. “cached” on a call: it reused an earlier read-only query' : ''}`;

  return (
    // Below 1024px (and 560px tall or more) the Ask bar is fixed above the tab bar while the Feed is shown: the page ends that much
    // higher, after the footer, so the last card and the footer clear it (a spacer inside the feed left the footer under it).
    <div className={`relative flex min-h-dvh flex-col pb-(--tabbar-h) lg:pb-0 xl:h-dvh xl:overflow-clip ${compact ? 'lg:h-dvh lg:overflow-clip' : ''} ${report && pane === 'feed' ? 'max-lg:[@media(min-height:560px)]:pb-[calc(var(--tabbar-h)+var(--ask-live))]' : ''}`}>
      {/* Tab order: skip link first, then (WCAG 2.2.2) the autoplay can be stopped before anything else. */}
      <a href="#results" className={skipLink}>
        Skip to results
      </a>
      {/* Always mounted: it flips its label instead of unmounting under the user's focus. */}
      <button type="button" disabled={first === null} onClick={playback.playing ? playback.pause : playback.play} className={skipLink}>
        {playback.playing ? 'Pause the autoplay' : 'Resume the autoplay'}
      </button>
      <Header
        scenario={choice}
        onScenario={onScenario}
        onMove={onMove}
        onRun={run}
        running={running}
        turnKey={turnKey}
        clockAt={failed ? null : view ? view.at : at}
        queryTotal={queryTotal}
        mode={triage.mode}
        modeNote={modeNote}
        guard={triage.guard}
        onShowFlagged={showFlagged}
        onOpenStats={openStats}
        onOpenPaste={() => setPanel('paste')}
        mock={isMock}
      />
      {/* The first stop after the header: the feed (17 tool cards) sits between the header and the table. */}
      <a href="#exposures" onClick={skipToTable} className={skipLink}>
        Skip to exposure table
      </a>
      {shared && <SharedPrompt repo={shared} scenario={scenario} analyze={analyze} done={sharedDone} onRecheck={recheck} onDismiss={() => setShared(null)} />}
      {linked && (
        <SharedRepoNote
          repo={linked.repo}
          found={linked.found}
          total={report?.scope?.repos ?? null}
          onShow={linked.found ? () => (pick(selected ?? linked.repo), showPane('graph', true)) : null}
          onDismiss={() => setLinked(null)}
        />
      )}
      {panel === 'alert' && (
        <section aria-label="Describe an alert" className="border-b border-line-1 bg-bg-1 px-(--gutter) py-4">
          <AlertField onRun={runAlert} onDraft={setDraft} disabled={running} />
        </section>
      )}
      {alertText && <AlertBanner text={alertText} pulseKey={turnKey} note={alertNote} />}
      <p role="status" className="sr-only">
        {announce}
      </p>
      <p role="status" className="sr-only">
        {feedSaid}
      </p>
      {/* what the report clock strip says when the clock moves: here, outside every pane, so it is spoken on a phone too
          (the strip itself sits in the Table pane, which is not rendered while the Feed is shown) */}
      <p role="status" className="sr-only">
        {report && view ? clockSaid({ runAt: report.at, viewAt: stripViewAt ?? view.at, wantAt: settledWant, loading: stripLoading, error: liveError, guest: isGuest, other }) : ''}
      </p>

      {/* Below 768px main is rebuilt, not collapsed in place, when the band changes mode (a run starts, or a pasted repo's sheet
          closes on its result: see `compact`): the page is laid out anew instead of everything on it jumping up. */}
      <main key={covered ? (compact ? 'report' : 'landing') : 'main'} id="results" tabIndex={-1} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-line-1">
          {!compact && <p className="max-w-(--measure) px-(--gutter) pt-3 text-base text-fg-1 max-sm:text-sm short:hidden">{PURPOSE}</p>}
          <div className={compact ? '' : 'grid short:grid-cols-2 xl:grid-cols-[4fr_6fr] min-[1440px]:grid-cols-[5fr_6fr]'}>
            <div className={compact ? '' : 'border-b border-line-1 short:border-r short:border-b-0 xl:border-r xl:border-b-0'}>
              {timeline.status === 'error' && timeline.error ? (
                <EmptyState
                  kind="error"
                  title="The timeline did not load"
                  cause={timeline.error.message}
                  fix={scenario === QIX ? 'Reload the page to try again.' : 'Pick the qix scenario to continue.'}
                  requestId={requestIdFor(timeline.error)}
                  action={scenario === QIX ? { label: 'Reload', onClick: () => location.reload() } : { label: 'Use qix', onClick: () => onScenario(QIX) }}
                />
              ) : (
                <TimelineScrubber
                  incident={timeline.incident}
                  points={timeline.points}
                  at={at ?? 0}
                  snapshot={failed ? null : bandPoint}
                  playing={playback.playing}
                  onPlay={playback.play}
                  onPause={playback.pause}
                  onSeek={(t) => (setUserAt(t), setStartAt(null), playback.seek(t))}
                  landingEnd={autoplayEnd}
                  compact={compact}
                  scope={scope}
                  scopeNote={isGuest ? null : shared ? `${DEMO_NOTE} Not the shared ${shared}: re-check it above.` : DEMO_NOTE}
                  scopeNoteShort={isGuest ? null : shared ? `demo org, not ${shared}` : DEMO_NOTE_SHORT}
                  scopeSource={scopeSource}
                  failed={failed}
                  remediated={marked}
                  stale={stale}
                  fixedCount={isGuest && report ? { exposed: report.counts.LOCKED + report.counts.WOULD_PULL, total: report.scope?.repos ?? 1, at: report.at } : null}
                  back={backToRun}
                  trailing={
                    // While a run streams the band's action stops it; after one, it runs again. A run that failed has its one
                    // action in the feed ("Run triage"), so the band offers none. Same width either way: nothing beside it moves.
                    failed ? null : running ? (
                      <Button variant="ghost" icon={<RadarIcon size={14} />} onClick={cancelRun} className="min-w-28 shrink-0 pl-2">
                        Cancel run
                      </Button>
                    ) : (
                      <Button icon={<span className="size-3.5" />} onClick={run} className="min-w-28 shrink-0 pl-2">
                        Run again
                      </Button>
                    )
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

        <div
          ref={panesRef}
          className={`grid min-h-0 flex-1 lg:grid-cols-[var(--pane-left)_minmax(0,1fr)] xl:grid-cols-[var(--pane-left)_minmax(0,1fr)_var(--pane-right)] xl:grid-rows-[minmax(0,1fr)] ${compact ? 'lg:grid-rows-[minmax(13rem,40%)_minmax(0,1fr)]' : 'lg:grid-rows-[minmax(340px,auto)_auto]'}`}
        >
          <section
            ref={feedRef}
            tabIndex={-1}
            aria-label="Tool feed"
            onClickCapture={(e) => {
              // Opening a tool call (or its Cypher) is "first use" too: retire the hint.
              if ((e.target as HTMLElement).closest('button[aria-expanded]')) dismissHint();
            }}
            // Below 1024px the Ask box is fixed above the tab bar: the page's own bottom padding keeps the last cards clear of it
            // (the root, above). From the click that starts a run the feed holds at least one screen, so the page never collapses
            // (and jumps back) while the run streams in.
            className={`scroll-pane border-line-1 bg-bg-1 p-3 fold:pt-2 lg:row-span-2 lg:border-r xl:row-span-1 xl:h-auto xl:min-h-0 ${compact ? 'max-lg:min-h-dvh lg:min-h-0' : 'lg:h-0 lg:min-h-full'} ${paneClass('feed')}`}
          >
            <AgentContext.Provider value={agentNext}>
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
                      rounds={triage.rounds}
                      example={isGuest ? null : askExample(report)}
                      suggestions={lastFollowUp?.narration?.suggestions}
                      error={lastFollowUp?.status === 'error' ? triage.error : null}
                      onAsk={(q) => triage.ask(q, Object.keys(remediated))}
                    />
                  )
                }
              />
            </AgentContext.Provider>
          </section>

          <div ref={graphRef} tabIndex={-1} className={`md:min-h-[420px] lg:col-start-2 lg:row-start-1 xl:h-full xl:min-h-0 ${compact ? 'lg:h-full lg:min-h-0' : 'lg:min-h-[340px]'} ${paneClass('graph')}`}>
            {/* a run that failed has no graph to show: the previous run's (or the scrubber's) would look like its result */}
            <PathGraph exposures={failed ? [] : graphExposures} paths={view?.paths ?? []} incident={incident} selectedRepo={selected} playing={playback.playing} onSelectRepo={pick} ran={report !== null} subject={isGuest ? repoLabel(guestName) : null} />
          </div>

          <section
            ref={tableRef}
            id="exposures"
            tabIndex={-1}
            aria-label="Exposure results"
            className={`scroll-pane border-line-1 bg-bg-1 lg:col-start-2 lg:row-start-2 lg:border-t xl:col-start-3 xl:row-start-1 xl:border-t-0 xl:border-l ${compact ? 'lg:min-h-0' : ''} ${paneClass('table')}`}
          >
            {!report && <h2 className="sr-only">Exposure results</h2>}
            {report && view ? (
              <>
                {showHint && <OnboardingHint onDismiss={() => (dismissHint(), tableRef.current?.focus({ preventScroll: true }))} />}
                <ReportClock
                  runAt={report.at}
                  viewAt={stripViewAt ?? view.at}
                  wantAt={settledWant}
                  loading={stripLoading}
                  error={liveError}
                  guest={isGuest}
                  head={guest !== null && isHead(guest.repo)}
                  other={other}
                  onBack={() => (setUserAt(report.at), playback.seek(report.at), snapSettled(report.at), tableRef.current?.focus({ preventScroll: true }))} // the strip unmounts: keep focus in the pane
                  onRerun={(t) => void runAt(t)}
                  onRetry={() => (setRetry((n) => n + 1), tableRef.current?.focus({ preventScroll: true }))}
                />
                <ExecSummary report={view} onShare={share} marked={marked} />
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
                  onExport={(f, view) => downloadReport(exported ?? report, f, view)}
                />
                <InsightTabs report={report} cards={triage.toolCards} graph={triage.graph} totalMs={triage.ms} remediated={remediated} />
              </>
            ) : (
              <EmptyState
                title="No exposures to show yet"
                cause="The table lists every repo that reaches a malicious version, with its tier, path and owner."
                fix={`${runLabel} above to fill it.`}
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

      <nav id="panels" aria-label="Panels" className="fixed inset-x-0 bottom-0 z-(--z-drawer) flex h-(--tabbar-h) border-t border-line-1 bg-bg-1 lg:hidden">
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

      <PasteBox open={panel === 'paste'} analyze={analyze} onAnalyze={(req) => void onAnalyze(req)} onClose={closeSheet} />
      <GraphStatsSheet open={panel === 'stats'} scenario={scenario} onClose={closeSheet} />

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
          onShare={async () => {
            const url = link(drawer.repo, drawer.tab);
            return url ? copyText(url, 'Link', true) : NO_SHARE_LOCKFILE;
          }}
        />
      )}
      <Toasts />
    </div>
  );
}
