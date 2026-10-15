/* SharedPrompt: a share link that names a pasted public repo (?guest=owner/name). It never fetches on load: opening a widely
 * shared link must not spend the server's GitHub quota for every visitor. The scenario is already showing; this strip asks
 * for one click ("Re-check axios/axios"), which runs the analysis and the triage, selects the repo and opens the drawer tab
 * the link named. Until then it says plainly that the numbers below are the demo org's, not the shared repo's (the band keeps
 * its "Acme demo org" label: nothing is hidden, nothing is mistaken for the shared result). While it runs the strip says
 * which step; if it fails it says why, and offers the click again only when a retry can help (data/failure.ts).
 * Props: repo (owner/name), scenario, analyze (AnalyzeState from useAnalyze), onRecheck(), onDismiss().
 * The Re-check button keeps the keyboard focus while it works (Button's loading state is aria-disabled, not disabled), and
 * the strip's own status line is the one that says each step.
 *
 * Also here, SharedRepoNote: a share link that names a demo-org repo (?repo=owner/name, with or without &open=). The triage
 * reruns at the link's minute and the repo is selected with its path drawn; this one-line strip, there from the first paint
 * (so nothing below it moves), says which repo the link is about, offers "Show its path" where the graph is another panel
 * (below 1024px), and says plainly when the link names a repo that is not in this scenario instead of ignoring it.
 * Props: repo, found (null while the triage runs), total (repos in the run), onShow (null when the path is already on
 * screen), onDismiss.
 */
import { plainError } from '../data/errors.ts';
import { nextStep, permanent } from '../data/failure.ts';
import type { ScenarioId } from '../data/types.ts';
import type { AnalyzeState } from '../data/useAnalyze.ts';
import { Button } from './Button.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';
import { scenarioLabel } from './ScenarioControl.tsx';

const STEP = { fetch: 'fetching the lockfile', parse: 'parsing it', write: 'writing its graph', enrich: 'adding package data', admits: 'checking version ranges' } as const;

export function SharedRepoNote({ repo, found, total, onShow, onDismiss }: { repo: string; found: boolean | null; total: number | null; onShow: (() => void) | null; onDismiss: () => void }) {
  const name = <span className="font-mono text-xs">{repo}</span>;
  return (
    <aside aria-label="Shared link" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-1 bg-bg-2 px-(--gutter) py-1.5 text-sm text-fg-0">
      <p role="status" className="min-w-0 flex-1 basis-64">
        {found === null ? (
          <>Shared link: {name}. Running its triage&hellip;</>
        ) : found ? (
          <>Shared link: {name} is selected; its path is drawn in the graph.</>
        ) : (
          <>
            Shared link: {name} is not one of {total === null ? 'the repos' : `the ${total} repos`} in this scenario, so nothing is selected for it.
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        {found && onShow && (
          <Button onClick={onShow} className="lg:hidden">
            Show its path
          </Button>
        )}
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </aside>
  );
}

export function SharedPrompt({ repo, scenario, analyze, onRecheck, onDismiss }: { repo: string; scenario: ScenarioId; analyze: AnalyzeState; onRecheck: () => void; onDismiss: () => void }) {
  const running = analyze.status === 'running';
  const failed = analyze.status === 'error' && analyze.error ? analyze.error : null;
  const error = failed ? { message: plainError(failed), fix: nextStep(failed, 'analyze'), retry: !permanent(failed) } : null;
  return (
    <aside aria-label="Shared result" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-1 bg-bg-2 px-(--gutter) py-3 text-sm text-fg-0">
      <div className="min-w-0 flex-1 basis-72">
        <p>
          A shared link for <span className="font-mono text-xs">{repo}</span> against {scenarioLabel(scenario)}: not checked yet.
        </p>
        {running ? (
          <p role="status" className="text-fg-1">
            Re-checking {repo}: {analyze.stage ? STEP[analyze.stage.stage] : 'starting'}&hellip;
          </p>
        ) : error ? (
          <p role="alert" className="flex items-start gap-2 text-fg-1">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              {error.message} {error.fix}
            </span>
          </p>
        ) : (
          <p className="text-fg-1">The link carries no result, and the numbers below are the demo org&rsquo;s until you re-check: that fetches the repo&rsquo;s lockfile from GitHub and runs the triage.</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {(!error || error.retry) && (
          <Button variant="primary" loading={running} onClick={onRecheck}>
            {error ? `Re-check ${repo} again` : `Re-check ${repo}`}
          </Button>
        )}
        <Button variant="ghost" onClick={onDismiss} disabled={running}>
          Dismiss
        </Button>
      </div>
    </aside>
  );
}
