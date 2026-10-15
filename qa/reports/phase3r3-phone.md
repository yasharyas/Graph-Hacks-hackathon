# Patient Zero: Phase 3 round 3, phone QA (LinkedIn/X-link persona)

Target `http://localhost:5173/` (Vite dev), with spot checks on the built app `http://localhost:8080/`. Chromium headless via Playwright, iPhone UA, `isMobile`, `hasTouch`, DPR 3, `tap()` and CDP touch for the scrubber. Viewports: 375x812 (main), 390x844, 320x640, 812x375. Every flow ran in a fresh browser context. Shots: `qa/reports/phase3r3-phone/` (names in brackets below).

Caveats, stated up front: headless Chromium has no soft keyboard, so "keyboard up" is simulated by shrinking the layout viewport (the Android "resizes-content" model). The iOS and Chrome-Android visual-viewport model is untested. WebKit was not available, so iOS-only behaviour (tap does not focus a `<button>`) is reasoned, not observed.

## 1. Verdict

**Overall 8.0 / 10. A real step up from round 2, still not a 9 on five of six areas.** Of round 2's ten findings, seven are Fixed (axios label collision, verdict wait, `?repo=` deep link, 320x640 CTA and paste error, scrub bubble, struck-through chips, target sizes in portrait), two are Partly (jargon and paste CLS), and landscape is Not fixed. The first screen now teaches itself: a plain subhead, a 44 px "?" legend with real definitions from first paint, Run triage at y 502 from the first frame, and a verdict that is on screen 0.3 s after the tap (round 2: 2.2 to 6.9 s with a blank gap). Paste validation, deep links, copy, Back, axe (0 violations in 10 states), 0 horizontal overflow and 0 console errors all hold up.

What still stops a 9 is mostly one repeating pattern: **the page scrolls "nearest", so the thing you just asked for lands underneath the pinned Ask bar.** After "Ask", the answer starts at y 677 behind the bar (top 667). After tapping an evidence chip like [E1], the opened tool card sits at the bottom edge with its Cypher out of sight. Add the 36 s blank load on the dev origin on 3G, a 4 s toast that sits on top of the Ask box, residual layout shift (0.08 per triage, 0.2 to 0.3 for the paste flow), 11.7 px text that returned in the verdict chips, and a landscape layout where the primary CTA is below the fold.

## 2. Timed friction log (375x812 unless stated)

T+ is from the start of each step; steps were run in separate fresh sessions.

