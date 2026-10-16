# Phase 3 security gate, round 5: Patient Zero

Reviewer: Opus. The repo was read-only for this review, and this file is the only write. Scope:

- every change in `git diff f8b00f9..HEAD` at HEAD `922dd53` (lockfile `safeRange` token filter and protocol specs, `clockOf` alert clocks, Ask intents and `unanswered`, narration, `dropOrphans`, `noLockfile` text, per-statement Cypher copy and the `$session` placeholder, the Markdown summary, share-link handling, Toasts, ReportClock, NarrativePanel, `refName.ts`, `tableEmpty.ts`, `graphTone.ts`);
- a re-test of each round-4 finding;
- a full re-check of S1 to S13.

Method:

- `/security-review` still fails at its git step (`git log origin/HEAD...`: `origin/HEAD` does not exist). I followed its method by hand.
- Live probing used the production build and API at `http://localhost:8080` (real CSP, bundle built after HEAD) and the Vite dev server at `[::1]:5173`.
- Node scripts in my scratch folder imported the repo's own modules (`parseLockfile`, `checkLock`, `clockOf`, `reportToMarkdown`, `slackMessage`) for offline timing and rendering, and posted payloads through the app's own `/api/analyze`, `/api/triage` and `/api/remediate`.
- The browser pane loaded hostile share links and recorded network requests.
- A throwaway container of the pinned `falkordb-server` image (digest from the Dockerfile, no published ports) was used for the `pz_ro` ACL test. It has been removed.

No running server was restarted, stopped or reconfigured. Side effects: two guest graphs from the paste flow (`pasted/rlo2`, `pasted/s10probe`), which expire within 1 h; about eight triage runs; one deliberate 2.1 s event-loop stall of the local API (the H1 proof, sized small on purpose).

## Summary

**Verdict: FAIL against the 0 high / 0 medium bar. 1 high, 0 medium, 0 low, 2 info.**

Both round-4 findings are fixed. The exact L1 payloads now reduce to `^5.6.0` and `^4.4.0`, and no control, format or bidi character reaches the narration, the tool summaries, the report JSON, the Markdown export or the Slack text. The error-boundary link is `/` in source and in the served bundle.

The new range filter that closed L1 brought a regular expression with quadratic backtracking (H1). It runs on the whole range string before any length cap. One unauthenticated paste of a lockfile, about 5 MB, blocks the single Node event loop for hours, which takes the public demo down for every visitor. On the local API, a 60 KB version of the payload stalled `/api/health` for 2.1 s. The fix is two lines and is validated below.

## Findings

