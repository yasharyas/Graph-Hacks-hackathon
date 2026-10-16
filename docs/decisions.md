# Decisions

Short records of arena picks and other non-obvious choices. Newest first.

## Security gate after Phase 1 — 2026-10-15

Opus reviewer, read-only, against rules S1–S13: **fail** (3 high, 3 medium) → fixed and re-verified in the real container.
- **H S3** the falkordb client inlines params as Cypher text and escapes strings but not map keys → `assertSafeParams` in `client.ts` (identifier keys, plain leaves only) on every read and write; lockfile names/versions stringified; `recordTriage` rebuilds rows from allowlisted fields. Container check: the reviewer's payload is rejected ("bad key").
- **H S7** lockfile bomb (deep key × 20k deps = 73 s event-loop block) → `LIMITS` in `lockfile.ts` (6k entries, 40 segments, 1k deps/entry, 50k edges, 128-char ranges), rejected in < 500 ms.
- **H S7 (latent)** unbounded guest fetch → handed to the API route: stream with a 5 MB cap, no disk cache, no GH_TOKEN, ≤ 60 s.
- **M S10** `recall_triage` exposed `session` to the LLM → removed from the schema; the dispatcher injects the cookie session.
- **M S7** limiter `clear()` reset everyone; per-IP keys let IPv6 rotate → least-recent eviction at 50k keys, `clientKey()` groups IPv6 by /64.
- **M S8** writes ran as `default` with a `devpass` fallback → `FALKOR_ACL=1` (exported by start.sh) makes reads `pz_ro` and writes `pz_rw`; the fallback is dev-only; start.sh strips `REDIS_PASSWORD`/`REDISCLI_AUTH` from Node's env (verified via /proc).
- **Lows fixed:** pz_ro `+CLIENT` narrowed to `+client|setinfo +client|setname` (the client hangs without `+INFO`, so it stays); safeFetch requires plain https; app code root-owned (runtime uid can't write it); Fontshare downloads pinned by sha256; quadratic username regex replaced; guard event now carries `claims` so the UI can't mark an unchecked span verified.

## Phase 0 gate — spikes S1–S4, 2026-10-15

- **S1 FalkorDB 4.22.1** (`falkordb/falkordb@sha256:b0bdcac…`): `shortestPath` is only allowed in `WITH`/`RETURN` (`WITH shortestPath((root)-[:REQUIRES*0..]->(x)) AS p`); `*0..` handles direct deps natively, so no special case. `allShortestPaths` only in `MATCH`; `algo.SPpaths({…pathCount:3})` gives k-shortest. `CALL algo.pageRank(...) YIELD node, score SET node.pagerank = score` works. Params, list slicing, `metadata` execution time, `GRAPH.EXPLAIN`, `GRAPH.CONSTRAINT` (async, returns PENDING) all work. 20k nodes + 20k edges via UNWIND batches of 400: 435 ms; graph 7 MB; `GRAPH.COPY` 251 ms; 60-hop shortestPath 5.5 ms internal.
- **S8 verified:** ACL user `pz_ro` (`+GRAPH.RO_QUERY +GRAPH.EXPLAIN +GRAPH.LIST +PING +HELLO +CLIENT +INFO`) reads; `GRAPH.QUERY`/`GRAPH.DELETE` get NOPERM; `RO_QUERY` rejects writes.
- **S3 single container** (`falkordb/falkordb-server@sha256:2e99eb1…`, Debian trixie, glibc 2.41 + Node from `node:24-trixie-slim`): the base image's ENTRYPOINT (`run.sh`) silently ignores our CMD and starts an open Redis — **override ENTRYPOINT**. No `useradd` in the image: run as numeric `USER 10001:10001`. Under `--memory=512m --cpus=0.1`: 6 graphs × 40k nodes = 165 MB total (Redis 146 MB, Node 91 MB RSS); seeding at boot took 23 s, so bake the RDB. Image 127 MB.
- **S4 LLMs:** Groq `qwen/qwen3.8-27b` (narration 0.44 s, tool call 0.29 s), `openai/gpt-oss-120b` (needs `max_tokens` ≥ ~600 or reasoning eats the output), Gemini `gemini-3.5-flash-lite` (1.5 s / 1.2 s) — all return correct tool calls through `chat()`. A Flash-Lite narration said mocha was "currently using" the bad version, which the guard can't catch (verbs aren't entities): the system prompt now forbids "uses/installed/compromised" for WOULD_PULL.
- **Local dev:** a native Windows Redis owns host port 6379, so dev FalkorDB maps **6380**.
- **Fonts:** Fontshare ITF FFL forbids redistribution via a public repo → Satoshi/Cabinet Grotesk are git-ignored and fetched at build (`npm run fonts`); Martian Mono (OFL) is committed.
- **Gate:** 58 tests green, `tsc` clean, secret scan clean, history rebuilt to 4 commits as `yasharyas`. All Phase 0 exit criteria met; no fallback needed.

