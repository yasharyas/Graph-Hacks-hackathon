# Patient Zero: impeccable critique + audit, round 4 (Phase 3r4)

⚠️ DEGRADED: single-context. This gate agent ran the design review (Assessment A) and the detector/browser evidence (Assessment B) itself, sequentially, in one context; no isolated sub-agents were spawned. Target: the **production build at `http://localhost:8080`** (dist built 03:28, after the 03:17–03:25 source changes), Playwright headless Chromium, screenshots after `document.fonts.ready`. Viewports 1440x900, 1366x768, 1280x720, 1024x768, 375x812 (touch, DPR 2), 812x375 (touch), plus 1440x800, 1536x864 and 1920x1080 for the fold and the header. No server touched, no source edited. Screenshots in `qa/reports/phase3r4-impeccable/`; scripts and logs in the session scratchpad `r4impeccable/` (`s1-main.js` … `s7-tabs.js`, `*-log.json`, `detect-cli.json`).

## Verdict

Four of round 3's five blockers are gone and they were the loud ones: no toast lands on the Ask box any more (0 toasts at the run and after it on every width), the landing has exactly one "Run triage" and it is there from the first second, the `as of 13:30 UTC` stamp sits on the label row above the verdict, the contrast arrow never points at zeros, the verdict reads as a headline plus one line per tier, and an enumerating Ask answer is six team rows instead of a mono wall. Enter runs the alert, "Clear filters" exists, "Hide plan" flips, the 1366 landing graph is 322 px tall instead of 210, the 1024 header no longer wraps, axe reports 0 violations in seven states, and no font but Satoshi, Cabinet Grotesk and Martian Mono renders a glyph anywhere.

What was lost is the one thing round 2 fought for: **the FalkorDB proof is back under the fold on a laptop.** The unclamped verdict (headline + two tier lines, 244 px), the two meta lines above it and the analyst-pick block push the first tool card to y = 747 at 1366x768 (round 3: 536; the Ask bar starts at 665), to 747 at 1280x720 and to 727 at 1440x800. A judge on a 768-tall laptop now sees a verdict and an Ask box and has to scroll the feed to find a query. The second cost is the path column: the fix split the package name into two truncating spans, so five rows now read `@typescr… pars… @8.30.1`, `@… eslint-plug… @6.21.0`, `@typ… type-uti… @8.39.1`, and the name is cut for a 1-px overflow. Both are under an hour. **Not ship-ready for the judging bar until the fold is restored; with that fix and the path cut, ship.**

## Scores

| | Round 1 | Round 2 | Round 3 | Round 4 |
|---|---|---|---|---|
| Design health (Nielsen, /40) | 27 | 31 | 33 | **34** |
| Audit (/20) | 15 | 17 | 19 | **19** |
| Delight (1-10) | – | 8 | 7 | **7** |
| Clarity (1-10) | – | 8 | 8 | **8** |

Nielsen:

