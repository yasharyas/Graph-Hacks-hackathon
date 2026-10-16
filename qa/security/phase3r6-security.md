# Phase 3 security gate, round 6: Patient Zero

Reviewer: Opus. The repo was read-only for this review, and this file is the only write. Scope:

- every change in `git diff 922dd53..HEAD` at HEAD `b9c3459`: `lockfile.ts` (`safeName`, `safeVersion` through `semver.valid`, `safeRange` slicing before any regex), `security.ts` (`outbound()`, `safeFetch` with `sameHost`), `guest.ts` (`GH_TOKEN` on the commits API, `fetchToday`, `Entry.source` and `today`), `triage.ts` `todayNotes`, `narrate.ts` and `ask.ts` (`priorityFacts`, the `PRIORITY` and "riskiest after X" intents, several named repos, `Object.hasOwn`), `index.ts`, `export.ts`, `alertNote.ts`, `cypherWrap.ts` with its `<wbr>`, `todayCheck.ts`, `pasteError.ts`, `repoFit.ts`, `App.tsx` share-link handling, and the og: and twitter: meta in `web/index.html`;
- a re-test of each round-5 finding;
- a full re-check of S1 to S13.

Method:

- `/security-review` still fails at its git step (`git log origin/HEAD...`: `origin/HEAD` does not exist). I followed its method by hand.
- Live probing used the production build and API at `http://localhost:8080` (bundle `index-DfNy29-3.js`, built at 09:28, after HEAD at 09:23) and the Vite dev server at `[::1]:5173`.
- Node scripts in my scratch folder imported the repo's own modules: `checkLock`, `todayNotes`, `graphAnswer`, `priorityFacts`, `reportToMarkdown`, `todayCheck`, `lines`, `cypherPieces`, `clockRead`, `alertNotes`, `splitMessage` and `safeFetch`. I also ran `analyze()` up to its fetch stage with `fetch` stubbed and a fake `GH_TOKEN` marker. No real token was read and no request left the machine.
- The browser pane loaded hostile share links and recorded network requests.
- I ran the `pz_ro` ACL test in a throwaway container of the pinned `falkordb-server` image (digest from the Dockerfile, no published ports). The container has been removed.

No running server was restarted, stopped or reconfigured, and `.env` was not read.

Side effects:

- One pasted-lockfile analysis (`pz_guest_17f4897078f8_qix`, which expires within 1 h).
- Two triage runs: one hostile alert, and the S10 session A run.
- Two `/api/analyze` requests that ended in 413 (the H1 re-test).
- One transient file, `body.tmp`, written to the repo root and deleted in the same command during the Vite probe. `git status` is clean.

## Summary

**Verdict: PASS against the 0 high / 0 medium bar. 0 high, 0 medium, 1 low, 2 info.**

All three round-5 findings are closed or reduced:

- **H1 is fixed.** Every hostile range now parses in 12 to 21 ms offline, with 4.9 MB inputs. Live, a 4.82 MB paste was answered with a JSON 413 in 63 ms, and `/api/health` stayed at 19 to 20 ms (70 ms at baseline).
- **I2 is fixed.** The label regex takes 0.2 to 0.7 ms on 100,000 spaces.
- **I1 is partly mitigated.** Versions with spaces are now rejected, and range tokens are capped at 64 characters.

The new same-host redirect in `safeFetch` cannot leave the host or the https scheme, and cannot loop. `GH_TOKEN` is sent only to `api.github.com`.

The one new issue (L1) is in the new "checked against today's package.json" feature. A range from a repo's current `package.json` is quoted with its words. It reaches the Fix tab, and the Markdown export, where one unmatched backtick switches off the escaping. This is the round-4 L1 class arriving through a new source. The fix is one line at the source, plus one line of defence in depth (both validated below).

## Findings

