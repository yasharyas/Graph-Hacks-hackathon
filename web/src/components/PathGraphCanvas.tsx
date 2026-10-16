/* PathGraphCanvas: the react-force-graph-2d drawing layer, split from PathGraph so the ~100 kB graph library is a
 * lazy chunk (the mobile breadcrumb never loads it). Everything on the canvas is custom drawn per
 * docs/design.md section 2 (graph palette).
 *
 * Layout: infection runs left to right: compromised maintainer -> malicious version -> dependencies -> repo -> team
 * (links point that way, so particles and arrowheads run from the bad version toward the repo). Both axes are pinned
 * here, not left to forces: x by node kind (one column per kind and dependency depth, so every repo is in the same
 * column, which dagMode's hop-count levels would not give), y by row (one row per repo, grouped by team; everything else
 * at the mean row of the repos it feeds). Nothing overlaps, the picture is the same on every load, and labels get room.
 * The graph is the union of the report's chains (capped at CAP nodes), fitted to the pane when the layout settles and
 * whenever the pane resizes.
 *
 * Labels are drawn in screen space after the frame, highest priority first, and skipped when they would overlap one
 * already placed: repos, malicious versions and the maintainer by default; with a selection only its chain. A hovered
 * node gets a canvas tooltip. The library's own tooltip (innerHTML) is disabled: package names are untrusted (S5).
 * Selected chain: full opacity, 2px stroke in the repo's TIER colour (LOCKED red, WOULD_PULL amber, MAINTAINER steel: red
 * stays what it means on this screen, an infected repo) drawn on from the bad version toward the repo, arrowheads, and
 * directional particles for a bounded time (and during the landing autoplay); everything else is dimmed.
 * Teams: a pasted repo has no owning team (the server files it under a placeholder), so no team node is drawn for it.
 * Reduced motion: no pulse, no draw-on, no particles. The renderer's 60 Hz loop pauses whenever nothing moves (both modes).
 *
 * Props:
 *   exposures, paths, incident   graph input (exposures without a drafted path link straight to their versions)
 *   selectedRepo                 highlights that repo's chain; null = nothing selected
 *   playing                      landing autoplay: particles on every link
 *   width, height                container size in px (measured by PathGraph)
 *   onSelectRepo(repo)           node click: a repo selects itself, a team/version/dependency selects its first repo
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from 'react-force-graph-2d';
import type { Exposure, ExposurePath, IncidentMeta } from '../data/types.ts';
import { motionTokens } from './icons/motionTokens.ts';
import { splitRef } from './PathChip.tsx';
import { chainVar } from '../data/graphTone.ts';
import { realTeam, repoLabel, repoShort } from '../data/repoLabel.ts';

export type NodeType = 'maintainer' | 'bad' | 'dep' | 'repo' | 'team';
type GNode = { id: string; type: NodeType; label: string; fx?: number; fy?: number };
type GLink = { source: string; target: string };
type Chain = { nodes: Set<string>; links: Set<string> };
export type Graph = { nodes: GNode[]; links: GLink[]; chains: Map<string, Chain>; reach: Map<string, number>; total: number };

/** Columns the layout needs between the first and last node: maintainer, version, dependencies, repo, team. */
const columnGaps = (exposures: Exposure[], paths: ExposurePath[], incident: IncidentMeta | null) =>
  (incident?.maintainer ? 1 : 0) + 1 + depsOf(paths) + 1 + (exposures.some((e) => realTeam(e.team)) ? 1 : 0) - 1;
/** Most dependencies between a version and its repo on any drafted chain (`chain` is root first and may end at the version). */
const depsOf = (paths: ExposurePath[]) => Math.max(0, ...paths.map((p) => p.chain.slice(1).filter((id) => id !== p.version).length));

