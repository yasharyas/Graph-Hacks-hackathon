/* ExposureTable: the right pane's table (docs/design.md section 5). A real <table> from 768px (sortable headers
 * with aria-sort, sticky header, numbers right-aligned), cards below 768px (repo, tier + subtitle, last hop, team,
 * one action). One filter row: prod-only toggle (filled and checked when on), tier select, search (repo or team), a
 * "14 of 21 shown" count and, when the parent supplies `onExport`, "Export report" (.md / .json) so the whole-run report
 * is one click from the table, not only inside one repo's drawer.
 * Props:
 *   exposures, paths    Report.exposures / Report.paths
 *   badVersions         malicious name@version ids (IncidentMeta.versions) so chips can underline them
 *   selectedRepo        drives the left bar and, through the parent, the graph; null = none
 *   remediated          repo -> epoch ms of a local or server remediation
 *   undoable            repos still inside the 10 s Undo window
 *   fixable             repos the triage run drafted for (a table scrubbed to another clock can list repos it did not); omit = all
 *   onSelect(repo), onOpenFix(repo), onUndo(repo)
 *   onExport(format)    optional: downloads the whole report and returns the file name; no button without it
 * Geometry: a desktop row is two 18px lines (about 44px): the repo and what it is (team, sample, dev only), the tier,
 * the path as parent then `-> bad version`, and Fix. Identifiers never wrap: they are one line, truncated, with the whole
 * name in `title` (a package name keeps its @version visible: the name gives way, never the version). Type is 12px or more.
 * Keyboard: the rows are ONE tab stop (roving tabindex). Tab lands on the current row's repo button; Up / Down / Home /
 * End move between rows (the same kind of button: repo to repo, Fix to Fix); Enter selects the row (the parent announces
 * it once and draws the path); Tab then reaches that row's Fix and leaves the table. Selected rows stay distinguishable in
 * forced-colors mode (an outline and a thick edge in the Highlight colour).
 * Tier meaning: hover a tier chip (fine pointers) or press the "?" in the Tier header (keyboard, touch, screen reader);
 * the same words are screen-reader text in every chip and printed in the mobile cards. WOULD_PULL rows carry the
 * honest-semantics line (table caption, mobile card). MAINTAINER rows have no Fix: nothing is drafted for them.
 * Repo names are buttons (the accessible name of the row); the row click is a convenience.
 * Untrusted strings (repo, team, package names) render as text only.
 */
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { localStamp, localTime } from '../data/clock.ts';
import { plural } from '../data/format.ts';
import { lockNote, realTeam, repoLabel } from '../data/repoLabel.ts';
import { viewLabel, type ReportView } from '../data/reportView.ts';
import type { Exposure, ExposurePath, Tier } from '../data/types.ts';
import { Button } from './Button.tsx';
import { EmptyState } from './EmptyState.tsx';
import { ArrowRight, ArrowRightToLine, Check, ChevronDown, Download, Undo } from './icons/Glyphs.tsx';
import { HopDots, PathChip, PathChain, splitRef } from './PathChip.tsx';
import { toast } from './Toasts.tsx';
import { HONEST_SEMANTICS, TIER_SUBTITLE, TierChip } from './TierChip.tsx';

const RANK: Record<Tier, number> = { LOCKED: 0, WOULD_PULL: 1, MAINTAINER: 2, CLEAN: 3 };
// Selected-row marker: a 2px inset bar in the tier colour (an inset shadow, so the collapsed table borders stay put).
const BAR: Record<Tier, string> = {
  LOCKED: 'shadow-[inset_2px_0_0_0_var(--tier-locked)]',
  WOULD_PULL: 'shadow-[inset_2px_0_0_0_var(--tier-would-pull)]',
  MAINTAINER: 'shadow-[inset_2px_0_0_0_var(--tier-maintainer)]',
  CLEAN: 'shadow-[inset_2px_0_0_0_var(--tier-clean)]',
};
// Forced colors drop backgrounds and shadows: the selected row keeps an outline and a thick edge in the system Highlight colour.
const FORCED_ROW = 'forced-colors:outline-2 forced-colors:-outline-offset-2 forced-colors:outline-solid forced-colors:outline-[Highlight]';
const FORCED_EDGE = 'forced-colors:border-l-[6px] forced-colors:border-l-[Highlight]';
type SortKey = 'tier' | 'repo' | 'team';
const TAG = 'shrink-0 rounded-xs border border-line-3 px-1 text-xs leading-4 text-fg-1';
const LINE = 'text-xs leading-[18px]';