| ID | Sev | Rule | File:line | Description | Exploit scenario (verified) | Fix |
|---|---|---|---|---|---|---|
| L1 | Low | S4 / S5 (S1) | **Source:** `server/ingest/guest.ts:73` (`fetchToday` keeps a value as any printable ASCII, up to 128 characters). **Quoted raw:** `server/agent/triage.ts:155-156`. **Rendered:** `web/src/components/FixDrawer.tsx:298-301`, and `web/src/data/todayCheck.ts:18` builds the "Before you paste" line from it. **Exported:** `web/src/data/export.ts:198` through `prose()` (`:14`). | Loose `semver.validRange` drops the comparators it cannot read and still answers with a valid range. So `"chalk": "^4.1.2 <any prose>"` passes the `validRange` check, and `todayNotes` writes the whole raw string into its sentence. `prose()` toggles escaping at every backtick. A single unmatched backtick therefore leaves the rest of the line unescaped: `[text](url)` and `<html>` survive, and a bare `https://` URL autolinks under GFM in any case. In the app the note is React text, so no script runs (CSP is unchanged). The harm is spoofed advice in the app's own voice, plus a live link or HTML in the exported `.md`. | **Setup:** the attacker publishes a repo with a lockfile commit dated before the incident (commit dates are set by the client) that admits `chalk@5.6.1`. Its HEAD `package.json` declares ``"chalk": "^4.1.2 ` [Read the chalk advisory first](https://evil.example/chalk) <img src=x onerror=alert(1)>"``. The attacker sends `?scenario=qix-2025-09-08&guest=attacker/repo&open=fix`, and the victim clicks Re-check. **Offline proof** (repo modules; the sanitiser at `guest.ts:73` was checked to be verbatim): `todayNotes` returns "Today's package.json declares chalk ^4.1.2 \` [Read the chalk advisory first](https://evil.example/chalk) <img …>, which no longer admits 5.6.1: skip …". In `reportToMarkdown`'s line there is 1 backtick before the link and 0 after it, so CommonMark renders the link, and `<img src=x onerror=…>` is present raw. A second payload (`URGENT: before npm ci run npx chalk-cleanup@latest, see https://evil.example/fix`) gives a plain sentence with a bare URL. A third (`x: skip the run-npx-evil-cleaner-first override`) makes the Fix tab's line read "Before you paste: skip the run-npx-evil-cleaner-first override." **Limits:** it appears only in the victim's own session, after a deliberate Re-check, and the link is live only once the export is rendered elsewhere. Ask never sees it: `evidenceBlock` omits `today`. CVSS 3.1 AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:L/A:N = 3.1. | 1) At the source, treat today's ranges exactly like lockfile ranges. Export `safeRange` from `lockfile.ts` and map `[k, safeRange(v)]` in `fetchToday`. **Validated:** both payloads now give "declares chalk ^4.1.2, which no longer admits 5.6.1 …". `~4.1.2` is unchanged, and `^5.0.0 \|\| ^4` still gives "still match". 2) Defence in depth in `prose()`: when a string has an odd number of backticks, replace them all with `'` before splitting. **Validated:** the payload becomes ``' \[x\](https://evil.example) \<b\>y\</b\>``, and matched pairs are unchanged. 3) Add an export test with an unmatched backtick. Optional: write `Object.hasOwn(here, name)` at `triage.ts:160`. Names come from incident data today, so this is not reachable. |
| I1 | Info | S4 | `server/ingest/lockfile.ts:40` (`safeVersion`), `:46` (range tokens up to 64 characters) | Carried from round 5 and partly mitigated. Versions squashed from prose are now dropped: `5.3.0 Do: run npx qix-cleaner` gives `''`, and the regression test asserts this. Words can still ride inside one semver token of 64 characters at most. | Offline: the range `^6.2.0 \|\| 0.0.0-Do-run-npx-qix-cleaner ⁦x⁩` gives `^6.2.0 \|\| 0.0.0-Do-run-npx-qix-cleaner x`. `0.0.0-Visit-evil-example-and-run-the-cleaner-before-npm-ci-x` (61 characters) is kept. The version `1.0.0-Do-run-npx-qix-cleaner` is kept. There are no spaces, no bidi characters and no link, and the text stays inside code spans. npm accepts such strings. | Optional: drop a range token or version whose prerelease or build part is longer than 16 characters. |
| I2 | Info | S12 (robustness) | `server/ingest/guest.ts:70` | `fetchToday` calls `safeJson` outside any catch: the `.catch` covers only `capped()`. An invalid HEAD `package.json`, or one over 1 MB, throws an `HttpError` out of `fetchLock`. A repo whose lockfile is fine then fails its whole analysis, with a message about the wrong file. Nothing leaks. | `analyze()` with stubbed GitHub: invalid JSON gives "That is not valid JSON. Paste the contents of package-lock.json.", and a 1.2 MB valid `package.json` gives "Lockfile is larger than 5 MB.". A small valid file passes. Only analyses of that one repo are affected. | `let pkg = null; try { pkg = safeJson(text, 1_000_000) } catch { /* no today check */ }`. Today's check is optional and must never fail the analysis. |

