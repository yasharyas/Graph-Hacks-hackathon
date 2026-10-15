/* ExposureTable: the right pane's table (docs/design.md section 5). A real <table> from 768px (sortable headers
 * with aria-sort, sticky header, numbers right-aligned), cards below 768px (repo, tier + subtitle, last hop, team,
 * one action). Filters: prod-only toggle, tier select, search. The team column folds into the repo cell below xl.
 * Props:
 *   exposures, paths    Report.exposures / Report.paths
 *   badVersions         malicious name@version ids (IncidentMeta.versions) so chips can underline them
 *   selectedRepo        drives the left bar and, through the parent, the graph; null = none
 *   remediated          repo -> epoch ms of a local or server remediation
 *   undoable            repos still inside the 10 s Undo window
 *   fixable             repos the triage run drafted for (a table scrubbed to another clock can list repos it did not); omit = all
 *   onSelect(repo), onOpenFix(repo), onUndo(repo)
 * WOULD_PULL rows always carry the honest-semantics line (table caption + tier title on fine pointers, printed in
 * the card on touch). Repo names are buttons (the accessible name of the row); the row click is a convenience.
 * Untrusted strings (repo, team, package names) render as text only.
 */
import { useMemo, useState } from 'react';
import { HEAD_NOTE, isHead, utc } from '../data/format.ts';
import type { Exposure, ExposurePath, Tier } from '../data/types.ts';
import { Button } from './Button.tsx';
import { EmptyState } from './EmptyState.tsx';
import { Check, ChevronDown, Undo } from './icons/Glyphs.tsx';
import { HopDots, PathChain, PathChip } from './PathChip.tsx';
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
      .filter((e) => (!prodOnly || !e.dev) && (tier === 'ALL' || e.tier === tier) && (!q || e.repo.toLowerCase().includes(q)))
      .sort(cmp);
  }, [exposures, prodOnly, tier, query, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');

  const pathFor = (e: Exposure) => paths.find((p) => p.repo === e.repo);
  const hopCell = (e: Exposure) => {
    const path = pathFor(e);
    if (path) {
      return (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <PathChain path={path} badVersions={badVersions} last />
          <HopDots hops={path.hops} />
        </span>
      );
    }
    const item = e.versions[0] ?? e.packages[0];
    return item ? (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <PathChip item={item} bad={badVersions.has(item)} />
        {e.packages.length > 1 && <span className="text-xs text-fg-2">+{e.packages.length - 1}</span>}
        <HopDots hops={e.depth} />
      </span>
    ) : null;
  };

  const repoCell = (e: Exposure, showTeam: boolean) => {
    const done = remediated[e.repo] ?? e.remediated?.at;
    return (
      <span className="flex min-w-0 flex-col items-start">
        <button
          type="button"
          aria-current={selectedRepo === e.repo ? 'true' : undefined}
          onClick={(ev) => (ev.stopPropagation(), onSelect(e.repo))}
          className={`max-w-full rounded-xs text-left text-sm break-words pointer-coarse:min-h-11 pointer-coarse:py-2 ${done ? 'text-fg-2 line-through' : 'text-link'} hov:text-fg-0`}
        >
          {e.repo}
        </button>
        {e.synthetic && <span className="text-2xs text-fg-1">sample repo</span>}
        {isHead(e.repo) && (
          <span className="text-2xs text-fg-1" title={HEAD_NOTE}>
            current lockfile, counterfactual
          </span>
        )}
        {showTeam && e.team && <span className="text-xs text-fg-1 md:max-xl:hidden">{e.team}</span>}
      </span>
    );
  };

  const tierCell = (e: Exposure) => {
    const done = remediated[e.repo] ?? e.remediated?.at;
    if (done === undefined) return <TierChip tier={e.tier} dev={e.dev} />;
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

  const fixButton = (e: Exposure) => (
    <Button
      variant="secondary"
      disabled={fixable !== undefined && !fixable.has(e.repo)}
      title={fixable && !fixable.has(e.repo) ? 'The triage run did not cover this repo at this clock. Run the triage at this time first.' : undefined}
      onClick={(ev) => (ev.stopPropagation(), onOpenFix(e.repo))}
      aria-label={`Fix ${e.repo}`}
    >
      Fix
    </Button>
  );

  // A plain function (not a component) so the header buttons keep focus across re-renders.
  const sortTh = (k: SortKey, label: string, className = '') => (
    <th key={k} scope="col" aria-sort={ariaSort(k)} className={`sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-2 text-left ${className}`}>
      <button type="button" onClick={() => toggleSort(k)} className="label-caps inline-flex items-center gap-1 rounded-xs">
        {label}
        {sort.key === k && <ChevronDown size={12} className={sort.dir === 1 ? '' : 'rotate-180'} />}
      </button>
    </th>
  );

  return (
    <section aria-label="Exposed repos" className="flex flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b border-line-1 p-3">
        <Button aria-pressed={prodOnly} onClick={() => setProdOnly((p) => !p)} className="aria-pressed:bg-bg-3">
          Prod only
        </Button>
        <label className="flex flex-col gap-1 text-xs text-fg-1">
          Tier
          <select className="field w-auto" value={tier} onChange={(e) => setTier(e.target.value as Tier | 'ALL')}>
            <option value="ALL">All tiers</option>
            {(['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as Tier[]).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs text-fg-1">
          Filter repos
          <input className="field" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
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
              <col className="w-26" />
              <col className="w-[38%]" />
              <col className="hidden w-24 md:table-column xl:hidden" />
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr>
                {sortTh('repo', 'Repo')}
                {sortTh('tier', 'Tier')}
                <th scope="col" className="sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-2 text-left">
                  <span className="label-caps">Path</span>
                </th>
                {sortTh('team', 'Team', 'hidden md:table-cell xl:hidden')}
                <th scope="col" className="sticky top-0 z-(--z-sticky) bg-bg-2 px-2 py-2">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const selected = selectedRepo === e.repo;
                return (
                  <tr
                    key={e.repo}
                    onClick={() => onSelect(e.repo)}
                    className={`min-h-(--row-h) cursor-pointer border-b border-line-1 hov:bg-bg-3 ${selected ? 'bg-bg-3' : ''}`}
                  >
                    <td className={`px-2 py-2 align-top ${selected ? BAR[e.tier] : ''}`}>{repoCell(e, true)}</td>
                    <td className="px-2 py-2 align-top">{tierCell(e)}</td>
                    <td className="px-2 py-2 align-top">{hopCell(e)}</td>
                    <td className="hidden px-2 py-2 align-top text-fg-1 md:table-cell xl:hidden">{e.team ?? '–'}</td>
                    <td className="px-2 py-2 text-right align-top">{fixButton(e)}</td>
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
                  <span className="text-xs text-fg-1">{TIER_SUBTITLE[e.tier]}</span>
                  {e.tier === 'WOULD_PULL' && <span className="text-xs text-fg-1">{HONEST_SEMANTICS}</span>}
                </div>
                {hopCell(e)}
                <div>{fixButton(e)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