| T+ | Step | What happened | Shot |
|---|---|---|---|
| 0.0 to 0.5 s | Land | Subhead, qix/axios/Describe chips, Pause, hero, **Run triage 181x44 at y 502**. CLS 0.0007. | `land-t00400.png` |
| 1.5 to 13 s | Autoplay | Counters 0 to 21, scrubber slides, "13:12 exposed / 13:16 alert / 14:26 OSV / 15:15 removed" labels staggered in two rows, no collisions. CTA never moves. Ends on "Play the 90 minutes". Still no captions or narration while it plays. | `land-t08000.png`, `land-settled.png` |
| +0.35 s | Tap "?" (while autoplaying) | Popover at x 75 to 363: LOCKED, WOULD_PULL, MAINTAINER, OSV defined in 12 px text, inside the viewport. Autoplay keeps ticking under it. Outside tap closes it (Chromium). The tier labels themselves are not tappable. | `legend-01-open.png` |
| +0.28 to 0.32 s | Tap Run triage (default clock, n=5) | Verdict card in view. "Picking the analyst observation..." and "Checking the claims against the graph..." show as progress. | `tri-t00150.png` |
| +1.4 to 2.3 s | Same run | Analyst pick lands, "61 of 61 claims traced to a graph query". Scrubbed clock (13:47, 13:52) and live graph query: verdict at 0.9 s, pick at 2.1 s. axios: 0.28 s / 1.39 s. | `tri-t00800.png`, `ttv-1352-end.png` |
| +0.14 to 4.2 s | Same run | Toast "Scrubber moved from 14:30 UTC to 13:30 UTC, the clock this triage ran at." sits at y 684 to 748, **on top of the Ask box**. `elementFromPoint` on the Ask input returns the toast. Dismiss button is 40x40. | `tri-t00150.png` |
| +0.7 s each | Tabs Feed / Graph / Table | Tab bar 125x55 each, CLS 0. Graph tab is a vertical path list (repo, dependency, malicious version, owner), not a drawn graph. Table opens flush at the card list. | `tabs-01-graph.png`, `tabs-01-table.png` |
| +0.5 s | Tap a repo row or name | Row tints and gets a tier bar; nothing else. The path is on the Graph tab. Repo name colour is plain, not link-coloured (className bug, see 5.8). | `row-01-after-name-tap.png`, `row-03-graph-path-mocha.png` |
| +0.21 s | Tap Fix | Full-screen drawer. Header, path, lockfile pins, then Fix / Notice tabs mid-screen; the fix text is below the fold. Tabs 44x44 and 63.7x44. | `fix-01-open.png` |
| +0.12 s | Copy fix, Copy message | Inline "Fix copied" beside the button. Clipboard verified (635 chars JSON + steps; Notice text with the Slack message). | `copy-01-fix-120ms.png` |
| +0.5 s | `goBack()` | Drawer closes, app stays, scroll 364 restored, focus returns to the Fix button. | `copy-04-after-back.png` |
| tap | Tap [E1] in the verdict "WHY" line | Page scrolls 416 to 904; the explain_path card opens but sits at the bottom edge, **its Cypher and args are behind the Ask bar**. | `e1-after-tap.png` |
| tap | Ask: tap input, type, tap Ask (no keyboard) | Echo "YOU ASKED..." at y 615, "Answered from the graph" at 644, **answer "NOTIFY" at 677, behind the Ask bar (top 667)**. Page never scrolls to the answer. 3,118 px page, scrollY stays 1697. Same at 390x844 (709 vs 699) and 320x640 (505 vs 495). | `ask2-375x812-answer.png`, `ask2-390x844-answer.png` |
| tap | Same, keyboard up (simulated 512 px tall) | The Ask bar un-pins (`position: static`, because the 560 px media query fails), the page jumps 416 to 1929 (+1,513 px) to the input. Input stays visible and not under the tab bar. After Ask the answer starts at the very bottom edge, cut in half by the tab bar. | `ask2-390x844-kb300-answer.png`, `ask2-320x640-kb260-answer.png` |
| +0.5 s | Open the paste sheet | Full-height sheet, input 44 px / 16 px font, not auto-focused (no keyboard pop). Targets all 44. | `paste-375x812-01-open.png` |
| +0.3 s | Type `hello world` / `gitlab.com/foo/bar` | Inline messages ("That is not a repo address...", "Only github.com repos can be analysed..."), `aria-invalid`, focus stays in the input. `owner/name` accepted. | `paste-375x812-02-invalid.png` |
| +2.5 s | Missing repo | Error and sample-repo chips render at y 77 to 320, **above** the form, in view at 375, 390 and 320x640. | `paste-375x812-03-error.png` |
| +0.8 s | Paste `axios/axios` | 5-step progress ("Step 5 of 5: check ranges") by 0.8 s; sheet closes at 1.5 s; hero "1 repo one install from malware", table "1 of 1 exposed", consistent. CLS in this flow 0.21 to 0.33. | `paste-375x812-05-result-feed.png` |
| 0 to 6 s | Try axios 2026 | Runs the triage straight away; scrubber labels on three staggered rows, 0 overlaps at 375, 390, 320. CLS 0.07 / 0.07 / 0.11 (320). | `labels-top-320x640-axios-after-try.png` |
| tap | Rotate to 812x375 with the drawer open | Drawer docks right (x 392, 420 wide), **scrolling body 163 px tall** of 375. CLS 0. Fresh landscape load: Run triage at page y 671, below the fold. Table sort headers 36x18, 45x18, tier "?" 24x24. | `rot-01-drawer-landscape.png`, `aud-812x375-02-home-settled.png` |
| +0.4 s | Open a share link in a fresh mobile context | `?repo=github/docs&open=notice`: drawer on the right repo and tab at 0.4 s. A link with only `?repo=` shows the generic verdict and the toast; nothing marks the repo. | `share-drawer-link-t400.png`, `share-table-link-t1000.png` |

## 3. Round-2 items

