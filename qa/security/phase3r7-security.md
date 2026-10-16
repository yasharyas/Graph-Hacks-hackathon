# Phase 3 security gate, round 7: Patient Zero

Reviewer: Opus. The repo was read-only for this review, and this file is the only write.

**Scope.** Every change in `git diff 8bae6b8..HEAD` at HEAD `3ec287f` (74 files):

- **Server:**
  - the new read-only query `EXPOSURE_CARRIERS` (`cypher.ts:57`);
  - `filter_exposures`' new `version`, `via` and `carriers` parameters (`registry.ts:158-197`);
  - Ask routing in `ask.ts`: `known()` (`find_target` over the question), `entities()`, the `NV`/`SCOPED`/`VIA`/`ACCOUNT`/`PINS`/`DIRECT`/`CARRIER`/`VERSIONS`/`EXPLAIN` intents, `remediated` marks and the `used` cap;
  - `narrate.ts`: `carrierFacts`, `viaFacts`, `blastFacts`, `versionFacts`, `directFacts`, `compareFacts`, `teamFirstFacts` and `explainFacts`;
  - `triage.ts` `todayNotes`/`applyToday` (downgrade notes, the PR body);
  - `guest.ts` (`LockSource.now` from `html_url`, `today.versions`);
  - `guard.ts` `FIELD`;
  - `shared/clock.ts`, now the server's `clockOf`;
  - the alert-box 400 in `index.ts`;
  - the `incident` default in `mcp.ts`.
- **Build:** `web/src/design/fetch-fonts.mjs` (`FONTSHARE_API`, `FONTS_RETRY_MS`, retries, `process.exitCode`), and the Dockerfile (a comment-only change).
- **UI:** `NarrativePanel`, `agent.ts`, the App context, `AskBox` suggestions, and `ExposureTable`/`FixDrawer`/`export.ts`/`todayCheck.ts`.
- **Docs:** README (MCP transcript), `docs/submission.md`, `qa/reports/win-audit.md`, the blog, `video/script.md`, `web/index.html` og:image and `web/public/og-card.png`.

**Method:**

- `/security-review` still cannot run its git step (no `origin/HEAD`), so its method was followed by hand.
- Scripts in my scratch folder (`…/scratchpad/r7security/`) imported the repo's own modules.
- **Graph-backed probes** ran against a **throwaway FalkorDB container**:
  - the Dockerfile's pinned `falkordb-server` digest, with production's `TIMEOUT_*`, `RESULTSET_SIZE`, `QUERY_MEM_CAPACITY` and `THREAD_COUNT 1`;
  - published on `127.0.0.1:6391` only, with its own password and its own `pzr7` graph prefix;
  - the container has been removed.
- The real `build()`, `guests.prepare/analyze`, `triage()`, `ask()` (with stub models, no LLM) and `filterExposures` ran end to end against it.
- No second API was started and no running server was touched. `.env` was not read.

**Live API side effects** (`http://localhost:8080`, 6 requests in all): one `GET /api/health`, two `POST /api/triage` (one 400 for "alert and scenario", one alert-box 400), and three `POST /api/ask` validation probes with a fake runId (two 400s, one 404). No triage or Ask ran, no LLM was called and no guest graph was created. **H1 was deliberately not fired at the shared server**, because it would freeze it. `git status` is clean.

## Summary

**Verdict: FAIL against the 0 high / 0 medium bar. 1 high, 0 medium, 1 low, 3 info.**

**H1 is a new availability bug in the new carrier answer.**

- **Where:** `carrierFacts` rebuilds a `Set` of every carrier of a row once per distinct carrier, so the cost is quadratic.
- **How an attacker reaches it:** with an anonymous pasted lockfile. There are 5,400 entries that each declare 8 of the qix packages. The attacker then runs one triage and asks one Ask question ("Which one dependency should we upgrade?").
- **Measured cost on a desktop CPU:**
  - that Ask holds the Node event loop for **10.7 to 42.5 s**;
  - a timer due in 10 ms ran after 31.9 s;
  - 24 timer ticks fired in 42.5 s, where an idle loop would give about 2,100.