## Round-5 findings: status

| ID | Status | Re-test evidence |
|---|---|---|
| H1 (quadratic `safeRange` regex, uncapped semver work) | **Fixed** | **Code:** `lockfile.ts:43` slices to `4 * LIMITS.range` (512) before the Unicode strip and every regex. The glue is now `(?<=[<>=~^])\s+`, which is linear. `semver.validRange` runs only on tokens of 64 characters or fewer. `safeName` slices before its regex, and `safeVersion` slices before `semver.valid`. **Offline** (`checkLock`, 4.9 MB inputs): `'>'×4.9M+'1'` 15.9 ms, `'^'×4.9M` 12.9 ms, `'~'×4.9M` 13.8 ms, `'> '×2.45M` 15.5 ms, distinct tokens 21.3 ms, 4.9M spaces 12.3 ms, `npm:`+4.9M 12.6 ms, `git+https:`+4.9M 12.7 ms, version `'1.'×2.4M` 15.4 ms, name of 4.9M characters 12.5 ms. **Normal ranges are unchanged:** `^5.6.0`, `>=5.6.0 <6`, `~1.2.3 \|\| >=2 <3`, `1.0.0 - 2.0.0`, `npm:@scope/pkg@^1.2.3`→`^1.2.3`, the git URL, `> = 1`→`>=1`, prereleases, `latest`, `*`, `file:`, `github:`. **Live:** one POST `/api/analyze` with a 4.82 MB `'>'` run, plus 1,001 filler dependencies so the parse ends in `parseLockfile`'s own cap (the message is `TOO_BIG`, not the body limiter's), got a 413 in 63 ms, with `/api/health` at worst 19 ms. 4.72 MB of distinct tokens got a 413 in 63 ms, with health at worst 20 ms. A regression test was added (`test/security.test.ts`). |
| I1 (words inside one semver token) | **Partly mitigated** (Info above) | Squashed versions are rejected. The residue is limited to single tokens of 64 characters or fewer. |
| I2 (`LABEL` regex, cubic) | **Fixed** | `narration.ts:63` no longer has two adjacent `\s*` runs. `lines()` timings: `'Verdict'+' '×100k` 0.6 ms, `'Verdict ('+' '×100k` 0.2 ms, `'Verdict '+'* '×50k` 0.7 ms, `' #'×50k` 0.2 ms. The captures are the same as in round 5 for `**Verdict:**`, `## Do:`, `Verdict (its package-lock.json at commit 5f8e8a8 …):`, `Why :` and `Do **:**`. A regression test was added (`narration.test.ts`). |
| Round-5 hardening notes | One done, one unchanged | `Object.hasOwn(ACCOUNT_NOTES, …)` is in place (`narrate.ts:319`). Prototype-named maintainers (`__proto__`, `constructor`, `toString`) now render with no note. The Slack opener `oneLine(e.team)` (`export.ts:275`) is still not code-wrapped. It is reached only by org teams from the committed fixture (guests are `anonymous`). |
| Round-3 I2 (`?repo=` link spends a triage) | Accepted, unchanged | A hostile `?repo=<img …>` is rejected by `REPO`, so no triage runs (live, below). |
| Round-3 I1 (runtime note) | Unchanged, dev only | The long-lived dev container `pz-falkor` still publishes `0.0.0.0:6380` and `0.0.0.0:3000` (documented in the README). `docker-compose.yml` publishes `127.0.0.1` only and never the database port. |

## Diff review (922dd53..HEAD): what passed

- **`server/security.ts` `safeFetch({sameHost})`**, tested with a stubbed `fetch` against 17 `Location` values:
  - **Refused:**
    - another host;
    - `http://api.github.com` and a `:444` port;
    - userinfo, and the `api.github.com@evil.example` trick;
    - a protocol-relative `//evil.example`;
    - the other allowlisted host `raw.githubusercontent.com` (cross-host refused);
    - a trailing dot;
    - `%0a` host splitting;
    - a Cyrillic `а` (punycode `xn--pi-6kc…`);
    - `javascript:`, `data:` and `file:`;
    - malformed URLs.
  - **Followed:** a relative path, an upper-case host and `\@` (normalised to the path of `api.github.com`), each exactly once.
  - **No loops:** the follow-up always uses `redirect:'error'`, so a second 3xx is never followed.
  - A 3xx with no `Location` is returned as is.
  - The default mode is still `redirect:'error'`.
