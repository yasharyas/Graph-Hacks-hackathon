import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural, signedMin, utcLabel, utcStamp } from './format.ts';

test('wall-clock stamps are UTC, like every other time in the app', () => {
  assert.equal(utcStamp(Date.parse('2026-10-16T04:16:30Z')), '16 Oct, 04:16 UTC');
  assert.equal(utcStamp(Date.parse('2025-09-08T23:59:59Z')), '8 Sep, 23:59 UTC');
  assert.equal(utcLabel(Date.parse('2025-09-08T13:30:00Z')), '13:30 UTC');
});

test('plurals and signed minutes', () => {
  assert.equal(plural(1, 'OSV advisory', 'OSV advisories'), '1 OSV advisory');
  assert.equal(plural(4, 'repo'), '4 repos');
  assert.equal(signedMin(-4), '−4 min');
});
