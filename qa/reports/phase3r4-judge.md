# Patient Zero: FalkorDB judge pass, round 4

Headless Chromium via Playwright. 1440x900 primary, 1280x720 second pass (plus 1366x768 for one measurement). Judged from the production build `:8080` (real CSP); `:5173` (Vite) spot-checked. No server touched or restarted, no repo file edited. Screenshots: `qa/reports/phase3r4-judge/` (named below). Every fresh run used a fresh browser context. The server had warm memoized demo queries throughout, so "cold" timings were not measurable; they are labelled "warm".

To check Cypher, I took the exact text the app copies to the clipboard and ran each statement against `pz_acme_qix` with `GRAPH.RO_QUERY` (read-only, no writes), using the local dev credential the README documents. FalkorDB Browser (`:3000`) was not driven.

## 1. Verdict

A big step up from round 3 (8.7). Five of round 3's six blocking items are closed and verified: the built app's console is clean (CSP now ships `style-src` with three sha256 hashes; zero console errors or warnings across every flow, axe 0 violations in nine states), the Ask answer lands fully in view and no longer contradicts itself, "Show plan" opens in view at both viewport sizes, "Copy Cypher" now copies runnable statements with the `CYPHER name=value` parameter prefix (72 of 73 statements from "Copy all" ran as pasted), and the triage screen was re-laid out so verdict, graph and table sit in one viewport. Triage is effectively instant (first card 0.19 s, 49 tools in about 1 s, warm), paste takes 2.5 s, and every number I could check reconciles with `docs/proof-points.md` and with the oracle script.

What still holds it under 9: **README still has `https://<render-url>` and `https://<video-url>`**, and its Cypher blocks still carry no parameter values; a multi-statement "Copy Cypher" (and "Copy all") cannot be pasted as one query (FalkorDB: `Invalid input 'Y'`, line 4); **Ask labels a refusal "Answered from the graph"** ("which maintainer is the next qix and why?" returns "No language model is available right now", while the graph already answers it in the Concentration tab); **at 1280x720 the "Run again" button is clipped 15 px off the right edge** (new this round) and the WHY line still hides `[E1]`; and a few one-minute and docs-versus-app mismatches (00:22 exposed vs "since 00:21", 105 vs 106 min, "5,739 package names" vs 5,373 Package nodes, "58-60 claims" vs 61/62). Overall **8.9 / 10**.

## 2. Timed friction log

Cold judge, 1440x900, `:8080`. T+ is the scripted stopwatch from first paint (reading time not included). "Warm" = server had already memoized the demo graph queries.

