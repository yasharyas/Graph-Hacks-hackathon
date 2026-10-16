# Patient Zero: FalkorDB judge pass, round 5

Headless Chromium via Playwright at 1440x900 (primary), 1366x768 and 1280x720. Judged from the production build `:8080` (real CSP); `:5173` (Vite) spot-checked. No server touched, no repo file edited, no commit. Every fresh run used a fresh browser context. Screenshots: `qa/reports/phase3r5-judge/` (named below). The server had warm memoized demo queries, so "cold" timings are not measurable; they are labelled "warm".

Cypher check: I took the exact text the app puts on the clipboard (per-statement "Copy", card "Copy all N", and "All Cypher used > Copy all") and ran each statement with `docker exec pz-falkor redis-cli ... GRAPH.RO_QUERY` against `pz_acme_qix` and `pz_acme_axios` (read-only). I also ran `scripts/exposure-oracle.ts` (graph-free) for both scenarios. FalkorDB Browser (`:3000`, answers 200) was not driven.

## 1. Verdict

A real step up from round 4 (8.9). Four of round 4's blocking items are closed and verified: **every copied Cypher statement now runs as pasted** (per-statement "Copy query n of m" buttons, `;`-terminated, a comment saying "run this one on its own", `$session` shown as a placeholder, "Copy all" de-duplicated to 14 distinct statements; 14 of 14 ran on both graphs, 5 of 5 per card); **"which maintainer is the next qix and why?" is now answered from the graph** (9 of 9 claims: sindresorhus 307 packages, ljharb, types); a real refusal is labelled "Not answered ... Unverified" instead of "Answered from the graph"; and **"Run again" fits at 1280x720** with `[E1]` visible. The README now has a worked example that returns exactly the 19 versions it promises, `docs/proof-points.md` is corrected (about 60 claims, pick varies, 5,373/5,490 packages, which match the graphs), and guest graphs are reaped (4 `pz_guest_*` after about 10 pastes; a boot reaper exists). Console is clean on `:8080` and `:5173` in every flow, axe 0 violations in 13 states, first tool card about 0.1 s, full triage 0.7 to 0.8 s (warm), landing LCP 0.28 s at 318 KB.

What still holds it under 9: (1) **README line 5 and 6 still read `https://<render-url>` and `https://<video-url>`**; (2) **Ask silently answers one repo when two are named** ("compare mocha and nodemon" returns mocha only, still "Answered from the graph, 19 of 19 claims verified"); (3) **the open-ended Ask produced no answer in either completed attempt** (one under the badge "LLM live"): it says "No language model is available right now", so the Track 1 "agent" path could not be demonstrated; (4) the Cypher boxes are now unwrapped and clipped (a 309 px box for 650 to 1,020 px lines). Overall **9.0 / 10**: Speed, Delight and Accessibility clear the bar; Clarity and Trust are 0.1 short.

## 2. Timed friction log

Cold judge, 1440x900, `:8080`. T+ is the scripted stopwatch from first paint (reading time not included). "Warm" = server had memoized the demo graph queries.

