import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alertNotes, incidentName } from './alertNote.ts';
import { clockRead } from './clock.ts';
import type { IncidentMeta } from './types.ts';

const T = (s: string) => Date.parse(s);
const qix: IncidentMeta = {
  id: 'qix-2025-09-08',
  title: 'qix npm account takeover: 19 malicious versions of chalk, debug, ansi-styles and 16 other packages',
  maintainer: 'qix',
  firstPublishAt: T('2025-09-08T13:12:10Z'),
  alertAt: T('2025-09-08T13:16:00Z'),
  advisoryAt: T('2025-09-08T14:26:51Z'),
  removedAt: T('2025-09-08T15:15:00Z'),
  versions: [{ id: 'debug@4.4.2', publishedAt: 0 }, { id: 'chalk@5.6.1', publishedAt: 0 }],
  sources: [],
};
const axios: IncidentMeta = {
  ...qix,
  id: 'axios-2026-03-31',
  title: 'axios npm account takeover: 1.14.1 and 0.30.4 depend on the plain-crypto-js@4.2.1 RAT dropper',
  maintainer: 'jasonsaayman',
  alertAt: T('2026-03-31T02:19:00Z'),
  versions: [{ id: 'axios@1.14.1', publishedAt: 0 }, { id: 'plain-crypto-js@4.2.1', publishedAt: 0 }],
};
const both = [qix, axios];
const at = (s: string) => ({ incident: qix, at: T(`2025-09-08T${s}:00Z`) });

test('a time read is reported: its form, its meaning, and whether it named a zone', () => {
  assert.deepEqual(clockRead('qix at 1:16 PM'), { raw: '1:16 PM', kind: '12h', h: 13, m: 16, date: null, zoned: false });
  assert.equal(clockRead('qix 13:16UTC')?.zoned, true);
  assert.equal(clockRead('qix 13:16 utc')?.zoned, true);
  assert.equal(clockRead('qix 2025-09-08T13:16:00Z')?.zoned, true);
  assert.equal(clockRead('qix 13:16')?.zoned, false);
  assert.equal(clockRead('qix compromised'), null);
});

test('a 12-hour time says how it was read, and that it was taken as UTC', () => {
  assert.deepEqual(alertNotes('qix compromised at 1:16 PM', at('13:16'), both), ['Read “1:16 PM” as 13:16 UTC: no time zone given, so UTC.']);
  assert.deepEqual(alertNotes('qix compromised at 1:16 PM UTC', at('13:16'), both), ['Read “1:16 PM” as 13:16 UTC.']);
});

test('an hour that could be either is read on the 24-hour clock, and the other reading is named', () => {
  assert.deepEqual(alertNotes('qix compromised 1:16', at('01:16'), both), ['Read “1:16” as 01:16 UTC, on the 24-hour clock in UTC. Add PM if you meant 13:16.']);
  assert.match(alertNotes('qix 9:05 UTC', at('09:05'), both)[0]!, /24-hour clock\. Add PM if you meant 21:05\.$/);
  assert.deepEqual(alertNotes('qix 01:16', at('01:16'), both), ['Read “01:16” as 01:16 UTC: no time zone given, so UTC.']); // a leading zero is 24-hour
});

test('an explicit UTC time needs no note; a bare 24-hour one says UTC was assumed', () => {
  assert.deepEqual(alertNotes('qix compromised, 13:16 UTC', at('13:16'), both), []);
  assert.deepEqual(alertNotes('qix 2025-09-08T13:16:00Z', at('13:16'), both), []);
  assert.deepEqual(alertNotes('qix compromised 13:16', at('13:16'), both), ['Read “13:16” as 13:16 UTC: no time zone given, so UTC.']);
});

test('no time: the scenario default, and an example from the incident that ran (never the other one\'s clock)', () => {
  assert.deepEqual(alertNotes('qix account hijacked', at('13:30'), both), ['No time in the alert: using 13:30 UTC, the scenario default. Add one, like 13:16 UTC.']);
  assert.deepEqual(alertNotes('axios compromised', { incident: axios, at: T('2026-03-31T01:30:00Z') }, both), ['No time in the alert: using 01:30 UTC, the scenario default. Add one, like 02:19 UTC.']);
});

test('an alert that names two incidents says which one ran', () => {
  assert.deepEqual(alertNotes('qix and axios compromised 13:16 UTC', at('13:16'), both), ['The alert names qix and axios: this triage is qix. Pick axios above to triage that one.']);
  assert.deepEqual(alertNotes('debug@4.4.2 and plain-crypto-js seen 13:16 UTC', at('13:16'), both).length, 1);
  assert.deepEqual(alertNotes('qix and axios compromised 13:16 UTC', at('13:16')), []); // incidents not loaded: no guess
  assert.equal(incidentName(axios), 'axios');
});
