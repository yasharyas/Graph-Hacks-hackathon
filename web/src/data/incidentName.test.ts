// Run: node --test web/src/data/incidentName.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { incidentName } from './incidentName.ts';

test('the incident is named by its account, never by its headline', () => {
  assert.equal(incidentName({ title: 'qix npm account takeover: 19 malicious versions of chalk, debug, ansi-styles and 16 other packages', maintainer: 'qix' }), 'the qix npm account takeover');
  assert.equal(incidentName({ title: 'axios npm account takeover: 1.14.1 and 0.30.4 depend on the plain-crypto-js@4.2.1 RAT dropper', maintainer: 'jasonsaayman' }), 'the axios npm account takeover');
  assert.ok(!/RAT|dropper|:/.test(incidentName({ title: 'axios npm account takeover: 1.14.1 and 0.30.4 depend on the plain-crypto-js@4.2.1 RAT dropper', maintainer: null })));
});

test('another title shape falls back to the maintainer, then to "this incident"', () => {
  assert.equal(incidentName({ title: 'A worm in left-pad', maintainer: 'azer' }), 'the azer account compromise');
  assert.equal(incidentName({ title: 'A worm in left-pad', maintainer: null }), 'this incident');
  assert.equal(incidentName(null), 'this incident');
});
