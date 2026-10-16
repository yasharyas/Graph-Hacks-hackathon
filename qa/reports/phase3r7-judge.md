# Patient Zero: FalkorDB judge pass, round 7

Persona: a FalkorDB-team judge with about 5 minutes per entry, fair but skeptical of AI slop and overclaiming. Build under test: main 3ec287f (local HEAD equals `origin/main`), production build on `:8080` (real CSP), `:8080` was not restarted or reconfigured. Playwright headless Chromium, a fresh context per run, at 1440x900 (primary), 1366x768 and 1280x720. Screenshots: `qa/reports/phase3r7-judge/`. Scripts: the session scratchpad, `r7judge/`.

Budgets kept: 2 model-backed open questions (both used in the cold journey), 2 pasted public repos (`mochajs/mocha`, `FalkorDB/falkordb-browser`). All other Ask questions were graph-routed (free). FalkorDB was queried read-only (`GRAPH.RO_QUERY`, `GRAPH.EXPLAIN`, `GRAPH.MEMORY`). No repo file was edited, nothing committed, `.env` never read (`git status` clean at the end).

How I checked routing without spending model quota: a scratch script imports the repo's own `ask()` from `server/agent/ask.ts` with a fake chat function that only counts calls, runs it on a real qix 13:30 report, and prints `modelCalled`, mode and the answer. Every UI result below was then confirmed in the real app. Replay-mode strings (the video is recorded with `LLM_CHAIN=replay`) were reproduced the same way from `recorded()` plus `observations()`, because I may not restart `:8080`.

## 1. Verdict and overall score

**Overall 9.2 / 10.** Five of six dimensions are at or above the 9 bar; **Trust is 8.9**, a hair under it, for reasons that are all small and all fixable in about an hour (section 5).

The audit's two real gaps are closed. The agent is now on the first screen: after triage, with no click, at 1440x900 and at 1366x768, the verdict, the "Analyst pick" line, "Notify 7 teams" and "Next qix? sindresorhus: 43% of top-3 PageRank, reaches 21 of 21 repos" are all in view together with the table and the Ask box. The Ask box no longer answers the audit's six questions with a different question under a green badge: all six are routed to the graph, none touched a model, and every number I re-computed in FalkorDB matches (ljharb 20 repos, sindresorhus 21, types 20, 11 per-version counts, 157 carriers, 16 repos through `@babel/core`). The README now has an image, a links row, a five-step 60-second tour, a perceive/decide/act list and a real MCP transcript that matches the server verbatim. `docs/AI_USE.md`, `docs/submission.md` (148 words) and `video/script.md` are mostly accurate against the running app.

What holds it at 9.2 and not higher:

1. **A1 is only partly fixed.** The six exact audit questions work, but natural variants of them still answer a different question under "Answered from the graph, N of N claims verified". "Which library should I replace first to reduce the exposure?" returns the generic Do plan and the Notify roster (39 of 39 claims verified). "Which maintainer account reaches the most repos if hijacked?" leads with the per-team exposure list, then the right PageRank answer. "Which package carries the bad version into the most repos?" returns the per-version list. The audit's own phrase for the problem was "answers the wrong question under a green verified badge".
2. **A new bug from the A1 work.** "Which repos does the sindresorhus account reach, and through which packages?" is refused ("Not answered from the graph") because the router reads "through which" as "via the npm package `which`" (a real package in the graph). The refusal is then shown under the header "Not answered: no language model is available" while the header reads "LLM live".
3. **Docs drift a skeptic can catch from the code.** README:28, README:121, `docs/AI_USE.md:17` and blog:76 say the server builds "three to six observations" including "the production share" and "the advisory gap". `observations()` in `server/agent/narrate.ts` builds `spread`, `carrier`, `own`, `team` and `many`: four on the demo org, at most two on a pasted repo.
4. **A stale internal note** in `video/script.md` (Beat 3: "Before the round-7 UI merge …") survived the "drop merge notes" commit, and Beat 4's `[E3]` click needs a disclosure the script never says to open.

Everything else I tried held: console clean on every normal path, 0 axe violations in 13 states, speed unchanged, share link fixed, paste works on a FalkorDB judge's own repo, write-back to the graph is real.

## 2. Items table (win-audit AGENT items)

