/* PathGraph: the centre pane. Wraps the lazy canvas (PathGraphCanvas) with the legend, an empty state, a
 * visually-hidden list of chains that mirrors the canvas, and, below 768px, a compact top-to-bottom path (one hop per
 * row, ending at the owner) instead of the graph (docs/design.md section 5). Hover details are drawn by the canvas
 * itself, never as DOM text.
 * Props:
 *   exposures, paths, incident   graph input; before a triage the parent passes the scrubber's exposures and no paths
 *   selectedRepo                 the table drives selection; keyboard users select rows in the table
 *   playing                      landing autoplay (particles on)
 *   onSelectRepo(repo)
 *   ran, subject                 optional: a triage has finished (so an empty graph is an ANSWER, not "run a triage": a
 *                                clean pasted repo has no path to draw), and the name of the repo it was about
 * The canvas is role=img with an aria-label that summarises the selected chain.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { Exposure, ExposurePath, IncidentMeta } from '../data/types.ts';
import { EmptyState } from './EmptyState.tsx';
import { chainVar } from '../data/graphTone.ts';
import { realTeam, repoLabel, repoShort } from '../data/repoLabel.ts';
import { PathChip } from './PathChip.tsx';

const Canvas = lazy(() => import('./PathGraphCanvas.tsx'));

export interface PathGraphProps {
  exposures: Exposure[];
  paths: ExposurePath[];
  incident: IncidentMeta | null;
  selectedRepo: string | null;
  playing: boolean;
  onSelectRepo: (repo: string) => void;
  ran?: boolean;
  subject?: string | null;
}

// Left to right, the order the canvas lays them out; the shapes are the canvas shapes (radii scaled to 16px). The small grey
// dependency dots are not keyed: five entries read at a glance, and hovering a dot says what it is.
const LEGEND: { id: 'maintainer' | 'bad' | 'repo' | 'team' | 'locked'; label: string; shape: ReactNode }[] = [
  { id: 'maintainer', label: 'Compromised maintainer', shape: <circle cx="8" cy="8" r="6" fill="var(--graph-maintainer)" stroke="var(--graph-maintainer-ring)" strokeWidth="1.5" /> },
  { id: 'bad', label: 'Malicious version', shape: <circle cx="8" cy="8" r="4.5" fill="var(--graph-bad)" /> },
  { id: 'repo', label: 'Repo', shape: <rect x="3" y="3" width="10" height="10" rx="1.5" fill="var(--graph-repo)" /> },
  { id: 'team', label: 'Team', shape: <path d="M8 2 14 8 8 14 2 8Z" fill="var(--graph-team)" /> },
  {
    id: 'locked',
    label: 'Locked repo',
    shape: (
      <>
        <rect x="4" y="4" width="8" height="8" rx="1.2" fill="var(--graph-repo)" />
        <circle cx="8" cy="8" r="6.3" fill="none" stroke="var(--tier-locked)" strokeWidth="1.5" />
      </>
    ),
  },
];

/** Callback ref + state, because the measured box mounts and unmounts (empty state, breadcrumb). */
function useSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size] as const;
}