| # | Heuristic | R3 | R4 | Key issue |
|---|---|---|---|---|
| 1 | Visibility of system status | 4 | 4 | staged paste progress ("Step 1 of 5: fetch lockfile"), radar only while pending, spinner in "Run again", stale strip "The clock moved to 13:10 UTC. Re-run to update"; nothing lost |
| 2 | Match system / real world | 4 | 4 | tier subtitles everywhere, honest-semantics line once per list; graph stats still print `RESOLVES_TO` / `PKG_DEPENDS` unexplained; "qix" is never introduced |
| 3 | User control and freedom | 3 | 3 | "Clear filters" and Enter arrived; "Cancel run" is still only inside the drawer (`FixDrawer.tsx:400`), the band shows a disabled "Run again" with a spinner; "Run again" still discards follow-ups silently (3 sections → 1, no toast) |
| 4 | Consistency and standards | 3 | 3 | two tier legends (band 4 rows with OSV, table 3) at the same 288 px; three header radii (3 px clock, 9999 px pills, 6 px button); the pasted-repo verdict has no `VERDICT` label row while the org run does; "sample repo" chip vs plain text |
| 5 | Error prevention | 3 | 3 | Enter runs the alert (fixed); blur validation with a fix; "Run again" wipes follow-ups without a word; a failed run restarts the autoplay |
| 6 | Recognition rather than recall | 3 | 3 | hop dots now carry "2 hops" text, "Hide plan" flips; but `@typescr… pars…` makes the reader recall which `@typescript-eslint/*` a row is; `[E1]`, `direct`, `cached` still explained only on hover or sr-only |
| 7 | Flexibility and efficiency | 3 | 4 | actions available from t = 0 (no 12 s wait), Enter runs, arrow keys in the table, Shift+Arrow scrubbing, share links, export; residue: Ask capped at 4 and disabled until the run ends, 51 tab stops after a run of which 25 are narrative chips |
| 8 | Aesthetic and minimalist | 3 | 3 | the proof under the fold at 768 tall; clock printed three times at ≥ 801 px tall; 7-entry legend; the "cached" gloss and mode line above every verdict; a 3-line analyst-pick block that says nothing was picked |
| 9 | Error recovery | 4 | 4 | cause + fix + `requestId` + action, neutral not red, desktop and phone (`13a`, `13b`, `m-13`); the band's "— no result: the triage did not run" is good copy |
| 10 | Help and documentation | 3 | 3 | one hint card, two "?" legends, footer glossary, purpose line; "Show plan" and "claims traced" still unexplained on screen |