- **`server/ingest/guest.ts` token handling** (`analyze()` with stubbed GitHub and a fake marker token):
  - **Same-host redirect:** AUTH goes to the commits API (manual), then AUTH to `/repositories/42/commits` (`error`). After that, `noauth` goes to `raw…/<sha>/package-lock.json` and `noauth` to `raw…/HEAD/package.json` (both `error`).
  - **Commits redirected to `raw.githubusercontent.com`:** refused, so the run falls back to HEAD with no token.
  - **403:** fallback to HEAD with no token, and `reason:'unavailable'`.
  - `fetchToday` runs only for a snapshot.
  - Keys must match npm's name rule and be 214 characters or fewer. `__proto__` and `constructor` are dropped by `safeJson`'s reviver, and `Object.fromEntries` creates own properties.
  - At most 2,000 entries are kept. The body is streamed and capped at 5 MB, and JSON is parsed only up to 1 MB.
  - The token is never logged: `get()` turns every failure into an `HttpError(502)`. On exhaustion (5,000 an hour, or 180 an hour per IP at the analyze limit) the run degrades to "unavailable" and the HEAD lockfile. At runtime, nothing else uses the token.
- **`todayNotes` and `Entry.today`:**
  - They belong to the guest entry, so only sessions that analysed that graph can reach them (S10, below).
  - Names come only from override keys and direct-dependency pins, which are incident packages from committed data.
  - `semver` runs on 128 characters at most.
  - The text problem is L1.
- **`server/agent/ask.ts` and `narrate.ts`:**
  - `PRIORITY`, `EXCEPT`, the "riskiest after" test and the count regex are flat alternations. On 14 pathological 500-character questions (digit runs, `fix `×125, `prioriti`+`z`×492, `riskiest after `×33, `/`×500 and others), `graphAnswer` took 0.01 to 0.2 ms each.
  - `named()` builds one escaped `RegExp` per repo (`esc`, linear).
  - `COUNT[n]` is indexed only by digits or the listed words, and the result is clamped to 1 to 10.
  - Prototype words in a question are harmless.
  - `priorityFacts` quotes repos through `tk()`.
  - `unanswered` is now always `true` in template mode, and is a boolean.
  - Non-security wording nit: `priorityFacts` says "every exposed repo is marked remediated" when "riskiest after" names every repo (`narrate.ts:283`).
- **`server/index.ts`:** the only change passes `today`. `clockOf` is unchanged since `922dd53`, and its client mirror `clockRead` takes 0.24 to 0.38 ms on 500-character hostile inputs.
- **`web/src/data/export.ts`:**
  - Repo, team, channel, version and path strings still go through `code()`: `repoLabel(e.repo)`, `repoShort` on chain roots, `code(n.team)`, `code(n.channel)`, and `fence(n.text)`.
  - `fixTodayNote` and the new summary or "Scenario clock" lines are constant text plus numbers and dates.
  - The one new hole is `f.today` through `prose()` (L1).
- **`cypherWrap.ts`, `ToolCard.tsx` `Wrapped`:**
  - The pieces render as React text with `<wbr />` elements between them. This is not an HTML sink.
  - Copy uses the original strings (`copyText(runnable(...))`), never the DOM.
  - `cypherPieces(s).join('')` was identical for 20,000 random strings and an 80 KB adversarial one (2.6 ms).
- **`alertNote.ts`:** it shows only `read.raw` (the regex-matched time) and incident names from the server, as React text. A live hostile alert (`<img onerror>`, a Markdown link, U+202E, "ignore previous instructions") ran at 13:16 as asked. Its words appear only as `$terms` parameters of the resolve query, which is parameterised Cypher.
- **`todayCheck.ts`, `pasteError.ts`, `repoFit.ts`, `repoLabel.ts` `repoParts`:**
  - These are pure string logic.
  - All regexes are anchored or linear: a 64 KB note took 0.48 ms, and 100 KB `splitMessage` inputs 0.4 ms.
  - `details` and `lead` render as React text inside `<details>`.