function useWide() {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/** Phone path view: the chain top to bottom, one hop per row with what each hop is, ending at the owner. The canvas needs room a phone does not have. */
function CompactPath({ path, badVersions, team }: { path: ExposurePath; badVersions: ReadonlySet<string>; team: string | null }) {
  const nodes = path.chain.at(-1) === path.version ? path.chain : [...path.chain, path.version];
  return (
    <ol className="flex w-full flex-col" aria-label={`Path for ${path.repo}`}>
      {nodes.map((item, i) => {
        const last = i === nodes.length - 1;
        const isBad = badVersions.has(item);
        const role = i === 0 ? 'repo' : last ? (path.kind === 'ADMITS' && path.range ? `range ${path.range} admits this version` : 'malicious version') : 'dependency';
        return (
          <li key={`${item}-${i}`} className={`relative flex flex-col items-start gap-0.5 pl-7 ${last && !team ? '' : 'pb-4'} ${last && !team ? '' : 'before:absolute before:top-5 before:bottom-0 before:left-[5px] before:w-px before:bg-line-3'}`}>
            <span
              aria-hidden
              className={`absolute top-1 left-0 size-3 rounded-full border-2 ${isBad ? 'border-graph-bad bg-graph-bad' : i === 0 ? 'border-graph-repo' : 'border-graph-dep'}`}
            />
            <PathChip item={item} bad={isBad} label={i === 0 ? repoShort(item) : undefined} />
            <span className="text-xs text-fg-1">{role}</span>
          </li>
        );
      })}
      {team && (
        <li className="relative flex flex-col items-start gap-0.5 pl-7">
          <span aria-hidden className="absolute top-1 left-0 size-3 rotate-45 rounded-xs border-2 border-graph-team" />
          <span className="text-sm text-fg-0">{team}</span>
          <span className="text-xs text-fg-1">owner</span>
        </li>
      )}
    </ol>
  );
}

const versionsText = (versions: string[], shown = 3) =>
  versions.slice(0, shown).join(', ') + (versions.length > shown ? ` and ${versions.length - shown} more` : '');

export function PathGraph({ exposures, paths, incident, selectedRepo, playing, onSelectRepo, ran = false, subject = null }: PathGraphProps) {
  const [box, { width, height }] = useSize<HTMLDivElement>();
  const wide = useWide();
  const bad = new Set(incident?.versions.map((v) => v.id));
  // A repo without a drafted path has none to show: never fall back to another repo's chain.
  const shownPath = selectedRepo ? paths.find((p) => p.repo === selectedRepo) : paths[0];
  const selected = exposures.find((e) => e.repo === selectedRepo);
  const label = selectedRepo
    ? `Path graph. Selected: ${repoLabel(selectedRepo)}.${shownPath ? ` Path: ${shownPath.chain.map((c, i) => (i === 0 ? repoShort(c) : c)).join(', then ')}${shownPath.chain.at(-1) === shownPath.version ? '' : `, then ${shownPath.version}`}.` : selected ? ` Reaches ${versionsText(selected.versions)}.` : ''}`
    : `Path graph of ${exposures.length} exposed repos. ${paths.length ? 'Select a repo in the table to highlight its path.' : 'Run a triage, then select a repo in the table to highlight its path.'}`;
  // The canvas draws the 3 most widely shared versions for repos without a drafted path (buildGraph).
  const capped = exposures.some((e) => e.versions.length > 3 && !paths.some((p) => p.repo === e.repo));
  // Only the kinds the canvas will draw (the same rules as buildGraph).
  const shown = {
    maintainer: !!incident?.maintainer,
    bad: true,
    repo: true,
    team: exposures.some((e) => realTeam(e.team)), // a pasted repo has no owning team, so no team diamond
    locked: exposures.some((e) => e.tier === 'LOCKED'),
  };

  return (
    <section aria-label="Path graph" className="flex h-full min-h-0 flex-col bg-bg-0">
      <h2 className="sr-only">Path graph</h2>
      {/* The legend keys the canvas, so it goes with it: below 768px the pane is a breadcrumb. */}
      <div className={`flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-1 px-3 py-2 ${wide ? 'flex' : 'hidden'}`}>
        {LEGEND.filter((l) => shown[l.id]).map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-fg-1">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              {l.shape}
            </svg>
            {l.label}
          </span>
        ))}
        {/* Always laid out (invisible until a repo is selected) so the legend never changes height and re-fits the canvas.
            The swatch is the chain's own colour: its repo's tier (LOCKED red, WOULD_PULL amber, MAINTAINER steel). */}
        <span className={`inline-flex items-center gap-1.5 text-xs text-fg-1 ${selectedRepo ? '' : 'invisible'}`} aria-hidden={!selectedRepo}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            <path d="M1 8h14" stroke={`var(${chainVar(selected?.tier)})`} strokeWidth="2" />
          </svg>
          Selected chain
        </span>
        {capped && <span className="text-xs text-fg-2 md:ml-auto">Up to 3 versions per repo shown</span>}
      </div>

      {exposures.length === 0 ? (
        ran ? (
          <EmptyState
            title="No path to a malicious version"
            cause={`${subject ? `${subject.replace(/@HEAD$/, '')} does not reach` : 'No repo in this run reaches'} a malicious version of ${incident ? incident.title : 'this incident'} at this clock, so there is no chain to draw.`}
            fix="Try the other incident, or paste another repo."
          />
        ) : (
          <EmptyState title="No paths yet" cause="Run a triage, or scrub the timeline past the first publish, to see which repos reach a malicious version." />
        )
      ) : wide ? (
        <div ref={box} className="relative min-h-0 flex-1 overflow-hidden" role="img" aria-label={label}>
          {width > 0 && height > 0 && (
            <Suspense fallback={<div className="skeleton m-4 h-24" aria-hidden />}>
              <Canvas
                exposures={exposures}
                paths={paths}
                incident={incident}
                selectedRepo={selectedRepo}
                playing={playing}
                width={width}
                height={height}
                onSelectRepo={onSelectRepo}
              />
            </Suspense>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 p-4">
          <p className="label-caps text-xs">{selectedRepo ? 'Path for the selected repo' : 'Path'}</p>
          {shownPath ? (
            <CompactPath path={shownPath} badVersions={bad} team={realTeam((selected ?? exposures.find((e) => e.repo === shownPath.repo))?.team)} />
          ) : selected ? (
            <div className="flex flex-col items-start gap-2">
              <PathChip item={selected.repo} label={repoShort(selected.repo)} />
              <p className="text-sm text-fg-1">No drafted path for this repo. It reaches:</p>
              <div className="flex flex-wrap gap-1">
                {selected.versions.slice(0, 5).map((v) => (
                  <PathChip key={v} item={v} bad />
                ))}
                {selected.versions.length > 5 && <span className="font-mono text-2xs text-fg-2">+{selected.versions.length - 5}</span>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-fg-1">No drafted path yet.</p>
          )}
          <p className="text-xs text-fg-1">Tap a repo in the Table tab to change the path.</p>
        </div>
      )}

      {/* Mirrors the canvas for assistive tech (and is the only graph content on touch widths). */}
      <ul className="sr-only" aria-label="Exposed repos and their paths">
        {exposures.map((e) => {
          const p = paths.find((x) => x.repo === e.repo);
          const deps = p ? p.chain.slice(1).filter((id) => id !== p.version) : [];
          return (
            <li key={e.repo}>
              {repoLabel(e.repo)} ({e.tier}):{' '}
              {p ? `reaches ${p.version}${deps.length ? ` via ${deps.join(', then ')}` : ', declared directly'}${p.range ? ` (range ${p.range})` : ''}` : `reaches ${versionsText(e.versions)}`}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

