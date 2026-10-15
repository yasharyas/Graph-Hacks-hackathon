# Patient Zero: FalkorDB judge pass, round 2

Headless Chromium via playwright-skill, 1440x900 plus a 1280x720 pass. No server touched, no repo file edited. Screenshots (`SS/`): `qa/reports/phase3r2-judge/`.

## 1. Verdict

The round-1 headline gap is closed: every `(verified)` chip and `[E#]` opens the exact tool card, its Cypher and an outlined result row, so a claim is provable in one click. A tagline and "Built on FalkorDB" pill land the point inside 10 seconds. Cypher and plans wrap, each statement is labelled (`3/5 · INCIDENT · ADMITS + REQUIRES`), layout shift is near zero and axe finds 0 violations. FalkorDB is plainly load-bearing: temporal `ADMITS {fromT,toT}`, `shortestPath`, `algo.pageRank`, and a `GRAPH.EXPLAIN` ending in an index scan. What remains is trust nicks: axios "+105 min" against a timeline implying 128, an unreadable Triage history tab, an LLM line whose method is hover-only, and invented team routing that still reads as verified. I rate it 8.5, one polish pass from 9.

## 2. Timed friction log

| T+ | Step | What happened | SS |
|---|---|---|---|
| 0:00 | Land, no clicks | Tagline in first paint; 21 repos by 3 s; "74 min" circled by 10 s. Scanner 0 / grep 21 / Patient Zero 1+20 is clear. MAINTAINER unexplained | 01-04 |
| 0:20 | Run triage (qix) | First card under 0.5 s, done 2.2-4.0 s, 49 tools, 75 queries, 0.6-0.9 s in FalkorDB | 10, 11 |
| 0:35 | Click row (mocha) | Path debug@4.4.2 > mocha > QA drawn in 0.7 s | 20 |
| 0:50 | Cypher, Show plan | Wrapped, per-statement; plan ends in Node By Index Scan; opens below the feed fold | 41, 42 |
| 1:10 | `[E3]`, name, team chips | One click: card open, Cypher open, exact row outlined. "59/59 traced" opens a claim-to-tool map | 30-33 |
| 1:40 | Analyst pick | "4 repos declare the range ... in their own package.json": correct (4 `direct` rows), actionable | 50 |
| 2:00 | Try axios 2026 | Loads and runs itself; first card 0.25 s; done 6-7 s cold; no stale flash | 61 |
| 2:30 | Paste repos | axios/axios 6.0 s, nodemon 5.7 s, falkordb-ts fine; hero re-scoped. express: error under 3 s, "Drop the lockfile instead", sample repos offered | 71, 72 |
| 3:00 | Scrub | 13:05 0 repos; 13:14 21 (1+20); 14:30 OSV 1; 15:20 1 LOCKED, MAINTAINER 20. After triage a banner says paths belong to the run clock. Consistent | 80-92 |
| 3:30 | FalkorDB features | Pill opens Graph stats: graph name, 75 queries, 0.6 s in FalkorDB vs 3.3 s run total, schema, per-query ms. Concentration shows the `algo.pageRank` call | 22, 101 |

## 3. Findings

No P0 or P1.

**P2-1 axios minutes depend on an unstated anchor.** Steps: Try axios 2026, read timeline and right panel. Expected: one visible definition. Actual: timeline "23:59 publish" to "02:07 OSV" is 128 min; panel and narrative say +105 (from axios@1.14.1, 00:21). SS `61-axios-6000ms`.

**P2-2 Triage history is unreadable.** Steps: run triage, Run again, open Triage history. Expected: a row per run with tiers. Actual: 21 identical lines "18:14 UTC · session · open" per run, no repo or tier. SS `122-run3-history`.

**P2-3 What the LLM did is hover-only.** Steps: find ANALYST PICK (LLM). Expected: visible method. Actual: 12 px grey label; explanation is a `title`; claim map says "Checked against the run as a whole". SS `50-analyst-pick`.