| T+ | Step | What happened | SS |
|---|---|---|---|
| 0:00.5 | Land, no clicks | Tagline "See which repos are one install away from a hijacked npm package, before the advisory exists.", one primary CTA ("Run triage at 13:30 UTC"), "Try axios 2026", "Paste your repo", "Built on FalkorDB" pill. Hero "0 repos one install from malware" counting up; MAINTAINER 21 reads "uses the account's packages, nothing malicious yet". Centre graph pane still empty at 0.3 s, drawn by about 1 s. Point lands in about 5 s | `01-land-0_3s` |
| 0:03 | Autoplay | Scanner 0 / name grep 21 / Patient Zero climbing | `02-land-3s` |
| 0:10.4 | Still no click | Clock 14:15, graph drawn, **"74 min" not shown yet** (appears at 11.98 s, "Play the 90 minutes" at 12.39 s) | `03-land-10s` |
| 0:16 | Autoplay ends | "74 min before the OSV record existed", circled; scanner 1; CTA "Run triage at 13:30 UTC" while the clock sits at 14:30 (label discloses the jump) | `04-land-15s` |
| 0:17 | Run triage | Tool results from about 0.1 s, "Triage complete: 49 tools, 62 of 62 claims traced" at 0.69 to 0.83 s (warm). Polled every 20 ms for 1.4 s: no contradictory banner, no clock-jump toast. Layout is one screen: verdict, graph, table; first row (acme/checkout-web) auto-selected, path drawn. Badge "LLM replay" 62/62 (other runs "LLM live" 61/61: it flips between runs with no pattern) | `10-triage-vp`, `11-after-click-from-autoplay-end` |
| 0:25 | Click `mochajs/mocha` row (and its PATH cell) | Path qix > debug@4.4.2 > mocha > QA drawn at once, row highlighted, live region "Selected mochajs/mocha: mochajs/mocha, then debug@4.4.2." Clicking the path cell does the same | `20-row-mocha`, `21-click-path-cell` |
| 0:35 | Open `incident_exposure`, per-statement Copy | Five labelled statements, each with its own "Copy" and "Show plan". Toast "Query 3 of 5 copied". Clipboard text starts `CYPHER incident="qix-2025-09-08" at=1757338200000 MATCH (...`. **All five run as pasted** (21 repos, 21 rows, etc.). Cypher box is 309 px wide and the lines are 650 to 1,020 px: you see about 35 characters of each line, horizontal scroll only | `40-card-incident-open`, `41-copy-query-3` |
| 0:45 | "Copy all 5" | 2,427 chars, `;`-terminated, a `// ... run this one on its own` line in each. Each piece runs. The whole paste fails with FalkorDB's own `query with more than one statement is not supported` (the comment says so up front) | `42-copy-all-5` |
| 0:50 | "All Cypher used" > Copy all | 7,182 chars, 14 distinct statements ("one example per distinct statement", `explain_path` "ran 21 times, these are the first call's values"). **14 of 14 ran** on `pz_acme_qix`; the axios copy also 14 of 14 on `pz_acme_axios`. `recall_triage` carries `session="<private: your session id is an httpOnly cookie this page cannot read>"` and returns 0 rows, honestly | `46-all-cypher-tab` |
| 0:55 | Show plan (3/5) | Plan appears in 152 ms, y 544-776, Ask input at 821: fully visible. At 1280x720 328-596 vs 641; at 1366x768 376-644 vs 689 | `45-plan`, `1280-plan`, `1366-plan` |
| 1:10 | `[E1]` | explain_path card scrolls into view, exact path row outlined, graph selects the repo | `30-click-E1` |
| 1:25 | "62 of 62 claims traced" > claim map | Every claim maps to a tool call; the catch-all now reads "Checked against the run as a whole, no single tool call: 1 repo, 4 repos" | `34-claim-map` |
| 1:40 | Ask "which exposures are prod-only and who owns them?" | 0.17 s, "Answered from the graph", 22/22, "14 repos across 6 teams", 1 tool (`filter_exposures`, 33.6 ms). "YOU ASKED" at y 247, input at 821 | `50-ask-q1` |
| 1:50 | Ask "which maintainer is the next qix and why?" | 0.16 s, "Answered from the graph", 9/9: sindresorhus 307 packages reaching 21 of 21, ljharb 183, `types` "(the account that publishes DefinitelyTyped's @types packages)" 234. Matches the oracle query | `50-ask-q2` |
| 2:00 | Open question "If I can only fix three repos today, which three and why?" | 0.6 to 0.9 s: "Not answered: no language model is available", "Not checked against the graph", "Unverified". The same screen's header said **"LLM live"** in one of the two completed attempts and "LLM replay" in the other; both refused (I opened about 45 fresh sessions across the pass to catch a live state, which showed up in about 1 of 9). The refusal still uses up one of the 4 follow-ups | `50-ask-q3`, `51-ask-open-live` |
| 2:10 | Ask variants | "what should I do first?" 39/39, "why is mochajs/mocha exposed?" 19/19, "which team has the most work?" 14/14 (CLI 5 ... Payments 1, sums to 21), all from the graph. **"compare mocha and nodemon" and "is remy/nodemon or mochajs/mocha more urgent?" return the mocha answer only**, "19 of 19 claims verified", no mention of nodemon | (text) |
| 2:30 | Try axios 2026 | First tab content 0.20 s, complete 0.72 s (warm). 10 of 21: LOCKED 1 / WOULD_PULL 9 / CLEAN 11, "+105 min", 48/48, "5 prod, 4 dev-only". Verdict "since 00:21 UTC", timeline "00:21 exposed" (consistent now); markers read chronologically 02:07 OSV / 02:19 alert / 03:15 removed, hover text "02:19:00 UTC alert, after OSV" | `80-axios-done` |
| 2:50 | Paste `mochajs/mocha` | 2.5 s. "1 repo one install from malware, safe with npm ci" (reads oddly, fix 5), "mochajs/mocha, pasted repo, lockfile at commit 5f8e8a8 from 2025-09-01", "+74 min", 34/34 | `93-paste-done-mochajs-mocha` |
| 3:05 | Paste `axios/axios`, `remy/nodemon`, `expressjs/express`, `chalk/chalk`, a bad name | axios 0.9 s (lockfile 2025-09-04), nodemon 1.0 s (20/20, 2023-12-01 disclosed). `expressjs/express` and `chalk/chalk`: "No package-lock.json at the root ... run `npm install --package-lock-only` ... drop the generated package-lock.json here" with a Copy button and sample repos. Bad name: "is not a public repo. Check the spelling". Best failure copy I have seen on a hackathon entry | `94-paste-expressjs-express`, `94-paste-nonexistent-user-zz-nope` |
| 3:20 | Graph stats | Landing drawer and after-triage tab: 46,810 nodes, 123,426 edges; per-label and per-type counts equal `NODE_COUNTS` and `EDGE_COUNTS` run in FalkorDB; 75 queries; Concentration 43/29/29% equals the `CONCENTRATION_RISK` result (0.01476, 0.01004, 0.00990). Guest graph tab shows the graph name (`pz_guest_..._qix`) but no size row | `60-stats-landing`, `63-stats-after`, `96-nodemon-stats` |
| 3:40 | Fix and Notice drawers | Fix: package.json overrides + PR body, "Team QA (demo)". Notice: "demo team; draft only, nothing is sent" | `70-fix-drawer`, `71-notice-drawer` |
| 4:00 | README "Run one yourself" | The example returns 19 rows exactly as stated. Header still `https://<render-url>` and `https://<video-url>`; the shell example is the literal `... MATCH ...` (errors if pasted) | (file) |
| 4:10 | Share link, fresh context | Copied: `?scenario=qix-2025-09-08&at=1757338200000&repo=mochajs/mocha&open=fix` (the sharer had not opened Fix). Fresh context auto-runs: first content 0.34 s, done 0.9 s, banner "Shared link: mochajs/mocha is selected; its path is drawn in the graph", and the Fix drawer is open over the verdict | `100-share-click`, `102-share-fresh`, `102-share-notice` |
| 4:30 | 1366x768 and 1280x720 | No horizontal scroll. Run again 1144-1256 of 1280 and 1230-1342 of 1366. WHY shows `[E1]` unclamped. **1366x768 landing has a 28 px layout jump at about 0.3 s, CLS 0.134** | `1280-triage`, `1366-triage` |

