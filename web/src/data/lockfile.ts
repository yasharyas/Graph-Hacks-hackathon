// Client-side look at what a person pastes or drops into the paste box, so the common mistakes get an answer instead
// of silence and cost no round trip. The server repeats every check (S1, server/ingest/guest.ts) and has the last
// say: nothing here is a security control, it only normalises input and explains problems in plain words.
export const MAX_LOCKFILE_BYTES = 5 * 1024 * 1024;
export const NPM_FIX = 'npm install --package-lock-only';
export const UNSUPPORTED = `yarn and pnpm lockfiles are not supported yet. In that project run ${NPM_FIX} to write a package-lock.json, then drop or paste that file.`;
export const OLD_LOCKFILE = `Only package-lock.json with lockfileVersion 2 or 3 is supported. Run ${NPM_FIX} with npm 7 or newer to upgrade it.`;
export const PACKAGE_JSON = `That is a package.json, not a lockfile. In the project run ${NPM_FIX}, then drop or paste the package-lock.json it writes.`;
export const BAD_JSON = 'That is not valid JSON. The paste may have been cut off: copy the whole package-lock.json.';
export const NOT_A_LOCKFILE = 'That does not look like a package-lock.json. Paste the file contents, or a repo like owner/name.';
export const TOO_BIG = 'That file is over 5 MB. Lockfiles up to 5 MB and 6,000 entries are supported.';

export interface LockfileCheck {
  /** Why this cannot be analysed, or null when it looks fine. */
  problem: string | null;
  /** Packages in the lockfile (the root entry excluded); 0 when there is a problem. */
  packages: number;
  version: number | null;
}

/** One look at a dropped or pasted lockfile. `bytes` defaults to the text's UTF-8 size. */
export function inspectLockfile(name: string, text: string, bytes = new Blob([text]).size): LockfileCheck {
  const fail = (problem: string): LockfileCheck => ({ problem, packages: 0, version: null });
  if (/yarn\.lock$|pnpm-lock\.ya?ml$/i.test(name)) return fail(UNSUPPORTED);
  if (bytes > MAX_LOCKFILE_BYTES) return fail(TOO_BIG);
  if (!/^\s*\{/.test(text)) {
    // yarn classic and berry, pnpm: say how to get an npm lockfile; anything else is just not a lockfile
    return fail(/^\s*(#\s*yarn lockfile|__metadata:|lockfileVersion\s*:|importers\s*:|packages\s*:)/im.test(text) || /^\s*"?[@\w][^\n]*@[^\n]*:\s*$/m.test(text) ? UNSUPPORTED : NOT_A_LOCKFILE);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(BAD_JSON);
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return fail(NOT_A_LOCKFILE);
  const o = json as Record<string, unknown>;
  const version = typeof o.lockfileVersion === 'number' ? o.lockfileVersion : null;
  if (version === null) return fail('dependencies' in o || 'devDependencies' in o || 'scripts' in o ? PACKAGE_JSON : OLD_LOCKFILE);
  if (version < 2) return fail(OLD_LOCKFILE);
  const entries = o.packages && typeof o.packages === 'object' ? Object.keys(o.packages).filter((k) => k !== '').length : 0;
  return { problem: null, packages: entries, version };
}

/** Why this lockfile cannot be analysed, in plain words, or null when it looks fine. */
export const lockfileProblem = (name: string, text: string, bytes?: number): string | null => inspectLockfile(name, text, bytes).problem;

/** A paste is a lockfile (not a URL typed into the field) when it spans lines. */
export const looksLikeLockfile = (pasted: string): boolean => pasted.trim().includes('\n');

// ── repo input ─────────────────────────────────────────────────────────────────────────────────────────────────
export const REPO_HINT = 'Use a public GitHub repo like owner/name or https://github.com/owner/name.';
const OWNER = /^[A-Za-z0-9-]{1,39}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const GITHUB = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:git@)?(?:www\.)?github\.com(?=[/:?#]|$)/i;

/**
 * What a person types or pastes for a repo -> the https://github.com/owner/name the server accepts. Takes owner/name,
 * scheme-less github.com/owner/name, ssh and .git clones, and /tree/... or /blob/... or /pull/... pages. Any other host
 * (an internal address, gitlab, a look-alike such as github.com.evil.example) gets a plain error, never a request.
 */
export function repoFromInput(raw: string): { url: string } | { error: string } {
  const s = raw.trim().replace(/^<(.*)>$/, '$1').replace(/^(["'])(.*)\1$/, '$2').replace(/^git\+/, '');
  if (!s) return { error: `Enter a repo. ${REPO_HINT}` };
  if (/\s/.test(s)) return { error: `That is not a repo address. ${REPO_HINT}` };
  const host = GITHUB.exec(s);
  let path: string;
  if (host) path = s.slice(host[0].length).replace(/^[/:]/, '');
  else if (/^[a-z][a-z0-9+.-]*:|^[^/]*@|^[^/]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(s)) return { error: `Only github.com repos can be analysed. ${REPO_HINT}` };
  else path = s; // owner/name
  const parts = path.split(/[?#]/)[0]!.split('/').filter(Boolean);
  const [owner, rawName] = parts;
  const name = rawName?.replace(/\.git$/i, '');
  if (!owner || !name) return { error: `That is missing the owner or the repo name. ${REPO_HINT}` };
  if (!host && parts.length !== 2) return { error: `That is not a repo address. ${REPO_HINT}` };
  if (!OWNER.test(owner) || !NAME.test(name) || name === '.' || name === '..') return { error: `That is not a valid GitHub owner or repo name. ${REPO_HINT}` };
  return { url: `https://github.com/${owner}/${name}` };
}
