# Patient Zero: FalkorDB judge pass, round 6

Headless Chromium via Playwright at 1440x900 (primary), 1366x768 and 1280x720. Judged from the production build `:8080` (real CSP); `:5173` (Vite) smoke-tested. No server touched, no repo file edited, no commit. Every run used a fresh browser context. Screenshots: `qa/reports/phase3r6-judge/`. The server had warm memoized demo queries, so timings are warm.

Cypher check: I took the exact text the app puts on the clipboard (per-statement "Copy", card "Copy all N", "All Cypher used > Copy all") and ran each statement with `docker exec pz-falkor redis-cli ... GRAPH.RO_QUERY` against `pz_acme_qix` and `pz_acme_axios` (read-only). I also ran `scripts/exposure-oracle.ts` (graph-free) for both scenarios and the `NODE_COUNTS` / `EDGE_COUNTS` queries. The FalkorDB Browser (`:3000`) loads and shows a login form; I did not type the database password into a web form, so I ran the README's Browser query text through `GRAPH.RO_QUERY` instead.

## 1. Verdict

Round 5's four blockers are closed, and one of them (the open-ended Ask) was closed only while a model was reachable.

What I verified this round: **"compare mocha and nodemon" now answers both repos** (33 of 33 claims, `[E3]` and `[E5]` open the right cards). **"If I can only fix three repos today, which three and why?" is now routed to the graph** (3 of 3 claims). **The open-ended Ask produced real model answers, labelled as such**: `LLM answer: the model wrote the words · groq:qwen/qwen3.8-27b` (and `groq:openai/gpt-oss-120b`), then `20 of 22 names and numbers in this answer were found in the graph results; the wording is the model's · 2 flagged`, and the unverifiable phrases are marked inline "(not returned by any graph query)". **Cypher boxes are wrapped at the card's full width** (no clipping), and the copied text carries the same tokens as the box. Every copied statement runs as pasted (5 of 5 per card, 14 of 14 in "All Cypher used" on qix and 14 of 14 on axios, README worked example 19 rows both forms). The axios gap now reads **106 min** everywhere (verdict, hover 00:21:58 to 02:07:58, README, proof-points). The pasted-repo headline reads "npm ci is safe". CLS at 1366x768 is 0.005 (was 0.134). `types` has a gloss. Console is clean on `:8080` and `:5173`; axe 0 violations in 12 states.

What holds it near 9 rather than clear of it: **the open-ended Ask worked for my first three open questions (04:04 UTC) and then refused every open question from 04:12:25 UTC to the end of my session (04:25, still "LLM replay" on every run)**, under a header that read "LLM replay" (so the badge and the refusal now agree). A refusal still costs one of the four follow-ups and is a dead-end paragraph with no chips. Two more trust nits: a model answer said "Six teams are notified" (the app sends nothing), and the README tells the judge to paste the query "in the FalkorDB Browser" without mentioning that the Browser opens on a login form. Overall **9.2 / 10**: all six dimensions at or above the bar, Trust and Clarity only just.

## 2. Timed friction log

Cold judge, 1440x900, `:8080`. T+ is a notional judge clock (reading time not included): rows up to 0:17 are measured from first paint; later rows are the running budget of a judge pace, and the measured latency of each step is in the "What happened" column.