export interface ExposureTableProps {
  exposures: Exposure[];
  paths: ExposurePath[];
  badVersions: ReadonlySet<string>;
  selectedRepo: string | null;
  remediated: Record<string, number>;
  undoable: ReadonlySet<string>;
  fixable?: ReadonlySet<string>;
  onSelect: (repo: string) => void;
  onOpenFix: (repo: string) => void;
  onUndo: (repo: string) => void;
  /** `view` is set while a filter hides rows: the repos shown, in table order, and the filter in words. */
  onExport?: (format: 'md' | 'json', view?: ReportView) => string;
}

/** `name@1.2.3` on one line: the name truncates, the version never does. */
function Ref({ item, badVersions, dim = false }: { item: string; badVersions: ReadonlySet<string>; dim?: boolean }) {
  const [name, version] = splitRef(item);
  // A scoped name gives up its scope first ("@typescript-eslint/parser" -> "@typ…/parser"): three packages of one scope
  // must not all read "@typescript…".
  const cut = name.startsWith('@') ? name.indexOf('/') + 1 : 0;
  const tone = dim ? 'text-fg-1' : 'text-fg-0';
  return (
    <span className="flex min-w-0 items-baseline whitespace-nowrap">
      {cut > 0 && <span className={`min-w-0 shrink-[100] truncate ${tone}`}>{name.slice(0, cut)}</span>}
      <span className={`min-w-0 truncate ${tone}`}>{name.slice(cut)}</span>
      {version && <span className={`shrink-0 ${badVersions.has(item) ? 'text-infect-400 underline decoration-1 underline-offset-2' : 'text-fg-1'}`}>@{version}</span>}
    </span>
  );
}

/** The table's path, two lines: the parent, then `-> the bad version` and the hops. For a declared-directly path: the range, then the bad version. */
function PathText({ path, direct = false, nodes, hops, badVersions }: { path?: ExposurePath; direct?: boolean; nodes?: string[]; hops: number; badVersions: ReadonlySet<string> }) {
  const chain = nodes ?? (path!.chain.at(-1) === path!.version ? path!.chain : [...path!.chain, path!.version]);
  const shown = direct ? [path!.version] : chain.slice(-2);
  const title = `${direct && path!.range ? `${path!.range} admits ` : ''}${shown.join(' → ')} (${hops === 0 ? 'declared directly by the repo' : `${hops} ${hops === 1 ? 'hop' : 'hops'}`})`;
  const dots = (
    <span className="shrink-0 [&_span]:text-fg-1">
      <HopDots hops={hops} />
    </span>
  );
  return (
    <span className={`flex min-w-0 flex-col font-mono ${LINE}`} title={title}>
      {direct && (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {path!.range && <span className="truncate text-warn">{path!.range}</span>}
          {path!.kind === 'ADMITS' && <ArrowRightToLine size={12} className="shrink-0 text-fg-2" title="admits" />}
        </span>
      )}
      {!direct && shown.length > 1 && <Ref item={shown[0]!} badVersions={badVersions} />}
      <span className="flex min-w-0 items-center gap-1.5">
        {!direct && shown.length > 1 && <ArrowRight size={12} className="shrink-0 text-fg-2" title="requires" />}
        <Ref item={shown.at(-1)!} badVersions={badVersions} />
        {dots}
      </span>
      {/* the range that admits the bad version, for the chain case: in the drawer and the graph; here for screen readers */}
      {!direct && path?.kind === 'ADMITS' && path.range && <span className="sr-only">declares {path.range}</span>}
    </span>
  );
}