## 3. Round-4 items

Every item round 4 raised (its eight ranked fixes, the carry-overs inside them, section 3 holds, and its "not tested" list).

| Item (round 4) | Status | Evidence |
|---|---|---|
| Fix 1a: README `https://<render-url>` and `https://<video-url>` | **Not fixed** | README.md lines 5-6; `docs/launch-posts.md` still all placeholders |
| Fix 1b: README Cypher has no parameters, no worked example | **Fixed** | "Run one yourself" gives `CYPHER maintainer="qix" since=... until=...` plus the query; run returns 19 versions, matching the text and `at=1757338200000` note. Residual nit: the shell example prints `... MATCH ...` literally, which errors (`Invalid input '.'`) |
| Fix 2a: multi-statement Copy cannot be pasted as one query, no per-statement copy | **Fixed** (as far as FalkorDB allows) | "Copy query n of m", "Copy all N", "Show plan for query n of m"; `;` terminators and a "run this one on its own" comment; each statement ran. One paste of several still fails with FalkorDB's `more than one statement` error, and the text says to run each on its own |
| Fix 2b: `recall_triage` omitted `$session` | **Fixed** | Shows `session="<private: ... httpOnly cookie ...>"`; runs, 0 rows |
| Fix 2c: "Copy all" 41,561 chars, 73 statements, 14 distinct bodies | **Fixed** | 7,182 chars, 14 statements, "one example per distinct statement"; 14/14 run on qix and axios |
| Fix 3: Ask labels a refusal "Answered from the graph"; "next qix" not routed | **Fixed** | Refusal: "Not answered: no language model is available" + "Unverified". "next qix": "Answered from the graph", 9/9, matches the PageRank query. New related defects: fixes 2 and 3 below |
| Fix 4a: "Run again" clipped 15 px at 1280x720 | **Fixed** | 1144-1256 of 1280 |
| Fix 4b: `[E1]` hidden by WHY clamp at 1280x720 | **Fixed** | Unclamped three lines, `[E1]` visible (`1280-triage`) |
| Fix 4c: "Built on FalkorDB" pill drops its ms at 1280 | **Fixed** | "Built on FalkorDB 671.2 ms" at 1280 |
| Fix 5a: "00:22 exposed" vs verdict "since 00:21" | **Fixed** | Both read 00:21 (hover: "00:21:58 UTC first repo exposed") |
| Fix 5b: "+105 min" vs visible times | **Not fixed** | Hover shows 00:21:58 and 02:07:58, which is 106:00. True gap 105.997 min, floored to 105. Qix 74:41 floors to 74, so floor is the stated convention, but the axios screen shows both ends to the second |
| Fix 5c: axios marker order "02:07 OSV, 03:15 removed, 02:19 alert" unexplained | **Fixed** | Chronological 02:07 OSV / 02:19 alert / 03:15 removed; hover "02:19:00 UTC alert, after OSV", "02:07:58 UTC OSV record" |
| Fix 6a: proof-points "58 to 61 claims", "5,739 package names", analyst pick `@babel/core` as fixed | **Fixed** | Now "about 60", "the pick varies by run and provider; replays pick ...", and 5,373 / 5,490 packages, 10,210 / 9,941 versions, 27,349 / 27,211 entries (all three checked in FalkorDB) |
| Fix 6b: README "LRU 4" vs 16 `pz_guest_*` graphs | **Fixed** | `GRAPH.LIST` shows 4 after about 10 pastes; `server/ingest/guest.ts:128` reaps earlier-process guests at boot. (Local DB also holds dev leftovers `spike_copy`, `spike_big`, not in the compose build) |
| Fix 7: Cypher wraps at about 28 characters; table paths truncate | **Not fixed (changed)** | No wrap now: `white-space: pre`, `overflow-x: auto`, 309 px box vs 646 to 1,024 px content (`40-card-incident-open`, `45-plan`). "All Cypher used" is wider but still clips at about 90 characters (`46-all-cypher-tab`). Table paths still truncate ("@ty.../parser@8.30.1") |
| Fix 8a: `types` listed as a maintainer | **Partly** | Ask explains it ("the account that publishes DefinitelyTyped's @types packages"); the Concentration tab still shows a bare `types` 29% (`61-concentration`) |
| Fix 8b: history time "GMT+5:30" in a UTC app | **Not fixed** | "latest 16 Oct, 05:22 GMT+5:30" (`62-history-2runs`) |
| Fix 8c: "74 min" appears at 11.8 s, not 10 s | **Not fixed** | 11.98 s (`03-land-10s`) |
| Fix 8d: claim map catch-all "1 repo, 4 repos, @babel/core" | **Partly** | Now "1 repo, 4 repos"; still a catch-all with cryptic counts (`34-claim-map`) |
| Fix 8e: LLM badge flips live/replay, pick and claim count change (61 vs 62) | **Not fixed** | Flips unpredictably (live in about 1 of 9 fresh runs here). Now also contradicts the Ask refusal (fix 3 below) |
| Held: console clean on `:8080` and `:5173` | **Held** | 0 console errors or warnings, 0 page errors across all flows; only `net::ERR_ABORTED` on fetches cancelled at page close |
| Held: axe | **Held** | 0 violations in 13 states: landing running and done, after triage, row selected, card + plan, four tabs, Fix and Notice drawers, after Ask, paste sheet. "incomplete" is contrast only (2 to 101 nodes) plus 2 `target-size` |
| Held: CLS | **Held except 1366x768** | 1440x900 0.0013 landing, 0.0057 after triage + plan + Ask; 1280x720 0.017 to 0.023; **1366x768 0.134 (new, fix 7 below)** |
| Held: speed | **Held / improved** | First card about 0.1 s, triage 0.7 to 0.8 s, axios 0.72 s, paste 1.0 to 2.5 s (warm), 10 requests, 318 KB, LCP 0.28 s |
| Held: "Show plan" in view | **Held** | At all three sizes |
| Held: share link works | **Held, changed** | Org-repo links now carry `&open=fix` (deliberate in `App.tsx` `share()`), so the link lands on the Fix drawer |
| Not tested in r4: cold boot, phone widths, Firefox/WebKit, FalkorDB Browser, live open-ended Ask | **Still not tested** | Cold boot (cannot restart), phone, other engines, `:3000` not driven (200 OK). **Open-ended Ask: tried twice, refused both times (fix 3)** |

