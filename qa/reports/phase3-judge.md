# Patient Zero: FalkorDB hackathon judge pass (phase 3)

Tester persona: FalkorDB-team judge. Allergic to fluff and to graphs used as decoration.
Target: http://localhost:5173/ (Vite dev build proxying to a real API and real FalkorDB graphs).
Method: headless Chromium via the playwright-skill, 1440x900 (plus 1366x768, 1920x1080, 768x1024, 375x812 spot checks). axe-core 4.x was injected from the repo's own node_modules (read-only). No repository file was edited, no server was started or stopped.
Screenshot folder: `C:\Users\Yash Arya\OneDrive\Documents\genric\patient-zero\qa\reports\phase3-judge\` (referred to below as `SS/`).

## Verdict in one paragraph

FalkorDB is load-bearing here, not decoration. Every number on screen comes from a Cypher query you can read, time-travel is implemented as temporal `ADMITS {fromT,toT}` edges, remediation uses `shortestPath`, concentration uses a PageRank written by `algo.pageRank`, all tool reads go through `GRAPH.RO_QUERY`, and the UI can show `GRAPH.EXPLAIN` plus per-query milliseconds. The product story ("scanner sees 0, graph sees 21, 74 minutes before the OSV record") lands in about 10 seconds. What stops it from feeling airtight is a handful of on-screen numbers that disagree with each other, and the fact that the "claims traced to a graph query" promise is not clickable: the badge is static text, and the verified chips only highlight a path in the graph. I would score it a strong 8 overall today and a 9+ after the five fixes at the end.

## Timed friction log

Times are judge-clock (T+mm:ss) from first paint. Measured machine timings are in brackets.

| T+ | What I did | What I expected | What happened | Evidence |
|---|---|---|---|---|
| 0:00 | Opened `/` | A landing page that says what this is | No landing copy. Straight into a dashboard that autoplays an incident (clock runs 13:00 to 14:xx). A 0.8 s skeleton flash, then content [DOMContentLoaded 0.5 to 0.7 s on the dev server] | `SS/01-land-0s.png` |
| 0:03 | Watched the autoplay | To work out the product | Graph builds (qix fans into 21 repos), counters tick up to "21 repos one install from malware". Hand-drawn circle "74 min before the OSV record existed". The three-row comparison "ADVISORY SCANNER 0 / NAME GREP 21 repos, no path, no owner / PATIENT ZERO 1 LOCKED 20 WOULD_PULL, paths + owners" is genuinely clear | `SS/02-land-3s.png`, `SS/03-land-10s.png` |
| 0:10 | Asked "what do I understand?" | Product + tech | Understood: a supply-chain triage that beats name-grep and advisory scanners on time and precision. Did NOT understand: what the tool is called doing, that it is FalkorDB, or what MAINTAINER / LOCKED / WOULD_PULL / OSV mean. "FalkorDB" appears only in 12 px empty-state copy ("its FalkorDB time") | `SS/01-land-0s.png` |
| 0:20 | Noticed "MAINTAINER 21" at 13:00 while headline says 0 | An explanation of the third tier | None anywhere in the UI. Only WOULD_PULL is defined (footer). I worked it out later by scrubbing: MAINTAINER = repo depends on the compromised maintainer's packages but is not currently fetching a bad version | `SS/110-scrub-1300.png` |
| 0:30 | Clicked Run triage (qix) | Streaming agent work | First tool card at 0.35 to 1.5 s, "Triage complete: 17 tools" at 1.5 to 3.5 s, narrative and tables 70 ms later. Fast. Header: "206 ms total, 27 queries" | `SS/10-triage-0_5s.png`, `SS/10-triage-12s.png` |
| 0:45 | Read the narrative | Claims I can check | "Verdict / Notify / Do" with green "(verified)" chips, "[E1]..[E5]" tags, and "21 of 21 claims traced to a graph query". Honest "LLM live / template / replay" badge in the header (I saw all three) | `SS/10-triage-12s.png`, `SS/130-share.png`, `SS/51-falkordb-ts-10s.png` |
| 1:00 | Tried to find the Cypher behind "Notify: Payments (verified)" | Click the claim, land on the query | Chip tooltip says "Verified against a graph query. Click to highlight its path." Clicking only highlights a path in the graph (and does nothing for team chips). [E1]..[E5] likewise. The "21/21 traced" badge and "21 of 21 claims traced" line are plain text. I had to guess that `route_owners` was the card, scroll a 12,000 px feed, and click "Cypher". The onboarding strip does say "Click Cypher on a tool card" | `SS/20b-chip-click-github-docs.png`, `SS/160-E3-click.png`, `SS/170-traced-badge-click.png` |
| 1:20 | Opened Cypher on `suspect_versions` | Readable query | Real Cypher, parameterised, nice. But the code block is clipped at the card edge (`WHERE v.publishedAt >= $since AND v.pub`, `RETURN ... AS packa`) with no wrap; horizontal scroll needed | `SS/22-cypher-open-first-card.png` |
| 1:30 | Clicked "Show plan" on a card | `GRAPH.EXPLAIN` | Plan renders (Results > Limit > Sort > Project > Filter > Conditional Traverse > Node By Label Scan) but is clipped to the first half of each line at 1440 wide (`pre` scrollWidth 587 vs clientWidth 309). The operators that prove index/label scans are exactly the part hidden. On the 5-query `incident_exposure` card the plan covers only one of the five queries and does not say which | `SS/27-plan-visible.png`, `SS/24-show-plan-card2.png` |
| 1:50 | Cross-checked numbers | 21 = 1 + 20, 74 min, tool counts | 21 = 1 LOCKED + 20 WOULD_PULL (ok). 74 min = 14:26 - 13:12 (ok). Header "27 queries" vs "TOOL CALLS 17": 17 tools run 27 queries (ok, but unexplained). Header "203 ms total" vs Graph stats "FalkorDB time 203.1 ms / Run total 906 ms": "total" in the header means FalkorDB time, not wall time (misleading label) | `SS/60-tab-3-Graph_stats.png` |
| 2:10 | Clicked "Try axios 2026" | Loads axios AND runs it | It only switches scenario; the feed still says "No triage yet". For about 0.4 s the old qix graph is shown relabelled with "jasonsaayman" and a wrong tier mix, then the axios graph loads. Needs a second click on Run triage | `SS/31-axios-0_4s.png`, `SS/31-axios-8s.png` |
| 2:30 | Looked at the axios timeline | Labels readable | "02:19 alert" and "03:15 removed" collide ("02:19 al03:15 removed"). Also the alert (02:19) is later than the OSV record (02:07), unlike qix, and the hero compares against the OSV record without saying so | `SS/31-axios-8s.png`, `SS/32-axios-triage-3s.png` |
| 2:40 | Ran axios triage | Same hero number before and after | Before triage hero says **128 min**; after triage it says **105 min** and "+105 min". The timeline on screen says "23:59 first publish" and "02:07 OSV record", which is 128 min. 105 min only works from axios@1.14.1 (00:21:58). Two different anchors for the same claim | `SS/31-axios-8s.png` vs `SS/32-axios-triage-3s.png` |
| 2:50 | Read the axios narrative | Complete list | 9 WOULD_PULL repos but the "Do" sentence names 8 (socketio/socket.io missing, although dev-only nightwatch is listed). Evidence tags run [E1], [E1], [E3], [E4], [E5], [E2]. "28 of 28 claims traced" still shown | `SS/32-axios-triage-3s.png` (and body text) |
| 3:10 | Pasted https://github.com/remy/nodemon | Single-repo triage | Works: 5-step progress (Fetch, Parse, Write graph, Enrich, Check ranges), results in about 4 s. Narrative correct (3 bad versions, pin to 4.4.1 / 5.6.0). BUT the hero and the "PATIENT ZERO" row still show the org-wide "21 repos, 1 LOCKED, 20 WOULD_PULL, 74 min" while the right-hand panel says "1 of 1 repos, 0 LOCKED, 1 WOULD_PULL" and name-grep says "1 repos". Contradiction in a single viewport | `SS/50-nodemon-6s.png` |
| 3:30 | Pasted https://github.com/FalkorDB/falkordb-ts | Works, dev-only dependency | Works in about 4 s. Template narration ("LLM template", labelled honestly). Says "FalkorDB/falkordb-ts declares ^4.3.4, which admits debug@4.4.2 (dev-only)"; the tool card shows ^4.3.4 is declared by `@typescript-eslint/parser@8.38.0`, not by the repo. "Do" lists 4 pins; the remediation tool pins 5 (error-ex missing). Same hero mismatch as nodemon. Path chip `@typescript-eslint/parser` overlaps the "dev" chip in the table | `SS/51-falkordb-ts-10s.png`, `SS/52-falkordb-ts-exposure-panel-2x.png` |
| 4:00 | Clicked Fix on acme/checkout-web | A remediation | Excellent drawer: package.json overrides, steps, PR body, Notice tab ("draft only, nothing is sent"), Copy fix, Report .md/.json, Mark remediated with a 10 s Undo. After marking and re-running, `recall_triage` returns "1 repo assessed earlier in this session; 1 marked remediated". Agent memory is real | `SS/80-fix-click.png`, `SS/82-mark-remediated.png`, `SS/83-rerun-after-remediate.png` |
| 4:20 | Re-ran triage without marking anything | `recall_triage` to show the previous run | "no earlier assessments in this session" and Triage history "No saved triages yet". Memory is only written by "Mark remediated", not by triage itself | `SS/71-triage-history-after-rerun.png` |
| 4:40 | Tabs under the table: Concentration / All Cypher used / Triage history / Graph stats | Judge-friendly proof panel | "All Cypher used" (with Copy all) and "Graph stats" (graph `pz_acme_qix`, queries, FalkorDB time, rows per query) are exactly what I wanted, but they sit below a 21-row table and are easy to miss. No node/edge counts or schema shown | `SS/60-tab-1-All_Cypher_used.png`, `SS/60-tab-3-Graph_stats.png` |
| 5:00 | Scrubbed 13:00 to 15:20 | Time-travel | Counts are internally consistent and move at the right moments: 0/0/21 until 13:12, 21 at 13:14, OSV advisories 1 at 14:30, WOULD_PULL falls to 0 and MAINTAINER back to 20 after the 15:15 removal. Running triage at 14:30 passes `at=14:30` and the scanner row correctly lists 1 hit (acme/checkout-web, MAL-2025-46974) | `SS/110-scrub-*.png`, `SS/111-triage-at-1430.png` |
| 5:20 | Typed free-text alerts | Natural language intake | "qix compromised, 13:16 UTC" works (new `find_target` tool, triage at 13:16). Gibberish and a prompt-injection string get a clear "The triage did not run: names no known incident" with a hint (one expected HTTP 400 in the console). Bad URLs give specific errors (not public, no package-lock.json at root, wrong host) | `SS/93-alert-gibberish-3s.png`, `SS/150-paste-err-*.png` |
| 5:40 | Share, Copy Cypher, Prod only | Deep link; honest counts | "Link copied" copies `http://localhost:5173/` only; opening it restarts the autoplay at 13:00 (no scenario, time or selected repo). Copy Cypher works. "Prod only" drops the table from 21 to 14 rows but the KPI still reads "21 of 21 repos" | `SS/130-share.png`, `SS/132-shared-link-load.png`, `SS/140-prod-only.png` |
| 6:00 | Resized and keyboard-tested | No regressions | No horizontal overflow at 1366 / 1920 / 768 / 375 (mobile gets Feed / Graph / Table tabs). Keyboard: skip links, "Pause the autoplay" is the 2nd tab stop, slider has `aria-valuetext` ("13:21 UTC, 21 repos exposed"), Esc closes the drawer and returns focus. Reduced-motion stops autoplay and parks at the end state | `SS/101-vp-1366x768-triage.png`, `SS/101-vp-375x812-triage.png`, `SS/122-reduced-motion.png` |