/** The "?" next to the Tier header: the three meanings as real text, for keyboard, touch and screen-reader users. */
function TierHelp() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="relative ml-1 inline-flex align-middle"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      {/* Named by text, not by an aria-label that differs from what is drawn (WCAG 2.5.3): the "?" is a decoration, the name is
          words. The circle stays 24px; the button around it is the 44px touch target on a coarse pointer. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex size-6 items-center justify-center rounded-full pointer-coarse:size-11 hov:bg-bg-3"
      >
        <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full border border-line-3 text-xs font-medium text-fg-1 group-aria-expanded:border-fg-0 group-aria-expanded:text-fg-0">
          ?
        </span>
        <span className="sr-only">What the tiers mean</span>
      </button>
      {open && (
        <dl id={id} className="absolute top-full left-0 z-(--z-dropdown) mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-sm bg-bg-2 p-3 text-left text-xs normal-case shadow-popover">
          {(['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as Tier[]).map((t) => (
            <div key={t} className="flex flex-col items-start gap-1">
              <dt>
                <TierChip tier={t} />
              </dt>
              <dd className="text-fg-0">{TIER_SUBTITLE[t]}</dd>
            </div>
          ))}
        </dl>
      )}
    </span>
  );
}

const menuItem = 'flex min-h-(--control-h) w-full items-center gap-2 rounded-xs px-3 text-left text-base text-fg-0 hov:bg-bg-3';

/**
 * "Export report": the run as Markdown or JSON, from the table, so it is not hidden inside one repo's drawer. While a filter
 * hides rows the export holds exactly the rows shown (`view`), and the menu, the toast and the file all say so.
 */
function ExportMenu({ onExport, view, total }: { onExport: (format: 'md' | 'json', view?: ReportView) => string; view: ReportView | undefined; total: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const run = (format: 'md' | 'json') => {
    toast({ message: `Exported ${onExport(format, view)}${view ? ` (${view.label})` : ''}`, tone: 'success' });
    setOpen(false);
    btn.current?.focus();
  };
  return (
    <span
      className="relative ml-auto shrink-0"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          btn.current?.focus();
        }
      }}
    >
      {/* The visible word is short so the toolbar stays one row at 1366px; the name says what is exported and in which formats. */}
      <Button ref={btn} icon={<Download size={14} />} aria-expanded={open} aria-controls={open ? id : undefined} aria-label="Export report (.md / .json)" title="Export report (.md / .json)" onClick={() => setOpen((o) => !o)}>
        Export
      </Button>
      {open && (
        <div id={id} role="group" aria-label="Export report" className="absolute top-full right-0 z-(--z-dropdown) mt-1 w-60 origin-top-right animate-enter rounded-sm border border-line-2 bg-bg-2 p-1 shadow-popover">
          <p className="px-3 py-1 text-xs text-fg-1">{view ? `Only the rows shown: ${view.label}.` : `The whole report, ${plural(total, 'repo')}.`}</p>
          <button type="button" className={menuItem} onClick={() => run('md')}>
            <Download size={16} /> Report (.md)
          </button>
          <button type="button" className={menuItem} onClick={() => run('json')}>
            <Download size={16} /> Report (.json)
          </button>
        </div>
      )}
    </span>
  );
}

