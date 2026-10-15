/* PathGraph: the centre pane. Wraps the lazy canvas (PathGraphCanvas) with the legend, an empty state, text-only
 * hover info, a visually-hidden list of chains that mirrors the canvas, and, below 768px, a breadcrumb chain
 * instead of the graph (docs/design.md section 5).
 * Props:
 *   exposures, paths, incident   graph input; before a triage the parent passes the scrubber's exposures and no paths
 *   selectedRepo                 the table drives selection; keyboard users select rows in the table
 *   playing                      landing autoplay (particles on)
 *   onSelectRepo(repo)
 * The canvas is role=img with an aria-label that summarises the selected chain.
 */
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { Exposure, ExposurePath, IncidentMeta } from '../data/types.ts';
import { EmptyState } from './EmptyState.tsx';
import { PathChain } from './PathChip.tsx';

const Canvas = lazy(() => import('./PathGraphCanvas.tsx'));

export interface PathGraphProps {
  exposures: Exposure[];
  paths: ExposurePath[];
  incident: IncidentMeta | null;
  selectedRepo: string | null;
  playing: boolean;
  onSelectRepo: (repo: string) => void;
}

const LEGEND: { label: string; shape: ReactNode }[] = [
  { label: 'Compromised maintainer', shape: <circle cx="8" cy="8" r="6" fill="var(--graph-maintainer)" stroke="var(--graph-maintainer-ring)" strokeWidth="1.5" /> },
  { label: 'Malicious version', shape: <circle cx="8" cy="8" r="5" fill="var(--graph-bad)" /> },
  { label: 'Dependency', shape: <circle cx="8" cy="8" r="3.5" fill="var(--graph-dep)" /> },
  { label: 'Repo', shape: <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="var(--graph-repo)" /> },
  { label: 'Team', shape: <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="var(--graph-team)" /> },
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

export function PathGraph({ exposures, paths, incident, selectedRepo, playing, onSelectRepo }: PathGraphProps) {
  const [box, { width, height }] = useSize<HTMLDivElement>();
  const wide = useWide();
  const [hover, setHover] = useState<string | null>(null);
  const bad = new Set(incident?.versions.map((v) => v.id));
  const shownPath = paths.find((p) => p.repo === selectedRepo) ?? paths[0];
  const label = selectedRepo
    ? `Path graph. Selected: ${selectedRepo}${shownPath && shownPath.repo === selectedRepo ? `, ${shownPath.chain.join(', then ')}${shownPath.chain.at(-1) === shownPath.version ? '' : `, then ${shownPath.version}`}` : ''}.`
    : `Path graph of ${exposures.length} exposed repos. Select a repo in the table to highlight its path.`;

  return (
    <section aria-label="Path graph" className="flex h-full min-h-0 flex-col bg-bg-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-1 px-3 py-2">
        <h2 className="sr-only">Path graph</h2>
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-fg-1">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
              {l.shape}
            </svg>
            {l.label}
          </span>
        ))}
      </div>

      {exposures.length === 0 ? (
        <EmptyState title="No paths yet" cause="Run a triage, or scrub the timeline past the first publish, to see which repos reach a malicious version." />
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
                onHover={setHover}
              />
            </Suspense>
          )}
          <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-xs text-fg-1" aria-hidden>
            {hover}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <p className="label-caps">{selectedRepo ? `Path for ${selectedRepo}` : 'Path'}</p>
          {shownPath ? <PathChain path={shownPath} badVersions={bad} /> : <p className="text-sm text-fg-1">No drafted path for this repo.</p>}
          <p className="text-xs text-fg-2">Select a repo in the table to change the path.</p>
        </div>
      )}

      {/* Mirrors the canvas for assistive tech (and is the only graph content on touch widths). */}
      <ul className="sr-only" aria-label="Exposure paths">
        {paths.map((p) => (
          <li key={p.id}>
            {p.id}: {p.chain.join(' to ')}
            {p.chain.at(-1) === p.version ? '' : ` to ${p.version}`}
            {p.range ? ` (range ${p.range})` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}
