// LLM client: OpenAI-compatible /chat/completions over an ordered provider chain (LLM_CHAIN), first success wins.
// Rule S6: no logging in this file, and keys only ever appear in the Authorization header of the outbound request.
import { safeFetch } from '../security.ts';

// Loose on purpose: a tool loop echoes `raw` (provider-specific fields like Gemini's extra_content) back verbatim.
export type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content?: string | null; tool_call_id?: string; [k: string]: unknown };
export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolCall = { id: string; name: string; args: Record<string, unknown> };
// `chain` overrides LLM_CHAIN for this call only (e.g. pin the provider a tool loop started on).
export type ChatReq = { messages: Msg[]; tools?: ToolSpec[]; maxTokens?: number; signal?: AbortSignal; chain?: string };
// finish: the provider's finish_reason ('length' = cut by max_tokens, so the text is truncated).
export type ChatRes = { text: string; toolCalls: ToolCall[]; provider: string; raw: unknown; finish?: string | null };
export type Failure = { provider: string; reason: string };

const DEFAULT_CHAIN = 'groq:qwen/qwen3.8-27b,groq:openai/gpt-oss-120b,gemini:gemini-3.5-flash-lite';
const HOSTS = new Map([
  ['groq', { base: 'https://api.groq.com/openai/v1', key: 'GROQ_API_KEY' }],
  ['gemini', { base: 'https://generativelanguage.googleapis.com/v1beta/openai', key: 'GEMINI_API_KEY' }],
]);

// Reasons are fixed strings (status codes, "timeout", ...): never upstream bodies, never keys (S6, S12).
export class AllProvidersFailed extends Error {
  failures: Failure[];
  constructor(failures: Failure[]) {
    super(`All LLM providers failed: ${failures.map((f) => `${f.provider} ${f.reason}`).join('; ') || 'none configured'}`);
    this.name = 'AllProvidersFailed';
    this.failures = failures;
  }
}

const envNum = (name: string, dflt: number) => {
  const v = process.env[name];
  return v === undefined || v === '' || Number.isNaN(Number(v)) ? dflt : Number(v);
};

// S7: global daily cap on outbound calls (a fallback attempt counts), in memory, resets at UTC midnight.
let used = { day: '', n: 0 };
export const resetDailyCap = () => void (used = { day: '', n: 0 });
function spend(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (used.day !== day) used = { day, n: 0 };
  if (used.n >= envNum('LLM_DAILY_CAP', 800)) return false;
  used.n++;
  return true;
}

// qwen3 emits <think>…</think> inline; also drop an unclosed block (max_tokens cut) and an orphan closing tag.
const stripThink = (s: string) => s.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').replace(/^[\s\S]*<\/think>/i, '').trim();

// Returns a failure reason (string) when the next provider should be tried, or the result.
async function call(base: string, key: string, model: string, req: ChatReq, fetchImpl: typeof safeFetch): Promise<ChatRes | string> {
  const body = {
    model,
    messages: req.messages,
    temperature: 0,
    max_tokens: req.maxTokens ?? 600,
    ...(req.tools?.length ? { tools: req.tools.map((t) => ({ type: 'function', function: t })) } : {}),
  };
  const signal = AbortSignal.any([AbortSignal.timeout(envNum('LLM_TIMEOUT_MS', 15_000)), ...(req.signal ? [req.signal] : [])]);
  const res = await fetchImpl(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) return (await res.text()).includes('tool_use_failed') ? 'tool_use_failed' : `HTTP ${res.status}`;
  const choice = ((await res.json()) as { choices?: { message?: Record<string, any>; finish_reason?: unknown }[] })?.choices?.[0];
  const msg = choice?.message;
  const finish = typeof choice?.finish_reason === 'string' ? choice.finish_reason : null;
  if (!msg || typeof msg !== 'object') return 'bad response';
  try {
    const toolCalls = ((msg.tool_calls ?? []) as any[]).map((tc) => {
      const args = JSON.parse(tc.function.arguments || '{}');
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error();
      return { id: String(tc.id ?? ''), name: String(tc.function.name), args };
    });
    return { text: stripThink(typeof msg.content === 'string' ? msg.content : ''), toolCalls, provider: '', raw: msg, finish };
  } catch {
    return 'bad tool call'; // malformed tool-call arguments behave like tool_use_failed: try the next provider
  }
}

export async function chat(req: ChatReq, fetchImpl: typeof safeFetch = safeFetch): Promise<ChatRes> {
  const failures: Failure[] = [];
  // `replay` (and `template`) are non-LLM fallbacks the caller handles after this throws.
  const chain = (req.chain ?? process.env.LLM_CHAIN ?? DEFAULT_CHAIN).split(',').map((s) => s.trim()).filter((s) => s && s !== 'replay' && s !== 'template');
  for (const provider of chain) {
    const cut = provider.indexOf(':'); // model ids contain "/" and may contain ":", so split on the first only
    const host = HOSTS.get(provider.slice(0, cut));
    const fail = (reason: string) => failures.push({ provider, reason });
    if (cut < 0 || !host) { fail('unknown provider'); continue; }
    const key = process.env[host.key];
    if (!key) { fail('missing key'); continue; }
    if (!spend()) { fail('daily cap reached'); break; }
    try {
      const r = await call(host.base, key, provider.slice(cut + 1), req, fetchImpl);
      if (typeof r !== 'string') return { ...r, provider };
      fail(r);
    } catch (e) {
      if (req.signal?.aborted) throw e; // the caller gave up: don't burn the rest of the chain
      fail((e as Error)?.name === 'TimeoutError' ? 'timeout' : 'network error');
    }
  }
  throw new AllProvidersFailed(failures);
}