| Item | Status | Evidence |
|---|---|---|
| **A1** Ask never answers a different question under "verified" | **Partly fixed** | The six audit questions: **fixed**, table below. My five variants: 2 still wrong, 1 mixed, 2 right. New: "through which packages" refusal bug. `a1-*.png`, `which-1.png` |
| **A2** agent on the first screen after triage, no click | **Fixed** (1440x900, 1366x768) | At 1440x900: pick line at y=490, Notify at y=568, Next qix at y=594, Ask box y=821, table y=279, all in view; at 1366x768: 424 / 520 / 546 / 689. Pick reads "ANALYST PICK · LLM LIVE 4 repos declare the range … (github/docs, mochajs/mocha, npm/cli and 1 more)". The Ask placeholder is "If ljharb were hijacked next, which repos would it reach?" and works. `a2-1440-triage.png`, `a2-1366-triage.png`. Nits below |
| **A3** README first screen, tour, "What the agent does", MCP transcript | **Fixed**, 3 nits | See "A3 claim check" below. Image (og-card, 1200x630, alt text matches it), links row anchors resolve, five-step tour, "Run it locally" above the Cypher block, Cypher inside `<details>`, `test/readme.test.ts` passes. MCP transcript matches the server verbatim |
| **A4** corrected claims | **Fixed** | `EXPLAIN_PATH` (README:99, blog:66, decisions:63) now says `Dep.repo` index then the traverse to `Version`; matches Show plan. "Independent" is gone (README:429 "Two AI-run security reviews (Opus, read-only …)"). Oracle sentence in README:82 and proof-points:5. Limits: two incidents ingested, paste is general. Replay sentence in README:121 and AI_USE:28. 74-min caption measured at 2.4 s, circle at 11.6 s |
| **A5** `docs/AI_USE.md` | **Fixed**, 3 nits | Names AI persona QA, AI security reviews, AI-drafted copy. Dated decisions list and build timeline verified against `git log` and the GitHub API (below) |
| **A6** `video/script.md` walk | **Mostly fixed** | Beats 1 to 9 and 11 match the app string for string (below). Stale Beat 3 note, `[E3]` needs the disclosure, "Narration mode:" is screen-reader-only, "about 14 s" is 12.3 s measured |
| **A7** `docs/submission.md` | **Fixed**, 2 overclaims | Description is **148 words** (limit 150), numbers right, links in judge order, cover image `web/public/og-card.png` is 1200x630, placeholders checklist. Two sentences claim a little more than the app does |
| **A8** MCP `incident` default, alert-box error | **Fixed**, 2 nits | `incident_exposure` with only `{scenario, at}` returns 21 rows (qix: 1 LOCKED, 20 WOULD_PULL; axios: 1 / 9 / 11 CLEAN). Unknown alert: "The alert names neither loaded incident: the qix compromise on 2025-09-08 (try "qix compromised, 13:16 UTC") or axios on 2026-03-31 (try "axios compromised, 00:30 UTC"). For anything else, use Paste your repo." |
| **A9** absolute `og:image` | Waits for a live URL | Not tested (as instructed). `web/index.html` still relative |
| **A10** Docker font fetch retry | **Fixed** | `fetch-fonts.mjs` retries a network error or 5xx 3 times (1 s, 2 s), 4xx and hash mismatch fail at once; `web/src/design/fetch-fonts.test.ts` 5 of 5 pass; Dockerfile comment is accurate. A real `docker build` was not run |

### A1 detail: the six audit questions, then my own

