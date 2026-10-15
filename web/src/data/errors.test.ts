// Run: node --test web/src/data/errors.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { plainError } from './errors.ts';

test('raw upstream strings become plain sentences; the server\'s own messages pass through', () => {
  assert.equal(plainError({ message: 'upstream failure' }), "The graph server didn't answer. Try again.");
  assert.equal(plainError({ message: 'Request failed (502)' }), "The graph server didn't answer. Try again.");
  assert.equal(plainError({ message: 'Something went wrong on our side.' }), 'The graph server hit an error. Try again.');
  assert.equal(plainError({ message: 'That triage has expired. Run it again to ask follow-ups.' }), 'That triage has expired. Run it again to ask follow-ups.');
});
