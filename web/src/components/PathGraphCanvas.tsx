/* PathGraphCanvas: the react-force-graph-2d drawing layer, split from PathGraph so the ~100 kB graph library is a
 * lazy chunk (the mobile breadcrumb never loads it). Everything on the canvas is custom drawn per
 * docs/design.md section 2 (graph palette): five shapes (maintainer, bad version, dep, repo, team), a pulse
 * ring on bad versions (2 repeats then still, never shadowBlur), the selected chain at full opacity with labels
 * and a draw-on stroke, everything else dimmed with labels hidden, particles only while `playing`.
 * Props:
 *   exposures, paths, incident   graph input (union of chains; exposures without a path link straight to versions)
 *   selectedRepo                 highlights that repo's chain; null = nothing selected
 *   playing                      landing autoplay: directional particles on
 *   width, height                container size in px (measured by PathGraph)
 *   onSelectRepo(repo)           node click: a repo selects itself, a team/version selects its first repo
 *   onHover(text | null)         hover info for PathGraph's own (text-only) tooltip line
 * No node tooltips from the library: its `nodeLabel` writes innerHTML, which would break rule S5 for untrusted
 * package names, so it is disabled and hover text is rendered by React instead.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d';
import type { Exposure, ExposurePath, IncidentMeta } from '../data/types.ts';
import { motionTokens } from './icons/motionTokens.ts';

export type NodeType = 'maintainer' | 'bad' | 'dep' | 'repo' | 'team';
interface GNode {
  id: string;
  type: NodeType;
  label: string;
}
interface GLink {
  source: string;
  target: string;
}

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  maintainer: 'compromised maintainer',
  bad: 'malicious version',
  dep: 'dependency',
  repo: 'repo',
  team: 'team',
};

/** teams -> repos -> deps -> malicious versions -> maintainer, left to right (a DAG, as dagMode needs). */
export function buildGraph(exposures: Exposure[], paths: ExposurePath[], incident: IncidentMeta | null) {
  const bad = new Set(incident?.versions.map((v) => v.id));
  const nodes = new Map<string, GNode>();
  const links = new Map<string, GLink>();
  const node = (id: string, type: NodeType, label = id) => void (nodes.has(id) || nodes.set(id, { id, type, label }));
  const link = (source: string, target: string) => void links.set(`${source}>${target}`, { source, target });
  const maintainerId = incident?.maintainer ? `maintainer:${incident.maintainer}` : null;
  if (maintainerId) node(maintainerId, 'maintainer', incident!.maintainer!);

  for (const e of exposures) {
    node(e.repo, 'repo');
    if (e.team) {
      node(`team:${e.team}`, 'team', e.team);
      link(`team:${e.team}`, e.repo);
    }
  }
  for (const p of paths) {
    const ids = p.chain.at(-1) === p.version ? p.chain : [...p.chain, p.version];
    ids.forEach((id, i) => {
      node(id, i === 0 ? 'repo' : bad.has(id) ? 'bad' : 'dep');
      if (i > 0) link(ids[i - 1]!, id);
    });
  }
  for (const e of exposures) {
    if (paths.some((p) => p.repo === e.repo)) continue;
    for (const v of e.versions.slice(0, 3)) {
      node(v, 'bad');
      link(e.repo, v);
    }
    if (e.tier === 'MAINTAINER' && maintainerId) link(e.repo, maintainerId);
  }
  if (maintainerId) for (const n of nodes.values()) if (n.type === 'bad') link(n.id, maintainerId);
  return { nodes: [...nodes.values()], links: [...links.values()] };
}

