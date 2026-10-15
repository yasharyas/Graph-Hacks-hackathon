# Patient Zero: FalkorDB judge pass, round 3

Headless Chromium via Playwright. 1440x900 primary, 1280x720 second pass. Dev app `:5173` (proxy to API), built app `:8080`. No server touched, no repo file edited. Screenshots (`SS/`): `qa/reports/phase3r3-judge/`.

## 1. Verdict

Round 2's trust nicks are mostly closed. Proof now sits one click from every claim, and the pre-triage landing finally defines its own terms. The first card arrives in 0.25 s, the whole 49-call triage finishes in 1.3 s warm, and CLS is 0.007 at 1440. A tagline, the "Built on FalkorDB" pill, and a landing Graph stats drawer (46,810 nodes, 123,426 edges, per-label and per-type counts that match `docs/proof-points.md` and sum exactly) show the graph is load-bearing. The axios minutes now reconcile on screen (00:22 exposed to 02:07 OSV is 105). Triage history is readable, the LLM's role is stated on screen, and axe finds 0 violations in five states. What keeps it under 9: **4 CSP console errors on the built app (:8080) at landing**, an **Ask answer that lands under the fold and contradicts itself (6 teams vs a 7-team NOTIFY block)**, a **"Show plan" result that still opens behind the Ask footer**, **"Copy Cypher" that is not runnable (no params)**, a **1280x720 layout that clamps the verdict and hides the `[E#]` chips**, and `<render-url>` / `<video-url>` placeholders in the README. Overall **8.7 / 10**.

## 2. Timed friction log

Cold judge, 1440x900, stopwatch from first paint. "Warm" means the server had already memoized the demo graph queries.