const CAP = 300; // nodes drawn; repos, versions and the account are kept first, then teams, then dependencies
const KEEP: Record<NodeType, number> = { repo: 0, bad: 0, maintainer: 0, team: 1, dep: 2 };
const LABEL_RANK: Record<NodeType, number> = { repo: 0, bad: 1, maintainer: 2, team: 3, dep: 4 };
// Where a label may sit, in order of preference: repos stack tightly in one column so theirs go to the side.
type Side = 'right' | 'left' | 'below' | 'above';
const PLACES: Record<NodeType, Side[]> = {
  repo: ['right', 'below', 'above'],
  bad: ['left', 'above', 'below', 'right'],
  maintainer: ['below', 'above'],
  team: ['right', 'below', 'above'],
  dep: ['above', 'below'],
};
// A selected repo's own edge to its team runs out of its right side, so there the label goes above or below instead.
const CHAIN_REPO_PLACES: Side[] = ['above', 'below', 'right'];
type Box = [x0: number, y0: number, x1: number, y1: number, owner: string];
const R: Record<NodeType, number> = { maintainer: 9, bad: 6, dep: 3.5, repo: 6, team: 6.5 };
/**
 * Radius in graph units: a node never draws smaller than 4 screen px, so a short pane's shrunken graph stays legible. Repos
 * are the exception when their rows are packed tighter than 8 px (21 repos in a 210 px pane): there the square shrinks to leave
 * a gap, down to 1.5 px, instead of merging with its neighbours into one bar.
 */
const rad = (t: NodeType, scale: number) => Math.max(R[t], (t === 'repo' ? Math.min(4, Math.max(1.5, (ROW_PX * scale) / 2 - 1)) : 4) / scale);
/** Vertical padding of the fit: a short pane cannot spare 40 px above and below (labels overhang a node by 8). */
const padY = (height: number) => (height < 300 ? 20 : FIT.y);
const GAP_PX = 130; // screen gap between two columns, at most: room for a 17-character label
const ROW_PX = 24; // vertical pitch of a row: a 14px label fits under its node
const FIT = { left: 56, right: 84, y: 40, maxK: 1.2 }; // screen-px padding (labels overhang their nodes) and the zoom ceiling
const HIT_MS = 3600; // bounded motion after a new graph or selection: draw-on, two particle passes, two pulses
const PULSE_MS = 1200;
const PULSE_REPEATS = 2;

const key = (s: string, t: string) => `${s}>${t}`;
/** A link end is an id until the engine resolves it to the node object. */
const idOf = (end: unknown) => (typeof end === 'object' && end !== null ? (end as GNode).id : String(end));

