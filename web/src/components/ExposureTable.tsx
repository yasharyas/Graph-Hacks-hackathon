/* ExposureTable: the right pane's table (docs/design.md section 5). A real <table> from 768px (sortable headers
 * with aria-sort, sticky header, numbers right-aligned), cards below 768px (repo, tier chip, last hop, team, one action;
 * what each tier means is printed ONCE above the cards, not on every card). One filter row: prod-only toggle (filled and
 * checked when on), tier select, search (repo or team), a "14 of 21 shown" count and, when the parent supplies `onExport`,
 * "Export report" (.md / .json) so the whole-run report is one click from the table, not only inside one repo's drawer;
 * below 1366px the button is the icon alone (it wrapped onto a row of its own), with the same accessible name.
 * Props:
 *   exposures, paths    Report.exposures / Report.paths
 *   badVersions         malicious name@version ids (IncidentMeta.versions) so chips can underline them
 *   selectedRepo        drives the left bar and, through the parent, the graph; null = none
 *   remediated          repo -> epoch ms of a local or server remediation
 *   undoable            repos marked in this session and not yet written (Undo still possible)
 *   fixable             repos the triage run drafted for (a table scrubbed to another clock can list repos it did not); omit = all
 *   onSelect(repo), onOpenFix(repo), onUndo(repo)
 *   onExport(format)    optional: downloads the whole report and returns the file name; no button without it
 * Geometry: a desktop row is two 18px lines (about 44px): the repo and what it is (team, sample, dev only), the tier,
 * the path as parent then `-> bad version`, and Fix. Identifiers never wrap: they are one line, truncated, with the whole
 * name in `title` (a package name keeps its @version visible: the name gives way, never the version). Type is 12px or more.
 * The repo column follows the same rule for the repo (data/repoFit.ts): the OWNER gives way, never the name
 * ("nightwatchjs/nightwatch" -> "ni…/nightwatch" -> "…/nightwatch"), by the cell's measured width at the button's own 13px (the canvas
 * measure was 14px and clipped ids that fit); the button's name and title are the whole id. The level is decided ONCE per column:
 * an id that fits is whole, every other id gives way the same way (the narrowest one's), and never down to the bare name, so a
 * column has at most two shapes ("acme/checkout-web" or "…/checkout-web", never also "checkout-web"). The repo column is 152px at
 * 1440px (it was 132): 3% from the path column from 1440px up, 4px from the Fix column and 4px of padding; from 1280px to 1365px
 * the Fix column is 44px (fine pointers) for the repo. A package's scope in the path column goes the same way and one step
 * further: "…/parser" -> "parser" when even the ellipsis does not fit, so "apidom-reference@1.7.0" stays whole (data/refName.ts).
 * Below 768px the filter row is sticky: the page scrolls there, not the pane, so the pane stops being a scroll container (an effect below).
 * Keyboard: the rows are ONE tab stop (roving tabindex). Tab lands on the current row's repo button; Up / Down / Home /
 * End move between rows (the same kind of button: repo to repo, Fix to Fix); Enter selects the row (the parent announces
 * it once and draws the path); Tab then reaches that row's Fix and leaves the table. Selected rows stay distinguishable in
 * forced-colors mode (an outline and a thick edge in the Highlight colour).
 * Tier meaning: hover a tier chip (fine pointers), or arrow to its row (the popover shows while the row has the keyboard
 * focus; Escape dismisses it, WCAG 1.4.13), or press the "?" in the Tier header (keyboard, touch, screen reader); the same
 * words are screen-reader text in every chip and printed once above the mobile cards. WOULD_PULL rows carry the
 * honest-semantics line (table caption, mobile legend). MAINTAINER rows have no Fix: nothing is drafted for them.
 * Repo names are buttons (the accessible name of the row); the row click is a convenience.
 * Untrusted strings (repo, team, package names) render as text only.
 */
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { plural, utcLabel, utcStamp } from '../data/format.ts';
import { lockNote, realTeam, repoLabel, repoParts } from '../data/repoLabel.ts';
import { charsIn, scopeFit } from '../data/refName.ts';
import { OWNER_KEEP, repoFit, type RepoFit } from '../data/repoFit.ts';
import { viewLabel, type ReportView } from '../data/reportView.ts';
import { emptyCopy, filterRows, sortStatus, whyEmpty } from '../data/tableEmpty.ts';
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
const SORT_LABEL: Record<SortKey, string> = { tier: 'Tier', repo: 'Repo', team: 'Team' };
// max-md: the phone cards have room for a little vertical padding; the dense desktop row keeps its two 18px lines.
const TAG = 'shrink-0 rounded-xs border border-line-3 px-1 text-xs leading-4 text-fg-1 max-md:px-1.5 max-md:py-0.5';
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

