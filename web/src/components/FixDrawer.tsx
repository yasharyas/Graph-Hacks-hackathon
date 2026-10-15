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
 *   onExport('md' | 'json') -> the downloaded file name; onShare() -> whether the link was copied
 * Footer: Copy (the active tab), Export report, Share link, Mark remediated (+ Undo), Cancel run. The dialog is modal,
 * so page toasts would sit dimmed and inert under its scrim: every outcome (copied, exported, marked, undone) is
 * reported by the polite status line inside it. Untrusted text renders as text.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { HEAD_NOTE, isHead, utc } from '../data/format.ts';
import type { Report } from '../data/types.ts';
import { Button, IconButton } from './Button.tsx';
import { copyText } from './copy.ts';
import { Check, Close, Copy, Download, LinkIcon } from './icons/Glyphs.tsx';
import { PathChain } from './PathChip.tsx';
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
  onShare: () => Promise<boolean>;
}

const Block = ({ text }: { text: string }) => (
  <pre className="rounded-xs bg-bg-3 p-3 text-xs leading-[18px] whitespace-pre-wrap text-fg-0 select-all [overflow-wrap:anywhere]">
    <code>{text}</code>
  </pre>
);

export function FixDrawer({ repo, report, tab, onTab, onClose, remediatedAt, canUndo, onUndo, onRemediate, running, onCancelRun, onExport, onShare }: FixDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const [note, setNote] = useState('');
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
  }, [repo]);
  // "Mark remediated" unmounts the button that had focus: land on Undo, the next thing a person might want.
  useEffect(() => {
    if (canUndo) undoRef.current?.focus();
  }, [canUndo]);

  const r = shown.current;
  const exposure = report.exposures.find((e) => e.repo === r);
  const path = report.paths.find((p) => p.repo === r);
  const fix = report.remediations.find((f) => f.repo === r);
  const notice = report.notices.find((n) => n.team === exposure?.team);
  const bad = new Set(report.incident.versions.map((v) => v.id));
  const fixText = fix ? `${JSON.stringify({ overrides: fix.overrides }, null, 2)}\n\n${fix.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${fix.prBody}` : '';
  const copyLabel = tab === 'fix' ? 'Fix' : 'Slack message';
  const copyBody = tab === 'fix' ? fixText : (notice?.text ?? '');
  const copy = async () => say((await copyText(copyBody, copyLabel, true)) ? `${copyLabel} copied` : `Clipboard blocked. Select the ${copyLabel.toLowerCase()} text above and copy it manually.`);

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
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
                <span className="mr-2 rounded-xs bg-bg-3 px-1.5 py-0.5 font-mono text-2xs font-medium text-fg-0">COUNTERFACTUAL</span>
                {HEAD_NOTE}
              </p>
            )}
            {path && (
              <div className="mb-4">
                <p className="label-caps mb-1.5">Path {path.id}</p>
                <PathChain path={path} badVersions={bad} />
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
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      onTab(t === 'fix' ? 'notice' : 'fix');
                      document.getElementById(`${id}-${t === 'fix' ? 'notice' : 'fix'}`)?.focus();
                    }
                  }}
                  className={`-mb-px border-b-2 px-3 py-2 text-base ${tab === t ? 'border-fg-0 text-fg-0' : 'border-transparent text-fg-1'}`}
                >
                  {t === 'fix' ? 'Fix' : 'Notice'}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="flex flex-col gap-3 text-sm">
              {tab === 'fix' &&
                (fix ? (
                  <>
                    <p className="label-caps">package.json overrides</p>
                    <Block text={JSON.stringify({ overrides: fix.overrides }, null, 2)} />
                    <p className="label-caps">Steps</p>
                    <ol className="list-decimal pl-5 text-fg-0">
                      {fix.steps.map((s) => (
                        <li key={s} className="mb-1">
                          {s}
                        </li>
                      ))}
                    </ol>
                    <p className="label-caps">Pull request body</p>
                    <p className="text-fg-0">{fix.prBody}</p>
                  </>
                ) : (
                  <p className="text-fg-1">
                    {exposure.tier === 'MAINTAINER'
                      ? 'Nothing to fix yet: no malicious version is known for the packages this repo takes from the compromised account. Watch for new advisories.'
                      : `No fix was drafted for this repo. Each run drafts a path and a fix for its top ${report.remediations.length || 5} exposures only. Ask a follow-up about this repo to get its path.`}
                  </p>
                ))}
              {tab === 'notice' &&
                (notice ? (
                  <>
                    <p className="text-fg-1">
                      For <span className="text-fg-0">{notice.team}</span> in <span className="font-mono text-xs text-fg-0">{notice.channel}</span> (draft only, nothing is sent).
                    </p>
                    <Block text={notice.text} />
                  </>
                ) : (
                  <p className="text-fg-1">No notice was drafted: this repo has no owning team in the graph.</p>
                ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line-1 p-4">
            <p role="status" className="min-h-5 basis-full text-xs text-fg-1 empty:hidden">
              {note}
            </p>
            <Button variant="primary" icon={<Copy size={16} />} disabled={!copyBody} onClick={() => void copy()}>
              {tab === 'fix' ? 'Copy fix' : 'Copy as Slack message'}
            </Button>
            <Button
              icon={<Download size={16} />}
              aria-label="Export the whole report as Markdown"
              title="The whole triage report, not just this repo"
              onClick={() => say(`Exported ${onExport('md')}`)}
            >
              Report .md
            </Button>
            <Button
              icon={<Download size={16} />}
              aria-label="Export the whole report as JSON"
              title="The whole triage report, not just this repo"
              onClick={() => say(`Exported ${onExport('json')}`)}
            >
              Report .json
            </Button>
            <IconButton
              label="Copy share link"
              icon={<LinkIcon size={16} />}
              onClick={async () => say((await onShare()) ? 'Link copied' : 'Clipboard blocked. Copy the address from the browser bar.')}
            />
            {remediatedAt !== null ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-tier-clean">
                <Check size={16} /> remediated {utc(remediatedAt)}
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
              <Button onClick={() => (onRemediate(r), say('Marked remediated. Undo is available for 10 seconds.'))}>Mark remediated</Button>
            )}
            {running && (
              <Button variant="ghost" onClick={onCancelRun}>
                Cancel run
              </Button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