/** Union of the report's chains. Every link runs with the infection: maintainer -> version -> deps -> repo -> team. */
export function buildGraph(exposures: Exposure[], paths: ExposurePath[], incident: IncidentMeta | null, colPx: number): Graph {
  const bad = new Set(incident?.versions.map((v) => v.id));
  const col = new Map<string, number>(); // versions and dependencies: 1 + their position on the chain
  const nodes = new Map<string, GNode>();
  const links = new Map<string, GLink>();
  const chains = new Map<string, Chain>();
  const node = (id: string, type: NodeType, label = id) => void (nodes.has(id) || nodes.set(id, { id, type, label }));
  /** One edge of `repo`'s chain. */
  const link = (repo: string, source: string, target: string) => {
    let c = chains.get(repo);
    if (!c) chains.set(repo, (c = { nodes: new Set([repo]), links: new Set() }));
    links.set(key(source, target), { source, target });
    c.nodes.add(source).add(target);
    c.links.add(key(source, target));
  };
  const maintainer = incident?.maintainer ?? null;
  const mId = maintainer && `maintainer:${maintainer}`;
  if (mId) node(mId, 'maintainer', maintainer!);

  // Chains with a path: version -> deps (deepest first) -> repo. `chain` is root first and may already end at the version.
  const drafted = new Set<string>();
  for (const p of paths) {
    drafted.add(p.repo);
    const flow = [p.version, ...p.chain.slice(1).filter((id) => id !== p.version).reverse(), p.repo];
    flow.forEach((id, i) => {
      node(id, i === flow.length - 1 ? 'repo' : i === 0 || bad.has(id) ? 'bad' : 'dep');
      if (i < flow.length - 1) col.set(id, Math.max(col.get(id) ?? 1, 1 + i));
      if (i) link(p.repo, flow[i - 1]!, id);
    });
  }
  // Everyone else: the (up to 3) versions shared by the most repos, straight to the repo, so the fan stays readable.
  const shared = new Map<string, number>();
  for (const e of exposures) for (const v of e.versions) shared.set(v, (shared.get(v) ?? 0) + 1);
  for (const e of exposures) {
    node(e.repo, 'repo');
    if (!drafted.has(e.repo)) {
      const vs = [...e.versions].sort((a, b) => shared.get(b)! - shared.get(a)!).slice(0, 3);
      for (const v of vs) {
        node(v, 'bad');
        link(e.repo, v, e.repo);
      }
      if (!vs.length && mId) link(e.repo, mId, e.repo); // MAINTAINER tier: depends on the account's packages
    }
    const team = realTeam(e.team);
    if (team) {
      node(`team:${team}`, 'team', team);
      link(e.repo, e.repo, `team:${team}`);
    }
  }
  if (mId) for (const [repo, c] of chains) for (const id of [...c.nodes]) if (nodes.get(id)?.type === 'bad') link(repo, mId, id);

  // Repos are labelled by name alone unless two share it ("cli" twice), then by owner/name.
  const names = new Map<string, number>();
  const short = (id: string) => repoShort(id).split('/').pop() ?? id;
  for (const n of nodes.values()) if (n.type === 'repo') names.set(short(n.id), (names.get(short(n.id)) ?? 0) + 1);
  for (const n of nodes.values()) if (n.type === 'repo' && names.get(short(n.id))! < 2) n.label = short(n.id);

  let kept = [...nodes.values()];
  const total = kept.length;
  // ponytail: a dropped dependency leaves its chain disconnected; fine while the server caps paths, bridge them if that changes.
  if (total > CAP) kept = kept.sort((a, b) => KEEP[a.type] - KEEP[b.type]).slice(0, CAP);
  const ids = new Set(kept.map((n) => n.id));
  const out = [...links.values()].filter((l) => ids.has(l.source) && ids.has(l.target));
  const reach = new Map<string, number>();
  for (const c of chains.values()) for (const id of c.nodes) reach.set(id, (reach.get(id) ?? 0) + 1);
  const repoCol = 2 + depsOf(paths);
  for (const n of kept) n.fx = ((n.type === 'maintainer' ? 0 : n.type === 'repo' ? repoCol : n.type === 'team' ? repoCol + 1 : (col.get(n.id) ?? 1)) * colPx);
  layoutY(kept, chains, exposures);
  return { nodes: kept, links: out, chains, reach, total };
}

/** Sets `fy`. Repos get one row each, grouped by team; every other node sits at the mean row of the repos it feeds,
 *  then each kind is spread to at least one row pitch. Deterministic, so no force jitter and no overlap. */