| T+ | Step | What happened | SS |
|---|---|---|---|
| 0:00.5 | Land, no clicks | Tagline "See which repos are one install away from a hijacked npm package, before the advisory exists." One primary CTA "Run triage at 13:30 UTC", "Try axios 2026", "Paste your repo", "Built on FalkorDB" pill. Hero counts up from 0; NAME GREP already "21 repos". Centre graph empty at 0.3 s, drawn by 3 s. Point lands in about 5 s | `01-land-0_3s` |
| 0:03.3 | Autoplay | "21 repos one install from malware, 20 safe with npm ci", clock 13:22, graph drawn, scanner 0 | `02-land-3s` |
| 0:10.4 | Still no click | Clock 14:16, graph drawn, red arrow from NAME GREP to PATIENT ZERO. **"74 min" not shown yet: first appears at 11.84 s**, "Play the 90 minutes" at 12.28 s (by design: revealed after the playhead passes the OSV record) | `03-land-10s` |
| 0:16.5 | Autoplay ends | Clock 14:30, "14:26 first OSV record: scanners can flag it only now, 74 min late", scanner 1 | `04-land-16s` |
| 0:17 | Run triage | First tool card 96 ms, "Triage complete: 49 tools, 61 of 61 claims traced" at 347 ms (other runs 0.64 to 0.79 s). One screen: verdict, graph, table, first row auto-selected, path drawn. Badge "LLM live" 61/61 (replay runs: 62/62) | `10-triage-vp` |
| 0:25 | Click `mochajs/mocha` row, then its PATH cell | Path qix > debug@4.4.2 > mocha > QA drawn, live region "Selected mochajs/mocha: mochajs/mocha, then debug@4.4.2." Path cell does the same | `20-row-mocha`, `21-click-path-cell` |
| 0:35 | Open `incident_exposure` card | Five labelled statements, each with Copy and Show plan. Cypher boxes: `white-space: pre-wrap`, `overflow-wrap: anywhere`, 333 px = the full card width, no horizontal scroll. A 4-line statement becomes about 17 wrapped lines (about 29 characters per line) in the 360 px rail | `40-card-incident-open`, `40b-cypher-box-scrolled` |
| 0:45 | Per-statement Copy 1 to 5, "Copy all 5" | Copy 3 text: `CYPHER incident="qix-2025-09-08" at=1757338200000 MATCH (...)`. Same tokens as the displayed box (5 of 5). **All five run as pasted.** "Copy all 5" is 2,427 chars, `;`-terminated, each piece has a "run this one on its own" comment: 5 of 5 run as pieces; pasted whole it fails with FalkorDB's `query with more than one statement is not supported`, as the comment says | `41-copy-query-3`, `42-copy-all-5` |
| 0:55 | "All Cypher used" > Copy all | 7,182 chars, 14 distinct statements, **14 of 14 run on `pz_acme_qix`**; axios copy 7,022 chars, **14 of 14 run on `pz_acme_axios`**. Box is about 490 px, wrapped | `46-all-cypher-tab` |
| 1:05 | Show plan (3/5) | Plan visible in 70 ms, below the Cypher, in view, Ask input still visible. Three "Query n of m copied" toasts stacked over the table because I copied five statements in a row | `45-plan` |
| 1:15 | `[E1]` in WHY | explain_path card scrolls into view, path row outlined, graph selects `acme/checkout-web` | `30-click-E1` |
| 1:25 | "61 of 61 claims traced" and claim map | The chip is a badge, not a button. The claim map lives under "Show 2 more evidence paths, the analyst pick, who to notify, the steps and the claim map": each claim maps to its tool call; the catch-all still reads "Checked against the run as a whole, no single tool call: 1 repo, 4 repos" | `34-claim-map` |
| 1:40 | Ask "compare mocha and nodemon" | 0.28 to 0.32 s, "Answered from the graph", **33 of 33**, both repos: mocha block then nodemon block (about 15 lines each: owner, range, what the lockfile pins, three-step Do). Tool cards: only mocha's `explain_path` and `draft_remediation`; nodemon's proof is `[E5]` (opens `explain_path · remy/nodemon` in the feed and selects the row). It lists two fact dumps, not a comparison | `50-ask-compare`, `52-ask-compare-E5` |
| 1:50 | Ask "which maintainer is the next qix and why?" | 0.27 s, graph answer, 9 of 9: sindresorhus 307 packages reaching 21 of 21, ljharb 183, `types` (with the DefinitelyTyped gloss) 234. Matches the PageRank oracle (43 / 29 / 29%) | `53-ask-seq-2` |
| 2:00 | Ask "If I can only fix three repos today, which three and why?" | 0.25 s, "Answered from the graph", 3 of 3: acme/checkout-web (LOCKED), github/docs, mochajs/mocha, "The other 18 stay safe while they install from their committed lockfiles". npm/cli and remy/nodemon rank identically to the last two (own package.json declares the range) and are dropped by tie order without saying so | text |
| 2:10 | Open question 1, "Explain this incident to a new on-call engineer in plain words." | **04:04:06 UTC: a model answered** in 1.09 s, `LLM answer: the model wrote the words · groq:qwen/qwen3.8-27b`, "20 of 22 names and numbers ... found in the graph results; the wording is the model's · 2 flagged". Includes "Six teams are notified: Payments, Docs, QA, CLI, Platform, and API Clients", which is false (Notice is draft-only) | text |
| 2:20 | Open question 2, "Which repo would hurt the most if it shipped a compromised build, and why?" | 04:04:27 UTC, model answered in 0.75 s, `groq:qwen/qwen3.8-27b`, "9 of 10 ... 1 flagged"; picks acme/checkout-web, adds "financial and customer-data impact" (model inference, labelled as such) | text |
| 2:30 | Open question 3, "Is chalk or debug the bigger problem here?" | 04:04:31 UTC, model answered in 1.60 s, `groq:openai/gpt-oss-120b`, "debug@4.4.2 appears in 21 exposed repos, while chalk@5.6.1 appears in 17" (both correct: FalkorDB gives 21 and 17), "3 of 4 ... 1 flagged", but prints an internal field name: "(see the reposPerVersion (not returned by any graph query) counts)". No model-picked tool calls in any of the three (answers came straight from the evidence block) | text |
| 2:40 | Same kind of question, later | **No model available**, every time from 04:12:25 UTC, header "LLM replay". "Not answered: no language model is available / Not checked against the graph / Unverified", a 10-line paragraph, no chips. Counter goes to "Follow-up 2 of 4" after the refusal; two refusals leave "4 of 4 used" with no model answer | `51-ask-open-1`, `53-ask-seq-3`, `53-ask-seq-4` |
| 3:00 | "is remy/nodemon or mochajs/mocha more urgent?" | Two fact dumps again (33 of 33), no verdict ("equal: both WOULD_PULL, both QA, both declared directly") | text |
| 3:10 | "compare mocha, nodemon, npm/cli and github/docs" | Answers github/docs, mocha, npm/cli (report order); **nodemon silently dropped**, "67 of 67 claims verified", no caveat | `54-ask-four-repos` |
| 3:20 | Try axios 2026 | First card 0.14 s, complete 0.67 s. 10 of 21: LOCKED 1 / WOULD_PULL 9, "106 minutes after the first exposure", 48/48, "5 prod, 4 dev-only". Markers read chronologically 00:21 / 02:07 OSV / 02:19 alert / 03:15 removed; hover "00:21:58 UTC first repo exposed", "02:07:58 UTC OSV record" (exactly 106:00 apart) | `80-axios-done` |
| 3:40 | Paste `mochajs/mocha` | 0.64 s. "1 repo one install from malware, npm ci is safe", "mochajs/mocha, pasted repo, lockfile at commit 5f8e8a8 from 2025-09-01", 33/33, "74 minutes" | `93-paste-done-mochajs-mocha` |
| 3:50 | Paste `axios/axios` (0.63 s), `remy/nodemon` (23/23, lockfile 2023-12-01 disclosed), `expressjs/express`, a bad name | express: "No package-lock.json at the root of expressjs/express. Generate one and drop it here." with a copyable `npm install --package-lock-only`. Bad name: "is not a public repo. Check the spelling". Still the best failure copy I have seen on a hackathon entry | `93-paste-done-expressjs-express`, `93-paste-done-nonexistent-user-zz-nope` |
| 4:05 | Graph stats | Landing drawer and after triage: 46,810 nodes, 123,426 edges, per-label and per-type counts equal the `NODE_COUNTS` / `EDGE_COUNTS` queries run in FalkorDB; 75 queries; Concentration 43 / 29 / 29% with the `types` gloss. A pasted repo's stats show the graph name `pz_guest_c793be6d6578_qix` and queries but no node and edge counts | `60-stats-landing`, `63-stats-after`, `61-concentration`, `96-nodemon-stats` |
| 4:20 | README "Run one yourself" | Browser example (multi-line, `CYPHER maintainer=... since=... until=...`): 19 versions, as stated. Shell example (now a complete query, no `...`): 19 rows. **README does not say the Browser opens on `http://localhost:3000/login` asking for host, port, username and password** (`130-falkordb-browser-landing`) | file, `130-falkordb-browser-landing` |
| 4:40 | Share link, fresh context | Copied `?scenario=qix-2025-09-08&at=1757338200000&repo=mochajs/mocha&open=fix`. Fresh context: first content 0.24 s, done 0.79 s, banner "Shared link: mochajs/mocha is selected; its path is drawn in the graph", and the Fix drawer is open over the verdict | `100-share-click`, `102-share-fresh` |
| 5:00 | 1366x768 and 1280x720 | No horizontal scroll. Run again 1230-1342 of 1366 and 1144-1256 of 1280. Landing CLS 0.0047 / 0.0019 (total 0.0104 / 0.0087). At 1280x720 the WHY line (and `[E1]`) is behind the "Show why (3 evidence paths) ..." disclosure; at 1366x768 it is visible | `1366-triage`, `1280-triage`, `1280-plan` |

