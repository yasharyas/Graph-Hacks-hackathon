import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockIn, clockRead, DEFAULT_AT, hasClock, localStamp, utcDate } from './clock.ts';
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

test('a zone or offset after the time is converted: every one of these is 13:16 UTC on the incident day', () => {
  const qix = DEFAULT_AT['qix-2025-09-08'];
  const t = Date.parse('2025-09-08T13:16:00Z');
  for (const s of [
    'qix compromised 6:46 PM IST', 'qix compromised 9:16 AM EDT', 'qix 8:16 am EST', 'qix 6:16 AM PDT', 'qix 5:16 AM PST', 'qix 14:16 CET',
    'qix compromised 15:16 CEST', 'qix 14:16 BST', 'qix 13:16 GMT', 'qix 13:16 UTC', 'qix 13:16Z', 'qix 2025-09-08T18:46:00+05:30',
    'qix 2025-09-08T09:16:00-04:00', 'qix 2025-09-08T13:16:00Z', 'qix 13:16 UTC+0', 'qix 18:46 UTC+5:30', 'qix 18:46 +0530', 'qix 22:16 JST',
  ]) assert.equal(clockIn(s, qix), t, s);
  assert.equal(clockIn('qix compromised 13:16', qix), t); // no zone: UTC, as before
  assert.equal(clockIn('qix compromised at 13:16 on Sept 8', qix), t); // a word after the time is not a zone
  // the incident's day in the alert's own zone: 8:21 PM EDT on the evening before is 00:21 UTC on the axios day
  assert.equal(clockIn('axios compromised 8:21 PM EDT', DEFAULT_AT['axios-2026-03-31']), Date.parse('2026-03-31T00:21:00Z'));
  assert.deepEqual([clockRead('qix 6:46 PM IST')!.zone, clockRead('qix 6:46 PM IST')!.offset, clockRead('qix 6:46 PM')!.zoned], ['IST', 330, false]);
});

test('the header date is the UTC day of the scenario clock, in every locale and zone', () => {
  assert.equal(utcDate(DEFAULT_AT['qix-2025-09-08']), 'Sep 8, 2025');
  assert.equal(utcDate(DEFAULT_AT['axios-2026-03-31']), 'Mar 31, 2026');
  assert.equal(utcDate(Date.parse('2025-09-08T23:59:00Z')), 'Sep 8, 2025'); // still the 8th in UTC, whatever the local zone says
});

test('a local stamp names its zone', () => {
  assert.match(localStamp(Date.parse('2026-10-16T12:00:00Z')), /\d{2}:\d{2}.*[A-Z]{2,5}|GMT|UTC/);
});
