/** Scroll only the pane that holds `el`, so the war room's single viewport stays put; in the single-column layouts the page scrolls instead. */
export function scrollPaneTo(el: Element, margin = 12): void {
  const pane = el.closest<HTMLElement>('.scroll-pane');
  if (!pane || pane.scrollHeight <= pane.clientHeight) return el.scrollIntoView({ block: 'nearest' });
  pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - margin;
}