## 3. Round-5 items

Every item round 5 raised (its eight ranked fixes, the carry-overs inside fix 8, its "held" rows and its "not tested" list).

| Item (round 5) | Status | Evidence |
|---|---|---|
| Fix 1: README `https://<render-url>`, `https://<video-url>` (known, pending the owner) | Unchanged, known | README.md lines 5-6; not ranked |
| Fix 2: "compare mocha and nodemon" answers one repo, "verified" | **Fixed** (answer), **partly** (proof, form) | Both repos answered, 33/33; `[E3]` / `[E5]` open the right cards. Tool cards cover only the first repo; the answer is two dumps, not a verdict; a fourth named repo is silently dropped (`ask.ts` `many.slice(0, 3)`) |
| Fix 2b: "is remy/nodemon or mochajs/mocha more urgent?" | **Partly** | Both repos now present; still no verdict sentence |
| Fix 3a: route "which three / top N / fix first" to the graph | **Fixed** | "If I can only fix three repos today..." answered from the graph, 3/3. Tie order undisclosed (npm/cli, nodemon rank equal to docs, mocha) |
| Fix 3b: open-ended Ask produced no answer; badge contradicts the refusal | **Fixed while the model was reachable; not fixed after** | 04:04 UTC: three model answers labelled with provider, "n of m found in the graph results; the wording is the model's", inline flags. From 04:12:25 UTC to 04:25 (11 attempts, 6 distinct questions): refused. The badge now agrees: "LLM live" on every answered run, "LLM replay" on every refused run |
| Fix 3c: a refusal should not use up a follow-up | **Not fixed** | Refusal at 04:20:06 moved the counter to "Follow-up 4 of 4"; the second refusal made it "4 of 4 used" |
| Fix 3d: one recorded open-question answer so the demo has an agent answer even offline | **Not fixed** | None shipped; refusal is a 10-line paragraph with no chips |
| Fix 4: Cypher boxes clipped (309 px, horizontal scroll) | **Fixed** | `pre-wrap`, `overflow-wrap: anywhere`, no scroll, 333 px (full card width); "All Cypher used" about 490 px, wrapped. Residual: about 29 characters per line in the card, so a 4-line query is 17 lines |
| Fix 5: pasted-repo headline "safe with npm ci" | **Fixed** | "1 repo one install from malware, npm ci is safe" |
| Fix 6: "+105 min" vs 106:00 of visible timestamps | **Fixed** | Verdict "106 minutes", hover 00:21:58 and 02:07:58, README and proof-points say 106 |
| Fix 7: CLS 0.134 at 1366x768 | **Fixed** | 0.0047 landing, 0.0104 after triage + plan; 1440x900 0.0037 / 0.008; 1280x720 0.0019 / 0.0087 (`tokens.css` now has metric-matched fallbacks) |
| Fix 8: "74 min" appears at 11.98 s | **Not fixed** | 11.84 s (by design; the 10-second point is carried by the hero count) |
| Fix 8: history time "GMT+5:30" in a UTC app | **Not fixed** | "latest 16 Oct, 09:46 GMT+5:30" (browser zone, labelled) |
| Fix 8: Concentration shows a bare `types` | **Fixed** | "The account that publishes DefinitelyTyped's @types packages." |
| Fix 8: claim map catch-all "1 repo, 4 repos" | **Not fixed** | Same text |
| Fix 8: org-repo share link opens the Fix modal | **Not fixed** | `&open=fix` still present; the sharer had only selected a row |
| Fix 8: WHY ends "chalk@5.6.1 ;" | **Not fixed** | Same at 1440 and 1366 |
| Fix 8: README shell example prints a literal `...` | **Fixed** | Complete one-line query; returns 19 rows |
| Fix 8: no `og:title` / `og:image` | **Partly** | `og:title`, `og:description`, `twitter:card` added; no `og:image` ("No image yet" comment) |
| Fix 8: Graph stats for a pasted repo shows no node and edge counts | **Not fixed** | `96-nodemon-stats`: name and queries only |
| Fix 8: three toasts stack over the table | **Not fixed** | Three stacked in `45-plan`, over table rows |
| Held: console clean on `:8080` and `:5173` | **Held** | 0 errors or warnings and 0 page errors in every flow; only `net::ERR_ABORTED` on `/api/triage`, `/api/ask`, `/api/analyze`, `/api/exposure` cancelled by the app or at page close |
| Held: axe | **Held** | 0 violations in 12 states (landing, after triage, row selected, card + plan, four tabs, Fix and Notice, after Ask, paste sheet); "incomplete" is contrast only (14 to 103 nodes) |
| Held: speed | **Held / improved** | First card 96 ms, triage 0.35 to 0.79 s, axios 0.67 s, paste 0.5 to 1.4 s, 13 requests, 320 KB, LCP 0.18 to 0.21 s |
| Held: "Show plan" in view | **Held** | 70 ms; in view at 1440x900 and 1280x720 |
| Held: share link works | **Held** | Fresh context auto-runs, 0.79 s |
| Held: "Run again" and `[E1]` at 1280x720 | **Held, changed** | "Run again" 1144-1256 of 1280; WHY and `[E1]` now behind a disclosure at 1280x720 (visible at 1366x768 and 1440x900) |
| Not tested in r5: cold boot, phone widths, Firefox and WebKit, `docker compose up --build`, FalkorDB Browser, live open Ask | **Partly** | Live open Ask: tested (works, then unavailable). Browser: loads, shows a login form, not driven (I do not type the database password into a web form). Still untested: cold boot (cannot restart), phone, other engines, `docker compose up --build`, `GRAPH.QUERY` denial for `pz_ro` |
| New: README "pz_ro" ACL claim | **Not re-verifiable here** | `ACL LIST` on this dev DB shows only `default` (`start.sh` creates `pz_ro` / `pz_rw` in the container build; `client.ts` falls back to the default user without `FALKOR_ACL`). r5 saw the users; they are not present now, so I could not re-run `ACL GETUSER pz_ro` |