## Console and network

- Uncaught page errors: 0.
- Console warnings: 0.
- Console errors: 0 in normal use; 1 expected `400 Bad Request` when submitting an alert the API rejects ("asdf lorem ipsum", prompt-injection string). The UI handles it gracefully.
- Failed requests: 0 during real use. One `net::ERR_ABORTED` on `/api/timeline` was seen only in a run that closed the browser while the page was still polling (artifact of my teardown).
- CSP and security headers on the API are tight (`default-src 'self'`, `connect-src 'self'`, HttpOnly SameSite=Strict session cookie).
- Layout shift (dev build): CLS 0.086 at load, +0.19 when the triage results pop in, +0.13 when the "Narration ..." strip appears; about 0.3 to 0.4 total. Long tasks about 1.5 s total across a session with autoplay and graph drawing (dev build, unminified).

## Measured speed

| Action | Measured |
|---|---|
| DOMContentLoaded (dev server) | 0.5 to 0.7 s |
| qix Run triage: first tool card | 0.35 to 0.45 s |
| qix Run triage: "Triage complete" | 1.5 to 2.9 s |
| qix narrative + table + graph all painted | 1.6 to 3.3 s |
| axios Run triage, cold | 3.1 to 3.5 s (first card 1.5 s) |
| axios Run triage, warm | 1.9 to 2.2 s |
| Paste repo (nodemon / falkordb-ts): analyze + triage | about 4 to 6 s (progress shown, step 1 "fetch lockfile" is the long one) |
| FalkorDB time per run | 40 to 270 ms for 15 to 27 queries |

