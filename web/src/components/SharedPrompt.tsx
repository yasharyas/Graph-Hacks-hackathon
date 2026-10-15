/* SharedPrompt: a share link that names a pasted public repo (?guest=owner/name). It never fetches on load: opening a widely
 * shared link must not spend the server's GitHub quota for every visitor. The scenario is already showing; this strip asks
 * for one click ("Re-check axios/axios"), which runs the analysis and the triage, selects the repo and opens the drawer tab
 * the link named. While that runs the strip says which step; if it fails it says why and offers the click again.
 * Props: repo (owner/name), scenario, analyze (AnalyzeState from useAnalyze), onRecheck(), onDismiss().
 */
import { fixFor, plainError } from '../data/errors.ts';
import type { ScenarioId } from '../data/types.ts';
import type { AnalyzeState } from '../data/useAnalyze.ts';
import { Button } from './Button.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';
import { scenarioLabel } from './ScenarioControl.tsx';

const STEP = { fetch: 'fetching the lockfile', parse: 'parsing it', write: 'writing its graph', enrich: 'adding package data', admits: 'checking version ranges' } as const;

export function SharedPrompt({ repo, scenario, analyze, onRecheck, onDismiss }: { repo: string; scenario: ScenarioId; analyze: AnalyzeState; onRecheck: () => void; onDismiss: () => void }) {
  const running = analyze.status === 'running';
  const error = analyze.status === 'error' && analyze.error ? { message: plainError(analyze.error), fix: fixFor(analyze.error, 'analyze') } : null;
  return (
    <aside aria-label="Shared result" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-1 bg-bg-2 px-(--gutter) py-3 text-sm text-fg-0">
      <div className="min-w-0 flex-1 basis-72">
        <p>
          Shared result: re-check <span className="font-mono text-xs">{repo}</span> against {scenarioLabel(scenario)}.
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
          <p className="text-fg-1">The link carries no result: this fetches the repo&rsquo;s lockfile from GitHub and runs the triage again.</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" loading={running} onClick={onRecheck}>
          {error ? 'Try again' : `Re-check ${repo}`}
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={running}>
          Dismiss
        </Button>
      </div>
    </aside>
  );
}