No round-5 behaviour regressed except the 1280x720 WHY line moving behind a disclosure.

## 4. Correctness check against `docs/proof-points.md` and each other

| Claim | On screen / measured | Result |
|---|---|---|
| qix 13:30: LOCKED 1 / WOULD_PULL 20 / CLEAN 0; 20 of 20 real repos | 1 / 20 / 0 of 21; oracle "20 repos exposed" | Match |
| 13 through production | "13 prod, 7 dev-only"; oracle `prod=true` 13, `prod=false` 7 | Match |
| 74 minutes | hero, verdict, pasted repos; 14:26:51 minus 13:12:10 = 74:41 | Match (floor) |
| Declared directly: npm/cli, mocha, nodemon, github/docs | Same four in the table ("direct") and the oracle | Match |
| axios 01:30: 1 / 9 / 11; "9 of 20 repos" | 1 / 9 / 11 of 21; oracle "9 repos exposed" | Match |
| axios "106 min" (README, proof-points) | "106 minutes after the first exposure"; hover 00:21:58 to 02:07:58 = 106:00 | Match |
| axios "5 prod, 4 dev-only" | Same; oracle `prod=true` 5, `prod=false` 4 | Match |
| uptime-kuma `~0.30.3` -> 0.30.4 | Row "~0.30.3 admits axios@0.30.4 (declared directly by the repo)" | Match |
| Graph 46,810 nodes / 123,426 edges | Stats drawer; `MATCH (n) WHERE NOT n:Triage` = 46,810, edges = 123,426 in FalkorDB | Match |
| qix graph 5,373 packages, 10,210 versions, 27,349 entries | Stats drawer and FalkorDB label counts (Package 5,373, Version 10,210, Dep 27,349) | Match |
| axios graph 5,490 packages, 9,941 versions, 27,211 entries | FalkorDB: Package 5,490, Version 9,941, Dep 27,211 | Match |
| 49 tool calls | "Triage complete: 49 tools" (75 queries is the stated, different unit; axios "27 tools, 42 queries") | Match |
| "about 60 claims" | 61 (live), 62 (replay); axios 48; Ask 3 to 67 | Match |
| Ask: 14 repos across 6 teams | "which exposures are prod-only and who owns them?": 0.28 s, 22 of 22 claims, "14 repos across 6 teams" (Payments 1, Docs 1, QA 4, CLI 3, Platform 4, API Clients 1); axios "6 teams to notify" sums to 10 repos | Match |
| Top maintainers sindresorhus, ljharb, types | 43 / 29 / 29% on the tab; 307 / 183 / 234 packages | Match |
| Scanner view 0 hits | "OSV advisories 0" at both clocks | Match |
| Ask "debug@4.4.2 in 21 repos, chalk@5.6.1 in 17" (model) | FalkorDB `EXPOSURE_ADMITS` grouped by version: debug 21, chalk 17 | Match |
| README Browser example "19 versions" | 19 rows | Match |
| README shell example | 19 rows | Match |
| README "pz_ro" ACL | `ACL LIST`: only `default` on the dev DB | Not verifiable here |

