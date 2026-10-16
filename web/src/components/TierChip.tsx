/* TierChip: tier as text colour on a tinted surface. Colour is never the only signal: every chip has a leading
 * dot AND the constant (WOULD_PULL) in Martian Mono, and the plain-language meaning rides along as screen-reader text
 * (docs/design.md section 2, "Tier label rule").
 * Props: tier, dev (true = every hit is dev-only: a `dev` tag after the chip, never inside it, so the chip keeps its
 * width), showSubtitle (print the meaning beside the chip, for drawers and expanded cards), tip (a popover with the
 * meaning: on a fine pointer's hover, and while the chip's row has the keyboard focus; Escape dismisses it either way
 * without moving the pointer or the focus, WCAG 1.4.13. The words are also printed or screen-reader text elsewhere, so the
 * popover is aria-hidden: it never carries meaning alone).
 * Vertical padding: on a phone the chip is 20px high with 2px above and below the text (the dense desktop table keeps 18px).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Tier } from '../data/types.ts';

export const TIER_SUBTITLE: Record<Tier, string> = {
  LOCKED: 'The lockfile pins the malicious version',
  WOULD_PULL: 'A fresh install during the window would fetch it',
  MAINTAINER: "Depends on the hijacked account's packages",
  CLEAN: 'No path to a malicious version',
};

/** Printed once above the phone cards and in the pasted repo's table; tooltip on fine pointers (docs/design.md copy rules). */
export const HONEST_SEMANTICS =
  'A fresh install during the window would have fetched the malicious version. Lockfile-pinned npm ci builds that never pinned it were safe.';

const STYLE: Record<Tier, string> = {
  LOCKED: 'text-tier-locked bg-tier-locked-bg',
  WOULD_PULL: 'text-tier-would-pull bg-tier-would-pull-bg',
  MAINTAINER: 'text-tier-maintainer bg-tier-maintainer-bg',
  CLEAN: 'text-tier-clean bg-tier-clean-bg',
};

/**
 * Whether the popover is wanted by the keyboard: the row around the chip (`[data-repo]`: a table row or a card) holds the
 * focus by key, not by a click or a tap (:focus-visible), so a pointer user is never shown it twice.
 */
function useRowFocus(host: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const row = enabled ? host.current?.closest<HTMLElement>('[data-repo]') : null;
    if (!row) return;
    const on = (e: FocusEvent) => setFocused((e.target as HTMLElement).matches(':focus-visible'));
    const off = (e: FocusEvent) => {
      if (!row.contains(e.relatedTarget as Node | null)) setFocused(false);
    };
    row.addEventListener('focusin', on);
    row.addEventListener('focusout', off);
    return () => {
      row.removeEventListener('focusin', on);
      row.removeEventListener('focusout', off);
    };
  }, [host, enabled]);
  return focused;
}

export function TierChip({ tier, dev = false, showSubtitle = false, tip = false }: { tier: Tier; dev?: boolean; showSubtitle?: boolean; tip?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const focused = useRowFocus(host, tip);
  const [dismissed, setDismissed] = useState(false);
  const [hover, setHover] = useState(false);
  const wanted = tip && (focused || hover);
  // Escape hides the popover while it is up, wherever the focus is; it is shown again by the next hover or focus.
  useEffect(() => {
    if (!wanted || dismissed) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setDismissed(true);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [wanted, dismissed]);
  useEffect(() => {
    if (!focused && !hover) setDismissed(false);
  }, [focused, hover]);
  // The stylesheet shows .tip on hover (fine pointers, with the tooltip delay); a focused row shows it at once, and a dismissed one is display:none.
  const show = focused && !dismissed;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span ref={host} className={tip ? 'tip-host inline-flex' : 'inline-flex'} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
        {/* never wraps: "WOULD_PU / LL" in a narrow cell (a tool card's table) is worse than a cell that grows */}
        <span className={`inline-flex h-[18px] shrink-0 items-center gap-1.5 rounded-xs px-1.5 font-mono text-xs leading-none font-medium whitespace-nowrap max-md:h-auto max-md:py-0.5 max-md:leading-4 ${STYLE[tier]}`}>
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {tier}
          <span className="sr-only">
            : {TIER_SUBTITLE[tier]}
            {dev ? ' (dev dependencies only)' : ''}
          </span>
        </span>
        {tip && (
          <span aria-hidden className={`tip ${dismissed ? 'hidden!' : ''}`} style={show ? { opacity: 1, visibility: 'visible', pointerEvents: 'auto' } : { pointerEvents: 'auto' }}>
            {TIER_SUBTITLE[tier]}
          </span>
        )}
      </span>
      {dev && <span className="rounded-xs border border-line-3 px-1 font-mono text-xs text-fg-1 max-md:py-0.5">dev</span>}
      {showSubtitle && <span className="text-xs text-fg-1">{TIER_SUBTITLE[tier]}</span>}
    </span>
  );
}