/** Node ids on the selected repo's chain: team, repo, deps, versions, maintainer. */
function chainNodes(repo: string, exposures: Exposure[], paths: ExposurePath[], graph: ReturnType<typeof buildGraph>) {
  const hi = new Set([repo]);
  const e = exposures.find((x) => x.repo === repo);
  if (e?.team) hi.add(`team:${e.team}`);
  const mine = paths.filter((p) => p.repo === repo);
  for (const p of mine) [...p.chain, p.version].forEach((id) => hi.add(id));
  if (!mine.length) e?.versions.slice(0, 3).forEach((v) => hi.add(v));
  for (const n of graph.nodes) if (n.type === 'maintainer' && (e?.tier === 'MAINTAINER' || [...hi].some((id) => graph.links.some((l) => l.source === id && l.target === n.id)))) hi.add(n.id);
  return hi;
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const readTokens = () => ({
  maintainer: cssVar('--graph-maintainer'),
  ring: cssVar('--graph-maintainer-ring'),
  bad: cssVar('--graph-bad'),
  pulse: cssVar('--graph-bad-pulse'),
  dep: cssVar('--graph-dep'),
  repo: cssVar('--graph-repo'),
  team: cssVar('--graph-team'),
  link: cssVar('--graph-link'),
  active: cssVar('--graph-link-active'),
  label: cssVar('--graph-label'),
  canvas: cssVar('--graph-canvas'),
  dimNode: Number(cssVar('--graph-dim-node')) || 0.35,
  dimLink: Number(cssVar('--graph-dim-link')) || 0.2,
});

const PULSE_MS = 1200;
const PULSE_REPEATS = 2;
const clip = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);

export interface PathGraphCanvasProps {
  exposures: Exposure[];
  paths: ExposurePath[];
  incident: IncidentMeta | null;
  selectedRepo: string | null;
  playing: boolean;
  width: number;
  height: number;
  onSelectRepo: (repo: string) => void;
  onHover: (text: string | null) => void;
}

