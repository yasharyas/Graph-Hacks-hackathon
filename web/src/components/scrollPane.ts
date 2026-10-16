/** Scroll only the pane that holds `el`, so the war room's single viewport stays put; in the single-column layouts the page scrolls instead. */
export function scrollPaneTo(el: Element, margin = 12): void {
  const pane = el.closest<HTMLElement>('.scroll-pane');
  if (!pane || pane.scrollHeight <= pane.clientHeight) return el.scrollIntoView({ block: 'nearest' });
  pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - margin;
}

/** The pane that scrolls `el` (from 1024px), or null when the page itself scrolls (the single-column layouts). */
const scrollerOf = (el: Element): HTMLElement | null => {
  const pane = el.closest<HTMLElement>('.scroll-pane');
  return pane && pane.scrollHeight > pane.clientHeight + 1 && getComputedStyle(pane).overflowY !== 'visible' ? pane : null;
};

/** Top edge of a fixed or sticky bar that covers the bottom of the visible area (the Ask bar, the phone tab bar), or Infinity. */
const coverTop = (sel: string, el: Element): number => {
  const bar = document.querySelector<HTMLElement>(sel);
  if (!bar || bar.contains(el)) return Infinity;
  const pos = getComputedStyle(bar).position;
  if (pos !== 'fixed' && pos !== 'sticky') return Infinity;
  const r = bar.getBoundingClientRect();
  return r.height > 0 ? r.top : Infinity;
};

/**
 * One scroller's pass: move `pane` (null: the page) so `el` sits in the part of it the person can see. That part is the pane's
 * box clipped to the window (a pane taller than the window must not count its off-screen half as visible), above the pinned
 * Ask bar and the phone tab bar.
 */
function shift(pane: HTMLElement | null, el: Element, align: 'top' | 'nearest', margin: number): void {
  const r = el.getBoundingClientRect();
  const box = pane?.getBoundingClientRect();
  const viewTop = Math.max(box ? box.top : 0, 0);
  const viewBottom = Math.min(box ? box.bottom : innerHeight, innerHeight, coverTop('#ask', el), coverTop('nav[aria-label="Panels"]', el));
  let delta = 0;
  if (align === 'top' || r.top < viewTop + margin) delta = r.top - viewTop - margin;
  else if (r.bottom > viewBottom - margin) delta = Math.min(r.bottom - viewBottom + margin, r.top - viewTop - margin);
  if (Math.abs(delta) < 1) return;
  if (pane) pane.scrollTop += delta;
  else scrollTo({ top: scrollY + delta, behavior: 'instant' });
}

/**
 * Bring `el` into the part of the screen nothing covers: below the pane's top (or the window's), above the pinned Ask bar and
 * the phone tab bar. `top` puts its top edge there (an answer or a card that just opened: read it from its first line);
 * `nearest` scrolls only as far as needed and never pushes the top edge out (a plan, a toggle that moved). The pane moves
 * first; then, if the page itself scrolls (a narrow or zoomed window), the page moves as far as still needed.
 */
export function reveal(el: Element, align: 'top' | 'nearest' = 'nearest', margin = 12): void {
  const pane = scrollerOf(el);
  if (pane) shift(pane, el, align, margin);
  if (!pane || document.documentElement.scrollHeight > innerHeight + 1) shift(null, el, pane ? 'nearest' : align, margin);
}

/**
 * reveal(), and then the element that holds the keyboard focus is kept on screen (WCAG 2.4.11): an answer that lands under
 * a focused Ask field, a plan that opens below its "Hide plan" toggle, a traced row far below the card header that took focus.
 * When both do not fit, the focus wins and `el` shows as much as is left.
 */
export function revealKeepingFocus(el: Element, align: 'top' | 'nearest' = 'nearest', margin = 12): void {
  reveal(el, align, margin);
  const f = document.activeElement;
  if (f instanceof HTMLElement && f !== document.body && f !== el && !f.contains(el) && f.getClientRects().length) reveal(f, 'nearest', margin);
}
