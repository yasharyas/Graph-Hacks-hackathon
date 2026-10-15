# Patient Zero: impeccable critique + audit, round 2 (Phase 3r2)

Method: DEGRADED single-context (delegated sub-agent, so assessments A and B were not split; design review ran first, detector second). Live app, Playwright headless Chromium, real API plus `?mock` for layout probes. No server touched, no source edited. Screenshots in `qa/reports/phase3r2-impeccable/`; scratch in `qa/tmp/impeccable/`.

## Verdict

Round 1's blockers are gone. At 1366x768 a judge now sees the table and 6 rows straight after Run triage (round 1: none), the 74-minute payoff waits for the playhead, axios no longer flips its number, and errors are neutral. It reads as authored, not templated. Still costing points: the paste flow crushes the panes, the FalkorDB proof sits under a long narrative, and table type is cramped.

## Scores

| | Round 1 | Round 2 |
|---|---|---|
| Design health (Nielsen, /40) | 27 | **31** (status 4, the other nine 3) |
| Audit (/20) | 15 | **17** (a11y 3, performance 4, responsive 3, theming 4, integrity 3) |

Measured: CLS 0.005 on landing, 0.036 after the run (round 1: 0.087, 0.212); triage 4.1 s. Contrast scan of visible text on landing, post-triage and drawer: 0 failures at 4.5:1. Fonts rendered: Satoshi Variable, Martian Mono, Cabinet Grotesk on "74 min"; no banned font or fallback. Motion: no `transition: all`, no `ease-in`, nothing over 300 ms, 0 infinite animations after the run; reduced motion shows the final state at once (`r-reduced-motion-landing.png`). Horizontal overflow 320 to 1920: none on landing, paste panel or drawer.

## Slop detector

- CLI `detect.mjs web/src`: **0**.
- Browser overlay (skill bundle injected, no server): **28** landing, **125** after the run, **130** with the drawer, **4** on a phone.
- True positives: `tiny-text` only, 69 instances of 11 px (arg chips, tier chips, headers); `cramped-padding` x8-13 borderline. False positives: `text-overflow` x21 (sr-only mirror), `gradient-text` x1 (the overlay itself), `nested-cards` x16 (specified controls, tool cards), `clipped-overflow` x2-3, `all-caps-body` x8 (11 px labels).
- AI tells: **0**. Probes: backdrop-filter, gradients, resting shadows, radius above 14 px, emoji all 0; hues are red, amber, blue, green only.
- Scribbles feel drawn, not pasted (`z-scribble-74min.png`, `z-scribble-contrast-arrow.png`).

## Findings

**P0: none.**

**P1-A. The paste panel crushes the working panes.** Open, it leaves the panes 280 px at 1440x900 and about 157 px once an error or progress block appears. At 1366x768 the graph is a sliver, Run triage is cut off, and autoplay keeps ticking behind it. This is the guest-repo demo path. Shots: `s-paste-1366x768.png`, `09d-paste-analyzing.png`, `09b-paste-error-invalid.png`. Fix: render it as an overlay or right drawer like Fix (`PasteBox.tsx`, panel state in `App.tsx`), or collapse the band while open, and call `playback.pause()` on open.

**P1-B. The FalkorDB proof is buried.** After a run the feed shows about 700 px of narrative; the tool calls ("49 calls, 860 ms") sit below it. Cypher is two clicks (expand card, then Cypher), yet the hint says "Open Cypher in the feed". Shots: `03-after-qix-triage.png`, `07-toolcard-cypher-plan.png`, `14-graph-stats.png`. Fix: cap the verdict at about 6 lines with "Read more", put the tool-call header and first card above the fold, auto-open the first card's Cypher (`ToolFeed.tsx`, `ToolCard.tsx`), reword the hint to "Open a tool call, then Cypher".

**P2-A. Table geometry.** Rows are 53-86 px against the 36 px spec. The Path column breaks identifiers at hyphens ("ansi-/styles@6.2.2", "@typescript-/eslint/parser") and 11 px text fills the chips. Shot: `s-triage-1366x768.png`. Fix: `ExposureTable.tsx` path cell `whitespace-nowrap` plus ellipsis and `title`, or widen `--pane-right` to 520 at 1440; raise `--text-2xs` to 12 px.