function layoutY(nodes: GNode[], chains: Map<string, Chain>, exposures: Exposure[]) {
  const teamRank = new Map<string, number>();
  const rank = new Map<string, number>();
  for (const e of exposures) {
    const t = e.team ?? '';
    if (!teamRank.has(t)) teamRank.set(t, teamRank.size);
    rank.set(e.repo, teamRank.get(t)!);
  }
  const repos = nodes.filter((n) => n.type === 'repo').sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const y = new Map(repos.map((n, i) => [n.id, (i - (repos.length - 1) / 2) * ROW_PX] as const));
  const rows = new Map<string, number[]>();
  for (const [repo, c] of chains) {
    const row = y.get(repo);
    if (row !== undefined) for (const id of c.nodes) (rows.get(id) ?? rows.set(id, []).get(id)!).push(row);
  }
  for (const type of ['dep', 'bad', 'team', 'maintainer'] as const) {
    const group = nodes.filter((n) => n.type === type);
    const want = new Map(group.map((n) => [n.id, (rows.get(n.id) ?? [0]).reduce((a, b) => a + b) / (rows.get(n.id)?.length || 1)] as const));
    group.sort((a, b) => want.get(a.id)! - want.get(b.id)!);
    // Versions get up to two rows each (labels need air) as long as the column stays within the repos' span.
    const pitch = type === 'bad' ? Math.min(2 * ROW_PX, Math.max(ROW_PX, (repos.length * ROW_PX) / (group.length || 1))) : ROW_PX;
    let prev = -Infinity;
    for (const n of group) y.set(n.id, (prev = Math.max(want.get(n.id)!, prev + pitch)));
    const shift = group.reduce((s, n) => s + want.get(n.id)! - y.get(n.id)!, 0) / (group.length || 1);
    for (const n of group) y.set(n.id, y.get(n.id)! + shift);
  }
  // ponytail: a dependency shared by far-apart repos can land on a repo's row in the same column; rare, spread it if it shows.
  for (const n of nodes) n.fy = y.get(n.id);
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
  locked: cssVar('--tier-locked'),
  link: cssVar('--graph-link'),
  active: cssVar('--graph-link-active'),
  label: cssVar('--graph-label'),
  canvas: cssVar('--graph-canvas'),
  fg0: cssVar('--fg-0'),
  fg2: cssVar('--fg-2'),
  card: cssVar('--bg-2'),
  cardLine: cssVar('--line-2'),
  sans: cssVar('--font-sans') || 'Satoshi, sans-serif',
  mono: cssVar('--font-mono') || "'Martian Mono', monospace",
  dimNode: Number(cssVar('--graph-dim-node')) || 0.35,
  dimLink: Number(cssVar('--graph-dim-link')) || 0.2,
});

/** Label text: repos use `label` (name alone unless two share it); a long name@version is clipped in the name so the version stays readable. */
function labelText(n: GNode) {
  if (n.type !== 'bad' && n.type !== 'dep') return n.label;
  const [name, version] = splitRef(n.id);
  const max = 28; // plain-crypto-js@4.2.1 (the axios payload) must stay whole
  return version && n.id.length > max ? `${name.slice(0, Math.max(4, max - version.length - 2))}…@${version}` : n.id.length > max ? `${n.id.slice(0, max - 1)}…` : n.id;
}

export interface PathGraphCanvasProps {
  exposures: Exposure[];
  paths: ExposurePath[];
  incident: IncidentMeta | null;
  selectedRepo: string | null;
  playing: boolean;
  width: number;
  height: number;
  onSelectRepo: (repo: string) => void;
}