## FalkorDB: load-bearing or decoration?

Load-bearing. Evidence I could verify in the UI (and cross-checked in `server/` read-only):

1. Every answer carries its Cypher, its ms and its row count (tool cards, "All Cypher used", "Graph stats").
2. Temporal modelling is real: `ADMITS {fromT,toT}` windows and `a.fromT <= $at AND $at < a.toT`, driven by the scrubber and by `at=` on every tool. The "would a fresh install have fetched it" semantics cannot be faked with a lookup table.
3. `shortestPath((root)-[:REQUIRES*0..]->(x))` produces the dependency chain that the graph highlights and the Fix drawer uses.
4. Concentration risk uses PageRank written with `CALL algo.pageRank('Package','PKG_DEPENDS')` at ingest, summed per maintainer.
5. All tool reads use `GRAPH.RO_QUERY`; plans via `GRAPH.EXPLAIN`.
6. Agent memory: `(:Triage)-[:ASSESSED]->(:Repo)` is written by "Mark remediated" and read back by `recall_triage`.
7. One graph per scenario (`pz_acme_qix`), pasted repos are written to a graph ("Write graph" step) then queried.

What still smells a little like decoration, or hides the FalkorDB value:

- The 21-node fan-out graph is a visual hairball until you select a row; the table carries the information. The highlighted chain is the useful part.
- The PageRank call is not visible anywhere in the UI (the card only shows `sum(p.pagerank)`), so a skeptic can suspect an offline number.
- No schema, node count or edge count is shown, so the scale of the graph is invisible.
- Memory is thin: running a triage does not persist anything.
- The ownership layer (teams, Slack channels) and the only LOCKED repo are synthetic (see Trust).

