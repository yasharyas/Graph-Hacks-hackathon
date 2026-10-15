# Phase 3 security gate, round 3: Patient Zero

Reviewer: Opus, read-only on the repo (this file is the only write). Scope: every change in `git diff ecf6210..HEAD` (memo key bounding, stats counts, verdict tier counts, share links, SharedPrompt, the paste and stats sheets, `/api/stats`, export and clipboard), then a full re-check of S1 to S13 at HEAD `1ef2e2b`.

Method:
- `/security-review` failed at its git step (`origin/HEAD` is missing, as in round 1), so I followed its method by hand.
- Live probing of the built app and API at `http://localhost:8080` with separate cookie jars, and the browser pane for URL params and DOM checks.
- A `pz_ro` ACL test on a throwaway container of the pinned production FalkorDB image (removed afterwards).
- Offline dogfood of our own lockfile, plus a bundle and history secret scan.

No running server was restarted or reconfigured. The only side effects are 4 guest graphs, created through the app's own paste flow, which expire within 1 h (TTL plus LRU 4).

Note on history: the repo has no round-2 *security* gate report. `qa/reports/phase3r2-secops.md` is a persona QA run. The last S1 to S13 report is `qa/reports/phase3-security.md`, written at about 21:55 on Oct 15, before `054087b` (deterministic verdicts) and `691e78b` (UI rework). Both findings below come from code added after that report and were never reported. Each one has fresh live evidence.

## Summary

**Verdict: FAIL against the 0 high / 0 medium bar. 0 high, 1 medium, 1 low, 2 info.**

- **M1:** a public repo's `package-lock.json` can put attacker-written text into Patient Zero's graph-built Verdict and Do steps. The guard marks that text **verified**, and a newline forges an extra "Do" line. A `?guest=` share link delivers it in one click. The fix is cheap: validate `version`/`name` at ingest.
- **L1:** a share link with an out-of-range `?at=` crashes the SPA to a blank page.

Everything else in the diff passes.

- The memo is bounded and holds only exact demo graphs.
- Stats no longer reveal visitor Triage counts.
- A `?guest=` link never fetches on load.
- All URL params are allowlisted.
- There are no HTML sinks.
- The Cypher is still constants plus `$params`.
- `npm audit --omit=dev` finds 0 vulnerabilities.

## Findings