export default function PathGraphCanvas({ exposures, paths, incident, selectedRepo, playing, width, height, onSelectRepo }: PathGraphCanvasProps) {
  const reduce = useReducedMotion();
  const fg = useRef<ForceGraphMethods | undefined>(undefined);
  const tok = useMemo(readTokens, []);
  const drawMs = motionTokens().draw * 1000;
  const [hover, setHover] = useState<string | null>(null);

  // Column spacing in graph units: the zoom is set by the rows (one repo each) that fit the pane height, and the
  // columns get up to GAP_PX of screen between them, or whatever the width leaves. So the graph fills the pane
  // whatever its shape (21 repos in one column, or 10 repos behind 3 dependency hops). Snapped to 8 so a drag-resize
  // does not rebuild the graph on every pixel.
  const rows = new Set([...exposures.map((e) => e.repo), ...paths.map((p) => p.repo)]).size || 1;
  const rowScale = Math.max(0.1, Math.min(FIT.maxK, (height - 2 * padY(height)) / (rows * ROW_PX)));
  const colPx = Math.max(8, Math.round(Math.min(GAP_PX, (width - FIT.left - FIT.right) / columnGaps(exposures, paths, incident)) / rowScale / 8) * 8);

  const graphKey = useMemo(() => exposures.map((e) => `${e.repo}:${e.versions.length}`).join() + '|' + paths.map((p) => p.id).join(), [exposures, paths]);
  // Rebuilt only when its inputs change (the key stands in for exposures and paths, which parents re-create): react-force-graph mutates the nodes it is given.
  const graph = useMemo(() => buildGraph(exposures, paths, incident, colPx), [graphKey, incident, colPx]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n as NodeObject<GNode>])), [graph]);
  const byRepo = useMemo(() => new Map(exposures.map((e) => [e.repo, e])), [exposures]);
  // The selected chain wears its repo's tier colour (LOCKED red, WOULD_PULL amber, MAINTAINER steel), not infection red for all.
  const tier = selectedRepo ? byRepo.get(selectedRepo)?.tier : undefined;
  const chainColor = useMemo(() => cssVar(chainVar(tier)) || tok.active, [tier, tok]);
  const firstRepo = useMemo(() => {
    const m = new Map<string, string>();
    for (const [repo, c] of graph.chains) for (const id of c.nodes) m.has(id) || m.set(id, repo);
    return m;
  }, [graph]);
  const chain = (selectedRepo && graph.chains.get(selectedRepo)) || null;

  // Motion clocks are stamped during render, so the first frame of a new selection starts at zero instead of flashing complete.
  const clock = useRef({ sel: 0, graph: 0, selKey: '', graphKey: '' });
  if (clock.current.selKey !== String(selectedRepo)) ((clock.current.selKey = String(selectedRepo)), (clock.current.sel = performance.now()));
  if (clock.current.graphKey !== graphKey) ((clock.current.graphKey = graphKey), (clock.current.graph = performance.now()));
  const [recent, setRecent] = useState(true);
  useEffect(() => {
    setRecent(true);
    const t = setTimeout(() => setRecent(false), HIT_MS);
    return () => clearTimeout(t);
  }, [selectedRepo, graphKey]);

  // Fit the whole graph, labels included, in the pane. Instant: a stale animated fit would fight a resize.
  const box = useRef({ x0: 0, x1: 1 });
  const fit = () => {
    const g = fg.current;
    const ns = graph.nodes as NodeObject<GNode>[];
    if (!g || !ns.length || ns.some((n) => n.x === undefined || n.y === undefined)) return;
    const xs = ns.map((n) => n.x!);
    const ys = ns.map((n) => n.y!);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    box.current = { x0, x1 };
    const k = Math.max(0.05, Math.min((width - FIT.left - FIT.right) / Math.max(x1 - x0, 1), (height - 2 * padY(height)) / Math.max(y1 - y0, 1), FIT.maxK));
    g.zoom(k, 0);
    // The right margin is wider (team labels sit right of their node), so the box centres left of the pane centre.
    g.centerAt((x0 + x1) / 2 - (FIT.left - FIT.right) / (2 * k), (y0 + y1) / 2, 0);
  };
  useEffect(fit, [width, height]);
  // Canvas text does not repaint when a webfont arrives: ask for the labels' fonts, then re-render to redraw.
  const [, fontsReady] = useState(false);
  useEffect(() => {
    void Promise.all([document.fonts.load(`12px ${tok.mono}`), document.fonts.load(`500 12px ${tok.sans}`)]).then(() => fontsReady(true));
  }, [tok]);

  // Particles: on the selected chain for a bounded time, on every link during the landing autoplay, never under reduced motion.
  const emitting = !reduce && (recent || playing);

  // The renderer's own loop runs at 60 Hz for ever, drawing nothing new once the motion is over (and never anything under
  // reduced motion). It runs while something moves or the pointer is over the canvas (hover is read in that loop), for a
  // few frames after any change (a new graph, a resize, a selection, the fonts), and is paused otherwise.
  const [pointer, setPointer] = useState(false);
  const idle = !emitting && !(recent && !reduce) && !pointer;
  useEffect(() => {
    const g = fg.current;
    if (!g) return;
    g.resumeAnimation();
    if (!idle) return;
    let left = 12;
    let raf = requestAnimationFrame(function wait() {
      if (--left > 0) raf = requestAnimationFrame(wait);
      else g.pauseAnimation();
    });
    return () => cancelAnimationFrame(raf);
  });
  const particles = useMemo(
    () =>
      emitting
        ? (l: { source?: unknown; target?: unknown }) => (chain ? (chain.links.has(key(idOf(l.source), idOf(l.target))) ? 2 : 0) : playing ? 1 : 0)
        : 0,
    [emitting, chain, playing],
  );

  const paint = (node: NodeObject, ctx: CanvasRenderingContext2D, scale: number) => {
    const n = node as NodeObject<GNode>;
    const { x = 0, y = 0 } = n;
    const dim = chain !== null && !chain.nodes.has(n.id);
    const r = rad(n.type, scale);
    ctx.save();
    ctx.globalAlpha = dim ? tok.dimNode : 1;
    ctx.beginPath();
    switch (n.type) {
      case 'maintainer':
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = tok.maintainer;
        ctx.fill();
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = tok.ring;
        ctx.stroke();
        break;
      case 'bad': {
        const t = performance.now() - clock.current.graph;
        if (!reduce && !dim && t < PULSE_MS * PULSE_REPEATS) {
          const s = (t % PULSE_MS) / PULSE_MS;
          ctx.arc(x, y, r * (1 + 0.35 * s), 0, 2 * Math.PI);
          ctx.globalAlpha = 0.5 * (1 - s);
          ctx.lineWidth = 1.5 / scale;
          ctx.strokeStyle = tok.pulse;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.beginPath();
        }
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = tok.bad;
        ctx.fill();
        break;
      }
      case 'dep':
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = tok.dep;
        ctx.fill();
        break;
      case 'repo':
        ctx.roundRect(x - r, y - r, 2 * r, 2 * r, 2);
        ctx.fillStyle = tok.repo;
        ctx.fill();
        break;
      case 'team':
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fillStyle = tok.team;
        ctx.fill();
        break;
    }
    // A LOCKED repo (the lockfile pins a malicious version) wears the tier colour, so the worst finding is visible
    // before anything is selected.
    const locked = n.type === 'repo' && byRepo.get(n.id)?.tier === 'LOCKED';
    ctx.lineWidth = 1.5 / scale;
    if (locked) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3 / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = tok.locked;
      ctx.stroke();
    }
    if (n.id === hover || n.id === selectedRepo) {
      // Focus ring (hue-free, docs/design.md section 4): the node under the pointer and the selected repo.
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, r + (locked ? 6 : 3) / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = tok.fg0;
      ctx.stroke();
    }
    ctx.restore();
  };

  const paintLink = (l: { source?: unknown; target?: unknown }, ctx: CanvasRenderingContext2D, scale: number) => {
    const s = l.source as NodeObject<GNode>;
    const t = l.target as NodeObject<GNode>;
    if (s.x === undefined || t.x === undefined || s.y === undefined || t.y === undefined) return;
    const active = chain !== null && chain.links.has(key(s.id, t.id));
    // Draw-on runs with the flow: a link starts when the stroke reaches its source column, then takes half the budget.
    const lead = ((s.x - box.current.x0) / Math.max(box.current.x1 - box.current.x0, 1)) * 0.5 * drawMs;
    const p = active && !reduce ? Math.min(1, Math.max(0, (performance.now() - clock.current.sel - lead) / (0.5 * drawMs))) : 1;
    ctx.save();
    ctx.globalAlpha = chain && !active ? tok.dimLink : 1;
    ctx.lineWidth = (active ? 2 : 1) / scale;
    ctx.strokeStyle = active ? chainColor : tok.link;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + (t.x - s.x) * p, s.y + (t.y - s.y) * p);
    ctx.stroke();
    if (active && p === 1) {
      // Arrowhead just short of the target node: direction stays readable after the particles stop.
      const len = Math.hypot(t.x - s.x, t.y - s.y) || 1;
      const [ux, uy] = [(t.x - s.x) / len, (t.y - s.y) / len];
      const tip = len - rad(t.type, scale) - 2 / scale;
      const [ax, ay, a] = [s.x + ux * tip, s.y + uy * tip, 5 / scale];
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - ux * a * 1.6 - uy * a * 0.8, ay - uy * a * 1.6 + ux * a * 0.8);
      ctx.lineTo(ax - ux * a * 1.6 + uy * a * 0.8, ay - uy * a * 1.6 - ux * a * 0.8);
      ctx.closePath();
      ctx.fillStyle = chainColor;
      ctx.fill();
    }
    ctx.restore();
  };

  /** Second line of the hover card. Counts come from the report, not from the (capped) drawing. */
  const hoverDetail = (n: GNode) => {
    const count = (c: number, one: string, many = `${one}s`) => `${c} ${c === 1 ? one : many}`;
    const e = byRepo.get(n.id);
    switch (n.type) {
      case 'repo':
        return [e?.tier, realTeam(e?.team), e?.synthetic && 'sample repo', e?.dev && 'dev only', e && count(e.versions.length, 'malicious version')].filter(Boolean).join(' · ') || 'repo';
      case 'bad':
        return `malicious version · reaches ${count(exposures.filter((x) => x.versions.includes(n.id)).length, 'repo')}`;
      case 'maintainer':
        return `compromised maintainer · ${count(exposures.length, 'exposed repo')}`;
      case 'team':
        return `team · ${count(graph.reach.get(n.id) ?? 0, 'exposed repo')}`;
      default:
        return `dependency · on ${count(graph.reach.get(n.id) ?? 0, 'path')}`;
    }
  };

  /** Screen-space overlay: labels (collision-culled), the hover card and the truncation note. */
  const paintHud = (ctx: CanvasRenderingContext2D) => {
    const g = fg.current;
    if (!g) return;
    const dpr = window.devicePixelRatio;
    const k = g.zoom();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'top';
    const font = (n: GNode) => (n.type === 'maintainer' || n.type === 'team' ? `500 12px ${tok.sans}` : `12px ${tok.mono}`);
    // Each label tries its preferred sides in order and takes the first spot that overlaps no placed label and no
    // fully-opaque node; if none is free it is skipped, so there is never label soup.
    const nodes = (graph.nodes as NodeObject<GNode>[]).filter((n) => n.x !== undefined && n.y !== undefined);
    const solid = (n: GNode) => !chain || chain.nodes.has(n.id);
    const screen = new Map(nodes.map((n) => [n.id, g.graph2ScreenCoords(n.x!, n.y!)] as const));
    const placed: Box[] = nodes.filter(solid).map((n) => {
      const { x, y } = screen.get(n.id)!;
      const r = rad(n.type, k) * k + 1.5;
      return [x - r, y - r, x + r, y + r, n.id];
    });
    const free = (rect: number[], self: string) =>
      rect[0]! >= 2 && rect[1]! >= 2 && rect[2]! <= width - 2 && rect[3]! <= height - 2 &&
      !placed.some((p) => p[4] !== self && rect[0]! < p[2]! && rect[2]! > p[0]! && rect[1]! < p[3]! && rect[3]! > p[1]!);
    const labelled = nodes
      .filter((n) => n.id !== hover && (chain ? chain.nodes.has(n.id) : n.type === 'repo' || n.type === 'bad' || n.type === 'maintainer'))
      // by kind, then the LOCKED repos (the worst finding always gets its name when the rows are too tight to name them all)
      .sort((a, b) => LABEL_RANK[a.type] - LABEL_RANK[b.type] || Number(byRepo.get(b.id)?.tier === 'LOCKED') - Number(byRepo.get(a.id)?.tier === 'LOCKED'));
    for (const n of labelled) {
      const text = labelText(n);
      ctx.font = font(n);
      const w = ctx.measureText(text).width;
      const { x: sx, y: sy } = screen.get(n.id)!;
      const rr = rad(n.type, k) * k;
      const spots = {
        right: { rect: [sx + rr + 3, sy - 8, sx + rr + 7 + w, sy + 8], x: sx + rr + 5, align: 'left' as const, top: sy - 7 },
        left: { rect: [sx - rr - 7 - w, sy - 8, sx - rr - 3, sy + 8], x: sx - rr - 5, align: 'right' as const, top: sy - 7 },
        below: { rect: [sx - w / 2 - 3, sy + rr + 2, sx + w / 2 + 3, sy + rr + 18], x: sx, align: 'center' as const, top: sy + rr + 3 },
        above: { rect: [sx - w / 2 - 3, sy - rr - 18, sx + w / 2 + 3, sy - rr - 2], x: sx, align: 'center' as const, top: sy - rr - 17 },
      };
      const sides = n.type === 'repo' && chain ? CHAIN_REPO_PLACES : PLACES[n.type];
      const at = sides.map((side) => spots[side]).find((s) => free(s.rect, n.id));
      if (!at) continue;
      placed.push([at.rect[0]!, at.rect[1]!, at.rect[2]!, at.rect[3]!, n.id]);
      ctx.textAlign = at.align;
      ctx.globalAlpha = 0.85; // canvas-coloured plate so edges do not run through the text
      ctx.fillStyle = tok.canvas;
      ctx.fillRect(at.rect[0]!, at.rect[1]!, at.rect[2]! - at.rect[0]!, at.rect[3]! - at.rect[1]!);
      ctx.globalAlpha = 1;
      ctx.fillStyle = chain ? tok.fg0 : tok.label;
      ctx.fillText(text, at.x, at.top);
    }

    const hn = hover ? byId.get(hover) : undefined;
    if (hn && hn.x !== undefined && hn.y !== undefined) {
      const detail = hoverDetail(hn);
      ctx.font = font(hn);
      const title = hn.type === 'repo' ? repoLabel(hn.id) : hn.type === 'bad' || hn.type === 'dep' ? hn.id : hn.label;
      const w1 = ctx.measureText(title).width;
      ctx.font = `12px ${tok.sans}`;
      const w = Math.min(width - 8, Math.max(w1, ctx.measureText(detail).width) + 16);
      const { x: sx, y: sy } = g.graph2ScreenCoords(hn.x, hn.y);
      const rr = rad(hn.type, k) * k;
      const left = Math.min(Math.max(sx - w / 2, 4), width - w - 4);
      const top = sy - rr - 10 - 38 < 4 ? sy + rr + 10 : sy - rr - 10 - 38;
      ctx.fillStyle = tok.card;
      ctx.strokeStyle = tok.cardLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(left, top, w, 38, 6);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = tok.fg0;
      ctx.font = font(hn);
      ctx.fillText(title, left + 8, top + 5, w - 16);
      ctx.fillStyle = tok.label;
      ctx.font = `12px ${tok.sans}`;
      ctx.fillText(detail, left + 8, top + 21, w - 16);
    }

    if (graph.total > CAP) {
      ctx.font = `12px ${tok.sans}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = tok.fg2;
      ctx.fillText(`Showing ${CAP} of ${graph.total} nodes`, 12, height - 22);
    }
    ctx.restore();
  };

  return (
    // a tap's click is read from the hover the loop computes: a paused loop resumes on the press itself, not a render later
    <div onPointerEnter={() => setPointer(true)} onPointerLeave={() => setPointer(false)} onPointerDown={() => fg.current?.resumeAnimation()}>
      <ForceGraph2D
        ref={fg}
        width={width}
        height={height}
        backgroundColor={tok.canvas}
        graphData={graph}
        nodeId="id"
        // Every node is pinned (fx by kind, fy by row), so a few ticks settle it and the fit can run straight away.
        cooldownTicks={3}
        onEngineStop={fit}
        minZoom={0.2}
        maxZoom={6}
        enableNodeDrag={false}
        nodeLabel={() => ''}
        linkLabel={() => ''}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={paint}
        nodePointerAreaPaint={(n, color, ctx, scale) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, Math.max(rad((n as NodeObject<GNode>).type, scale), 6 / scale), 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkCanvasObjectMode={() => 'replace'}
        linkCanvasObject={paintLink}
        linkDirectionalParticles={particles}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleSpeed={0.012}
        linkDirectionalParticleColor={() => chainColor}
        onRenderFramePost={(ctx) => paintHud(ctx)}
        autoPauseRedraw={!recent}
        onNodeClick={(n) => {
          const node = n as NodeObject<GNode>;
          const repo = node.type === 'repo' ? node.id : node.type === 'maintainer' ? undefined : firstRepo.get(node.id);
          if (repo) onSelectRepo(repo);
        }}
        onNodeHover={(n) => setHover(n ? (n as NodeObject<GNode>).id : null)}
      />
    </div>
  );
}
