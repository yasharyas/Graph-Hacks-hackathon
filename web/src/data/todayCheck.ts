// Remediation.today, read for the Fix tab. For a pasted repo judged on a pre-incident snapshot the server compares the fix
// with today's package.json (server/agent/triage.ts todayNotes) and sends one sentence per difference, or one "still match"
// sentence. The tab shows the sentences as they are; this only decides whether anything differs and what to do about it, so
// the line beside the Copy button can say "skip the axios@0.30.4 and axios@1.14.1 overrides" without a reader opening the
// check above.
export interface TodayCheck {
  /** `match`: the fix still fits today's package.json. `differs`: at least one key of the snippet does not apply to it. */
  status: 'match' | 'differs';
  /** The server's sentences, verbatim, in order. */
  notes: string[];
  /** What to leave out or move, grouped by kind ("skip the axios@0.30.4 and axios@1.14.1 overrides"); empty when a difference has a shape this does not know. */
  actions: string[];
  /** The override keys the notes say to skip ("axios@0.30.4"). */
  skipped: string[];
}

const MATCH = /^Checked against today's package\.json: its direct dependencies still match this fix\.$/;
const SKIP_OVERRIDE = /: skip the (\S+) override\b/;
const SKIP_PIN = /no longer declares (\S+): skip its pin\b/;
const MOVE_PIN = /declares (\S+) in (\w+), not \w+: move its pin there\b/;

const and = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** Null when the fix was not read against today's file (a demo-org repo, a pasted file, or a server that sends no notes). */
export function todayCheck(notes: readonly string[] | undefined): TodayCheck | null {
  const list = (notes ?? []).filter((n) => typeof n === 'string' && n.trim());
  if (!list.length) return null;
  if (list.every((n) => MATCH.test(n))) return { status: 'match', notes: list, actions: [], skipped: [] };
  const overrides = new Set<string>();
  const pins = new Set<string>();
  const moves = new Map<string, string>();
  for (const n of list) {
    if (MATCH.test(n)) continue;
    const override = SKIP_OVERRIDE.exec(n)?.[1];
    const pin = SKIP_PIN.exec(n)?.[1];
    const move = MOVE_PIN.exec(n);
    if (override) overrides.add(override);
    else if (pin) pins.add(pin);
    else if (move) moves.set(move[1]!, move[2]!);
  }
  const actions = [
    ...(overrides.size ? [`skip the ${and([...overrides])} ${overrides.size === 1 ? 'override' : 'overrides'}`] : []),
    ...(pins.size ? [`skip the ${and([...pins])} ${pins.size === 1 ? 'pin' : 'pins'}`] : []),
    ...[...moves].map(([name, block]) => `move the ${name} pin to ${block}`),
  ];
  return { status: 'differs', notes: list, actions, skipped: [...overrides] };
}

/**
 * The line beside the Copy button: what to leave out of the snippet before pasting it. Null when nothing differs. When every
 * override of the fix is one to skip, the whole snippet is: the direct pins next to the overrides exist only because npm rejects
 * an override that conflicts with a direct dependency, so without the overrides they would only move a package backwards.
 */
export function todayAdvice(check: TodayCheck | null, fix?: { overrides: Record<string, string> }): string | null {
  if (!check || check.status === 'match') return null;
  const keys = Object.keys(fix?.overrides ?? {});
  if (keys.length > 0 && keys.every((k) => check.skipped.includes(k)))
    return "Before you paste: skip all of it. Today's package.json no longer admits the versions these overrides guard against, and the direct pins are only there for the overrides.";
  const what = check.actions.length ? and(check.actions) : 'check each key below against it';
  return `Before you paste: ${what}. Today's package.json differs from the lockfile this fix was made for.`;
}