## Narrative guard (`server/agent/guard.ts`) — arena, 2026-10-15

- **Runners:** A (Opus, 43 lines), B (Sonnet, 53), C (Fable, 39). All 7/7, all linear on 100 KB adversarial input.
- **Cross-judge (Haiku):** B 18, A 13, C 13. **Base: B** — the only one reading "1,234 packages" as 1234 (A and C claimed a wrong "234 packages"); named anchored classifiers (NPM, REPO, PROSE) are the easiest to explain; `stop()` keeps sentence punctuation out of spans. My read agreed.
- **Grafted:** A's backtick discipline (no space just inside the ticks, so "Use \` carefully and \`npm\`" claims `npm`, not prose); cite lists `[E1, E2]` (none had it); `^`/`~` in name@range tokens (`debug@^4.3.5`); file paths and tool pairs (`lib/index.js`, `npm/yarn`, `dev/prod`) are not repo claims unless already a known entity.
- **Rejected:** A's single dense alternation regex (correct, hard to explain); C's trailing-hyphen spans; a dictionary for prose (stoplist is the ponytail ceiling, documented in code).
- **Known limits:** unknown repos with a file-like extension (`vercel/next.js`) are not claimed; "twenty-one repos" is not parsed; hypotheticals ("e.g. 3 repos") are still checked. The narration prompt asks for backticked entities, which sidesteps most of this.
- **Verification:** 8 guard tests, adversarial 100 KB worst case 21 ms (budget 50 ms).

## ADMITS window + safe version (`server/ingest/admits.ts`) — arena, 2026-10-15

- **Runners:** A (Opus, 31 lines), B (Sonnet, 34), C (Fable, 31). All 7/7 and all converged on a single pass (earliest later version that satisfies the range and outranks the bad one) instead of re-running `maxSatisfying` at every publish time.
- **Cross-judge (Haiku):** totals tied 13/13/13; correctness decided. **Base: A** — loose parsing like npm, fail-closed malicious-duplicate handling in `safeVersion`, null on degenerate times. My read agreed.
- **Grafted (judge-found bugs):** a null `removedAt` (DB NULL for a still-live release) made A return null — hiding live exposure; now `removedAt ?? Infinity`. A non-string spec (undeclared package) threw; now null. Both are regression tests, plus the duplicate-malicious pin case where B and C would have recommended pinning the malicious version.
- **Known limit (tell the judges):** `latest` is modelled as "highest stable", not as a moving dist-tag; a later lower backport can move npm's `latest` and end a window earlier in reality. No dist-tag history exists to model it.
- **Verification:** 8 tests.

## Lockfile parser (`server/ingest/lockfile.ts`) — arena, 2026-10-15