export default function PathGraphCanvas({ exposures, paths, incident, selectedRepo, playing, width, height, onSelectRepo, onHover }: PathGraphCanvasProps) {
  const reduce = useReducedMotion();
  const fg = useRef<ForceGraphMethods | undefined>(undefined);
  const tok = useMemo(readTokens, []);
  const drawMs = motionTokens().draw * 1000;

  const graphKey = useMemo(() => exposures.map((e) => e.repo).join() + '|' + paths.map((p) => p.id).join(), [exposures, paths]);
  // The graph object is rebuilt only when its inputs change: react-force-graph mutates what it is given.
  const graph = useMemo(() => buildGraph(exposures, paths, incident), [graphKey, incident]);
  const hi = useMemo(() => (selectedRepo ? chainNodes(selectedRepo, exposures, paths, graph) : null), [selectedRepo, graph]);

  // Draw-on and pulse need continuous redraw for a bounded time; otherwise the canvas pauses itself.
  const [animating, setAnimating] = useState(true);
  const clock = useRef({ select: 0, pulse: 0 });
  useEffect(() => {
    clock.current.select = performance.now();
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), PULSE_MS * PULSE_REPEATS + 200);
    return () => clearTimeout(t);
  }, [selectedRepo]);
  useEffect(() => {
    clock.current.pulse = performance.now();
  }, [graphKey]);
  // The pane can resize (paste panel, hint, window): keep the whole graph in view.
  useEffect(() => {
    fg.current?.zoomToFit(0, 48);
  }, [width, height]);
  // d3's default repulsion stacks same-level nodes on top of each other; labels need room.
  useEffect(() => {
    fg.current?.d3Force('charge')?.strength(-320);
    fg.current?.d3Force('link')?.distance(60);
  }, []);

  const paint = (node: NodeObject, ctx: CanvasRenderingContext2D, scale: number) => {
    const n = node as NodeObject<GNode>;
    const { x = 0, y = 0 } = n;
    const dim = hi !== null && !hi.has(n.id);
    ctx.save();
    ctx.globalAlpha = dim ? tok.dimNode : 1;
    let r = 4;
    switch (n.type) {
      case 'maintainer':
        r = 9;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = tok.maintainer;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = tok.ring;
        ctx.stroke();
        break;
      case 'bad': {
        r = 6;
        const t = performance.now() - clock.current.pulse;
        if (!reduce && !dim && t < PULSE_MS * PULSE_REPEATS) {
          const s = (t % PULSE_MS) / PULSE_MS;
          ctx.beginPath();
          ctx.arc(x, y, r * (1 + 0.35 * s), 0, 2 * Math.PI);
          ctx.globalAlpha = 0.5 * (1 - s);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = tok.pulse;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = tok.bad;
        ctx.fill();
        break;
      }
      case 'dep':
        r = 3.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = tok.dep;
        ctx.fill();
        break;
      case 'repo':
        r = 6;
        ctx.beginPath();
        ctx.roundRect(x - r, y - r, 2 * r, 2 * r, 2);
        ctx.fillStyle = tok.repo;
        ctx.fill();
        break;
      case 'team':
        r = 6.5;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fillStyle = tok.team;
        ctx.fill();
        break;
    }
    // Labels: the selected chain keeps them, dimmed nodes lose them. Ids are Martian Mono 11px, names Satoshi 12px.
    if (!dim && (hi || n.type !== 'dep')) {
      const mono = n.type === 'repo' || n.type === 'bad' || n.type === 'dep';
      ctx.font = mono ? `${11 / scale}px 'Martian Mono', monospace` : `${12 / scale}px Satoshi, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const text = clip(n.label);
      const ty = y + r + 3 / scale;
      const tw = ctx.measureText(text).width;
      ctx.globalAlpha = 0.85; // canvas-coloured plate so edges do not run through the label
      ctx.fillStyle = tok.canvas;
      ctx.fillRect(x - tw / 2 - 2 / scale, ty - 1 / scale, tw + 4 / scale, 14 / scale);
      ctx.globalAlpha = 1;
      ctx.fillStyle = tok.label;
      ctx.fillText(text, x, ty);
    }
    ctx.restore();
  };

  const paintLink = (l: { source?: unknown; target?: unknown }, ctx: CanvasRenderingContext2D, scale: number) => {
    const s = l.source as NodeObject<GNode>;
    const t = l.target as NodeObject<GNode>;
    if (s.x === undefined || t.x === undefined || s.y === undefined || t.y === undefined) return;
    const active = hi !== null && hi.has(s.id) && hi.has(t.id);
    const dim = hi !== null && !active;
    const p = active && !reduce ? Math.min(1, (performance.now() - clock.current.select) / drawMs) : 1;
    ctx.save();
    ctx.globalAlpha = dim ? tok.dimLink : 1;
    ctx.lineWidth = (active ? 2 : 1) / scale;
    ctx.strokeStyle = active ? tok.active : tok.link;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + (t.x - s.x) * p, s.y + (t.y - s.y) * p);
    ctx.stroke();
    ctx.restore();
  };

  const firstRepoFor = (n: NodeObject<GNode>): string | null => {
    if (n.type === 'repo') return n.id;
    if (n.type === 'team') return exposures.find((e) => `team:${e.team}` === n.id)?.repo ?? null;
    if (n.type === 'maintainer') return null;
    return paths.find((p) => p.chain.includes(n.id) || p.version === n.id)?.repo ?? exposures.find((e) => e.versions.includes(n.id))?.repo ?? null;
  };

  return (
    <ForceGraph2D
      ref={fg}
      width={width}
      height={height}
      backgroundColor={tok.canvas}
      graphData={graph}
      nodeId="id"
      dagMode="lr"
      dagLevelDistance={110}
      onDagError={() => {}}
      cooldownTicks={90}
      onEngineStop={() => fg.current?.zoomToFit(reduce ? 0 : 280, 48)}
      enableNodeDrag={false}
      nodeLabel={() => ''}
      linkLabel={() => ''}
      nodeCanvasObjectMode={() => 'replace'}
      nodeCanvasObject={paint}
      nodePointerAreaPaint={(n, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, 10, 0, 2 * Math.PI);
        ctx.fill();
      }}
      linkCanvasObjectMode={() => 'replace'}
      linkCanvasObject={paintLink}
      linkDirectionalParticles={playing && !reduce ? 2 : 0}
      linkDirectionalParticleWidth={2}
      linkDirectionalParticleSpeed={0.01}
      linkDirectionalParticleColor={() => tok.active}
      autoPauseRedraw={!animating}
      onNodeClick={(n) => {
        const repo = firstRepoFor(n as NodeObject<GNode>);
        if (repo) onSelectRepo(repo);
      }}
      onNodeHover={(n) => onHover(n ? `${(n as NodeObject<GNode>).label} · ${NODE_TYPE_LABEL[(n as NodeObject<GNode>).type]}` : null)}
    />
  );
}