No round-4 behaviour regressed. New defects this round: two-repo Ask, "LLM live" vs refusal, pasted-repo headline, 1366x768 CLS, share link opening a modal.

## 4. Correctness check against `docs/proof-points.md` and each other

| Claim | On screen / measured | Result |
|---|---|---|
| qix 13:30: LOCKED 1 / WOULD_PULL 20 / CLEAN 0; 20 of 20 real repos | 1 / 20 / 0 of 21; oracle "20 repos exposed" | Match |
| 13 through production | "13 prod, 7 dev-only"; oracle `prod=true` 13 | Match |
| 74 minutes | hero, "+74 min", verdict, pasted repos; 14:26:51 - 13:12:10 = 74:41 | Match (floor) |
| Declared directly: npm/cli, mocha, nodemon, github/docs | Same four in oracle and in the analyst pick (live) | Match |
| axios 01:30: 1 / 9 / 11; "9 of 20 repos" | 1 / 9 / 11; oracle 9; "5 prod, 4 dev-only" = oracle 5 / 4 | Match |
| axios "105 min" | 105 on screen; hover 00:21:58 to 02:07:58 reads 106:00; true 105.997 | Match to the floor; looks off by one to a reader (fix 6) |
| uptime-kuma `~0.30.3` -> 0.30.4 | oracle "axios ~0.30.3"; row "axios@0.30.4 direct" | Match |
| Graph 46,810 nodes / 123,426 edges | Stats drawer; `NODE_COUNTS` / `EDGE_COUNTS` sums run in FalkorDB | Match |
| Axios graph 5,490 packages, 9,941 versions, 27,211 entries | FalkorDB counts exactly these | Match |
| 49 tool calls | "Triage complete: 49 tools" (75 queries is a different, stated unit; axios "27 tools, 42 queries") | Match |
| Ask: 14 repos across 6 teams | Same; Prod-only filter 14 of 21 | Match |
| Top maintainers sindresorhus, ljharb, types | 43 / 29 / 29% = 0.01476 / 0.01004 / 0.00990 | Match |
| Scanner view 0 hits | "OSV advisories 0" at both clocks | Match |
| "about 60 claims" | 61 (live) or 62 (replay); axios 48; Ask 9 to 39 | Match |
| Analyst pick "@babel/core" (replay) | Replay: "4 repos ... @babel/core: socketio/socket.io, jquery/jquery, mozilla/pdf.js and 1 more"; live pick is the own-package.json observation | Match, now documented as varying |
| README "pz_ro" ACL | `ACL GETUSER pz_ro`: `-@all +graph.ro_query +graph.explain +graph.list +ping +hello +client +info` | Match |
| README "LRU 4, TTL 1 h" | 4 guest graphs after about 10 pastes | Match |
| README worked example "19 versions ... 74 minutes before" | 19 rows | Match |