- **Runners:** A (Opus), B (Sonnet), C (Fable), each in its own worktree. Rubric: `test/lockfile.test.ts` (9 tests incl. two real lockfiles), `npm ls` oracle, robustness on hostile input, simplicity.
- **Convergence:** all three passed 9/9 and scored the same against `npm ls` (mocha 0.9953, npm-cli 0.9915; misses are `*-cjs` npm aliases plus packages `npm ls` reports as extraneous because the oracle's temp dir has no workspace `package.json` files). Strong agreement on shape: walk up the lockfile keys, follow links, BFS for depth.
- **Base: A.** Mirrors npm arborist's dependency-type precedence (peer → prod → optional → dev, later wins), uses a `Map` (no prototype-key lookups), skips non-object entries, and has the clearest BFS.
- **Grafted from B:** workspaces exist only when the root declares `workspaces` (A and C flagged mocha's `file:` dependency as a workspace); workspace entries take their real name from the `node_modules` link that points at them (npm omits `name` there, so A/C named `workspaces/arborist` "arborist" instead of `@npmcli/arborist`). Dev deps still install for every folder outside `node_modules` (root, workspaces, `file:` targets).
- **Rejected:** B's Map-iterator-as-queue BFS (correct but clever), B's per-group edge emission (duplicate edges when a name is listed under two types), C's plain-object lookups (`packages[resolved]` can hit prototype members on hostile input), C's `devOptional → dev` mapping (kept A's literal `dev` flag; revisit if dev badges look wrong).
- **Cross-judge (Haiku, read-only):** A 4/4/4/4, B 2/2/3/4, C 3/3/4/4 (correctness/security/simplicity/perf). Agreed on base A and on both B grafts; added C's header comment. It hand-traced bugs the suite missed: B crashes on a `null` entry or a numeric spec and duplicates prod+optional edges; C makes a phantom edge for a link resolving to `constructor` and mangles `npm:@s/x`. All are now regression tests that the merged parser passes.
- **Known ceiling:** resolution rebuilds key strings per ancestor (O(depth × key length)); fine at 5 ms for 1.1 MB, cache per folder if hostile nesting ever matters.
- **Verification after merge:** 11 parser tests + 7 security tests pass, `tsc --noEmit` clean, oracle unchanged (0.9953 / 0.9915).

## QA fix round (Phase 3 persona scores below 9) — 2026-10-15

- **Narration split:** the persona QA found wrong "verified" answers and truncated narratives, so the LLM no longer writes the verdict. `text` (Verdict / Why / Notify / Do) is built from the report; the LLM writes at most a 40-word `note`, which is dropped unless every claim passes the guard. Without any LLM, triage is still complete.
- **Count-to-version pairing (superseded below):** the entity guard passed "20 other repositories would fetch it" and "nine repos would fetch `axios@1.14.1`" (uptime-kuma fetches 0.30.4), and the prompt rule against this was ignored. `acceptNote` now drops a clause that ties a repo count to a version (or "it") unless that many exposed repos reach it. Both replay notes were re-recorded and reviewed under the rule.
- **LOCKED timing:** a lockfile cannot pin a version before it is published, so LOCKED counts from the repo's newest locked bad publish. This removed the axios 128-vs-105 split; `firstExposureAt` gives one minutes-ahead figure everywhere (qix 74, axios 105, floored).
- **Narration at the clock:** before removal, the window reads "still open at 13:30 UTC", never "until 15:15". The narration never uses knowledge from after the scenario clock.
- **Ask list questions:** `filter_exposures` runs server-side first, and an LLM answer naming fewer matches than it found without saying "N of M" is replaced by the complete list (prod-only at qix 13:30: 14 repos across 6 teams).
- **Analyst pick replaces the free-text note:** live runs kept finding new ways to be subtly wrong after each check. Examples: "the sole malicious version", `chalk@5.6.1` paired with another package's range, and "all 20 would fetch it". The server now builds 3–6 observations from the report (`locked`, `spread`, `carrier`, `own`, `prod`, `many`, `scanner`, `watch`), and the LLM answers with one id. The note is as true as the verdict, the LLM still makes the judgement call, and replays record the id rather than prose. The regex pairing checks were deleted with the free text.
- **Free-tier speed (0.1 CPU, 512 MB, measured in `docker run --cpus=0.1 --memory=512m`):** a qix triage took 22 s, almost all of it the 21 `explain_path` and 21 `draft_remediation` calls. Two changes:
  - `EXPLAIN_PATH` now reads the repo's lockfile entries through the `Dep.repo` index (`GRAPH.EXPLAIN`: `Node By Index Scan | (x:Dep)`), keeps those whose `RESOLVES_TO` or live `ADMITS` edge reaches the version, and walks `shortestPath` only for the 3 shallowest, since `Dep.depth` equals the hop count. Rows are identical on all 21 repos, and it is about 28% faster.
  - Both tools are memoized per process on the read-only demo org graphs, warmed at boot for each scenario's default clock. Warm triage takes 2.3 s, with the first tool result at about 0.2 s.
  - Cached cards say "cached" next to the query time; guest graphs never cache. A run at a scrubbed clock still queries live (about 20 s on the free tier, about 3 s on a laptop).
- **Ask answers what the graph knows itself (QA round 2):** the AppSec persona got "npm ci is not safe for the other 20 repos" three times out of three, and "what should acme/checkout-web do?" left out rotating secrets. Both answers were marked verified because every name in them checked out. Keyword intents now route these questions to answers built from the report: list or filter, a named repo, rotate or npm ci, notify, and when. They come with server-chosen tool calls (the filter, or the repo's `explain_path` and `draft_remediation`), and the model is never asked. Open questions still go to the model's tool loop.
- **Guest lockfiles:** GitHub answers the commits API for some repos (for example `facebook/react`) with a 301 to `/repositories/<id>`, which `safeFetch` refuses on purpose (S2). The history lookup now falls back to today's lockfile, labelled `@HEAD`, rather than reporting "GitHub did not answer". A repo without `package-lock.json` is checked for `yarn.lock` or `pnpm-lock.yaml` (HEAD requests only), and the error says how to generate one.
- **Fix snippets for direct dependencies:** a version-qualified override of a direct dependency fails alone with `EOVERRIDE` (verified with npm 11 by two personas). `Remediation.direct` now carries the root pin npm needs alongside it, and the PR body names it.

## QA round 3 fixes — 2026-10-16

- **Lockfile text is sanitized at ingest (security M1):** a public repo's lockfile could put its own words into the verdict and fix steps: a working Markdown link in the export, or extra "Do" lines on screen, and the guard counted them as verified because they were in the evidence. The parser now keeps names to npm's name characters and versions to semver's, and strips line breaks and Markdown link or code syntax from ranges. Narration tokens drop control characters and backticks, and the Markdown export escapes link and HTML syntax in fix steps. `test/security.test.ts` feeds a hostile lockfile.
- **Share links carry a bounded clock (security L1):** `?at=` is accepted only within 30 days of the incident, the server's own rule. Out of range, it threw in date formatting and blanked the page. An error boundary now catches any render error, so the page is never blank.
- **The removal time is named (supersedes "Narration at the clock"):** personas read "still open at 13:30 UTC" as a live incident. The verdict now says "still live at 13:30 UTC; npm removed them around 15:15 UTC". This is a replay of a past event, so stating the removal is history, not foresight. The fix steps still never name it.
- **Which lockfile was judged (pasted repos):** `Report.scope.source` records the last lockfile commit before the incident (sha and commit date), today's lockfile (`head`, a counterfactual), or a pasted file (a counterfactual, since its date is unknown). The verdict says which, so a "was safe" reflects the repo's real state at the time, or is labelled as a counterfactual.
- **Dev versus prod root pins:** `Remediation.devDirect` holds pins for packages the root declares in `devDependencies`. The fix snippet writes each pin in its own block, and the team notices include the root pins, because otherwise npm fails with EOVERRIDE.
- **More questions answered from the graph:** the security persona got a model answer of "21 repos across 6 teams" (it is 7), "dev-only can execute code on install", and an action plan that dropped rotating secrets. Each carried a green "N of N verified", because every name and number checked out on its own. New graph answers:
  - "how bad / what do I tell my CISO": the verdict headline plus the team count
  - "can I ignore dev-only": no, because devDependencies install by default
  - "what first": the verdict's own Notify and Do lines
  - "which team has the most work": open exposures by team

  The notify intent no longer catches "tell" or "team", and questions about customers or regulators go to the model. The model's prompt now states the npm ci and rotate rules.
- **CSP for the graph library:** `force-graph` and `float-tooltip` inject a fixed `<style>` each, appended empty and then filled. The CSP allows exactly those two hashes plus the empty one, not `'unsafe-inline'`. A test recomputes the hashes from `node_modules`, so a dependency bump that changes them fails.

## QA rounds 4 and 5 — 2026-10-16

- **As of the clock, with hindsight labelled (supersedes the round-3 "removal time is named"):** the AppSec persona role-plays being on call at 13:16, and the verdict told it things nobody knew then: the 15:15 removal, the 14:26 advisory, and "nothing to change today". The maintainer persona, asking today whether they were exposed, needs exactly those facts. So the verdict, the notices and the Slack text now speak as of the scenario clock ("still open at 13:30 UTC"). Anything later appears only in a sentence that starts "In hindsight:", or in the Fix tab's "Today, in hindsight" note. A pasted repo's verdict gives the whole window, because its question is about the past.
- **What an override really pins:** npm applies a version-qualified override (`"debug@4.4.2": "4.4.1"`) to every dependent whose range admits the bad version. That pins `debug` at 4.4.1 even where today's resolve would give 4.4.3. The steps, the PR body and the Fix tab now say so. They call the override an in-window measure, and say that after removal no override is needed.
- **The fix, read against today's package.json:** for a pasted GitHub repo judged on a pre-incident snapshot, the server also reads today's `package.json` (raw, no API quota). It notes each override that today's declared range no longer needs (it would hold the package back, e.g. uptime-kuma's `~0.33.0`), and each pin for a package no longer declared. It checks direct dependencies only.
- **Rotate first:** a LOCKED repo's rotate-secrets and rebuild steps come first, in the verdict's Do line and in the repo's own steps.
- **Whole-second minutes:** the lead time is computed on whole seconds, the precision every timestamp on screen shows. That makes axios 106 minutes (00:21:58 to 02:07:58; 105.997 to the millisecond). qix stays at 74.
- **Guest GitHub lookups:** the commits lookup uses the server's read-only token, as the plan intended; anonymous is 60 requests an hour per IP, and that is shared on a hosting provider. It follows one same-host redirect, so renamed repos keep their history. When the history API is unavailable, the counterfactual says so instead of claiming no history exists. Raw files are fetched without the token. A test pins the token to `api.github.com`.
- **Ask from the graph, more of it:**
  - "am I affected", "who could be compromised next" (PageRank concentration), "if I can only fix three" (by urgency: LOCKED, then production repos that declare the range themselves, then production through a dependency, then dev-only) and "riskiest after X" now get graph answers.
  - Several named repos are all answered.
  - Routing no longer matches "removed", "riskiest" or a bare "safe" next to a named repo.
  - With no model, the answer is labelled "Not answered".
- **Alert clocks:** "1:16 PM", "13:16UTC" and ISO instants are read, and a time 30 days or more from the incident is ignored.
- **S7, the range sanitizer (security round 5 H1):** the round-4 range filter ran a backtracking regex on the uncapped range: 160 KB took 15 s, and 5 MB would take hours. Every lockfile string is now cut to a few times its cap before any regex or semver call, the regexes are linear, and a test feeds 2 MB hostile ranges. A version that is not semver is dropped, not squashed.

## QA round 6 — 2026-10-16

- **One alert-clock parser:** `shared/clock.ts` reads IST, EST/EDT, CST, PST/PDT, CET/CEST, BST, JST, GMT, UTC, `Z` and `±hh:mm`, for the server and the web alike. The banner says how it read the time ("Read “6:46 PM IST” as 13:16 UTC").
- **As of the clock, everywhere:** "when" answers label later facts as hindsight. Team notices carry the clock and the window ("as of 13:16 UTC on 2025-09-08"). The Fix tab leads with the scenario clock, and "Today, in hindsight" is a separate paragraph.
- **Step order:** for a LOCKED repo: rotate, then fix the lockfile, then rebuild. This holds in the verdict, the steps, the Notice and the copied steps.
- **Ask:**
  - Only model-written answers count toward the cap of four. Graph answers and refusals are free.
  - A refusal offers three questions the graph answers, as chips.
  - New graph routes: "pin the bad version" (the LOCKED count), "declare it directly" (the direct repos), "most urgent for <team>" (that team's first step).
  - Up to five named repos are answered.
  - Compare questions lead with a verdict line.
  - The guard flags camelCase and snake_case field names in model prose.
- **Today's package.json, downgrades:** an override, or an exact pin, below what today's declared range resolves would move the package backwards. The note says so, and the PR body and the copied steps carry it. The Fix tab parses the server's exact sentence, and a test feeds it `todayNotes` output, because the first parser matched an invented wording.
- **S4, today's ranges:** ranges read from today's `package.json` get the lockfile's semver-token filter, so no Markdown or HTML reaches the Fix tab or the export. A broken or huge `package.json` skips the today check, not the analysis. The export also escapes Markdown when a line has an odd number of backticks, which would otherwise flip what counts as code.
- **UI:**
  - Why and `[E1]` stay visible at 1280x720.
  - The Notify roster is one row per team, and the copied notice ends with the run link.
  - Copy toasts replace each other.
  - History is in UTC.
  - A share card (`og-card.png`).
  - On a phone, the table pane is `overflow-x: clip` so the filter row sticks. This is CSS, not an effect.
- **Guest lookups need `GH_TOKEN` in production:** anonymous GitHub is 60 requests an hour per IP, and a hosting provider shares the IP.

## Judge win audit and QA round 7 — 2026-10-16

- **Win audit (`qa/reports/win-audit.md`):** an arena of three judge-persona auditors (Opus, Sonnet, Fable) with a Sonnet cross-judge, base Opus. It found the entry strong but not complete (no video, no live URL), the agent invisible after triage, and Ask answering a different question under a green badge.
- **Ask answers the question asked, or says why not:** named maintainers go to their blast radius. The head noun of "which/what <noun>" picks one answer:
  - library, package or dependency: carriers, through the new read-only `EXPOSURE_CARRIERS`
  - maintainer or account: PageRank reach
  - team: teams
  - version: versions

  "Explain in plain words" gets the graph summary with a tier glossary. Stop words are never read as package names. A question whose named entity the graph route would not use is refused with `reason: 'off-topic'`, as distinct from `no-model` and `cap`. Coverage only adds the complete list to questions that ask for repos; it never replaces a model's answer.
- **The carrier pick says "shortest paths":** "4 repos' shortest paths … run through `@babel/core`". Counting every path, 16 repos reach debug@4.4.2 through it, and Ask now lists those, so the two numbers no longer read as a contradiction.
- **The agent on the first screen:** the analyst pick, "Notify 7 teams" and "Next qix?" (PageRank) lines show after triage with no click. The Ask placeholder is a graph-answered agent question.
- **S7, the carrier answer (security round 7 H1):** it was quadratic in carriers, so one hostile pasted lockfile froze the event loop for 11–43 s. It is now one pass. The tool result sends at most 20 carriers per version. Model-chosen `version`/`via` filters must be package refs. The four-answer cap is reserved before the model call.
- **Smaller fixes:**
  - MCP `incident` defaults to `scenario` and is rejected when they differ.
  - An unknown alert is a 200 with an SSE error, so a handled case logs no console error.
  - The font fetch retries network and 5xx failures 3 times; a hash mismatch still fails.
- **Docs:** the README has a 60-second judge tour, "What the agent does", a real MCP transcript and the setup above the Cypher. The claims the app contradicted are corrected (the EXPLAIN_PATH plan starts at the Dep index), the AI-use disclosure is complete, and `docs/submission.md` is new.

## Video script arena — 2026-10-16

- **The brief:**
  - ElevenLabs voice-over with at least two voices
  - pixel art and p5.brush, each in specific parts only
  - the curve: animation, then explanation, then the real UI, with cut-the-curve seams
  - hard cap 2:30
- **Candidates:**
  - C1 "Resolution" (Opus): pixel, then brush, then UI. A third "graph" voice reads only on-screen strings.
  - C2 "The Record and the Moment" (Sonnet): one time axis through all three looks, with a Ledger voice and an On-call voice.
  - C3 "One red thing, three resolutions" (Fable): the malicious version as a pixel tile, then a pen dot, then the UI node.
- **Scores (Sonnet cross-judge):** C2 86.8, C3 77.0, C1 75.5. My own scoring agreed on the order (about 84 / 78 / 76.5).
- **Base: C2.** It has:
  - the only real hook ("Seventy-four minutes.")
  - the clearest two-voice split
  - no version strings spoken
  - all seven FalkorDB points covered
  - a machine-readable line list
  - a cut ladder that only shrinks the work

  C3 is simpler to build, but its weak points are the first things a viewer hears.
- **Convergence, shipped as is:**
  - Two of three scripts made a voice that only reads what is on screen (C1's GRAPH, C2's Ledger). It is the Ledger.
  - Two of three cast Alice as the narrator, and two of three cast Viraj as the engineer, so the cast is Alice and Viraj (C2 had Roger, who is now the A/B).
- **Grafts:**
  - **From C1:**
    - the mosaic resolve at the pixel → brush seam (resolution rises)
    - DSF-2 capture with a click-log cursor
    - the replay callout "a recorded pick, rebuilt from this run's rows"
    - the app's legend shapes in the notebook
  - **From C3:**
    - the on-screen WOULD_PULL chip with its plain definition
    - CSS-mask stroke reveals instead of stroke-polyline logging
    - `plan-loop` round the EXPLAIN index scan
    - the "Every query is in the read-me" author line
- **Fixed from the judge's must-fix list:**
  - The payoff no longer claims Patient Zero "had the answer at 13:30". It now says "the graph needed no advisory: the alarm, our lockfiles, the registry", with the arrow from 14:26 to the 13:16 alert.
  - The axios 106 is spoken with its referent (the campaign's first OSV record).
  - Brush marks on the UI are `fg-0`, amber or green. Red is kept for infection and the two time-gap figures.
  - The disclosure is 24 px or larger and spoken.
  - `docs/AI_USE.md`, the README and the submission copy now say "Voices: ElevenLabs (AI)".
  - The UI arrives at 0:45.5.
  - Brush overlays went from 7 to 4.
  - An author line is never given to an AI voice.
- **Rejected:**
  - C1's third voice: two scripts converged on the rule, which needs no third voice.
  - C1's animated engineer sprite and Seam B geometry match (too costly, and fragile across takes).
  - C2's loop drawn round stacked pixel numerals (fit risk, and it broke confinement).
  - C3's raw version strings in the VO and its date-first opening.
  - Pixel art anywhere near the explanation: a game look trivializes the security story.
- **Verification:**
  - A script parses the line list and checks it: no `[clear]` tag, no banned WOULD_PULL wording, no version string spoken, every cue word present in its line, and every number in a caption found in `docs/proof-points.md` or the measured strings.
  - The beats sum to 147.5 s.
  - Counts: 297 synthesized words, 1,776 characters per pass.
  - Two facts the scripts lean on were checked against the dev graph: socket.io's `@babel/core@7.24.7` sits at depth 1, and mocha pins `debug@4.3.5` at `node_modules/debug`, with a nested `debug@3.2.7`.
  - An `eleven_v4` audition (Alice, Viraj, Roger, plus the qix A/B; 354 characters) measured Alice at about 128 wpm, so the Ledger runs at tempo 1.06.
