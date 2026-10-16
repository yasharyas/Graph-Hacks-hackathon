// Fitting a repo id into the table's repo column without ever cutting the repo's NAME. The path column does this for a
// package ("@typescript-eslint/parser" -> "@ty…/parser" -> "…/parser", data/refName.ts) by counting mono characters; a repo is set
// in the proportional UI font, so the same rule takes a `width` function (the browser's text measure) instead of a character
// count. Pure, so the rule is tested without a browser: only the OWNER gives way, and only as far as it must.
import type { repoParts } from './repoLabel.ts';

/** `whole`: "owner/name". `short`: the owner's first letters and an ellipsis ("ni…/nightwatch"). `tiny`: the ellipsis alone ("…/nightwatch"). `name`: the name alone, when even "…/" does not fit. */
export type RepoFit = 'whole' | 'short' | 'tiny' | 'name';

/** Letters of an owner kept by `short` (the path column keeps three of a scope; an owner is a word, two tell most of them apart). */
export const OWNER_KEEP = 2;

/** Room kept back from the cell: the browser's own layout and the canvas measure can differ by a pixel or two. */
export const FIT_SLACK = 3;

/**
 * How much of the owner a repo shows when its line holds `max` pixels. A repo with no owner (a pasted lockfile), or an owner
 * already as short as its box, is always whole: there is nothing that can give way. `width(text)`: the pixel width of that text
 * in the cell's font.
 */
export function repoFit(p: ReturnType<typeof repoParts>, max: number, width: (text: string) => number): RepoFit {
  if (p.owner === null) return 'whole';
  const room = max - FIT_SLACK;
  if (width(`${p.owner}/${p.name}${p.tail}`) <= room) return 'whole';
  if (p.owner.length > OWNER_KEEP + 1 && width(`${p.owner.slice(0, OWNER_KEEP)}…/${p.name}${p.tail}`) <= room) return 'short';
  if (width(`…/${p.name}${p.tail}`) <= room) return 'tiny';
  return 'name';
}