Contradictions on screen: (1) axios "+105 min" vs the two visible timestamps 106:00 apart; (2) header "LLM live" next to "No language model is available right now"; (3) the two-repo question answered as one repo under a "verified" label. Nothing else contradicts.

## 5. Scores

| Dimension | Score | Justification |
|---|---|---|
| Clarity | 8.9 | Point in 5 s, one CTA, triage in one viewport, plan and answers in view, `[E1]` visible at 1280, best-in-class paste errors. Docked: Cypher unreadable without scrolling (309 px box), pasted-repo headline reads "1 repo one install from malware, safe with npm ci" (the count is replaced by the bare word "safe", which reads as a broken sentence), "74 min" at 12 s, WHY ends `chalk@5.6.1 ;`, share link drops you into a modal |
| Speed | 9.4 | First card 0.1 s, triage 0.7 s, Ask 0.2 to 0.5 s, paste 1 to 2.5 s, 318 KB, LCP 0.28 s, CLS 0.001 to 0.02 at two sizes. Docked: CLS 0.134 at 1366x768 (28 px jump at 0.3 s); warm only |
| Correctness | 9.0 | Every number reconciles with the oracle, FalkorDB counts and the docs; 14 of 14 copied statements run on both graphs; docs drift gone. Docked: 105 vs 106 min, two-repo question answered as one repo |
| Trust | 8.9 | Runnable Cypher, honest refusals, demo tags, recorded-vs-live badge, ACL and LRU claims verify. Docked: README placeholders (first thing a judge clicks), "verified" label on a one-sided answer, "LLM live" beside "no language model", no model-written Ask answer seen |
| Delight | 9.1 | Instant cards, drawn paths, circled 74 min, per-statement copy with plan next to it, "one example per distinct statement", share link that lands on the fix. Docked: clipped Cypher, three toasts stacking over the table |
| Accessibility | 9.3 | axe 0 violations in 13 states, visible 2 px focus everywhere, skip links, collapsed cards are `inert`, Cypher boxes are labelled focusable regions, live regions announce selections and triage. Docked: contrast "incomplete" on 2 to 101 nodes in tab states |

