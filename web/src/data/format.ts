// Time rules (docs/design.md section 3): every absolute time is UTC HH:MM, deltas are signed.

const pad = (n: number) => String(n).padStart(2, '0');

/** "13:30" */
export function utc(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "13:12:39" (seconds only in tool cards and exports) */
export function utcSec(ms: number): string {
  return `${utc(ms)}:${pad(new Date(ms).getUTCSeconds())}`;
}

/** "13:30 UTC" */
export const utcLabel = (ms: number): string => `${utc(ms)} UTC`;

/** "+74 min" / "−04 min" (true minus sign) */
export const signedMin = (m: number): string => `${m < 0 ? '−' : '+'}${Math.abs(m)} min`;

/** "4.7 ms" */
export const fmtMs = (n: number): string => `${n.toFixed(1)} ms`;

/** A pasted repo with no pre-incident snapshot is read at HEAD and comes back as "owner/repo@HEAD". */
export const isHead = (repo: string): boolean => repo.endsWith('@HEAD');
export const HEAD_NOTE =
  'This is the current lockfile (fetched at HEAD): no snapshot from before the incident was available. Read the tiers as a counterfactual, what today’s lockfile would have done during the window.';

/** "1 repo" / "5 repos" */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