| Item | Status | Evidence |
|---|---|---|
| F1 (P1) Try axios 2026 label collision | **Fixed** | Measured label boxes at +0.3/1.2/3/6 s: 3 rows (tops 16 px apart), 0 overlaps, 0 outside viewport at 375, 390, 320. `labels-top-320x640-axios-after-try.png` |
| F2 (P2) Verdict wait with no progress | **Fixed** | Verdict in viewport 0.28 to 0.32 s (n=5), 0.9 s on a scrubbed clock; LLM pick 1.4 to 2.3 s with "Picking the analyst observation..." text. `tri-t00150.png` |
| F3 (P2) `?repo=` deep link ignored | **Fixed** | `?repo=acme/checkout-web&open=notice` opens that drawer, Notice tab, at 0.4 s. `share-notice-origin-link-t1000.png` |
| F4 (P2) 320x640: CTA under nav, paste error off-screen | **Fixed** | Run triage y 524 to 568 vs tab bar 584; error y 77 to 320 above the form. Try axios and Paste wrap below the bar and need a scroll (header has its own paste icon). `aud-320x640-02-home-settled.png`, `aud-320x640-08-paste-error.png` |
| F5 (P2) Paste CLS 0.94 | **Partly** | 0.21 to 0.33 at 375 (0.12 at sheet close, then 0.0585 x2 from the claims block); 0.12 to 0.15 at 320x640. Down 3x to 4x, still over 0.1. |
| F6 (P2) Ask: struck-through chips, "not returned" | **Fixed** | "Which team first?" gives "35 of 35 claims verified", 0 struck-through; prod-only 22 of 22; checkout-web 12 of 12. `askf6-Which-team-first-.png` |
| F7 (P3) Targets under 44 | **Partly** | Portrait: Fix 44x44, drawer tabs 44 and 63.7x44, tool toggles and claims summary >= 44 (0 non-sentence misses in Feed, Table, Graph, drawer, paste sheet). New: toast Dismiss 40x40. In-sentence evidence chips 24 to 32 px high (WCAG 2.5.8 exempt). Landscape: sort headers 36x18, "?" 24x24. |
| F8 (P3) Scrub bubble flush to the edge | **Fixed** | End of track: 20 px gap at 375, 320 and 390. `scrub-375-end.png` |
| F9 (P3) Landscape: CTA below fold, drawer body 187 px | **Not fixed** | Run triage at page y 671 of 375; drawer body 163 px (docked) to 189 px (fresh load). `aud-812x375-02-home-settled.png`, `rot-01-drawer-landscape.png` |
| F10a Jargon labels | **Partly** | "?" legend explains them from first paint. Labels are still LOCKED / WOULD_PULL / MAINTAINER; on a phone the plain sublabels are dropped (shown from 640 px). `legend-01-open.png` |
| F10b Icon-only header paste button | **Not fixed** | Still a 44x44 upload-arrow icon; text "Paste your repo" is screen-reader only. `header-320x640-report-top.png` |
| F10c Notice link carries the page origin | **By design** | It uses `location.href`; on localhost it prints localhost. Not testable here. |
| F10d Ask bar un-pins below ~560 px tall | **Not fixed (design trade-off)** | With the simulated keyboard the input jumps +1,513 px; in landscape the input is at page y 2029 of 2334. `ask2-390x844-kb300-answer.png`, `rot-04-feed-bottom-landscape.png` |
| Round 1 C2 (CTA early) | **Fixed** | 44 px CTA at y 502 (375, 390) and 524 (320x640) from first paint |
| Round 1 C3 / D2 (Graph tab empty) | **Fixed** | Path list, `tabs-01-graph.png` (still a list, not a drawn graph) |
| Round 1 S1 (blank load on dev server) | **Not fixed** | Fast 3G + 4x CPU, :5173: first paint **36.0 s**, FCP 36.7 s, 75 requests, 6.9 MB. :8080: FCP 3.4 s, 8 requests, 276 KB. `throttle-dev5173-first-text.png`, `throttle-prod8080-first-text.png` |
| Round 1 K6 (bubble) / K5 (axios ring) / K3 / K4 | **Fixed** | 20 px gap; "105 min" inside its ring (`axios-scribble.png`); "1 repo"; no long floats in the feed |
| Round 1 C4 (row tap silent) | **Partly** | Tint plus bar only; path lives on another tab. Repo name looks inert. |
| Round 1 C10 (uncaptioned autoplay) | **Not fixed** | 11 to 13 s of counters with no caption |
| Round 1 A2 (11 px text) | **Regressed (marginal)** | 10 runs at **11.7 px** in the verdict "WHY" evidence chips at every viewport (round 2: 0 runs) |
| Round 1 A5 / A7 / T3 | **Partly / unchanged / Partly** | Drawer body 163 to 189 px (was 135); header 117 px at both 320 and 375; Notice tab still stacks two near-identical WOULD_PULL sentences under the chip |
| Round 1 S4 (aborted duplicate `/api/timeline`) | **Fixed on prod, still on dev** | Absent on :8080; one `ERR_ABORTED` per load on :5173 (benign) |
| Round 1 A3 Back closes drawer, K1/T1 counts, C7 paste messages, S2 load CLS, S3 compression | **Fixed** | Back closes with scroll and focus restored; hero "1 repo" and table "1 of 1" agree; load CLS 0.0007; prod 276 KB over 8 requests |