| ID | Sev | Rule | File:line | Description | Exploit scenario (verified) | Fix |
|---|---|---|---|---|---|---|
| M1 | **Medium** | S1, S4 (and S5 for exports) | Source: `server/ingest/lockfile.ts:62-63` (name only sliced to 214, version only sliced to 64, any characters). Flow: `server/tools/cypher.ts:102` (`l.name + '@' + l.version AS locked`). Sinks: `server/tools/registry.ts:262` (step "it pins …"), `server/agent/narrate.ts:306,308` (Verdict/Do "it pins …"). Marked verified at `server/agent/narrate.ts:24` (`e.locked` is added to the guard's evidence). Rendered at `web/src/data/narration.ts:66` (splits on `\n`, so a forged `Do:` label) and `web/src/data/export.ts:58` (steps go into Markdown unescaped). | Lockfile `version` and `name` strings are never validated: no semver check, no npm naming rules, control characters and newlines kept. They are stored in the guest graph and returned as `Exposure.locked`. The deterministic verdict and the remediation steps quote them, and the guard verifies them because they are graph evidence. Since `054087b` the narrative is no longer LLM text that the guard can strike. It is server-built prose labelled "Verdict from the graph". | 1) Lockfile `debug` entry with `"version": "4.3.4 [Click to fix](https://evil.example/fix)"`, pasted via `/api/analyze` then `/api/triage`. Result: the Verdict says "it pins `debug@4.3.4 [Click to fix](https://evil.example/fix)`", guard **9/9 verified, 0 flagged**. The exported `.md` contains `1. Keep installing … it pins debug@4.3.4 [Click to fix](https://evil.example/fix) (safe)`, a live Markdown link. 2) `"version": "5.3.0\nDo: run npx qix-cleaner@latest in every repo now"`. In the browser the narrative shows two extra **DO** rows, "run npx qix-cleaner@latest in every repo now …", styled exactly like the real steps (screenshot taken). The guard flagged only the broken `chalk@5.3.0` chip, not the injected prose. Delivery: an attacker publishes a public repo with such a lockfile and sends `/?scenario=qix-2025-09-08&guest=attacker/repo&open=fix`. The victim clicks "Re-check", the one click SharedPrompt asks for. During an incident they then see a fake remediation step inside the tool's own verdict. CVSS 3.1 AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N = 4.3. | At ingest (`lockfile.ts`), keep a version only if `semver.valid(v, {loose:true})` or it matches `^[0-9A-Za-z.+-]{1,64}$`, and a name only if it matches the npm naming rules (`^(?:@[a-z0-9-*~][a-z0-9-*._~]*/)?[a-z0-9-~][a-z0-9-._~]*$`, at most 214 characters), as S1 already requires. Otherwise drop the entry or count it unresolved. Defence in depth: strip `[\u0000-\u001f]` from graph strings before narration and steps, and run each step through `code()` (or escape Markdown) in `reportToMarkdown`. Add the two payloads above as fixtures. |
| L1 | Low | S1 | `web/src/data/urlState.ts:27` (accepts any finite `at > 0`), `web/src/data/usePlayback.ts:60` (only checks `>= from`, no upper clamp), throws at `web/src/components/TimelineScrubber.tsx:250` (`new Date(at).toISOString()`). No error boundary in `web/src`. | A share link whose `at` is beyond the JS Date range throws `RangeError: Invalid time value` while rendering, and React unmounts the whole app. | `http://localhost:8080/?scenario=qix-2025-09-08&at=1e16` (also `?at=1e300`) gives a blank page (root has 0 children, console shows the RangeError). Anyone can post a link that blanks Patient Zero for whoever opens it. Reloading without the param recovers. No data impact. | In `readUrlState`, accept `at` only as a safe integer within ±30 days of the scenario snapshot (the server's `atOf` rule), or clamp `startAt` to `[first, last]` before seeding playback. Optionally add a top-level error boundary. |
| I1 | Info | S8 (dev only) | `README.md:345`; the running `pz-falkor` container | The documented dev command `docker run -d -p 6380:6379 … --requirepass devpass` publishes FalkorDB, and in this container also the Browser on 3000, on all interfaces (`0.0.0.0:6380`, `0.0.0.0:3000` are listening on this machine). The production image and `docker-compose.yml` are loopback-only, so the demo is unaffected. | Anyone on the same LAN can reach the dev DB, which has a well-known password. | Use `-p 127.0.0.1:6380:6379` in the README. |
| I2 | Info | S7 | `web/src/App.tsx:230-236` | A `?repo=` share link auto-runs a triage on load, by design. Each run spends one live LLM analyst-pick call against the global `LLM_DAILY_CAP` (800). A viral link can drain the cap, and then picks fall back to replay or none. The per-IP limit (5/10 min) and the global cap still hold, and the verdict never needs the LLM. | Not exploitable beyond what the cap allows. | None required. Optionally prefer the recorded pick for default-clock org runs. |

Previous gate L1 (runtime `Triage` nodes piling up in the shared org graphs) is **fixed**: `PRUNE_TRIAGE` (`server/tools/cypher.ts:135`) caps runs and marks at 1000 each. As of this diff, `/api/stats` leaves them out of the counts.

## Diff review (ecf6210..HEAD): what passed

- **Memo bounding** (`server/tools/registry.ts:53-67`):
  - Only `explain_path` and `draft_remediation` are memoized.
  - The regex `/_acme_(qix|axios)$/` can never match a guest graph (`pz_guest_<12hex>_<short>`, `server/graph/client.ts:70`).
  - Keys over 512 characters run live.
  - The memo holds at most 2000 entries with FIFO eviction.
  - Rows are copied in and out.
  - No session-scoped data is memoized: `incident_exposure` and `recall_triage` are never cached, and remediation marks are applied after the cache.
  - Ask's model can churn entries (6 calls per ask, 10 asks per 10 min per IP). That costs performance only.
- **Session counts:** `NODE_COUNTS`/`EDGE_COUNTS` (`cypher.ts:74,76`) exclude `Triage`, `FOR` and `ASSESSED`. Live `/api/stats` shows no Triage label and no FOR/ASSESSED edges. `/api/stats` does the following:
  - validates the scenario with `Object.hasOwn` (`__proto__`, `constructor` and injection strings give 400);
  - is rate-limited (60/min) and cached per process;
  - sends `Cache-Control: no-store`;
  - returns only the graph name and counts.
- **Verdict tier counts** (`narrate.ts:46-49`, `:320-321`): this only adds the integer counts of still-open repos to the guard's number set. It has no security impact.
- **Share and deep links** (`web/src/data/urlState.ts`, `export.ts detailsLink`, `App.tsx`):
  - `scenario` and `open` are allowlisted.
  - `repo` and `guest` must match `^[A-Za-z0-9._-]{1,100}/[A-Za-z0-9._-]{1,100}$` and must not be dot paths.
  - These values are only compared against report rows, or turned into `https://github.com/<owner>/<name>` after a click. The server re-validates them with its stricter regex.
  - A dropped lockfile never produces a link, so its content never goes into a URL.
  - `detailsLink` re-parses its own output and returns null on a mismatch.
  - Hostile values were dropped live: `?scenario=__proto__`, `?guest=<img onerror>/x`, `?repo=../../etc` and `?open=javascript:alert(1)` gave no SharedPrompt, no img element and no `onerror` in the DOM. `?at=` is the exception, see L1.
- **Guest link never auto-fetches:** opening `/?scenario=qix-2025-09-08&at=…&guest=evil-owner/evil-repo&open=fix` sent only `/api/timeline` and `/api/exposure`. There was **no `/api/analyze`** and no GitHub request until the click. This matches the `SharedPrompt.tsx` design.
- **Paste sheet** (`PasteBox.tsx`, `Sheet.tsx`):
  - The client-side checks only explain problems. The server is authoritative.
  - The client `JSON.parse` result is only inspected, never merged, so there is no prototype pollution.
  - Files over 5 MB are never read.
  - The native `<dialog>` provides the focus trap and inert background.
  - Server errors render as text.
- **Graph stats** (`useStats.ts`, `GraphStatsSheet.tsx`): the request uses a validated scenario union, and the response renders as text.
- **Clipboard and export** (`export.ts`, `copy.ts`): `navigator.clipboard.writeText` gets plain text only. The download filename uses the server scenario id. Untrusted names go through `code()`/`fence()`, except the steps line (M1).
- **No HTML sinks** anywhere in `web/src`:
  - There is no `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `eval` or `javascript:`.
  - No `href`/`src` is user-controlled.
  - The force-graph tooltip is disabled (`PathGraphCanvas.tsx:519 nodeLabel={() => ''}`).
  - Inline `style` values are numeric or computed.

## S1 to S13 checklist (HEAD 1ef2e2b)

| Rule | Result | Evidence |
|---|---|---|
| S1 Validate all input | **FAIL** (M1, L1) | **Repo URL:** 17 payloads all gave 400 (`169.254.169.254`, `github.com@evil.com`, `:443`, `..`, `%2f`, `?`, `#`, `file://`, `%00`, `GITHUB.com`, `/tree/main`, `raw.githubusercontent.com`, `-a`, `.`, `..`). **Lockfile:** 5.2 MB gave 413; 6001 entries gave 413; 200k-deep nesting gave 400 (safe JSON catch); yarn and v1 gave 400; `__proto__`/`constructor.prototype` were stripped by the reviver and the server stayed healthy. **Other bodies:** alert over 500 gave 400; extra field `__proto__` gave 400; array body gave 400; `at:1.5` gave 400; `runId` path gave 400; 9 KB gave 413, also chunked. **Gaps:** lockfile names are not checked against npm naming rules and versions are not validated (M1); URL `at` is unbounded (L1). |
| S2 No SSRF | PASS | Only a validated owner/repo reaches `safeFetch` (https only, no port or userinfo, host allowlist, `redirect:'error'`, 20 s timeout). The guest path sends no token. No change in this diff. |
| S3 No Cypher injection | PASS | All tool queries are `cypher.ts` constants with `$params`. The new `NODE_COUNTS`/`EDGE_COUNTS` take no params. Elsewhere the only Cypher is `build.ts` constants and the static `schema.ts` INDEXES. `assertSafeParams` still enforces safe params. Graph names come only from the server hash. `/api/plan` uses the fixed `SAMPLE`. Injection strings as `scenario` gave 400. |
| S4 Prompt injection | **FAIL** (M1) | The LLM paths are still sound: `forPrompt` everywhere, a "data, not instructions" label, `session` stripped from model args, tools pinned to the run's graph, no write tools, and the pick limited to an id. **But** lockfile text now bypasses the LLM: it goes straight into the deterministic verdict and is auto-verified (M1). |
| S5 No XSS, CSP | PASS (export caveat in M1) | Zero HTML sinks (above). **CSP** `default-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'` is present on HTML, JSON, 404 and static responses. Built `index.html` has no inline script. The exported Markdown steps are unescaped (M1). |
| S6 Secrets | PASS | `.env` is gitignored and was never in history. `.env.example` has placeholders only (0 key-shaped values). `git grep` of tracked files for `gsk_`, `AIza`, `ghp_`, `github_pat_`, `xox`, `sk-`, `AKIA` and PEM: 0 hits. `git log --all -G` with the same patterns: 0 commits. The built `web/dist` grep for those patterns plus `devpass`, key env names and `Bearer`: 0 hits. The only client env is `VITE_MOCK`. `llm.ts` logs nothing. |
| S7 Abuse / DoS | PASS | Body limits verified live (413). Concurrency cap of 4 runs, one ingest, SSE 60 s, memo and stats bounded. `RATE_SCALE` is forced to 1 when `NODE_ENV=production` (`index.ts:137`), which the Dockerfile sets (`Dockerfile:29`) and `render.yaml` declares. The local 50x scaling is dev-only, as expected. FalkorDB timeouts and memory caps are in `start.sh`. |
| S8 Infra / headers | PASS (I1 dev-only) | **Headers:** `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options` plus `frame-ancestors 'none'`, COOP/CORP same-origin. **No CORS:** an evil `Origin` gets no ACAO, a preflight gets 404, and `text/plain` POSTs get 415. **Cache-Control:** `/api/*` is `no-store`; hashed `/assets/*` is `public, max-age=31536000, immutable`; HTML is `no-cache`; a missing asset gives 404 rather than the shell. Path traversal (`/../.env`, `/..%2fserver%2findex.ts`, `/fonts/../../../.env`) returns only the SPA shell. `/api/health` returns `{ok:true}`. **`pz_ro` ACL** (start.sh rules, run on the pinned `falkordb-server` image): `GRAPH.QUERY`, `DELETE`, `COPY`, `CONFIG`, `SET`, `FLUSHALL`, `EVAL`, `CLIENT KILL` and `ACL SETUSER` all gave NOPERM. RO_QUERY with CREATE, MERGE, SET, DELETE, index or write procedure was refused as read-only. The node count was unchanged. Container is `USER 10001`, FalkorDB loopback plus hashed requirepass. |
| S9 Supply chain | PASS | All deps are exact-pinned (5 runtime). Lockfile committed. Dockerfile uses `npm ci --ignore-scripts` and digest-pinned bases. No dependency changes in this diff. **`npm audit --omit=dev`: 0 vulnerabilities** (info 0, low 0, moderate 0, high 0, critical 0). **Dogfood** (offline, our `package-lock.json` against both incidents): 0 LOCKED, 0 admitting ranges, no bad package names present. |
| S10 Write endpoints | PASS | A second cookie jar and a forged cookie both got 404 on another session's guest graph, `runId` and remediation. Remediate requires the repo to appear in this session's own run. The cookie is `HttpOnly; SameSite=Strict` (Secure in production). |
| S11 Privacy | PASS | `deploy/dump.rdb` and `data/` contain no email addresses (the one regex hit is binary noise). Maintainers containing `@` are dropped at ingest (`build.ts:21`). The limiter is in memory only. |
| S12 Error handling | PASS | Every error is `{error, requestId}` with a server-generated id. Malformed `%`-encoding, unknown routes and bad bodies returned no stack. SSE errors are generic. Ingest logs details server-side only. |
| S13 MCP | PASS | `server/mcp.ts` is unchanged since `054087b`: stdio only, every tool `readOnlyHint`, `recall_triage` excluded, args filtered to declared props, reads via RO_QUERY, generic errors, no raw-Cypher tool. |

## npm audit

`npm audit --omit=dev`: **found 0 vulnerabilities** (JSON metadata: info 0, low 0, moderate 0, high 0, critical 0).

## Re-test after fixes

1. M1: paste each fixture through `/api/analyze`. The lockfile should be rejected, or its bad entries dropped. The Verdict, Do steps, Fix drawer and exported `.md` should contain no `[…](…)` text and no extra `Do:` row.
2. L1: `/?scenario=qix-2025-09-08&at=1e16` should render the landing page with `at` ignored or clamped.
