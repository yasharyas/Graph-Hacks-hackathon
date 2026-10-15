/* Header: the 48px bar. Wordmark, scenario control, scenario clock chip, query total, LLM-mode badge, claims
 * badge, paste button. Nothing in the header animates except the biohazard's single turn on run start.
 * Props:
 *   scenario, onScenario, onRun, running, turnKey   (forwarded to ScenarioControl)
 *   clockAt        scenario clock (epoch ms): Report.at when a report exists, else the scrubber position
 *   queryTotal     { ms, queries } summed from ToolResult.ms / cypher.length, or null before any result
 *   mode           LLM mode of the triage narration (live | replay | template), or null
 *   guard          claim verification result, or null; flagged claims turn the badge amber and clickable
 *   onShowFlagged  opens the flagged-claims list
 *   pasteOpen, onTogglePaste   the "Paste your repo" button (opens the PasteBox row under the header)
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
  onRun: () => void;
  running: boolean;
  turnKey: number;
  clockAt: number | null;
  queryTotal: { ms: number; queries: number } | null;
  mode: LlmMode | null;
  guard: Guard | null;
  onShowFlagged: () => void;
  pasteOpen: boolean;
  onTogglePaste: () => void;
  mock: boolean;
}

export function Header(p: HeaderProps) {
  const flagged = p.guard ? p.guard.flagged.length > 0 : false;
  return (
    <header className="flex min-h-(--header-h) shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-1 bg-bg-0 px-(--gutter) py-2">
      <h1 className="mr-1 text-md font-bold text-fg-0">Patient Zero</h1>

      <div className="order-last -mx-(--gutter) w-[calc(100%+2*var(--gutter))] overflow-x-auto px-(--gutter) [scrollbar-width:none] md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0">
        <ScenarioControl value={p.scenario} onChange={p.onScenario} onRun={p.onRun} running={p.running} turnKey={p.turnKey} />
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
        {p.mock && (
          <span className="hidden rounded-xs border border-line-2 px-1.5 py-0.5 font-mono text-2xs text-fg-1 min-[1440px]:inline" title="Fixture replay, not live results">
            mock data
          </span>
        )}
        {p.queryTotal && (
          <span
            className="hidden font-mono text-xs text-fg-1 min-[1440px]:inline"
            aria-label={`FalkorDB execution time ${p.queryTotal.ms.toFixed(1)} milliseconds across ${plural(p.queryTotal.queries, 'query', 'queries')}`}
          >
            {fmtMs(p.queryTotal.ms)} total · {plural(p.queryTotal.queries, 'query', 'queries')}
          </span>
        )}
        {p.clockAt !== null && (
          <span className="rounded-xs bg-bg-2 px-2 py-0.5 font-mono text-xs text-fg-0" title="The clock the exposure table and counts are true at (the timeline can be ahead of it while a query loads)">
            <time>at {utcLabel(p.clockAt)}</time>
          </span>
        )}
        {p.mode && (
          <span className={`rounded-full border border-line-2 px-2.5 py-0.5 text-xs ${MODE_STYLE[p.mode]}`} aria-label={`Narration mode: ${p.mode}`}>
            <span className="hidden text-fg-2 sm:inline">LLM </span>
            {p.mode}
          </span>
        )}
        <div aria-live="polite">
          {p.guard &&
            (flagged ? (
              <button
                type="button"
                onClick={p.onShowFlagged}
                className="inline-flex items-center gap-1.5 rounded-full bg-tier-would-pull-bg px-2.5 py-0.5 text-xs text-tier-would-pull"
                aria-label={`${p.guard.flagged.length} claims flagged: ${p.guard.verified} of ${p.guard.total} traced. Open the flagged list.`}
              >
                <TriangleAlert size={14} />
                {p.guard.verified}/{p.guard.total} traced
              </button>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-tier-clean-bg px-2.5 py-0.5 text-xs text-tier-clean"
                aria-label={`All claims verified: ${p.guard.verified} of ${p.guard.total} traced to graph queries`}
              >
                <CheckDrawIcon size={14} />
                {p.guard.verified}/{p.guard.total} traced
              </span>
            ))}
        </div>
        <Button
          variant="secondary"
          icon={<Upload size={16} />}
          aria-expanded={p.pasteOpen}
          aria-controls="paste-panel"
          aria-label="Paste your repo"
          onClick={p.onTogglePaste}
          className="max-md:px-0 max-md:w-(--control-h)"
        >
          <span className="max-md:sr-only">Paste your repo</span>
        </Button>
      </div>
    </header>
  );
}