- **`urlState.ts` (unchanged) and `App.tsx`:**
  - `?at` must be a safe integer within 30 days.
  - `shared` (validated by `REPO`) is used only as React text in `scopeNote`.
  - `/api/scenarios` is same-origin.
  - The new `data-tips-off` attribute is a constant.
  - **Live:** `/?scenario=qix-2025-09-08&at=1757338200000&guest=evil-owner/evil-repo&open=fix` sent only `/api/timeline` and `/api/exposure`, with no `/api/analyze` after 3 s more. `/?scenario=__proto__&repo=<img src=x onerror=alert(1)>&guest=../..&open=javascript:alert(1)&at=1e300` gave no triage, no open dialog, no `[onerror]` element and no `<img` text, and its only links are `#results` and `#exposures`.
- **`web/index.html`:** the og: and twitter: meta are static text, with no `og:image` and no `og:url`. The built `index.html` has no external URL (only the SVG namespace inside the data-URI icon), no inline script, no `<style>` and no `style=`.
- **No HTML sinks in `web/src`:** no `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `srcdoc` or `javascript:`. Every `href` is a constant fragment, `/` or the blob download. The two template selectors use numbers (a toast id and `trace.row: number`). The new `style={{transform}}` is set through CSSOM, which CSP allows.
- **Unit tests:** 74 of 74 pass in `export`, `todayCheck`, `cypherWrap`, `narration`, `alertNote` and `pasteError`.

## S1 to S13 checklist (HEAD b9c3459)

| Rule | Result | Evidence |
|---|---|---|
| S1 Validate all input | PASS (L1 is the one gap, in fetched data) | **Lockfile:** inputs are capped before any regex (H1 re-test). Names keep npm's name characters, versions must pass `semver.valid`, and ranges keep semver tokens or one protocol token. **Live 400s:** scenario `constructor` and `__proto__`, a JSON array, broken JSON, and `at=1e16` / `at=-1`. A forged object as `guest` gives 404, and `text/plain` gives 415. **Share-link params:** validated (above). **`package.json` from GitHub:** names are validated, but ranges are not reduced to semver tokens (L1). |
| S2 No SSRF | PASS | `outbound()` enforces plain https, no port, no userinfo and the host allowlist, both on the first URL and on any redirect target. The redirect must also be to the same host, and only one is followed (17 cases above). All URLs are built from the validated owner and repo, so no user-supplied URL is ever fetched. |
| S3 No Cypher injection | PASS | No changes to `cypher.ts`, `graph/`, `build.ts` or `admits.ts`. Every call site is `g.ro(Q.*, params)` or `write(name, constant, params)`. `schema.ts` labels come from a constant list. The hostile alert reached FalkorDB only as `$terms`. `LOAD CSV` (which tried to open `file:///etc/passwd` under `pz_ro` in the throwaway container) cannot be reached, because no query text is user-controlled. |
| S4 Prompt injection | PASS (L1 is display only, I1 residue) | `forPrompt`, the "data, not instructions" label, the session stripped from model arguments, no write tools and the deterministic verdict are all unchanged. `Remediation.today` is never placed in a prompt: `evidenceBlock` has no `today`. |
| S5 No XSS, CSP | PASS (L1: export Markdown injection, low) | The live CSP on HTML, JSON, the API 404, assets, fonts and the asset 404 has `style-src` of exactly `'self'` plus three hashes. I recomputed them from the template literals in `PathGraphCanvas-tE7W1rJh.js`: force-graph's CSS (427 characters) gives `jtRR…`, float-tooltip's (274 characters) gives `9xjt…`, and the empty string gives `47DEQ…`. No `unsafe-inline`. No CSP errors in the console after a share-link triage with the drawer open. No HTML sinks. The export escapes everything except an unmatched backtick in server prose (L1). |
| S6 Secrets | PASS | The only tracked env file is `.env.example`, and `.env` is ignored (`.gitignore:3`). A pattern scan (`gsk_`, `AIza`, `ghp_`, `github_pat_`, `xox*`, `sk-`, `AKIA`, PEM) found 0 hits in tracked files, 0 in this diff and 0 in all history. `web/dist` (39 files) has 0 hits for those patterns plus `devpass`, the secret env names and `Bearer `. The only client env is `VITE_MOCK`. `GH_TOKEN` goes only to `api.github.com` and is never logged. No value was printed. |
| S7 Abuse / DoS | PASS | H1 is fixed (live 63 ms, health 19 ms). The new work per analyze is bounded: one raw fetch (20 s timeout, 5 MB stream, 1 MB parse, 2,000 entries), `todayNotes` over 20 versions at most, and `semver` on 128 characters at most. Ask intents take 0.2 ms or less on 500 characters. Client regexes (`LABEL`, `JOINT`, `todayCheck`, `splitMessage`, `clockRead`) are linear. Body limits, the run cap, one ingest at a time and the 60 s SSE limit are unchanged. `RATE_SCALE` is forced to 1 in production (`index.ts:141`). |
| S8 Infra / headers | PASS | **Headers (live):** `nosniff`, `Referrer-Policy: no-referrer`, the Permissions-Policy, `frame-ancestors 'none'` with `X-Frame-Options`, COOP, CORP and HSTS. **No CORS:** an `Origin: https://evil.example` gets no ACAO, and a preflight gets 404. **Cache-Control:** `/api/*` is `no-store` (including the 404), `/assets/*` is `public, max-age=31536000, immutable`, the HTML shell is `no-cache`, and a missing asset is a plain 404. **`pz_ro`** (start.sh rule set, throwaway container): `GRAPH.QUERY`, `GRAPH.DELETE`, `GRAPH.COPY`, `GRAPH.CONSTRAINT`, `GRAPH.MEMORY`, `GRAPH.CONFIG SET`, `SET`, `DEL`, `KEYS`, `FLUSHALL`, `CONFIG SET`, `EVAL`, `ACL SETUSER`, `SAVE`, `CLIENT KILL`, `MODULE LIST` and `SHUTDOWN` all gave NOPERM. `RO_QUERY` with CREATE, SET, DELETE, MERGE, REMOVE, CREATE INDEX, a fulltext create, UNWIND…CREATE and CALL {CREATE} was refused as read-only, and the node count stayed at 1. The container was removed. Dockerfile, `start.sh`, `render.yaml` and compose are unchanged, and compose binds to loopback. **Dev server:** `[::1]:5173` only; `/@fs/…/.env` (and its `?raw` and `?import&raw??` variants), `/@fs/C:/Windows/win.ini` and the as-is `/src/../../.env?raw` give 403, and other paths give the HTML shell. |
| S9 Supply chain | PASS | No dependency changes in this diff. `semver` is exact-pinned at 7.8.5. The digest-pinned bases are unchanged. `npm audit --omit=dev`: 0 vulnerabilities. |
| S10 Write endpoints | PASS | **Live:** session A analysed `pz_guest_17f4897078f8_qix`. A fresh cookie got 404 on it, a forged `pz_sid=aaaa…` got 404, and session A got 200 with a report. The cookie is `HttpOnly; SameSite=Strict`, plus `Secure` when `NODE_ENV=production` (`index.ts:91`). `today` lives on the same session-scoped entry. |
| S11 Privacy | PASS | `data/` and `deploy/` are unchanged. `fetchToday` keeps only dependency names and ranges (no author, no email). The commit author is still discarded. The limiter is in memory. |
| S12 Error handling | PASS (I2: wrong-file message) | Every error is `{error, requestId}`. Live: `/api/nope`, a malformed `%`-escape, a bad scenario, a bad body, a bad content type and a bad `at` each return one generic sentence and an id. There are no stacks. Upstream bodies are never echoed. I2 is an accuracy problem, not a leak. |
| S13 MCP | PASS | `server/mcp.ts` is unchanged: stdio only, read-only tools, no raw-Cypher tool. |

## npm audit

`npm audit --omit=dev`: **found 0 vulnerabilities**. Metadata: info 0, low 0, moderate 0, high 0, critical 0; 19 production dependencies, 192 in total.

## Re-test after fixes

1. **L1:** feed `todayNotes` a `today.deps.chalk` of ``^4.1.2 ` [x](https://evil.example) <img src=x onerror=alert(1)>`` through `fetchToday`'s mapping (stubbed `fetch`, as in this review). The note should read "declares chalk ^4.1.2, which …". Then `reportToMarkdown` should contain no `](https://` and no `<img`. Separately, `prose('a ` [x](u) <b>')` should escape `[`, `]`, `<` and `>`.
2. **I2:** a stubbed HEAD `package.json` of `{"dependencies": {` and one of 1.2 MB should each let the analysis reach `ready` with no `today` (no error event).
3. **I1 (optional):** `0.0.0-Do-run-npx-qix-cleaner` as a range or a version should be dropped if the length rule is adopted.