| T+ | Step | What happened | SS |
|---|---|---|---|
| 0:00.3 | Land, no clicks | Header, tagline "See which repos are one install away from a hijacked npm package — before the advisory exists.", "Built on FalkorDB" pill, one primary CTA ("Run triage at 13:30 UTC") plus "Try axios 2026" and "Paste your repo". Hero "0 repos one install from malware"; MAINTAINER 21 reads "uses the account's packages, nothing malicious yet". Point lands in under 5 s. Console clean | `01-land-0_3s` |
| 0:03 | Autoplay | 21 repos, Scanner 0 / name grep 21 / Patient Zero 1 LOCKED + 20 WOULD_PULL with the hand-drawn arrow | `02-land-3s` |
| 0:10 | Still no click | Clock 14:15, graph drawn, **"74 min" not yet shown** (it appears at 11.8 s) | `03-land-10s` |
| 0:15 | Autoplay ends | "74 min before the OSV record existed" circled; "Play the 90 minutes"; CTA "Run triage at 13:30 UTC" while clock sits at 14:30 (label discloses the jump) | `04-land-15s` |
| 0:17 | Run triage | First tool card 0.19 s, 49 of 49 tools 0.2 s, "Triage complete" 1.0 s (warm). 75 queries, 545-580 ms in FalkorDB. Layout reflows to one screen: verdict left, graph centre, table right, first row (acme/checkout-web) auto-selected with its path drawn. No clock-jump toast, no contradictory banner (14 frames polled in the first 1.4 s). Badge flipped between runs: first run "LLM live, 61/61", later runs "LLM replay, 62/62" | `10a-triage-0_2s`, `10c-triage-3s`, `11-triage-vp` |
| 0:25 | Click `mochajs/mocha` row | qix > debug@4.4.2 > mocha > QA drawn at once, row highlighted; table "^4.3.5 -> debug@4.4.2 direct" | `20-row-mocha` |
| 0:35 | Open `incident_exposure` | Cypher is open on arrival, five labelled statements (`3/5 · INCIDENT · ADMITS + REQUIRES`), each prefixed `CYPHER incident="qix-2025-09-08" at=1757338200000`. The card column is 335 px, so statements wrap at about 28 characters per line | `40-card-incident-open` |
| 0:45 | Copy Cypher | Toast "Cypher copied". Clipboard: 1,823 chars, 5 statements separated by blank lines. Each statement, split out, **runs as pasted** (21, 2, 137, 1, 21 rows). All five pasted as one query fail: `Invalid input 'Y': expected CONTAINS, CREATE UNIQUE, CREATE or CALL line: 4` | `41-copy-cypher` |
| 0:55 | Show plan (3/5) | Plan appears at once at y 522-776, Ask footer at 821: fully visible. At 1280x720: 306-596 vs footer 641 | `43-plan-after-1_5s`, `160-vp1280-plan` |
| 1:10 | `[E1]` then (after "Show 2 more evidence paths...") `[E3]` | explain_path card scrolls to the top of the feed, exact path row outlined, graph selects the repo. Live region says "Opened explain_path, mochajs/mocha, the call that returned E3" | `30-click-E1`, `32-click-E3` |
| 1:20 | Name chip `github/docs` | incident_exposure opens, row outlined, table and graph select docs | `33-click-chip-docs` |
| 1:30 | "62 of 62 claims traced" | Claim-to-tool map. Final catch-all still reads "Checked against the run as a whole, no single tool call: 1 repo, 4 repos, @babel/core" | `34-claims-traced` |
| 1:45 | Ask "which exposures are prod-only and who owns them?" | 1.3 s. Answer card ("YOU ASKED" at y 170) fully visible above the pinned footer: "14 repos across 6 teams", "Answered from the graph", 22/22 claims, 1 tool (`filter_exposures`, 23 ms). No NOTIFY block under it. Table "Prod only" shows 14 of 21 | `181-ask-4500ms`, `22-prod-only` |
| 2:00 | Ask "which maintainer is the next qix and why?" | Header "Answered from the graph", body "No language model is available right now, so this question cannot be answered", footer "Unverified". The Concentration tab answers this exactly (sindresorhus 43 / ljharb 29 / types 29) | `183-ask-q3` |
| 2:10 | Try axios 2026 | Tab and table at 0.15 s, complete 1.1 s (warm). 10 of 21: LOCKED 1 / WOULD_PULL 9 / CLEAN 11, "+105 min", 48/48, "5 prod, 4 dev-only". Verdict "since 00:21 UTC" vs timeline "00:22 exposed" | `80-axios-0_3s`, `81-axios-done` |
| 2:30 | Paste `mochajs/mocha` | 2.7 s. "1 repo, mochajs/mocha, pasted repo, lockfile at commit 5f8e8a8 from 2025-09-01", WOULD_PULL 1, "+74 min", 30/30. Verdict now names "the qix account compromise" | `93-paste-done-mocha` |
| 2:50 | Paste `remy/nodemon` | 2.5 s. 20/20, lockfile at 533ad9c from 2023-12-01 (disclosed), `^4` admits debug@4.4.2. Concentration: sindresorhus 46 / isaacs 28 / gar 26 | `93-paste-done-nodemon`, `95-nodemon-concentration` |
| 3:10 | Graph stats | Pill opens a drawer at landing and a tab after triage: 46,810 nodes, 123,426 edges, per-label and per-type counts sum exactly; 75 queries, 564 ms | `50-stats-landing`, `51-stats-after-triage` |
| 3:30 | Fix and Notice drawers | Fix: package.json JSON with overrides, "Team QA (demo)". Notice: "demo team; draft only, nothing is sent" | `70-fix-drawer`, `71-notice-drawer` |
| 3:50 | Share link, fresh context | Copied link `?scenario=qix-2025-09-08&at=1757338200000&repo=mochajs/mocha`; fresh context auto-runs in 1.3 s, mocha selected and its path drawn. `&open=notice` opens the Notice drawer (footer says "A triage is running. Cancel run" for about 0.5 s, deliberate) | `100-share-click`, `102-share-fresh-done`, `101-share-open-notice-700ms` |
| 4:10 | README | Data model and Cypher sections match the live schema (14 edge types, 10 labels all present in Graph stats). Header still `https://<render-url>` and `https://<video-url>`; Cypher blocks are `$param` templates with no example values | (file) |
| 4:30 | 1280x720 | No horizontal scroll, CLS 0.022. **"Run again" clipped 15 px off the right edge**; "Built on FalkorDB" pill drops its ms figure; WHY clamped to 2 lines with `[E1]` hidden until "Show 2 more evidence paths, who to notify and the steps" | `152-vp1280-triage`, `153-vp1280-show-rest`, `154-vp1280-run-again-clipped` |

