/* App: the war room (docs/design.md sections 4 and 5). State wiring only; every pane is a component.
 *
 * Layout: header, optional alert row, the band, then the panes: tool feed | path graph | exposure table.
 * The band has two modes. Landing (nothing run yet): the purpose line, the scrubber with its counter, the contrast card
 * and the three actions. Report mode (from the click on Run triage, not from the report landing, so the layout change
 * happens inside the click and nothing shifts later): one compact row, so a laptop sees the table's header and its first
 * rows without scrolling. >= 1280px three panes in one viewport (panes scroll, the page does not); 1024-1279 feed left,
 * graph over table right; below 1024 one column with a bottom tab bar (Feed / Graph / Table) and the page scrolls.
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
 * Arrow keys on the scenario control only move the selection; running is a click, Enter or the Run button.
 *
 * Share links (data/urlState.ts): ?scenario&at, plus &repo (an org repo: the triage reruns at that minute, the row is
 * selected, and &open names the drawer tab) or &guest (a pasted public repo: NOT fetched on load, since a widely shared link
 * would spend the server's GitHub quota per visitor; a strip asks for one click, then analyses, triages, selects, opens).
 * A dropped lockfile has nothing to reopen, so it says so instead of copying a link that would open the demo org.
 *
 * Screen readers: one polite status region (selections). Nothing is announced while the autoplay runs; what the feed says
 * about the clock moving waits for the scrub to settle (useSettled, 600 ms).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { isMock } from './data/api.ts';
import { DEFAULT_AT, hasClock } from './data/clock.ts';
import { downloadReport } from './data/export.ts';
import { fixFor } from './data/errors.ts';
import { isHead, plural, utcLabel } from './data/format.ts';
import type { IncidentMeta, ScenarioId, TimelinePoint } from './data/types.ts';
import { useAnalyze } from './data/useAnalyze.ts';
import { useBackClose } from './data/useBackClose.ts';
import { usePlayback } from './data/usePlayback.ts';
import { useRemediation } from './data/useRemediation.ts';
import { useSettled } from './data/useSettled.ts';
import { useExposureAt, useExposureQuery, useTimeline } from './data/useTimeline.ts';
import { useTriage } from './data/useTriage.ts';
import { readUrlState, shareUrl, type OpenTab } from './data/urlState.ts';
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
import { OnboardingHint } from './components/OnboardingHint.tsx';
import { PasteBox, type PasteRequest } from './components/PasteBox.tsx';
import { PathGraph } from './components/PathGraph.tsx';
import { ReportClock } from './components/ReportClock.tsx';
import { scrollPaneTo } from './components/scrollPane.ts';
import { AlertBanner, AlertField, type ScenarioChoice } from './components/ScenarioControl.tsx';
import { SharedPrompt } from './components/SharedPrompt.tsx';
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
const aheadOf = (i: IncidentMeta | null) => (i?.firstExposureAt ? Math.floor((i.advisoryAt - i.firstExposureAt) / MIN) : null);
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
  const [drawer, setDrawer] = useState<{ repo: string | null; tab: DrawerTab }>({ repo: null, tab: 'fix' });
  const [userAt, setUserAt] = useState<number | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null); // the pasted repo the current run is about
  const [shared, setShared] = useState<string | null>(urlInit.guest); // a share link's pasted repo, waiting for its one click
  const [retry, setRetry] = useState(0);
  const [hintDismissed, setHintDismissed] = useState(readHint);
  const guestReq = useRef<PasteRequest | null>(null); // what was pasted, so another incident can re-analyze it
  const orgRepo = urlInit.guest ? null : urlInit.repo;
  const restoreRepo = useRef(orgRepo); // the share link's repo, selected when its report lands...
  const restoreOpen = useRef<OpenTab | null>(orgRepo ? urlInit.open : null); // ...with this drawer tab open
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
  const settledAt = useSettled(at, 600, playback.playing); // what is announced about the clock follows this, not every step
  const rawSnapshot = at === null ? null : timeline.snapshot(at);
  const triage = useTriage();
  const analyze = useAnalyze();
  const { report } = triage;
  const running = triage.status === 'running';
  // The band collapses to one row from the click that starts a run, an analysis included (behind the sheet): a collapse when the
  // analysis ends, seconds later, would be a layout shift nobody asked for. It expands again when the sheet is closed.
  const compact = triage.status !== 'idle' || (analyze.status !== 'idle' && (panel === 'paste' || shared !== null));
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
  const runLabel = `Run triage at ${utcLabel(runClock)}`;

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
    : (aheadOf(report?.incident ?? null) ?? report?.minutesAhead ?? aheadOf(timeline.incident) ?? (timeline.incident ? Math.floor((timeline.incident.advisoryAt - timeline.incident.firstPublishAt) / MIN) : null));
  const view = report && { ...report, ...scrubbed, paths: scrubbed ? [] : report.paths, minutesAhead: minutesAhead ?? report.minutesAhead }; // paths describe the run's clock only
  const liveError = live.error && live.error.at === wantAt ? { message: live.error.message, fix: fixFor(live.error, 'exposure'), requestId: live.error.requestId } : null;

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
  const sc = report?.scope;
  const scope = isGuest ? `${sc?.label ?? guest?.repo ?? 'Pasted repo'}, pasted repo` : `${sc?.label ?? 'Acme demo org'}${sc ? ` · ${plural(sc.repos, 'repo')}` : ''}`;

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
    if (at !== null && !sameMinute(at, triage.at) && !playback.playing && !stale) {
      toast({ message: `Scrubber moved from ${utcLabel(at)} to ${utcLabel(triage.at)}, the clock this triage ran at.` });
    }
    playback.seek(triage.at);
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
    if (sheet) playback.pause(); // the autoplay would keep ticking behind a sheet nobody can see it through
  }, [sheet]);

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
    const when = { at: clock ?? clockFor(scn) };
    startRun(() => triage.run(g ? { guest: g.graph, scenario: scn, ...when } : { scenario: scn, ...when }));
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
  const onAnalyze = async (req: PasteRequest, scn: ScenarioId = scenario) => {
    const g = await analyze.analyze({ ...req, scenario: scn });
    if (g) {
      guestReq.current = req;
      setGuest({ ...g, scenario: scn });
      setPanel('none');
      setAlertText(null);
      setShared(null);
      startRun(() => triage.run({ guest: g.graph, scenario: scn, at: clockFor(scn) }));
    }
  };
  /** The one action behind every Run button, Enter on a scenario and "Re-run to update": what is on screen, run again at the run clock. */
  const run = () => {
    if (alertText !== null && !guest && choice === 'alert') return void runAlert(alertText);
    if (guestReq.current && guest?.scenario !== scenario) return void onAnalyze(guestReq.current, scenario); // a pasted repo is built per incident
    void runAt();
  };
  /** The share link's pasted repo: the one click that fetches it. Its result is then selected, with the link's drawer tab open. */
  const recheck = () => {
    if (!shared) return;
    restoreRepo.current = shared;
    restoreOpen.current = urlInit.open;
    void onAnalyze({ url: `https://github.com/${shared}` });
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
  /** "Built on FalkorDB": the Graph stats tab under the table after a triage; before one, the graph's own counts in a sheet. */
  const openStats = () => {
    if (!report) return setPanel('stats');
    flushSync(() => setPane('table'));
    const tab = [...document.querySelectorAll<HTMLElement>('#exposures [role="tab"]')].find((t) => /graph stats/i.test(t.textContent ?? ''));
    tab?.click();
    tab?.focus({ preventScroll: true });
    if (tab) scrollPaneTo(tab, 48);
  };
  const skipToTable = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    flushSync(() => setPane('table'));
    tableRef.current?.focus();
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
  const marked = view ? view.exposures.filter((e) => remediated[e.repo] !== undefined).length : 0;
  const inRun = new Set(report?.exposures.map((e) => e.repo));
  // exports describe the run, plus the marks made on this screen (some may still be inside the Undo window)
  const exported = report && { ...report, exposures: report.exposures.map((e) => (remediation.remediated[e.repo] ? { ...e, remediated: { at: remediation.remediated[e.repo]!, action: 'remediated' } } : e)) };
  const showHint = report !== null && !hintDismissed;
  const reveal = !stale && incident !== null && at !== null && at >= incident.advisoryAt; // the figure waits for the playhead to pass the OSV record
  const alertNote =
    alertText !== null && !hasClock(alertText) && triage.at !== null
      ? `No time in the alert: using ${utcLabel(triage.at)}, the scenario default. Add one, like 13:16 UTC.`
      : null;

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
    const url = link();
    if (url) void copyText(url, 'Link');
    else toast({ message: NO_SHARE_LOCKFILE });
  };
  // The drawer is a modal dialog, so it reports and offers Undo itself; a toast would sit dimmed and inert under its scrim.
  const markRemediated = (repo: string) => remediation.mark(repo);

  const actions = (
    <div className="flex min-h-(--control-h) flex-wrap items-center gap-2">
      <Button variant={shared ? 'secondary' : 'primary'} loading={running} onClick={run}>
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
  // `clockAt` is the settled clock: that line is a live region and must not speak on every step of a scrub or the autoplay.
  const feedExtra = { clockAt: settledAt, onRerun: run, onShowFlagged: showFlagged };
  const verdictLine =
    triage.narration === null
      ? ''
      : triage.mode === 'live'
        ? 'Verdict from the graph · analyst pick by the LLM'
        : triage.mode === 'replay'
          ? 'Verdict from the graph · analyst pick replayed'
          : triage.mode === 'template'
            ? 'Verdict from the graph · no analyst pick'
            : 'Verdict from the graph · analyst pick pending';

  return (
    <div className="relative flex min-h-dvh flex-col pb-(--tabbar-h) lg:pb-0 xl:h-dvh xl:overflow-clip">
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
      {shared && <SharedPrompt repo={shared} scenario={scenario} analyze={analyze} onRecheck={recheck} onDismiss={() => setShared(null)} />}
      {panel === 'alert' && (
        <section aria-label="Describe an alert" className="border-b border-line-1 bg-bg-1 px-(--gutter) py-4">
          <AlertField onRun={runAlert} disabled={running} />
        </section>
      )}
      {alertText && <AlertBanner text={alertText} pulseKey={turnKey} note={alertNote} />}
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
                  snapshot={failed ? null : bandPoint}
                  playing={playback.playing}
                  onPlay={playback.play}
                  onPause={playback.pause}
                  onSeek={(t) => (setUserAt(t), setStartAt(null), playback.seek(t))}
                  landingEnd={autoplayEnd}
                  compact={compact}
                  scope={scope}
                  scopeNote={isGuest ? null : DEMO_NOTE}
                  scopeNoteShort={isGuest ? null : DEMO_NOTE_SHORT}
                  failed={failed}
                  remediated={marked}
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
              // Opening a tool call (or its Cypher) is "first use" too: retire the hint.
              if ((e.target as HTMLElement).closest('button[aria-expanded]')) dismissHint();
            }}
            // Below 1024px the Ask box is fixed above the tab bar: keep the last cards clear of it.
            className={`scroll-pane border-line-1 bg-bg-1 p-3 lg:row-span-2 lg:h-0 lg:min-h-full lg:border-r xl:row-span-1 xl:h-auto xl:min-h-0 ${report ? 'max-lg:pb-36' : ''} ${paneClass('feed')}`}
          >
            {/* Two lines reserved from the click on Run triage (the verdict line, and the cached note on a narrow pane), so what arrives
                later never pushes the cards down. */}
            {compact && (
              <aside aria-label="Narration mode" className="mb-2 min-h-9 text-xs text-fg-1">
                {verdictLine}
                {results.some((r) => r.cached) && <> <span className="block text-fg-2">“cached” on a call: reused an earlier read-only query</span></>}
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
            <PathGraph exposures={graphExposures} paths={view?.paths ?? []} incident={incident} selectedRepo={selected} playing={playback.playing} onSelectRepo={pick} ran={report !== null} subject={isGuest ? (report?.scope?.label ?? guest?.repo ?? null) : null} />
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
                {showHint && <OnboardingHint onDismiss={() => (dismissHint(), tableRef.current?.focus({ preventScroll: true }))} />}
                <ReportClock
                  runAt={report.at}
                  viewAt={view.at}
                  wantAt={settledWant}
                  loading={live.loadingAt !== null}
                  error={liveError}
                  guest={isGuest}
                  head={guest !== null && isHead(guest.repo)}
                  other={other}
                  onBack={() => (setUserAt(report.at), playback.seek(report.at), tableRef.current?.focus({ preventScroll: true }))} // the strip unmounts: keep focus in the pane
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
                  onExport={(f) => downloadReport(exported ?? report, f)}
                />
                <InsightTabs report={report} cards={triage.toolCards} graph={triage.graph} totalMs={triage.ms} remediated={remediated} />
              </>
            ) : (
              <EmptyState
                title="No exposures to show yet"
                cause="The table lists every repo that reaches a malicious version, with its tier, path and owner."
                fix="Run the triage to fill it."
                action={{ label: runLabel, onClick: run }}
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
