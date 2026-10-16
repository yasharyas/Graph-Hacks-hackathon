/* FixDrawer: the right drawer with Fix and Notice tabs (docs/design.md section 5). A native <dialog> opened with
 * showModal(): focus is trapped, Esc closes, the page is inert, and focus returns to the opener, all for free.
 * Slides in over --dur-slow with --ease-drawer (styles.css `dialog.drawer`); a full-screen sheet below 768px.
 * Props:
 *   repo             repo id to show; null closes the drawer (the last repo stays rendered during the exit)
 *   report           Report: exposures, paths, remediations, notices, scope
 *   tab, onTab       'fix' | 'notice'
 *   onClose
 *   remediatedAt     epoch ms when this repo was marked remediated, or null
 *   canUndo, onUndo(repo)   the parent still lets this mark be undone (it decides how long)
 *   onRemediate(repo)
 *   running, onCancelRun   "Cancel run" appears only while a triage is running
 *   onExport('md' | 'json') -> the downloaded file name (the whole report: the table's Export follows its filter, this does not);
 *   onShare() -> whether the link was copied, or why there is none
 * Header: the repo as words (data/repoLabel.ts: "owner/name (today's lockfile)", "your pasted lockfile (name)"), its tier and,
 * for the demo org only, its team (tagged demo). A pasted repo has no team: the server's placeholder is never shown.
 * Fix tab: which lockfile the repo was judged on (Report.scope.source), what that lockfile pins ("your lockfile pins
 * chalk@5.4.1: safe"; the first 3, malicious ones first, then "+N more"), then the Fix tab leads with what holds at the
 * SCENARIO CLOCK (data/export.ts fixToday, report.at: while the versions are live, keep npm ci on the lockfile, and a LOCKED
 * repo rotates secrets, then re-resolves, then rebuilds; past the removal, plain past tense), in the largest text of the tab.
 * What npm did later is its own "Today, in hindsight: ..." paragraph under it, never the lead. For a pasted repo judged on a
 * pre-incident snapshot, right under it comes the check against today's package.json (Remediation.today, data/todayCheck.ts):
 * "still matches" (the only state that gets the green tick), or each override or pin today's file does not need or would
 * downgrade, as the server wrote it. Only then what the fix was made for (fixScopeNote: the lockfile that was judged, as it
 * stood at the incident; today's lockfile and a pasted one say what they are instead). When the check says to skip a key, the
 * footer says so in a line right above the Copy button (readToday().advice, also the button's description). Then the package.json
 * snippet: the overrides AND each direct pin in the block it is declared in (dependencies / devDependencies), because npm
 * rejects an override that conflicts with a direct dependency. The snippet is valid JSON on its own and is what "Copy JSON"
 * copies (one copy button: the bar's); DIRECT_NOTE sits next to it always, because package.json usually has these blocks
 * already and JSON keeps only the last of two; fixPinsNote says what a version-qualified key reaches (every dependent whose
 * range admits that version, pinned to the clean release). Then the server's steps and PR body verbatim (nothing here
 * reorders or rewrites them); "More actions" copies those two. Notice tab: one Slack message for THIS repo, complete on its
 * own (data/export.ts slackMessage), whose Details link is a shareUrl (none for a dropped lockfile). Every untrusted string
 * renders as text. What the tier means is printed once, beside the chip in the header.
 * Footer, one row that never grows (plus the todayAdvice line on the Fix tab of a repo whose check says to skip a key): Copy (the
 * active tab), Mark remediated (or "Remediated" + Undo) and a "More actions" menu (copy steps, copy the PR description, copy the
 * whole team's notice for a demo-org repo, whole-report .md / .json, share link). The dialog is modal, so page toasts would sit
 * dimmed and inert under its scrim: every outcome (copied, exported, marked, undone) is reported by the polite status line
 * inside it, a pill over the foot of the body that goes after a few seconds.
 * "Mark remediated" and "Undo" are spoken by that status but drawn only from 768px up: below it the bar itself shows the change
 * (Remediated + Undo) and the pill would cover the snippet. Under 380px the Copy button's second word is for screen readers only,
 * so the bar (Copy, Remediated Undo, More actions) stays one row at 375px.
 * Focus: Mark remediated hands focus to Undo, Undo hands it back to Mark remediated (the button that replaces it), so it
 * is never dropped on the page behind the dialog. In a short window (a phone held sideways) the header and footer are
 * compact so the body keeps most of the height.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { detailsLink, DIRECT_NOTE, fixJson, fixPinsNote, fixScopeNote, fixToday, lockedOf, pinTargets, readToday, slackMessage, stepsText } from '../data/export.ts';
import { utcStamp } from '../data/format.ts';
import { lockNote, realTeam, repoLabel } from '../data/repoLabel.ts';
import type { Report } from '../data/types.ts';
import { Button, IconButton } from './Button.tsx';
import { copyText } from './copy.ts';
import { Check, CircleAlert, Close, Copy, Download, LinkIcon } from './icons/Glyphs.tsx';
import { IconFrame } from './icons/IconFrame.tsx';
import { PathChain, PathChip } from './PathChip.tsx';
import { TIER_SUBTITLE, TierChip } from './TierChip.tsx';

export type DrawerTab = 'fix' | 'notice';

export interface FixDrawerProps {
  repo: string | null;
  report: Report;
  tab: DrawerTab;
  onTab: (t: DrawerTab) => void;
  onClose: () => void;
  remediatedAt: number | null;
  canUndo: boolean;
  onUndo: (repo: string) => void;
  onRemediate: (repo: string) => void;
  running: boolean;
  onCancelRun: () => void;
  onExport: (format: 'md' | 'json') => string;
  onShare: () => Promise<boolean | string>;
}

const Block = ({ text }: { text: string }) => (
  <pre className="rounded-xs bg-bg-3 p-3 text-xs leading-[18px] whitespace-pre-wrap text-fg-0 select-all [overflow-wrap:anywhere]">
    <code>{text}</code>
  </pre>
);

const Dots = () => (
  <IconFrame size={16}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </IconFrame>
);

const menuItem = 'flex min-h-(--control-h) w-full items-center gap-2 rounded-xs px-3 text-left text-base text-fg-0 hov:bg-bg-3';

const PINS = 3; // lockfile pins shown before "+N more": a repo with 16 of them would push the fix below the fold
const NOTE_MS = 4000; // how long the floating status stays on screen

export function FixDrawer({ repo, report, tab, onTab, onClose, remediatedAt, canUndo, onUndo, onRemediate, running, onCancelRun, onExport, onShare }: FixDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const markRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const handoff = useRef<'undo' | 'mark' | null>(null); // which button focus is owed to once the parent has swapped them
  const hadUndo = useRef<{ repo: string | null; canUndo: boolean }>({ repo: null, canUndo: false });
  const [note, setNote] = useState({ text: '', n: 0, quiet: false }); // `n` tells two identical messages apart, so the second one restarts the clock; `quiet`: spoken, and drawn only from 768px up (the bar already shows the change)
  const [menu, setMenu] = useState(false);
  const [allPins, setAllPins] = useState(false);
  const say = (text: string, quiet = false) => setNote((s) => ({ text, n: s.n + 1, quiet }));
  const shown = useRef<string | null>(repo);
  if (repo) shown.current = repo; // keep the content on screen while the exit transition runs
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (repo && !d.open) d.showModal();
    else if (!repo && d.open) d.close();
    say(''); // a new repo or a closed drawer starts with a clean status line
    setMenu(false);
    setAllPins(false);
    handoff.current = null;
  }, [repo]);
  // The status floats over the foot of the body (the bar stays one row) and goes by itself: a message that stayed would hide the snippet's last lines.
  useEffect(() => {
    if (!note.text) return;
    const t = setTimeout(() => setNote((s) => (s.n === note.n ? { text: '', n: s.n, quiet: false } : s)), NOTE_MS);
    return () => clearTimeout(t);
  }, [note]);
  // "Mark remediated" unmounts the button that had focus and "Undo" unmounts its own: each hands focus to the button that
  // replaces it, so it never falls to the page behind the dialog.
  useEffect(() => {
    if (handoff.current === 'undo' && canUndo) undoRef.current?.focus();
    else if (handoff.current === 'mark' && remediatedAt === null) markRef.current?.focus();
    else return;
    handoff.current = null;
  }, [canUndo, remediatedAt]);
  // The parent ends an Undo window without a sound: say so, once, for the repo on screen.
  useEffect(() => {
    const was = hadUndo.current;
    if (was.repo === repo && was.canUndo && !canUndo && remediatedAt !== null) say('Saved for this session. Undo is no longer available.');
    hadUndo.current = { repo, canUndo };
  }, [repo, canUndo, remediatedAt]);
  // The menu closes on a press outside it; Escape closes it before it closes the dialog (see onCancel).
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !moreRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [menu]);

  const r = shown.current;
  const exposure = report.exposures.find((e) => e.repo === r);
  const paths = report.paths.filter((p) => p.repo === r);
  const path = paths[0];
  const fix = report.remediations.find((f) => f.repo === r);
  const guest = report.scope?.kind === 'guest'; // a pasted repo: no owning team, no demo org
  const team = realTeam(exposure?.team);
  const notice = guest ? undefined : report.notices.find((n) => n.team === exposure?.team);
  const lock = r ? lockNote(report.scope?.source, r) : null;
  const bad = new Set(report.incident.versions.map((v) => v.id));
  const snippet = fix ? fixJson(fix) : '';
  const blocks = fix ? [fix.direct && Object.keys(fix.direct).length && 'dependencies', fix.devDirect && Object.keys(fix.devDirect).length && 'devDependencies', 'overrides'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1') : '';
  // What the snippet was made for, what it pins and what is true today: said before the snippet can be copied (data/export.ts)
  const scopeNote = fix ? fixScopeNote(fix, undefined, lock?.kind) : '';
  const today = fix && exposure ? fixToday(report.incident, exposure.tier, report.at) : null; // as of the scenario clock; the removal is a separate "in hindsight" line
  const { check, advice } = readToday(fix); // a pasted repo's fix, read against today's package.json; `advice` goes beside the Copy button: what to leave out of the snippet
  const pinsNote = fix ? fixPinsNote(fix.overrides) : null;
  const steps = fix ? stepsText(fix) : ''; // what "Copy steps" copies: the skip notes first, then the numbered steps
  const slack = exposure ? slackMessage({ exposure, paths, fix, incident: report.incident, at: report.at, anonymous: guest, source: report.scope?.source, link: detailsLink(location.href, report, exposure.repo, 'notice') }) : '';
  const copyWhat = async (text: string, what: string) => say((await copyText(text, what, true)) ? `${what} copied` : `Clipboard blocked. Select the ${what.toLowerCase()} text and copy it manually.`);
  // malicious pins first: they are what the reader must not miss, and what survives the cut
  const pinned = exposure ? [...lockedOf(exposure)].sort((a, b) => Number(bad.has(b)) - Number(bad.has(a))) : [];
  const pickTab = (t: DrawerTab) => (say(''), onTab(t)); // "package.json snippet copied" is about the Fix tab: it does not follow to Notice

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onCancel={(e) => {
        if (!menu) return;
        e.preventDefault(); // Escape closes the open menu first, not the whole drawer
        setMenu(false);
        moreRef.current?.focus();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {r && exposure && (
        <div className="flex h-full flex-col">
          <div className="flex items-start gap-3 border-b border-line-1 p-4 [@media(max-height:500px)]:items-center [@media(max-height:500px)]:p-2 [@media(max-height:500px)]:pl-4">
            <div className="min-w-0 flex-1 [@media(max-height:500px)]:flex [@media(max-height:500px)]:flex-wrap [@media(max-height:500px)]:items-center [@media(max-height:500px)]:gap-x-3">
              <h2 id={`${id}-title`} className="font-display text-xl font-extrabold break-words text-fg-0 [@media(max-height:500px)]:text-lg">
                {repoLabel(r)}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 [@media(max-height:500px)]:mt-0">
                {/* what the tier means sits right beside it, once (not again in the body); a short window drops the gloss */}
                <TierChip tier={exposure.tier} dev={exposure.dev} />
                {/* aria-hidden: the chip already carries these words for a screen reader */}
                <span aria-hidden className="text-xs text-fg-1 [@media(max-height:500px)]:hidden">
                  {TIER_SUBTITLE[exposure.tier]}
                </span>
                {team && <span className="text-xs text-fg-1">Team {team} (demo)</span>}
                {exposure.synthetic && <span className="text-xs text-fg-2">sample repo</span>}
              </div>
            </div>
            <IconButton label="Close" icon={<Close size={20} />} onClick={onClose} />
          </div>

          <div className="scroll-pane min-h-0 flex-1 p-4 [@media(max-height:500px)]:p-3">
            {lock && (
              <p className="mb-3 text-sm text-fg-1">
                {lock.counterfactual && <span className="mr-2 rounded-xs bg-bg-3 px-1.5 py-0.5 font-mono text-xs font-medium text-fg-0">COUNTERFACTUAL</span>}
                {lock.text}
              </p>
            )}
            {path && (
              <div className="mb-4">
                <h3 className="label-caps mb-1.5 text-xs">Path {path.id}</h3>
                <PathChain path={path} badVersions={bad} />
              </div>
            )}
            {pinned.length > 0 && (
              <div className="mb-4">
                <h3 className="label-caps mb-1.5 text-xs">Your lockfile pins</h3>
                <ul className="flex flex-col gap-1.5 text-sm text-fg-0">
                  {(allPins ? pinned : pinned.slice(0, PINS)).map((p) => (
                    <li key={p} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <PathChip item={p} bad={bad.has(p)} />
                      <span className="inline-flex items-center gap-1 text-fg-1">
                        {bad.has(p) ? (
                          'a malicious version: npm ci installed it'
                        ) : (
                          <>
                            <Check size={14} className="text-tier-clean" /> safe: npm ci installs exactly this
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {pinned.length > PINS && (
                  <button
                    type="button"
                    aria-expanded={allPins}
                    onClick={() => setAllPins((a) => !a)}
                    className="mt-1.5 rounded-xs text-xs text-fg-1 underline underline-offset-2 pointer-coarse:min-h-11 hov:text-fg-0"
                  >
                    {allPins ? `Show the first ${PINS} pins` : `+${pinned.length - PINS} more`}
                  </button>
                )}
              </div>
            )}

            <div role="tablist" aria-label="Drawer" className="mb-3 flex gap-1 border-b border-line-1">
              {(['fix', 'notice'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  id={`${id}-${t}`}
                  aria-selected={tab === t}
                  aria-controls={tab === t ? `${id}-panel` : undefined} // one panel, labelled by the selected tab: the other tab controls nothing yet
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => pickTab(t)}
                  onKeyDown={(e) => {
                    // two tabs: the arrows swap them, Home and End pick the first and the last
                    const to = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? (t === 'fix' ? 'notice' : 'fix') : e.key === 'Home' ? 'fix' : e.key === 'End' ? 'notice' : null;
                    if (!to) return;
                    e.preventDefault();
                    pickTab(to);
                    document.getElementById(`${id}-${to}`)?.focus();
                  }}
                  // forced colors: the selected tab gets a Highlight underline and bold text, the other has no underline at all
                  className={`-mb-px border-b-2 px-3 py-2 text-base pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${tab === t ? 'border-fg-0 text-fg-0 forced-colors:border-b-[Highlight] forced-colors:font-bold' : 'border-transparent text-fg-1 forced-colors:border-b-[Canvas]'}`}
                >
                  {t === 'fix' ? 'Fix' : 'Notice'}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="flex flex-col gap-3 text-sm">
              {tab === 'fix' &&
                (fix ? (
                  <>
                    {/* The tab opens with what is true today (is there anything to do now?), then how today's package.json compares
                        with the fix (Remediation.today, pasted repos only), and only then what the snippet was made for. */}
                    <div className="flex flex-col gap-3 rounded-xs border border-line-2 bg-bg-2 p-3 text-fg-0">
                      <p className="text-base leading-6 font-medium">{today?.lead}</p>
                      {/* a later fact (the clock is before npm removed the versions) is its own paragraph, labelled in its own words */}
                      {today?.hindsight && <p className="text-sm text-fg-1">{today.hindsight}</p>}
                      {check?.status === 'match' && (
                        <p className="flex items-start gap-2 text-sm">
                          <Check size={16} className="mt-0.5 shrink-0 text-tier-clean" />
                          {check.notes.join(' ')}
                        </p>
                      )}
                      {check?.status === 'differs' && (
                        <div className="flex flex-col gap-1.5 border-t border-line-2 pt-3">
                          <h3 className="label-caps text-xs">Checked against today's package.json</h3>
                          <ul className="flex flex-col gap-1.5 text-sm">
                            {check.notes.map((n) => (
                              <li key={n} className="flex items-start gap-2">
                                <CircleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
                                {n}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-fg-1">{scopeNote}</p>
                    <h3 className="label-caps text-xs">
                      package.json: <span className="normal-case">{blocks}</span>
                    </h3>
                    <p className="text-xs text-fg-1">{DIRECT_NOTE}</p>
                    <Block text={snippet} />
                    {pinsNote && <p className="text-xs text-fg-1">{pinsNote}</p>}
                    {pinTargets(fix.overrides).length > 0 && <p className="text-xs text-fg-1">Pins: <span className="font-mono">{pinTargets(fix.overrides).join(', ')}</span></p>}
                    <h3 className="label-caps text-xs">Steps</h3>
                    <ol className="list-decimal pl-5 text-fg-0">
                      {fix.steps.map((s, i) => (
                        <li key={i} className="mb-1">
                          {s}
                        </li>
                      ))}
                    </ol>
                    <h3 className="label-caps text-xs">Pull request body</h3>
                    <p className="text-fg-0">{fix.prBody}</p>
                  </>
                ) : (
                  <p className="text-fg-1">
                    {exposure.tier === 'MAINTAINER'
                      ? 'Nothing to fix yet: no malicious version is known for the packages this repo takes from the compromised account. Watch for new advisories.'
                      : `No fix was drafted for this repo. Each run drafts a path and a fix for its top ${report.remediations.length || 5} exposures only. Ask a follow-up about this repo to get its path.`}
                  </p>
                ))}
              {tab === 'notice' && (
                <>
                  <p className="text-fg-1">
                    {guest ? (
                      'A message you can paste to your own team (draft only, nothing is sent). It names this repo only.'
                    ) : notice ? (
                      <>
                        For <span className="text-fg-0">{notice.team}</span> in <span className="font-mono text-xs text-fg-0">{notice.channel}</span> (demo team; draft only, nothing is sent). It names this
                        repo only.
                      </>
                    ) : (
                      'No owning team is mapped for this repo (draft only, nothing is sent). It names this repo only.'
                    )}
                  </p>
                  <Block text={slack} />
                </>
              )}
            </div>
          </div>

          <div className="relative flex flex-col gap-2 border-t border-line-1 p-4 [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:p-2 [@media(max-height:500px)]:pl-4">
            {/* The status floats over the foot of the body at every size, so "copied" or "marked" never adds a row to the bar,
                and goes by itself after a few seconds: the snippet's last lines are never covered for good. */}
            <p
              role="status"
              className={`absolute inset-x-4 bottom-full z-10 mb-2 rounded-xs border border-line-2 bg-bg-3 px-3 py-2 text-xs text-fg-0 shadow-popover empty:hidden [@media(max-height:500px)]:inset-x-2 [@media(max-height:500px)]:mb-1 [@media(max-height:500px)]:py-1 ${note.quiet ? 'max-md:sr-only' : ''}`}
            >
              {note.text}
            </p>
            {/* right above the button: a key the snippet holds that today's package.json does not need (Remediation.today) */}
            {tab === 'fix' && advice && (
              <p id={`${id}-advice`} className="flex items-start gap-1.5 text-xs leading-4 font-medium text-fg-0">
                <CircleAlert size={14} className="mt-px shrink-0 text-warn" />
                {advice}
              </p>
            )}
            <div className="relative flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                className="px-3"
                icon={<Copy size={16} />}
                aria-describedby={tab === 'fix' && advice ? `${id}-advice` : undefined}
                disabled={tab === 'fix' ? !fix : !slack}
                onClick={() => void (tab === 'fix' ? copyWhat(snippet, 'package.json snippet') : copyWhat(slack, 'Slack message'))}
              >
                {/* under 380px the bar keeps to one row (with Remediated + Undo and the menu): the second word is for screen readers there */}
                Copy<span className="max-[379px]:sr-only"> {tab === 'fix' ? 'JSON' : 'message'}</span>
              </Button>
              {remediatedAt !== null ? (
                <span className="inline-flex items-center gap-1 text-sm text-tier-clean">
                  <Check size={16} />
                  {/* the stamp is in the name and the tooltip; the bar has no room to print the date and a zone */}
                  <span title={`Marked remediated ${utcStamp(remediatedAt)}`}>
                    Remediated<span className="sr-only"> {utcStamp(remediatedAt)}</span>
                  </span>
                  {canUndo && (
                    <button
                      ref={undoRef}
                      type="button"
                      className="inline-flex min-h-(--control-h) min-w-(--control-h) items-center justify-center rounded-xs text-link underline underline-offset-2"
                      onClick={() => ((handoff.current = 'mark'), onUndo(r), say('Undone: not marked remediated', true))}
                    >
                      Undo
                    </button>
                  )}
                </span>
              ) : (
                <Button ref={markRef} className="px-3" onClick={() => ((handoff.current = 'undo'), onRemediate(r), say('Marked remediated. You can undo it here.', true))}>
                  Mark remediated
                </Button>
              )}
              <IconButton ref={moreRef} label="More actions" aria-expanded={menu} aria-controls={menu ? `${id}-menu` : undefined} icon={<Dots />} onClick={() => setMenu((m) => !m)} />
              {menu && (
                <div
                  ref={menuRef}
                  id={`${id}-menu`}
                  role="group"
                  aria-label="More actions"
                  className="absolute right-0 bottom-full z-(--z-dropdown) mb-2 w-64 origin-bottom-right animate-enter rounded-sm border border-line-2 bg-bg-2 p-1 shadow-popover"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget !== moreRef.current) setMenu(false);
                  }}
                >
                  {fix && (
                    <>
                      <button type="button" className={menuItem} onClick={() => (void copyWhat(steps, 'Steps'), setMenu(false), moreRef.current?.focus())}>
                        <Copy size={16} /> Copy steps
                      </button>
                      <button type="button" className={menuItem} onClick={() => (void copyWhat(fix.prBody, 'PR description'), setMenu(false), moreRef.current?.focus())}>
                        <Copy size={16} /> Copy PR description
                      </button>
                    </>
                  )}
                  {/* the whole team's message (every repo the team owns), where the Notice tab above is this repo's alone */}
                  {notice && (
                    <button type="button" className={menuItem} onClick={() => (void copyWhat(notice.text, `${notice.team} notice`), setMenu(false), moreRef.current?.focus())}>
                      <Copy size={16} /> Copy the team's notice
                    </button>
                  )}
                  <button type="button" className={menuItem} onClick={() => (say(`Exported ${onExport('md')}`), setMenu(false), moreRef.current?.focus())}>
                    <Download size={16} /> Whole report (.md)
                  </button>
                  <button type="button" className={menuItem} onClick={() => (say(`Exported ${onExport('json')}`), setMenu(false), moreRef.current?.focus())}>
                    <Download size={16} /> Whole report (.json)
                  </button>
                  <button
                    type="button"
                    className={menuItem}
                    onClick={async () => {
                      const r = await onShare();
                      say(typeof r === 'string' ? r : r ? 'Link copied' : 'Clipboard blocked. Copy the address from the browser bar.');
                      setMenu(false);
                      moreRef.current?.focus();
                    }}
                  >
                    <LinkIcon size={16} /> Copy share link
                  </button>
                </div>
              )}
            </div>
            {/* its own line: as a fourth button it wrapped under the footer and peeked out below the drawer */}
            {running && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-1">
                A triage is running.
                <button type="button" className="rounded-xs text-link underline underline-offset-2 pointer-coarse:min-h-11" onClick={onCancelRun}>
                  Cancel run
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