## Scores (bar is 9 or higher)

| Dimension | Score | Why in one line |
|---|---|---|
| Clarity | **7** | The 10-second story is strong, but no tagline, undefined jargon, FalkorDB barely visible, claim-to-query link missing, three "Run triage" buttons on one screen |
| Speed | **8** | 0.4 s to first tool card, 2 to 3.5 s to full result, 4 to 6 s paste; held back by skeleton flashes, CLS up to 0.4 and a cold axios 3 s |
| Correctness | **7** | Core counts and Cypher outputs are consistent, but there is a 128 vs 105 min contradiction, hero numbers ignore pasted-repo scope, and two narrative statements are wrong or incomplete |
| Trust | **8** | Honest LLM mode badges, "sample repo", "draft only", Undo, visible Cypher and plans; lowered by non-clickable "traced" claims, synthetic owners presented as verified, stateless Share link |
| Delight | **8** | Scrubbable time-travel, handwritten "74 min", drawer with Undo, graph highlighting; lowered by clipped plan/Cypher, overlapping labels and layout jumps |
| Accessibility | **8.5** | 0 axe violations on landing and post-triage, contrast scan clean (1 decorative glyph), excellent keyboard model; 1 serious axe violation in the drawer plus visual overlap and tooltip-only help |

## Issues behind every score below 9

Severity: P0 blocks, P1 undermines the core claim, P2 visible quality issue, P3 polish.

### Clarity (7)