| T+ | Step | What happened | SS |
|---|---|---|---|
| 0:00 | Land, no clicks | Header, tagline "See which repos are one install away from a hijacked npm package — before the advisory exists.", FalkorDB pill, 3 CTAs all in first paint. Hero "0 repos" beside MAINTAINER 21 now reads "uses the account's packages, nothing malicious yet"; tier "?" legend and "OSV records published" are present pre-triage | `01-land-0_3s` |
| 0:03 | Autoplay | 20 repos by 2.2 s, 21 by 3 s, Scanner 0 / grep 21 / Patient Zero 1+20 contrast with an arrow | `02-land-3s` |
| 0:10 | Still no click | Clock at 14:14, graph drawn, **"74 min" not yet shown** (appears at 12.1 s, playhead 14:27; round 2 had it by ~10 s) | `03-land-10s` |
| 0:15 | Autoplay ends | "74 min before the OSV record existed" circled; "Play the 90 minutes" replaces Pause; CTA reads "Run triage at 13:30 UTC" (clock sits at 14:30, label discloses the jump) | `04-land-15s` |
| 0:20 | Run triage | First card 245 ms, complete 1.33 s, 49 tools, 75 queries, 569 ms in FalkorDB, "61/61 claims traced", "LLM live". For 430 ms a banner flashes "Showing exposure at 13:30 UTC ... triage run at 13:30 UTC" with "Run triage at 14:30 UTC" | `10-triage-first`, `11-triage-done` |
| 0:30 | Click row (mocha) | Path qix > debug@4.4.2 > mocha > QA drawn in 0.8-1.2 s; row highlighted | `20-row-mocha` |
| 0:40 | Tier "?" | Real popover with LOCKED / WOULD_PULL / MAINTAINER definitions (round 2: did not exist) | `21-tier-help` |
| 0:50 | Open `incident_exposure` | Cypher is **already expanded** on open (clicking "Cypher (5 queries)" collapses it), per-statement labels `3/5 · INCIDENT · ADMITS + REQUIRES`, column is about 350 px so statements wrap to 15-20 lines | `40a-card-open`, `40b-cypher-open` |
| 1:05 | "Show plan" (3/5) | Fetch about 0.2 s. Result opens **behind the pinned Ask footer**: only the heading "GRAPH.EXPLAIN · 3/5" is visible (y 759, footer at 788); the 7 plan lines (`... Node By Index Scan (@anon_0:Incident)`) need a manual scroll | `43-plan-after-1s`, `44-plan-after-manual-scroll` |
| 1:25 | `[E3]` | One click: explain_path card opens, Cypher open, exact row outlined; graph selects mocha | `30-click-E3` |
| 1:35 | Name chip `github/docs` | incident_exposure opens, row outlined, graph and table select docs | `31-click-chip-docs` |
| 1:45 | "61 of 61 claims traced" | Claim-to-tool map; "Checked against the run as a whole" is still a catch-all for "1 repo, 4 repos" | `33-traced-summary` |
| 1:55 | Pill click | Graph stats tab scrolls into view: 46,810 nodes, 123,426 edges, 75 queries, 566.6 ms in FalkorDB, run total 1620 ms, per-query ms | `51-graph-stats` |
| 2:05 | Try axios 2026 | Scenario switches, table fills at 300 ms; first card 0.7 s; done 6.1 s cold (1.8 s warm); 10 of 21, "+105 min", 45/45 | `80-axios-300ms`, `81-axios-done` |
| 2:30 | Paste mochajs/mocha | 5.1 s; hero "1 repo, pasted repo", WOULD_PULL 1, "+74 min", 33/33 | `92-mocha-done` |
| 2:50 | Paste remy/nodemon | 5.1 s; 23/23; direct `^4` admits debug@4.4.2. Concentration for the pasted graph shows sindresorhus 46 / isaacs 28 / gar 26 | `92-nodemon-done` |
| 3:10 | Ask "which exposures are prod-only and who owns them?" | Answer "14 repos across 6 teams" (matches docs) **cut off under the Ask footer**; scroll to read it; an unfiltered NOTIFY block under it lists 7 teams and 21 repos | `182-ask-4500`, `183-ask-scrolled` |
| 3:30 | Share link | App's "Copy share link" gives `?scenario&at&repo`; fresh context restores, re-runs, selects the repo. Spec URL with `open=notice` opens the Notice drawer; a "Cancel run" label peeks out at the drawer bottom while the run is still finishing | `100-share-click`, `101-share-spec-3000ms` |
| 3:50 | README | Data model and Cypher sections read well and match the live schema. Header still has `https://<render-url>` and `https://<video-url>`. Cypher blocks use `$params` with no example values | (file) |
| 4:10 | Scrub | 13:00 0 repos, 13:08 0, 13:15 21, 15:45 1 repo; button always says the scrubbed clock ("Run triage at 15:45 UTC"); after a triage a banner says paths belong to the run clock | `110-scrub-home`, `112-scrub-end`, `172-scrub-away-after-triage` |
| 4:30 | 1280x720 | No horizontal scroll, CLS 0.037. Verdict clamped to 4 lines, WHY to 1 line (`[E1]` hidden), analyst pick to 2 lines, until "Show the rest: who to notify and the steps" | `152-vp1280-triage`, `157-vp1280-show-rest` |

## 3. Round-2 items