- **On production:** Render's 0.1 CPU should be roughly ten times slower. Every user and `/api/health` stall for minutes, and a per-IP budget of 10 Asks per 10 minutes repeats it.
- **The fix is one line:** build each row's set once. It brings the case to **26 ms** with identical output in 300 of 300 random cases (validated below).

L1 is the same query's unbounded output: up to 10.5 MB per Ask in one SSE event, with long carrier names.

Everything else the brief listed checked out clean:

- **Cypher injection:** `version` and `via` never reach Cypher.
- **Ask regexes:** none is a ReDoS risk on 500 characters.
- **Echo:** user text is not echoed into answers or the export.
- **Alert 400:** the alert-box 400 is fixed text.
- **MCP:** it stays read-only, with the `incident` default.
- **Fonts:** the font fetch enforces the pinned hash on every write path.
- **Secrets and docs:** no secrets or sensitive paths are in the diff or the docs.
- **npm audit:** 0 vulnerabilities.
- **Dogfood:** clean against both incidents.

## Findings

| ID | Sev | Rule | File:line | Description |
|---|---|---|---|---|
| H1 | **High** | S7 | `server/agent/narrate.ts:405-406` (`carrierFacts`), reached from `server/agent/ask.ts:274,305` | Quadratic carrier answer: event-loop freeze from one Ask on a pasted lockfile |
| L1 | Low | S7 | `server/tools/cypher.ts:59` (`collect(DISTINCT … p.name)` with no cap), `server/tools/registry.ts:169,190`, sent whole by `server/agent/ask.ts:263` | Unbounded carriers list: up to 10.5 MB `tool_result` per Ask |
| I1 | Info | S1 / S4 | `server/tools/registry.ts:16,163,185,188` | `version`/`via` are cut to 214 characters by `str()`, with no charset check, and echoed into the summary label |
| I2 | Info | S7 | `server/agent/ask.ts:319,325` | The `used` cap is check-then-increment: concurrent Asks on one run can pass 4 model answers |
| I3 | Info | S4 | `server/ingest/lockfile.ts:46` (carried from round 6 I1) | Words inside a single semver token of 64 characters or fewer now also reach the new downgrade note |

### H1 (High, S7): quadratic carrier answer freezes the server

**Code.**

```ts
// narrate.ts:405-406
const own = (x: CRow) => new Set(Object.values(x.via ?? {}).flat());
const [best, cleared = []] = top.map(([c]) => [c, rows.filter((x) => x.tier !== 'LOCKED' && own(x).size === 1 && own(x).has(c)).map((x) => x.repo)] as const)
```

- `top` has one entry per distinct carrier.
- For each one, `own(x)` flattens and hashes every carrier of every malicious version in the row.
- With C carriers and V versions, that is C × (C × V) set inserts. The function is synchronous: nothing yields.

**How it is reached.**

- `ask()` takes the carrier branch when `CARRIER` matches and no account is named (`ask.ts:274`). Examples: "which one dependency", "which upgrade", "carrier", "change one package".
- It runs `filter_exposures` with `carriers: true` on the run's own graph. That graph can be a guest graph built from a pasted lockfile.
- **Why C can be large:** carriers are the guest's own `Dep` names, one per lockfile entry that declares an admitting range.
  - `LIMITS` allows 6,000 entries and 50,000 edges.
  - So C is about 5,400 for V = 8, or about 2,700 for V = 18.
- **No other limit applies:**
  - Template answers do not count toward `used`.
  - The 60 s SSE limit cannot interrupt synchronous code.
  - `slot()` caps concurrency, not CPU.

**Repro.** Verified with the repo's modules and a throwaway FalkorDB (`e2e-carrier.ts`, `stall.ts`, `carrier-bench.ts`).

1. Build a `package-lock.json` (lockfileVersion 3, **1.34 MB**, 5,409 entries, about 48,600 edges):
   - `node_modules/` entries for `chalk` 5.6.0, `debug` 4.4.1, `ansi-styles` 6.2.1, `supports-color` 10.2.0, `strip-ansi` 7.1.0, `ansi-regex` 6.2.0, `wrap-ansi` 9.0.0 and `color-convert` 3.1.0;
   - `node_modules/c0` to `node_modules/c5399`, each `{"version":"1.0.0","dependencies":{"chalk":"^5.0.0","debug":"^4.0.0","ansi-styles":"^6.0.0","supports-color":"^10.0.0","strip-ansi":"^7.0.0","ansi-regex":"^6.0.0","wrap-ansi":"^9.0.0","color-convert":"^3.0.0","c<i+990>":"1.0.0"}}`;
   - the root depends on `c0` to `c989`.
