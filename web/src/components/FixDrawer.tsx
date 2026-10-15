/* FixDrawer: the right drawer with Fix and Notice tabs (docs/design.md section 5). A native <dialog> opened with
 * showModal(): focus is trapped, Esc closes, the page is inert, and focus returns to the opener, all for free.
 * Slides in over --dur-slow with --ease-drawer (styles.css `dialog.drawer`); a full-screen sheet below 768px.
 * Props:
 *   repo             repo id to show; null closes the drawer (the last repo stays rendered during the exit)
 *   report           Report: exposures, paths, remediations, notices
 *   tab, onTab       'fix' | 'notice'
 *   onClose
 *   remediatedAt     epoch ms when this repo was marked remediated, or null
 *   onRemediate(repo)
 *   running, onCancelRun   "Cancel run" appears only while a triage is running
 *   onExport('md' | 'json'), onShare
 * Footer: Copy (the active tab), Export, Share link, Mark remediated, Cancel run. Untrusted text renders as text.
 */
import { useEffect, useId, useRef } from 'react';
import { utc } from '../data/format.ts';
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
  onRemediate: (repo: string) => void;
  running: boolean;
  onCancelRun: () => void;
  onExport: (format: 'md' | 'json') => void;
  onShare: () => void;
}

const Block = ({ text }: { text: string }) => (
  <pre className="overflow-x-auto rounded-xs bg-bg-3 p-3 text-xs leading-[18px] text-fg-0 select-all">
    <code>{text}</code>
  </pre>
);

export function FixDrawer({ repo, report, tab, onTab, onClose, remediatedAt, onRemediate, running, onCancelRun, onExport, onShare }: FixDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const shown = useRef<string | null>(repo);
  if (repo) shown.current = repo; // keep the content on screen while the exit transition runs
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (repo && !d.open) d.showModal();
    else if (!repo && d.open) d.close();
  }, [repo]);

  const r = shown.current;
  const exposure = report.exposures.find((e) => e.repo === r);
  const path = report.paths.find((p) => p.repo === r);
  const fix = report.remediations.find((f) => f.repo === r);
  const notice = report.notices.find((n) => n.team === exposure?.team);
  const bad = new Set(report.incident.versions.map((v) => v.id));
  const fixText = fix ? `${JSON.stringify({ overrides: fix.overrides }, null, 2)}\n\n${fix.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${fix.prBody}` : '';
  const copyLabel = tab === 'fix' ? 'Fix' : 'Notice';
  const copyBody = tab === 'fix' ? fixText : (notice?.text ?? '');

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
                  <p className="text-fg-1">No fix was drafted for this repo. The graph found exposure here, but this run produced no overrides for it.</p>
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
            <Button variant="primary" icon={<Copy size={16} />} disabled={!copyBody} onClick={() => void copyText(copyBody, copyLabel)}>
              Copy
            </Button>
            <Button icon={<Download size={16} />} onClick={() => onExport('md')}>
              Markdown
            </Button>
            <Button icon={<Download size={16} />} onClick={() => onExport('json')}>
              JSON
            </Button>
            <IconButton label="Copy share link" icon={<LinkIcon size={16} />} onClick={onShare} />
            {remediatedAt !== null ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-tier-clean">
                <Check size={16} /> remediated {utc(remediatedAt)}
              </span>
            ) : (
              <Button onClick={() => onRemediate(r)}>Mark remediated</Button>
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
