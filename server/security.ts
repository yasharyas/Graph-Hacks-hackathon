// Trust-boundary helpers. Rules S1, S2, S4, S7, S12 in the plan.

export class HttpError extends Error {
  status: 400 | 404 | 413 | 429 | 502;
  constructor(status: HttpError['status'], message: string) {
    super(message);
    this.status = status;
  }
}

// S1/S2: only https://github.com/<owner>/<repo>. Outbound URLs are always built from these two parts.
const REPO_URL = /^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})\/?$/;
const REPO_ID = /^([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})$/;

export function parseRepo(input: unknown): { owner: string; repo: string } | null {
  if (typeof input !== 'string' || input.length > 200) return null;
  const s = input.trim().replace(/\.git$/, '');
  const m = REPO_URL.exec(s) ?? REPO_ID.exec(s);
  if (!m || m[2] === '.' || m[2] === '..') return null;
  return { owner: m[1], repo: m[2] };
}

// S1: lockfile bodies are hostile until proven otherwise.
const POISON = new Set(['__proto__', 'constructor', 'prototype']);
export const MAX_LOCKFILE_BYTES = 5_000_000;

export function safeJson(text: string, maxBytes = MAX_LOCKFILE_BYTES): unknown {
  if (Buffer.byteLength(text) > maxBytes) throw new HttpError(413, 'Lockfile is larger than 5 MB.');
  try {
    return JSON.parse(text, (k, v) => (POISON.has(k) ? undefined : v));
  } catch {
    throw new HttpError(400, 'That is not valid JSON. Paste the contents of package-lock.json.');
  }
}

// S4: untrusted strings (package names, ranges, maintainer handles) entering an LLM prompt.
export function forPrompt(s: unknown, max = 80): string {
  return String(s ?? '').replace(/[^A-Za-z0-9@/._~^<>=|*+ :-]/g, '').slice(0, max);
}

// S7: fixed-window limiter, in memory only (no IPs persisted).
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (hits.size > 10_000) hits.clear(); // ponytail: crude bound; a real store if this ever runs multi-instance
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const over = recent.length >= max;
  if (!over) recent.push(now);
  hits.set(key, recent);
  return over;
}

// S2: outbound allowlist; redirects are refused so a hop can't leave the list.
const OUTBOUND = new Set([
  'api.github.com',
  'raw.githubusercontent.com',
  'registry.npmjs.org',
  'api.osv.dev',
  'api.groq.com',
  'generativelanguage.googleapis.com',
]);

export function safeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const host = new URL(url).hostname;
  if (!OUTBOUND.has(host)) throw new Error(`Outbound host not allowed: ${host}`);
  return fetch(url, { ...init, redirect: 'error', signal: init.signal ?? AbortSignal.timeout(20_000) });
}

// S12: generic message to the client, details only in server logs.
export function errorBody(err: unknown, requestId: string): { status: number; body: { error: string; requestId: string } } {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message, requestId } };
  console.error(`[${requestId}]`, err);
  return { status: 500, body: { error: 'Something went wrong on our side.', requestId } };
}
