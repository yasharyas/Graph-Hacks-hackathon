/* Header: the 48px bar. Wordmark, scenario control, then (right) the FalkorDB time, the scenario clock chip, the
 * LLM-mode badge, the claims badge, a "Built on FalkorDB" pill and the paste button. Nothing in the header animates
 * except the biohazard's single turn on run start. Every label is real text (screen-reader-only words where the
 * visible text is short), never an aria-label on a role-less span.
 * Props:
 *   scenario, onScenario, onMove, onRun, running, turnKey   (forwarded to ScenarioControl: a click chooses, an arrow only moves)
 *   clockAt        scenario clock (epoch ms): the clock the table and counts are true at; null (no run to describe) hides the chip,
 *                  and on a phone the chip is the bare time so the bar stays one row
 *   queryTotal     { ms, queries } summed from ToolResult.ms / cypher.length, or null before any result. "N ms in
 *                  FalkorDB" is FalkorDB's own execution time, not the run's wall clock
 *   mode           LLM mode of the triage narration (live | replay | template), or null
 *   guard          claim verification result, or null; flagged claims turn the badge amber and clickable
 *   onShowFlagged  opens the flagged-claims list
 *   onOpenStats    the "Built on FalkorDB" pill: opens the graph stats (the tab under the table after a triage, the graph's own
 *                  node and edge counts before one)
 *   onOpenPaste    the "Paste your repo" button (opens the paste sheet)
 *   mock           true in ?mock mode: adds a "mock data" tag so fixture replays are never mistaken for results
 * Landmarks: <header>. The skip link and the autoplay pause live in App, before this header, in that tab order.
 */
import type { LlmMode } from '../data/types.ts';
import type { Guard } from '../data/useTriage.ts';
import { fmtMs, plural, utcLabel } from '../data/format.ts';
import { Button } from './Button.tsx';
import { CheckDrawIcon } from './icons/CheckDrawIcon.tsx';
import { TriangleAlert, Upload } from './icons/Glyphs.tsx';
import { ScenarioControl, type ScenarioChoice } from './ScenarioControl.tsx';

const MODE_STYLE: Record<LlmMode, string> = {
  live: 'text-fg-0',
  replay: 'text-tier-maintainer',
  template: 'text-fg-1',
};

export interface HeaderProps {
  scenario: ScenarioChoice;
  onScenario: (v: ScenarioChoice) => void;
  onMove: (v: ScenarioChoice) => void;
  onRun: () => void;
  running: boolean;
  turnKey: number;
  clockAt: number | null;
  queryTotal: { ms: number; queries: number } | null;
  mode: LlmMode | null;
  guard: Guard | null;
  onShowFlagged: () => void;
  onOpenStats: () => void;
  onOpenPaste: () => void;
  mock: boolean;
}