Overall **9.0**. The bar of 9 is met on Speed, Correctness, Delight and Accessibility; Clarity and Trust are 0.1 short, and the README placeholders alone decide Trust for a judge who opens the repo first.

## 6. Ranked fixes to reach >= 9 on every dimension

1. **blocking-9 (trust, submission). README placeholders.**
   - Repro: open `README.md` lines 5-6 (and `docs/launch-posts.md`).
   - Saw: `https://<render-url>`, `https://<video-url>`, `<repo-url>`, `<blog-url>`.
   - Expected: the deployed URL and video link, or delete the two lines until they exist.
   - Suspect: `README.md`, `docs/launch-posts.md`.
2. **blocking-9 (trust, correctness). A question naming two repos is answered about one, still "verified".**
   - Repro: after triage, Ask "compare mocha and nodemon" or "is remy/nodemon or mochajs/mocha more urgent?"
   - Saw: "Answered from the graph", "19 of 19 claims verified", only `mochajs/mocha` (one `explain_path` call); nodemon is never mentioned.
   - Expected: answer both (two `explain_path` calls) or say "I answer one repo at a time: pick one" and offer both as chips.
   - Suspect: `server/agent/ask.ts` (named-repo router takes the first match).
3. **blocking-9 (trust). The open-ended Ask refused in both attempts, and the badge contradicts the refusal.**
   - Repro: Run triage until the header says "LLM live", then Ask "If I can only fix three repos today, which three and why?"
   - Saw: "Not answered: no language model is available" under a header reading "LLM live" (`51-ask-open-live`); both completed attempts (one under "LLM live") were refused, so a model-written Ask answer was never seen; the refusal costs one of 4 follow-ups; the router has "what to do first" and "which team has the most work" but not "which N repos".
   - Expected: (a) route "which three/top N repos, fix first, most urgent" to the tier/prod ordering the graph already has; (b) a second badge or text for Ask availability ("Open questions: model unavailable"); (c) do not count a refusal as a follow-up; (d) ship one recorded open-question answer for the demo.
   - Suspect: `server/agent/ask.ts`, `web/src/data/narration.ts` (badge and `answerLabel`), the follow-up counter in `web/src/components/AskBox.tsx`.
4. **nice-to-have, near-blocking (clarity, "Cypher you can read"). Cypher boxes are clipped.**
   - Repro: open any tool card.
   - Saw: `pre` with `overflow-x: auto`, 309 px box, content 646 to 1,024 px (`40-card-incident-open`); no hint that it scrolls; "All Cypher used" is wider but still clips at about 90 characters (`46-all-cypher-tab`).
   - Expected: soft-wrap with a "Wrap / No wrap" toggle, or an "Open wide" action that opens the statement in the 480 px drawer; keep `white-space: pre` for the clipboard text only.
   - Suspect: `web/src/components/ToolCard.tsx` (the `pre` styles), `web/src/components/InsightTabs.tsx`.
5. **nice-to-have (clarity). Pasted-repo headline reads as a broken sentence.**
   - Repro: Paste `mochajs/mocha`.
   - Saw: "1 repo one install from malware, safe with npm ci" (`93-paste-done-mochajs-mocha`); the qix screen reads "21 repos ... 20 safe with npm ci". Deliberate wording (`safe === exposed` prints "safe" or "all safe"), but it reads as a sentence with a word missing, and it can be mistaken for "the repo is safe".
   - Expected: "1 repo one install from malware, 1 safe with npm ci" or "safe if installed from the lockfile".
   - Suspect: `web/src/components/TimelineScrubber.tsx` line 172 (`safe === exposed ? (exposed === 1 ? 'safe' : 'all safe') : ...`).