2. `POST /api/analyze {"scenario":"qix-2025-09-08","lockfile":"<that file>"}`. Measured: `ready` in 5.2 s.
3. `POST /api/triage {"scenario":"qix-2025-09-08","guest":"<graph>","at":1757340000000}` returns a runId. Measured: 1.4 s. The repo is WOULD_PULL with 8 malicious versions.
4. `POST /api/ask {"runId":"…","question":"Which one dependency should we upgrade to remove the most?"}`. Measured:

   | Step | Result |
   |---|---|
   | `tool_result` | arrives at 0.8 s; carriers per version are `5400×8` |
   | The narration | arrives at **11.5 s** in one run and **42.5 s** in another |
   | Timer check, same process | 24 ticks of a 20 ms timer fired in 42.5 s |
   | Timer check, isolated `carrierFacts` | a timer due at +10 ms ran at **+31,917 ms** |

**Scaling** (`carrierFacts` alone, desktop CPU):

| Carriers × versions | Time |
|---|---|
| 500 × 8 | 57 ms |
| 1,000 × 8 | 221 ms |
| 2,000 × 8 | 986 ms |
| 2,700 × 18 | 4.45 s |
| 5,400 × 8 (short names) | 10.7 to 31.9 s |
| 6,000 × 8 (214-character names) | 34.4 s |

**Impact.**

- **Who is affected:** every visitor. The API, the SSE streams of other runs and `/api/health` all stop for the whole computation.
- **On production:** the Render free plan has 0.1 CPU and a 160 MB heap. The Docker `HEALTHCHECK` (10 s timeout every 30 s) and Render's `healthCheckPath` both fail, so the instance can be marked unhealthy or restarted. A restart drops every guest graph and stored run.
- **What it costs the attacker:** one IP, no GitHub and no LLM. It takes one analyze and one triage, then up to 10 Asks per 10 minutes, each an outage of tens of seconds to minutes.
- **Severity:** this is the same class as round 5's H1 (a quadratic regex on a pasted lockfile), which was rated High. CVSS 3.1 AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H = 7.5.

**Smallest fix** (one line, validated):

```ts
const own = (x: CRow) => new Set(Object.values(x.via ?? {}).flat());
const owns = new Map(rows.map((x) => [x, own(x)] as const));
const [best, cleared = []] = top.map(([c]) => [c, rows.filter((x) => x.tier !== 'LOCKED' && owns.get(x)!.size === 1 && owns.get(x)!.has(c)).map((x) => x.repo)] as const)
```

**Validated on a patched copy (`narrate-patched.ts`):**

- the 5,400 × 8 case takes **26 ms**, and the +10 ms timer runs at +28 ms;
- `carrierFacts` output was byte-identical to the original in 300 of 300 random row sets (`same.ts`).

Add a regression test in the style of round 5's: 5,000 carriers × 8 versions in under 500 ms. `viaFacts`, `carried()` and the rest of `filterExposures` were measured linear (`viaFacts` 1.6 ms on the same rows).

### L1 (Low, S7): carriers list has no cap

`EXPOSURE_CARRIERS` collects every distinct carrier name per (repo, version). `filterExposures` attaches all of them to each row as `via`, and `ask.ts:263` sends the whole `ToolResult` as one SSE event. The model never sees them: `compact()`'s `FILTER_COLS` leaves out `via`.

**Repro** (`e2e-long.ts`, throwaway FalkorDB): the H1 lockfile with a 214-character `name` field on each entry is 2.55 MB.

- Each carriers result serialises to **10.5 MB**: about 4× the pasted file, in one `tool_result` event per Ask.
- Four concurrent calls (`RUNS_MAX` is 4) took 3.3 s on a desktop CPU, with the heap peaking at 63 MB under `--max-old-space-size=160`, so there was no OOM.