| Item | Status | Evidence |
|---|---|---|
| P2-1 axios minutes depend on an unstated anchor (128 vs 105) | **Fixed** | Timeline now reads "00:22 exposed ... 02:07 OSV", which is 105 min, matching panel and narrative. SS `81-axios-done`. Residue: the "02:19 alert" marker sits after the "02:07 OSV" marker and nothing says the 02:07 record is for the dropped dependency (see fix 9) |
| P2-2 Triage history unreadable (21 identical rows) | **Fixed** | One summary per earlier run, "21 repos · latest 16 Oct, 01:54 GMT+5:30 / LOCKED 1 · WOULD_PULL 20"; marks list repo and time. SS `62-history`, `181-marked`. Timestamp is browser-local "GMT+5:30" in a UTC-everywhere app |
| P2-3 LLM method hover-only | **Fixed** | On-screen: "Verdict from the graph · analyst pick by the LLM", "ANALYST PICK (LLM): The model chose this; the words come from the graph.", header badge "LLM live". SS `11-triage-done`. Claim map still has the "run as a whole" catch-all |
| P2-4 Invented ownership reads as verified | **Partly** | "Acme demo org · 21 repos · teams synthetic" in the hero, landing says "teams and channels are synthetic", "sample repo" tag. Notice drawer ("For QA in #team-qa (draft only...)") and NOTIFY paragraph carry no per-item tag. SS `70-notice`, `34-show-rest` |
| P2-5 Definitions and proof thin before triage | **Fixed** | Tier "?" popover and inline MAINTAINER/OSV definitions at landing; pill opens a Graph stats drawer pre-triage with node and edge counts per label and type; node and edge sums verified (46,810 / 123,426). SS `160-pill-at-landing-0_3s`, `21-tier-help` |
| P3 failed alert after axios alert leaves stale "at 02:00 UTC" | **Fixed** | After axios alert then gibberish, top "at" chip is removed, hero reads "no result: the triage did not run", axios timeline stays axios. SS `141-alert-gibberish-after-axios` |
| P3 triage from autoplay end jumps 14:30 to 13:30 | **Partly** | CTA now says "Run triage at 13:30 UTC" and a toast explains, but the jump still happens, the toast stays 4.4 s over the Ask field, and a contradictory banner flashes for 430 ms. SS `10-triage-first`, `11-triage-done` |
| P3 tier label wraps "WOULD_PU / LL" in card tables | **Not fixed** | Still wraps in the incident_exposure card table. SS `40b-cypher-open`, `31-click-chip-docs` |
| P3 filter placeholder truncates at 1280 | **Fixed** | "Repo or team" fits (scrollWidth 191 vs 190). SS `152-vp1280-triage` |
| P3 pasted-repo narrative never names the incident | **Not fixed** | Verdict says "since 13:12 UTC on 2025-09-08" and "74 minutes", never "qix". Same for analyst pick. SS `92-nodemon-done` |
| P3 "1 repos" in route_owners | **Not fixed** | "route_owners · 1 repos", "Your team #your-team 1 repos", "reaches 1 of 1 repos" |
| P3 `types` listed as a maintainer | **Not fixed** | Concentration still lists `types` at 29% beside sindresorhus and ljharb. SS `60-tab-Concentration` |
| P3 three Run triage buttons at landing | **Not fixed** | Hero CTA, feed empty state, table empty state. SS `01-land-0_3s` |
| P3 chip help is title-only | **Fixed** | Chips keep `title` and now carry `aria-describedby`; claim sentence "Verified names and evidence ids open the tool call and query that returned them" is on screen; tier help is a real popover |
| Round-2 "Plan opens off-screen" (Delight) | **Not fixed** | Same behaviour: plan body renders behind the Ask footer. SS `43-plan-after-1s` |
| Round-2 speed: axios cold 6-7 s, paste about 6 s | **Partly** | Axios 6.1 s cold, 1.8 s warm; paste 5.1 s; first card 0.25-0.7 s; qix 1.3 s |
| Round-2 CLS | **Fixed** | 0.007 at 1440x900 and 0.037 at 1280x720 over landing, triage and row click |
| Round-2 axe | **Fixed (held)** | 0 violations: landing, post-triage, card plus plan, Graph stats, Fix drawer |

No regressions found.

## 4. Correctness check against `docs/proof-points.md`

| Claim | On screen | Result |
|---|---|---|
| qix 13:30: LOCKED 1 / WOULD_PULL 20 | 1 / 20, 21 of 21 | Match |
| 13 prod of 20 | "13 prod, 7 dev-only" | Match |
| 74 minutes before the OSV record | hero 74 min; "+74 min"; verdict "74 minutes" | Match, same at 13:30, 14:31 and pasted repos |
| axios 01:30: LOCKED 1 / WOULD_PULL 9 / CLEAN 11, 105 min | 1 / 9 / 11, "+105 min", "5 prod, 4 dev-only" | Match |
| uptime-kuma `~0.30.3` resolves to 0.30.4 | E2 "declares ~0.30.3, which admits axios@0.30.4" | Match |
| 4 repos declare a hijacked package directly | analyst pick "4 repos ... github/docs, mochajs/mocha, npm/cli and 1 more"; table shows `direct` rows | Match |
| Graph size 46,810 nodes / 123,426 edges | Graph stats drawer | Match; per-label and per-type sums add up exactly |
| 49 tool calls | "Triage complete: 49 tools" | Match |
| Ask prod-only: 14 repos across 6 teams | "14 repos across 6 teams" | Match, but see defect: NOTIFY block under it lists 7 teams |
| "58-60 of 58-60 claims traced" | 61/61 on every qix run | **Docs drift** |
| Analyst pick "4 repos ... through @babel/core" | analyst pick is now the "own package.json" observation | **Docs drift** (the pick varies by run) |
| Top maintainers sindresorhus, ljharb, types | 43% / 29% / 29% | Match |