Contradictions on screen: none found between the numbers. Text-level problems: the model's "Six teams are notified" (the Notice drawer says "demo team; draft only, nothing is sent"), and the printed `reposPerVersion`.

## 5. Scores

| Dimension | Score | Justification |
|---|---|---|
| Clarity | 9.1 | Point in about 5 s, one CTA, triage in one viewport, answers and plan in view, model answers carry an honest label, paste errors are exemplary, headline wording fixed, Cypher no longer clipped. Docked: the open-question refusal is a 10-line dead-end paragraph; compare and "more urgent" give two dumps and no verdict; the card's Cypher rail breaks at about 29 characters; "74 min" at 11.8 s; WHY and `[E1]` hidden at 1280x720; WHY still ends "chalk@5.6.1 ;" |
| Speed | 9.5 | First card 96 ms, triage 0.35 to 0.79 s, graph Ask 0.25 to 0.6 s, model Ask 0.75 to 1.6 s, plan 70 ms, LCP 0.18 to 0.21 s, CLS 0.002 to 0.011 at all three sizes, 320 KB. Docked: warm numbers only; 13 requests |
| Correctness | 9.2 | Every number reconciles with the oracle, FalkorDB counts and the docs; 5 of 5, 14 of 14 and 14 of 14 copied statements run; README examples return 19 rows; 105/106 resolved. Docked: fourth named repo silently dropped under "67 of 67 verified"; "more urgent" has no verdict; "fix three" ties undisclosed |
| Trust | 9.0 | Model answers are labelled with provider, the guard prints "n of m ... · k flagged" and marks unverifiable phrases inline; refusals are honest; every Cypher runs. Docked: the open Ask went unavailable after a few dozen triage runs (the model path is the Track 1 headline, and a refusal burns a follow-up); "Six teams are notified" in a model answer; internal id `reposPerVersion` printed; README Browser instructions omit the login; the ACL claim cannot be shown on the dev DB; README placeholders (known, not ranked) |
| Delight | 9.2 | Instant cards, drawn paths, `[E5]` jumping to the nodemon path, a model answer in about 1 s with its provenance line, per-statement Copy next to Show plan, a share link that lands on the repo. Docked: three toasts stack over the table; compare answers are walls of text; refusal has no next action |
| Accessibility | 9.3 | axe 0 violations in 12 states, visible 2 px focus on every stop (slider thumb ring included), skip links, `Enter` on the CTA starts the run and moves focus to the Tool feed, live region announces selections and triage. Docked: contrast "incomplete" on 14 to 103 nodes in tab states |