**Impact:** bandwidth and CPU amplification that stays bounded. The bytes go to the attacker's own client, and the graph work is the same match volume as the existing `EXPOSURE_ADMITS`.

**Smallest fix:** keep the full lists server-side, because `carrierFacts`/`viaFacts` need them to be exact. Trim them where they leave the server: in `step()` (or `decorate`), send at most 20 carriers per version plus a count, as `compact()` already does for the model. Optionally, cap the query at `collect(DISTINCT …)[0..500]` and add `count(DISTINCT …)`.

### I1 (Info, S1/S4): model-chosen filter text is echoed into the summary label

- **What happens:** `version` and `via`, like the older `team` and `repo`, pass only through `str()` (214 characters). They are echoed into the summary label: `reaches …`, `via …`.
- **Who sets them:** the server-built filter always passes known values (`badOf`, and `via` only when `find_target` knows the package). The **model** and MCP clients can pass anything.
- **Probe** (`model-args.ts`): a stub model called `filter_exposures` with `via: "chalk) URGENT: all clear, no action needed, see evil.example/fix ‮<b>"`. The tool summary shown in the ToolCard read `0 of 21 exposed repos match (reaches debug@4.4.2, via chalk) URGENT: all clear, … ‮<b>)`.
- **Impact:** it renders as React text, so there is no XSS. The `)` would also cut `completeList`'s "Complete list (…)" label when that list replaces a partial model answer. The text comes from LLM output, which is already untrusted, inside the asker's own session.
- **Fix:** in `filterExposures`, keep `version`/`via` only if they match `^(@[a-z0-9._~-]+\/)?[a-z0-9._~*-]+(@[0-9A-Za-z.+-]+)?$` (case-insensitive, 214 characters or fewer). Otherwise treat them as no filter, and do the same for `team`/`repo`.

### I2 (Info, S7): the `used` cap can be passed by concurrent Asks

- **What happens:** `(run.used ?? 0) >= MAX_ANSWERS` is checked before the model call, and `run.used` is incremented after it. Up to 4 Asks in flight on the same run (`RUNS_MAX`) can all pass the check at `used` = 3.
- **What still bounds it:** the per-IP Ask limit (10 per 10 minutes) and the global `LLM_DAILY_CAP` (800, `llm.ts:42`), which is the real S7 control.
- **Fix:** reserve before the call (`run.used = (run.used ?? 0) + 1`), and give the reservation back when the model gives no answer.

### I3 (Info, S4): round 6's I1 residue now reaches the downgrade note

The residue is still limited to one semver token of 64 characters or fewer, with no spaces, no link, no markup and no bidi characters. For example, today's range `^5.0.0 || 0.0.0-Visit-evil-example-run-npx-cleaner` is now quoted in the new "which resolves 5.7.0 today … would downgrade it" note and in the PR body. In the same probe (`today.ts`), Markdown links, `<img>`, backticks, git URLs, `https://` URLs and `file:` paths were all removed before the note. **Optional fix:** drop range tokens and versions whose prerelease or build part is longer than 16 characters.

## Brief checklist: what was checked and found clean

**`EXPOSURE_CARRIERS` and `filter_exposures` (S3, S1, S7, S4/S5):**

