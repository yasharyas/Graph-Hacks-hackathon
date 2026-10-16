// What the paste sheet says when an analysis fails. The server's message is the cause and is shown whole (it already says
// what is wrong and what to run); this only decides what goes around it: whether retrying can help, whether a request id is
// worth printing, and how long the Analyze button waits. A stream error event carries no HTTP status, so the message
// itself tells a server-side failure from a verdict about the input.
import { plainError } from './errors.ts';

export interface PasteProblem {
  /** The server's sentence in full (a few raw proxy strings reworded). Never a second sentence about rate limits. */
  message: string;
  /** Retrying can help (the server or the network failed, or it is busy). False: the input has to change. */
  retry: boolean;
  /** Only for failures on our side or the network: a support handle for something the person cannot fix. */
  requestId: string | null;
  /** Seconds the Analyze button waits before it is offered again (0 = no wait). */
  wait: number;
  /** A command the message tells the person to run, so it can be copied. */
  command: string | null;
  /** What else to try when the server's sentence alone leaves nowhere to go (a repo that is not public may be a typo or private). */
  hint: string | null;
  /** What is shown first: the whole message when it is short, else a one-line opening ("facebook/react uses yarn ..."). */
  lead: string;
  /** The rest of a long message (the versions to search for by hand, why the command), kept for a disclosure; null when `lead` is the whole message. */
  details: string | null;
  /** What the disclosure that holds `details` is called. */
  detailsLabel: string;
}

/** A message longer than this is opened with its lead only. A sentence about one input fits; a manual and a command do not, on a phone. */
export const LONG_MESSAGE = 170;
const YARN_PNPM = /^(\S+) uses (yarn|pnpm) \(([^)]+)\)/;
const NO_LOCKFILE = /^No package-lock\.json at the root of (\S+?)\.\s/;
const SENTENCE_END = /^[\s\S]*?[.!?]\s+(?=[A-Z])/;

/**
 * The server's message split into a short lead and the rest. The words are the server's (S12); a yarn / pnpm / no-lockfile
 * message, the three that run to 80 words, get a lead of one line and keep their manual and their command as details.
 */
export function splitMessage(message: string): { lead: string; details: string | null; detailsLabel: string } {
  if (message.length <= LONG_MESSAGE) return { lead: message, details: null, detailsLabel: '' };
  const rest = (from: RegExpExecArray | null) => (from ? message.slice(from[0].length).trim() : '') || null;
  const first = SENTENCE_END.exec(message);
  const yarn = YARN_PNPM.exec(message);
  if (yarn) return { lead: `${yarn[1]} uses ${yarn[2]} (${yarn[3]}). Only npm's package-lock.json can be read so far.`, details: rest(first), detailsLabel: 'How to check it by hand' };
  const none = NO_LOCKFILE.exec(message);
  if (none) return { lead: `No package-lock.json at the root of ${none[1]}. Generate one and drop it here.`, details: rest(none), detailsLabel: 'How to generate it' };
  return first ? { lead: first[0].trim(), details: rest(first), detailsLabel: 'More detail' } : { lead: message, details: null, detailsLabel: '' };
}

const OUR_SIDE = /on our side|did not answer|didn.t answer|hit an error|unexpected error|not responding|cannot reach|stream ended|timed out|stopped before it finished/i;
const TRY_AGAIN = /\s*Try again(?: in [^.]*|, or [^.]*)?\./gi;
const COMMAND = /npm install --package-lock-only/;
const NOT_PUBLIC = /is not a public repo/i;

export function pasteProblem(e: { message: string; status?: number; requestId?: string }): PasteProblem {
  const said = plainError(e);
  const rate = e.status === 429;
  const ours = e.status === 0 || (e.status ?? 0) >= 500 || OUR_SIDE.test(said);
  const retry = rate || ours;
  // "Try again" belongs only to errors a retry can fix: strip it from a verdict about the input.
  const message = retry ? said : said.replace(TRY_AGAIN, '').replace(/\s+/g, ' ').trim() || said;
  const offline = e.status === 0 ? `${/[.!?]$/.test(message) ? '' : '.'} Check your connection and that the API is running.` : '';
  const whole = retry && !/try again|wait/i.test(message) ? `${message}${offline} Try again.` : message;
  return {
    message: whole,
    ...splitMessage(whole),
    retry,
    requestId: ours && !rate ? (e.requestId ?? null) : null,
    // "Another repo is being analyzed ... in a few seconds" is a short wait; the per-address limit is 20 s
    wait: rate ? (/being analy[sz]ed|busy|few seconds/i.test(said) ? 5 : 20) : 0,
    command: COMMAND.test(said) ? 'npm install --package-lock-only' : null,
    hint: NOT_PUBLIC.test(said) ? 'Check the spelling, or paste its package-lock.json below if the repo is private.' : null,
  };
}