| Sev | UI location | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|
| P1 | Narrative chips "(verified)", "[E1]..[E5]", header badge "21/21 traced", line "21 of 21 claims traced to a graph query" | The headline trust claim is not navigable. Chips only highlight a graph path (team chips do nothing); badge and line are static text; the evidence tags do not open anything | `SS/160-E3-click.png`, `SS/20b-chip-click-github-docs.png`, `SS/170-traced-badge-click.png` | Make each claim chip scroll to its tool card, open its Cypher and flash the matching row. Make "21/21 traced" open a claim-to-tool-to-query map |
| P2 | Landing, header and hero | No one-line statement of what the product is, and "FalkorDB" appears only in 12 px empty-state copy. First-time viewers cannot tell what is built on what | `SS/01-land-0s.png` | Add a 1-line tagline under the logo ("Supply-chain triage on a FalkorDB graph") and a "Powered by FalkorDB" pill that opens Graph stats |
| P2 | Hero counters, row "LOCKED / WOULD_PULL / MAINTAINER", "OSV" | MAINTAINER is never defined (it shows 21 at 13:00 while the headline says 0). OSV is unexplained | `SS/110-scrub-1300.png` | Tooltip or legend for the three tiers and one line for OSV; consider renaming MAINTAINER to WATCH or "same maintainer, not yet affected" |
| P2 | Tool card "Cypher" disclosure, `incident_exposure`, `draft_remediation` | Cards that run several queries print them concatenated with no per-query label; "Show plan" explains only one of the five and does not say which | `SS/24-show-plan-card2.png` | Label each statement (`1/5 repo list`, `2/5 resolves-to`, ...) and show a plan per statement |
| P2 | Tool card result table for `explain_path` | Three identical rows ("ADMITS ADMITS ADMITS") with only REPO / VERSION / KIND columns; the query returns range, hops and chain, none shown. Looks like a bug | Body of `SS/10-triage-12s.png` (explain_path cards) | Show `range`, `hops` and `chain` columns and de-duplicate |
| P2 | Under the exposure table: Concentration / All Cypher used / Triage history / Graph stats | The best judge-facing proof (all Cypher, per-query ms, graph name) is buried under a 21-row table | `SS/60-tab-1-All_Cypher_used.png` | Surface a "Show me the graph" link in the header badge area that opens these tabs; add node/edge counts and a 5-line schema to Graph stats |
| P3 | Hero button row | Three "Run triage" buttons visible at once (hero, feed empty state, table empty state), plus two "Paste your repo" | `SS/01-land-0s.png` | Keep one primary CTA; make the empty states point at it |
| P3 | "Try axios 2026" | Label implies it runs the scenario; it only switches it | `SS/31-axios-8s.png` | Rename "Load axios 2026" or run triage after switching |
| P3 | Grammar | "1 repos", "1 OSV advisories", "qix's packages are in 1 repo' lockfiles" | `SS/50-nodemon-6s.png` | Pluralisation helper |

### Speed (8)

| Sev | UI location | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|
| P2 | Whole dashboard when triage or paste starts (axios cold, paste repo) | The entire page (hero, timeline, graph) is replaced by grey skeletons and "Connecting to the graph..." for 0.5 to 3 s, even though the old content is still valid | `SS/32-axios-triage-0_5s.png`, `SS/32-axios-triage-1_5s.png`, `SS/50-nodemon-0_5s.png` | Keep stale content dimmed during loads; only skeleton the panels that change |
| P2 | Layout when results land | CLS about 0.19 when the three-panel grid fills, +0.13 when the "Narration ..." strip is inserted | `SS/51-falkordb-ts-10s.png` | Reserve the strip height and give panels fixed min-heights |
| P3 | axios triage, cold | 3.1 to 3.5 s versus 1.9 s warm | `SS/32-axios-triage-3s.png` | Pre-warm axios graph on scenario switch |
| P3 | Paste flow | Step 1 "fetch lockfile" takes about 2 to 3 s with no sub-progress | `SS/50-nodemon-3s.png` | Show bytes or elapsed time |

### Correctness (7)

