// Share-link state: ?scenario=<id>&at=<epoch ms>&repo=<owner/name>&open=fix|notice, or &guest=<owner/name> for a pasted
// public repo (re-analysed on load; a dropped lockfile has nothing to reopen). Read once on load, written when the user
// shares or copies a notice. Everything read from the URL is untrusted: it is validated here and never used as markup or
// in a request body unchecked.
import { DEFAULT_AT } from './clock.ts';
import type { ScenarioId } from './types.ts';

const SCENARIOS: readonly ScenarioId[] = ['qix-2025-09-08', 'axios-2026-03-31'];
const REPO = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;
const OPEN = ['fix', 'notice'] as const;
export type OpenTab = (typeof OPEN)[number];

export interface UrlState {
  scenario: ScenarioId | null;
  at: number | null;
  repo: string | null; // an org repo to select (and open its drawer)
  guest: string | null; // a public GitHub repo to re-analyse, then select
  open: OpenTab | null; // which drawer tab to open for `repo` or `guest`
}

const DAY = 86_400_000;
const repoOf = (v: string | null) => (v && REPO.test(v) && !/^\.+\/|\/\.+$/.test(v) ? v : null);

export function readUrlState(search: string): UrlState {
  const q = new URLSearchParams(search);
  const scenario = SCENARIOS.find((s) => s === q.get('scenario')) ?? null;
  const at = Number(q.get('at'));
  const open = OPEN.find((o) => o === q.get('open')) ?? null;
  // The server's atOf rule: within 30 days of the incident (a far-off clock would only throw in date formatting).
  const near = Number.isSafeInteger(at) && Math.abs(at - DEFAULT_AT[scenario ?? SCENARIOS[0]]) <= 30 * DAY;
  return { scenario, at: near ? at : null, repo: repoOf(q.get('repo')), guest: repoOf(q.get('guest')), open };
}

/** `base` is the current location (keeps ?mock and the path). Pass `guest` for a pasted public repo, `repo` for an org one. */
export function shareUrl(base: string, s: { scenario: ScenarioId; at: number | null; repo?: string | null; guest?: string | null; open?: OpenTab | null }): string {
  const u = new URL(base);
  for (const k of ['scenario', 'at', 'repo', 'guest', 'open']) u.searchParams.delete(k);
  u.searchParams.set('scenario', s.scenario);
  if (s.at !== null) u.searchParams.set('at', String(Math.floor(s.at / 60_000) * 60_000));
  const guest = repoOf(s.guest ?? null);
  const repo = guest ? null : repoOf(s.repo ?? null);
  if (guest) u.searchParams.set('guest', guest);
  if (repo) u.searchParams.set('repo', repo);
  if ((guest || repo) && s.open) u.searchParams.set('open', s.open);
  u.hash = '';
  return u.toString().replace(/%2F/gi, '/'); // owner/name stays readable
}