## 3. Round-3 items

Every item round 3 raised (its six blocking fixes, its polish list, and the carry-overs in its section 3).

| Item (round 3) | Status | Evidence |
|---|---|---|
| Fix 1: 4 CSP console errors on `:8080` | **Fixed** | Response header now `style-src 'self' 'sha256-jtRR...' 'sha256-9xjt...' 'sha256-47DE...'`. Zero console errors or warnings on landing, triage, row click, card, plan, Graph stats, Fix and Notice drawers, Ask, axios, alert text, two pastes, scrub, share links. Only `net::ERR_ABORTED` on fetches the app cancels itself. `:5173` also clean |
| Fix 2: Ask answer under the fold, contradicts itself (6 vs 7 teams) | **Fixed** | Answer in view with "YOU ASKED" at y 170; no NOTIFY block; "14 repos across 6 teams" equals the Prod-only table filter (14 of 21) and docs. `181-ask-4500ms`. New related defect: refusal labelled "Answered from the graph" (fix 3 below) |
| Fix 3: "Show plan" opens behind the Ask footer | **Fixed** | 1440x900: plan 522-776, footer 821. 1280x720: 306-596, footer 641. `43-plan-after-1_5s`, `160-vp1280-plan` |
| Fix 4: Copy Cypher not runnable (no params, epoch missing) | **Mostly fixed** | Statements carry `CYPHER incident="..." at=1757338200000`; epoch ms present. 72 of 73 statements from "All Cypher used > Copy all" ran as pasted. Residual: (a) multi-statement copies are blank-line separated, one paste fails with `Invalid input 'Y'`, no per-statement copy; (b) `recall_triage` omits `$session` (`Missing parameters`); (c) "Copy all" is 41,561 chars, 73 statements, 14 distinct bodies (21 explain_path and 21x2 draft_remediation repeat); (d) README Cypher still has no params or worked example |
| Fix 5: README placeholders `<render-url>`, `<video-url>` | **Not fixed** | README.md lines 5-6 |
| Fix 6: 1280x720 verdict clamp hides `[E#]` | **Partly** | Toggle now reads "Show 2 more evidence paths, who to notify and the steps" (names the evidence). WHY still clamped to 2 lines, `[E1]` hidden at 1280x720 until expanded. New: "Run again" clipped. `152-vp1280-triage` |
| Tier label wraps "WOULD_PU / LL" in card tables | **Fixed** | One line in the incident_exposure card table. `33-click-chip-docs` |
| Three Run triage buttons at landing | **Fixed** | One CTA; the empty states are plain text ("Run triage at 13:30 UTC above to fill it.") |
| Pasted-repo verdict never names the incident | **Fixed** | "exposed to the qix account compromise". `93-paste-done-mocha` |
| "1 repos" in route_owners | **Fixed** | "route_owners · 1 repo", "reaches 1 of 1 repo" |
| `types` listed as a maintainer | **Not fixed** | Concentration still lists `types` at 29%. `60-tab-Concentration` |
| "Cancel run" label peeks through the Notice drawer | **Fixed** | Now a deliberate footer line, "A triage is running. Cancel run", about 0.5 s. `101-share-open-notice-700ms` |
| Triage history time "GMT+5:30" in a UTC app | **Not fixed** | "latest 16 Oct, 03:46 GMT+5:30". `62-history` |
| "74 min" lands at 12 s, not 10 s | **Not fixed** | Appears at 11.8 s. `03-land-10s` |
| 430 ms contradictory banner after triage from autoplay end | **Fixed** | Not seen in 14 frames polled across the first 1.4 s; no toast either |
| Toast over Ask for 4.4 s after autoplay-end triage | **Fixed** | No toast in that flow (code toasts only when a person moved the scrubber) |
| Per-item synthetic tag (Notice, NOTIFY) | **Fixed** | "NOTIFY demo teams", Notice "demo team; draft only, nothing is sent", Fix "Team QA (demo)". `71-notice-drawer` |
| Axios timeline: "02:19 alert" sits after "02:07 OSV", unexplained | **Not fixed** | Markers read 02:07 OSV, 03:15 removed, 02:19 alert. New related nit: "00:22 exposed" vs verdict "since 00:21" (see section 4). `81-axios-done` |
| Docs drift (claims 58-60, analyst pick) | **Not fixed, slightly worse** | App shows 61/61 (LLM live) or 62/62 (LLM replay); `docs/proof-points.md` says 58 to 61. Analyst pick quoted in the docs (@babel/core) only matches the replay run |
| Round-2: P2-4 invented ownership read as verified | **Fixed** | See per-item tag row |
| Round-2: P3 triage from autoplay end jumps 14:30 to 13:30 | **Fixed** | CTA discloses "at 13:30 UTC"; no toast or banner flash |
| Round-2: plan opens off-screen | **Fixed** | See fix 3 |
| Round-2: axios cold 6 s, paste about 5 s | **Improved (warm only)** | Axios 1.1 s (warm), paste 2.5-2.7 s, first card 0.15-0.19 s. Cold boot not measurable |
| Round-2: CLS | **Held** | 0.004 landing, 0.015 after triage and row click at 1440x900; 0.022 at 1280x720 |
| Round-2: axe | **Held** | 0 violations in 9 states on `:8080`: landing running and done, after triage, card plus plan, Graph stats, Fix drawer, Notice tab, after Ask, paste sheet |