| ID | Sev | Rule | File:line | Description | Exploit scenario (verified) | Fix |
|---|---|---|---|---|---|---|
| H1 | High | S7 (S1) | `server/ingest/lockfile.ts:43` (`spec.replace(/([<>=~^]+)\s+/g, '$1')`), called per dependency at `:85`, before the size checks at `:92-93`. The cap `.slice(0, LIMITS.range)` comes only after the regex and the token loop (`:45`). | For each start position inside a run of `<>=~^` that is not followed by whitespace, `[<>=~^]+` takes the rest of the run, `\s+` fails, and the engine backtracks through the whole run. The cost is quadratic in the run length, and the run can be the entire range string (up to the 5 MB lockfile cap). The same uncapped input also feeds one `semver.validRange` call per token: a 4.9 MB range of distinct short tokens takes 3.2 s, which is linear but still a 3 s stall per request. `checkLock` runs synchronously on the request thread (`guest.ts:28`, through `prepare` at `index.ts:342`), so the whole API stops while it runs. | **Offline** (`checkLock`, a single range `'>'.repeat(n)+'1'`): n=40k took 0.97 s, 80k took 3.85 s and 160k took 15.6 s, so it is quadratic. `'^'.repeat(n)` behaves the same (0.87 s at 40k). At the 4.9 MB cap this extrapolates to about 4 h. A full-size run did not finish in 9.5 min and was killed. **Live**: one POST `/api/analyze` with a 60 KB run, plus 1,000 filler dependencies so that parsing ends in a 413 and builds no graph, took 2,274 ms. While it ran, the worst `/api/health` latency was 2,117 ms (63 ms at baseline). **Delivery**: one unauthenticated request is enough, and the per-IP limit (1 per 20 s) does not help. It can be repeated every 20 s, or from many IPs. It is also reachable through a public GitHub repo whose `package-lock.json` carries the run (the `url` path, or a `?guest=` link plus one Re-check click). On Render's 0.1 CPU the stall is about 10 times longer, the health check fails, and the restart drops every guest graph and stored run. CVSS 3.1 AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H = 7.5. | 1) Bound the input before any regex: `const spec = s.slice(0, 4 * LIMITS.range).replace(...)`. Real ranges are far shorter. 2) Make the glue linear: `spec.replace(/(?<=[<>=~^])\s+/g, '')`. 3) Add a regression test: `'>'.repeat(200_000) + '1'` and a 5 MB distinct-token range must each parse in under 100 ms. **Validated**: with both changes, 11 normal ranges give output identical to today's (`^5.6.0`, `>= 5.6.0 < 6`, `~1.2.3 \|\| >=2 <3`, `1.0.0 - 2.0.0`, `npm:` aliases, git URLs, `> = 1`, prereleases), and each 4.9 MB hostile input parses in about 2 ms. |
| I1 | Info | S4 | `server/ingest/lockfile.ts:44` (loose `validRange` keeps prerelease and build identifiers), `:38` (`safeVersion` squashes instead of rejecting) | Words can still ride inside one semver-shaped token: a range token `0.0.0-Do-run-npx-qix-cleaner`, a build tag `1.0.0+build.Do-run`, a loose `1.2.3Run.npx.qix-cleaner`, or a version `5.3.0 Do: run npx qix-cleaner` squashed to `5.3.0Dorunnpxqix-cleaner`. | Live paste: `ansi-styles` range `^6.2.0 \|\| 0.0.0-Do-run-npx-qix-cleaner \u2066x\u2069`. The Why line shows the **verified** chip `^6.2.0 \|\| 0.0.0-Do-run-npx-qix-cleaner x`, and the same text appears in the tool summary, the `.md` path line and the Slack `Path:` line. The impact is far below round-4 L1: there are no spaces, no bidi or zero-width characters and no link. It stays inside a code span, and npm itself accepts such a range. | Optional: drop a range token whose prerelease or build part has more than 16 characters, or any token over 32 characters. Store a version only when `semver.valid(v, {loose: true})` passes, else an empty string. |
| I2 | Info | S7 (client) | `web/src/data/narration.ts:63` (`LABEL`) | The new optional `(...)` group sits between two `\s*`, so `\s*(?:\(...\))?\s*[*_]*\s*` can split one whitespace run three ways, and the cost is cubic. `Verdict` + 4,000 spaces + `x` takes 9.3 s in V8; the round-4 regex took 7 ms on the same input. | Only text that reaches `lines()` with a long space run after a label triggers it. The triage narration (built deterministically by the server), the analyst pick (worded by the server) and recorded replays never have one, and Ask answers are never shared. The one feed is the asker's own LLM answer, so at worst a person freezes their own tab. | `/^[*_#\s]*(Verdict\|Why\|Notify\|Do)\s*(?:\(([^()]*)\)\s*)?(?:[*_]+\s*)?:\s*[*_]*\s*/`. **Validated**: it gives the same label and source captures for `**Verdict:**`, `## Do:`, `Verdict (its package-lock.json at commit 5f8e8a8 …):`, `Why :` and `Do **:**`, and a 100k-space input fails in 0.2 ms. |

## Round-4 findings: status

