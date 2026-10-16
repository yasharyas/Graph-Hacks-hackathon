// The incident as a short plain name for a sentence. IncidentMeta.title is a headline ("axios npm account takeover: 1.14.1
// and 0.30.4 depend on the plain-crypto-js@4.2.1 RAT dropper"): glued after "a malicious version of" it reads as a sentence
// that went wrong. The name keeps the account and what happened to it, and nothing about the payload.
import type { IncidentMeta } from './types.ts';

/** "the qix npm account takeover"; from the maintainer when the title has another shape ("the qix account compromise"); else "this incident". */
export function incidentName(incident: Pick<IncidentMeta, 'title' | 'maintainer'> | null | undefined): string {
  if (!incident) return 'this incident';
  const account = /^(\S+) npm account takeover/.exec(incident.title)?.[1];
  if (account) return `the ${account} npm account takeover`;
  return incident.maintainer ? `the ${incident.maintainer} account compromise` : 'this incident';
}
