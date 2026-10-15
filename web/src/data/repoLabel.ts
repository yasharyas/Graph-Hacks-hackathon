// How a repo id, its owner and the lockfile it was judged on are worded for people. A pasted repo has no team and no
// history of its own, so the ids the server makes up for it ("owner/name@HEAD", "pasted/name", "Your team") never reach
// the screen as they are.
import type { LockSource } from './types.ts';

/** The placeholder team the server files every pasted repo under (server/ingest/guest.ts GUEST_ORG): not a real owner. */
export const GUEST_TEAM = 'Your team';
/** The owning team to show, or null for no team (a pasted repo's placeholder is not one). */
export const realTeam = (team: string | null | undefined): string | null => (team && team !== GUEST_TEAM ? team : null);

/** "owner/name@HEAD" -> "owner/name (today's lockfile)"; "pasted/name" -> "your pasted lockfile (name)"; anything else as is. */
export function repoLabel(repo: string): string {
  if (repo.endsWith('@HEAD')) return `${repo.slice(0, -'@HEAD'.length)} (today's lockfile)`;
  if (repo.startsWith('pasted/')) return `your pasted lockfile (${repo.slice('pasted/'.length)})`;
  return repo;
}

/** The repo as one short name, for the root of a path chain ("owner/name@HEAD" -> "owner/name", "pasted/name" -> "name"): the lockfile line above says which file it is. */
export const repoShort = (repo: string): string => repo.replace(/@HEAD$/, '').replace(/^pasted\//, '');

export interface LockNote {
  /** The answer to "which lockfile was this judged on?", with what it means for reading the tiers. */
  text: string;
  /** The same, as a phrase after "Lockfile judged:" (a Slack line). */
  short: string;
  /** Today's file or a pasted one: the tiers say what it WOULD have done, not what the repo had during the window. */
  counterfactual: boolean;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Which lockfile a pasted repo was judged on (Report.scope.source), in words. `repo` is the fallback for a server that sends
 * no source: its id still says "@HEAD" or "pasted/". Null for the demo org: its lockfiles are not a question.
 */
export function lockNote(source: LockSource | undefined, repo: string): LockNote | null {
  const kind = source?.kind ?? (repo.endsWith('@HEAD') ? 'head' : repo.startsWith('pasted/') ? 'pasted' : null);
  if (kind === 'snapshot') {
    const at = source?.sha ? ` at commit ${source.sha.slice(0, 7)}` : '';
    const from = source?.date !== undefined && Number.isFinite(source.date) ? ` from ${day(source.date)}` : '';
    return { text: `Judged on the lockfile${at}${from}, the last change before the incident.`, short: `the lockfile${at}${from}, the last change before the incident`, counterfactual: false };
  }
  if (kind === 'head') return { text: "Judged on today's lockfile (counterfactual): no snapshot from before the incident was available, so the tiers say what today's file would have done during the window.", short: "today's lockfile (counterfactual)", counterfactual: true };
  if (kind === 'pasted') return { text: 'Judged on your pasted lockfile (counterfactual): the tiers say what this file would have done during the window, not what your repo had then.', short: 'your pasted lockfile (counterfactual)', counterfactual: true };
  return null;
}

/** The same, as a phrase for the hero's scope line: "lockfile at commit abc1234 from 2025-09-01", or a counterfactual. */
export function lockSourceLabel(s: LockSource | undefined): string | null {
  if (!s) return null;
  if (s.kind === 'snapshot') return `lockfile at commit ${s.sha ? s.sha.slice(0, 7) : 'unknown'}${s.date ? ` from ${day(s.date)}` : ''}`;
  return s.kind === 'head' ? "today's lockfile, a counterfactual" : 'your pasted lockfile, a counterfactual';
}