## 4. Scores (bar is 9)

| Area | Score | Why |
|---|---|---|
| Clarity | **8** | Subhead, early CTA, verdict first, "?" legend, path list. Held back by: "?" sits beside Pause, about 100 px above the counts it explains, and the labels are not tappable; "paths + owners" reads as MAINTAINER's sublabel; unexplained "Scrubber moved" toast; Ask answer and evidence cards land under the bar; landscape first view has no CTA. |
| Speed | **7** | Verdict 0.3 s, triage tap to proof 2 s, paste 1.5 s, deep link 0.4 s. But the dev origin is 36 s blank on 3G (this score would be 8 if the shared link is the production build: FCP 3.4 s), paste flow CLS 0.2 to 0.3, triage CLS 0.08. |
| Correctness | **9** | Counts agree everywhere, clipboard and share links are right, claims 35/35, 61/61, labels never collide, pasted repo numbers consistent. Small: duplicate WOULD_PULL sentences in the drawer; repo-name `text-link` class dropped. |
| Trust | **8** | "61 of 61 claims traced", visible Cypher, "draft only, nothing is sent", demo org labelled. But the headline proof gesture (tap [E1]) shows the evidence card at the bottom edge with the query hidden. |
| Delight | **8** | Instant verdict, drawer in 210 ms, inline "Fix copied", Back works. Cut by: answer hidden after Ask, the toast on the Ask box, paste jump, silent autoplay, Graph tab that is not a graph. |
| Accessibility | **8** | axe 4.14: 0 violations in 10 states. 0 horizontal overflow in 4 viewports. Portrait targets >= 44 except the toast Dismiss. Misses: 11.7 px verdict chips, landscape sort headers 18 px and 24 px "?", 163 px landscape drawer body, soft keyboard and iOS blur-close untested. |

## 5. Ranked fixes to reach >= 9