**P2-4 Invented ownership reads as verified.** Steps: read NOTIFY. Actual: mocha to QA, `#team-*` channels, all with "verified" chips; only "Acme demo org" and one "sample repo" tag hint at demo data. Expected: "demo ownership map". SS `11-triage-done`.

**P2-5 Definitions and proof thin before triage.** At 13:00 the hero says "0 repos" beside MAINTAINER 21; the tier legend is a "?" that exists only after triage (`21-tier-help`); OSV is undefined. The landing pill only toasts "Graph stats appear once a triage has run"; stats show schema but no node or edge counts. SS `100-pill-at-landing`.

**P3**
- A failed alert after an axios alert leaves "at 02:00 UTC" on the qix timeline. SS `132-alert-gibberish`.
- Triage from autoplay end (14:30) jumps to 13:30; a manual 14:30 stays. SS `11-triage-done`, `93-manual-1430-triage`.
- Tier label wraps "WOULD_PU / LL" in card tables (`31-click-chip-docs`); filter placeholder truncates at 1280 (`141-vp1280-triage`).
- Pasted-repo narrative never names the incident it was scored against (`72-axios-done`).
- "1 repos" in route_owners; `types` listed as a maintainer; three Run triage buttons at landing (`01-land-0_3s`); chip help is `title`-only.

## 4. Round-1 regression

| Item | Status | Evidence |
|---|---|---|
| P1 claims not clickable | FIXED | `30-click-E3`, `32-click-chip-payments` |
| P1 axios 128 vs 105 | PARTLY | One number now, anchor unstated (P2-1) |
| P1 pasted hero said 21 repos | FIXED | `72-axios-done`: "1 repo, pasted repo" |
| P2 no tagline, FalkorDB hidden | FIXED | `01-land-0_3s` |
| P2 MAINTAINER/OSV undefined | PARTLY | Popover after triage only (P2-5) |
| P2 concatenated queries, one plan | FIXED | `42-plan-q3-visible` |
| P2 explain_path identical rows | FIXED | Range, hops, chain in `30-click-E3` |
| P2 proof tabs buried | PARTLY | Pill and schema added; no counts, tabs still under table |
| P2 skeleton wipe | FIXED | `61-axios-300ms`, `71-express-500ms` |
| P2 CLS 0.3-0.4 | FIXED | Measured 0.03 (1440), 0.05 (1280) |
| P2 falkordb-ts wording, pin count | FIXED | "its dependency ... declares"; 5 pins match |
| P2 axios Do dropped socket.io | FIXED | All 10 repos named |
| P2 synthetic owners as verified | PARTLY | P2-4 |
| P2 Share link stateless | FIXED | `?scenario&at&repo` restores and re-runs, `112-shared-link-10s` |
| P2 triage not remembered | FIXED | "21 repos assessed earlier"; see P2-2 |
| P2 plan, Cypher clipped | FIXED | `41-plan-q3` |
| P2 timeline and dev-chip overlap | FIXED | `61-axios-6000ms`, `20-row-mocha` |
| P2 drawer axe mismatch | FIXED | axe 0 on landing, post-triage, drawer |

## 5. Scores (bar is 9)

| Dimension | Score | Why not 9 |
|---|---|---|
| Clarity | 8.5 | MAINTAINER/OSV undefined pre-triage, LLM role hover-only, three Run triage buttons |
| Speed | 8.5 | axios cold 6-7 s, paste about 6 s; first card 0.25-0.5 s |
| Correctness | 8.5 | Counts and scrub reconcile; axios anchor, history rows, stale clock |
| Trust | 8.5 | One-click proof is excellent; invented ownership still "verified" |
| Delight | 8.5 | Plan opens off-screen, wrapped tier label, history list |
| Accessibility | 8.5 | axe 0, real focus ring; title-only help, unlabelled history rows |

## 6. Console errors

- 1 console error: expected `400` on `/api/triage` for gibberish alert "asdf lorem ipsum" (handled with a hint).
- 0 uncaught errors or warnings across landing, qix and axios triage, four pastes, drawer, scrub, share link.
- Every load logs `net::ERR_ABORTED` on `/api/timeline` (app cancels its own first request); not a console error.