No regressions in round-3 behaviour. One new defect (Run again clipped at 1280x720, from the new top bar) and two new nits (Ask refusal label, minute rounding).

## 4. Correctness check against `docs/proof-points.md`

| Claim | On screen / measured | Result |
|---|---|---|
| qix 13:30: LOCKED 1 / WOULD_PULL 20 / CLEAN 0 | 1 / 20 / 0, 21 of 21 | Match |
| 13 prod of 20 | "13 prod, 7 dev-only"; oracle `prod=true` 13, `prod=false` 7 | Match |
| 74 min before the OSV record | hero, "+74 min", verdict, pasted repos | Match (14:26:51 - 13:12:10 = 74 min 40 s, floored) |
| axios 01:30: LOCKED 1 / WOULD_PULL 9 / CLEAN 11 | 1 / 9 / 11; "5 prod, 4 dev-only" (oracle: 5 true, 4 false) | Match |
| axios "+105 min" | 105 on screen; true gap 00:21:58.168 -> 02:07:58 is 105.99 min | Match to the floor; a reader subtracting the visible 00:21 from 02:07 gets 106 |
| uptime-kuma `~0.30.3` -> 0.30.4 | E2 "declares ~0.30.3, which admits axios@0.30.4" | Match |
| 4 repos declare a hijacked package directly | Oracle `direct:` lists github/docs, npm/cli, mochajs/mocha, remy/nodemon; analyst pick (live) "4 repos ... github/docs, mochajs/mocha, npm/cli and 1 more" | Match |
| Graph 46,810 nodes / 123,426 edges | Graph stats drawer; node labels sum to 46,810, edge types sum to 123,426 | Match |
| 49 tool calls | "Triage complete: 49 tools" | Match (75 queries is a different, stated unit) |
| Ask prod-only: 14 repos across 6 teams | Same, plus Prod-only filter shows 14 of 21 | Match |
| Top maintainers sindresorhus, ljharb, types | 43 / 29 / 29 | Match |
| Scanner view 0 hits | "OSV advisories 0" at both clocks | Match |
| "58-60 of 58-60 claims traced" (now "58 to 61") | 61/61 live, 62/62 replay | **Docs drift** |
| Analyst pick "@babel/core" | Replay run only; live run picks the "own package.json" observation | **Docs drift** (pick varies, doc says it does not) |
| "5,739 package names" | Graph stats: 5,373 Package nodes (qix graph), 5,490 (axios graph), 5,802 union | **Docs mismatch**: no graph holds 5,739 |
| README "pz_guest_* ... LRU 4, TTL 1 h" | `GRAPH.LIST` shows 16 `pz_guest_*` graphs after my pastes (orphans from earlier server processes are never reaped at boot) | **Claim not verifiable as stated** (in-process LRU only) |

Contradictions on screen: (1) axios timeline "00:22 exposed" against verdict "since 00:21 UTC" (00:21:58 rounded up in one place, truncated in the other); (2) Ask refusal under an "Answered from the graph" header. Nothing else contradicts.

