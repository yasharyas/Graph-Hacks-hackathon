// Fitting a `name@version` into a table cell without ever cutting the package name or the version. The path cell is mono
// text, so its width is a character count, not a guess: when the whole ref does not fit, only the scope gives way, by a rule
// that depends on nothing but the lengths ("@typescript-eslint/parser" -> "@ty…/parser" -> "…/parser" -> "parser").

/** Pixels per character: Martian Mono SemiExpanded at 12px is 0.7em. A narrower fallback font only leaves spare room. */
export const CH_PX = 8.4;

/** How many characters a cell `px` wide holds (never fewer than a short name and its version). */
export const charsIn = (px: number): number => Math.max(12, Math.floor(px / CH_PX));

/**
 * `whole`: the scope is written out. `short`: its first characters and an ellipsis ("@ty…"). `tiny`: the ellipsis alone.
 * `name`: the scope and its slash are dropped with no sign ("apidom-reference@1.7.0"), when even "…/" + name does not fit.
 */
export type ScopeFit = 'whole' | 'short' | 'tiny' | 'name';

/** Width, in characters, of what is drawn for the scope in each fit that clips it: three letters or none, then the ellipsis (one character). */
export const SCOPE_BOX = { short: 4, tiny: 1 } as const;

/**
 * How much of the scope a ref shows when its line holds `max` characters. An unscoped name, or a scope that is already as
 * short as its box, is always whole: the name has no part that can give way.
 */
export function scopeFit(name: string, version: string | null, max: number): ScopeFit {
  const slash = name.indexOf('/');
  if (!name.startsWith('@') || slash < 2) return 'whole';
  const scope = slash; // "@typescript-eslint"
  const tail = 1 + (name.length - slash - 1) + (version ? version.length + 1 : 0); // "/parser@8.30.1"
  if (scope <= SCOPE_BOX.short || scope + tail <= max) return 'whole';
  if (SCOPE_BOX.short + tail <= max) return 'short';
  return SCOPE_BOX.tiny + tail <= max ? 'tiny' : 'name';
}
