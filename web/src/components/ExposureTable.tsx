/* ExposureTable: the right pane's table (docs/design.md section 5). A real <table> from 768px (sortable headers
 * with aria-sort, sticky header, numbers right-aligned), cards below 768px (repo, tier + subtitle, last hop, team,
 * one action). One filter row: prod-only toggle (filled and checked when on), tier select, search (repo or team) and a
 * "14 of 21 shown" count. The team column folds into the repo cell below xl.
 * Props:
 *   exposures, paths    Report.exposures / Report.paths
 *   badVersions         malicious name@version ids (IncidentMeta.versions) so chips can underline them
 *   selectedRepo        drives the left bar and, through the parent, the graph; null = none
 *   remediated          repo -> epoch ms of a local or server remediation
 *   undoable            repos still inside the 10 s Undo window
 *   fixable             repos the triage run drafted for (a table scrubbed to another clock can list repos it did not); omit = all
 *   onSelect(repo), onOpenFix(repo), onUndo(repo)
 * Tier meaning: hover a tier chip (fine pointers) or press the "?" in the Tier header (keyboard, touch, screen reader);
 * the same words are screen-reader text in every chip and printed in the mobile cards. WOULD_PULL rows carry the
 * honest-semantics line (table caption, mobile card). MAINTAINER rows have no Fix: nothing is drafted for them.
 * Repo names are buttons (the accessible name of the row); the row click is a convenience.
 * Untrusted strings (repo, team, package names) render as text only.
 */
import { Fragment, useId, useMemo, useState, type ReactNode } from 'react';
import { HEAD_NOTE, isHead, plural, utc } from '../data/format.ts';
import type { Exposure, ExposurePath, Tier } from '../data/types.ts';
import { Button } from './Button.tsx';
import { EmptyState } from './EmptyState.tsx';
import { ArrowRight, ArrowRightToLine, Check, ChevronDown, Undo } from './icons/Glyphs.tsx';
import { HopDots, PathChain, PathChip, splitRef } from './PathChip.tsx';
import { HONEST_SEMANTICS, TIER_SUBTITLE, TierChip } from './TierChip.tsx';

const RANK: Record<Tier, number> = { LOCKED: 0, WOULD_PULL: 1, MAINTAINER: 2, CLEAN: 3 };
// Selected-row marker: a 2px inset bar in the tier colour (an inset shadow, so the collapsed table borders stay put).
const BAR: Record<Tier, string> = {
  LOCKED: 'shadow-[inset_2px_0_0_0_var(--tier-locked)]',
  WOULD_PULL: 'shadow-[inset_2px_0_0_0_var(--tier-would-pull)]',
  MAINTAINER: 'shadow-[inset_2px_0_0_0_var(--tier-maintainer)]',
  CLEAN: 'shadow-[inset_2px_0_0_0_var(--tier-clean)]',
};
type SortKey = 'tier' | 'repo' | 'team';
const TAG = 'rounded-xs border border-line-3 px-1 text-2xs text-fg-1';

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
}

/** "owner/name" with a line-break opportunity after the slash, so a narrow cell wraps at the owner instead of mid-word. */
const breakable = (repo: string) =>
  repo.split('/').map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          /<wbr />
        </>
      )}
      {part}
    </Fragment>
  ));

/** The table's path: the parent, then `-> the bad version`, as mono text. For a declared-directly path: the range, then the bad version. */
function PathText({ path, direct = false, nodes, hops, badVersions }: { path?: ExposurePath; direct?: boolean; nodes?: string[]; hops: number; badVersions: ReadonlySet<string> }) {
  const chain = nodes ?? (path!.chain.at(-1) === path!.version ? path!.chain : [...path!.chain, path!.version]);
  const shown = direct ? [path!.version] : chain.slice(-2);
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 font-mono text-xs leading-[18px]">
      {direct && path!.range && <span className="text-warn">{path!.range}</span>}
      {direct && path!.kind === 'ADMITS' && <ArrowRightToLine size={12} className="text-fg-2" title="admits" />}
      {shown.map((item, i) => {
        const [name, version] = splitRef(item);
        const last = i === shown.length - 1;
        return (
          <span key={`${item}-${i}`} className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]">
            {i > 0 && <ArrowRight size={12} className="shrink-0 text-fg-2" title="requires" />}
            <span>
              <span className="text-fg-0">{name}</span>
              {version && <span className={badVersions.has(item) ? 'text-infect-400 underline decoration-1 underline-offset-2' : 'text-fg-1'}>@{version}</span>}
            </span>
            {/* the hop dots end the last line (fg-1: the dots' own fg-2 is 4.3:1 on the selected row's bg-3, under the 4.5:1 text minimum) */}
            {last && (
              <span className="shrink-0 [&_span]:text-fg-1">
                <HopDots hops={hops} />
              </span>
            )}
          </span>
        );
      })}
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
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label="What the tiers mean"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-6 items-center justify-center rounded-full border border-line-3 text-xs font-medium text-fg-1 aria-expanded:border-fg-0 aria-expanded:text-fg-0 hov:text-fg-0"
      >
        ?
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