| Question | Route / answer | Verified against | Result |
|---|---|---|---|
| If ljharb were hijacked, how many repos? | `maintainer_blast_radius` card, "20 of the 21 repos", 24 of 24 claims, 0.34 s | `MAINTAINER_BLAST_RADIUS`: ljharb 20 | right |
| Which malicious version reaches the most repos? | by-version list, `debug@4.4.2` 21 … `supports-color@10.2.1` 2, "other 8 of the 19 reach no repo" | `EXPOSURE_ADMITS` grouped by version: identical 11 counts | right (no tool card of its own; claims open the triage's earlier cards) |
| If we can only change one dependency today, which upgrade removes the most exposure? | `filter_exposures carriers=true`: override on `debug@4.4.2` reaches 21 of 21, "clears 1 repo completely (`postmanlabs/newman`)", carriers `@eslint/eslintrc` 19, `eslint` 18 … "and 152 more" | `EXPOSURE_CARRIERS`: 19 / 18 / 18 / 18 / 18, 157 distinct carriers | right; honest "No upgrade or removal of a single carrier clears any repo" |
| Which single package should we remove first? | same carrier answer | same | right (answers the neighbouring question and says so) |
| Which repos get debug@4.4.2 through @babel/core? | `filter_exposures via=@babel/core`, 16 repos across 6 teams, 30 of 30 | 16 `ADMITS` repos through `@babel/core` | right; the model is no longer needed |
| Explain this incident to a new on-call engineer in plain words | graph summary + "Tiers in plain words: LOCKED = …", 6 of 6 | verdict text | right (the inverted-LOCKED model answer is gone) |
| N1 What if sindresorhus got hijacked, how many repos would be affected? | blast radius, 21 of 21 | 21 | right |
| X2 How many repos would the types account reach? | blast radius, 20 of 21 | 20 | right |
| **N2 Which library should I replace first to reduce the exposure?** | generic "Do 1) … 2) … 3) …" plus Notify roster, "39 of 39 claims verified" | no library named | **different question, verified badge** (`a1-n2-library.png`) |
| **N3 Which maintainer account reaches the most repos if hijacked?** | team list first ("CLI 5 repos; QA 4 …"), then the right PageRank answer, "23 of 23" | second block right | **mixed** (`a1-n3-account.png`) |
| **X1 Which package carries the bad version into the most repos?** | by-malicious-version list | the asker means the carrier, not the version | **arguably a different question** (`a1-x1-carries.png`) |
| **"Which repos does the sindresorhus account reach, and through which packages?"** | "Not answered from the graph …" with `maintainer_blast_radius` already run | the router parsed `via which` (npm package `which` exists in `pz_acme_qix`) | **wrong refusal**, under "Not answered: no language model is available" (`which-1.png`); without the last clause it answers 25 of 25 (`which-2.png`) |

Other free routing checks (offline oracle, all `modelCalled: 0`): "Which dependency should Platform bump first?" gives a Platform-scoped carrier answer; "Which version of debug is malicious?" gives the version list; "compare mocha, nodemon, npm/cli and github/docs" answers all four, 85 of 85, with a verdict first; "is remy/nodemon or mochajs/mocha more urgent?" opens with "rank the same". "how many repos pull chalk through supports-color?" returns "Complete list … 0 repos across 0 teams. ." (right answer, stray "."). "How many repos would ljharb and sindresorhus together reach?" shows the two blasts side by side, not a union.

### A2 detail: what each control opens

- **"Analyst pick · LLM live"**: a statement, not a control. Its repo chips (`github/docs`, `mochajs/mocha`, `npm/cli`) select that repo's row and draw its path.
- **"Notify 7 teams · Payments, Docs, QA +4 · Roster"**: "Roster" (aria-label "Open the roster of 7 teams to notify") opens the folded section: 7 team rows with channel, repos and a per-team **Copy notice**, then the Do steps. It is open-only; "Show less" closes it. The audit asked for "Copy notices" on the line itself: the copy action is one click deeper.
- **"Next qix? sindresorhus: 43% of top-3 PageRank, reaches 21 of 21 repos →"**: opens the Concentration tab under the table, scrolled into view; keyboard Enter does the same and moves focus to the tab.
- **"Show 2 more evidence paths, who to notify, the steps and the claim map"**: `[E2]`, `[E3]`, the roster, Do and the claim map.
- At **1280x720** the "Next qix?" line is dropped on purpose (`NarrativePanel.tsx`: on a tight screen the Next line goes first); pick, Notify and `[E1]` stay.

### A3 claim check (README first screen, tour, "What the agent does")

| Claim | Result |
|---|---|
| Image alt: "21 repos one install from malware (1 LOCKED, 20 WOULD_PULL) next to 1 OSV advisory, and the circled figure '74 min before the OSV record existed'" | True, matches `web/public/og-card.png` |
| Tour 1: from about 2 s hero reads "21 repos one install from malware", "Advisory scanner 0", caption "no advisory for 74 min, until 14:26"; only the circle waits | True: hero 21 at 2.2 s, caption at 2.4 s, circle at 11.6 s. "Autoplay … in about 14 s" is **12.3 s** measured (14:30 reached and "Play the 90 minutes" shown at 12.2 s) |
| Tour 2: 49 read-only graph calls with rows, Cypher, ms | True (49; 1.2 s) |
| Tour 3: mocha declares `debug ^4.3.5`, zero hops; Fix drafts the pin and PR body; Notice drafts the Slack message | True (row "declared directly by the repo"; drawer has overrides, STEPS, PULL REQUEST BODY; Notice "For QA in #team-qa (demo team; draft only, nothing is sent)") |
| Tour 4: copy the first card's statement and run it in `redis-cli GRAPH.RO_QUERY pz_acme_qix '<paste>'` | True: copied `suspect_versions` text has no `'`, 332 chars, runs as pasted, 19 rows. Compose service name and `REDISCLI_AUTH` match `docker-compose.yml` (I ran the equivalent on `pz-falkor`; `docker compose up` itself was not run) |
| Tour 5: paste gives its own graph, pre-incident lockfile, "9 calls for one exposed repo" | True: `mochajs/mocha` 9 tools, 4.6 s; `FalkorDB/falkordb-browser` 9 tools, 3.5 s |
| Ask "which exposures are prod-only and who owns them?" = 14 repos across 6 teams | True, 22 of 22 claims, 0.35 s |
| Perceive: `find_target` resolves alert terms; no model parses the alert | True: "qix compromised, 13:16 UTC" gives `find_target` then 49 more calls, clock 13:16Z; `fromAlert` is a regex |
| "`suspect_versions` runs only while no bad version is known; explain_path and draft_remediation once per exposed repo; 49 calls" | True: at 13:30 49 calls (21 + 21 + 7); at 14:30 (after the 14:26:51 advisory) 48, `suspect_versions` skipped |
| Decide: "The server builds **3 to 6** observations … one LLM call answers with the id" | **Overclaim**: `observations()` yields 4 on the demo (`spread`, `carrier`, `own`, `team`), 1 to 2 on a paste. AI_USE:17 and blog:76 also list "the production share" and "the advisory gap", which are not observations (the verdict already says them) |
| Act: drafts for 7 teams, nothing sent | True |
| Act: writes `(:Triage)-[:FOR]->(:Incident)` and `(:Triage)-[:ASSESSED {tier, action}]->(:Repo)`; Mark remediated writes `action: 'remediated'`; recall reads them; session-scoped | True: read-only queries show 1,025 `FOR` edges, `ASSESSED` edges with `[tier]` (21,000) and `[tier, action]` (25); my mark is the newest, `at` 1792135966668 = 07:32 UTC; the next run's `recall_triage` card reads "21 repos assessed earlier in this session; 1 marked remediated: mochajs/mocha"; a fresh session sees "no earlier assessments in this session" |
| Same tools over MCP, ten read-only tools | True (below) |
| Judge claims on `pz_ro` / `GRAPH.QUERY` NOPERM | Not live-testable on the dev DB (it has only `default`); `start.sh` ACL lines match the README |

**MCP transcript vs server** (`node server/mcp.ts`, `FALKOR_PORT=6380 REDIS_PASSWORD=devpass`, a plain JSON-RPC client): `serverInfo` is `patient-zero` 1.0.0, protocol 2025-06-18; `tools/list` returns the ten tools in the README's order, each `readOnlyHint: true` with `scenario` required; `explain_path` on `socketio/socket.io` returns the README's summary, params and first row byte for byte; row 2 is `@fails-components/webtransport@1.1.4`, `^4.3.4` as printed; the Cypher footer is the README's, line for line. `incident_exposure` with only `{scenario, at}` works (21 rows); omitting `at` or `scenario` gives a clear validation error.

### A5 detail: `docs/AI_USE.md`

Verified: repo created 2026-10-15T08:53:26Z = 14:23:26 IST (GitHub API); the four Phase-0 commits `4909731`, `53fa17e`, `bb59561`, `5c722d3` all carry 14:32:29 +0530; `f3ca28c` is 14:47:19; `87713e0` 15:36:55; `24beaba` 23:30:34; `bb59561` is "Add incident data, org snapshots and oracle"; model chain `groq:qwen/qwen3.8-27b, groq:openai/gpt-oss-120b, gemini:gemini-3.5-flash-lite` matches `llm.ts`; ask loop "4 model calls, 6 graph tool calls" matches `ROUNDS`/`PER_ASK`; `qa/security/phase3r3..r6-security.md` and `qa/reports/phase3-security.md` exist; decisions.md has the three arena entries it cites. Nits: "three to six observations (production share, advisory gap)" (above); "six rounds" is seven with this one; the section "Decisions … (for the author to confirm and restate)" is a note addressed to the author, sitting in a public doc until the author restates it (the audit asked for exactly this, but it must be resolved before submission, or it reads as unsigned AI text).

### A6 detail: `video/script.md` beat by beat (1440x900, `:8080`)

| Beat | Script says | App | Match |
|---|---|---|---|
| 1 | marks "13:12 exposed · 13:16 alert · 14:26 OSV record · 15:15 removed"; caption "13:12 malicious versions out · no advisory for 74 min, until 14:26" at about 2 s; circle at about 12 s | identical; caption 2.4 s; circle 11.6 s | yes ("about 14 s" is 12.3 s) |
| 2 | Shift+Left x6 from 14:30 reaches 13:30; button "Run triage at 13:30 UTC"; scanner 0; PATIENT ZERO 1 LOCKED, 20 WOULD_PULL; "21 repos one install from malware, 20 safe with npm ci" | identical | yes |
| 3 | cards order `suspect_versions`, `incident_exposure`, `maintainer_blast_radius`, `recall_triage`, then `explain_path` per repo; "Triage complete: 49 tools, 62 of 62 claims traced to graph queries"; "Analyst pick · LLM replayed: 4 repos' shortest paths … `@babel/core` …"; "Notify 7 teams" | order identical; live run reads 61 of 61 (live pick); **replay strings reproduced offline: 62 of 62, pick text exact, axios 48 of 48** | yes |
| 3 note | "Before the round-7 UI merge, the analyst pick, the 7-team Notify roster and the Do steps sit behind the disclosure … Open it for this beat." | pick and Notify are on screen with no click; the disclosure label is now "Show 2 more evidence paths, who to notify, the steps and the claim map" | **stale** |
| 4 | mocha row "^4.3.5 debug@4.4.2 · direct · declared directly by the repo"; click `[E3]` in Why; card "range ^4.3.5 admits it · declared by the repo"; Show plan ends in "Node By Index Scan (x:Dep)" under "Conditional Traverse (x)-[e:RESOLVES_TO\|:ADMITS]->(@anon_2:Version)" | row text identical; plan text identical (the UI drops the `\|` separators that raw `GRAPH.EXPLAIN` prints); **`[E3]` only exists after opening the disclosure** (`[E1]` alone is visible) | yes, with the missing "open the disclosure" step |
| 5 | Fix drawer text, `"debug@4.4.2": "4.4.1"`, steps, PR body; Notice "For QA in #team-qa (demo team; draft only, nothing is sent)" with the path | identical | yes |
| 6 | "Remediated · <date>, <time> UTC · Undo"; row "remediated <time> UTC"; Esc; Run again; recall card "21 repos assessed earlier in this session; 1 marked remediated: mochajs/mocha"; history "Marked remediated · mochajs/mocha", "Assessed in earlier runs · 21 repos · LOCKED 1 · WOULD_PULL 20" | identical; history also prints "· latest 16 Oct, 07:32 UTC" between "21 repos" and the tiers; mark is in FalkorDB | yes |
| 7 | Graph stats "pz_acme_qix · 46,810 nodes · 123,426 edges · Dep 27,349 · Version 10,210 · Package 5,373 · Maintainer 3,817 · Advisory 30"; Concentration 43 / 29 / 29% with 307 / 183 / 234 packages | identical | yes |
| 8 | placeholder "If ljharb were hijacked next, which repos would it reach?"; 20 repos; backup 14 repos across 6 teams | identical; 0.34 s; counter stays "0 of 4 model answers" | yes |
| 9 | axios radio; "Triage complete: 27 tools"; "10 repos one install from malware, 9 safe with npm ci"; uptime-kuma "~0.30.3 axios@0.30.4 · direct"; "it came at 02:07 UTC, 106 minutes after the first exposure"; markers 00:21 / 02:07 OSV / 02:19 alert / 03:15 removed | identical | yes |
| 10 | MCP in Claude Code | server side verified (above); Claude Code prompt not run | server yes |
| 11 | paste `mochajs/mocha`; stages; "Triage complete: 9 tools"; "1 repo one install from malware, npm ci is safe"; "Judged on the package-lock.json at commit 5f8e8a8 from 2025-09-01, the last change before the incident" | identical (4.6 s) | yes |
| 12 | end card with `<render-url>` and `https://github.com/yasharyas/Graph-Hacks-hackathon` | repo URL matches `git remote`; `<render-url>` is the known user blocker | known |

Also: "the header reads 'Narration mode: LLM replay'" (Beat 3): "Narration mode: " is a screen-reader-only prefix; on screen the chip reads "LLM replay". The voiceover is 320 words (counted), the table totals 2:28. Beat 6 puts five actions into 10 s with a 19-word voiceover, the tightest beat.

### A7 detail: `docs/submission.md`

148 words by whitespace (150 limit). Facts verified: 74 minutes, one node per lockfile location, `ADMITS` edges, `GRAPH.COPY` per tenant, LRU 4 + TTL 1 h (`guest.ts`), ACL users, ten MCP tools. Overclaims: "Every answer carries its Cypher and a GRAPH.EXPLAIN plan" (every **tool card** carries its Cypher; the plan is on demand; the by-version and plain-words Ask answers have no card of their own); "An LLM only picks one graph-built observation by id" (open Ask answers are model-written, guarded and labelled; the one-line AI note a few lines down says so correctly, so the two disagree).

### Other findings re-checked from round 6 (bonus)

Share link no longer opens the Fix drawer when only a row was selected (banner "Shared link: mochajs/mocha is selected; its path is drawn in the graph.", 1.2 s fresh context). WHY no longer ends "chalk@5.6.1 ;". An Ask refusal now offers three clickable questions and does not use a follow-up (counter stays "0 of 4"). "compare" and "more urgent" now open with a verdict and name all four repos.

## 3. Timed friction log

Cold judge, 1440x900, `:8080`. Measured from `page.goto` in one fresh context (`cold.cjs`); reading time is the gaps between clicks.

| T+ | Step | What happened | SS |
|---|---|---|---|
| 0:00.2 | Land | DOMContentLoaded. Tagline "See which repos are one install away from a hijacked npm package, before the advisory exists." | `cold-01-land` |
| 0:02.2 | Autoplay | Hero "21 repos one install from malware, 20 safe with npm ci", "Advisory scanner 0", caption "13:12 malicious versions out · no advisory for 74 min, until 14:26". Point lands. CTA "Run triage at 13:30 UTC", "Try axios 2026", "Paste your repo" | `cold-02-3s` |
| 0:09.9 | Run triage | First tool card 0.85 s, "Triage complete: 49 tools, 61 of 61 claims traced to graph queries." at 1.2 s | `cold-03-triage` |
| 0:11.2 | First viewport | Verdict, WHY with `[E1]`, "Analyst pick · LLM live …", "Notify 7 teams … Roster", "Next qix? sindresorhus …", table and the Ask box all in view, no scroll. The agent is visible in the first screen | `a2-1440-triage` |
| 0:11.7 | Click `mochajs/mocha` | Path drawn in 0.4 s | `cold-04-mocha` |
| 0:12.7 | Open `suspect_versions`, Show plan | Plan in view in 186 ms | `cold-05-card` |
| 0:13.1 | Copy Cypher | Runs as pasted in `redis-cli`, 19 rows | `tour4-suspect-card` |
| 0:14.0 | Ask from the placeholder | "Answered from the graph", 24 of 24, 0.62 s, `maintainer_blast_radius` card | `cold-06-ask-graph` |
| 0:16 | Ask "Which malicious version reaches the most repos?", click `strip-ansi@7.1.1` | Answer in 0.35 s with no card of its own; the claim chip opens the triage's earlier incident-exposure card (works, but nothing new appears in the feed) | `cold-07-claim-click` |
| 0:18.9 | Open question 1, "Is chalk or debug the bigger problem here?" | 1.9 s, `LLM answer: the model wrote the words · groq:openai/gpt-oss-120b`, "debug@4.4.2 is the larger problem: it appears in 21 exposed repos versus chalk@5.6.1 in 17 repos. [E7]", "4 of 4 names and numbers found in the graph results; the wording is the model's". Both numbers are right | `cold-08-open-1` |
| 0:21.3 | Open question 2, "Which repo would hurt the most if it shipped a compromised build, and why?" | 2.1 s, same model, picks `acme/checkout-web` (LOCKED) and adds "expose customers", "3 of 3 found; the wording is the model's". Honest label, but it answers "which repo is most exposed", not "which repo hurts downstream if it ships a bad build" (the graph has no downstream data) | `cold-08-open-2` |
| 0:30 | Open Fix on mocha | Drawer with overrides, steps, PULL REQUEST BODY; Notice tab "demo team; draft only, nothing is sent" | `a6-b5-fix`, `a6-b5-notice` |
| 0:40 | Mark remediated, Esc, Run again | Row "remediated 07:32 UTC", header "1 marked remediated"; 62 of 62 claims; `recall_triage` card "21 repos assessed earlier in this session; 1 marked remediated: mochajs/mocha"; FalkorDB holds the mark | `a6-b6-marked`, `mark-recall` |
| 0:50 | Paste `mochajs/mocha` | 4.6 s, five stages seen, "1 repo one install from malware, npm ci is safe", "Judged on the package-lock.json at commit 5f8e8a8 from 2025-09-01" | `paste-mochajs_mocha-done` |
| 1:00 | Paste `FalkorDB/falkordb-browser` (the judge's own repo) | 3.5 s, 9 tools, "its dependency `@typescript-eslint/eslint-plugin@6.21.0` declares `^4.3.4`, which admits `debug@4.4.2` [E1]", lockfile from commit 7c27e1e (2025-09-07). The long package name wraps in a bordered block inside the WHY line; the header reads "LLM template" (one observation, so no pick). This is the strongest moment of the journey | `paste-FalkorDB_falkordb-browser-done` |
| 1:10 | Unknown alert | "log4j is on fire": error names both loaded incidents and "use Paste your repo"; the page shows a clean error state, DevTools shows one red `400 (Bad Request)` | `a8-alert-unknown` |
| 1:20 | Sizes | No horizontal scroll at 1440 / 1366 / 1280. CLS 0.0073 / 0.0095 / 0.0077 after triage; landing LCP 272 / 268 / 276 ms; 12 requests, 324 KB. At 1280x720 pick, Notify, WHY and `[E1]` are in view; "Next qix?" is dropped by design | `sz-*` |
| 1:30 | Share link, fresh context | 1.2 s to done, banner "Shared link: mochajs/mocha is selected; its path is drawn in the graph." No Fix drawer | `share-fresh` |

## 4. Scores

| Dimension | Score | Justification |
|---|---|---|
| Clarity | 9.3 | Point in 2.2 s, one primary CTA, and after triage the verdict, the agent's pick, Notify and the next-target line are all in the first viewport at 1440x900 and 1366x768. Refusals offer clickable graph questions. Docked: "Roster" instead of "Copy notices" (the copy action is one click deeper); a refusal header that blames model availability when the graph router refused; the long package chip that breaks the WHY line on a pasted repo; "74 min" circle at 11.6 s |
| Speed | 9.5 | LCP 268 to 304 ms, CLS under 0.01 at all three sizes, 12 requests, 324 KB; triage 1.2 s, graph Ask 0.35 to 0.62 s, model Ask 1.9 to 2.1 s, Show plan 186 ms, paste 3.5 to 4.6 s, share link 1.2 s. Docked: warm numbers only; the first card took 0.85 s in the cold run (96 ms in round 6) |
| Correctness | 9.0 | Every number I re-computed in FalkorDB matches the app and `docs/proof-points.md` (section 6): per-version counts, carrier counts, 16 through `@babel/core`, scanner hits and OSV timestamps, 46,810 nodes and 123,426 edges, 11.57 MB RDB, 9 / 27 / 49 tool counts. The six audit questions are right. Docked: natural variants still answer a different question under a verified badge (N2, partly N3 and X1); "through which packages" is refused wrongly; "3 to 6 observations" and "production share, advisory gap" contradict `observations()`; autoplay "about 14 s" is 12.3 s |
| Trust | 8.9 | Every claim label is honest where the model writes (provider, "n of m found … wording is the model's"), write-back to the graph is real and session-isolated, the MCP transcript is verbatim, the AI disclosure is thorough and dated. Docked below 9: a green "verified" answer to a different question (N2); the "no language model is available" header on a graph-router refusal; docs and AI disclosure that describe the observation list wrongly (the kind of thing a judge finds by reading `narrate.ts`); submission copy that says "every answer carries its Cypher and a GRAPH.EXPLAIN plan" and "an LLM only picks … by id"; a stale "round-7 UI merge" note in a public script; the author-addressed "confirm and restate" note in a public doc; README `<render-url>` / `<video-url>` still placeholders (known, user-owned) |
| Delight | 9.4 | Instant cards, drawn paths, a model answer in 2 s with its provenance line, `[E7]` jumping to the chalk path, pasting a FalkorDB judge's own repo and seeing it flagged in 3.5 s, Mark remediated then Run again reading it back, a share link that lands on the repo. Docked: the by-version answer shows no card of its own; "remediate / d" wraps in the recall card; the paste WHY chip |
| Accessibility | 9.3 | axe (wcag2a/aa, 21a/aa, 22aa, best-practice): **0 violations in 13 states** (landing, after triage, Concentration, roster open, row selected, Fix drawer, Notice, Graph stats, after Ask, paste sheet, alert error, 1366x768 after triage), contrast "incomplete" only on the dense tab states (up to 176 nodes). Keyboard: Enter on "Next qix?" opens Concentration and moves focus to the tab; "Roster" has a clear aria-label ("Open the roster of 7 teams to notify"). Docked: "Roster" exposes no expanded state (it is open-only by design, labelled "Open"), contrast "incomplete" not resolved |

**Overall 9.2.** Mean of the six = 9.23. Bar of 9 met on five of six; Trust is 0.1 under.

## 5. Ranked remaining fixes

1. **Ask still answers a different question under "verified" (Correctness, Trust). Highest value for the Track 1 headline.**
   - Repro: after triage, Ask "Which library should I replace first to reduce the exposure?", then "Which maintainer account reaches the most repos if hijacked?", then "Which package carries the bad version into the most repos?".
   - Saw: first, the generic "Do 1) … 2) … 3) …" plus the full Notify roster, "Answered from the graph", "39 of 39 claims verified"; second, "Open exposures by team, most first: CLI 5 repos; QA 4 …" ahead of the right PageRank paragraph, "23 of 23"; third, the malicious-version list, "24 of 24" (`a1-n2-library.png`, `a1-n3-account.png`, `a1-x1-carries.png`).
   - Expected: the first and third route to the carrier answer (or refuse with the honest "not answered from the graph"), the second to the PageRank answer alone.
   - Suspect: `server/agent/ask.ts` regexes `FIRST` (matches any "first"), `TEAMS` (`\bmost (work|exposed|repos)\b` still fires on "reaches the most repos"), `CARRIER` and `VERSIONS` (L177-183), and the `parts` list in `graphAnswer` (L208-224), which emits every matching block. A cheap guard: if the question starts "which/what <noun>" and the noun is library, package, dependency, account or maintainer, only the route that returns that noun may answer.
2. **"through which packages" is read as `via which`, and the refusal blames the model (Trust).**
   - Repro: Ask "Which repos does the sindresorhus account reach, and through which packages?".
   - Saw: "Not answered: no language model is available / Not answered from the graph: the answers the graph has here are about something other than what this question names … Unverified: no claim in this text was checked", while `maintainer_blast_radius` had already run and the header read "LLM live" (`which-1.png`). Dropping the last clause answers 25 of 25.
   - Expected: the answer, or a refusal that says why. `which` is an npm package in `pz_acme_qix`, so `known()` sets `via = 'which'` and `covers()` then fails.
   - Suspect: `server/agent/ask.ts` `VIA` / `known()` (L131-137): ignore question words and stop words as via-candidates and require the candidate to be a carrier with an `ADMITS` edge. And `web/src/data/narration.ts:158`: every `unanswered` gets "no language model is available" unless the cap is used; add a reason on the narration event for the router refusal.
3. **Docs and AI disclosure describe the observation list wrongly (Trust).**
   - Repro: read `observations()` in `server/agent/narrate.ts`, then README:28 ("3 to 6 observations"), README:121 ("the carrier dependency, the prod share, the advisory gap and so on"), `docs/AI_USE.md:17`, blog:76.
   - Saw: code builds `spread`, `carrier`, `own`, `team`, `many`: four on the demo org, at most two on a paste; "production share" and "advisory gap" are deliberately left out because the verdict already says them.
   - Expected: "up to four observations (the account's widest version, the shared carrier, directly declared ranges, the busiest team)" in all four places. Also README:13 and the video script say the autoplay takes "about 14 s"; it is about 12 s.
   - Suspect: `README.md`, `docs/AI_USE.md`, `blog/74-minutes-before-the-advisory.md`, `video/script.md`.
4. **`video/script.md` still carries a merge note and omits a step (clarity of the recording).**
   - Repro: read Beat 3's recording note and Beat 4.
   - Saw: "Before the round-7 UI merge, the analyst pick, the 7-team Notify roster and the Do steps sit behind the disclosure 'Show 2 more evidence paths, the analyst pick, who to notify, the steps and the claim map'. Open it for this beat." The pick and Notify are on screen now; the label has changed; `[E3]` in Beat 4 exists only after that disclosure is opened.
   - Expected: "The analyst pick and Notify 7 teams are on screen with no click. Open 'Show 2 more evidence paths …' before Beat 4: `[E2]` and `[E3]` are inside." Also say "LLM replay" (the chip text), not "Narration mode: LLM replay" (screen-reader-only).
   - Suspect: `video/script.md` line 29 (Beat 3 note), line 14 (Beat 4), line 13.
5. **Two sentences in the submission copy claim a little more than the app does (Trust).**
   - Repro: `docs/submission.md` Description.
   - Saw: "Every answer carries its Cypher and a GRAPH.EXPLAIN plan" and "An LLM only picks one graph-built observation by id". The by-version and plain-words Ask answers have no card of their own; the plan is a click; open Ask answers are model-written.
   - Expected: "Every tool card carries its Cypher, and Show plan fetches its GRAPH.EXPLAIN plan"; "An LLM picks one graph-built observation by id and answers open questions through read-only tools, with a guard on every name and count". Keep it at 150 words or fewer (it is 148 now).
   - Suspect: `docs/submission.md`.
6. **Console is clean except on the unknown-alert path (polish; the brief says the console must be clean).**
   - Repro: "Describe an alert…", type "log4j is on fire", Enter.
   - Saw: a good error panel, plus one console `error: Failed to load resource: the server responded with a status of 400 (Bad Request)`.
   - Expected: no red line for a handled validation error. Return it as an SSE `error` event on a 200, or pre-check the alert's terms in the client.
   - Suspect: `server/index.ts` L254 and L311-314 (`HttpError(400, …)` for `/api/triage`), the alert submit in `web/src/App.tsx`.
7. **Polish batch (each small).**
   - Pasted repo: the long package name in WHY wraps into a bordered block that splits the sentence (`paste-FalkorDB_falkordb-browser-done.png`), and the repo column truncates to "Fa…/falkordb-browser". `web/src/components/NarrativePanel.tsx` (code chip `white-space`), `ExposureTable.tsx`.
   - `recall_triage` card: "remediated" wraps to "remediate / d" in the ACTION column (`mark-recall.png`).
   - Graph stats: "Time in FalkorDB 491 ms" next to "Run total 321 ms" reads as a contradiction; the queries run in parallel. Label it "summed across parallel queries". `web/src/components/` stats sheet.
   - MCP: `incident_exposure` accepts an explicit `incident` that differs from `scenario` and returns nonsense (`axios-2026-03-31` on the qix graph gives "0 LOCKED, 0 WOULD_PULL, 10 MAINTAINER, 11 CLEAN"). Reject or coerce. `server/mcp.ts` L64 (`params.incident ??= args.scenario`).
   - "how many repos pull chalk through supports-color?" prints "0 repos across 0 teams. ." (stray period). `server/agent/ask.ts` `completeList` / `viaFacts`.
8. **Known, not ranked (user-owned).** README links row `https://<render-url>` and `https://<video-url>`; the GitHub repo page still has no description, topics or homepage (`description: null`, `topics: []` via the API at 07:xx UTC; issue #1 is now closed); A9 `og:image` absolute URL; the "for the author to confirm and restate" decisions list in `docs/AI_USE.md` needs the author's own wording.

## 6. Numbers checked against `docs/proof-points.md`

| Claim | Measured | Result |
|---|---|---|
| qix 13:30: LOCKED 1 / WOULD_PULL 20 / CLEAN 0; 20 of 20 real repos; 13 through production | hero 21, "1 LOCKED, 20 WOULD_PULL (13 prod, 7 dev-only)" | match |
| 74 minutes | caption and verdict; OSV `MAL-2025-46974` `publishedAt` 1757341611000 = 14:26:51Z, first publish 13:12:10Z | match (74:41, floor) |
| Declared directly: npm/cli, mocha, nodemon, github/docs | same four rows say "direct" (`^5.4.1`, `^4.3.5`, `^4`, `^5.0.1`) | match |
| axios 01:30: 1 / 9 / 11, "9 of 20" | MCP summary "1 LOCKED, 9 WOULD_PULL, 0 MAINTAINER, 11 CLEAN of 21"; hero "10 repos one install from malware, 9 safe with npm ci" | match |
| axios 106 min (00:21:58 to MAL-2026-2306 02:07:58); 2 h 54 min (to MAL-2026-2307 03:15:49) | FalkorDB advisory timestamps 1774922878000 and 1774926949000; verdict "106 minutes after the first exposure" | match |
| `uptime-kuma` `~0.30.3` to 0.30.4 | row "~0.30.3 axios @0.30.4 direct" | match |
| Graph 46,810 nodes, 123,426 edges; qix 5,373 / 10,210 / 27,349; axios 5,490 / 9,941 / 27,211 | FalkorDB `count(n)` 46,810 and edges 123,426 (excluding `FOR`/`ASSESSED`); axios stats API 27,211 / 9,941 / 5,490 | match |
| Baked RDB 11.6 MB | `deploy/dump.rdb` is 11,570,063 bytes | match |
| Graph "24 MB" (README:77) | `GRAPH.MEMORY` now 26 MB, with this session's 1,025 Triage nodes and 21k ASSESSED edges added since the build | not re-checkable (drifted by the write-back) |
| 49 tool calls; 7 teams; 27 for axios; 9 for a paste | 49, 7, 27, 9 | match |
| "about 60 claims": 62 replay, 61 live | replay 62 of 62 offline; live 61 of 61; 62 of 62 after one mark | match |
| Concentration sindresorhus 43% (307 pkgs, 21 of 21), ljharb 29% (183, 20 of 21), types 29% (234, 20 of 21) | identical on the tab; blast radius counts re-run in FalkorDB | match |
| Ask prod-only: 14 repos across 6 teams | "Complete list (prod only): 14 repos across 6 teams", 22 of 22 | match |
| Scanner view: only hit `acme/checkout-web` at 14:26:51; axios only `acme/billing-api` at 02:07:58 and 03:15:49 | read-only `Advisory-[:FLAGS]->Version<-[:RESOLVES_TO]-Dep` | match (qix has two further advisories on the same repo, `MAL-2025-46969`, `GHSA-4x49-vf9v-38px`, later) |
| `EXPLAIN_PATH` plan | `GRAPH.EXPLAIN` and the app's Show plan: `Node By Index Scan (x:Dep)` then `Conditional Traverse (x)-[e:RESOLVES_TO\|:ADMITS]->(@anon_2:Version)` | match (leaf order: "starts with" means starts executing; the printed plan lists it last) |
| Free-tier speed (0.1 CPU container: 28-30 s cold boot, 219 MB, 2.3 s triage) | not measured: would need a new container and a restart | not verified |

## 7. Console and measurements

- **Console**: 0 errors or warnings and 0 page errors in the cold journey, triage (qix, axios), row and `[E#]` clicks, Show plan, Copy, Fix and Notice, Mark remediated and Run again, Graph stats, roster, "Next qix?", Ask (graph and model), paste of two repos, share link in a fresh context, at 1440x900, 1366x768 and 1280x720. One handled `400 (Bad Request)` on the unknown-alert path (fix 6). `requestfailed` showed only cancelled fetches.
- **axe-core** (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice), with `bypassCSP` in a separate context so the console run stayed on the real CSP: 0 violations in 13 states.
- **Load**: 12 requests, about 324 KB, LCP 268 to 304 ms, CLS 0.0037 to 0.0048 at landing and 0.0073 to 0.0095 after triage.
- **FalkorDB reads** (all `GRAPH.RO_QUERY` / `GRAPH.EXPLAIN` / `GRAPH.MEMORY USAGE`): blast radius for three maintainers, per-version and per-carrier counts, `@babel/core` carrier, scanner hits, label and edge counts, `ASSESSED` / `FOR` edges.
- **Process notes**: my triage runs, the two Mark remediated clicks (one in `a6all`, one in `mark.cjs`) and my `curl` triage posts wrote session-scoped Triage records through the app (the app prunes to 1,000 unmarked). Each triage also made one model pick call on the shared free tier. I never wrote to FalkorDB directly. I imported repo modules (`ask.ts`, `narrate.ts`, `replay.ts`) in my own scripts, read-only.
- **Not tested**: cold boot, Render deploy (A9), phone widths, Firefox and WebKit, `docker compose up --build` and a real `docker build` of the font retry, live replay mode on `:8080` (reproduced offline instead), the `pz_ro` NOPERM behaviour (the dev DB has only `default`), the Claude Code MCP session in Beat 10, whether a live model still says "notified" in an answer (the system prompt now forbids it; neither live answer did).