Audit: a11y **4** (axe-core 4.14 with wcag2a/aa/21/22aa + best-practice: 0 violations on landing, after the run, drawer open, paste sheet, phone landing, phone feed, phone table; 0 contrast failures in a visible-text scan of 14 states; every tab stop ringed; `aria-current` on the selected row's repo button; residue: 51 tab stops after a run (r3: 29) because every narrative chip is a stop, drawer section labels are `<p class="label-caps">` not headings, claim chips 24–30 px tall on touch), performance **4** (CLS 0.004 landing / 0.015 after the run / 0.009 phone; triage 2.0 s; 0 infinite animations after the report; 0 `transition: all`, 0 over 300 ms, 0 `ease-in` across 1 032 transitions; the production build ships `default-src 'self'` so no inline script runs), responsive **3** (1366 landing graph fixed, 1024 header fixed; but the proof is under the fold at 1366x768, 1280x720 and 1440x800, the 1024 table header is at y = 733 with 0 rows visible and a 3 203 px page, the phone tab strip clips its first tab, the phone hop dot orphans), theming **4** (CLI detector 0 findings on `web/src`; hues present red / amber / green / blue only; no gradient, backdrop-filter, radius over 14 px, resting shadow or emoji on any screen), integrity **4** (every overlay finding is specified or a false positive; authored throughout).

## Measured

- **Fonts.** CDP platform-font tally: landing `Satoshi Variable` 6 409 glyphs + `Martian Mono SemiExpanded` 268; after the run 21 233 + 27 652; drawer adds `Cabinet Grotesk Variable` 34 (the title); paste sheet 42; phone landing 2 108 / 244 / 12. No system font rendered a glyph in any state. First computed family on every visible element: Satoshi or Martian Mono (1 098 / 629 after a run); banned list empty. `document.fonts`: Satoshi and Martian Mono `loaded` at `fonts.ready`; Cabinet Grotesk loads on first use (preloaded in `index.html`), no fallback frame observed. Type floor: nothing under 12 px on any screen (r3 had ten 11.7 px spans; gone). Size tally after a run at 1440: 12 px Martian Mono 272, 12 px Satoshi 111, 14 px Satoshi 78, 13 px Satoshi 70, 16 px Satoshi 6, 28 px Satoshi 1.
- **Contrast.** 0 failures at 4.5:1 (3:1 large) on: landing end, triage complete, drawer, stats sheet, paste sheet, guest result, axios, alert run, 1366 / 1280 / 1024 / 812 landing + triage + drawer, phone landing / feed / drawer.
- **Fold (the regression).** First tool card top / Ask bar top: 1440x900 **755** / 797 (r3: 710); 1440x800 **727** / 697 (under the bar); 1366x768 **747** / 665 (r3: 536); 1280x720 **747** / ~617; 1024x768 819 (page scrolls); narrative height 475–503 px at 320–360 px wide (verdict paragraph 244 px + 36 px meta aside + 100 px analyst pick).
- **Table.** Rows 43 px; fully visible rows 13 at 1440x900, 10 at 1366x768, 8 at 1280x720, 0 at 1024x768 (header y = 733), 13 at 1536, 18 at 1920. Columns at 1440: repo 134 · tier 112 · path 207 · action 64 (pane 518). Path spans that truncate (`scrollWidth > clientWidth`): the scope in 6 rows at 1440, 4 at 1920 (path 240 px), plus the name itself in 2 rows by **1 px** (`eslint-plugin` 108/109, `type-utils` 83/84).
- **Landing.** Autoplay ends at 14.0 s; actions (`Run triage at 13:30 UTC`, `Try axios 2026`, `Paste your repo`) are in the DOM and visible from t = 0; one primary. Counter 40 px Satoshi 700; "74 min" 56 px Cabinet 800; two scribbles (arrow + loop) and never a third. "14:30" printed 3 times at 1440x900 (header chip, band chip, track bubble), 2 at ≤ 800 px tall and on phones. Graph canvas 554x322 at 1366x768 (r3: 210), 499x228 at 1280x720, 704x305 at 1024x768.
- **Legend.** 4 entries during the autoplay, 5 at landing end (adds Locked repo), 7 after a run with a selection (adds Dependency, Selected chain).
- **Chain colour.** Selected chain for `github/docs` (WOULD_PULL): 1 149 red-400 samples, 0 amber; for `appium/appium` at 13:10 (MAINTAINER tier, nothing malicious yet): 644 red samples.
- **Toasts.** 0 at the run and 0 after it on 1440 / 1366 / 1280 / 1024 / 375; guest and axios runs 0. The toast now fires only for a minute the person chose (`App.tsx:230`).
- **Keyboard.** 51 tab stops after a run with no follow-ups (A 3 skip links, BUTTON 42, SUMMARY 1, INPUT 2, SELECT 1, tab 1, tabpanel 1); 0 without a ring; the first 25 stops after the skip links are narrative claim chips. 119 after two follow-ups.
- **Touch (375, coarse).** `--control-h` 44 px; Fix 44x44 on cards; legend "?" 24x24 hit box inside a 44 px frame; scrubber row 24 px tall input; claim chips 24–30 px tall (unchanged); card header buttons 22–24 px; "Expand all" 18 px.
- **Overflow.** No horizontal overflow at 375, 812, 1024, 1280, 1366, 1440 on landing, after the run, with the drawer, the paste sheet or the stats sheet open.
- **Detector.** CLI `detect.mjs --json web/src`: **0 findings** (not a degraded run). Browser overlay (bundled `detect-antipatterns-browser.js` injected with `bypassCSP`): landing 29 (r3: 30), after the run 58 (58), drawer 60 (60), paste sheet 56, phone landing 6 (6), phone feed 30, phone table 59. Composition: `text-overflow` x21 = the `ul.sr-only` chain mirror (false positive), `nested-cards` x14–16 = tool cards on the feed panel and the scenario segmented control (specified), `gradient-text` x1 = the overlay's own banner, `all-caps-body` x8 = 12 px `label-caps` statement labels of 34 characters inside tool cards, `cramped-padding` x8–13 desktop (table cell spans with a 3 px inset, the primary button sized by height) and **x46 on the phone table** (the `dev only` / `sample repo` tags and tier chips have 0 vertical padding: `px-1 … leading-4`), `text-occlusion` x2 = the collapsed claim map, `line-length` x1 = the purpose line at 94 characters, `body-text-viewport-edge` = elements with gutter padding (false positive). Overlay evidence: `ov-landing-1440.png`, `ov-triage-1440.png`, `ov-drawer-1440.png`, `ov-paste-1440.png`, `ov-landing-375.png`, `ov-feed-375.png`, `ov-table-375.png`.
- **Model-written Ask answer: not reproducible here.** All five questions tried ("Which exposures are prod-only?", "What should I do first in the next hour?", "How bad is this?", "Can I ignore the dev-only ones?", "which repos need secrets rotated") came back "Answered from the graph" (header mode: LLM replay). The `modelWords` path was judged from `NarrativePanel.tsx:63-72,193-202`: the claim line reads "names and numbers checked against the graph" and the check icon drops to `fg-1`; that is the right restraint.

## Round-3 items

| Round-3 item | Status | Evidence |
|---|---|---|
| C1 (P1) first-run toast over the Ask box | **Fixed** | `toasts: 0` at run and after on every width; `App.tsx:230` gates on `userAt !== null`; `03-triage-complete.png`, `10-guest-result.png`, `11-axios-triage.png`, `m-03-triage-feed.png` |
| C2 (P1) three "Run triage" buttons | **Fixed** | one `Run triage at 13:30 UTC`; both pane empty states are copy-only (`ToolFeed.tsx:245`, `App.tsx:695`); `02-landing-after-autoplay.png`. Note: the actions now show from t = 0, not "at the end" as `docs/design.md` §5 says (good; update the doc) |
| C3 (P1) path column cuts the package name | **Partly** | `Ref` splits scope and name (`ExposureTable.tsx:72-86`), `w-[40%]` path; rows are now distinguishable but read `@typescr… pars… @8.30.1`, `@… eslint-plug… @6.21.0`, `@typ… type-uti… @8.39.1`, `@codeche… clie… @0.1.12`; the name is cut for a 1 px overflow; still cut at 1920; `03c-table-top.png`, `s1920x1080-triage.png` |
| C4 (P1) `as of` stamp mid-sentence | **Fixed** | `float: none`, a flex `<p>` "VERDICT … as of 13:30 UTC" above the paragraph (`NarrativePanel.tsx:322-340`); `03b-feed-top.png` |
| C5 (P1) arrow at zeros for 4 s | **Fixed** | `found = LOCKED + WOULD_PULL` (`ContrastCard.tsx:86`); no scribble visible at 1 s; `01-landing-autoplay-1s.png` |
| C6 (P2) verdict wall + clamp label | **Fixed** (but see R1) | headline `text-md` + `LOCKED,` and `WOULD_PULL,` lines in `text-sm`; disclosure says "Show 2 more evidence paths, the full analyst pick, who to notify and the steps"; `03b-feed-top.png`, `s1366-03-triage-complete.png` |
| C7 (P2) Ask-answer mono wall | **Fixed** | 6 team rows, team names Satoshi `fg-1`, `<br>` per team; `08-ask-answer-graph.png`, `m-08-ask-answer.png` |
| C8 (P2) 1366 landing graph bar | **Fixed** | canvas 554x322 (was 210), every repo labelled; `s1366-02-landing-end.png`, `s1366-02b-landing-graph-crop.png` |
| C9 (P2) 1024 table under the fold, header wrap | **Partly** | header 53 px, no wrap; `lg:grid-rows-[minmax(340px,auto)_auto]`; table header y = 733 (was 878), 0 rows visible, page 3 203 px; `s1024-03-triage-complete.png` |
| C10 (P2) Enter runs the alert | **Fixed** | `requestSubmit` on Enter (`ScenarioControl.tsx:131`); banner "Alert qix compromised, 13:16 UTC"; `13e-alert-banner-run.png` |
| C11 (P3) clock printed thrice | **Not fixed** at ≥ 801 px tall | 3x "14:30" at 1440x900; the band chip hides only under 800 px (`TimelineScrubber.tsx:266`): 2x at 1366x768 / 1280x720 / 375 |
| C12 (P3) 7-entry legend | **Not fixed** | 7 after a run with a selection; `04-row-selected-path.png` |
| C13 (P3) "Hide plan" + Copy on EXPLAIN | **Partly** | label flips (`ToolCard.tsx:496`); the EXPLAIN block has no Copy; `07b-toolcard-plan.png` |
| C14 (P3) "cached" gloss before any card | **Not fixed** | `aside[aria-label="Narration mode"]` prints "Verdict from the graph · analyst pick replayed" + "“cached” on a call: …" (36 px) above every verdict once `compact` (`App.tsx:153,619-623`); `03b-feed-top.png` |
| C15 (P3) "Clear filters" | **Fixed** | `ExposureTable.tsx:484`; 22 rows back after the click; `16-filtered-empty.png` |
| C16 (P3) phone cards | **Partly** | subtitle once per card, honest line once above the list (`ExposureTable.tsx:541`); the hop dot still orphans onto its own line under `^6.2.1 ⇥ ansi-styles@6.2.2`; `m-05-table.png` |
| C17 (P3) phone tab strip clips | **Partly** | a tapped tab scrolls into view; with "Graph stats" selected the first tab sits at x = −13 ("oncentration"); `m-14-graph-stats.png` |
| C18 (P3) 11.7 px spans | **Fixed** | no text under 12 px on any screen |
| C19 (P3) spec the 40 px counter | **Not fixed** | `docs/design.md:117` still lists `text-5xl` 80 px "hero counter at ≥ 1280"; code renders 40 px |
| C20 (P3) favicon | **Fixed** | inline SVG, `bg-0` rounded square + `red-500` dot (`index.html:13`) |
| C21 (P3) "Cancel run" in the band | **Not fixed** | band shows "Run again [disabled]" with a spinner while running; Cancel only in the drawer; `18b-run-again-band.png` |
| C22 (P3) one tier legend | **Partly** | same copy and width (288 px); band 4 rows with OSV, table 3; `02b-tier-legend.png`, `15d-tier-help.png` |
| S1 table empty state = stock pattern | **Fixed** (moved) | the table empty state is copy-only; the pattern now appears in the filtered-empty state (scribble + title + body + button); `16-filtered-empty.png` |
| S2 concentration bars | **Partly** | fill `fg-1` on a `bg-3` track; the "307 packages · reaches 21 of 21 repos" second line stays; `14-tab-concentration-crop.png` |
| S3 schema run-on, 25-row edge dump | **Not fixed** | "Schema these queries touch" is a 22-label mono run-on; the stats sheet lists all 14 edge types; `14-graph-stats-tab.png`, `02c-graph-stats-sheet.png` |
| S4 header pill discipline | **Not fixed** | radii 3 px (clock) / 9999 px (mode, claims, FalkorDB) / 6 px (paste); at 1536+ "556.9 ms in FalkorDB · 75 queries" is a separate label; `s1536x864-triage.png` |
| R1 P2-9 left edges 24 vs 12 | **Not fixed** | purpose / header / footer at x = 24, feed and narrative at 12, table text at 15 |
| R1 P3-1 amber chain drawn red | **Not fixed** | WOULD_PULL and MAINTAINER chains are `red-400`; `04b-wouldpull-row-selected.png`, `17-scrubbed-back.png` |
| R2 P1-B FalkorDB proof above the fold | **REGRESSED** | first card y = 747 at 1366x768 (r3: 536), 747 at 1280x720, 727 at 1440x800 (Ask bar at 665 / 617 / 697); `s1366-03-triage-complete.png`, `s1280-03-triage-complete.png`, `s1440x800-03-triage-complete.png` |

Every other round-2 and round-3 "Fixed" item re-checked still holds (sheet paste flow, 44 px targets, 12 px floor, reduced motion renders the final state with "Play the 90 minutes", neutral errors, exec strip, "59/59"-style badge, hover tooltips).

## Findings

### Slop (generic patterns)

- **S1 · P3 · `16-filtered-empty.png` · `ExposureTable` filtered-empty.** Illustration + title + body + button, and the title ("No matching repos") and body ("No repo matches these filters.") say the same thing. Change: no scribble for a filter miss (keep it for the no-triage state), one line "No repo matches these filters." + the `Clear filters` button.
- **S2 · P3 · `s1536x864-triage.png`, `03-triage-complete.png` · `Header`.** Three radii in one strip and the query total changes home by width (inside the pill at 1440–1535, a label at 1536+, gone below 1440). Change: `rounded-xs` for clock, mode and claims (`Header.tsx:86,101,109`), keep `rounded-full` only for the FalkorDB pill if one pill must stay, and print the ms inside that pill at every width ≥ 1280.
- **S3 · P3 · `14-graph-stats-tab.png`, `02c-graph-stats-sheet.png` · `InsightTabs:231`, `GraphStatsSheet`.** A 22-item mono run-on and a 14-row edge dump. Change: labels and edge types as `bg-2` chips (`PathChip` style); the sheet shows the top 8 with "+6 more".
- **S4 · P3 · `13f-alert-complete.png`, `10-guest-result.png` · `NarrativePanel` analyst pick.** When nothing was picked the block still prints "ANALYST PICK (LLM) / The model chose this; the words come from the graph. / No observation was picked for this run: the verdict above is the whole answer." Three lines of boilerplate about an absence. Change: render nothing (the mode line already says "no analyst pick").

Nothing else generic: no gradients, glass, emoji, hero blob, centred composition, purple, or stock iconography; the copy stays product-specific ("one install from malware", "— no result: the triage did not run", "lockfile at commit 5f8e8a8 from 2025-09-01").

### Craft

- **C1 · P1 · `s1366-03-triage-complete.png`, `s1280-03-triage-complete.png`, `s1440x800-03-triage-complete.png` · `NarrativePanel.tsx:255-260` + `App.tsx:619-623`.** The proof is under the fold on every laptop height: narrative 475–503 px (meta aside 36 + verdict 244 + why 40 + pick ~100 + disclosures), first card at 727–747, Ask bar at 617–697. Change, all under `lg:[@media(max-height:900px)]`: (a) `CLAMP.Verdict` tier lines `line-clamp-1` each (the headline stays whole); (b) hide the `aside[aria-label="Narration mode"]` and move its two sentences into the header mode pill's `title`; (c) when `fold` is true keep the analyst pick entirely behind the disclosure ("Show the analyst pick, 2 more evidence paths, who to notify and the steps"). Budget recovered ≈ 36 + 80 + 100 px → first card at ≈ 530 at 1366x768, above the bar. Keep the unclamped verdict at ≥ 901 px tall.
- **C2 · P1 · `03c-table-top.png`, `s1920x1080-triage.png` · `ExposureTable.tsx:72-86` `Ref`.** Two truncating spans; the scope is squeezed to "@typescr…" / "@…" while the name still loses its tail for 1 px. Change: one span, deterministic: `const short = name.length > 18 && name.startsWith('@') ? name.replace(/^(@[^/]{2})[^/]*\//, '$1…/') : name` → `@ty…/parser@8.30.1`, `@ty…/eslint-plugin@6.21.0`, `@co…/client@0.1.12`; `shrink-0` on the name so a leftover pixel always lands on the scope; full ref stays in `title`.
- **C3 · P2 · `04b-wouldpull-row-selected.png`, `17-scrubbed-back.png`, `04-row-selected-path.png` · `PathGraphCanvas.tsx:194-196` + `PathGraph.tsx:34-50,148-155`.** The selected chain is `red-400` for every tier, including a MAINTAINER-tier chain at 13:10 when nothing is malicious yet, and the legend grows to 7. Change: `active = tier === 'LOCKED' ? --tier-locked : tier === 'WOULD_PULL' ? --tier-would-pull : --tier-maintainer`; the "Selected chain" swatch takes the same colour; drop "Dependency" (five entries). Red stays reserved for infection.
- **C4 · P2 · `18b-run-again-band.png`, `03a-triage-running.png` · `App.tsx:581`.** While a run is pending the band offers a disabled "Run again" with a spinner; the only Cancel is a link inside a drawer the person has not opened. Change: `running ? <Button variant="ghost" onClick={triage.abort}>Cancel run</Button> : <Button>Run again</Button>`.
- **C5 · P2 · `13b-error-triage.png`, `m-13-error-triage.png` · `App.tsx` playback after `triage.status === 'error'`.** A failed run restarts the landing autoplay (band shows "Pause", counts "—") and offers two buttons for one action ("Run again" in the band, "Run triage" in the card). Change: keep the band paused at the run clock on error; the card's button is the one action.
- **C6 · P2 · `s7-log.json › tabsAfterRun` · `NarrativePanel` chips.** 51 tab stops after a run (r3: 29); 25 of them are claim chips the keyboard user must cross before the first tool card. Change: roving tabindex inside the narrative (one stop, Left/Right between chips, Enter traces), as the table already does.
- **C7 · P2 · `10-guest-result.png` · `NarrativePanel.tsx:322-340` guest path.** A pasted repo has no `VERDICT` label: the stamp sits alone right-aligned and "Verdict (its package-lock.json at commit 5f8e8a8 …)" runs inline. Change: the label row always prints `Verdict`; move the lockfile provenance to the band (it is already there: "lockfile at commit 5f8e8a8 from 2025-09-01").
- **C8 · P2 · `s1024-03-triage-complete.png` · `App.tsx:605` grid.** Graph 387 px, hint card + exec strip + toolbar, table header at y = 733; the page scrolls 3 203 px because both right-hand panes grow with content. Change: at `lg`, `grid-rows-[minmax(300px,42%)_minmax(0,1fr)]` with the feed, graph and table panes as internal scrollers (`min-h-0 overflow-auto`) so the layout stays one screen, as it does at `xl`.
- **C9 · P3 · `02-landing-after-autoplay.png` · `TimelineScrubber.tsx:266`.** "14:30" three times at ≥ 801 px tall. Change: drop the band chip at every height; the bubble and the header carry it.
- **C10 · P3 · `03b-feed-top.png` · `App.tsx:619-623`.** The "cached" gloss and mode line sit above every verdict. Change: `title` on the `· cached` badge (`ToolCard.tsx:381` already has it) and one `text-xs` line under the first cached card; the mode line belongs to the header pill.
- **C11 · P3 · `m-05-table.png` · `ExposureTable` `PathText` on cards.** The hop dot wraps alone. Change: put `HopDots` inside the last chip's flex row with `shrink-0 ml-1` and let the range + chip wrap as a unit.
- **C12 · P3 · `m-14-graph-stats.png` · `InsightTabs.tsx:73`.** With the last tab selected the first is clipped to "oncentration". Change: `scroll-padding-inline: 12px` on the tablist and `scrollIntoView({ inline: 'nearest' })` instead of centre, or `flex-wrap` under 480 px.
- **C13 · P3 · `13e-alert-banner-run.png` · `tokens.css:328`.** After Enter runs the alert, programmatic focus lands on the feed pane and a 2 px `fg-0` ring outlines the whole 360x700 pane; it reads as a selection. Change: `[tabindex='-1']:focus-visible { outline-color: var(--line-3) }` for pane-level targets, keep `fg-0` for controls.
- **C14 · P3 · `ov-table-375.png` · `ExposureTable.tsx:53` `TAG`.** `dev only` / `sample repo` tags have 0 vertical padding (detector `cramped-padding` x46 on the phone table). Change: `px-1.5 py-px leading-4`.
- **C15 · P3 · `05-fix-drawer.png` · `FixDrawer` section labels.** `PATH E1`, `YOUR LOCKFILE PINS`, `PACKAGE.JSON: overrides`, `STEPS` are `<p class="label-caps">`; a screen-reader user cannot jump between them. Change: `<h3 class="label-caps">`.
- **C16 · P3 · `m-04b-graph-selected.png` · `TimelineScrubber` counts on phones.** The "?" legend button floats vertically between the two count rows. Change: `self-start` on the button so it sits on the first row.
- **C17 · P3 · `13d-alert-panel.png` · `ScenarioControl` + `ContrastCard`.** Two primaries on screen while the alert panel is open (the disabled "Run triage" and the card's); the autoplay keeps ticking behind the field. Change: the panel's button is secondary until the field is valid; pause the autoplay while the panel has focus.
- **C18 · P3 · `13b-error-triage.png`, `01-landing-autoplay-1s.png` · `PathGraphCanvas`.** The dimmed malicious-version column (19 versions stacked at 24 px pitch, opacity .35) reads as a dotted red line down the graph. Change: draw only versions on a shown path; count the rest in the "Up to 3 versions per repo shown" note.
- **C19 · P3 · `03-triage-complete.png` · band headline.** "Acme demo org · 21 repos" / "teams synthetic" wraps to a ragged third line beside the 28 px figure at 1440. Change: one `text-xs` line "Acme demo org · 21 repos · teams synthetic".
- **C20 · P3 · `docs/design.md:117,167`.** Spec drift: `text-5xl` 80 px hero counter (code is 40 px); "three buttons appear at the end" (they are there from t = 0). Change the spec.

## Ranked fixes

**Blocking (a judge meets each in the first 30 seconds; all under an hour):**

1. **C1** FalkorDB proof under the fold on laptops · `NarrativePanel.tsx:255-260`, `App.tsx:619-623` · at `max-height: 900px`: tier lines `line-clamp-1`, hide the two-line mode/cached aside, keep the analyst pick behind the disclosure → first card ≤ 560 at 1366x768.
2. **C2** Path column `@typescr… pars… @8.30.1` · `ExposureTable.tsx:72-86` · one span, scope shortened to `@ty…/`, `shrink-0` on the name, full ref in `title`.
3. **C3** Selected chain always red, 7-entry legend · `PathGraphCanvas.tsx:194-196`, `PathGraph.tsx:34-50` · chain colour by tier, legend swatch follows, drop "Dependency".
4. **C4** No way to cancel a run from the band · `App.tsx:581` · "Run again" becomes a ghost "Cancel run" while `running`.
5. **C5** A failed run restarts the autoplay and shows two Run buttons · `App.tsx` error branch · stay paused at the run clock; one button.

**Nice-to-have (in order of visibility):**

6. **C9** clock chip thrice at ≥ 801 tall · `TimelineScrubber.tsx:266`.
7. **C10, S4** the cached gloss and the empty analyst-pick block above the verdict.
8. **C6** 25 narrative chips in the tab order · roving tabindex.
9. **C7** guest verdict without a label row.
10. **C8** 1024 one-screen layout · internal scrollers.
11. **S2** header radii and the wandering ms label.
12. **C11, C12, C16** phone: orphan hop dot, clipped first tab, floating "?".
13. **C13, C14, C15** pane focus ring colour, tag padding, drawer headings.
14. **C17, C18, C19, C20, S1, S3, C13-r3 (Copy on EXPLAIN), C22-r3 (one legend)** the remaining nits and the spec drift.

## Personas

- **Alex (impatient power user).** Passes now: the three actions are there at t = 0 (no 12 s wait), Enter runs the alert, Shift+Arrow scrubbing, arrow keys in the table, Expand all, Copy all Cypher, export, share links. Fails: cannot cancel a run without opening a drawer; 25 chips to tab through before the first tool card; Ask capped at 4 and disabled until the run ends; "Run again" throws away the follow-ups silently.
- **Sam (keyboard and screen reader).** Passes: axe 0 violations in seven states, every stop ringed, the stamp now reads on its own line, hop dots announce "2 hops", `aria-current` on the selected row's repo button, native `showModal` focus trap and return, one throttled feed live region. Fails: 51 tab stops after a run; drawer sections are paragraphs, not headings; claim chips 24–30 px on touch; the pane-wide focus ring after Enter looks like a selection.
- **Jordan (a judge, first time).** Passes: one primary, the arrow never points at zero, "74 min" with the loop, verdict headline + two tier lines, "62/62 claims traced" in green, cause + fix + request id on errors. Fails: on a 768- or 800-tall laptop the first tool call (the Cypher, the ms badge, the FalkorDB proof) is under the Ask bar; `@typescr… pars…` in the table; a WOULD_PULL chain drawn in infection red; "qix" still never introduced.

Cognitive load: 4 of 8 fail (single focus, chunking, working memory, minimal choices; hierarchy now passes on the landing and fails in the feed where the payoff is below the fold). Emotional journey: peak = the loop drawing around "74 min"; second peak = a row click snapping the chain to a team diamond and the breadcrumb chain on a phone; valley = the result landing on a laptop (verdict, then an Ask box, no query in sight); the end (Fix drawer: overrides JSON, steps, Copy fix, Mark remediated with Undo) is still the strongest screen in the product.
