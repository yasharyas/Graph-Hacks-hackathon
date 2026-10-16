// Run: node --test web/src/data/todayCheck.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { todayAdvice, todayCheck } from './todayCheck.ts';

// The sentences server/agent/triage.ts todayNotes writes (louislam/uptime-kuma under the axios incident, and the other shapes).
const KUMA = [
  "Today's package.json declares axios ~0.33.0, which no longer admits 0.30.4: skip the axios@0.30.4 override (it would hold axios at 0.30.3).",
  "Today's package.json declares axios ~0.33.0, which no longer admits 1.14.1: skip the axios@1.14.1 override (it would hold axios at 1.14.0).",
];
const MATCH = "Checked against today's package.json: its direct dependencies still match this fix.";

test('no notes (a demo-org repo, a pasted file, an older server): not read against today', () => {
  assert.equal(todayCheck(undefined), null);
  assert.equal(todayCheck([]), null);
  assert.equal(todayCheck(['', '  ']), null);
  assert.equal(todayAdvice(null), null);
});

test('"still match" is a match with nothing to skip and no advice', () => {
  const c = todayCheck([MATCH])!;
  assert.equal(c.status, 'match');
  assert.deepEqual(c.actions, []);
  assert.equal(todayAdvice(c), null);
});

test('overrides today\'s range no longer needs are skipped by key, said once for all of them', () => {
  const c = todayCheck(KUMA)!;
  assert.equal(c.status, 'differs');
  assert.deepEqual(c.notes, KUMA, "the server's sentences are kept as they are");
  assert.deepEqual(c.actions, ['skip the axios@0.30.4 and axios@1.14.1 overrides']);
  assert.equal(todayAdvice(c), "Before you paste: skip the axios@0.30.4 and axios@1.14.1 overrides. Today's package.json differs from the lockfile this fix was made for.");
  assert.deepEqual(todayCheck([KUMA[0]!])!.actions, ['skip the axios@0.30.4 override'], 'one key, singular');
});

test('when every override of the fix is skipped, the whole snippet is: its direct pins only exist for the overrides', () => {
  const c = todayCheck(KUMA)!;
  assert.deepEqual(c.skipped, ['axios@0.30.4', 'axios@1.14.1']);
  const all = todayAdvice(c, { overrides: { 'axios@0.30.4': '0.30.3', 'axios@1.14.1': '1.14.0' } })!;
  assert.match(all, /^Before you paste: skip all of it\./);
  assert.match(all, /direct pins are only there for the overrides/);
  // one override still needed (the fix has a third key today's range admits): name the two to skip, not "all of it"
  const some = todayAdvice(c, { overrides: { 'axios@0.30.4': '0.30.3', 'axios@1.14.1': '1.14.0', 'axios@0.30.5': '0.30.3' } })!;
  assert.match(some, /skip the axios@0\.30\.4 and axios@1\.14\.1 overrides/);
  assert.ok(!some.includes('skip all of it'));
  assert.match(todayAdvice(c)!, /skip the axios@0\.30\.4 and axios@1\.14\.1 overrides/, 'no fix given: the actions');
  assert.equal(todayAdvice(todayCheck([MATCH]), { overrides: { a: '1' } }), null);
});

test('a pin for a package no longer declared is a skip; one declared in the other block is a move', () => {
  const c = todayCheck(["Today's package.json no longer declares chalk: skip its pin.", "Today's package.json declares debug in dependencies, not devDependencies: move its pin there."])!;
  assert.deepEqual(c.actions, ['skip the chalk pin', 'move the debug pin to dependencies']);
  assert.match(todayAdvice(c)!, /skip the chalk pin and move the debug pin to dependencies/);
  assert.deepEqual(todayCheck(["Today's package.json no longer declares chalk: skip its pin.", "Today's package.json no longer declares ms: skip its pin."])!.actions, ['skip the chalk and ms pins']);
});

test('a difference in a shape this does not know still differs, and the advice sends the reader to the notes', () => {
  const c = todayCheck(['Something new: read it.'])!;
  assert.equal(c.status, 'differs');
  assert.deepEqual(c.actions, []);
  assert.match(todayAdvice(c)!, /check each key below against it/);
});

test('a match line next to a difference does not hide the difference', () => {
  const c = todayCheck([MATCH, KUMA[0]!])!;
  assert.equal(c.status, 'differs');
  assert.deepEqual(c.actions, ['skip the axios@0.30.4 override']);
});

test('the same instruction twice is said once', () => {
  assert.deepEqual(todayCheck([KUMA[0]!, KUMA[0]!])!.actions, ['skip the axios@0.30.4 override']);
});
