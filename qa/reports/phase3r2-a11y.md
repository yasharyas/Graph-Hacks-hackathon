# Patient Zero: Phase 3 round 2, keyboard and screen-reader QA

Persona: keyboard-only screen-reader user (AX tree plus a live-region recorder). Headless Chromium at 1440x900, 375x812, 720x450 (200% zoom), 320x256. axe-core 4.14.0 (repo copy). No repo file edited. Screenshots: `phase3r2-a11y/`.

## Verdict

**Automated gate: PASS (0 serious, 0 critical, 0 violations in all 9 states, also under wcag22aa + best-practice).** **Manual accessibility bar: not met (7/10).** Round 1 is almost fully fixed, but axe cannot see 2 new P1 and 4 P2 issues: focus hidden behind sticky bars, announcement spam, focus loss, a focus-stealing radio group, and state lost in forced colors.

## axe table

| # | State | Violations (serious/critical) | Incomplete (manual verdict) |
|---|---|---|---|
| 1 | Landing, autoplay running | 0 (0) | 0 |
| 2 | Landing, autoplay paused | 0 (0) | 1 `h1` contrast, overlap; passes |
| 3 | After qix triage | 0 (0) | 1 "?" tier-help: visible "?" vs name "What the tiers mean" (P3) |
| 4 | Fix drawer open | 0 (0) | 0 |
| 5 | Notice tab | 0 (0) | 0 |
| 6 | After Ask answer | 0 (0) | 28 contrast (overlap; manual min 4.94:1), same "?" |
| 7 | Paste panel with error | 0 (0) | as 6 |
| 8 | After axios triage (clean rerun) | 0 (0) | same "?" |
| 9 | 375x812 after triage (Feed, Graph, Table, landing) | 0 (0) | skip-link false positive; 1 tab contrast overlap |
| + | 200% zoom: landing, triage, drawer | 0 (0) | 0 |

**Totals: 0 critical, 0 serious.** My own contrast sweep (about 1,650 text nodes incl. placeholders): 0 failures, minimum 4.94:1. No unnamed controls, role-less `aria-label`, duplicate ids or skipped heading levels.

## Keyboard friction log

1. Tab order is logical, every stop has a 2px ring. Skip link focuses `main#results`, ring visible.
2. Enter on "Pause the autoplay" flips it to "Resume the autoplay" with focus kept (also when autoplay ends alone). Run triage is 8 Tab from the top. Focus then lands on the "Tool feed" region with a ring. Seven status messages, not spam. Triage took 1.7-8.7 s (shared server).
3. Next stops are "Skip to Ask" and "Skip to exposure table" (work). Without them, 78 stops. Row Enter announces "Selected acme/checkout-web: ... debug@4.4.2". Fix opens a native modal, focus on Close; Esc or Close returns focus to "Fix acme/checkout-web". Tab exits to browser chrome and back (native, not a trap).
4. Drawer tabs: arrows wrap and activate; **Home/End do nothing**. Copy announces "Slack message copied". "More actions" disclosure: Tab walks items, Esc closes it, then the drawer.
5. Slider: arrows, PageUp/Down, Home/End work; valuetext "13:06 UTC, 0 repos exposed".
6. Claim chip or `[E1]` Enter: focus moves to the proving card header and is announced ("Opened explain_path, acme/checkout-web, the call that returned E1 ...").
7. Cards toggle with Enter/Space and `aria-expanded`. "Show all 19 rows" loses focus (P2-1); "Show 18 more" strands it (P2-3).
8. Ask works by keyboard; focus stays in the input.
9. Paste: invalid input gives `aria-invalid` plus `role=alert`; unknown repo gives a clear alert with samples; Esc closes and returns focus; typed lockfile triages and focuses the feed; hero re-scopes to "1 repo".
10. Reduced motion: autoplay off (frozen at 14:30), 0 animations, static graph, 0s drawer. 200% zoom and 320px: no horizontal scroll.