**P2-B. The chip wall persists in Ask answers and Notify.** The prod-only answer is 14 boxed mono chips plus `[E#]` tags. Shots: `08-ask-answer.png`, `03c-feed-narrative.png`. Fix: in `NarrativePanel.tsx` chip only the first mention, render repeats as dotted-underline text, set `[E#]` as superscript.

**P2-C. Keyboard and touch residue.** 126 tab stops after a run (21 repo links, 21 Fix buttons, 13 card heads), no arrow-key rows, 21 empty `aria-live` regions, Fix is 40x44 on touch, repo links 20 px tall. Fix: roving tabindex in the table, mount live regions only with content, `min-w-11` on Fix.

**P2-D. 1024-1279 layout.** At 1024x768 the table header sits at y=1297, below the fold (`s-triage-1024x768.png`). Fix: at `lg` put the table in the right column and fold the graph into a collapsible row.

**P2-E. Primary and scribble discipline.** The alert panel adds a second primary "Run triage" (`13e-alert-banner-run.png`). The landing end shows three scribbles (contrast arrow, 74-min, empty-lockfile) against the two-per-viewport rule, and three buttons labelled "Run triage" (`02-landing-after-autoplay.png`).

**P3.** The rewind toast covers the Ask input for 4 s (`z-toast-rewind.png`). Enter does not submit the alert textarea. "Show plan" never flips to "Hide plan". "Why:" is styled unlike VERDICT and NOTIFY. Hero counter is 40 px against the spec's 80 px and Cabinet Grotesk appears twice (fix the spec or the code). The last scrubber label clips at 320-375 in desktop browsers only (`s-triage-320.png`; mobile-emulated 320 is clean).

## Round-1 regression

| Item | Status | Evidence |
|---|---|---|
| P0-1 table below fold | FIXED | 6 rows at 1366x768 and 1280x720, 9 at 1440x900 |
| P1-1 chip overlap, row height | PARTLY | chip fits; rows still 53-86 px |
| P1-2 74 min on frame one | FIXED | appears only at 14:30 |
| P1-3 axios 128 to 105 | FIXED | 105 everywhere, ring fits (`11b`) |
| P1-4 axios label collision | FIXED | three label rows |
| P1-5 phone result below fold | FIXED | `m-03`, hint hidden under 1024 |
| P2-1 chip wall | PARTLY | verdict fixed, Ask answer not |
| P2-2 repeated numbers | PARTLY | clock 3x, hero 40 px |
| P2-3 three primaries | PARTLY | one primary, alert panel adds one |
| P2-4 "a bad package" | FIXED | "ansi-styles, debug +17" |
| P2-5 hint | FIXED | post-report, desktop, no shift |
| P2-6 silent rewind | FIXED | toast verified |
| P2-7 red errors | FIXED | neutral (`13a`, `13b`) |
| P2-8 mono share | PARTLY | 72% to 53% of glyphs |
| P2-9 left edges | PARTLY | band 24 px, panes 12 px |
| P2-10 drawer footer | FIXED | one row plus overflow |
| P2-11 21 Fix buttons | FIXED | ghost text |
| P3-1 red outside infection | PARTLY | amber chain still red |
| P3-2 scenario control | FIXED | 48 px on touch |
| P3-3 badge copy | FIXED | "59/59 claims traced" |
| P3-4 legend | PARTLY | still 7 entries |
| P3-5 hop dots | FIXED | contrast passes |
| P3-6 exec summary | FIXED | strip, shares sum to 100 |
| P3-7 first-timer gap | PARTLY | purpose line; favicon still `data:,` |
| P3-8 live regions | STILL OPEN | 21 empty |
| P3-9 dead wiring | FIXED | removed |

## Personas (1-10)

Clarity **8** (purpose line, contrast card, tiers; proof buried). Delight **8** (74-min pen loop, path draw-on). Accessibility **7** (0 contrast failures, 2 px focus ring, reduced motion honoured; 126 tab stops, 11 px text, 40 px targets).