Overall **9.2**. Bar of 9 is met on all six; Trust (9.0) and Clarity (9.1) have no margin, and Trust is the one a bad ten minutes of free-tier availability can take back.

## 6. Ranked fixes

1. **Protects the 9 (trust, delight). An unanswered open question costs a follow-up and gives no next step.**
   - Repro: reach a state where the header reads "LLM replay" (here from 04:12:25 UTC, after a few dozen triage runs and a handful of open questions since the 04:00 restart). Run triage, then Ask "Is chalk or debug the bigger problem here?" and "Which repo would hurt the most if it shipped a compromised build, and why?".
   - Saw: "Not answered: no language model is available / Not checked against the graph / Unverified", a 10-line paragraph naming the question types the graph can answer, no chips; counter "Follow-up 2 of 4" after the first refusal and "4 of 4 used" after two (`51-ask-open-1`, `53-ask-seq-4`).
   - Expected: do not count a refusal; render the six graph-answerable questions as clickable chips; keep one recorded open-question answer labelled "recorded, not live" so the agent path is demonstrable offline.
   - Suspect: `web/src/components/AskBox.tsx` (`rounds` counter), `server/agent/ask.ts` (`unanswered`), `web/src/data/narration.ts`.
   - Ask refusals recorded for the owner: 04:12:25Z "Which exposed repo has the longest dependency chain to a malicious version?", 04:12:31Z "Why would an attacker hijack the qix account rather than a random package?", 04:13:33Z (first question again), 04:14:48Z and 04:17:17Z and 04:22:20Z and 04:23:18Z "Is chalk or debug the bigger problem here?", 04:20:06Z "Explain this incident to a new on-call engineer in plain words.", 04:20:08Z "Which repo would hurt the most if it shipped a compromised build, and why?", 04:21:02Z "Which repos does the sindresorhus account reach, and through which packages?". Answered earlier: 04:04:06Z, 04:04:27Z, 04:04:31Z.