1. **blocking-9 (clarity, delight, trust) - the Ask answer lands behind the Ask bar.** Repro: 375x812, tap Run triage, tap the Ask input, type "Which team first?", tap Ask. Saw: echo at y 615, "Answered from the graph" 644, answer at 677, Ask bar top 667, scrollY fixed at 1697 (also 390x844: 709 vs 699; 320x640: 505 vs 495; with a simulated keyboard the answer starts on the tab bar edge). Expected: the answer's first lines are readable above the bar after the answer arrives. Suspected: `web/src/components/ToolFeed.tsx` line ~77 (`scrollPaneTo(lastRef.current)` runs on `followUps.length`, when only the echo exists) and `web/src/components/scrollPane.ts` (`scrollIntoView({ block: 'nearest' })` on phones). Scroll again with `block: 'start'` and a scroll margin when `narration` arrives.
2. **blocking-9 (trust) - evidence chips open a card you cannot read.** Repro: 375x812, after triage tap `[E1]` in the verdict WHY line. Saw: scrollY 416 to 904, explain_path card header at about y 542, body (args, Cypher) behind the Ask bar (`e1-after-tap.png`). Expected: the card top near the top of the screen with the Cypher visible. Suspected: same `scrollPaneTo` path (`trace()` in ToolFeed).
3. **blocking-9 (speed) - dev origin is unusable on 3G.** Repro: 375x812, CDP Fast 3G (1.6 Mbps, 562 ms RTT) + 4x CPU, open `http://localhost:5173/`. Saw: first paint 36.0 s, 75 requests, 6.9 MB. Expected: under 4 s. The production build on :8080 does 3.4 s FCP with 276 KB. Make sure the link people tap is the production build (or put a static shell and preloads in `web/index.html`).
4. **blocking-9 (speed) - layout shift is still visible.** Repro: 375x812, Paste your repo, `axios/axios`, Analyze. Saw: CLS 0.21 to 0.33 (0.12 at the instant the sheet closes, `DIV.scroll-pane`; then 0.0585 x2 from `DIV.flex.flex-col.gap-1.5.transition-opacity`). Every Run triage also adds 0.08 from the same claims block. Expected: under 0.1. Reserve that block's height from the first frame of "Checking the claims..." (suspect `web/src/components/NarrativePanel.tsx`), and avoid the scroll-pane resize when the sheet closes.
5. **blocking-9 (accessibility) - 11.7 px text is back.** Repro: any viewport after Run triage; measure the verdict "WHY" chips (`acme/checkout-web`, `debug@4.4.2`, `^5.0.1`...). Saw: 10 runs at 11.7 px (0.975em of 12 px); 0 in round 2. Expected: a 12 px floor. Suspected: claim chip styles in `NarrativePanel.tsx` or `PathChip.tsx`.
6. **nice-to-have (delight, clarity) - the first-triage toast covers the Ask box.** Repro: 375x812, wait for autoplay to end, tap Run triage. Saw: "Scrubber moved from 14:30 UTC to 13:30 UTC..." for 4.1 s at y 684 to 748; a tap on the Ask input lands on the toast; Dismiss 40x40. Expected: no toast when the scrubber only left the autoplay's resting point (`web/src/App.tsx`, effect on `triage.at`), or a top position and a 44 px Dismiss.
7. **nice-to-have, but needed for a 9 in accessibility on landscape - 812x375.** Repro: fresh load at 812x375, then Table and a Fix drawer. Saw: Run triage at page y 671 of 375; drawer scroll body 163 to 189 px with the Fix text off-screen; table sort headers 36x18 and 45x18; tier "?" 24x24. Expected: a CTA in the first view, a drawer body of at least 240 px, 44 px header targets (`TimelineScrubber.tsx`, `FixDrawer.tsx`, `ExposureTable.tsx`).
8. **nice-to-have (clarity) - the legend is hard to connect to the counts, and row taps look inert.** Repro: 375x812 home, tap "WOULD_PULL 20"; open Table, tap a repo name. Saw: nothing happens; the "?" is 100 px away beside Pause; "paths + owners" is printed after "0 MAINTAINER"; repo names are not link-coloured because `pointer-coarse:py-2${done ? ... : 'text-link'}` in `ExposureTable.tsx` (repoCell, about line 292) lacks a space, so `text-link` never applies. Expected: tappable tier labels that open the legend, a space in that class string, and a toast or auto-scroll on row select. Also: a `?repo=` link without `open=` should open the drawer; a pointerdown-outside listener would remove the iOS risk that the legend only closes on blur.

## 6. Measurements

| Metric | Result |
|---|---|
| Horizontal scroll | **None** at 375, 390, 320, 812 in 10 or more states each (home, legend, feed, expanded feed, graph, table, drawer, notice, paste, paste error, share-link loads) |
| Text under 12 px | 0 on home, Graph, Table, drawer, paste. **10 runs at 11.7 px** in the verdict chips (Feed) |
| Targets under 44x44 | Portrait: only toast Dismiss 40x40 (+15 in-sentence chips at 24 to 32 px). Landscape: sort headers 36x18, 45x18, "?" 24x24, 36x18 |
| Content behind fixed bars | Run triage clear at 375, 390, 320x640. Ask answer (+ evidence card) behind the Ask bar. Last Table row clear of the tab bar. Toast over the Ask box for 4.1 s |
| CLS | Load 0.0007; Run triage 0.081; tabs 0; row tap 0; drawer open and Back 0; Ask 0; rotate 0; Try axios 0.07 / 0.07 / 0.11 (320); paste 0.21 to 0.33; share link 0.07 to 0.09 |
| Timing | CTA 0.4 to 0.5 s; verdict 0.28 to 0.32 s (default clock), 0.9 s (scrubbed); LLM pick 1.4 to 2.3 s; drawer 0.21 s; paste 5-step 0.8 s; share-link drawer 0.4 s |
| Load, Fast 3G + 4x CPU | dev :5173 36.0 s first paint (75 req, 6.9 MB); prod :8080 FCP 3.4 s (8 req, 276 KB, CLS 0) |
| Hover-only behaviour | None found: tier meaning is printed in the cards and drawer; hover tooltips are only an extra |
| axe-core 4.14 | 0 violations in 10 states (home, legend, feed, expanded feed, table, drawer, notice, graph, paste, paste error) |
| Console | 0 errors, 0 warnings, 0 page errors in about 30 sessions. Aborted requests only: duplicate `GET /api/timeline` (dev only) and `POST /api/triage` when the page closes |