/**
 * `name@1.2.3` on one line. The text in the DOM is always the whole ref (it is read aloud as "@tapjs/run", copied whole and
 * found by the browser's search); when it does not fit, only the scope is clipped for the eye, by a rule that depends on the
 * cell's width in characters (data/refName.ts): "@typescript-eslint/parser" -> "@ty…/parser" -> "…/parser" -> "parser" (the last
 * only when even "…/" does not fit: "apidom-reference@1.7.0" stays whole). The package name stays whole and the version
 * always shows; only a long unscoped name in a narrow cell is ever cut, at its end. The whole ref is in the path's title.
 * `max`: characters this line holds.
 */
function Ref({ item, badVersions, max, dim = false }: { item: string; badVersions: ReadonlySet<string>; max: number; dim?: boolean }) {
  const [name, version] = splitRef(item);
  const fit = scopeFit(name, version, max);
  const slash = name.indexOf('/');
  // The name is the one thing that may still give way, and only when nothing else is left to clip (a long unscoped name in a
  // narrow cell): the version never does, it is what says whether the package is the bad one.
  return (
    <span className="flex min-w-0 items-baseline whitespace-nowrap">
      <span className={`min-w-0 truncate ${dim ? 'text-fg-1' : 'text-fg-0'}`}>
        {fit === 'whole' ? (
          name
        ) : fit === 'name' ? (
          <>
            {/* not even "…/" fits: the scope and its slash give way whole, with no sign, and "apidom-reference@1.7.0" stays whole; they stay in the text */}
            <span className="inline-block max-w-0 overflow-hidden align-top">{name.slice(0, slash + 1)}</span>
            {name.slice(slash + 1)}
          </>
        ) : (
          <>
            {/* the scope's first three characters (none, when even that does not fit) with a drawn ellipsis; the rest of it stays in the text */}
            <span className={`inline-block overflow-hidden align-top ${fit === 'short' ? 'max-w-[3ch]' : 'max-w-0'}`}>{name.slice(0, slash)}</span>
            <span aria-hidden>…</span>
            {name.slice(slash)}
          </>
        )}
      </span>
      {version && <span className={`shrink-0 ${badVersions.has(item) ? 'text-infect-400 underline decoration-1 underline-offset-2' : 'text-fg-1'}`}>@{version}</span>}
    </span>
  );
}

/** Characters the hop dots take (with their gap): "direct" is six, a dot per hop otherwise (five at most, then "+N"). */
const dotsWidth = (hops: number) => (hops === 0 ? 6 : Math.min(hops, 5) + (hops > 5 ? 2 : 0)) + 1;