2. **nice-to-have, near-blocking (clarity, "Cypher you can run"). README says paste into the FalkorDB Browser but not how to get in.**
   - Repro: `docker compose up`, open `http://localhost:3000` as the README says.
   - Saw: redirect to `/login` with Host `localhost`, Port `6379`, Username, Password, TLS (`130-falkordb-browser-landing`). README gives no credentials; the compose default is `pz-dev-redis` (`REDIS_PASSWORD`).
   - Expected: one line under "Run one yourself": "Log in with host `localhost`, port `6379`, username blank, password `pz-dev-redis` (or your `REDIS_PASSWORD`)", or keep the shell form as the primary example (it needs no password because the container sets `REDISCLI_AUTH`).
   - Suspect: `README.md` ("Run one yourself"), `docker-compose.yml`.
3. **nice-to-have (correctness, trust). A fourth named repo is silently dropped.**
   - Repro: after triage, Ask "compare mocha, nodemon, npm/cli and github/docs".
   - Saw: blocks for github/docs, mochajs/mocha, npm/cli (report order, not question order); nodemon missing; "67 of 67 claims verified", no caveat (`54-ask-four-repos`).
   - Expected: answer all named repos up to a cap and say "I compared the first 3 of 4; ask for the rest" with a chip for the others.
   - Suspect: `server/agent/ask.ts` (`many.slice(0, 3)`).
4. **nice-to-have (trust). A model answer can claim an action the app never takes, and leaks an internal id.**
   - Repro: Ask "Explain this incident to a new on-call engineer in plain words." while a model is available.
   - Saw: "Six teams are notified: Payments, Docs, QA, CLI, Platform, and API Clients" (Notice drawer: "demo team; draft only, nothing is sent"); another answer prints "(see the reposPerVersion (not returned by any graph query) counts)".
   - Expected: the guard flags verbs that imply side effects (notified, sent, paged, rotated) as unverified, and strips field names the user never sees.
   - Suspect: `server/agent/guard.ts`, the Ask system prompt in `server/agent/ask.ts`.
