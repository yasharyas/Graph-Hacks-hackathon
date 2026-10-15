// server/agent/llm.ts against a fake fetch: no network, no real keys.
import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { chat, AllProvidersFailed, resetDailyCap } from '../server/agent/llm.ts';

const GROQ_KEY = 'gsk_test_SECRET_groq_123';
const GEMINI_KEY = 'AIza_test_SECRET_gemini_456';
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const messages = [{ role: 'user' as const, content: 'hi' }];

beforeEach(() => {
  resetDailyCap();
  delete process.env.LLM_CHAIN;
  delete process.env.LLM_DAILY_CAP;
  process.env.LLM_TIMEOUT_MS = '50';
  process.env.GROQ_API_KEY = GROQ_KEY;
  process.env.GEMINI_API_KEY = GEMINI_KEY;
});

const completion = (message: Record<string, unknown>) => new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', ...message } }] }));
const ok = (content = 'hello') => completion({ content });
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

// Each call consumes the next handler (the last one repeats); calls are recorded.
function fake(...handlers: Handler[]) {
  const calls: { url: string; init: RequestInit; body: any }[] = [];
  const fetchImpl = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    return handlers[Math.min(calls.length, handlers.length) - 1](url, init);
  };
  return { fetchImpl, calls };
}

test('first provider wins; request is OpenAI-compatible, temperature 0, 600 tokens', async () => {
  const { fetchImpl, calls } = fake(() => ok('hi there'));
  const r = await chat({ messages }, fetchImpl);
  assert.equal(r.text, 'hi there');
  assert.equal(r.provider, 'groq:qwen/qwen3.8-27b');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, GROQ);
  assert.equal(calls[0].body.model, 'qwen/qwen3.8-27b');
  assert.equal(calls[0].body.temperature, 0);
  assert.equal(calls[0].body.max_tokens, 600);
  assert.equal(calls[0].body.tools, undefined);
  assert.deepEqual(calls[0].body.messages, messages);
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, `Bearer ${GROQ_KEY}`);
});

test('maxTokens is passed through', async () => {
  const { fetchImpl, calls } = fake(() => ok());
  await chat({ messages, maxTokens: 50 }, fetchImpl);
  assert.equal(calls[0].body.max_tokens, 50);
});

test('falls back in order across 429, 5xx and timeout, then succeeds on the last provider', async () => {
  const hang: Handler = (_u, init) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(init.signal!.reason)));
  const { fetchImpl, calls } = fake(() => new Response('slow down', { status: 429 }), () => new Response('boom', { status: 503 }), () => ok('from gemini'));
  const r = await chat({ messages }, fetchImpl);
  assert.deepEqual(calls.map((c) => c.body.model), ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'gemini-3.5-flash-lite']);
  assert.equal(calls[2].url, GEMINI);
  assert.equal((calls[2].init.headers as Record<string, string>).authorization, `Bearer ${GEMINI_KEY}`);
  assert.equal(r.provider, 'gemini:gemini-3.5-flash-lite');
  assert.equal(r.text, 'from gemini');

  const t = fake(hang, () => ok('after timeout'));
  const r2 = await chat({ messages }, t.fetchImpl);
  assert.equal(r2.provider, 'groq:openai/gpt-oss-120b');
  assert.equal(t.calls.length, 2);
});

test('network errors and tool_use_failed bodies fall back', async () => {
  const { fetchImpl, calls } = fake(
    () => { throw new TypeError('fetch failed'); },
    () => new Response(JSON.stringify({ error: { code: 'tool_use_failed', failed_generation: '<function=x>' } }), { status: 400 }),
    () => ok('third'),
  );
  const r = await chat({ messages }, fetchImpl);
  assert.equal(calls.length, 3);
  assert.equal(r.text, 'third');
});

test('malformed tool-call arguments and empty bodies fall back', async () => {
  const bad = completion({ content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'x', arguments: '{nope' } }] });
  const { fetchImpl, calls } = fake(() => bad, () => new Response('{}'), () => ok('fine'));
  assert.equal((await chat({ messages }, fetchImpl)).text, 'fine');
  assert.equal(calls.length, 3);
});

test('a missing key skips the provider without calling out', async () => {
  delete process.env.GROQ_API_KEY;
  const { fetchImpl, calls } = fake(() => ok());
  const r = await chat({ messages }, fetchImpl);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, GEMINI);
  assert.equal(r.provider, 'gemini:gemini-3.5-flash-lite');
});

