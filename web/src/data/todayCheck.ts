// Remediation.today, read for the Fix tab. For a pasted repo judged on a pre-incident snapshot the server compares the fix
// with today's package.json (server/agent/triage.ts todayNotes) and sends one sentence per difference, or one "still match"
// sentence. The differences are of four kinds: an override today's declared range no longer needs ("skip the axios@0.30.4
// override"), a pin for a package no longer declared ("skip its pin"), a pin declared in the other block ("move its pin"),
// and an override (with its exact pin) that would move a package BACKWARDS, because today's declared range already resolves
// a newer clean release ("... the debug@4.4.2 override and the exact debug 4.4.1 pin would downgrade it to 4.4.1: skip the
// debug@4.4.2 override and its pin ..."). The tab shows the sentences as they are; this only decides whether anything differs
// and what to do about it, so the line beside the Copy button can say "skip the debug@4.4.2 override and skip the debug@4.4.1
// pin" without a reader opening the check above. test/narrate.test.ts feeds it the server's real sentences.
export interface TodayCheck {
  /** `match`: the fix still fits today's package.json. `differs`: at least one key of the snippet does not apply to it. */
  status: 'match' | 'differs';
  /** The server's sentences, verbatim, in order. */
  notes: string[];
  /** What to leave out or move, grouped by kind ("skip the axios@0.30.4 and axios@1.14.1 overrides"); empty when a difference has a shape this does not know. */
  actions: string[];
  /** The override keys the notes say to skip ("axios@0.30.4"). */
  skipped: string[];
  /** The pins a downgrade note says to skip, as `name@version` ("debug@4.4.1"): they name the pinned version, which is also the value of the override. */
  skippedPins: string[];
  /** The packages whose direct pin the notes say to skip by name ("chalk": no longer declared). */
  skippedNames: string[];
}

const MATCH = /^Checked against today's package\.json: its direct dependencies still match this fix\.$/;
const SKIP_OVERRIDE = /: skip the (\S+) override\b/;
const SKIP_PIN = /no longer declares (\S+): skip its pin\b/;
const MOVE_PIN = /declares (\S+) in (\w+), not \w+: move its pin there\b/;
// A downgrade note's exact pin, which goes with its override ("the debug@4.4.2 override and the exact debug 4.4.1 pin would
// downgrade it"): the package and the pinned version to skip.
const DOWNGRADE_PIN = /the \S+ override and the exact (\S+) (\S+) pin would downgrade\b/;

const and = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** Null when the fix was not read against today's file (a demo-org repo, a pasted file, or a server that sends no notes). */
export function todayCheck(notes: readonly string[] | undefined): TodayCheck | null {
  const list = (notes ?? []).filter((n) => typeof n === 'string' && n.trim());
  if (!list.length) return null;
  if (list.every((n) => MATCH.test(n))) return { status: 'match', notes: list, actions: [], skipped: [], skippedPins: [], skippedNames: [] };
  const overrides = new Set<string>();
  const pins = new Set<string>();
  const moves = new Map<string, string>();
  const downs = new Set<string>(); // name@pin
  for (const n of list) {
    if (MATCH.test(n)) continue;
    const override = SKIP_OVERRIDE.exec(n)?.[1];
    const pin = SKIP_PIN.exec(n)?.[1];
    const move = MOVE_PIN.exec(n);
    const down = DOWNGRADE_PIN.exec(n);
    if (down) downs.add(`${down[1]}@${down[2]}`);
    if (override) overrides.add(override);
    else if (pin) pins.add(pin);
    else if (move) moves.set(move[1]!, move[2]!);
  }
  const pinned = [...pins, ...downs];
  const actions = [
    ...(overrides.size ? [`skip the ${and([...overrides])} ${overrides.size === 1 ? 'override' : 'overrides'}`] : []),
    ...(pinned.length ? [`skip the ${and(pinned)} ${pinned.length === 1 ? 'pin' : 'pins'}`] : []),
    ...[...moves].map(([name, block]) => `move the ${name} pin to ${block}`),
  ];
  return { status: 'differs', notes: list, actions, skipped: [...overrides], skippedPins: [...downs], skippedNames: [...pins] };
}

/**
 * Whether every override of the fix is one the notes say to skip, by its key (an override today's range no longer admits) or by
 * the version it pins (a downgrade note). Then the whole snippet is to be skipped: the direct pins next to the overrides exist
 * only because npm rejects an override that conflicts with a direct dependency, so without the overrides they would only move a
 * package backwards.
 */
export function skipsAll(check: TodayCheck | null, fix?: { overrides: Record<string, string> }): boolean {
  if (!check || check.status === 'match') return false;
  const entries = Object.entries(fix?.overrides ?? {});
  const name = (key: string) => (key.lastIndexOf('@') > 0 ? key.slice(0, key.lastIndexOf('@')) : key);
  return entries.length > 0 && entries.every(([key, pin]) => check.skipped.includes(key) || check.skippedPins.includes(`${name(key)}@${pin}`));
}

/**
 * The line beside the Copy button: what to leave out of the snippet before pasting it. Null when nothing differs. When every
 * override of the fix is one to skip, the whole snippet is.
 */
export function todayAdvice(check: TodayCheck | null, fix?: { overrides: Record<string, string> }): string | null {
  if (!check || check.status === 'match') return null;
  if (skipsAll(check, fix))
    return "Before you paste: skip all of it. Today's package.json already resolves newer, clean versions of these packages, so the overrides would only move them backwards, and the direct pins are only there for the overrides.";
  const what = check.actions.length ? and(check.actions) : 'read the notes above';
  return `Before you paste: ${what}. Today's package.json differs from the lockfile this fix was made for.`;
}
