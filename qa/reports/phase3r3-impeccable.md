# Patient Zero: impeccable critique + audit, round 3 (Phase 3r3)

⚠️ DEGRADED: Assessment A (design review) ran as an isolated sub-agent that never saw the detector, the measurements or the earlier reports; Assessment B (detector, browser evidence, measurements) ran in the reviewing agent's own context and was read before A returned, so this synthesis is anchored on B. Live app at `http://localhost:5173` (Vite dev; real API, `?mock` only where noted), Playwright headless Chromium at 1440x900, 1366x768 and 375x812, plus 320 to 1920 sweeps. No server touched, no source edited. Screenshots in `qa/reports/phase3r3-impeccable/`; scripts and logs in the session scratchpad (`r3/s1-main.js` … `s5-checks.js`, `*-log.json`). Captures were taken 01:50 to 02:10; the dev server may have hot-reloaded between passes (one touch-target pass read 18 to 24 px where two later passes read 44 px; the 44 px passes are the ones cited).

## Verdict

Both round-2 P1s are gone: the paste flow is a 420 px sheet that leaves the panes untouched and pauses the autoplay, and the FalkorDB proof is above the fold on a 768-tall laptop (tool-call header at y = 536, Cypher opens with the card). The keyboard residue is gone too (126 tab stops to 29, 21 empty live regions to 3), the 12 px floor holds, and no font but Satoshi, Cabinet Grotesk and Martian Mono renders a glyph anywhere. It reads as authored: the time spine (clock chip, `as of` stamp, "Back to 13:30 UTC"), the path-chip grammar on every surface, and the pen loop around "74 min" are this product's and nobody else's. What still costs points is craft at the payoff moment: a toast lands on the Ask box on every first run, the landing offers three "Run triage" buttons, the path column truncates the one part of a package name that differs between rows, and the `as of` stamp is read (and seen) mid-sentence. All four are under an hour each. **Ship-ready for the judging bar after the five blocking fixes below.**

## Scores

| | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| Design health (Nielsen, /40) | 27 | 31 | **33** |
| Audit (/20) | 15 | 17 | **19** |
| Delight (1-10) | – | 8 | **7** |
| Clarity (1-10) | – | 8 | **8** |

