// Share-link state: ?scenario=<id>&at=<epoch ms>&repo=<owner/name>. Read once on load, written when the user shares.
// Everything read from the URL is untrusted: it is validated here and never used as markup or in a request body unchecked.
import type { ScenarioId } from './types.ts';

const SCENARIOS: readonly ScenarioId[] = ['qix-2025-09-08', 'axios-2026-03-31'];
const REPO = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;

export interface UrlState {
  scenario: ScenarioId | null;
  at: number | null;
  repo: string | null;
}

export function readUrlState(search: string): UrlState {
  const q = new URLSearchParams(search);
  const scenario = SCENARIOS.find((s) => s === q.get('scenario')) ?? null;
  const at = Number(q.get('at'));
  const repo = q.get('repo') ?? '';
  return { scenario, at: Number.isFinite(at) && at > 0 ? at : null, repo: REPO.test(repo) ? repo : null };
}

/** `base` is the current location (keeps ?mock and the path); `repo` is omitted for a pasted repo, which has no org graph to reopen. */
export function shareUrl(base: string, s: { scenario: ScenarioId; at: number | null; repo: string | null }): string {
  const u = new URL(base);
  for (const k of ['scenario', 'at', 'repo']) u.searchParams.delete(k);
  u.searchParams.set('scenario', s.scenario);
  if (s.at !== null) u.searchParams.set('at', String(Math.floor(s.at / 60_000) * 60_000));
  if (s.repo && REPO.test(s.repo)) u.searchParams.set('repo', s.repo);
  u.hash = '';
  return u.toString().replace(/%2F/gi, '/'); // owner/name stays readable
}