5. **nice-to-have (clarity). "Compare" and "which is more urgent" give two dumps and no verdict.**
   - Repro: Ask "is remy/nodemon or mochajs/mocha more urgent?"
   - Saw: mocha block and nodemon block, about 15 lines each, "33 of 33 claims verified", no sentence saying they are equal (same tier, same QA owner, both declared directly); Tool cards only for the first repo. The Platform question "List the Platform team repos and how each one reaches the bad version" returns the repo list but not the paths.
   - Expected: a one-line verdict first, then the per-repo detail; one `explain_path` card per named repo; same for "fix three" ties ("docs, mocha, npm/cli and nodemon tie; showing the first three").
   - Suspect: `server/agent/narrate.ts` (`repoFacts`, `priorityFacts`), `server/agent/ask.ts`.
6. **nice-to-have (clarity). At 1280x720 the WHY line and `[E1]` are behind a disclosure.**
   - Repro: load at 1280x720, Run triage.
   - Saw: "Show why (3 evidence paths), the analyst pick, who to notify, the steps and the claim map" and no WHY text (`1280-triage`); 1366x768 shows WHY with `[E1]` (`1366-triage`).
   - Expected: keep one WHY line with `[E1]` visible, or put "[E1]" in the disclosure label.
   - Suspect: `web/src/components/NarrativePanel.tsx` / `ExecSummary.tsx` (height breakpoint).
7. **nice-to-have (polish). Carry-overs, unchanged.**
   - "74 min" first appears at 11.84 s (`03-land-10s`); WHY ends "chalk@5.6.1 ;"; share link opens the Fix modal though only a row was selected (`102-share-fresh`); three "Query n of m copied" toasts stack over the table (`45-plan`); card Cypher breaks at about 29 characters (an "open wide" action would help); history time "GMT+5:30" (browser zone); Graph stats for a pasted repo has no node and edge counts; claim map catch-all "1 repo, 4 repos"; no `og:image`.
8. **known, not ranked (trust). README `https://<render-url>` and `https://<video-url>` stay placeholders until the deploy.**
   - Mentioned once, as instructed.

## 7. Console and measurements

- **`:8080` (CSP build)**: 0 console errors or warnings and 0 page errors across landing, autoplay, triage (qix, axios, alert text), row and path clicks, `[E#]`, claim map, card, per-statement Copy, Copy all, Show plan, Graph stats and tabs, Fix and Notice, Ask (about 30 questions), paste (five repos, two failures), share link in a fresh context, at 1440x900, 1366x768 and 1280x720. Only `net::ERR_ABORTED` on cancelled fetches.
- **`:5173`**: clean (landing, triage, card, per-statement Copy, axios).
- **axe-core** (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice): 0 violations in 12 states on `:8080`.
- **Keyboard**: skip links first; 2 px outline on every stop; the range slider shows a thumb ring; `Enter` on the CTA starts the run and focus lands on "Tool feed".
- **Load**: 13 requests, about 320 KB encoded, DOMContentLoaded 129 to 160 ms, LCP 176 to 212 ms.
- **CLS**: landing 0.0037 (1440x900), 0.0047 (1366x768), 0.0019 (1280x720); after triage + plan 0.008 / 0.0104 / 0.0087.
- **Cypher**: per-statement 5 of 5 (qix `incident_exposure`), "Copy all 5" 5 of 5 as pieces, "All Cypher used" 14 of 14 on `pz_acme_qix` and 14 of 14 on `pz_acme_axios`, README Browser example and shell example 19 rows each. As one paste, FalkorDB refuses multi-statement text by design, and the copied comment says so.
- **Process note**: I briefly wrote two scratch files to the shell's `/tmp` (outside my scratch folder) and deleted them immediately; nothing else outside the scratch folder and `qa/reports/phase3r6-judge*` was touched.
- **Not tested**: cold boot, phone widths, Firefox and WebKit, `docker compose up --build`, driving the FalkorDB Browser login, `GRAPH.QUERY` denial for `pz_ro` (user absent on the dev DB), model-picked tool calls in the Ask loop (none of the three live answers called a tool, and the model was unavailable afterwards).
