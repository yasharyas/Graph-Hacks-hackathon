# Patient Zero: Phase 3 round 4, phone QA (LinkedIn/X-link persona)

Target: production build `http://localhost:8080/` (the link people tap), with the cold-load comparison against Vite dev `http://localhost:5173/`. Chromium headless via Playwright, iPhone UA, `isMobile`, `hasTouch`, DPR 3, `tap()` and CDP touch for the scrubber. Viewports: 375x812 (main), 390x844, 320x640, 812x375. Every flow ran in a fresh browser context (fresh session). Shots: `qa/reports/phase3r4-phone/` (names in brackets). Scripts: scratchpad `r4phone/` (not in the repo).

Caveats, stated up front: headless Chromium has no soft keyboard, so "keyboard up" is simulated by shrinking the layout viewport (the Android "resizes-content" model). The iOS and Chrome-Android visual-viewport model is untested, and WebKit was not available, so anything iOS-specific is reasoned from the code, not observed. Layout-shift numbers: I report both the standard CLS (shifts within 500 ms of a tap are excluded by the browser) and the raw total, because on this app the tap itself triggers a visible page collapse and re-grow.

## 1. Verdict

**Overall 8.6 / 10. Round 3 (8.0) had two trust-critical gaps and a landscape layout that did not work; all three are fixed and verified. Not yet 9: four defects remain, all cheap.**

What is now good, with evidence:
- **The Ask answer lands where you can read it.** After "Ask", "YOU ASKED" sits at y 28 and "Answered from the graph" at y 57, above the Ask bar (top 667) at 375x812, 390x844, 320x640, and with a simulated keyboard (`ask-375x812-T3000.png`, `ask-375x812-kb300-T3000.png`). Round 3: answer under the bar.
- **Tapping [E1] opens the card at the top of the screen with its Cypher in view** (card top y 12, Cypher y 152 to 384 at 375x812; same at 390 and 320) (`e-375x812-E1.png`).
- **Tapping the tier counts opens the legend** (the whole count band is a 319x52 target). A tap outside closes it (pointerdown listener), and tapping Run triage while it is open both closes it and runs.
- **Landscape works**: Run triage at page y 81 of 375 (first view), every target 44 px (sort headers were 36x18), drawer body 253 px (was 163) with a sticky Copy / Mark remediated bar.
- **Drawer on a phone**: scrolling body 598 to 658 px (was 163 to 189), Fix / Notice tabs 44 px, Copy fix always visible in a sticky bar.
- No "Scrubber moved" toast any more, no 11.7 px text, 0 axe violations in 10 states, 0 horizontal overflow in 4 viewports, 0 console errors.
- Production cold load on Fast 3G + 4x CPU: first paint 1.66 s, FCP and CTA 3.15 to 3.28 s, 7 to 10 requests, 260 to 458 KB, and the CTA is tappable on a skeleton (a tap gives a verdict in 2.3 s on that throttle).

What stops a 9 (see section 5): the paste-your-repo result still reflows hard (CLS 0.46 to 0.97 when the 5-step analysis runs), the 12 s autoplay still has no caption, the table says a false thing in one empty state, and the share link the app itself generates (`?repo=` without `open=`) lands on the generic verdict.

## 2. Timed friction log (T+ from the start of each step; steps ran in separate fresh sessions)