- **S3:**
  - The query text is a `cypher.ts` constant.
  - Its only parameters are `incident` (`str`, from `incidentExposure`'s validated params) and `at` (a number from `time()`).
  - `version`, `via` and `carriers` are used only in JavaScript filters and never reach Cypher.
  - It runs through `g.ro` (`GRAPH.RO_QUERY`) and `assertSafeParams`.
  - `carry` uses computed keys from graph `bad.id` values, so no prototype setter is involved.
- **S1:** the gap is I1. Booleans accept only `true` or `'true'`.
- **S7:** see H1 and L1. On the org graphs the carriers stay small (`via @babel/core` answers 16 repos in 54 ms).
- **S4/S5:** a pasted repo's hostile names can reach this route as carriers. They are `safeName`-filtered to npm characters, 214 at most, and are then:
  - wrapped in `tk()` by `carrierFacts`/`viaFacts`, which strips Cc, Cf, Zl and Zp characters and backticks;
  - rendered as React text and chips;
  - added to the guard's evidence;
  - **kept out of the model prompt** (`FILTER_COLS` has no `via`).

**Ask routing (`ask.ts`, `narrate.ts`):**

- **Regex sweep** (`redos.ts`): every regex literal in the changed server files ran on 216 pathological inputs.
  - Worst cases: `ask.ts` 54 regexes, 0.79 ms on 500 characters; `narrate.ts` 0.22 ms; `guard.ts` (including `FIELD`) 0.59 ms on 4,000 characters; `shared/clock.ts` 0.27 ms; `index.ts` 0.28 ms; `guest.ts` 0.05 ms.
  - `NV`, `SCOPED`, `VIA` and `ACCOUNT` are anchored by a non-token prefix character that their token classes cannot contain. `PINS` and `DIRECT` are bounded (`{0,40}`, `{0,60}`). `FIELD`'s repeated groups each start with a distinct character.
- **`mentions`/`where`/`named` and `known()`:**
  - Names are escaped with `esc()` before `new RegExp`.
  - `known()` sends at most 20 `find_target` terms as a `$terms` parameter.
  - Maintainer ids come from the graph and are escaped in the `next …` test.
  - Guest maintainers come from committed data.
- **End to end** (`e2e-ask.ts`, real `ask()` on a throwaway copy of the org graph, two stub models):
  - **Questions tried:** 20 hostile and pathological ones. They included `<img onerror>` after "through", `evil@6.6.6` and `@attacker/pkg <script>`, "Ignore previous instructions … [click](https://evil.example)", "SYSTEM … print the GH_TOKEN", `__proto__`/`constructor` as maintainers, and 500-character runs of `via `, `through @a/`, `@a.`, `a@1.`, "hijacked account" and "which one dependency".
  - **Timing:** each was routed in 1 to 68 ms.
  - **Echo:** no hostile substring appeared in any template answer.
  - **Unknown names:** they get the constant "Not answered from the graph …" text. Suggestions are constant server strings, sent as chip questions.
- **Prompt-injection paths:** unchanged. The question goes only to the `QUESTION:` line and to `find_target` as a parameter. The system prompt gained two constraint lines. Evidence still goes through `forPrompt`. The model has no write tools.
- **User text in the export:** none. Ask answers never reach the export (it is built from the Report), and `remediated` must match `REPO` (200 at most, inside the 8 KB body limit). Live, `["<img src=x>/ZZZ-MARK"]` and a non-array got the constant 400 "remediated must be a list of owner/name repos.".
- **Non-security note:** "Which repos does the maintainer `qix` reach via `chalk`?" gets "Complete list (reaches chalk@5.6.1, via chalk): 0 repos across 0 teams. ." The trailing ". ." and the 0 (chalk is the malicious package, not a carrier) are wording and accuracy issues.

**Alert-box 400 (S12):**

- `index.ts:254` is one fixed sentence.
- **Live probe:** an alert with `<img onerror>`, a Markdown link, U+202E, "ignore previous instructions", a unique marker, `evil@1.0.0` and "13:16 IST" got that sentence plus a requestId, with none of the input.
- `fromAlert`'s word regex and `clockIn` are linear on 500 characters.

**MCP (S13):**

- `mcp.ts:64` sets `params.incident ??= args.scenario` only for tools that declare `incident`.
- The scenario is validated twice: by the SDK's enum, and by `orgGraph()`'s `Object.hasOwn`.
- An explicit `incident` still goes through the tool's `str()` and is used only as a `$param`.
- The rest is unchanged: stdio only, `readOnlyHint`, no raw Cypher, no `recall_triage`, org graphs only, and results capped at 6,000 characters by `fit()`. The carriers case is small there.

**`fetch-fonts.mjs` (S9):**

- **Can a build environment be steered?** `FONTSHARE_API` is read from the process environment only. The Dockerfile declares no `ARG` or `ENV` for it, so `docker build --build-arg` cannot set it, and neither can Render's git build. Steering it needs control of the build environment, which already means control of the build.
- **Is the hash still enforced?** Yes, on every write: all three outputs (`Satoshi-Variable.woff2`, `CabinetGrotesk-Variable.woff2`, `FFL.txt`) have a `PINNED` sha256, checked before `writeFile` (`:117`). Output paths are constants, so a zip entry name cannot pick the path.
- **Failure handling:**
  - A 4xx or a hash mismatch fails at once.
  - Retries cover only network errors and 5xx.
  - `process.exitCode = 1` still fails the `RUN` step.
  - The test suite's local server exercises 503, 404, a mismatch and a dead socket.
- **Pre-existing, optional hardening:** `unzip` inflates every entry with no `maxOutputLength`. Only a hostile host could exploit that, and the result is a failed build, not a tampered one.

**Dockerfile:** the only change is a comment. The digest pins, `npm ci --ignore-scripts`, the non-root uid 10001 and the `HEALTHCHECK` are unchanged.

**New UI code (S5):**

- **No HTML sinks:** none of `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `srcdoc`, `javascript:` or `text/html` clipboard writes appears in `web/src`.
- **Links:** every `href` is a constant fragment or `/`.
- **The new `style={{…}}`** values are numeric positions set through CSSOM.
- **`AskBox`:** suggestions render as button text, and `askPlaceholder` is an attribute.
- **`agent.ts`:** pure string functions over Report fields.
- **`openInsight`:** takes constant regexes.

**Export and `todayCheck` (S5, S7):**

- **The new export lines:**
  - `fixScopeNote(…, kind)`, `fixToday` and `NO_PIN` are constant text plus dates.
  - `readToday().advice`, including any unread server note, goes through `prose()`.
  - `unskipped` pins go through `code()`.
- **`todayNotes` with hostile ranges** (`today.ts`): Markdown links, `<img>`, backticks, git URLs, `https://` URLs and `file:` paths all came out with no `<`, `[`, backtick, `](` or `evil` in the notes, the advice or the lines. The one exception is the I3 token.
- **`todayCheck` regexes:** `SKIP_OVERRIDE`, `SKIP_PIN`, `MOVE_PIN` and `DOWNGRADE_PIN` took 0.7 to 1.5 ms on 100 KB adversarial notes.
- **`prose()`** still escapes `\ [ ] < >` outside code spans, and replaces every backtick when there is an odd number of them.
- **Unit tests:** 84 of 84 pass in `export`, `todayCheck`, `agent`, `narration`, `clock` and `alertNote`.
- **Client regexes, sweep notes:**
  - `spokenAnswer`'s `\s*\[E\d+…\]` (pre-existing, from `aecb9a17`, before `8bae6b8`) is quadratic on long whitespace runs: 3.3 ms at 2,400 characters. The model's `max_tokens` is 600, which keeps its input around that size.
  - `alertNote`'s word regex works on words of an alert of at most 500 characters: 0.17 ms.

**Other server changes:**

- **`guest.ts` `LockSource.now`:**
  - It is parsed by an anchored regex from the commit's `html_url`, which comes from `api.github.com` (same host only).
  - It is restricted to `owner/name` characters, so a repo can only name its own current location.
  - It is quoted in the verdict and added to the evidence.
- **`today.versions`:** comes from committed packuments.
- **`applyToday`:** its `String.replace` replacement text holds only incident package names and committed versions, so no `$` patterns can appear.
- **`/api/ask` `remediated`:** decorates the report in memory only, and nothing is written (S10 unchanged).

**README, docs and blog (S6):**

- **Secret scan:** 0 hits for `gsk_`, `AIza…`, `ghp_`, `github_pat_`, `xox*`, `sk-…`, `AKIA` and PEM keys in this diff, in `git log -p 8bae6b8..HEAD` and in the tracked tree. The one tree hit is the existing placeholder `AIza_test_SECRET_gemini_456` in `test/llm.test.ts`.
- **Local paths:** no Windows or user paths, `AppData`, `OneDrive` or emails in the added lines or in `qa/reports/win-audit.md`.
- **Dev password:**
  - `devpass` appears only in dev-container instructions (`-p 127.0.0.1:6380`) and in the MCP "checked with" notes.
  - `client.ts` refuses to start in production without `REDIS_PASSWORD`.
  - The compose default `pz-dev-redis` is unchanged.
- **The README MCP transcript:** public repo data plus Cypher. No hostnames beyond `localhost`, and the GitHub repo URL is public.
- **`og-card.png`:** only `IHDR`, `IDAT` and `IEND` chunks, with no text or EXIF metadata. The `og:image` path is same-origin.
- **The bundle:** `web/dist` was built at 12:41, after the last code change. It has 0 hits for secret patterns, env-var names, `devpass` or `Bearer`.

**Repo and supply chain (S9):**

- `package.json` and `package-lock.json` are unchanged since `8bae6b8`.
- `npm audit --omit=dev`: **found 0 vulnerabilities**.
- **Dogfood** (`dogfood.ts`): Patient Zero's own `package-lock.json` went through the real paste, `analyze()` and `triage()` path on the throwaway graph.

  | Incident | Clock | Result |
  |---|---|---|
  | qix-2025-09-08 | 14:00 UTC | `CLEAN: 1`, no exposures |
  | axios-2026-03-31 | 01:30 UTC | `CLEAN: 1`, no exposures |

  The oracle agrees: no malicious version id is present, and no incident package (`debug`, `chalk`, … `axios`, `plain-crypto-js`) is held at any lockfile path.

## S1 to S13 at HEAD 3ec287f

| Rule | Result | Evidence |
|---|---|---|
| S1 Validate all input | PASS (I1) | `remediated` is validated by `REPO`, 200 at most, and the body is 8 KB at most. `version`/`via` are length-capped but not charset-checked (I1). Lockfile and today-range validation are unchanged since round 6. |
| S2 No SSRF | PASS | No new outbound URL. `html_url` is parsed, never fetched. `safeFetch`/`outbound()` are unchanged. |
| S3 No Cypher injection | PASS | The one new query is a constant, with `$incident` and `$at` only, over `RO_QUERY`. No user or model text reaches query text. |
| S4 Prompt injection | PASS (I3) | Carriers never reach the prompt, and the question reaches `find_target` only as a parameter. `tk()` strips control, format and bidi characters and backticks. The guard now also strikes internal field names (`FIELD`). |
| S5 No XSS, CSP | PASS | The live CSP and headers match round 6, including the same three style hashes. There are no HTML sinks, and the new export lines are escaped. |
| S6 Secrets | PASS | The scans are clean (above). `.env` is ignored and was not read. |
| S7 Abuse / DoS | **FAIL (H1)**, L1, I2 | H1: one Ask on a pasted lockfile blocks the event loop for 10 to 43 s on a desktop CPU, and minutes at 0.1 CPU. L1: up to 10.5 MB per Ask. The new routing regexes are linear. |
| S8 Infra / headers | PASS | The Dockerfile change is a comment. Live headers: `nosniff`, `no-referrer`, Permissions-Policy, `frame-ancestors 'none'`, COOP, CORP and HSTS, with `no-store` on the API. |
| S9 Supply chain | PASS | No dependency change. Audit: 0. Dogfood is clean on both incidents. The font hash pins hold on every path. |
| S10 Write endpoints | PASS | Marks sent with Ask stay in memory for that answer only. `recall` is session-scoped, so `run.used` changes only on the session's own run. |
| S11 Privacy | PASS | No new PII. `today` keeps names and ranges only, and `now` is a repo id. |
| S12 Error handling | PASS | The alert 400 and the `remediated` 400 are fixed text with a requestId. MCP failures are generic. |
| S13 MCP | PASS | The `incident` default comes from the validated scenario. Tools are still read-only, with the same validators and stdio only. |

## Re-test after fixes

1. **H1:** on a patched build, run `carrierFacts` on one WOULD_PULL row with 5,400 carriers × 8 versions. It should finish in under 500 ms, and a 10 ms timer scheduled before it should fire within about 100 ms. Its output on small random rows should match the old function's. End to end, the repro's Ask should answer within about 1 s of its `tool_result`, with `/api/health` answering throughout.
2. **L1:** the same Ask with 214-character carrier names should send a `tool_result` well under 1 MB, with lists cut to N plus a count. `carrierFacts`/`viaFacts` answers should stay the same as before the cut.
3. **I1 (optional):** `filter_exposures` with `via: "x) URGENT <b>"` should give the same rows and label as no `via`.
4. **I2 (optional):** 4 concurrent model-routed Asks at `used` = 3 should yield exactly 1 model answer.