| Sev | UI location | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|
| P1 | axios hero "N min before the OSV record existed" and right panel "AHEAD OF THE ADVISORY" | Shows **128 min** before triage and **105 min** after, while the timeline beside it shows "23:59 first publish" and "02:07 OSV record" (which is 128). The 105 anchors on axios@1.14.1 (00:21), the 128 on plain-crypto-js@4.2.1 (23:59) | `SS/31-axios-8s.png`, `SS/32-axios-triage-3s.png` | Use one definition of "first malicious publish" everywhere (include dependency-only malicious packages in `suspect_versions`), and say what it is anchored to |
| P1 | Pasted repo (nodemon, falkordb-ts): hero, "PATIENT ZERO" row, "74 min" | After analyzing one repo, the hero still reads "21 repos, 1 LOCKED, 20 WOULD_PULL" while the right panel says "1 of 1 repos, 0 LOCKED, 1 WOULD_PULL" and name-grep says "1 repos" | `SS/50-nodemon-6s.png`, `SS/51-falkordb-ts-10s.png` | Re-scope hero, scanner comparison and timeline to the pasted graph, or label the hero "Demo org (21 repos)" and give the pasted repo its own hero |
| P2 | Narrative for pasted falkordb-ts | "FalkorDB/falkordb-ts declares ^4.3.4, which admits debug@4.4.2": the range is declared by `@typescript-eslint/parser@8.38.0` (1 hop), per the tool card. Also lists 4 pins vs 5 in `draft_remediation` (error-ex dropped) | `SS/51-falkordb-ts-10s.png` | Template should say "its dependency X declares ..." when hops > 0 and list the same pins as the tool |
| P2 | axios narrative "Do" | 9 WOULD_PULL repos, 8 named (socketio/socket.io silently dropped); evidence tags out of order ([E1], [E1], [E3], [E4], [E5], [E2]); "28 of 28 traced" | `SS/32-axios-triage-3s.png` | Verify list completeness against the exposure count, or add "+1 more" |
| P3 | Exposure panel after "Prod only" | Table drops 21 to 14 rows; "21 of 21 repos" and tier counts do not change and nothing says "14 shown" | `SS/140-prod-only.png` | Show "14 of 21 shown" |
| P3 | Header "N ms total" | Means FalkorDB time (203 ms) but Graph stats shows "Run total 906 ms" | `SS/60-tab-3-Graph_stats.png` | Label "203 ms in FalkorDB" |
| P3 | Narrative non-determinism | Same qix 13:30 run produced "21 of 21 claims" with pins in one run and "18 of 18 claims" with only "Rotate secrets and rebuild" in another | `SS/140-prod-only.png` vs `SS/10-triage-12s.png` | Constrain the LLM to the same slots every run (verdict, notify, do-per-tier) |

### Trust (8)

| Sev | UI location | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|
| P1 | See Clarity P1 | "traced" cannot be verified by clicking | `SS/170-traced-badge-click.png` | See above |
| P2 | Hero "1 LOCKED", team names, "Notify: Payments, Docs, QA, CLI, Platform, API Clients" | The only LOCKED repo is the synthetic `acme/checkout-web`, and the teams/channels for real OSS repos (mocha to QA, github/docs to Docs) are invented. Chips still say "(verified)". Row labels "sample repo" but the hero and narrative do not | `SS/10-triage-12s.png` | Mark synthetic data in the hero ("1 sample LOCKED") and tag team routing as "demo ownership map" |
| P2 | Share button (exposure card) | Toast says "Link copied" but the link is `http://localhost:5173/`; opening it restarts autoplay at 13:00 | `SS/130-share.png`, `SS/132-shared-link-load.png` | Encode scenario, `at`, selected repo (and pasted graph id) in the URL |
| P2 | "Triage history" tab and `recall_triage` | Running a triage stores nothing; memory exists only after "Mark remediated". The tab says "No saved triages yet" right after a triage | `SS/71-triage-history-after-rerun.png` | Persist an ASSESSED write per triage (or rename the tab "Remediation history") |
| P3 | Concentration card | PageRank is read from a stored property; the `algo.pageRank` call that produced it is not shown | `SS/60-tab-0-Concentration.png` | Add the ingest call as a footnote or a "How this was computed" link |
| P3 | Concentration list | "types" is the `@types` scope, not a person, listed as a "maintainer" and "next compromised account" | `SS/60-tab-0-Concentration.png` | Label scopes differently or exclude them |

### Delight (8)

