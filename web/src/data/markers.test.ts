import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampCentre, markersOf, placeLabels } from './markers.ts';
import { utc } from './format.ts';
import type { IncidentMeta } from './types.ts';

type Spec = Omit<IncidentMeta, 'title' | 'maintainer' | 'versions' | 'sources'>;
const D = (s: string) => Date.parse(s);
// The two incidents as the API serves them (times, not prose).
const QIX: Spec = { id: 'qix-2025-09-08', firstPublishAt: D('2025-09-08T13:12:10.343Z'), firstExposureAt: D('2025-09-08T13:12:10.343Z'), alertAt: D('2025-09-08T13:16:00Z'), advisoryAt: D('2025-09-08T14:26:51Z'), removedAt: D('2025-09-08T15:15:00Z') };
const AXIOS: Spec = { id: 'axios-2026-03-31', firstPublishAt: D('2026-03-30T23:59:12.278Z'), firstExposureAt: D('2026-03-31T00:21:58.168Z'), alertAt: D('2026-03-31T02:19:00Z'), advisoryAt: D('2026-03-31T02:07:58Z'), removedAt: D('2026-03-31T03:15:00Z') };
const inc = (x: Spec): IncidentMeta => ({ title: '', maintainer: null, versions: [], sources: [], ...x });
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test('the first marker is the first exposure, and its label minus the OSV label is the figure', () => {
  for (const [i, ahead, first] of [[QIX, 74, '13:12'], [AXIOS, 105, '00:22']] as const) {
    const [exposed, , osv] = markersOf(inc(i));
    assert.equal(exposed!.key, 'exposed');
    assert.equal(minutes(utc(osv!.shown)) - minutes(utc(exposed!.shown)), ahead);
    assert.equal(utc(exposed!.shown), first);
    assert.equal(Math.floor((i.advisoryAt - i.firstExposureAt!) / 60_000), ahead); // the App's figure
  }
  assert.equal(markersOf(inc(AXIOS))[0]!.t, AXIOS.firstExposureAt); // the tick sits at the true instant, not the 23:59 publish
});

test('an older server without firstExposureAt falls back to the first publish', () => {
  const [m] = markersOf(inc({ ...AXIOS, firstExposureAt: null }));
  assert.deepEqual([m!.short, m!.t], ['publish', AXIOS.firstPublishAt]);
});

/** Label widths like the rendered ones: "HH:MM" in 12px mono plus the word in 12px sans. */
const widthOf = (word: string) => 5 * 7.2 + 4 + word.length * 6.4;

test('labels never overlap and never leave the track, 320 to 1920 px, both incidents', () => {
  for (const i of [QIX, AXIOS]) {
    const ms = markersOf(inc(i));
    const start = Math.floor(ms[0]!.t / 3_600_000) * 3_600_000; // the track starts on the hour before the first marker
    const end = i.removedAt + 30 * 60_000;
    for (let screen = 320; screen <= 1920; screen += 13) {
      const trackW = screen - 48 - 16; // gutter and thumb inset
      const wide = trackW >= 520;
      const marks = ms.map((m) => ({ x: ((m.t - start) / (end - start)) * trackW, w: widthOf(wide ? m.long : m.short) }));
      const put = placeLabels(marks, trackW);
      put.forEach((p, a) => {
        assert.ok(p.left >= 0 && p.left + marks[a]!.w <= trackW + 1e-9, `inside the track at ${screen}px`);
        put.forEach((q, b) => {
          if (a < b && p.row === q.row) assert.ok(p.left + marks[a]!.w + 8 <= q.left || q.left + marks[b]!.w + 8 <= p.left, `no overlap at ${screen}px`);
        });
      });
    }
  }
});

test('placement holds for arbitrary ticks', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = 0; n < 500; n++) {
    const trackW = 200 + rnd() * 1500;
    const marks = Array.from({ length: 4 }, () => ({ x: rnd() * trackW, w: 40 + rnd() * 90 }));
    const put = placeLabels(marks, trackW);
    put.forEach((p, a) =>
      put.forEach((q, b) => {
        if (a < b && p.row === q.row) assert.ok(p.left + marks[a]!.w + 8 <= q.left || q.left + marks[b]!.w + 8 <= p.left);
      }),
    );
    put.forEach((p, a) => assert.ok(p.left >= 0 && p.left + marks[a]!.w <= trackW + 1e-9));
  }
});

test('the scrub bubble stays inside the track at both ends', () => {
  assert.equal(clampCentre(0, 48, 300), 24);
  assert.equal(clampCentre(300, 48, 300), 276);
  assert.equal(clampCentre(150, 48, 300), 150);
});