export function Header(p: HeaderProps) {
  const flagged = p.guard ? p.guard.flagged.length > 0 : false;
  const queries = p.queryTotal ? plural(p.queryTotal.queries, 'query', 'queries') : '';
  return (
    <header className="flex min-h-(--header-h) shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-1 bg-bg-0 px-(--gutter) py-2 xl:flex-nowrap">
      <h1 className="mr-1 shrink-0 text-md font-bold whitespace-nowrap text-fg-0">Patient Zero</h1>

      <div className="order-last -mx-(--gutter) w-[calc(100%+2*var(--gutter))] overflow-x-auto px-(--gutter) [scrollbar-width:none] md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0">
        <ScenarioControl value={p.scenario} onChange={p.onScenario} onMove={p.onMove} onRun={p.onRun} running={p.running} turnKey={p.turnKey} />
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm xl:flex-nowrap">
        {p.mock && (
          <span className="hidden rounded-xs border border-line-2 px-1.5 py-0.5 font-mono text-2xs text-fg-1 min-[1440px]:inline" title="Fixture replay, not live results">
            mock data
          </span>
        )}
        {p.queryTotal && (
          <span className="hidden font-mono text-xs whitespace-nowrap text-fg-1 min-[1536px]:inline">
            {fmtMs(p.queryTotal.ms)} in FalkorDB · {queries}
          </span>
        )}
        {/* Laid out from first paint (invisible until the timeline loads) so the badges beside it do not shift. */}
        <span
          className={`rounded-xs bg-bg-2 px-2 py-0.5 font-mono text-xs whitespace-nowrap text-fg-0 ${p.clockAt === null ? 'invisible' : ''}`}
          aria-hidden={p.clockAt === null || undefined}
          title="The clock the exposure table and counts are true at (the timeline can be ahead of it while a query loads)"
        >
          <time>
            <span className="max-sm:hidden">at </span>
            {p.clockAt === null ? '00:00 UTC' : utcLabel(p.clockAt)}
          </time>
        </span>
        {p.mode && (
          // phones: the header is one row (title, clock, paste); the mode and the claim count are in the feed there
          <span className={`rounded-full border border-line-2 px-2.5 py-0.5 text-xs whitespace-nowrap max-sm:hidden lg:max-xl:hidden ${MODE_STYLE[p.mode]}`}>
            <span className="sr-only">Narration mode: </span>
            <span className="hidden text-fg-2 sm:inline" aria-hidden>
              LLM{' '}
            </span>
            {p.mode}
          </span>
        )}
        {/* not a live region: the feed's completion line already says "N of N claims traced" once */}
        <div>
          {p.guard &&
            (flagged ? (
              <button
                type="button"
                onClick={p.onShowFlagged}
                className="inline-flex items-center gap-1.5 rounded-full bg-tier-would-pull-bg px-2.5 py-0.5 text-xs whitespace-nowrap text-tier-would-pull pointer-coarse:min-h-11"
                // a flagged claim must stay reachable on a phone: only the all-verified badge is hidden there
              >
                <TriangleAlert size={14} />
                <span className="sr-only">{plural(p.guard.flagged.length, 'claim')} flagged. Open the flagged list. </span>
                {p.guard.verified}/{p.guard.total} claims traced
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tier-clean-bg px-2.5 py-0.5 text-xs whitespace-nowrap text-tier-clean max-sm:hidden">
                <CheckDrawIcon size={14} />
                <span className="sr-only">All claims verified: </span>
                {p.guard.verified}/{p.guard.total} claims traced
                <span className="sr-only"> to graph queries</span>
              </span>
            ))}
        </div>
        <button
          type="button"
          onClick={p.onOpenStats}
          className="hidden items-center gap-1.5 rounded-full border border-line-2 px-2.5 py-0.5 text-xs whitespace-nowrap text-fg-0 pointer-coarse:min-h-11 md:inline-flex short:hidden hov:bg-bg-3"
        >
          Built on FalkorDB
          {/* 1440-1535: the time rides in the pill; from 1536 it is the "N ms in FalkorDB" label beside it; below 1440 there is no room (1280 is tight) */}
          {p.queryTotal && <span className="hidden font-mono text-2xs text-fg-1 tabular-nums min-[1440px]:inline min-[1536px]:hidden">{fmtMs(p.queryTotal.ms)}</span>}
          <span className="sr-only">
            {p.queryTotal ? `, ${fmtMs(p.queryTotal.ms)} in FalkorDB across ${queries}` : ''}. Opens the graph stats.
          </span>
        </button>
        <Button
          variant="secondary"
          icon={<Upload size={16} />}
          aria-haspopup="dialog"
          onClick={p.onOpenPaste}
          className="whitespace-nowrap max-md:w-(--control-h) max-md:px-0 short:w-(--control-h) short:px-0 lg:max-xl:w-(--control-h) lg:max-xl:px-0"
        >
          <span className="max-md:sr-only short:sr-only lg:max-xl:sr-only">Paste your repo</span>
        </Button>
      </div>
    </header>
  );
}