| Sev | UI location | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|
| P2 | Tool card "Show plan" block, narrow feed column | Plan lines clipped at about half width; the key operator names are off-screen | `SS/27-plan-visible.png` | `white-space: pre-wrap` or show a compact tree; at least add a visible scrollbar affordance and a "Copy plan" |
| P2 | Tool card "Cypher" blocks | Clipped horizontally at 360 px column | `SS/22-cypher-open-first-card.png` | Wrap long lines or widen the feed when a Cypher is opened |
| P2 | axios timeline labels | "02:19 alert" and "03:15 removed" overlap into "02:19 al03:15 removed" | `SS/31-axios-8s.png` | Stagger or collision-detect labels |
| P2 | Exposure table "dev" chip | The "dev" chip overlaps the path chip (`@typescript-eslint/parser`, `debug`, `ansi-styles`) in dev-only rows (TypeScript, pdf.js, swagger-ui, bootstrap, falkordb-ts) | `SS/52-falkordb-ts-exposure-panel-2x.png`, `SS/60-tab-3-Graph_stats.png`, `SS/141-row-click-mocha.png` | Give the dev chip its own column or reserve width; allow path chips to wrap under it |
| P3 | Scenario switch to axios | About 0.4 s flash of the qix graph relabelled "jasonsaayman" with 1 / 0 / 9 tiers | `SS/31-axios-0_4s.png` | Clear graph on scenario change |
| P3 | Graph with 21 repos | Dense fan of grey edges is noisy until a row is selected | `SS/03-land-10s.png` | Fade non-selected edges further or default-select the LOCKED repo with a callout |
| P3 | Fix button | Flush against the viewport edge at 1440 (Fix right edge at x = 1440) | `SS/10-triage-12s.png` | Add right padding |
| P3 | 1440x900 fold | Hero + onboarding strip leave about 520 px for the three working panels; at 1366x768 the table is below the fold | `SS/101-vp-1366x768-triage.png` | Collapse the onboarding strip after first interaction; shrink the hero after triage |

### Accessibility (8.5)

| Sev | UI location | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|
| P2 | Fix drawer footer, "Report .md" and "Report .json" | axe `label-content-name-mismatch` (serious): visible text "Report .md" is not contained in the accessible name ("Export the whole report ...") so voice-control users cannot say what they see | `SS/80-fix-click.png` | Make the aria-label start with the visible text ("Report .md, export the whole report") or drop the aria-label |
| P2 | Overlapping "dev" chip and path text | Overlap makes the text unreadable to low-vision users and breaks reflow | `SS/52-falkordb-ts-exposure-panel-2x.png` | As above |
| P3 | 41 `span[aria-label]` (e.g. "Narration mode: live", verified ticks) | axe "incomplete" (aria-prohibited-attr): aria-label on spans without a role is not reliably announced | n/a | Add `role="img"` or move text into visible/sr-only content |
| P3 | Chip help | The "Verified against a graph query..." help is only a `title` attribute, so keyboard and touch users never see it | `SS/25-chip-hover.png` | Use an accessible tooltip or visible helper text |
| P3 | Autoplay on load | Autoplay starts without consent (it can be paused, and the Pause control is the 2nd tab stop, and reduced-motion disables it). Fine for WCAG 2.2.2 but disorienting for screen-reader users who then hear numbers change | `SS/01-land-0s.png` | Start paused when a screen reader is detected, or announce "autoplay running, press P to pause" |

Credit where due (so the 8.5 is honest): axe-core found 0 violations on the landing and post-triage views; my own contrast scan found only one decorative glyph under 4.5:1 across the whole triage screen; fonts are Satoshi, Cabinet Grotesk and Martian Mono (nothing generic); the slider exposes `aria-valuetext`; the drawer is a native `<dialog>` with a labelled title, focus returns to the originating button on Esc.

## Top 5 fixes that would most raise my score