## 5. Scores

| Dimension | Score | One-line justification |
|---|---|---|
| Clarity | 8.7 | Point in 5 s, one CTA, whole triage in one viewport, plan and answers in view. Docked by the Run again clip and `[E1]` hidden at 1280x720, 335 px Cypher column, truncated path column, Ask refusal mislabelled, "74 min" at 12 s |
| Speed | 9.5 | First card 0.19 s, 49 tools in about 1 s, paste 2.5 s, CLS 0.004-0.022. Warm only; cold boot not measured |
| Correctness | 8.8 | Every doc number reconciles with the oracle and graph. Minus: 00:22 vs 00:21 and 105 vs 106, "5,739 package names", 58-61 claims vs 62, 16 guest graphs vs "LRU 4" |
| Trust | 8.6 | CSP clean, Cypher runnable per statement, demo tags travel with the claim, LLM mode labelled. Minus: README placeholders and no README params, multi-statement copy fails as one paste, refusal labelled "Answered from the graph", catch-all claim row |
| Delight | 9.0 | Instant cards, drawn paths, circled 74 min, one-click proof, working share link. Minus: clipped Run again, wrapped Cypher, the 12 s reveal |
| Accessibility | 9.2 | axe 0 violations in 9 states on the CSP build, visible focus including the slider, live-region announcements for chip and row actions. Minus: contrast cannot be proven for the small label text (axe "incomplete" 21-114 nodes in card and stats states) |

Overall **8.9**. Bar of 9 is met on Speed, Delight and Accessibility; Clarity, Correctness and Trust are 0.2-0.4 short.

## 6. Ranked fixes to reach >= 9

1. **blocking-9 (trust, submission). README placeholders and runnable Cypher.**
   - Repro: open `README.md`.
   - Saw: line 5 `https://<render-url>`, line 6 `https://<video-url>`; "Every Cypher query" blocks use `$maintainer`, `$since`, `$at` with no values, yet "Run it locally" says "run the queries above yourself". A raw README `SUSPECT_VERSIONS` returns `Missing parameters`.
   - Expected: real URLs; one worked example above the Cypher section (`CYPHER maintainer="qix" since=1757336400000 until=1757338200000 MATCH ...`), and a sentence pointing at the app's Copy Cypher.
   - Suspect: `README.md`, `scripts/gen-readme-cypher.ts` (add an example header).
2. **blocking-9 (trust: "it must run"). Multi-statement Copy cannot be pasted as one query.**
   - Repro: Run triage, open `incident_exposure`, "Copy Cypher" (5 statements) or "All Cypher used > Copy all" (73), paste into one FalkorDB query.
   - Saw: statements joined by blank lines; whole paste fails `Invalid input 'Y': expected CONTAINS, CREATE UNIQUE, CREATE or CALL line: 4`. No per-statement copy. `recall_triage` copy lacks `$session` (`Missing parameters`). "Copy all" is 41,561 chars with 14 distinct bodies.
   - Expected: a copy button on each statement (or `;` terminators plus a comment line "run one at a time"); de-duplicate Copy all to one example per distinct query; state the `$session` value is omitted on purpose, or drop `recall_triage` from the copy.
   - Suspect: `web/src/components/ToolCard.tsx` (copy builder near line 340, button near 473), `web/src/components/InsightTabs.tsx` ("All Cypher used").
3. **blocking-9 (correctness, trust). Ask labels a refusal "Answered from the graph".**
   - Repro: after triage, Ask "which maintainer is the next qix and why?".
   - Saw: header "Answered from the graph", body "No language model is available right now, so this question cannot be answered", footer "Unverified". The graph already answers it (`concentration_risk`, Concentration tab: sindresorhus 43%). Header badge at that time: "LLM replay".
   - Expected: route "next qix / who could be compromised next / maintainer concentration" to `concentration_risk` in the deterministic ask router; and when no model is available show "Could not answer" instead of the graph label.
   - Suspect: `server/agent/ask.ts` (router; refusal text at line 253), `web/src/data/narration.ts` line 132 (`answerLabel`).
