// Client-side look at a dropped or pasted lockfile, so the common mistakes cost no round trip. The server repeats
// every check (S1) with the same words (server/ingest/guest.ts), so this file never has the last say.
export const MAX_LOCKFILE_BYTES = 5 * 1024 * 1024;
export const UNSUPPORTED = 'yarn and pnpm lockfiles are not supported yet. Drop a package-lock.json (npm v2 or v3).';
export const OLD_LOCKFILE = 'Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install with npm 7 or newer to upgrade it.';
export const TOO_BIG = 'That file is over 5 MB. Lockfiles up to 5 MB and 6,000 entries are supported.';

/** Why this lockfile cannot be analysed, in the server's words, or null when it looks fine. `bytes` defaults to the text's UTF-8 size. */
export function lockfileProblem(name: string, text: string, bytes = new Blob([text]).size): string | null {
  if (/yarn\.lock$|pnpm-lock\.ya?ml$/i.test(name)) return UNSUPPORTED;
  if (bytes > MAX_LOCKFILE_BYTES) return TOO_BIG;
  if (!/^\s*\{/.test(text)) return UNSUPPORTED; // yarn.lock, pnpm-lock.yaml and anything else that is not a JSON object
  const version = /"lockfileVersion"\s*:\s*(\d+)/.exec(text)?.[1];
  return !version || Number(version) < 2 ? OLD_LOCKFILE : null;
}

/** A paste is a lockfile (not a URL typed into the field) when it spans lines. */
export const looksLikeLockfile = (pasted: string): boolean => pasted.trim().includes('\n');