test('LLM_CHAIN is honoured and replay/template entries are ignored', async () => {
  process.env.LLM_CHAIN = 'replay, groq:some/model:v2 ,template';
  const { fetchImpl, calls } = fake(() => ok());
  const r = await chat({ messages }, fetchImpl);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, 'some/model:v2'); // split on the first colon only
  assert.equal(r.provider, 'groq:some/model:v2');

  process.env.LLM_CHAIN = 'replay';
  await assert.rejects(chat({ messages }, fake(() => ok()).fetchImpl), AllProvidersFailed);
});

test('all providers failing throws AllProvidersFailed with per-provider reasons and no key anywhere', async () => {
  delete process.env.GEMINI_API_KEY;
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => mock.method(console, m, () => {}));
  const { fetchImpl } = fake(() => new Response(`echo ${GROQ_KEY}`, { status: 429 }), () => new Response('x', { status: 500 }));
  const err = await chat({ messages }, fetchImpl).catch((e) => e);
  spies.forEach((s) => s.mock.restore());
  assert.ok(err instanceof AllProvidersFailed);
  assert.deepEqual(err.failures, [
    { provider: 'groq:qwen/qwen3.8-27b', reason: 'HTTP 429' },
    { provider: 'groq:openai/gpt-oss-120b', reason: 'HTTP 500' },
    { provider: 'gemini:gemini-3.5-flash-lite', reason: 'missing key' },
  ]);
  const everything = `${err.message} ${JSON.stringify(err.failures)} ${err.stack}`;
  for (const secret of [GROQ_KEY, GEMINI_KEY, 'Bearer']) assert.ok(!everything.includes(secret), `leaked ${secret}`);
  for (const s of spies) assert.equal(s.mock.callCount(), 0, 'llm.ts must not log');
});

test('<think> blocks are stripped from text but raw keeps the provider message verbatim', async () => {
  const content = '<think>plan the answer\nacross lines</think>\n\nFinal answer.';
  const r = await chat({ messages }, fake(() => ok(content)).fetchImpl);
  assert.equal(r.text, 'Final answer.');
  assert.deepEqual(r.raw, { role: 'assistant', content });

  const cut = await chat({ messages }, fake(() => ok('Before. <think>never closed because max_tokens hit')).fetchImpl);
  assert.equal(cut.text, 'Before.');
  const orphan = await chat({ messages }, fake(() => ok('reasoning without opener</think>Answer')).fetchImpl);
  assert.equal(orphan.text, 'Answer');
});

test('tool specs go out in OpenAI format and tool calls are parsed; raw echoes extra_content untouched', async () => {
  const message = {
    content: null,
    tool_calls: [
      { id: 'call_1', type: 'function', function: { name: 'incident_exposure', arguments: '{"incident":"qix","at":1757338200000}' }, extra_content: { google: { thought_signature: 'SIG==' } } },
      { id: 'call_2', type: 'function', function: { name: 'route_owners', arguments: '' } },
    ],
  };
  const tools = [{ name: 'incident_exposure', description: 'd', parameters: { type: 'object', properties: {}, required: [] } }];
  const { fetchImpl, calls } = fake(() => completion(message));
  const r = await chat({ messages, tools }, fetchImpl);
  assert.deepEqual(calls[0].body.tools, [{ type: 'function', function: tools[0] }]);
  assert.deepEqual(r.toolCalls, [
    { id: 'call_1', name: 'incident_exposure', args: { incident: 'qix', at: 1757338200000 } },
    { id: 'call_2', name: 'route_owners', args: {} },
  ]);
  assert.equal(r.text, '');
  assert.deepEqual(r.raw, { role: 'assistant', ...message });
});

test('daily cap: calls over LLM_DAILY_CAP throw without calling out, and the count resets at UTC midnight', async () => {
  process.env.LLM_DAILY_CAP = '2';
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-15T23:59:00Z') });
  try {
    const { fetchImpl, calls } = fake(() => ok());
    await chat({ messages }, fetchImpl);
    await chat({ messages }, fetchImpl);
    await assert.rejects(chat({ messages }, fetchImpl), (e: AllProvidersFailed) => e instanceof AllProvidersFailed && e.failures[0].reason === 'daily cap reached');
    assert.equal(calls.length, 2);
    mock.timers.setTime(Date.parse('2026-10-16T00:00:01Z'));
    await chat({ messages }, fetchImpl);
    assert.equal(calls.length, 3);
  } finally {
    mock.timers.reset();
  }
});

test('a caller abort is rethrown instead of burning the rest of the chain', async () => {
  const ac = new AbortController();
  const { fetchImpl, calls } = fake((_u, init) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(init.signal!.reason))));
  const p = chat({ messages, signal: ac.signal }, fetchImpl);
  ac.abort(new Error('client left'));
  await assert.rejects(p, /client left/);
  assert.equal(calls.length, 1);
});