export function ExposureTable({ exposures, paths, badVersions, selectedRepo, remediated, undoable, fixable, onSelect, onOpenFix, onUndo, onExport }: ExposureTableProps) {
  const [prodOnly, setProdOnly] = useState(false);
  const [tier, setTier] = useState<Tier | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'tier', dir: 1 });
  const [active, setActive] = useState<string | null>(null); // the row that holds the one tab stop
  const root = useRef<HTMLElement>(null);
  const owed = useRef<string | null>(null); // the row whose Undo was pressed: focus is owed to its repo button once the Undo is gone
  const [undone, setUndone] = useState('');

  const devOnly = exposures.filter((e) => e.dev).length;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cmp = (a: Exposure, b: Exposure) => {
      const by =
        sort.key === 'tier'
          ? RANK[a.tier] - RANK[b.tier]
          : sort.key === 'team'
            ? (a.team ?? '').localeCompare(b.team ?? '')
            : a.repo.localeCompare(b.repo);
      return (by || a.repo.localeCompare(b.repo)) * sort.dir;
    };
    return exposures
      .filter((e) => (!prodOnly || !e.dev) && (tier === 'ALL' || e.tier === tier) && (!q || e.repo.toLowerCase().includes(q) || (e.team ?? '').toLowerCase().includes(q)))
      .sort(cmp);
  }, [exposures, prodOnly, tier, query, sort]);

  // Roving tabindex: the row last focused, else the selected one, else the first (a filtered-out row gives the stop back).
  const current = rows.find((e) => e.repo === active)?.repo ?? rows.find((e) => e.repo === selectedRepo)?.repo ?? rows[0]?.repo ?? null;
  const stop = (repo: string) => (repo === current ? 0 : -1);
  const follow = (e: { target: EventTarget }) => {
    const repo = (e.target as HTMLElement).closest<HTMLElement>('[data-repo]')?.dataset.repo;
    if (repo) setActive(repo);
  };
  /** Up / Down / Home / End move to the same kind of button in the next row: repo to repo, Fix to Fix. */
  const arrows = (e: KeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    const kind = t.dataset.nav;
    if (!kind || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step && e.key !== 'Home' && e.key !== 'End') return;
    const all = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(`[data-nav="${kind}"]`)].filter((b) => !b.disabled && b.offsetParent !== null);
    const next = e.key === 'Home' ? all[0] : e.key === 'End' ? all.at(-1) : all[all.indexOf(t as HTMLButtonElement) + step];
    e.preventDefault();
    next?.focus();
  };

  // The Undo button unmounts when the mark goes: focus would fall to <body> and nothing would say what happened. Land on the
  // row's repo button (the table's one tab stop for it) and announce it.
  useEffect(() => {
    const repo = owed.current;
    if (!repo || remediated[repo] !== undefined) return;
    owed.current = null;
    setActive(repo);
    [...(root.current?.querySelectorAll<HTMLElement>('[data-repo]') ?? [])]
      .find((row) => row.dataset.repo === repo && row.offsetParent !== null)
      ?.querySelector<HTMLElement>('[data-nav="repo"]')
      ?.focus();
  }, [remediated, undoable]);
  const undoRow = (repo: string) => {
    owed.current = repo;
    setUndone(`Undone: ${repo} is open again.`);
    onUndo(repo);
  };

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');

  const pathFor = (e: Exposure) => paths.find((p) => p.repo === e.repo);
  // `dense` (the table): two 18px lines of mono text, never wrapped. The cards (phones) keep the chips.
  const hopCell = (e: Exposure, dense = false) => {
    const path = pathFor(e);
    if (path) {
      // Declared by the repo itself: the repo is not a hop (it would read as a package), so show range, then the bad version.
      const direct = path.hops === 0 && path.chain.length <= 2;
      if (dense) return <PathText path={path} direct={direct} hops={path.hops} badVersions={badVersions} />;
      return (
        <span className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
          {direct ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              {path.range && <span className="font-mono text-xs text-warn">{path.range}</span>}
              {path.kind === 'ADMITS' && <ArrowRightToLine size={12} className="text-fg-2" title="admits" />}
              <PathChip item={path.version} bad={badVersions.has(path.version)} />
            </span>
          ) : (
            <PathChain path={path} badVersions={badVersions} last className="min-w-0" />
          )}
          {/* fg-1, not the dots' own fg-2: 4.3:1 on the selected row's bg-3 is under the 4.5:1 text minimum */}
          <span className="shrink-0 [&_span]:text-fg-1">
            <HopDots hops={path.hops} />
          </span>
        </span>
      );
    }
    const item = e.versions[0] ?? e.packages[0];
    if (item && dense) return <PathText nodes={[item]} hops={e.depth} badVersions={badVersions} />;
    return item ? (
      <span className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
        <PathChip item={item} bad={badVersions.has(item)} />
        {e.packages.length > 1 && <span className="shrink-0 text-xs text-fg-1">+{e.packages.length - 1}</span>}
        <span className="shrink-0 [&_span]:text-fg-1">
          <HopDots hops={e.depth} />
        </span>
      </span>
    ) : null;
  };

  /** `showTeam`: the owner on the second line (phone cards). In the table the owner sits under the tier chip instead. */
  const repoCell = (e: Exposure, showTeam: boolean) => {
    const done = remediated[e.repo] ?? e.remediated?.at;
    const note = showTeam && realTeam(e.team);
    const lock = lockNote(undefined, e.repo); // only a pasted repo (today's or pasted lockfile) is a counterfactual
    return (
      <span className="flex min-w-0 flex-col items-start">
        <button
          type="button"
          data-nav="repo"
          tabIndex={stop(e.repo)}
          title={repoLabel(e.repo)}
          aria-current={selectedRepo === e.repo ? 'true' : undefined}
          onClick={(ev) => (ev.stopPropagation(), onSelect(e.repo))}
          className={`max-w-full scroll-mt-10 truncate rounded-xs text-left text-sm leading-[18px] whitespace-nowrap pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:py-2 ${done ? 'text-fg-2 line-through' : 'text-link'} hov:text-fg-0`}
        >
          {repoLabel(e.repo)}
        </button>
        {(note || e.synthetic || e.dev) && (
          <span className={`flex max-w-full items-center gap-x-1.5 overflow-hidden whitespace-nowrap text-fg-1 ${LINE}`}>
            {note && <span className="truncate">{note}</span>}
            {e.synthetic && <span className={TAG}>sample repo</span>}
            {e.dev && (
              <span className={TAG}>
                dev only<span className="sr-only"> (dev dependencies only)</span>
              </span>
            )}
          </span>
        )}
        {lock && (
          <span className={`${LINE} text-fg-1`}>
            counterfactual<span className="sr-only">. {lock.text}</span>
          </span>
        )}
      </span>
    );
  };

  /** `owner`: the team under the chip (the table, below xl where there is no Team column). */
  const tierCell = (e: Exposure, owner = false) => {
    const done = remediated[e.repo] ?? e.remediated?.at;
    if (done === undefined) {
      return (
        <span className="flex min-w-0 flex-col items-start">
          <TierChip tier={e.tier} tip />
          {owner && realTeam(e.team) && <span className={`max-w-full truncate text-fg-1 md:max-xl:hidden ${LINE}`} title={e.team ?? undefined}>{e.team}</span>}
        </span>
      );
    }
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs text-tier-clean">
        <Check size={14} />
        <span title={`Marked remediated ${localStamp(done)}`}>remediated {localTime(done)}</span>
        {undoable.has(e.repo) && (
          <button
            type="button"
            aria-label={`Undo remediated mark for ${e.repo}`}
            className="inline-flex items-center gap-1 rounded-xs text-link underline underline-offset-2 pointer-coarse:min-h-11"
            onClick={(ev) => (ev.stopPropagation(), undoRow(e.repo))}
          >
            <Undo size={12} /> Undo
          </button>
        )}
      </span>
    );
  };

  /** The selected repo's whole path (or what it reaches, when no path was drafted), for the widths where the graph is another tab. */
  const fullPath = (e: Exposure, className = '') => {
    const path = pathFor(e);
    return (
      <div className={`flex flex-col items-start gap-1 ${className}`}>
        <p className="label-caps text-xs">{path ? `Path ${path.id}` : 'Reaches'}</p>
        {path ? (
          <PathChain path={path} badVersions={badVersions} />
        ) : (
          <span className="inline-flex flex-wrap gap-1">
            {(e.versions.length ? e.versions : e.packages).slice(0, 5).map((v) => (
              <PathChip key={v} item={v} bad={badVersions.has(v)} />
            ))}
          </span>
        )}
      </div>
    );
  };

  /** A ghost button (border on hover and focus): 21 outlined buttons were the heaviest thing in the column. None for MAINTAINER: nothing is drafted for it. */
  const fixButton = (e: Exposure) =>
    e.tier === 'MAINTAINER' ? null : (
      <Button
        variant="ghost"
        data-nav="fix"
        tabIndex={stop(e.repo)}
        disabled={fixable !== undefined && !fixable.has(e.repo)}
        title={fixable && !fixable.has(e.repo) ? 'The triage run did not cover this repo at this clock. Run the triage at this time first.' : undefined}
        onClick={(ev) => (ev.stopPropagation(), onOpenFix(e.repo))}
        aria-label={`Fix ${e.repo}`}
        className="scroll-mt-10 border-transparent px-2.5 max-md:min-w-11 max-md:border-line-3 pointer-coarse:min-w-11 pointer-coarse:border-line-3 hov:border-line-3"
      >
        Fix
      </Button>
    );

  // A plain function (not a component) so the header buttons keep focus across re-renders.
  const sortTh = (k: SortKey, label: string, className = '', extra?: ReactNode) => (
    <th key={k} scope="col" aria-sort={ariaSort(k)} className={`sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-1 text-left ${className}`}>
      <button type="button" onClick={() => toggleSort(k)} className="label-caps inline-flex items-center gap-1 rounded-xs text-xs pointer-coarse:min-h-11 pointer-coarse:min-w-11">
        {label}
        {sort.key === k && <ChevronDown size={12} className={sort.dir === 1 ? '' : 'rotate-180'} />}
      </button>
      {extra}
    </th>
  );

  const filtered = rows.length !== exposures.length;
  const shown = filtered ? `${rows.length} of ${exposures.length} shown` : plural(exposures.length, 'repo');
  // What an export must hold while a filter hides rows: exactly these repos, in this order, and the filter in words.
  const view: ReportView | undefined = filtered ? { repos: rows.map((r) => r.repo), label: viewLabel({ prodOnly, tier, query, shown: rows.length, total: exposures.length }) } : undefined;
  const clearFilters = () => (setProdOnly(false), setTier('ALL'), setQuery(''));

  return (
    <section ref={root} aria-label="Exposed repos" className="flex flex-col" onFocus={follow} onKeyDown={arrows}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-1 px-3 py-2">
        <Button
          aria-pressed={prodOnly}
          icon={prodOnly ? <Check size={14} /> : undefined}
          onClick={() => setProdOnly((p) => !p)}
          className="shrink-0 aria-pressed:border-fg-0 aria-pressed:bg-bg-3 aria-pressed:text-fg-0"
        >
          Prod only
        </Button>
        <select aria-label="Tier" className="field w-auto shrink-0" value={tier} onChange={(e) => setTier(e.target.value as Tier | 'ALL')}>
          <option value="ALL">All tiers</option>
          {(['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as Tier[]).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input aria-label="Filter repos or teams" placeholder="Repo or team" className="field min-w-28 flex-1 basis-28" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        {onExport && <ExportMenu onExport={onExport} view={view} total={exposures.length} />}
        {/* The count is visible only while a filter is on (the summary above already says "21 of 21 exposed"); it always announces. */}
        <p aria-live="polite" className={filtered ? 'shrink-0 text-xs text-fg-1 tabular-nums' : 'sr-only'}>
          {shown}
        </p>
        <p role="status" className="sr-only">
          {undone}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={exposures.length === 0 ? 'No exposed repos' : prodOnly && devOnly ? 'No prod exposures' : 'No matching repos'}
          cause={
            exposures.length === 0
              ? 'At this clock, no repo reaches a malicious version, and none depends on the compromised account’s packages.'
              : prodOnly && devOnly
                ? 'Every exposed repo here reaches the bad version through dev dependencies only.'
                : 'No repo matches these filters.'
          }
          action={
            exposures.length === 0
              ? undefined
              : prodOnly && devOnly && tier === 'ALL' && !query.trim()
                ? { label: `Show dev-only (${devOnly})`, onClick: () => setProdOnly(false) }
                : { label: 'Clear filters', onClick: clearFilters }
          }
        />
      ) : (
        <>
          <table className="hidden w-full table-fixed border-collapse text-sm md:table">
            <caption className="sr-only">Exposed repos. {HONEST_SEMANTICS} Use the arrow keys to move between rows, Enter to select one, Tab to reach its Fix button.</caption>
            <colgroup>
              <col />
              <col className="w-28" />
              <col className="w-[40%]" />
              <col className="hidden w-24 md:table-column xl:hidden" />
              <col className="w-16" />
            </colgroup>
            <thead>
              <tr>
                {sortTh('repo', 'Repo', 'pl-3')}
                {sortTh('tier', 'Tier', '', <TierHelp />)}
                <th scope="col" className="sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-1 text-left">
                  <span className="label-caps text-xs">Path</span>
                </th>
                {sortTh('team', 'Team', 'hidden md:table-cell xl:hidden')}
                <th scope="col" className="sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-1">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const selected = selectedRepo === e.repo;
                return (
                  <Fragment key={e.repo}>
                    <tr data-repo={e.repo} onClick={() => onSelect(e.repo)} className={`cursor-pointer ${selected ? 'max-lg:border-b-0' : ''} border-b border-line-1 hov:bg-bg-3 ${selected ? `bg-bg-3 ${FORCED_ROW}` : ''}`}>
                      <td className={`py-[3px] pr-2 pl-3 align-top ${selected ? `${BAR[e.tier]} ${FORCED_EDGE}` : ''}`}>{repoCell(e, false)}</td>
                      <td className="px-2 py-[3px] align-top">{tierCell(e, true)}</td>
                      <td className="px-2 py-[3px] align-top">{hopCell(e, true)}</td>
                      <td className="hidden px-2 py-[3px] align-top text-fg-1 md:table-cell xl:hidden">
                        <span className={`block truncate ${LINE}`} title={realTeam(e.team) ?? undefined}>
                          {realTeam(e.team) ?? '–'}
                        </span>
                      </td>
                      <td className="py-[3px] pr-3 pl-1 text-right align-top">{fixButton(e)}</td>
                    </tr>
                    {/* Below 1024px the graph is another tab, so the selected row shows its whole path under itself (the phone cards do too). */}
                    {selected && (
                      <tr className="border-b border-line-1 bg-bg-3 lg:hidden">
                        <td colSpan={5} className="px-3 pb-2">
                          {fullPath(e)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <div className="md:hidden">
            {/* Printed, not hover: touch has no tooltip. Said once for the list, not on every WOULD_PULL card. */}
            {rows.some((e) => e.tier === 'WOULD_PULL') && <p className="border-b border-line-1 px-3 py-2 text-xs text-fg-1">{HONEST_SEMANTICS}</p>}
            <ul className="flex flex-col">
              {rows.map((e) => {
                const selected = selectedRepo === e.repo;
                return (
                  <li key={e.repo} data-repo={e.repo} onClick={() => onSelect(e.repo)} className={`flex flex-col gap-2 border-b border-line-1 p-3 ${selected ? `bg-bg-3 ${BAR[e.tier]} ${FORCED_ROW}` : ''}`}>
                    {repoCell(e, true)}
                    <div className="flex flex-col items-start gap-1">
                      {tierCell(e)}
                      <span className="text-xs text-fg-1">{TIER_SUBTITLE[e.tier]}</span>
                    </div>
                    {hopCell(e)}
                    {selected && fullPath(e, 'rounded-xs bg-bg-2 p-2')}
                    {e.tier !== 'MAINTAINER' && <div>{fixButton(e)}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