export function ExposureTable({ exposures, paths, badVersions, selectedRepo, remediated, undoable, fixable, onSelect, onOpenFix, onUndo }: ExposureTableProps) {
  const [prodOnly, setProdOnly] = useState(false);
  const [tier, setTier] = useState<Tier | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'tier', dir: 1 });

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

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');

  const pathFor = (e: Exposure) => paths.find((p) => p.repo === e.repo);
  // The chain may wrap onto two lines (parent, then the bad version); the hop dots stay beside it, not on a third line.
  // `dense` (the table): the last hop as plain mono text, 18px a line, not 24px chips: a deep chain no longer makes a 100px row.
  const hopCell = (e: Exposure, dense = false) => {
    const path = pathFor(e);
    if (path) {
      // Declared by the repo itself: the repo is not a hop (it would read as a package), so show range, then the bad version.
      const direct = path.hops === 0 && path.chain.length <= 2;
      if (dense) return <PathText path={path} direct={direct} hops={path.hops} badVersions={badVersions} />;
      return (
        <span className="inline-flex max-w-full items-center gap-x-2">
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
      <span className="inline-flex max-w-full items-center gap-x-2">
        <PathChip item={item} bad={badVersions.has(item)} />
        {e.packages.length > 1 && <span className="shrink-0 text-xs text-fg-1">+{e.packages.length - 1}</span>}
        <span className="shrink-0 [&_span]:text-fg-1">
          <HopDots hops={e.depth} />
        </span>
      </span>
    ) : null;
  };

  /** `showTeam`: the owner under the repo name (phone cards). In the table the owner sits under the tier chip instead. */
  const repoCell = (e: Exposure, showTeam: boolean) => {
    const done = remediated[e.repo] ?? e.remediated?.at;
    const note = showTeam && e.team;
    return (
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <button
          type="button"
          aria-current={selectedRepo === e.repo ? 'true' : undefined}
          onClick={(ev) => (ev.stopPropagation(), onSelect(e.repo))}
          className={`max-w-full rounded-xs text-left text-sm break-words pointer-coarse:min-h-11 pointer-coarse:py-2 ${done ? 'text-fg-2 line-through' : 'text-link'} hov:text-fg-0`}
        >
          {breakable(e.repo)}
        </button>
        {(note || e.synthetic || e.dev) && (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-1">
            {note && <span>{e.team}</span>}
            {e.synthetic && <span className={TAG}>sample repo</span>}
            {e.dev && (
              <span className={TAG}>
                dev only<span className="sr-only"> (dev dependencies only)</span>
              </span>
            )}
          </span>
        )}
        {isHead(e.repo) && <span className="text-2xs text-fg-1">current lockfile, counterfactual<span className="sr-only">. {HEAD_NOTE}</span></span>}
      </span>
    );
  };

  /** `owner`: the team under the chip (the table, below xl where there is no Team column). */
  const tierCell = (e: Exposure, owner = false) => {
    const done = remediated[e.repo] ?? e.remediated?.at;
    if (done === undefined) {
      return (
        <span className="flex flex-col items-start gap-0.5">
          <TierChip tier={e.tier} tip />
          {owner && e.team && <span className="text-xs text-fg-1 md:max-xl:hidden">{e.team}</span>}
        </span>
      );
    }
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs text-tier-clean">
        <Check size={14} />
        remediated {utc(done)}
        {undoable.has(e.repo) && (
          <button type="button" className="inline-flex items-center gap-1 rounded-xs text-link underline underline-offset-2 pointer-coarse:min-h-11" onClick={(ev) => (ev.stopPropagation(), onUndo(e.repo))}>
            <Undo size={12} /> Undo
          </button>
        )}
      </span>
    );
  };

  /** A ghost button (border on hover and focus): 21 outlined buttons were the heaviest thing in the column. None for MAINTAINER: nothing is drafted for it. */
  const fixButton = (e: Exposure) =>
    e.tier === 'MAINTAINER' ? null : (
      <Button
        variant="ghost"
        disabled={fixable !== undefined && !fixable.has(e.repo)}
        title={fixable && !fixable.has(e.repo) ? 'The triage run did not cover this repo at this clock. Run the triage at this time first.' : undefined}
        onClick={(ev) => (ev.stopPropagation(), onOpenFix(e.repo))}
        aria-label={`Fix ${e.repo}`}
        className="border-transparent px-2.5 max-md:border-line-3 pointer-coarse:border-line-3 hov:border-line-3"
      >
        Fix
      </Button>
    );

  // A plain function (not a component) so the header buttons keep focus across re-renders.
  const sortTh = (k: SortKey, label: string, className = '', extra?: ReactNode) => (
    <th key={k} scope="col" aria-sort={ariaSort(k)} className={`sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-1 text-left ${className}`}>
      <button type="button" onClick={() => toggleSort(k)} className="label-caps inline-flex items-center gap-1 rounded-xs">
        {label}
        {sort.key === k && <ChevronDown size={12} className={sort.dir === 1 ? '' : 'rotate-180'} />}
      </button>
      {extra}
    </th>
  );

  const shown = rows.length === exposures.length ? plural(exposures.length, 'repo') : `${rows.length} of ${exposures.length} shown`;

  return (
    <section aria-label="Exposed repos" className="flex flex-col">
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
        <input aria-label="Filter repos or teams" placeholder="Filter repo or team" className="field min-w-28 flex-1 basis-28" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <p aria-live="polite" className="shrink-0 text-xs text-fg-1 tabular-nums">
          {shown}
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
          action={prodOnly && devOnly ? { label: `Show dev-only (${devOnly})`, onClick: () => setProdOnly(false) } : undefined}
        />
      ) : (
        <>
          <table className="hidden w-full table-fixed border-collapse text-sm md:table">
            <caption className="sr-only">Exposed repos. {HONEST_SEMANTICS}</caption>
            <colgroup>
              <col />
              <col className="w-30" />
              <col className="w-[38%]" />
              <col className="hidden w-24 md:table-column xl:hidden" />
              <col className="w-16" />
            </colgroup>
            <thead>
              <tr>
                {sortTh('repo', 'Repo', 'pl-3')}
                {sortTh('tier', 'Tier', '', <TierHelp />)}
                <th scope="col" className="sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-1 text-left">
                  <span className="label-caps">Path</span>
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
                  <tr key={e.repo} onClick={() => onSelect(e.repo)} className={`cursor-pointer border-b border-line-1 hov:bg-bg-3 ${selected ? 'bg-bg-3' : ''}`}>
                    <td className={`py-1.5 pr-2 pl-3 align-top ${selected ? BAR[e.tier] : ''}`}>{repoCell(e, false)}</td>
                    <td className="px-2 py-1.5 align-top">{tierCell(e, true)}</td>
                    <td className="px-2 py-1.5 align-top">{hopCell(e, true)}</td>
                    <td className="hidden px-2 py-1.5 align-top text-fg-1 md:table-cell xl:hidden">{e.team ?? '–'}</td>
                    <td className="py-1.5 pr-3 pl-1 text-right align-top">{fixButton(e)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="flex flex-col md:hidden">
            {rows.map((e) => (
              <li
                key={e.repo}
                onClick={() => onSelect(e.repo)}
                className={`flex flex-col gap-2 border-b border-line-1 p-3 ${selectedRepo === e.repo ? `bg-bg-3 ${BAR[e.tier]}` : ''}`}
              >
                {repoCell(e, true)}
                <div className="flex flex-col items-start gap-1">
                  {tierCell(e)}
                  {/* Printed, not hover: touch has no tooltip. WOULD_PULL's honest-semantics line already says what the tier means. */}
                  <span className="text-xs text-fg-1">{e.tier === 'WOULD_PULL' ? HONEST_SEMANTICS : TIER_SUBTITLE[e.tier]}</span>
                </div>
                {hopCell(e)}
                {e.tier !== 'MAINTAINER' && <div>{fixButton(e)}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
