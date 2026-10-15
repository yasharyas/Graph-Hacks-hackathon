// The colour of the selected chain in the path graph: its tier's own, so red stays what it means on this screen (an infected
// repo) and an amber WOULD_PULL or a steel MAINTAINER chain is not drawn as an infection. The canvas reads the CSS variable;
// the legend swatch uses the same one.
import type { Tier } from './types.ts';

const CHAIN_VAR: Record<Tier, string> = {
  LOCKED: '--tier-locked',
  WOULD_PULL: '--tier-would-pull',
  MAINTAINER: '--tier-maintainer',
  CLEAN: '--tier-clean',
};

/** The CSS custom property that colours the selected repo's chain; the infection red when its tier is not known. */
export const chainVar = (tier: Tier | null | undefined): string => (tier ? CHAIN_VAR[tier] : '--graph-link-active');
