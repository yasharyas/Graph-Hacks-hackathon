/** Scroll only the pane that holds `el`, so the war room's single viewport stays put; in the single-column layouts the page scrolls instead. */
export function scrollPaneTo(el: Element, margin = 12): void {
  const pane = el.closest<HTMLElement>('.scroll-pane');
  if (!pane || pane.scrollHeight <= pane.clientHeight) return el.scrollIntoView({ block: 'nearest' });
  pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - margin;
}

/** The pane that scrolls `el` (from 1024px), or null when the page itself scrolls (the single-column layouts). */
const scrollerOf = (el: Element): HTMLElement | null => {
  const pane = el.closest<HTMLElement>('.scroll-pane');
  return pane && pane.scrollHeight > pane.clientHeight + 1 ? pane : null;
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
 * Bring `el` into the part of the screen nothing covers: below the pane's top (or the window's), above the pinned Ask bar and
 * the phone tab bar. `top` puts its top edge there (an answer or a card that just opened: read it from its first line);
 * `nearest` scrolls only as far as needed and never pushes the top edge out (a plan, a toggle that moved).
 */
export function reveal(el: Element, align: 'top' | 'nearest' = 'nearest', margin = 12): void {
  const pane = scrollerOf(el);
  const r = el.getBoundingClientRect();
  const viewTop = pane ? pane.getBoundingClientRect().top : 0;
  const viewBottom = Math.min(pane ? pane.getBoundingClientRect().bottom : innerHeight, coverTop('#ask', el), coverTop('nav[aria-label="Panels"]', el));
  let delta = 0;
  if (align === 'top' || r.top < viewTop + margin) delta = r.top - viewTop - margin;
  else if (r.bottom > viewBottom - margin) delta = Math.min(r.bottom - viewBottom + margin, r.top - viewTop - margin);
  if (Math.abs(delta) < 1) return;
  if (pane) pane.scrollTop += delta;
  else scrollTo({ top: scrollY + delta, behavior: 'instant' });
}
