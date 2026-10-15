/* TierChip: tier as text colour on a tinted surface. Colour is never the only signal: every chip has a leading
 * dot AND the constant (WOULD_PULL) in Martian Mono, and the plain-language meaning rides along as screen-reader text
 * (docs/design.md section 2, "Tier label rule").
 * Props: tier, dev (true = every hit is dev-only: a `dev` tag after the chip, never inside it, so the chip keeps its
 * width), showSubtitle (print the meaning beside the chip, for drawers and expanded cards), tip (pointer hover shows
 * the meaning in a popover; keyboard and touch users get it from the table's Tier help and the printed subtitle).
 */
import type { Tier } from '../data/types.ts';

export const TIER_SUBTITLE: Record<Tier, string> = {
  LOCKED: 'The lockfile pins the malicious version',
  WOULD_PULL: 'A fresh install during the window would fetch it',
  MAINTAINER: "Depends on the hijacked account's packages",
  CLEAN: 'No path to a malicious version',
};

/** Printed in every WOULD_PULL row card and drawer; tooltip on fine pointers (docs/design.md copy rules). */
export const HONEST_SEMANTICS =
  'A fresh install during the window would have fetched the malicious version. Lockfile-pinned npm ci builds that never pinned it were safe.';

const STYLE: Record<Tier, string> = {
  LOCKED: 'text-tier-locked bg-tier-locked-bg',
  WOULD_PULL: 'text-tier-would-pull bg-tier-would-pull-bg',
  MAINTAINER: 'text-tier-maintainer bg-tier-maintainer-bg',
  CLEAN: 'text-tier-clean bg-tier-clean-bg',
};

export function TierChip({ tier, dev = false, showSubtitle = false, tip = false }: { tier: Tier; dev?: boolean; showSubtitle?: boolean; tip?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={tip ? 'tip-host inline-flex' : 'inline-flex'}>
        <span className={`inline-flex h-5 items-center gap-1.5 rounded-xs px-1.5 font-mono text-2xs font-medium ${STYLE[tier]}`}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {tier}
          <span className="sr-only">
            : {TIER_SUBTITLE[tier]}
            {dev ? ' (dev dependencies only)' : ''}
          </span>
        </span>
        {tip && (
          <span aria-hidden className="tip">
            {TIER_SUBTITLE[tier]}
          </span>
        )}
      </span>
      {dev && <span className="rounded-xs border border-line-3 px-1 font-mono text-2xs text-fg-1">dev</span>}
      {showSubtitle && <span className="text-xs text-fg-1">{TIER_SUBTITLE[tier]}</span>}
    </span>
  );
}
