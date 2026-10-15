/* FixDrawer: the right drawer with Fix and Notice tabs (docs/design.md section 5). A native <dialog> opened with
 * showModal(): focus is trapped, Esc closes, the page is inert, and focus returns to the opener, all for free.
 * Slides in over --dur-slow with --ease-drawer (styles.css `dialog.drawer`); a full-screen sheet below 768px.
 * Props:
 *   repo             repo id to show; null closes the drawer (the last repo stays rendered during the exit)
 *   report           Report: exposures, paths, remediations, notices
 *   tab, onTab       'fix' | 'notice'
 *   onClose
 *   remediatedAt     epoch ms when this repo was marked remediated, or null
 *   canUndo, onUndo(repo)   the mark is still inside its 10 s Undo window
 *   onRemediate(repo)
 *   running, onCancelRun   "Cancel run" appears only while a triage is running
 *   onExport('md' | 'json') -> the downloaded file name; onShare() -> whether the link was copied, or why there is none
 * Fix tab: what the lockfile pins ("your lockfile pins chalk@5.4.1: safe", from Exposure.locked; the first 3, malicious
 * ones first, then "+N more"), then the package.json snippet: the overrides AND, when the repo declares the package
 * itself, the direct pins (Remediation.direct), because npm rejects an override that conflicts with a direct dependency;
 * the snippet works when pasted alone. Then the server's steps and PR body verbatim (the server writes version-qualified
 * keys and puts "npm ci from the committed lockfile" first: nothing here reorders or rewrites them). Notice tab: one
 * Slack message for THIS repo, complete on its own (data/export.ts slackMessage), whose Details link is a shareUrl
 * (the repo, or the pasted repo; none for a dropped lockfile). Every untrusted string renders as text.
 * Footer, one row: Copy (the active tab), Mark remediated (+ Undo), and a "More actions" menu (whole-report .md / .json,
 * share link). The dialog is modal, so page toasts would sit dimmed and inert under its scrim: every outcome (copied,
 * exported, marked, undone) is reported by the polite status line inside it. Buttons are named by their visible text.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { detailsLink, DIRECT_NOTE, fixJson, hasDirect, lockedOf, pinTargets, slackMessage } from '../data/export.ts';
import { localStamp } from '../data/clock.ts';
import { HEAD_NOTE, isHead } from '../data/format.ts';
import type { Report } from '../data/types.ts';
import { Button, IconButton } from './Button.tsx';
import { copyText } from './copy.ts';
import { Check, Close, Copy, Download, LinkIcon } from './icons/Glyphs.tsx';
import { IconFrame } from './icons/IconFrame.tsx';
import { PathChain, PathChip } from './PathChip.tsx';
import { HONEST_SEMANTICS, TierChip } from './TierChip.tsx';

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

export function FixDrawer({ repo, report, tab, onTab, onClose, remediatedAt, canUndo, onUndo, onRemediate, running, onCancelRun, onExport, onShare }: FixDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState(false);
  const [allPins, setAllPins] = useState(false);
  const say = (text: string) => setNote(text);
  const shown = useRef<string | null>(repo);
  if (repo) shown.current = repo; // keep the content on screen while the exit transition runs
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (repo && !d.open) d.showModal();
    else if (!repo && d.open) d.close();
    setNote(''); // a new repo or a closed drawer starts with a clean status line
    setMenu(false);
    setAllPins(false);
  }, [repo]);
  // "Mark remediated" unmounts the button that had focus: land on Undo, the next thing a person might want.
  useEffect(() => {
    if (canUndo) undoRef.current?.focus();
  }, [canUndo]);
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
  const notice = report.notices.find((n) => n.team === exposure?.team);
  const bad = new Set(report.incident.versions.map((v) => v.id));
  const snippet = fix ? fixJson(fix) : '';
  const direct = fix ? hasDirect(fix) : false;
  const qualified = fix ? Object.keys(fix.overrides).some((k) => k.lastIndexOf('@') > 0) : false;
  const fixText = fix ? `${direct ? `${DIRECT_NOTE}\n` : ''}${snippet}\n\n${fix.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${fix.prBody}` : '';
  const slack = exposure ? slackMessage({ exposure, paths, fix, incident: report.incident, at: report.at, link: detailsLink(location.href, report, exposure.repo, 'notice') }) : '';
  const copyLabel = tab === 'fix' ? 'Fix' : 'Slack message';
  const copyBody = tab === 'fix' ? fixText : slack;
  const copy = async () => say((await copyText(copyBody, copyLabel, true)) ? `${copyLabel} copied` : `Clipboard blocked. Select the ${copyLabel.toLowerCase()} text above and copy it manually.`);
  // malicious pins first: they are what the reader must not miss, and what survives the cut
  const pinned = exposure ? [...lockedOf(exposure)].sort((a, b) => Number(bad.has(b)) - Number(bad.has(a))) : [];

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
          <div className="flex items-start gap-3 border-b border-line-1 p-4">
            <div className="min-w-0 flex-1">
              <h2 id={`${id}-title`} className="font-display text-xl font-extrabold break-words text-fg-0">
                {r}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <TierChip tier={exposure.tier} dev={exposure.dev} showSubtitle />
                {exposure.team && <span className="text-xs text-fg-1">Team {exposure.team}</span>}
                {exposure.synthetic && <span className="text-xs text-fg-2">sample repo</span>}
              </div>
            </div>
            <IconButton label="Close" icon={<Close size={20} />} onClick={onClose} />
          </div>

          <div className="scroll-pane flex-1 p-4">
            {exposure.tier === 'WOULD_PULL' && <p className="mb-3 text-sm text-fg-1">{HONEST_SEMANTICS}</p>}
            {isHead(r) && (
              <p className="mb-3 text-sm text-fg-1">
                <span className="mr-2 rounded-xs bg-bg-3 px-1.5 py-0.5 font-mono text-xs font-medium text-fg-0">COUNTERFACTUAL</span>
                {HEAD_NOTE}
              </p>
            )}
            {path && (
              <div className="mb-4">
                <p className="label-caps text-xs mb-1.5">Path {path.id}</p>
                <PathChain path={path} badVersions={bad} />
              </div>
            )}
            {pinned.length > 0 && (
              <div className="mb-4">
                <p className="label-caps text-xs mb-1.5">Your lockfile pins</p>
                <ul className="flex flex-col gap-1.5 text-sm text-fg-0">
                  {(allPins ? pinned : pinned.slice(0, PINS)).map((p) => (
                    <li key={p} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <PathChip item={p} bad={bad.has(p)} />
                      <span className="inline-flex items-center gap-1 text-fg-1">
                        {bad.has(p) ? (
                          'a malicious version: npm ci installs it'
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
                  aria-controls={`${id}-panel`}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => onTab(t)}
                  onKeyDown={(e) => {
                    // two tabs: the arrows swap them, Home and End pick the first and the last
                    const to = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? (t === 'fix' ? 'notice' : 'fix') : e.key === 'Home' ? 'fix' : e.key === 'End' ? 'notice' : null;
                    if (!to) return;
                    e.preventDefault();
                    onTab(to);
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
                    <p className="label-caps text-xs">{direct ? 'package.json: dependencies and overrides' : 'package.json overrides'}</p>
                    {direct && <p className="text-xs text-fg-1">{DIRECT_NOTE} npm rejects an override that conflicts with a direct dependency.</p>}
                    <Block text={snippet} />
                    {qualified && <p className="text-xs text-fg-1">Each key names the exact bad version it replaces, so other versions of the same package in the tree are untouched.</p>}
                    {pinTargets(fix.overrides).length > 0 && <p className="text-xs text-fg-1">Pins: <span className="font-mono">{pinTargets(fix.overrides).join(', ')}</span></p>}
                    <p className="label-caps text-xs">Steps</p>
                    <ol className="list-decimal pl-5 text-fg-0">
                      {fix.steps.map((s, i) => (
                        <li key={i} className="mb-1">
                          {s}
                        </li>
                      ))}
                    </ol>
                    <p className="label-caps text-xs">Pull request body</p>
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
                    {notice ? (
                      <>
                        For <span className="text-fg-0">{notice.team}</span> in <span className="font-mono text-xs text-fg-0">{notice.channel}</span>
                      </>
                    ) : (
                      'No owning team is mapped for this repo'
                    )}{' '}
                    (draft only, nothing is sent). It names this repo only.
                  </p>
                  <Block text={slack} />
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-line-1 p-4">
            <p role="status" className="min-h-5 text-xs text-fg-1 empty:hidden">
              {note}
            </p>
            <div className="relative flex flex-wrap items-center gap-2">
              <Button variant="primary" className="px-3" icon={<Copy size={16} />} disabled={!copyBody} onClick={() => void copy()}>
                {tab === 'fix' ? 'Copy fix' : 'Copy message'}
              </Button>
              {remediatedAt !== null ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-tier-clean">
                  <Check size={16} /> remediated {localStamp(remediatedAt)}
                  {canUndo && (
                    <button
                      ref={undoRef}
                      type="button"
                      className="ml-1 inline-flex min-h-(--control-h) items-center rounded-xs text-link underline underline-offset-2"
                      onClick={() => (onUndo(r), say('Undone: not marked remediated'))}
                    >
                      Undo
                    </button>
                  )}
                </span>
              ) : (
                <Button className="px-3" onClick={() => (onRemediate(r), say('Marked remediated. Undo is available for 10 seconds.'))}>Mark remediated</Button>
              )}
              <IconButton ref={moreRef} label="More actions" aria-expanded={menu} aria-controls={`${id}-menu`} icon={<Dots />} onClick={() => setMenu((m) => !m)} />
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
                  <button type="button" className={menuItem} onClick={() => (say(`Exported ${onExport('md')}`), setMenu(false))}>
                    <Download size={16} /> Whole report (.md)
                  </button>
                  <button type="button" className={menuItem} onClick={() => (say(`Exported ${onExport('json')}`), setMenu(false))}>
                    <Download size={16} /> Whole report (.json)
                  </button>
                  <button
                    type="button"
                    className={menuItem}
                    onClick={async () => {
                      const r = await onShare();
                      say(typeof r === 'string' ? r : r ? 'Link copied' : 'Clipboard blocked. Copy the address from the browser bar.');
                      setMenu(false);
                    }}
                  >
                    <LinkIcon size={16} /> Copy share link
                  </button>
                </div>
              )}
              {running && (
                <Button variant="ghost" onClick={onCancelRun}>
                  Cancel run
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