4. **blocking-9 (clarity at 1280x720). "Run again" clipped; `[E1]` hidden.**
   - Repro: 1280x720, Run triage; also 1366x768 is fine (right edge 1342 of 1366).
   - Saw: "Run again" button right edge 1295 of 1280 (`Run agai`), clipped by the app root's `overflow: clip`; the "Built on FalkorDB" pill drops its ms figure; WHY is `line-clamp-2` with `[E1]` hidden behind the clamp (`152-vp1280-triage`).
   - Expected: the top bar fits 1280 (shrink the scrubber's gap or stack the labels), and the WHY clamp keeps the `[E#]` chips visible or the toggle stays as is.
   - Suspect: `web/src/components/TimelineScrubber.tsx` (bar width and Run again), `web/src/components/NarrativePanel.tsx` lines 255-260 (`Why` clamp).
5. **nice-to-have, near-blocking (correctness). One-minute mismatches on one screen.**
   - Repro: Try axios 2026.
   - Saw: timeline "00:22 exposed", verdict "since 00:21 UTC"; "+105 min" while 02:07:58 - 00:21:58 is exactly 106:00 when read from the visible 00:21. Marker order "02:07 OSV, 03:15 removed, 02:19 alert" is still unexplained.
   - Expected: use the same rounding for the marker and the verdict (floor both: "00:21"), say "105 min" with the same floor everywhere or show seconds in the tooltip; tooltip the 02:07 OSV marker "plain-crypto-js, the dropped dependency".
   - Suspect: `web/src/data/markers.ts` (rounding), `server/agent/narrate.ts` lines 301-321, `server/tools/registry.ts` line 44 (`minutesAhead` floor).
6. **nice-to-have (correctness, docs). `docs/proof-points.md` drift.**
   - Saw: "58 to 61 claims" (app shows 61 live, 62 replay); "5,739 package names" (graph: 5,373 qix, 5,490 axios, 5,802 union); analyst pick quoted as `@babel/core` (replay only). README says guests are "LRU 4" while `GRAPH.LIST` shows 16 `pz_guest_*` graphs (orphans from earlier server processes never reaped).
   - Expected: quote ranges ("about 60"), the right Package count, "the pick varies between live and replay"; reap `pz_guest_*` graphs at boot or say "per process".
   - Suspect: `docs/proof-points.md` line 29 and the claims line; `server/ingest/guest.ts` (boot reaper).
7. **nice-to-have (clarity). Cypher and path readability.**
   - Saw: the feed column is 335 px, so Cypher wraps at about 28 characters per line (`40-card-incident-open`); table paths truncate scoped names ("@typescr... pars... @8.30.1").
   - Expected: a "Open Cypher wide" action (the All Cypher used tab is wide enough) and a title/tooltip with the full path.
   - Suspect: `web/src/components/ToolCard.tsx`, `web/src/components/ExposureTable.tsx`.
8. **nice-to-have (polish). Carry-overs.**
   - `types` listed as a maintainer in Concentration (29%, `60-tab-Concentration`).
   - Triage history time shows "GMT+5:30" in a UTC app (`web/src/data/clock.ts`, `timeZoneName: 'short'` with browser locale; use `timeZone: 'UTC'`).
   - "74 min" appears at 11.8 s, not 10 s (`03-land-10s`).
   - Claim map still ends with a catch-all "Checked against the run as a whole ... 1 repo, 4 repos, @babel/core".
   - LLM badge flips "live" to "replay" between consecutive runs and the pick and claim count change (61 vs 62); label why ("rate limited, using the recorded pick") if it is a fallback.

## 7. Console and measurements

- **`:8080` (CSP build)**: 0 console errors or warnings and 0 page errors across landing, autoplay, triage (qix and axios), row and chip clicks, card open, Show plan, Copy Cypher, Graph stats pill and tabs, Fix and Notice drawers, Ask (4 questions), alert text, two pastes, scrub, share links in two fresh contexts, at 1440x900 and 1280x720. Only `net::ERR_ABORTED` on `/api/triage`, `/api/analyze`, `/api/ask`, `/api/exposure` when the app cancels its own request or the page closes (not console errors).
- **`:5173`**: clean (landing, triage, card, plan, Graph stats).
- **axe-core** (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice): 0 violations in 9 states on `:8080`.
- **CLS**: 1440x900 0.004 / 0.015 / 0.015 (landing / after triage / after row); 1280x720 0.017 / 0.022 / 0.022.
- **Keyboard**: skip links first in tab order, visible 2 px outline on every control, slider thumb ring visible, tab wraps cleanly at the end of the landing.
- **Not tested**: cold-boot timing, phone widths, Firefox and WebKit, FalkorDB Browser (`:3000`), a live LLM answer to open-ended Ask (the model was in replay mode for most of the pass).