## Findings

**P0:** none.

**P1**
1. **Focus hidden behind sticky UI** (2.4.11, 2.4.7). Tabbing the Narrative at 1440x900, 14 of 90 stops are fully covered by the sticky Ask bar (`mozilla/pdf.js`, `QA`, `#team-qa`); at 720x450 the Panels bar hides 19; at 375 about 19. No ring visible (`FNO-1440x900-mozilla-pdfjs.png`, `FNO-720x450-appium.png`). Fix: `scroll-padding-bottom` at least the bar height.
2. **Live-region spam** (4.1.3, 2.2.2). After a triage, autoplay made **74 announcements in 15 s**; each slider step fires 2 status messages ("The clock moved to ..." plus "Updating to ... showing 13:30 meanwhile"), 20 per 10 presses, duplicating `aria-valuetext`. Fix: one region, debounce until the scrub settles.

**P2**
1. **Focus lost to `<body>`** (2.4.3): "Dismiss" on the hint strip; "Show all N rows" in cards (reproduced twice).
2. **Radio group steals focus** (3.2.2): after a triage, ArrowRight on qix selects axios, silently re-runs triage and moves focus to the feed; "Describe an alert..." is unreachable without that.
3. **"Show N more calls"**: new cards insert above the toggle, which jumps to y=2660, out of view (2.4.7); not announced.
4. **Forced colors** (1.4.1, 1.4.11): selected scenario radio, selected drawer tab (both underlined) and selected row look identical (`J11-fc-zoom-*.png`). Add `@media (forced-colors: active)` Highlight borders.

**P3:** Home/End on drawer tabs; "0 of 0 tools done" at every run; Ask answer sits before the input, not announced (2.4.3); 3x "Run triage", 2x "Paste your repo", about 40 landmarks named "Query" when expanded; "?" and "[E1]" names cryptic (2.5.3).

## Round-1 regression

| R1 item | Status | Evidence |
|---|---|---|
| A-1 P1 export label-in-name | FIXED | drawer axe 0; exports in "More actions" |
| A-2 P2 Pause unmounts under focus | FIXED | focus kept on "Resume the autoplay" |
| A-3 P2 71 stops | FIXED | in-feed skip links; 78 stops remain without them |
| A-4 P2 row selection silent | FIXED | "Selected ..." status |
| A-5 P2 `aria-label` on spans | FIXED | 0 such spans |
| A-6 P3 invisible focus targets | FIXED | rings on `main`, feed, `#exposures` |
| A-7 P3 contrast | FIXED | placeholders 5.23:1 |
| A-8 P3 375 Panels nav | FIXED | focus enters panel; but see P1-1 |
| A-9 P3 Esc on paste | FIXED | closes, focus returns |
| A-10 P3 chip feedback | FIXED | focus move plus announcement; unique headings |
| C-1..C-5, X-3 | FIXED | no overlaps; hero re-scoped |
| S-2 CLS | FIXED | 0.139 to 0.005 |
| S-3 "narrative ready" | PARTLY | "All claims verified" only |

## Scores (bar 9)

| Dimension | Score | Why |
|---|---|---|
| Clarity | 9 | Unique card names, "Selected/Opened" messages; selection lost in forced colors |
| Speed | 9 | CLS 0.005, 1-2 Tab to Ask/table via skip links |
| Correctness | 8 | Data right; hidden focus, 2 focus losses, radio side effect |
| Trust | 9 | Claims traced, alerts on errors, 0 console errors |
| Delight | 9 | Reduced motion honoured, chips jump to evidence |
| Accessibility | 7 | axe clean, but 2 P1 and 4 P2 |

## Console

0 console errors, 0 page errors, 0 HTTP >= 400 in every run. One dev warning under reduced-motion emulation only (motion library). `net::ERR_ABORTED` on `/api/timeline`, `/triage`, `/ask`, `/analyze`, `/exposure` are client fetch cancels.
