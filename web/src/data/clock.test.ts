import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockIn, DEFAULT_AT, hasClock, localStamp, utcDate } from './clock.ts';
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

test('the alert clock is read the way the server reads it: ISO, 12-hour as UTC, 24-hour with or without a space, 30 days', () => {
  const qix = DEFAULT_AT['qix-2025-09-08'];
  const at = (s: string) => Date.parse(`2025-09-08T${s}:00Z`);
  assert.equal(clockIn('qix compromised, 13:16 UTC', qix), at('13:16'));
  assert.equal(clockIn('qix compromised 13:16UTC', qix), at('13:16'));
  assert.equal(clockIn('qix compromised at 1:16 PM', qix), at('13:16'));
  assert.equal(clockIn('qix compromised at 1:16 p.m.', qix), at('13:16'));
  assert.equal(clockIn('seen 12:05 am', qix), at('00:05'));
  assert.equal(clockIn('qix compromised 2025-09-08T13:16:00Z', qix), at('13:16'));
  assert.equal(clockIn('qix compromised 2024-01-01T13:16:00Z', qix), null); // more than 30 days away: ignored
  assert.equal(clockIn('axios 1.14.1 at 00:21', DEFAULT_AT['axios-2026-03-31']), Date.parse('2026-03-31T00:21:00Z'));
  assert.equal(clockIn('version 1.2:30', qix), null); // part of a longer number
});

test('the header date is the UTC day of the scenario clock, in every locale and zone', () => {
  assert.equal(utcDate(DEFAULT_AT['qix-2025-09-08']), 'Sep 8, 2025');
  assert.equal(utcDate(DEFAULT_AT['axios-2026-03-31']), 'Mar 31, 2026');
  assert.equal(utcDate(Date.parse('2025-09-08T23:59:00Z')), 'Sep 8, 2025'); // still the 8th in UTC, whatever the local zone says
});

test('a local stamp names its zone', () => {
  assert.match(localStamp(Date.parse('2026-10-16T12:00:00Z')), /\d{2}:\d{2}.*[A-Z]{2,5}|GMT|UTC/);
});
