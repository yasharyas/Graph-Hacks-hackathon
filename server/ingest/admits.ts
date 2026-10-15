// When did a declared range expose a repo to a hijacked npm version, and which clean version should `overrides` pin?
// Resolution follows npm: loose semver parsing (npm-package-arg / npm-pick-manifest pass loose), and prereleases
// only match ranges that name a prerelease on the same major.minor.patch. Input order and duplicates don't matter.
import semver from 'semver';

export type V = { version: string; publishedAt: number };

const LOOSE = { loose: true };
// "latest" is the dist-tag that tracks the highest stable release, which is exactly what "*" resolves to.
// Anything semver can't parse (git, file:, link:, http(s), workspace:, other dist-tags) becomes null.
// A missing spec (package not declared) is not a range either.
const toRange = (spec: unknown) => (typeof spec === 'string' ? semver.validRange(spec.trim() === 'latest' ? '*' : spec, LOOSE) : null);

// A fresh resolve picks `bad` from its publish until it is removed or a higher satisfying version comes out.
// A higher one published at or before `bad` means it was never picked, so the window is empty (toT <= fromT).
// A missing removedAt (undefined or a DB null) means still live: the window stays open rather than silently vanishing.
export function admitWindow(spec: unknown, bad: V, versions: V[], removedAt?: number | null): { fromT: number; toT: number } | null {
  const range = toRange(spec);
  if (!range || !semver.satisfies(bad.version, range, LOOSE)) return null;
  let toT = removedAt ?? Infinity;
  for (const v of versions) // `<` first: cheap, and skips entries with a missing (NaN) publish time
    if (v.publishedAt < toT && semver.satisfies(v.version, range, LOOSE) && semver.gt(v.version, bad.version, LOOSE)) toT = v.publishedAt;
  return toT > bad.publishedAt ? { fromT: bad.publishedAt, toT } : null;
}

// Highest version live at `at` that no entry flags malicious and every range accepts. No ranges = any stable.
export function safeVersion(specs: string[], versions: (V & { malicious?: boolean })[], at: number): string | null {
  const ranges = (specs.length ? specs : ['*']).map(toRange);
  const bad = new Set(versions.filter((v) => v.malicious).map((v) => v.version));
  const ok = versions.filter((v) => v.publishedAt <= at && !bad.has(v.version) && ranges.every((r) => r !== null && semver.satisfies(v.version, r, LOOSE)));
  return semver.rsort(ok.map((v) => v.version), LOOSE)[0] ?? null;
}