Contradictions found on screen: (1) the Ask answer's "14 repos across 6 teams" against the NOTIFY block right below it ("7 teams", 21 repos with dev-only entries); (2) the transient 430 ms banner stating exposure and run are at the same clock while offering "Back to" and "Run triage at 14:30 UTC". Nothing else contradicts.

## 5. Scores

| Dimension | Score | Why not 9 |
|---|---|---|
| Clarity | 8.5 | Point lands in 5 s and terms are defined. Ask answer below the fold, plan behind the footer, 1280x720 verdict clamp hides `[E#]`, three Run triage buttons, alert after OSV on axios unexplained |
| Speed | 9 | First card 0.25 s, qix done 1.3 s, CLS 0.007, paste 5 s. Axios cold 6 s is streamed, not blank |
| Correctness | 8.5 | Every doc number reconciles. Ask answer contradicts itself (6 vs 7 teams), banner flash, docs drift on claim count and analyst pick |
| Trust | 8.5 | One-click proof, counts verified, disclosure present. Four CSP console errors on the build the judge will open, Copy Cypher not runnable, README placeholders, per-notice synthetic tag missing |
| Delight | 8.5 | Instant cards, drawn paths, circled 74 min, working share link. Plan hidden, tier label wraps, toast sits over Ask for 4.4 s, 74 min arrives at 12 s |
| Accessibility | 9 | axe 0 in five states, visible focus rings, slider `aria-valuetext` ("13:15 UTC, 21 repos exposed"), `aria-describedby` on chips. Graph labels at 11.7 px, "Cancel run" label peeks through the drawer |

Overall **8.7**.

## 6. Ranked fixes to reach >= 9

1. **blocking-9 (trust, correctness). Console errors on the built app.**
   - Repro: open `http://localhost:8080` with DevTools, wait 3 s.
   - Saw: 4 errors "Applying inline style violates the following Content Security Policy directive 'default-src 'self''", all from `assets/PathGraphCanvas-*.js`. The `force-graph` library injects `<style>` text (`.float-tooltip-kap`, `.force-graph-container`); server CSP is `default-src 'self'; img-src 'self' data:; connect-src 'self'; ...` with no `style-src`. Visually harmless, but this is the build the judge opens and red errors read as unfinished. `:5173` (Vite) does not send the CSP, so every earlier round saw it clean.
   - Expected: no console errors beyond the deliberate 400.
   - Suspect: server CSP header (add `style-src 'self' 'sha256-...'` for the two injected sheets) or `web/src/components/PathGraphCanvas.tsx` (ship the library CSS in the bundle).
2. **blocking-9 (correctness, clarity). Ask answer under the fold and self-contradicting.**
   - Repro: Run triage, Ask "which exposures are prod-only and who owns them?".
   - Saw: feed settles at scrollTop 1155 of 2624; the answer's first line "Complete list (prod only): 14 repos across 6" is clipped by the pinned Ask footer. Scrolling down shows a NOTIFY block under the answer listing 7 teams and 21 repos including `mozilla/pdf.js (dev)`, `jquery/jquery (dev)`, and the Web team, none of which are in the prod-only set.
   - Expected: scroll so the answer is fully visible; NOTIFY filtered to the answer set or dropped for filtered asks.
   - Suspect: ToolFeed follow-up scroll logic (`web/src/components/ToolFeed.tsx`) and the server-built answer's `notify` field.
3. **blocking-9 (clarity, FalkorDB proof). "Show plan" result opens behind the Ask footer.**
   - Repro: open `incident_exposure`, click "Show plan" on 3/5.
   - Saw: heading "GRAPH.EXPLAIN · 3/5" at y 759, footer top at y 788, plan body hidden. Also true in round 2.
   - Expected: after fetch, scroll the plan into view (or give the feed bottom padding equal to the Ask footer height).
   - Suspect: `ToolFeed.tsx` query/plan block; sticky `#ask` footer needs `scroll-padding-bottom`.