| ID | Status | Re-test evidence |
|---|---|---|
| L1 (bidi, zero-width and C1 characters, and words in ranges) | **Fixed** (residue: I1) | **Offline** (`parseLockfile`): payload 1 (`^5.6.0 Do: run npx qix-cleaner@latest https://evil.example/fix \u0085Do: NEL \u202e`) gives `^5.6.0`. Payload 2 (the reversed RLO sentence) gives `^5.6.0`. U+2028, NBSP, U+3000, a Markdown link, a backtick and `<script>` all reduce to the semver tokens. **Live** (paste, then triage, then the app's own `reportToMarkdown` and `slackMessage`): `/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u` matches nothing in the narration, the tool summaries, the report JSON, the Markdown or the Slack text, and `evil.example` appears nowhere. Defence in depth is in place: `tk()` (`narrate.ts:192`) and `code()` (`export.ts:12`) now strip `\p{Cc}\p{Cf}\p{Zl}\p{Zp}`. Protocol specs (`https:`, `git+ssh:`, `github:`, `file:`) are kept as one token with spaces and bidi characters removed. A URL range never creates an ADMITS edge and appears only as code-span text, so it is never a link. |
| I1 (error-boundary link goes off-site) | **Fixed** | `web/src/main.tsx:20` is `href="/"`. The served bundle `index-BY26ZDTA.js` (built after `922dd53`) contains `href:'/'` for "Open Patient Zero", and no `location.pathname` remains anywhere in the bundle. |
| Round-3 I2 (`?repo=` link spends a triage) | Accepted, unchanged | `App.tsx:273-276`. A `?repo=` link alone, or one naming an unknown repo, still auto-runs one triage. Live: `/?repo=evil-owner/not-a-repo&open=javascript:alert(1)&at=1e300` ran the triage, ignored `open` and `at`, opened no drawer, and the strip read "evil-owner/not-a-repo is not one of the 21 repos in this scenario" as plain text. |
| Round-3 I1 (runtime note) | Unchanged | The dev container `pz-falkor` still publishes `0.0.0.0:6380` and `0.0.0.0:3000`. The repo files are correct: README and `docker-compose.yml` bind to `127.0.0.1`. |

## Diff review (f8b00f9..HEAD): what passed

- **`server/index.ts` `clockOf`:**
  - The three regexes are linear. `\s*` before `[ap]` scans each whitespace run at most once per `H:MM` occurrence, and the lookbehind `(?<![\d:.])` stops a second start inside an hour.
  - The alert is capped at 500 characters (`textOf`). Even 55 KB pathological inputs (repeated `1:00` plus 50 spaces, 10,000 tabs, a 480-digit fraction) ran in under 5 ms.
  - No input crashes it: `9999-99-99`, `2025-02-30` and `0000-01-01` give `Date.parse` NaN or a far date, and then `undefined`. The hours `24:00`, `12:60` and `99:99` do not match.
  - A time can only land within 30 days of the snapshot (`2025-10-08T13:00Z` is accepted, `2025-10-09` is refused), the same bound as `atOf`.
  - `12:05 am` gives 00:05, `0:30 p.m.` gives 12:30, and `13:16 pm` stays 13:16.
  - The client mirror `clockIn` (`web/src/data/clock.ts`) is the same code, run on the person's own text.
- **`server/agent/ask.ts`:**
  - The new intents (`SAFE`, `EXCEPT`, `NEXT`, the extended `SUMMARY` and `WHEN`) are flat alternations run on 500 characters at most.
  - `unanswered` is a boolean, and its text is constant.
  - `concentrationFacts` quotes maintainers through `tk()`. Maintainers come only from the committed cache, which has no prototype-named keys (checked), so `ACCOUNT_NOTES[c.maintainer]` (`narrate.ts:306`) is safe today. Hardening: `Object.hasOwn(ACCOUNT_NOTES, m)`.
- **`server/agent/narrate.ts`, `registry.ts`:** wording only. New facts quote report fields through `tk()`, and the evidence set adds only numbers.
- **`server/ingest/guest.ts`:**
  - `dropOrphans(prefix())` deletes only names that start with `${prefix}_guest_` and are not in this process's LRU. The prefix must match `^pz[a-z0-9_]*$` (`index.ts:41`), so org (`pz_acme_*`) and registry (`pz_registry`) graphs never match. On Render each container has its own in-container Redis (`start.sh`), so no other process's guests are reachable.
  - Theoretical race: an ingest that starts in the first milliseconds after boot, between `list()` and its `guests.set`, could lose its graph. That needs a restart and affects only the requester's own graph.
  - `noLockfile` text: the owner and repo are validated, and the version list comes from committed incident fixtures.
- **`web/src/data/cypherParams.ts`:**
  - `PRIVATE.session` is a constant placeholder string, quoted by `literal()`.
  - The session id never reaches the client. Live: the `tool_start` params of a guest triage contain no `session`, and `recall_triage` returns `{incident}` only (`registry.ts:302`).
  - `cypherScript` adds only the tool enum, numbers and constant comment text, and each statement's prefix comes from the existing `paramPrefix` and `literal`.
- **`web/src/data/export.ts` (Markdown summary):** live test with every repo, team, channel, version, path id and range in a real org report replaced by a payload containing a backtick, `[click](https://evil.example/…)`, `<img onerror>`, a newline with `# `, U+2028, `**bold**`, U+202E, U+0085 and `|x|`:
  - 0 forged headings;
  - no link or HTML syntax outside code spans and fences;
  - no format or control characters anywhere.
  - `lockNote` text is constant except for the validated sha and a numeric date.
  - Note: the Slack opener `oneLine(e.team)` (`export.ts:257`) is not wrapped in a code span. It is reached only by org teams from the committed fixture, because guest messages are `anonymous`. Hardening: use `code()` or strip `<>|`.
- **`urlState.ts`, `App.tsx` share links:**
  - `?repo=` alone falls back to qix, and repo names are checked by `REPO` and the dot rules.
  - `SharedRepoNote` renders the repo name as React text.
  - `share()` builds the link through `shareUrl` and its validation.
  - The selectors that use data are constant strings.
  - **A guest link never fetches GitHub on load:** loading `/?scenario=qix-2025-09-08&at=1757338200000&guest=evil-owner/evil-repo&open=fix` sent only `/api/timeline` and `/api/exposure`, with no `/api/analyze`.
- **Components:**
  - **Toasts:** `[data-toast="${id}"]` uses a numeric counter.
  - **ReportClock:** messages are React text in an always-mounted status region.
  - **NarrativePanel:** `r.source` (the verdict's parenthetical) is React text, and whyParts and citeCount only regroup segments.
  - **ToolCard:** titles come from a fixed `TIER_SUBTITLE` map.
  - **PathGraph, PathGraphCanvas and graphTone:** CSS variable names come from a fixed tier map, and `realTeam` hides the placeholder team.
  - **`refName.ts`, `tableEmpty.ts`:** pure string and number logic. The filter uses `includes`, not a regex.
  - **No HTML sinks** in `web/src`: no `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `eval`, `new Function` or `javascript:`. Every `href` is a constant (`/`, `#results`, `#exposures`, `#tool-calls`, `#ask-question`) or the blob download.
- **Dev server:** listens on `[::1]:5173` only. Every `/@fs/…/.env` variant (`?raw`, `?import&raw??`), `/@fs/C:/Windows/win.ini` and `/src/../../.env?raw` return 403. `/.git/config` and `/../.env` return the HTML shell.

## S1 to S13 checklist (HEAD 922dd53)

| Rule | Result | Evidence |
|---|---|---|
| S1 Validate all input | PASS (see H1 for the cost of the new range filter) | **Repo URL, live, all 400:** `169.254.169.254`, `github.com@evil.com`, `:443`, `/..`, `%2f`, `file://`, `GITHUB.com`, `-a`, `/tree/main`, `?x=1` and a space. **Other bodies, live:** an extra field, scenario `constructor`, yarn text, `at:1.5`, alert plus scenario, a JSON array, a bad `runId` and a remediate repo containing `\n` all give 400. A forged or object `guest` gives 404, `text/plain` gives 415, and a 9 KB body gives 413. `/api/plan?tool=__proto__` gives 400, and `at=1e16` gives 400. **Lockfile text:** ranges now keep only semver tokens or one protocol token (I1 is the residue). Names and versions are charset-limited as before. **Share-link params:** validated (above). |
| S2 No SSRF | PASS | `security.ts` is unchanged (https only, no port, no userinfo, host allowlist, `redirect:'error'`, timeouts). `noLockfile` sends HEAD requests to URLs built from the validated owner and repo. The new `bad` list changes only message text. |
| S3 No Cypher injection | PASS | `cypher.ts`, `graph/`, `build.ts` and `admits.ts` are unchanged. Tool reads are `g.ro(Q.*, params)`, and ingest writes are literal strings with `$params`. Guest graph names are a server hash, and `dropOrphans` deletes only names returned by `GRAPH.LIST` with the guest prefix. In the copied Cypher, `literal()` is unchanged and `$session` is a constant placeholder. |
| S4 Prompt injection | PASS (I1 residue) | `forPrompt` and its allowlist, the "data, not instructions" label, `session` stripped from model arguments (`ask.ts:243`), no write tools and an id-only pick are all unchanged. The verdict stays deterministic. New facts go through `tk()` with the Unicode strip. |
| S5 No XSS, CSP | PASS | There are no HTML sinks. The live CSP on HTML, JSON, the API 404 and assets has `style-src` of exactly `'self'` plus the three hashes. I recomputed them from the built `PathGraphCanvas-VqejnGp4.js`: force-graph's CSS (427 characters) gives `jtRR…`, float-tooltip's (274 characters) gives `9xjt…`, and the empty string gives `47DEQ…`. There is no `unsafe-inline` or `unsafe-hashes`. Exports keep untrusted text in code spans and fences (verified with hostile strings). The boundary link is `/`. |
| S6 Secrets | PASS | The only tracked env file is `.env.example`, and `.env` is ignored (`.gitignore:3`). A pattern scan (`gsk_`, `AIza`, `ghp_`, `github_pat_`, `xox*`, `sk-`, `AKIA`, PEM) found 0 hits in tracked files, 0 in this diff and 0 in all history. `web/dist` (39 files) has 0 hits for those patterns plus `devpass`, the secret env names and `Bearer`. The only client env is `VITE_MOCK`. No value was printed. |
| S7 Abuse / DoS | **FAIL (H1)** | H1: quadratic backtracking in `safeRange`, and per-token semver work on uncapped input. Everything else passes: body limits (413 live), the run cap of 4, one ingest at a time, the 60 s SSE limit and the memo bounds are unchanged. `clockOf` and the Ask intents are linear on 500 characters at most. The client `LABEL` regex is cubic, but only on the asker's own text (I2). `RATE_SCALE` is forced to 1 in production (`index.ts:141`). |
| S8 Infra / headers | PASS | **Headers (live):** `nosniff`, `Referrer-Policy: no-referrer`, the Permissions-Policy, `frame-ancestors 'none'` with `X-Frame-Options`, COOP and CORP. **No CORS:** an `Origin: https://evil.example` gets no ACAO, and a preflight gets 404. **Cache-Control:** `/api/*` is `no-store` (including the 404), `/assets/*` is `public, max-age=31536000, immutable`, the HTML shell is `no-cache`, and a missing asset is a plain 404. Traversal (`/..%2f.env`, `/fonts/../../../.env`, `/%2e%2e/.env`, `/.git/config`, `/server/index.ts`) returns only the shell. **`pz_ro`** (start.sh rules, throwaway container): `GRAPH.QUERY`, `GRAPH.DELETE`, `GRAPH.COPY`, `SET`, `DEL`, `FLUSHALL`, `CONFIG SET`, `GRAPH.CONFIG SET`, `EVAL`, `ACL SETUSER`, `KEYS`, `SAVE`, `CLIENT KILL` and `MODULE LIST` all gave NOPERM. `RO_QUERY` with CREATE, SET, DELETE, MERGE, REMOVE, CREATE INDEX, a fulltext create procedure, UNWIND…CREATE and CALL {CREATE} was refused as read-only, and the node count stayed at 1. The container was removed. Dockerfile, `start.sh`, `render.yaml` and compose are unchanged, and compose binds to `127.0.0.1`. |
| S9 Supply chain | PASS | No dependency changes in this diff. `semver` is exact-pinned at 7.8.5 (after the 7.5.2 ReDoS fix; H1 is in our own regex, not in semver). The digest-pinned bases are unchanged. `npm audit --omit=dev`: 0 vulnerabilities. |
| S10 Write endpoints | PASS | Live: session A analysed `pz_guest_60ffa93d025d_qix`. A fresh cookie and a forged `pz_sid=aaaa…` both got 404 on it, and session A got 200. Remediating a repo the session never triaged gives 404. The cookie is `HttpOnly; SameSite=Strict` (Secure in production). |
| S11 Privacy | PASS | `data/` and `deploy/` are unchanged. The commit author and email are still discarded. No personal data is in the new messages. The limiter is in memory. |
| S12 Error handling | PASS | Every error is `{error, requestId}` with a server-generated id. A malformed `%`-escape on `/api/` gives a JSON 404. The H1 probe returned a clean JSON 413 with no stack. |
| S13 MCP | PASS | `server/mcp.ts` is unchanged: stdio only, read-only tools, no raw-Cypher tool. |

## npm audit

`npm audit --omit=dev`: **found 0 vulnerabilities**. Metadata: info 0, low 0, moderate 0, high 0, critical 0; 19 production dependencies, 192 in total.

## Re-test after fixes

1. H1: POST `/api/analyze` with a single range of `'>'.repeat(4_900_000) + '1'` (and the same with `'^'`, and with 4.9 MB of distinct tokens). Each should answer in well under a second while `/api/health` stays responsive. The 11 normal ranges listed in H1 should give unchanged output.
2. I2 (optional): `lines('Verdict' + ' '.repeat(4000) + 'x', null)` should return in under 10 ms.
3. I1 (optional): a range `^6.2.0 || 0.0.0-Do-run-npx-qix-cleaner` should show `^6.2.0` (or keep the token only if the length rule allows it).
