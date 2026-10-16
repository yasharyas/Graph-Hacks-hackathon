// Run: node --test web/src/data/repoFit.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { FIT_SLACK, OWNER_KEEP, repoFit } from './repoFit.ts';
import { repoParts } from './repoLabel.ts';

const px = 7; // a stand-in for the browser's measure: every character is 7px wide
const width = (s: string) => s.length * px;
const fit = (repo: string, chars: number) => repoFit(repoParts(repo), chars * px + FIT_SLACK, width);

test('the whole id is written when it fits', () => {
  assert.equal(fit('acme/checkout-web', 17), 'whole');
  assert.equal(fit('acme/checkout-web', 40), 'whole');
});

test('only the owner gives way: first to its two letters, then to the ellipsis alone, then to the name by itself', () => {
  // "nightwatchjs/nightwatch" is 23 characters; "ni…/nightwatch" 14; "…/nightwatch" 12; "nightwatch" 10
  assert.equal(fit('nightwatchjs/nightwatch', 22), 'short');
  assert.equal(fit('nightwatchjs/nightwatch', 14), 'short');
  assert.equal(fit('nightwatchjs/nightwatch', 13), 'tiny');
  assert.equal(fit('nightwatchjs/nightwatch', 12), 'tiny');
  assert.equal(fit('nightwatchjs/nightwatch', 11), 'name');
  assert.equal(OWNER_KEEP, 2);
});

test('the name is never what gives way before the owner has: each fit keeps all of it', () => {
  for (let chars = 8; chars <= 30; chars++) {
    const f = fit('swagger-api/swagger-ui', chars);
    const shown = { whole: 'swagger-api/swagger-ui', short: 'sw…/swagger-ui', tiny: '…/swagger-ui', name: 'swagger-ui' }[f];
    assert.ok(shown.endsWith('swagger-ui'), `${chars}: ${shown}`);
    if (f !== 'name') assert.ok(shown.length * px <= chars * px, `${chars} chars hold "${shown}"`);
  }
});

test('an owner no longer than its two letters and an ellipsis is not shortened', () => {
  assert.equal(fit('vue/core', 7), 'tiny', 'straight to the ellipsis, never "vu…/core" for "vue"');
  assert.equal(fit('ms/typescript', 12), 'tiny');
});

test('a repo with no owner (a pasted lockfile) is always whole', () => {
  assert.equal(repoFit(repoParts('pasted/patient-zero'), 10, width), 'whole');
});

test("today's lockfile is part of what has to fit, and is cut after the name, not before it", () => {
  const p = repoParts('mochajs/mocha@HEAD'); // "mochajs/mocha (today's lockfile)": 33 characters
  assert.equal(repoFit(p, 33 * px + FIT_SLACK, width), 'whole');
  assert.equal(repoFit(p, 30 * px + FIT_SLACK, width), 'short', '"mo…/mocha (today\'s lockfile)" is 29');
});
