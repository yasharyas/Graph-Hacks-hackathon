// What to say after a failure, on top of data/errors.ts. When retrying cannot help (a 4xx: invalid input, not found, an
// unsupported lockfile, an expired analysis or run) the next step never says "try again"; a streamed error has no HTTP
// status, so its message decides. The request id is only useful to whoever runs the server: it is shown for server and
// network failures (5xx, 0, a cut stream), never for a person's own input. Pure: node --test covers it.
import { fixFor, type Doing, type Failure } from './errors.ts';

/** Server messages for failures that a retry repeats exactly (the server's own wording, see server/ingest and server/index.ts). */
const PERMANENT = /not a public repo|not found|does not exist|no package-lock|lockfileversion|not supported|unsupported|uses (?:yarn|pnpm)|has expired|not a repo address|only github|must be|invalid|names (?:no known|neither loaded)|is empty|not json|too large|too many entries/i;
/** The message already says what to do ("... has expired. Paste the repo again."): no second instruction under it. */
const SAYS_WHAT = /[.:]\s+(?:Run|Use|Paste|Drop|Add|Check|Pick|Upgrade|Remove|Name|Describe|Commit|Generate)\b/;

export const permanent = (e: Failure): boolean =>
  e.status !== undefined && e.status !== 0 ? e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429 : e.status === undefined && PERMANENT.test(e.message);

/** A failure on the server's side or the wire: the only kind whose request id is worth printing. */
export const serverSide = (e: Failure): boolean => !permanent(e) && (e.status === undefined || e.status === 0 || e.status >= 500);

const NEXT: Record<Doing, string> = {
  triage: 'Name an incident, account or package in the alert (like “qix compromised, 13:16 UTC”), or pick a scenario.',
  ask: 'Rephrase the question.',
  analyze: 'Check the owner/name spelling, or try a sample repo.',
  exposure: 'Move the scrubber to another minute.',
  plan: 'This tool has no plan to show.',
  remediate: 'Run the triage again, then mark it.',
};

/** The next step: never "try again" for a failure a retry repeats; '' when the message itself already says what to do. */
export function nextStep(e: Failure, doing: Doing): string {
  if (!permanent(e)) return fixFor(e, doing);
  return SAYS_WHAT.test(e.message) ? '' : NEXT[doing];
}

/** The request id to print, or undefined (a person's own input, a rate limit). */
export const requestIdFor = (e: Failure): string | undefined => (serverSide(e) ? e.requestId : undefined);