1. **Make "traced to a graph query" clickable.** Every "(verified)" chip, "[E#]" tag and the "21/21 traced" badge should scroll to the supporting tool card, open its Cypher and flash the matching result row. This is the core pitch and today it costs a judge about 90 seconds of guessing (Clarity, Trust, Delight).
2. **Fix the numbers that contradict each other.** Use one definition of "first malicious publish" (axios: 128 vs 105 min) and re-scope or relabel the hero, scanner row and "74 min" when a pasted repo is analyzed (21 repos vs "1 of 1 repos") (Correctness, Trust).
3. **Make the FalkorDB proof readable.** Wrap or widen the clipped Cypher and GRAPH.EXPLAIN blocks, label which statement a plan belongs to, show range/hops/chain in the `explain_path` tables instead of three identical rows, and surface "All Cypher used" and "Graph stats" (add node/edge counts and the `algo.pageRank` call) from the header (Delight, Trust, Clarity).
4. **Say what this is in the first 10 seconds.** One-line tagline, a visible "built on FalkorDB" pill, tooltips for LOCKED / WOULD_PULL / MAINTAINER / OSV, and label synthetic items (the single LOCKED repo and the team routing) in the hero and narrative (Clarity, Trust).
5. **Polish the visible glitches.** Fix the "dev" chip overlap in the exposure table and the axios timeline label collision, stop wiping the whole dashboard to skeletons on scenario/paste (and reserve space for the narration strip to kill CLS 0.3 to 0.4), make Share encode state, and fix the drawer's `label-content-name-mismatch` (Speed, Delight, Accessibility, Trust).

## Appendix: what I did not break (so you can stop worrying about it)

- Triage latencies and counts reconcile: 21 = 1 LOCKED + 20 WOULD_PULL (qix), 10 = 1 + 9 (axios), 74 min = 14:26 - 13:12, tool cards (19 versions, 7 teams, 17 tools, 27 queries) match the header and Graph stats.
- Scrubbing is monotonic and consistent across hero, scanner row, tier counts and table.
- Error paths are graceful (bad URL, private/missing repo, no lockfile, unknown alert, prompt injection).
- No horizontal overflow at 1366 / 1920 / 768 / 375 px; mobile has a Feed / Graph / Table switcher.
- No uncaught console errors in any normal flow.

## Screenshot index (all under `SS/`)

- Landing and autoplay: `01-land-0s.png`, `02-land-3s.png`, `03-land-10s.png`
- qix triage: `10-triage-0_5s.png`, `10-triage-1_5s.png`, `10-triage-12s.png`
- Claims, Cypher, plan: `20-click-verified-chip.png`, `20b-chip-click-github-docs.png`, `21-click-E1.png`, `22-cypher-open-first-card.png`, `23-show-plan-first-card.png`, `24-show-plan-card2.png`, `25-chip-hover.png`, `27-plan-visible.png`, `160-E3-click.png`, `161-payments-chip.png`, `170-traced-badge-click.png`
- axios: `30-pre-axios.png`, `31-axios-0_4s.png`, `31-axios-8s.png`, `32-axios-triage-0_5s.png`, `32-axios-triage-1_5s.png`, `32-axios-triage-3s.png`
- Paste repo: `40-paste-open.png`, `50-nodemon-0_5s.png`, `50-nodemon-3s.png`, `50-nodemon-6s.png`, `51-falkordb-ts-10s.png`, `52-falkordb-ts-exposure-panel-2x.png`, `150-paste-err-1..4.png`
- Tabs and memory: `60-tab-0-Concentration.png`, `60-tab-1-All_Cypher_used.png`, `60-tab-2-Triage_history.png`, `60-tab-3-Graph_stats.png`, `70-run-again.png`, `71-triage-history-after-rerun.png`, `83-rerun-after-remediate.png`
- Fix drawer: `80-fix-click.png`, `81-fix-notice-tab.png`, `82-mark-remediated.png`
- Free-text alerts: `90-describe-alert.png`, `91-describe-alert-result.png`, `92-alert-*.png`, `93-alert-gibberish-*.png`, `94-alert-inject-*.png`
- Scrubbing: `110-scrub-1300.png` to `110-scrub-1520.png`, `111-triage-at-1430.png`
- Sharing, filters: `130-share.png`, `131-copy-cypher.png`, `132-shared-link-load.png`, `140-prod-only.png`, `141-row-click-mocha.png`
- Viewports and a11y: `100-vp-*-land.png`, `101-vp-*-triage.png`, `120-kbd-first-tab.png`, `121-kbd-4th-tab.png`, `122-reduced-motion.png`, `123-slider.png`
