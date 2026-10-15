import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepo, safeJson, forPrompt, limited, safeFetch, errorBody, HttpError } from '../server/security.ts';
import { app } from '../server/index.ts';

test('S1/S2 repo parsing accepts only github owner/repo', () => {
  assert.deepEqual(parseRepo('https://github.com/mochajs/mocha'), { owner: 'mochajs', repo: 'mocha' });
  assert.deepEqual(parseRepo('https://github.com/npm/cli.git'), { owner: 'npm', repo: 'cli' });
  assert.deepEqual(parseRepo('louislam/uptime-kuma'), { owner: 'louislam', repo: 'uptime-kuma' });
  for (const bad of [
    'http://github.com/a/b',
    'https://github.com.evil.com/a/b',
    'https://169.254.169.254/latest/meta-data',
    'https://github.com/../etc',
    'https://github.com/a/..',
    'https://github.com/a/b/../../c',
    'https://github.com/a/b?x=1',
    'file:///etc/passwd',
    42,
  ]) assert.equal(parseRepo(bad), null, String(bad));
});

test('S1 lockfile JSON drops prototype-pollution keys and caps size', () => {
  const parsed = safeJson('{"packages":{"__proto__":{"polluted":true},"node_modules/a":{"constructor":1,"version":"1.0.0"}}}') as any;
  assert.equal(({} as any).polluted, undefined);
  assert.equal(Object.hasOwn(parsed.packages, '__proto__'), false);
  assert.equal(Object.hasOwn(parsed.packages['node_modules/a'], 'constructor'), false);
  assert.throws(() => safeJson('x'.repeat(11), 10), (e: any) => e instanceof HttpError && e.status === 413);
  assert.throws(() => safeJson('{nope'), (e: any) => e instanceof HttpError && e.status === 400);
});

test('S4 prompt strings are charset-limited and capped', () => {
  assert.equal(forPrompt('debug@^4.3.5'), 'debug@^4.3.5');
  assert.equal(forPrompt('>=1.2.0 <2'), '>=1.2.0 <2'); // semver comparators survive
  assert.equal(forPrompt('a"b`c\n{d}\'e;f'), 'abcdef'); // nothing that can break out of the JSON data block
  assert.equal(forPrompt('a'.repeat(200)).length, 80);
});

test('S7 limiter blocks after max within window', () => {
  const k = `t${Math.random()}`;
  assert.equal(limited(k, 2, 1000, 0), false);
  assert.equal(limited(k, 2, 1000, 1), false);
  assert.equal(limited(k, 2, 1000, 2), true);
  assert.equal(limited(k, 2, 1000, 1500), false);
});

test('S2 outbound fetch refuses hosts off the allowlist', () => {
  assert.throws(() => safeFetch('https://evil.example.com/x'), /not allowed/);
  assert.throws(() => safeFetch('http://169.254.169.254/'), /not allowed/);
});

test('S12 errors never leak internals', () => {
  const orig = console.error;
  console.error = () => {};
  try {
    const r = errorBody(new Error('ECONNREFUSED 127.0.0.1:6379 secret stack'), 'req1');
    assert.equal(r.status, 500);
    assert.doesNotMatch(JSON.stringify(r.body), /ECONNREFUSED|stack|6379/);
  } finally {
    console.error = orig;
  }
  assert.deepEqual(errorBody(new HttpError(429, 'Slow down'), 'r').body, { error: 'Slow down', requestId: 'r' });
});

test('S5/S8 security headers present, body limit enforced', async () => {
  const res = await app.request('/api/health');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  assert.match(res.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const big = await app.request('/api/triage', { method: 'POST', body: 'x'.repeat(9000), headers: { 'content-type': 'application/json' } });
  assert.equal(big.status, 413);
});
