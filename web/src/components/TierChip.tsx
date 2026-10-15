/* TierChip: tier as text colour on a tinted surface. Colour is never the only signal: every chip has a leading
 * dot AND the constant (WOULD_PULL) in Martian Mono, and the plain-language subtitle rides along as the title
 * and as screen-reader text (docs/design.md section 2, "Tier label rule").
 * Props: tier, dev (true = every hit is dev-only, adds a `dev` tag), showSubtitle (print the subtitle beside
 * the chip, for drawers and expanded cards).
 */
import type { Tier } from '../data/types.ts';

export const TIER_SUBTITLE: Record<Tier, string> = {
  LOCKED: 'Lockfile pins a malicious version',
  WOULD_PULL: 'A fresh install in the window would have fetched it',
  MAINTAINER: "Depends on the hijacked account's packages",
  CLEAN: 'No path to a malicious version',
};

/** Printed in every WOULD_PULL row card and drawer; tooltip on fine pointers (docs/design.md copy rules). */
export const HONEST_SEMANTICS =
  'A fresh install during the window would have fetched the malicious version. Lockfile-pinned npm ci builds were safe.';

const STYLE: Record<Tier, string> = {
  LOCKED: 'text-tier-locked bg-tier-locked-bg',
  WOULD_PULL: 'text-tier-would-pull bg-tier-would-pull-bg',
  MAINTAINER: 'text-tier-maintainer bg-tier-maintainer-bg',
  CLEAN: 'text-tier-clean bg-tier-clean-bg',
};

export function TierChip({ tier, dev = false, showSubtitle = false }: { tier: Tier; dev?: boolean; showSubtitle?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        title={TIER_SUBTITLE[tier]}
        className={`inline-flex h-5 items-center gap-1.5 rounded-xs px-1.5 font-mono text-2xs font-medium ${STYLE[tier]}`}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {tier}
        {dev && <span className="rounded-xs border border-current px-1 text-fg-1 opacity-90">dev</span>}
        <span className="sr-only">: {TIER_SUBTITLE[tier]}{dev ? ' (dev dependencies only)' : ''}</span>
      </span>
      {showSubtitle && <span className="text-xs text-fg-1">{TIER_SUBTITLE[tier]}</span>}
    </span>
  );
}
