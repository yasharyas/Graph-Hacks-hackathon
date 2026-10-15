// Real API failures in plain language: the server's own message is always shown as the cause (it is already
// written for people, S12), and `fix` says what to do next. `status` 0 = network down, undefined = a stream
// event with no HTTP status (the 60 s cap, a cut stream).
export interface Failure {
  message: string;
  status?: number;
  requestId?: string;
}
export type Doing = 'triage' | 'ask' | 'analyze' | 'exposure' | 'plan' | 'remediate';

const RETRY: Record<Doing, string> = {
  triage: 'Run the triage again.',
  ask: 'Ask again.',
  analyze: 'Try again, or try a sample repo.',
  exposure: 'Move the scrubber again to retry.',
  plan: 'Try again in a moment.',
  remediate: 'Mark it again.',
};

/** What to do next, given where it failed and with which HTTP status. */
export function fixFor(e: Failure, doing: Doing): string {
  switch (e.status) {
    case 0:
      return `Check your connection and that the API is running. ${RETRY[doing]}`;
    case 413:
      return doing === 'analyze'
        ? 'Lockfiles up to 5 MB and 6,000 entries are supported. Try a smaller repo or a sample repo.'
        : `The request was too large for the server. ${RETRY[doing]}`;
    case 415:
      return 'The server did not accept the request format. Reload the page; if it keeps happening, share the request id.';
    case 429:
      return doing === 'analyze'
        ? 'One analysis per 20 seconds. Wait for the countdown, then try again.'
        : doing === 'ask'
          ? 'Follow-up questions are limited to 10 per 10 minutes. Try again shortly.'
          : 'You hit a rate limit or the server is busy with other runs. Wait a few seconds, then try again.';
    case 400:
    case 404:
      return doing === 'analyze' ? 'Check the URL or lockfile, or try a sample repo.' : RETRY[doing];
    default:
      return e.status && e.status >= 500 ? `The server hit an error. ${RETRY[doing]} If it keeps failing, share the request id.` : RETRY[doing];
  }
}