Nielsen (A scored 32 unanchored; the synthesis moves Status to 4 on B's evidence of radar-only-while-pending, staged analyze progress and the scrub-back strip, and keeps everything else where A put it):

| # | Heuristic | R2 | R3 | Key issue |
|---|---|---|---|---|
| 1 | Visibility of system status | 4 | 4 | ms badges, radar only while pending, "N of N tools done", scrub-back strip; the one defect is placement: the "Scrubber moved" toast covers the Ask box |
| 2 | Match system / real world | 3 | 4 | plain tier subtitles everywhere, overrides JSON, UTC; graph stats still leak `RESOLVES_TO` / `PKG_DEPENDS` unexplained (`02c`) |
| 3 | User control and freedom | 3 | 3 | Undo, Esc, Back, pause-first; "Cancel run" exists only inside a repo drawer's "…" menu (`FixDrawer.tsx:332`); filtered-empty has no "Clear filters" |
| 4 | Consistency and standards | 3 | 3 | three labels for one action (Run triage / Run triage at 13:30 UTC / Run again); two tier legends with different content (`02b` 4 rows, `15d` 3 rows); "sample repo" is a chip in the table and plain text in the drawer |
| 5 | Error prevention | 3 | 3 | URL and lockfile validated on blur with a fix; Enter in the alert field inserts a newline (spec says it runs); "Run again" discards follow-ups without a word |
| 6 | Recognition rather than recall | 3 | 3 | `••`, `[E1]`, `direct`, `cached` are explained only in tooltips or sr-only; truncated path names make the reader recall which `@typescript-eslint/*` a row is |
| 7 | Flexibility and efficiency | 3 | 3 | arrow keys in the table, Shift+Arrow on the scrubber, Expand all, export, share links; no way to run from the keyboard without reaching a button, Ask capped and disabled until the run ends |
| 8 | Aesthetic and minimalist | 3 | 3 | clock printed three times on landing; verdict is a 12-row wall in a 296 px measure; six same-weight header pills at 1536+; 7-entry graph legend; three CTAs that say the same thing |
| 9 | Error recovery | 3 | 4 | cause + fix + `requestId` + action, neutral not red, on desktop and phone (`13a`, `13b`, `m-13-error-triage.png`) |
| 10 | Help and documentation | 3 | 3 | one hint card, two "?" legends, the purpose line, the footer glossary; "Show plan" and "claims traced" are never explained on screen |

Audit: a11y 3 → **4** (0 contrast failures, 29 ringed tab stops, 3 empty live regions, 44 px touch targets, reduced motion honoured; residue: the `as of` stamp is DOM-first so it is read mid-sentence, claim chips are 24 to 32 px on touch, hop dots have no text), performance **4** (CLS 0.004 / 0.038, triage 3.6 s, 0 infinite animations after the run), responsive 3 → **3** (1024x768 table header at y = 878, 1366x768 landing graph 210 px tall, phone tab strip clips its first tab, 1024 header wraps), theming **4** (CLI detector 0, no hue outside red/amber/green/blue), integrity 3 → **4** (every remaining overlay finding is specified or a false positive; A's unanchored verdict: authored).

## Measured (Assessment B)

- **Fonts.** CDP platform-font tally on landing, triage, drawer, paste sheet and phone: only `Satoshi Variable`, `Martian Mono SemiExpanded`, `Cabinet Grotesk Variable`; no system font rendered a glyph anywhere. No element's first computed family is banned. `document.fonts`: Satoshi and Martian Mono loaded at `fonts.ready`; Cabinet Grotesk loads on first use (the "74 min" figure, drawer and sheet titles) and is preloaded in `index.html`, so no fallback frame was observed. Phone type floor: nothing under 12 px. Desktop: 10 spans at 11.7 px (`text-[0.9em]` on repeated entity names in `NarrativePanel.tsx:102`) and one 11 px Martian Mono run.
- **Contrast.** Visible-text scan at 4.5:1 (3:1 large): 0 failures on landing end, after triage, in the Fix drawer, in the paste sheet, on the phone landing and feed.
- **Motion.** No `transition: all`, no `ease-in`, no transition over 300 ms (1028 declared transitions after a run, all 120 to 280 ms). Infinite animations: `radar-sweep` + `radar-blip` only while the run is pending; 0 after the report. Reduced motion renders the final state at once with "Play the 90 minutes" and the figure whole (`r-reduced-motion-landing.png`).
- **Layout stability.** CLS 0.004 on landing, 0.038 after the run (one 0.03 shift when the report lands). Autoplay ends at 14.1 s; triage 3.6 s; guest analysis of `mochajs/mocha` (cached) under 2 s, so the analyzing state was not captured.
- **Overflow.** Horizontal overflow at 320, 360, 375, 414, 600, 768, 820, 1024, 1180, 1280, 1366, 1440, 1536, 1920: none on landing, after triage, with the paste sheet or the drawer open.
- **Keyboard.** 29 tab stops after a run (round 2: 126); every stop shows the 2 px `fg-0` ring (0 without; the `15b` crop missed the ring, the log `s1-log.json › tabs` is the evidence). Roving tabindex in the table (Up/Down/Home/End), Shift+Arrow on the scrubber, "Pause the autoplay" first in order. Live regions: 8, 3 empty by design (toast container, selection status, Ask status); round 2 had 21 empty.
- **Touch (375, coarse pointer).** Legend "?" 44x44, Fix 44x44, repo links 116x44, scrubber row 44, header paste button 44x44. Narrative claim chips are 24 to 32 px tall (`-my-1.5 … py-1.5`), the one class of target under 44.
- **Table.** Rows a uniform 43 px (round 2: 53 to 86; spec 36). Fully visible rows under the sticky header: 13 at 1440x900, 10 at 1366x768, 9 at 1280x720, 18 at 1920x1080, 0 at 1024x768 (header at y = 878, page scrolls). Column widths at 1440: repo 165, tier 112, path 176, action 64.
- **Feed.** At 1440x900 the narrative is 458 px tall; "Tool calls · 49 · 565.1 ms" sits at y = 680 and the first card at y = 710. At 1366x768 the verdict clamps to 4 lines and the first card lands at y = 566. Expanding a card shows its Cypher at once (`<pre>` Martian Mono 12 px). Mono share of visible glyphs after a run: 30% (round 2: 53%, round 1: 72%).
- **Slop probes.** `backdrop-filter` 0, gradients 0, radius over 14 px 0, resting shadows 0 (the 22 flagged are the selected row's inset bar and hover tooltips), emoji 0, hues present: red, amber, green, blue only. Primary buttons: exactly one on landing ("Run triage at 13:30 UTC"), none after a run, none added by the alert banner. "Run triage" buttons on landing: 3 (1 primary + two empty-state secondaries). Scribbles per viewport: 2 at landing end (74-min loop + empty-lockfile), 2 mid-autoplay (contrast arrow + empty-lockfile); the arrow hides once an OSV record exists, so three never coincide.
- **Detector.** CLI `detect.mjs --json web/src`: **0 findings**. Browser overlay: landing 30 (round 2: 28), after the run 58 (125), drawer 60 (130), phone landing 6 (4), phone run 10. `tiny-text` is gone (69 in round 2). What remains: `text-overflow` x21 (the `ul.sr-only` chain mirror, false positive), `nested-cards` x15-16 (tool cards inside the feed panel, specified), `all-caps-body` x8 (12 px `label-caps` section labels of 34 to 42 characters in the drawer and tool cards), `cramped-padding` x8-13 (table cell spans with a 3 px inset; the primary button is sized by height), `text-occlusion` x2 (the collapsed claim map), `gradient-text` x1 (the overlay itself), `line-length` x1 (the purpose line: 94 characters at `max-width: none`).

## Round-2 items

| Round-2 item | Status | Evidence |
|---|---|---|
| P1-A paste panel crushes the panes | **Fixed** | `Sheet` = native `<dialog>` 420 px at the right edge, `main` stays 816 px tall, autoplay paused while open (`playingBehindSheet: false`); `09-paste-sheet-idle.png`, `s1366-09-paste-error.png`, `m-07-paste.png` |
| P1-B FalkorDB proof buried | **Fixed** | tool-call header at y = 680 (1440x900) / 536 (1366x768), first card in view; verdict clamps to 4-5 lines on short viewports behind "Show the rest"; Cypher visible the moment a card opens; hint now says "open a tool call to read its Cypher"; Graph stats tab prints "Queries run 80 · Time in FalkorDB 583.7 ms"; `03-triage-complete.png`, `07-toolcard-open.png`, `14-graph-stats-tab.png` |
| P2-A table geometry (rows 53-86 px, hyphen breaks, 11 px chips) | **Partly** | rows 43 px uniform, no hyphen breaks, `text-2xs` is 12 px, 13 rows visible at 1440 (was 9) and 10 at 1366 (was 6); but the path's first hop now truncates the package name itself: `@typescript…@8.30.1` on five rows, `ansi-sty…@6.2.2`, `@babel/co…@7.26.9`; `03c-table-top.png`, `s1366-03-triage-complete.png` |
| P2-B chip wall in Ask answers and Notify | **Partly** | boxes gone (0 boxed chips in the answer, repeats are dotted underline); but an enumerating answer is now a 14-line run of dotted Martian Mono including the team names; `08-ask-answer.png`, `m-08-ask-answer.png` |
| P2-C keyboard and touch residue | **Fixed** | 29 tab stops (was 126), roving tabindex with arrow keys, 3 empty live regions (was 21), Fix 44x44, repo links 44 tall on touch |
| P2-D 1024-1279 layout | **Partly** | table header at y = 878 at 1024x768 (was 1297), still under the fold, page scrolls; `s1024x768-triage.png` |
| P2-E primary and scribble discipline | **Partly** | one primary per view; the alert panel's Run button is only primary while the contrast card's primary is also on screen (`13d`); three scribbles never coincide; but three "Run triage" buttons remain on landing (`02-landing-after-autoplay.png`) |
| P3 toast covers the Ask input | **Not fixed** | on every first run the "Scrubber moved from 14:30 UTC to 13:30 UTC" toast (320x64 at y = 820) sits on the Ask box; `03-triage-complete.png`, `10-guest-result.png`, `11-axios-triage.png`, `m-03-triage-feed.png` |
| P3 Enter does not submit the alert field | **Not fixed** | Enter inserts `\n` (`s5-log.json › alertEnter`); `AlertField` submits only via the form button |
| P3 "Show plan" never flips | **Not fixed** | label stays "Show plan" with the plan open (`07b-toolcard-plan.png`) |
| P3 "Why:" styled unlike VERDICT | **Fixed** | `WHY` is the same `label-caps` run-in as `VERDICT` (`03b-feed-top.png`) |
| P3 hero counter 40 px vs the 80 px spec | **Not fixed** | still 40 px Satoshi 700 (`s1-log.json › landingType`); the spec, not the code, should move (see fixes) |
| P3 last scrubber label clips at 320-375 | **Fixed** | labels alternate rows, overflow sweep clean at 320 (`s320-triage.png`) |
| R1 P2-2 repeated numbers (clock 3x) | **Partly** | "14:30" printed three times on landing: header chip, band chip, track bubble |
| R1 P2-8 mono share | **Fixed** | 30% of visible glyphs after a run (72% → 53% → 30%) |
| R1 P2-9 left edges (band 24 px, panes 12 px) | **Not fixed** | purpose line and band at x = 24, feed and table content at x = 12 (`03-triage-complete.png`) |
| R1 P3-1 red outside infection (amber chain red) | **Not fixed** | a WOULD_PULL row's chain draws in `red-400` (`04-row-selected-path.png`) |
| R1 P3-4 legend 7 entries | **Not fixed** | 5 on landing, 7 after a run (adds Dependency, Selected chain) |
| R1 P3-7 favicon | **Not fixed** | `index.html:13` is still `href="data:,"` |
| R1 P3-8 empty live regions | **Fixed** | 3 empty, all intentional containers |

No regressions found: every round-2 "Fixed" item re-checked (table above the fold at 1366, 74 min only after 14:26, axios 105 everywhere with the ring refitted, neutral errors, 48 px scenario control, "59/59" style badge, exec strip, ghost Fix text) still holds.

## Findings (A + B synthesis)

Agreement between A and B: the toast (A's P1, B measured it on four screens), the triple CTA (A's P1, B counted 3), the verdict wall (A's P1, B measured 458 px / 12 rows), the stamp read mid-sentence (A's Sam flag, B confirmed `{first && stamp}` precedes the label in `NarrativePanel.tsx:260`), the 1366 landing graph bar and the 1024 header wrap (A's P3, B measured a 210 px canvas). Things A caught that B's probes could not: the contrast arrow pointing at `0 LOCKED 0 WOULD_PULL` at 13:08 because `found` counts MAINTAINER (`ContrastCard.tsx:86-87`, visible in `01-landing-autoplay-1s.png`); "Cancel run" reachable only from a drawer menu; "Run again" discarding follow-ups silently; the two legends disagreeing. Things B caught that A did not: the truncated path names, the clamp label not saying the verdict is cut, the 11.7 px spans, Enter in the alert field. Detector false positives: `text-overflow` (sr-only mirror), `gradient-text` (overlay), `nested-cards` (specified tool cards), `body-text-viewport-edge` (the purpose line has gutter padding).

### Slop (generic patterns)

- **S1 · P3 · `02-landing-after-autoplay.png`, `13a-error-timeline.png` · `EmptyState` in the table pane.** Illustration + title + body + button is the one stock pattern on the screen, and it is the third "Run triage". Change: drop `action` from the table empty state (`App.tsx:679`), keep the scribble, let the copy end at "Run the triage to fill it."
- **S2 · P3 · `14-tab-concentration.png` · `InsightTabs` Concentration.** Percent bars with a right-aligned number read like any analytics card. Change: bar fill `fg-1`, track `line-2`, `red-400` only on the compromised account's bar, and print "307 packages" as the tick instead of a second line.
- **S3 · P3 · `14-graph-stats-tab.png`, `02c-graph-stats-sheet.png` · `InsightTabs` / `GraphStatsSheet`.** "Schema these queries touch" is a 19-label mono run-on; the edge list dumps 25 rows. Change: render labels and edge types as `bg-2` chips (`PathChip` style, `text-xs`), cap the sheet at the top 8 with "+N more".
- **S4 · P3 · `s1920x1080-triage.png` · `Header`.** Six same-weight pills with three radii (`rounded-xs` clock, `rounded-full` badges, `rounded-sm` button) is the one generic strip. Change: one radius (`rounded-xs`) for clock, mode and claims; fold "603.4 ms · 80 queries" into the FalkorDB pill at every width (`Header.tsx:69-72, 123`).

Nothing else generic was found: no gradients, glass, emoji, hero blob, centred composition, purple, or stock iconography; the copy is product-specific throughout ("one install from malware", "lockfile pins it", "Verdict from the graph").

### Craft

- **C1 · P1 · `03-triage-complete.png`, `10-guest-result.png`, `11-axios-triage.png`, `m-03-triage-feed.png` · `Toasts` + `App.tsx:212-218`.** The landing always ends at 14:30 and every run starts at 13:30, so "Scrubber moved from 14:30 UTC to 13:30 UTC" fires on every first run and sits on the Ask box (toast at y = 820-884, Ask at y ≈ 820-860 at 1440x900) for 4 s, at the exact moment the verdict lands. Change: toast only when `userAt !== null` (a minute the person chose); the header clock chip and the sr-only status already say the rest. Also lift desktop toasts above the Ask bar: `lg:bottom-[calc(var(--ask-h)+8px)]` in `Toasts.tsx:101`.
- **C2 · P1 · `02-landing-after-autoplay.png`, `m-02-landing-end.png` · `ContrastCard` actions + `ToolFeed.tsx:215,222` + `App.tsx:679`.** Three "Run triage" buttons with two label forms on one screen. Change: the pane empty states lose their `action` (copy only: "Pick a scenario or describe an alert, then run it."); the one primary stays in the contrast card.
- **C3 · P1 · `03c-table-top.png`, `11-axios-triage.png` · `ExposureTable` `PathText`.** `whitespace-nowrap` + ellipsis now cuts the package name, so `@typescript-eslint/parser`, `/eslint-plugin` and `/type-utils` all print as `@typescript…@8.30.1`. Change: keep the tail: render the name as `…${name.slice(-13)}` when it would overflow (or `direction: rtl; text-overflow: ellipsis` on the name span with `unicode-bidi: plaintext`), keep the full chip in `title`; and widen the column: `<col className="w-[40%]">` for Path, `w-24` for Tier (the chip is 100 px).
- **C4 · P2 · `03b-feed-top.png`, `s768x1024-triage.png` · `NarrativePanel.tsx:260,375`.** The `float-right` "as of 13:30 UTC" stamp is DOM-first inside the sentence, so screen readers read "21 of 21 repos are as of 13:30 UTC exposed", and sighted readers see the sentence break around it. Change: move the stamp into the label row: `<span class="label-caps">Verdict</span><span class="ml-auto font-mono text-xs text-fg-1">as of 13:30 UTC</span>` on a `flex` line above the paragraph; delete the float.
- **C5 · P2 · `01-landing-autoplay-1s.png` · `ContrastCard.tsx:86-87`.** For the first 4 s of the autoplay the red arrow points from "0 OSV advisories" at "0 LOCKED 0 WOULD_PULL" (only MAINTAINER is non-zero). Change: `const found = (c?.LOCKED ?? 0) + (c?.WOULD_PULL ?? 0)`.
- **C6 · P2 · `03b-feed-top.png`, `s1366-03-triage-complete.png` · `NarrativePanel`.** The verdict is a 12-row paragraph at `text-md` in a 296 px measure (38 ch); at 1366x768 it clamps to 4 lines and the expander says only "Show the rest: who to notify and the steps", not that the verdict was cut. Change: split the server's verdict at "LOCKED," and "WOULD_PULL," into a headline sentence (`text-md`) plus two `text-sm` lines each led by its `TierChip`; when `cut` is true, label the expander "Show the full verdict, who to notify and the steps".
- **C7 · P2 · `08-ask-answer.png`, `m-08-ask-answer.png` · `NarrativePanel` `Spans` list mode.** An enumerating answer is ~90% dotted-underlined Martian Mono, team names included. Change: in list mode render segments that end with ":" (team names) as Satoshi `text-sm text-fg-1` with no underline, and start a new line before each (`display: block`), so the answer reads as six team rows.
- **C8 · P2 · `s1366-02-landing-end.png`, `s1366-02b-landing-graph-crop.png` · `PathGraphCanvas`.** At 1366x768 the landing leaves the canvas 554x210; 21 repo squares merge into one blue bar with overlapping labels. Change: when `canvas.height < 260` use 4 px repo nodes and label only the LOCKED repo and every third row; or recover 60 px by hiding the two `NOTE` sentences in `ContrastCard` under `max-height: 800px`.
- **C9 · P2 · `s1024x768-triage.png` · `App.tsx:585` grid + `Header`.** Table header at y = 878 on a 768 screen; the header wraps to two rows. Change: `lg:grid-rows-[minmax(340px,auto)_auto]` (was 480) and hide the LLM-mode pill below 1280 (`min-[1280px]:inline-flex`).
- **C10 · P2 · `13d-alert-panel.png` · `ScenarioControl.tsx:121`.** Enter in "Describe the alert" inserts a newline; the spec and the placeholder ("qix compromised, 13:16 UTC") promise a one-line command. Change: `onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (ok) onRun(text.trim()); } }}`.
- **C11 · P3 · `02-landing-after-autoplay.png` · `Header` + `TimelineScrubber`.** "14:30" is printed three times (header chip, band chip, track bubble). Change: on landing drop the band chip (`TimelineScrubber.tsx:249`); the bubble and the header carry it.
- **C12 · P3 · `04-row-selected-path.png` · `PathGraph` legend.** Seven legend entries after a run. Change: drop "Dependency" (the grey dots are self-evident) and move "Selected chain" into the hint card; five entries.
- **C13 · P3 · `07b-toolcard-plan.png` · `ToolCard.tsx:433`.** "Show plan" stays "Show plan" with GRAPH.EXPLAIN open, and the plan has no Copy. Change: flip to "Hide plan" (`aria-expanded`), add the same Copy affordance as the Cypher block.
- **C14 · P3 · `03b-feed-top.png` · `App.tsx:600-603`.** "“cached” on a call: reused an earlier read-only query" is a gloss printed before any card says "cached". Change: move it to a `title` on the badge plus one `text-xs` line under the first cached card.
- **C15 · P3 · `16-filtered-empty.png` · `ExposureTable.tsx:401-412`.** "0 of 21 shown" and "No repo matches these filters" say the same thing; no way back but the native ×. Change: `action: { label: 'Clear filters' }` that resets query, tier and prod-only.
- **C16 · P3 · `m-05-table.png` · `ExposureTable` phone cards.** The two-sentence honest-semantics line is printed on all 20 WOULD_PULL cards; the hop dot wraps to the far right alone. Change: cards print `TIER_SUBTITLE` (one line), the long line stays in the `<caption>` and the footer; put `HopDots` inside the chain's flex row (`shrink-0 ml-1`).
- **C17 · P3 · `m-14-graph-stats.png` · `InsightTabs` tablist.** On a phone the strip scrolls and clips the first tab ("oncentration"). Change: `flex-wrap` under 480 px, or `scroll-padding-inline: 16px` with a 16 px end spacer.
- **C18 · P3 · `03b-feed-top.png` · `NarrativePanel.tsx:102,110`.** Repeated entity names are `text-[0.9em]` = 11.7 px, under the 12 px floor. Change: `text-xs`.
- **C19 · P3 · `02-landing-after-autoplay.png` · spec vs code.** The hero counter is 40 px Satoshi; `docs/design.md` §3 says 80 px at ≥ 1280. The 56 px Cabinet "74 min" must stay the loudest figure, so change the spec: `text-3xl` 40/42 for the counter, delete the `text-5xl` row.
- **C20 · P3 · `index.html:13`.** Favicon is `data:,`. Change: a 32 px SVG, `bg-0` square with one `red-500` dot at (22, 10).
- **C21 · P3 · `03a-triage-running.png` · band.** While a run is pending "Run again" is disabled and the only cancel is in a drawer menu. Change: the band button flips to "Cancel run" (ghost) while `running`.
- **C22 · P3 · `02b-tier-legend.png` vs `15d-tier-help.png`.** The band legend has an OSV row, the table's does not, and the two are 288 px vs 256 px wide. Change: one `TierLegend` with an `osv` prop; same width.

## Ranked fixes

**Blocking (a judge meets each in the first 30 seconds; all under an hour):**

1. **C1** First-run toast over the Ask box · `App.tsx:212-218`, `Toasts.tsx:101` · toast only when `userAt !== null`; desktop toasts at `bottom: calc(var(--ask-h) + 8px)`.
2. **C2** Three "Run triage" buttons on landing · `ToolFeed.tsx:215,222`, `App.tsx:679` · remove the two empty-state actions; one primary in the contrast card.
3. **C3** Path column truncates the package name · `ExposureTable.tsx` `PathText` + `colgroup` · tail-preserving ellipsis (`…eslint/parser@8.30.1`), Path `w-[40%]`, Tier `w-24`.
4. **C4** "as of" stamp inside the sentence · `NarrativePanel.tsx:260,375` · stamp in the label row, no float.
5. **C5** Arrow at zeros during the first 4 s · `ContrastCard.tsx:86-87` · `found = LOCKED + WOULD_PULL`.

**Nice-to-have (in order of visibility):**

6. **C6** Verdict wall and the clamp label · `NarrativePanel` · headline + two tier-led lines; "Show the full verdict…" when cut.
7. **C7** Ask-answer mono wall · `NarrativePanel` list mode · team names in Satoshi `fg-1`, one line per team.
8. **C8** 1366x768 landing graph bar · `PathGraphCanvas` · 4 px nodes + sparse labels under 260 px, or recover 60 px from the band.
9. **C9** 1024x768 table under the fold, header wrap · `App.tsx:585`, `Header` · graph row `minmax(340px,auto)`, LLM pill from 1280.
10. **C10** Enter runs the alert · `ScenarioControl.tsx:121`.
11. **S4** Header pill discipline at 1536+ · `Header.tsx:69-127` · one radius, ms inside the FalkorDB pill.
12. **C11, C12** Clock printed thrice; 7-entry legend.
13. **C13, C14, C15** "Hide plan" + Copy on EXPLAIN; "cached" gloss to the badge; "Clear filters".
14. **C16, C17** Phone cards: subtitle instead of the two-sentence line, hop dot in-row; tab strip wraps.
15. **C18, C19, C20, C21, C22, S1, S2, S3** 12 px floor in the narrative; spec the 40 px counter; favicon; "Cancel run" in the band; one legend; the three slop nits.

## Personas

- **Alex (impatient power user).** Fails: three Run buttons to parse on landing; the 12 s autoplay before the action row appears (Space pauses it, but nothing says so); "Cancel run" only inside a drawer's "…" menu; Ask disabled until the run ends and capped at 4; `cached` explained only in a `title`. Passes: arrow keys through 21 rows (one tab stop per column kind), Shift+Arrow scrubbing, Expand all, Copy all Cypher, export .md/.json, share links that reopen the row and tab.
- **Sam (keyboard and screen reader).** Fails: the `as of 13:30 UTC` stamp is read mid-sentence (C4); hop dots announce nothing ("2 hops" is visual only; only ADMITS carries `sr-only`); rows use `aria-current` where `aria-selected` is expected; claim chips 24-32 px on touch. Passes: skip links, pause-first, native `showModal` focus trap and return (`focusAfterDrawer: "Fix acme/checkout-web"`), one throttled feed live region, `aria-valuetext` "13:42 UTC, 5 repos exposed", graph `role="img"` label naming the selected chain, 0 contrast failures, reduced motion honoured.
- **Jordan (a judge, first time).** Fails: never told what "qix" is (the segment reads "qix · Sept 2025"); the arrow points at zero for the first 4 s (C5); the verdict lands under a toast (C1); "Built on FalkorDB 565.1 ms" reads as a sponsor badge until clicked, and "All Cypher used" is under the fold at 1366. Passes: the purpose line, the 0-vs-21 contrast with the pen arrow, the "74 min" loop, the one-click hint card, tier subtitles on every chip, "61/61 claims traced" in green.

Cognitive load (A): 5 of 8 fail (single focus, chunking, hierarchy, working memory, minimal choices); decision points over four options: the landing's six actions and the table toolbar's six controls. Emotional journey: peak = the loop drawing around "74 min"; second peak = a row click snapping the red chain to a team diamond; valleys = second one of the autoplay (zeros with an arrow) and the result landing (toast + wall); the end (Fix drawer: overrides JSON, three steps, Copy fix, Mark remediated with Undo) is the strongest screen in the product.