| T+ | Step | What happened | Shot |
|---|---|---|---|
| 0.42 s | Land 375x812 | Subhead, qix / axios / Describe chips, Pause, hero, **Run triage 181x44 at y 502** from the first frame. CLS 0.0007. No horizontal scroll, 0 text under 12 px, 0 targets under 44. | `land-t00400.png` |
| 1.5 to 12.4 s | Autoplay | Counters 0 to 21, scrubber slides, 4 event labels on 2 rows, CTA never moves. Ends on "Play the 90 minutes". **Still no caption or narration while it plays**: only the counters and the clock change. | `land-t04000.png`, `land-settled.png` |
| +0.25 to 0.4 s | Tap a tier count (WOULD_PULL, LOCKED, MAINTAINER, OSV row; also during autoplay) | Legend popover opens (x 75 to 363, 12 px text, inside the viewport). It covers the scrubber and the CTA row while open. Outside tap closes it; Run triage under it runs. | `legend-A-tap-wouldpull.png` |
| +0.15 s | Tap Run triage (page y 502) | **Layout collapses for about 250 ms**: page height 1358 to 895 to 1827 to 2644, CTA 502 to 250 to -101, a blank band and a half-built "TOOL CALLS · 2" frame are visible. | `flash-0.png`, `flash-1.png` |
| +0.4 to 0.8 s | Same run | Progress text "Picking the analyst observation...", then verdict ("62 of 62 claims traced") with the VERDICT card at the top of the screen (scrollY 434) and the Ask bar below it. | `triA-t00400.png`, `triA-t00800.png` |
| +0.7 s each | Feed / Graph / Table (bottom bar, 125x55 each) | Graph: the path list for the selected repo plus a hint "Tap a repo in the Table tab to change the path." Table: flush at the card list. Repo names are now link-coloured. | `tab-graph.png`, `tab-table.png` |
| +0.6 s | Tap a repo name (github/docs, 67x44) | Card gets a left accent bar and an inline "PATH E2" block; Graph tab shows the same repo's path. | `row-01-after-name-tap.png`, `row-02-graph-path-docs.png` |
| +0.11 s | Tap Fix | Full-screen drawer: header, path, lockfile pins, Fix / Notice tabs, then the snippet; **sticky bar: Copy fix, Mark remediated, More actions (all 44 px)**. Body scrolls 598 of 935 px. | `fix-01-open.png` |
| +0.3 s | Copy JSON, Copy fix, Copy message | Clipboard verified (JSON overrides snippet; Notice text with the Slack message and a Details link to this scenario). In-bar status "package.json snippet copied". | `fix-04-copied.png`, `drawer2-02-copied.png` |
| +0.5 s | Browser Back | Drawer closes, app stays. | (log) |
| +0.13 s | Ask: "Which team should I notify first?" (no keyboard) | Echo y 28, "Answered from the graph" y 57, NOTIFY block below, all above the Ask bar. CLS 0.022 to 0.038 (raw). | `ask-375x812-T3000.png` |
| +0.12 s | Same, keyboard up (viewport shortened by 300 / 260 px) | Ask bar un-pins (`position: static`), input sits at page y 1898 (a +1,460 px jump from scrollY 434 if the browser scrolls to it); after Ask the answer starts at y 28, above the tab bar. Raw CLS 0.21 to 0.30. | `ask-375x812-kb300-T3000.png` |
| +0.7 s | Tap [E1] in the verdict "WHY" line | Page scrolls 434 to 1437; the explain_path card is at y 12 with Cypher at y 152 to 384, E1 row outlined. | `e-375x812-E1.png` |
| +0.5 s | Paste sheet, `hello world`, `gitlab.com/foo/bar` | Inline errors, `aria-invalid`, focus stays in the input; 16 px field, all targets 44. | `paste-375x812-02-bad1.png` |
| +1.6 s | Paste `axios/axios` (analysis runs) | 5-step progress ("Step 5 of 5: check ranges") at 1.5 s, sheet closes at 1.6 s, hero "1 repo", verdict "36 of 36 claims traced". **Content reflows after the sheet closes: page height 725 to 2377 and scrollY 0 to 371 to 508 in about 170 ms; CLS 0.46 (375x812), 0.97 (320x640).** | `pcls-320x640-axios_axios-end-1300.png` |
| +1 to 2 s | Paste a repo with no lockfile / lockfile v1 / pnpm | Specific dead-end messages (pnpm "on the roadmap"), a sample-repo chip row for v1; no layout problem. | `pasteexp-result.png` |
| 0.4 s | Rotate to 812x375 with the drawer open | Drawer docks right (x 392, 420 wide), body 253 px, Copy bar y 323 to 367, focus on Close. Back to portrait keeps it open. | `misc-A-rotate-drawer.png` |
| 0 to 4 s | Fresh landscape load, tier tap, triage, Ask, Table, Fix | Run triage y 81; legend x 101 to 389, y 254 to 481; Ask answer echo y 28; sort headers 44x44; 0 targets under 44. | `land-812x375-01-first.png`, `land-812x375-07-drawer.png` |
| 1.0 s | Open a share link in a fresh mobile context | `...&repo=github/docs&open=notice`: triage auto-runs, drawer on the right repo and the Notice tab by 1.0 s. `...&repo=github/docs` (what the Table's own share button produces) and `repo=nope/does-not-exist`: verdict only, nothing marks the repo, no message. | `share-drawer-link-t1000.png`, `share-table-link-t1000.png` |

## 3. Round-3 items, re-tested

| Item (round 3) | Status | Evidence |
|---|---|---|
| Fix 1 (blocking): Ask answer behind the Ask bar | **Fixed** | Echo y 28 / answered label y 57 / bar top 667 (375x812); 699 (390x844); 495 (320x640); with keyboard sim the answer is above the tab bar. `ask-*-T3000.png` |
| Fix 2 (blocking): [E1] card and Cypher out of sight | **Fixed** | Card top y 12, Cypher y 152 to 384 at 375x812; y 134 to 366 at 390x844; y 192 to 442 at 320x640. `e-375x812-E1.png` |
| Fix 3 (blocking): dev origin 36 s blank on 3G | **Prod fine, dev not fixed** | Prod :8080 Fast 3G + 4x CPU: first paint 1.66 s, FCP 3.28 s, CTA 3.15 s, 10 requests / 458 KB on run 1, 7 / 260 KB on run 2 (cache disabled for both). Dev :5173: no text within 30 s, 77 requests, 4.0 MB. `throttle-prod8080-first-text.png` |
| Fix 4 (blocking): layout shift | **Partly** | Run triage: CLS 0.0076 (was 0.081). Tabs 0. Ask 0.02 to 0.04. Paste with the 5-step analysis: 0.46 / 0.61 (375), 0.97 (320x640), up from 0.21 to 0.33. Paste when the result is instant: 0.0002 to 0.03. Raw (tap-adjacent) shifts of about 1.1 on triage are a visible 250 ms collapse (see section 5, item 5). |
| Fix 5 (blocking): 11.7 px verdict chips | **Fixed** | 0 runs under 12 px in 10 states x 4 viewports (verdict, expanded feed, drawer, paste included). |
| Fix 6: "Scrubber moved" toast on the Ask box | **Fixed** | No such text for 7 s after a post-autoplay triage; no visible toast at all (the status messages are in-bar or screen-reader only). `toast-t1200.png` |
| Fix 7: landscape CTA, drawer body, 44 px | **Fixed** | Run triage y 81; drawer body 253 px; table sort headers 44x44, tier "?" 44x44; 0 targets under 44 at 812x375. `land-812x375-01-first.png` |
| Fix 8: legend far from counts, inert row taps, `text-link` class | **Fixed** | Count band is the trigger (319x52, `cursor: help`); selected row tints and prints its path inline; repo names are blue; `pointerdown` outside close in `TierLegend.tsx`. |
| Fix 8b: `?repo=` without `open=` should do something | **Not fixed** | Lands on the generic verdict; nothing marks the repo; bad repo ignored silently. `share-table-link-t1000.png`, `share-bad-repo-t1000.png` |
| Round-2 F1 axios label collision | **Fixed (holds)** | 0 overlaps, 0 outside viewport, at 375, 390, 320 after Try axios. `labels-320x640-axios-3s.png` |
| F2 verdict wait | **Fixed (holds)** | Progress text at 0.4 s, verdict 0.8 s; 2.3 s under Fast 3G. |
| F3 `?repo=&open=` deep link | **Fixed (holds)** | Drawer on the repo and tab at 1.0 s in a fresh context. |
| F4 320x640 CTA / paste error | **Fixed (holds)** | CTA y 524 to 568 above the bar (584); error y 77 to 252. |
| F5 paste CLS | **Not fixed** | See Fix 4. |
| F6 struck-through chips after Ask | **Fixed (holds)** | "Which team first?" gives "53 of 53 claims verified". |
| F7 target sizes | **Mostly fixed** | 0 under 44 outside sentences in every state. Remaining: in-sentence evidence chips 24 to 30 px high ([E1] 41.6x30), and the drawer's Undo link 31x44 after Mark remediated. |
| F8 scrub bubble at edge | **Fixed (holds)** | 20 px gap at 375, 390, 320. `scrub-375-end.png` |
| F9 landscape | **Fixed** | See Fix 7. |
| F10a jargon labels | **Fixed enough** | Tier names unchanged, but the tap-for-legend is now on the counts themselves. |
| F10b icon-only header paste | **Not fixed (low)** | Header icon is still 44x44 with an `aria-label` only; the CTA row now has a text "Paste your repo" button, so a first-time user can find it. |
| F10c Notice link origin | **By design** | Notice ends "Details: http://localhost:8080/?scenario=...&repo=github/docs&open=notice" (page origin). |
| F10d Ask bar un-pins below ~560 px | **Not fixed (design trade-off)** | Keyboard sim and landscape: `position: static`, input at page y 1898 / 1693. The answer now reveals correctly in that mode. |
| Round 1 C10 uncaptioned autoplay | **Not fixed** | 12.4 s of counters, no caption (see fix 2 below). |
| Round 1 A5/A7/T3 drawer | **Mostly fixed** | Body 598 to 658 px; the WOULD_PULL chip subtitle and the next paragraph still say nearly the same sentence twice. `fix-01-open.png` |
| Round 1 S4 aborted duplicate `/api/timeline` | **Fixed on prod** | Only benign `ERR_ABORTED`: `POST /api/triage` when a page closes, one superseded `GET /api/exposure` under throttle. |
| Round 1 K/T/S items | **Hold** | Counts agree (hero, band, table, verdict); load CLS 0.0007; repo-name colours; share links round-trip. |

## 4. Scores (bar is 9)

| Area | Score | Why |
|---|---|---|
| Clarity | **8.5** | Subhead, early CTA, tappable counts, legend, verdict first, path inline on the selected row, evidence cards you can read. Held back by: 12 s of autoplay with no caption, `?repo=` links that mark nothing, the drawer's near-duplicate WOULD_PULL sentences, and a 17-line verdict sentence for a pasted repo at 320 px. |
| Speed | **8** | Verdict 0.4 to 0.8 s, drawer 0.11 s, prod FCP 3.3 s on Fast 3G + 4x CPU, CTA tappable on the skeleton. Held back by: paste result reflow (0.46 to 0.97 CLS, a 170 ms jump), the 250 ms collapse after tapping Run triage, and a dev origin that is blank for 30 s+ (irrelevant if the link is prod). |
| Correctness | **8.5** | Counts agree everywhere, 62/62, 53/53, 36/36 claims, clipboard contents right, no label collisions. One false statement: with Prod only on and a search that matches nothing, the table says "Every exposed repo here reaches the bad version through dev dependencies only" (13 of 20 WOULD_PULL are prod). |
| Trust | **9** | Evidence chip opens the exact card with its Cypher at the top, "62 of 62 claims traced to a graph query", "draft only, nothing is sent", replay and synthetic data are labelled, specific errors for unsupported lockfiles. |
| Delight | **8.5** | Instant verdict, answers land at the top, sticky Copy bar, inline "copied" status, Back works, landscape is now good. Cut by: the collapse flash on Run triage, the paste reflow, silent autoplay, and the remediation bar growing from 77 to 157 px. |
| Accessibility | **9** | axe 4.14: 0 violations in 10 states. 0 horizontal overflow, 0 text under 12 px, 0 targets under 44 outside sentences in 4 viewports, no hover-only meaning, content clears the bars. Misses: 30 px in-sentence chips (the proof gesture), Undo 31 px wide, focus ring on a programmatic Close focus, and iOS visual-viewport behaviour untested. |

Overall: (8.5 + 8 + 8.5 + 9 + 8.5 + 9) / 6 = **8.6**.

## 5. Ranked fixes to reach >= 9

1. **blocking-9 (speed, delight): the paste result reflows after the sheet closes.** Repro: 320x640 (also 375x812), fresh context, wait for "Play the 90 minutes", tap "Paste your repo", type `axios/axios`, tap Analyze, watch the five steps. Saw: sheet closes at 1.1 to 1.6 s, then in about 170 ms the page height goes 725 to 2377 and scrollY 0 to 371 to 508; CLS 0.97 at 320x640 (0.71 in one frame on `DIV.flex.flex-col.gap-3`), 0.46 to 0.61 at 375x812 (0.52 in one frame), plus three `FOOTER` shifts. When the analysis returns instantly CLS is 0.0002 to 0.03, so it is the slow (real) path. Expected: under 0.1, no visible jump. Suspected: `web/src/App.tsx` (closing the sheet and starting the auto-triage), `web/src/components/NarrativePanel.tsx` (narrative block mounts with no reserved height), `web/src/components/ToolFeed.tsx` (reveal after layout), `web/src/components/Sheet.tsx`. Hold the sheet until the verdict card has rendered, or give the feed `min-height` while a run is in flight. Shots: `pcls-320x640-axios_axios-end-700.png`, `-1300.png`.
2. **blocking-9 (clarity): the 12 s autoplay has no caption.** Repro: 375x812, open `http://localhost:8080/`, watch 12 s. Saw: counters and clock only; the first thing a LinkedIn visitor sees is numbers climbing with no sentence about what is happening (open since round 1). Expected: one caption line under the scrubber keyed to the playhead ("13:12 first bad version published", "13:16 alert", "14:26 first OSV record: scanners were blind for 74 min"). Suspected: `web/src/components/TimelineScrubber.tsx` or `web/src/App.tsx` (autoplay).
3. **blocking-9 (correctness): wrong empty-state message in the table.** Repro: 375x812, Run triage, Table tab, tap "Prod only", type `zzzz` in "Repo or team" (by the code, Prod only + tier MAINTAINER does the same; not run). Saw: "No prod exposures. Every exposed repo here reaches the bad version through dev dependencies only." with "0 of 21 shown"; the verdict says 13 prod and 7 dev-only. Expected: "No matching repos" with Clear filters. Suspected: `web/src/components/ExposureTable.tsx` lines about 471 to 483: `prodOnly && devOnly` is true whenever Prod only is on and any dev repo exists; it should test that the prod filter alone empties the list (no query, tier ALL). Shot: `misc-C-empty.png`.
4. **blocking-9 (clarity): a repo share link marks nothing.** Repro: 375x812, run triage, Table, tap a repo name, tap "Copy share link" (top right), open the link in a fresh context. Saw: `?scenario=...&repo=github/docs` runs the generic triage and shows the generic verdict; nothing says "you were sent github/docs"; a bad repo (`repo=nope/does-not-exist`) is ignored silently. Only `&open=fix|notice` opens the drawer. Expected: with `repo=` and no `open=`, open the drawer (or scroll the repo into view with the selected state), and say "Repo not in this scenario" for an unknown repo. Suspected: `web/src/data/urlState.ts`, `web/src/App.tsx`. Shots: `share-table-link-t1000.png`, `share-bad-repo-t1000.png`.
5. **nice-to-have (delight): Run triage collapses the page for about 250 ms.** Repro: 375x812, wait for autoplay to end, tap Run triage, screenshot at 150 ms. Saw: page height 1358 to 895 to 1827 to 2644, CTA y 502 to 250 to -101, a blank band and a half-built tool list (`flash-0.png`); raw layout shift about 1.1 (excluded from CLS only because it follows the tap). Expected: the feed section reserves its height as the run starts. Suspected: `web/src/components/ToolFeed.tsx`, `web/src/App.tsx`.
6. **nice-to-have (accessibility): the proof gesture has a 30 px target.** Repro: 375x812 after triage, measure the [E1] / [E2] chips: 41.6x30; claim-name chips 96 to 165 x 24 to 30. Meets WCAG 2.5.8 (24 px) but not the 44 px bar, and lines are close. Expected: a 44 px hit area (padding or a pseudo-element, no layout change). Also the outline on the opened E1 row touches the "E" (`e-375x812-E1.png`). Suspected: `web/src/components/PathChip.tsx`, `web/src/components/NarrativePanel.tsx`.
7. **nice-to-have (delight, accessibility): "Mark remediated" makes the sticky bar grow from 77 to 157 px and Undo is 31x44.** Repro: 375x812, open Fix on acme/checkout-web, tap Mark remediated. Saw: a status line, Copy fix, then a second row with "remediated 16 Oct, 03:46 GMT+5:30  Undo  ..."; the snippet's last line is covered (`drawer2-04-after-remediate.png`). Expected: a one-row bar (Copy fix + "Undo" at 44 px). Suspected: `web/src/components/FixDrawer.tsx`.
8. **nice-to-have (clarity): small things.** (a) The drawer header prints the WOULD_PULL subtitle and the next paragraph says nearly the same ("A fresh install during the window would fetch it" / "would have fetched the malicious version") (`FixDrawer.tsx`). (b) The 320 px verdict for a pasted repo is a 17-line sentence that inlines every lockfile pin (`NarrativePanel.tsx` or the server narrative). (c) The load skeleton shows a clipped "--:--" scrub bubble at x < 0 (`throttle-prod8080-first-text.png`; `TimelineScrubber.tsx`). (d) Dev origin :5173 is still blank for 30 s+ on 3G (77 requests, 4.0 MB); only matters if that link is shared.

## 6. Measurements

| Metric | Result |
|---|---|
| Horizontal scroll | **None** at 375, 390, 320, 812 in 10 states each (home, feed, expanded feed, graph, table, drawer, notice, paste, paste error) and in 5 share-link loads |
| Text under 12 px | **0** in all states and viewports (round 3: 10 runs at 11.7 px) |
| Targets under 44x44 | **0** outside sentences in portrait and landscape. In-sentence: 16 chips at 24 to 30 px high ([E1] 41.6x30, claim chips 96 to 165 x 24 to 30). After Mark remediated: Undo 31x44 |
| Content behind fixed bars | None found. Run triage clear at 375, 390, 320x640 (320x640: Try axios and Paste your repo peek above the bar and need a scroll). Last Feed, Graph and Table content clears the tab bar. Ask answer and evidence cards are above the Ask bar. No visible toast covers the Ask box |
| CLS | Load 0.0007; Run triage 0.0076 (raw with tap-adjacent shifts about 1.1); tabs 0 (raw 0.10); Ask 0.02 to 0.04 (keyboard sim 0.21 to 0.30 raw); Try axios 0.0004 to 0.008; paste instant 0.0002 to 0.03, paste with analysis 0.46 to 0.97; share link 0.0003 to 0.0155; rotate with drawer: raw 0.54 |
| Timing | CTA 0.42 s; legend 0.25 s; verdict 0.4 to 0.8 s; drawer 0.11 s; Ask answer 0.13 s; [E1] card 0.7 s; paste 5 steps 1.5 s, sheet close 1.6 s; share-link drawer 1.0 s |
| Load, Fast 3G + 4x CPU, cache off | prod :8080 first paint 1.66 s, FCP/LCP 3.28 s, CTA 3.15 s, 10 requests, 458 KB (run 2: 7 requests, 260 KB), tap to verdict 2.3 s; dev :5173 no text in 30 s, 77 requests, 4.0 MB |
| Hover-only behaviour | None found. Tier meaning is printed or tap-opened; the stale-clock explanation is a printed banner ("Showing exposure at 13:42 UTC. Paths and fix drafts belong to the triage run at 13:30 UTC."), not a `title`. `title` tooltips remain only as extras |
| axe-core 4.14 | 0 violations in 10 states (home, legend, feed, expanded, table, drawer, notice, graph, paste, paste error); incomplete: color-contrast, skip-link only |
| Console | 0 errors, 0 warnings, 0 page errors in about 40 sessions. Aborted requests only: `POST /api/triage` on page close, one superseded `GET /api/exposure` under throttle |
| Touch scrubber | Drag, tap and page-scroll-through-slider all work at 375 and 320; end bubble 20 px from the edge; clock and counts follow (13:00: 0 repos; 15:43: 1 repo) |