/** The table's path, two lines: the parent, then `-> the bad version` and the hops. For a declared-directly path: the range, then the bad version. `max`: characters a line of the cell holds. */
function PathText({ path, direct = false, nodes, hops, badVersions, max }: { path?: ExposurePath; direct?: boolean; nodes?: string[]; hops: number; badVersions: ReadonlySet<string>; max: number }) {
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
      {!direct && shown.length > 1 && <Ref item={shown[0]!} badVersions={badVersions} max={max} />}
      <span className="flex min-w-0 items-center gap-1.5">
        {!direct && shown.length > 1 && <ArrowRight size={12} className="shrink-0 text-fg-2" title="requires" />}
        {/* the arrow (12px + a gap) and the dots share this line */}
        <Ref item={shown.at(-1)!} badVersions={badVersions} max={max - dotsWidth(hops) - (!direct && shown.length > 1 ? 2 : 0)} />
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
                <TierChip tier={t} define={false} />
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
      {/* The visible word is short so the toolbar stays one row at 1366px; below that the pane is too narrow for the word and the
          button is the icon alone (it wrapped onto a second row of its own at 1280px). Either way the name says what is exported
          and in which formats, and it starts with the visible word. */}
      <Button
        ref={btn}
        icon={<Download size={14} />}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label="Export report (.md / .json)"
        title="Export report (.md / .json)"
        className="max-[1365px]:w-(--control-h) max-[1365px]:px-0"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="max-[1365px]:sr-only">Export</span>
      </Button>
      {open && (
        <div id={id} role="group" aria-label="Export report" className="absolute top-full right-0 z-(--z-dropdown) mt-1 w-60 origin-top-right animate-enter rounded-sm border border-line-2 bg-bg-2 p-1 shadow-popover">
          <p className="px-3 py-1 text-xs text-fg-1">{view ? `Only the rows shown: ${view.label}.` : `The whole report: ${plural(total, 'exposed repo')}. Clean repos are only counted.`}</p>
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

/** Characters one line of the path cell holds, measured on the Path header (every cell under it has the same width). */
function usePathChars(root: RefObject<HTMLElement | null>, mounted: boolean): number {
  const [chars, setChars] = useState(22); // the cell at 1440px, until the first measurement
  useEffect(() => {
    const th = root.current?.querySelector('thead th:nth-child(3)');
    if (!th) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setChars(charsIn(entry.contentRect.width));
    });
    ro.observe(th);
    return () => ro.disconnect();
  }, [root, mounted]);
  return chars;
}

/**
 * What data/repoFit.ts needs about the repo column: the pixels one line of its cell holds (measured on the Repo header, less the
 * cell's own padding) and a text-width function in the cell's font (the browser's own shaping, through a canvas), measured again
 * once the font has loaded.
 */
function useRepoColumn(root: RefObject<HTMLElement | null>, mounted: boolean): { px: number; width: (text: string) => number } {
  const [px, setPx] = useState(150); // the cell at 1440px, until the first measurement
  const [fontReady, setFontReady] = useState(0);
  useEffect(() => {
    const th = root.current?.querySelector('thead th:nth-child(1)');
    if (!th) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.borderBoxSize?.[0]?.inlineSize ?? entry?.contentRect.width ?? 0;
      if (w > 0) setPx(Math.floor(w) - 16); // the cell's pl-3 and pr-1
    });
    ro.observe(th);
    return () => ro.disconnect();
  }, [root, mounted]);
  useEffect(() => {
    const again = () => setFontReady((n) => n + 1);
    void document.fonts.ready.then(again);
    document.fonts.addEventListener('loadingdone', again);
    return () => document.fonts.removeEventListener('loadingdone', again);
  }, []);
  const width = useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    // The repo button is text-sm (13px, --text-sm): measuring at 14px over-counts by 8% and clips ids that fit.
    const sm = root.current ? parseFloat(getComputedStyle(root.current).getPropertyValue('--text-sm')) * parseFloat(getComputedStyle(document.documentElement).fontSize) : NaN;
    if (ctx) ctx.font = `${sm > 0 ? sm : 13}px ${root.current ? getComputedStyle(root.current).fontFamily : 'sans-serif'}`;
    const cache = new Map<string, number>();
    return (text: string) => {
      let w = cache.get(text);
      if (w === undefined) cache.set(text, (w = ctx ? ctx.measureText(text).width : text.length * 7.3));
      return w;
    };
  }, [root, fontReady]); // a new measure only when a font has loaded
  return { px, width };
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
  const hasTeams = exposures.some((e) => realTeam(e.team)); // a pasted repo has none: no Team column, no owner line
  const rows = useMemo(() => {
    const cmp = (a: Exposure, b: Exposure) => {
      const by =
        sort.key === 'tier'
          ? RANK[a.tier] - RANK[b.tier]
          : sort.key === 'team'
            ? (a.team ?? '').localeCompare(b.team ?? '')
            : a.repo.localeCompare(b.repo);
      return (by || a.repo.localeCompare(b.repo)) * sort.dir;
    };
    return filterRows(exposures, { prodOnly, tier, query }).sort(cmp);
  }, [exposures, prodOnly, tier, query, sort]);
  const chars = usePathChars(root, rows.length > 0);
  const { px: repoPx, width: textWidth } = useRepoColumn(root, rows.length > 0);
  // One clip shape for the column: a row whose id fits shows it whole (so `acme/checkout-web` keeps its owner wherever it fits);
  // the others all give way the same way, as far as the narrowest of them needs ("ni…/nightwatch", or "…/nightwatch" for all if
  // one owner is long enough to need it). Never the bare name (a column of `ap…/appium`, `…/insomnia` and `uptime-kuma` has
  // three shapes): if even "…/" + name is too wide, the name is cut at its end after the "…/".
  const repoFits = useMemo(() => {
    const rank: Record<RepoFit, number> = { whole: 0, short: 1, tiny: 2, name: 3 };
    const own = new Map(rows.map((e) => [e.repo, repoFit(repoParts(e.repo), repoPx, textWidth)] as const));
    const worst = [...own.values()].reduce<RepoFit>((a, f) => (rank[f] > rank[a] ? f : a), 'whole');
    const clip: RepoFit = worst === 'name' ? 'tiny' : worst;
    return new Map([...own].map(([repo, f]) => [repo, f === 'whole' ? f : clip] as const));
  }, [rows, repoPx, textWidth]);
  const filtered = rows.length !== exposures.length;
  const shown = filtered ? `${rows.length} of ${exposures.length} shown` : plural(exposures.length, 'repo');
  // What a screen reader hears: one sentence about the filter, spoken once the typing pauses (a word typed recounts two or three
  // times), at once for a switch or a sort. It starts as the current count, so nothing is announced on load.
  const [said, setSaid] = useState(shown);
  const typing = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => setSaid(shown), typing.current ? 700 : 0);
    typing.current = false;
    return () => clearTimeout(t);
  }, [shown]);

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
    setUndone(`Undone: ${repoLabel(repo)} is open again.`);
    onUndo(repo);
  };

  // The sort is a discrete action: it is spoken at once ("Sorted by repo, ascending"); aria-sort only marks the header.
  const toggleSort = (key: SortKey) => {
    const dir = sort.key === key && sort.dir === 1 ? -1 : 1;
    setSort({ key, dir });
    setSaid(sortStatus(SORT_LABEL[key], dir));
  };
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');

  const pathFor = (e: Exposure) => paths.find((p) => p.repo === e.repo);
  // `dense` (the table): two 18px lines of mono text, never wrapped. The cards (phones) keep the chips.
  const hopCell = (e: Exposure, dense = false) => {
    const path = pathFor(e);
    if (path) {
      // Declared by the repo itself: the repo is not a hop (it would read as a package), so show range, then the bad version.
      const direct = path.hops === 0 && path.chain.length <= 2;
      if (dense) return <PathText path={path} direct={direct} hops={path.hops} badVersions={badVersions} max={chars} />;
      // fg-1, not the dots' own fg-2: 4.3:1 on the selected row's bg-3 is under the 4.5:1 text minimum. The dots stay on the
      // last chip's line: alone on a line they read as a stray bullet.
      const dots = (
        <span className="shrink-0 [&_span]:text-fg-1">
          <HopDots hops={path.hops} />
        </span>
      );
      return (
        <span className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
          {direct ? (
            <span className="inline-flex max-w-full items-center gap-1">
              {path.range && <span className="font-mono text-xs text-warn">{path.range}</span>}
              {path.kind === 'ADMITS' && <ArrowRightToLine size={12} className="shrink-0 text-fg-2" title="admits" />}
              <PathChip item={path.version} bad={badVersions.has(path.version)} />
              <span className="ml-1 inline-flex">{dots}</span>
            </span>
          ) : (
            <PathChain path={path} badVersions={badVersions} last className="min-w-0" trail={<span className="ml-1 inline-flex">{dots}</span>} />
          )}
        </span>
      );
    }
    const item = e.versions[0] ?? e.packages[0];
    if (item && dense) return <PathText nodes={[item]} hops={e.depth} badVersions={badVersions} max={chars} />;
    return item ? (
      <span className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
        <PathChip item={item} bad={badVersions.has(item)} />
        {/* the count and the dots wrap together, never one alone */}
        <span className="inline-flex items-center gap-2">
          {e.packages.length > 1 && <span className="shrink-0 text-xs text-fg-1">+{e.packages.length - 1}</span>}
          <span className="shrink-0 [&_span]:text-fg-1">
            <HopDots hops={e.depth} />
          </span>
        </span>
      </span>
    ) : null;
  };

  /** `showTeam`: the owner on the second line (phone cards). In the table the owner sits under the tier chip instead. */
  const repoCell = (e: Exposure, showTeam: boolean) => {
    const done = remediated[e.repo] ?? e.remediated?.at;
    const note = showTeam && realTeam(e.team);
    const lock = lockNote(undefined, e.repo); // only a pasted repo (today's or pasted lockfile) is a counterfactual
    const parts = repoParts(e.repo);
    const label = repoLabel(e.repo);
    // A phone card has the whole width; the table's cell is narrow, and only its OWNER gives way (data/repoFit.ts), the same way for the whole column.
    const fit = showTeam ? 'whole' : (repoFits.get(e.repo) ?? 'whole');
    // What is drawn when the owner gives way (the same texts data/repoFit.ts measured). It is drawn from an attribute, not written as
    // text, so the page's text stays the whole id (below, as screen-reader text) and the button's name is the whole id too.
    const keep = parts.owner?.slice(0, OWNER_KEEP) ?? '';
    const drawn = { whole: label, short: `${keep}…/${parts.name}${parts.tail}`, tiny: `…/${parts.name}${parts.tail}`, name: `${parts.name}${parts.tail}` }[fit];
    return (
      <span className="flex min-w-0 flex-col items-start">
        {/* The repo's name is the row's identity, so it is never the part that is cut. When the cell is too narrow the OWNER gives
            way first, by the path column's own kind of rule ("nightwatchjs/nightwatch" -> "ni…/nightwatch" -> "…/nightwatch" ->
            "nightwatch"); only a name longer than the whole cell is ever cut, at its end. The page's text is always the whole id (a
            clipped one is drawn from data-drawn, with the whole id beside it as screen-reader text), so the button's name, a search
            and a copy all have "owner/name"; aria-label is that same id, so what is drawn never differs from the name (WCAG 2.5.3). */}
        <button
          type="button"
          data-nav="repo"
          tabIndex={stop(e.repo)}
          title={label}
          aria-label={label}
          aria-current={selectedRepo === e.repo ? 'true' : undefined}
          onClick={(ev) => (ev.stopPropagation(), onSelect(e.repo))}
          className={`flex max-w-full min-w-0 scroll-mt-10 max-md:scroll-mt-32 rounded-xs text-left text-sm leading-[18px] whitespace-nowrap pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:py-2 ${done ? 'text-fg-1 line-through' : 'text-link'} hov:text-fg-0`}
        >
          {fit === 'whole' ? (
            <span className="min-w-0 truncate">{label}</span>
          ) : (
            <>
              <span aria-hidden data-drawn={drawn} className="min-w-0 truncate select-none before:content-[attr(data-drawn)]" />
              <span className="sr-only">{label}</span>
            </>
          )}
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
          <TierChip tier={e.tier} tip={owner} />
          {owner && realTeam(e.team) && <span className={`max-w-full truncate text-fg-1 md:max-xl:hidden ${LINE}`} title={e.team ?? undefined}>{e.team}</span>}
        </span>
      );
    }
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs text-tier-clean">
        <Check size={14} />
        <span title={`Marked remediated ${utcStamp(done)}`}>remediated {utcLabel(done)}</span>
        {undoable.has(e.repo) && (
          <button
            type="button"
            aria-label={`Undo remediated mark for ${repoLabel(e.repo)}`}
            className="inline-flex items-center justify-center gap-1 rounded-xs text-link underline underline-offset-2 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
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
        aria-label={`Fix ${repoLabel(e.repo)}`}
        className="scroll-mt-10 max-md:scroll-mt-32 border-transparent px-2.5 pointer-fine:min-[1280px]:max-[1365px]:px-1.5 max-md:min-w-11 max-md:border-line-3 pointer-coarse:min-w-11 pointer-coarse:border-line-3 hov:border-line-3"
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

  // What an export must hold while a filter hides rows: exactly these repos, in this order, and the filter in words.
  const view: ReportView | undefined = filtered ? { repos: rows.map((r) => r.repo), label: viewLabel({ prodOnly, tier, query, shown: rows.length, total: exposures.length }) } : undefined;
  const clearFilters = () => ((typing.current = false), setProdOnly(false), setTier('ALL'), setQuery(''));
  const emptyWhy = rows.length === 0 ? whyEmpty(exposures, { prodOnly, tier, query }) : null;
  const empty = emptyWhy && emptyCopy(emptyWhy);
  const hintId = useId();
  const tiersShown = (['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as Tier[]).filter((t) => rows.some((e) => e.tier === t)); // the phone list's key, one line per tier on screen

  return (
    <section ref={root} aria-label="Exposed repos" className="flex flex-col" onFocus={follow} onKeyDown={arrows}>
      {/* On a phone the page scrolls (not this pane): the filters stay at the top while the 21 cards go by, and end with the table. The pane
          around it stops being a scroll container there (the effect above), or sticky would have nothing to stick to. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line-1 bg-bg-1 px-3 py-2 max-md:sticky max-md:top-0 max-md:z-(--z-sticky)">
        <Button
          aria-pressed={prodOnly}
          icon={prodOnly ? <Check size={14} /> : undefined}
          onClick={() => ((typing.current = false), setProdOnly((p) => !p))}
          className="shrink-0 aria-pressed:border-fg-0 aria-pressed:bg-bg-3 aria-pressed:text-fg-0"
        >
          Prod only
        </Button>
        <select aria-label="Tier" className="field w-auto shrink-0" value={tier} onChange={(e) => ((typing.current = false), setTier(e.target.value as Tier | 'ALL'))}>
          <option value="ALL">All tiers</option>
          {(['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as Tier[]).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input aria-label="Filter repos or teams" placeholder="Repo or team" className="field min-w-28 flex-1 basis-28" type="search" value={query} onChange={(e) => ((typing.current = true), setQuery(e.target.value))} />
        {onExport && <ExportMenu onExport={onExport} view={view} total={exposures.length} />}
        {/* The count is printed only while a filter is on (the summary above already says "21 of 21 exposed"). It is not the live
            region: that is the status below, which speaks once typing pauses and also says how the table was sorted. */}
        <p aria-hidden className={filtered ? 'shrink-0 text-xs text-fg-1 tabular-nums' : 'hidden'}>
          {shown}
        </p>
        <p role="status" className="sr-only">
          {said}
        </p>
        <p role="status" className="sr-only">
          {undone}
        </p>
      </div>

      {empty ? (
        <EmptyState
          title={empty.title}
          cause={empty.cause}
          action={
            emptyWhy?.kind === 'none'
              ? undefined
              : emptyWhy?.kind === 'devOnly'
                ? { label: empty.action, onClick: () => ((typing.current = false), setProdOnly(false)) }
                : { label: empty.action, onClick: clearFilters }
          }
        />
      ) : (
        <>
          {/* A pasted repo has no owner to name beside its tier, so its tier is explained here, once, in plain words. */}
          {!hasTeams && rows.some((e) => e.tier === 'WOULD_PULL') && (
            <p className="hidden items-center gap-2 border-b border-line-1 px-3 py-2 text-xs text-fg-1 md:flex">
              <span aria-hidden>
                <TierChip tier="WOULD_PULL" />
              </span>
              <span>
                <span className="sr-only">WOULD_PULL: </span>
                {HONEST_SEMANTICS}
              </span>
            </p>
          )}
          {/* The caption is the table's name; what to do with it is a description, read once on entry instead of at every row. */}
          <p id={hintId} className="sr-only">
            {HONEST_SEMANTICS} Use the arrow keys to move between rows, Enter to select one, Tab to reach its Fix button.
          </p>
          <table aria-describedby={hintId} className="hidden w-full table-fixed border-collapse text-sm md:table">
            <caption className="sr-only">Exposed repos</caption>
            <colgroup>
              <col />
              <col className="w-28" />
              {/* the path gets the width the Fix button does not need: 22 characters of mono text at 1366px, so "…/type-utils@8.39.1" fits;
                  from 1440px it has 30px to spare, which go to the repo column (the owner clips there, never the name). The pane is 460px from 1280px
                  to 1365px: the tier chip needs its 112px, so the Fix column takes 8px less (44px, a Fix button with 6px sides, fine pointers) for the repo, and the
                  path cell drops its right padding (8px more: 22 characters, so "apidom-reference@1.7.0" and "azure-kusto-data@7.0.4" stay whole). */}
              <col className="w-[42%] min-[1440px]:w-[39%]" />
              {hasTeams && <col className="hidden w-24 md:table-column xl:hidden" />}
              <col className="w-13 pointer-fine:min-[1280px]:max-[1365px]:w-11 pointer-coarse:w-16" />
            </colgroup>
            <thead>
              <tr>
                {sortTh('repo', 'Repo', 'pl-3')}
                {sortTh('tier', 'Tier', '', <TierHelp />)}
                <th scope="col" className="sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-1 text-left min-[1280px]:max-[1365px]:pr-0">
                  <span className="label-caps text-xs">Path</span>
                </th>
                {hasTeams && sortTh('team', 'Team', 'hidden md:table-cell xl:hidden')}
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
                      <td className={`py-[3px] pr-1 pl-3 align-top ${selected ? `${BAR[e.tier]} ${FORCED_EDGE}` : ''}`}>{repoCell(e, false)}</td>
                      <td className="px-2 py-[3px] align-top">{tierCell(e, true)}</td>
                      <td className="px-2 py-[3px] align-top min-[1280px]:max-[1365px]:pr-0">{hopCell(e, true)}</td>
                      {hasTeams && (
                        <td className="hidden px-2 py-[3px] align-top text-fg-1 md:table-cell xl:hidden">
                          <span className={`block truncate ${LINE}`} title={realTeam(e.team) ?? undefined}>
                            {realTeam(e.team) ?? '–'}
                          </span>
                        </td>
                      )}
                      <td className="py-[3px] pr-3 pl-0 text-right align-top">{fixButton(e)}</td>
                    </tr>
                    {/* Below 1024px the graph is another tab, so the selected row shows its whole path under itself (the phone cards do too). */}
                    {selected && (
                      <tr className="border-b border-line-1 bg-bg-3 lg:hidden">
                        <td colSpan={hasTeams ? 5 : 4} className="px-3 pb-2">
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
            {/* Printed, not hover: touch has no tooltip. Each tier's meaning is said ONCE for the list (20 WOULD_PULL cards used to
                repeat the same sentence 20 times); the cards carry the chip alone, whose screen-reader text has the meaning. */}
            {tiersShown.length > 0 && (
              <dl className="flex flex-col gap-2 border-b border-line-1 px-3 py-2 text-xs text-fg-1">
                {tiersShown.map((t) => (
                  <div key={t} className="flex flex-col items-start gap-1">
                    <dt>
                      <span aria-hidden>
                        <TierChip tier={t} define={false} />
                      </span>
                      <span className="sr-only">{t}</span>
                    </dt>
                    <dd>{t === 'WOULD_PULL' ? HONEST_SEMANTICS : TIER_SUBTITLE[t]}</dd>
                  </div>
                ))}
              </dl>
            )}
            <ul className="flex flex-col">
              {rows.map((e) => {
                const selected = selectedRepo === e.repo;
                return (
                  <li key={e.repo} data-repo={e.repo} onClick={() => onSelect(e.repo)} className={`flex flex-col gap-2 border-b border-line-1 p-3 ${selected ? `bg-bg-3 ${BAR[e.tier]} ${FORCED_ROW}` : ''}`}>
                    {repoCell(e, true)}
                    {tierCell(e)}
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