4. **blocking-9 (trust: "it must run"). Cypher is readable but not runnable.**
   - Repro: open `incident_exposure`, "Copy Cypher" (or "All Cypher used", "Copy all"); also README "Every Cypher query".
   - Saw: statements with `$incident`, `$at`, `$maintainer`; no values. The card shows `at=13:30 UTC`, not the epoch ms the query needs (1757338200000). Pasting into FalkorDB Browser (README: "run the queries above yourself") fails on missing parameters. All Cypher used is 32,954 chars because explain_path and draft_remediation repeat.
   - Expected: copy output prefixed with `CYPHER incident="qix-2025-09-08" at=1757338200000 ...`, de-duplicated; README gets one worked example.
   - Suspect: Copy handlers in `ToolFeed.tsx`; `scripts/gen-readme-cypher.ts`.
5. **blocking-9 (trust, submission). README placeholders.**
   - Repro: open `README.md` lines 5-6.
   - Saw: "`https://<render-url>`" and "`https://<video-url>`".
   - Expected: real URLs before submitting. Not a product bug, but it is the first thing a judge reads.
6. **blocking-9 (clarity at 1280x720). Verdict clamp hides the evidence chips.**
   - Repro: 1280x720, Run triage, read the left feed.
   - Saw: verdict line-clamped to 4 lines, WHY to 1 line ("acme/checkout-web locks..."), so `[E1]`-`[E3]` and the analyst-pick names are hidden; only "Show the rest: who to notify and the steps" un-clamps, and its label doesn't say it reveals the evidence. Narrative `p` has `line-clamp-4` / `1` / `2` under a `min-height` media query.
   - Expected: keep the WHY line unclamped (it is the verified-claim step) or rename the toggle "Show full verdict, evidence, notify and steps".
   - Suspect: the Narrative component's `lg:[@media(min-height:...)]:line-clamp-*` classes.
7. **nice-to-have. Smaller polish (round 2 carry-overs and new).**
   - Tier label wraps "WOULD_PU / LL" in card tables (`40b-cypher-open`).
   - Three Run triage buttons at landing.
   - Pasted-repo verdict never names qix.
   - "1 repos" in route_owners (grammar).
   - `types` listed as a maintainer.
   - "Cancel run" label peeks through the Notice drawer on a shared link while the run is still going (`101-share-spec-3000ms`).
   - Triage history time shows "GMT+5:30" in a UTC app.
   - "74 min" lands at 12 s, not 10 s.
   - A 430 ms contradictory banner flashes after a triage started from the autoplay end (`10-triage-first`).
   - The "Scrubber moved ..." toast sits over the Ask field for 4.4 s.
8. **nice-to-have. Per-item synthetic tag.** Add "demo ownership" to the Notice drawer ("For QA in #team-qa (demo team, draft only)") and the NOTIFY label so the disclosure travels with the claim, not just the hero.
9. **nice-to-have. Axios timeline wording.** Label the "02:07 OSV" marker "(plain-crypto-js, the dropped dependency)" or tooltip it, and explain why "02:19 alert" follows it, since the +105 min only holds against that first campaign record, as `docs/proof-points.md` itself warns.
10. **nice-to-have. Docs drift.** `docs/proof-points.md` says "58-60 of 58-60 claims traced" and quotes an `@babel/core` analyst pick; the app shows 61/61 and a different pick (the pick varies by run). Quote a range, say the pick varies.

## 7. Console

- **`:5173` (dev, all flows)**: 0 console errors or warnings across landing, qix triage, axios triage, two pastes, drawers, tabs, scrub, share links, Ask, alerts. Expected 1 `400` on `/api/triage` for the gibberish alert "asdf lorem ipsum" (shown with a hint "The alert names no known incident, account or package"). `net::ERR_ABORTED` on `/api/timeline` and on in-flight `/api/triage` or `/api/exposure` when the page or scenario changes is the app cancelling its own request, not a console error.
- **`:8080` (built, CSP)**: **4 console errors on landing** (CSP inline style, `PathGraphCanvas-DZ6i2Yxl.js`, lines 5 and 18). Clean after landing through triage, row click, Graph stats, axios and a paste. See fix 1.
- 0 uncaught page errors anywhere.
