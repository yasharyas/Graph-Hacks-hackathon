import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_AT, hasClock, localStamp } from './clock.ts';
import { utc } from './format.ts';

test('each incident has its own default clock: qix 13:30, axios 01:30 (the server\'s DEFAULT_AT)', () => {
  assert.equal(utc(DEFAULT_AT['qix-2025-09-08']), '13:30');
  assert.equal(utc(DEFAULT_AT['axios-2026-03-31']), '01:30');
});

test('an alert has a clock when it carries HH:MM, the same test the server applies', () => {
  assert.ok(hasClock('qix compromised, 13:16 UTC'));
  assert.ok(hasClock('chalk hijacked at 9:05'));
  assert.ok(!hasClock('qix compromised'));
  assert.ok(!hasClock('axios@1.14.1 published, see 1.14.1'));
  assert.ok(!hasClock('ratio 2:75')); // not a minute
});

test('a local stamp names its zone', () => {
  assert.match(localStamp(Date.parse('2026-10-16T12:00:00Z')), /\d{2}:\d{2}.*[A-Z]{2,5}|GMT|UTC/);
});