6. **nice-to-have (correctness). "+105 min" vs the two timestamps on hover.**
   - Repro: Try axios 2026, hover the 00:21 and 02:07 markers.
   - Saw: "00:21:58 UTC first repo exposed" and "02:07:58 UTC OSV record" (106:00 apart) beside "+105 min" and "105 minutes after the first exposure"; true gap 105.997.
   - Expected: the same floor stated ("105 min, floored from 105 min 59.8 s") or show "1 h 45 min 59 s" in the tooltip.
   - Suspect: `server/tools/registry.ts` (`minutesAhead` floor), `web/src/components/TimelineScrubber.tsx` line 264 (marker titles).
7. **nice-to-have (speed). 28 px layout jump on first paint at 1366x768, CLS 0.134.**
   - Repro: load `http://localhost:8080/` at 1366x768 with a layout-shift observer; shift at about 0.3 s.
   - Saw: the hero tier row re-wraps when the web fonts finish loading, moving the whole lower pane up 28 px (`Tool feed` 411 to 383); at 1440x900 CLS 0.001, at 1280x720 0.017.
   - Expected: CLS under 0.1: add `size-adjust`/`ascent-override` fallback faces for Satoshi and Martian Mono, or reserve the two-line height.
   - Suspect: `web/src/design/tokens.css` (`font-display: swap`, no metric-matched fallback), the hero tier row in `web/src/components/TimelineScrubber.tsx`.
8. **nice-to-have (polish). Carry-overs and small ones.**
   - "74 min" appears at 11.98 s, not 10 s (`03-land-10s`).
   - History time "16 Oct, 05:22 GMT+5:30" in a UTC app: `timeZone: 'UTC'` in `web/src/data/clock.ts`.
   - Concentration tab shows a bare `types`; reuse the Ask's one-line gloss.
   - Claim map catch-all "1 repo, 4 repos" is still cryptic.
   - An org-repo share link opens the Fix modal over the verdict although the sharer never opened Fix (`App.tsx` `share()`); a banner plus the selected row would be gentler, or open Fix only when it was open.
   - WHY ends "chalk@5.6.1 ;" at 1440 (a clamped list ending in a semicolon).
   - README shell example uses a literal `... MATCH ...`.
   - Page has no `og:title` / `og:image`, so a pasted link previews as a bare URL.
   - Graph stats for a pasted repo shows no node and edge counts.
   - Three "Query n of m copied" toasts stack over the table for 4 s; one replaceable toast would do.

## 7. Console and measurements

- **`:8080` (CSP build)**: 0 console errors or warnings and 0 page errors across landing, autoplay, triage (qix, axios, alert text), row and path clicks, `[E#]`, claim map, card, per-statement Copy, Copy all, Show plan, Graph stats, Fix and Notice, Ask (9 questions), paste (five repos, two failures), share links in fresh contexts, at 1440x900, 1366x768, 1280x720. CSP header carries `style-src 'self'` plus three sha256 hashes. Only `net::ERR_ABORTED` on `/api/triage`, `/api/ask`, `/api/exposure` when the page closes or the app cancels its own request.
- **`:5173`**: clean (landing, triage, card, per-statement Copy).
- **axe-core** (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice): 0 violations in 13 states on `:8080`.
- **Keyboard**: skip links first, visible outline on every stop, `Enter` on "Run triage at 13:30 UTC" starts the run and moves focus to the Tool feed.
- **Load**: 10 requests, 318 KB encoded, DOMContentLoaded 217 ms, LCP 280 ms.
- **CLS**: 1440x900 0.0013 / 0.0057 (landing / after triage + plan + Ask); 1280x720 0.017 / 0.023; 1366x768 0.134 / 0.140.
- **Cypher**: per-statement 5 of 5 (qix card), "Copy all 5" 5 of 5 as split pieces, "All Cypher used" 14 of 14 on `pz_acme_qix` and 14 of 14 on `pz_acme_axios`, README example 19 rows. As one paste, FalkorDB refuses multi-statement text by design.
- **Not tested**: cold boot, phone widths, Firefox and WebKit, FalkorDB Browser (`:3000` returned 200, not driven), `GRAPH.QUERY` denial for `pz_ro` (needs its password), a live model answer to an open question (two attempts, both refused; the model was unavailable to Ask), `docker compose up --build`.
