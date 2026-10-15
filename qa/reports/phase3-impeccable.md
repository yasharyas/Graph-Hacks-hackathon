# Patient Zero: impeccable critique + audit (Phase 3)

Method: dual-agent. A (design review, live browser plus source) = this agent, itself a delegated sub-agent, run before any detector output was read. B (detector plus browser injection) = isolated sub-agent `a0861e59ee5f96c35`, report received after A's findings were fixed. No server was started or stopped, no repository file was edited, and the `.impeccable/critique/` snapshot was not written (it lives inside the repo).

Target: http://localhost:5173/ (Vite dev server, real data, live API). Headless Chromium via playwright-skill. Viewports 1440x900 (primary), 1366x768 and 1280x720 (probe), 375x812 (coarse pointer emulated). States: landing autoplay, after the qix triage, Fix drawer open. Extra probes: axios scenario, reduced motion, API failure, paste box, alert box.
Grounding: `docs/design.md` (binding), `web/src/design/tokens.css`, `web/src/styles.css`, `web/src/App.tsx` and all of `web/src/components/`.
Screenshots: `qa/reports/phase3-impeccable/` (names below are relative to that folder).

---

## 1. Scores

### Design health (Nielsen, mode = Operate, all 10 apply): 27/40, Acceptable (top of band). Target in design.md section 10 was 32/40, so it is missed by 5.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Clock chip on every number, query total, "21/21 traced", mode badge are excellent. But the triage finishes in about 1 s, so the pending/radar state is never seen. Run Triage also silently rewinds 14:30 to 13:30 (OSV advisories 1 to 0). |
| 2 | Match system / real world | 3 | Plain-language tier subtitles and the honest-semantics footer are strong. "a bad package" placeholder, "LLM live", "21/21 traced" (traced what?) leak. |
| 3 | User control and freedom | 3 | Pause first in tab order, Undo remediate, Esc closes drawer, Cancel run, Dismiss. The hint can never be recalled; no reset to landing. |
| 4 | Consistency and standards | 2 | Tier chip overflows its own column, 128 min becomes 105 min on the axios run, three identical primary "Run triage" buttons, left edges at 12/16/24px, red used for both infection and errors. |
| 5 | Error prevention | 3 | Paste validation and disabled states are good. Drawer exports ("Report .md/.json") sit in a per-repo drawer but act on the whole report. |
| 6 | Recognition rather than recall | 3 | Labels always visible, Cypher one click away. Once a chain is selected, the other 20 repos lose their labels (hover only). |
| 7 | Flexibility and efficiency | 3 | Scrubber keys, skip links, share link, exports. No arrow-key row navigation; 42 tab stops (21 repo links plus 21 Fix) in the table. |
| 8 | Aesthetic and minimalist design | 2 | Same numbers 3x per viewport, a band that eats 38-44% of the viewport, 21 identical Fix buttons, a 28-chip narrative, 7-item graph legend. Palette discipline is excellent. |
| 9 | Error recovery | 3 | Timeline/triage/paste errors give cause, fix, request id and a retry. Cause text is infection-red and the triage error shows the raw server string "upstream failure". |
| 10 | Help and documentation | 2 | One hint card that names UI that does not exist yet (row, Cypher card). WOULD_PULL is defined only in a 12px fg-2 footer and `title` tooltips. |
| | **Total** | **27/40** | Acceptable |

Cognitive load (8-item checklist): 3 failures (single focus, chunking, minimal choices; about 12 actions visible at landing end), so moderate. Emotional journey: peak 1 (the circled 74 min) is spent on frame one (P1-2). Valley is the post-run screen (numbers repeated, table off-screen). Peak-end is the Fix drawer, which is the strongest moment in the product.

### Audit health: 15/20, Good

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Programmatic contrast scan of every text node in the post-triage desktop DOM: 1 item under AA (the "••" hop dots, 4.29:1 on bg-3). 2px fg-0 focus ring on all sampled tab stops, skip link then "Pause the autoplay" first (WCAG 2.2.2), reduced motion verified. Gaps: scenario segments 40px on touch, 17 empty `aria-live` regions, canvas is not keyboard-operable (table drives it, as designed). |
| 2 | Performance | 3 | Fonts preloaded (3 woff2 at about 55 ms), graph chunk lazy, no infinite animation after a run completes. Layout shift is the cost: CLS 0.087 on landing, 0.212 after the triage (hint insert plus report landing). Bundle not scored (dev server). |
| 3 | Responsive | 2 | 375px: no horizontal overflow and 44px targets (except scenario segments). But the exposure table is not visible at 1366x768 or 1280x720, and on phones the run result lands below the fold. |
| 4 | Theming | 4 | Zero hard-coded colours in `components/` or `App.tsx` (one `#000` mask stop in `Scribble.tsx`). All colour through tokens, dark only by design. |
| 5 | Implementation integrity | 3 | Detector: 0 CLI findings, browser build 24-26 findings, all false positives (section 3). Spec drift: hero counter 40px vs 80px spec, dead `scribble` prop, `min-h-(--row-h)` on `<tr>` does nothing (rows are 55-107px, spec is 36px), grep name placeholder. |
| | **Total** | **15/20** | Good |

---

## 2. Design specificity verdict

Authored, not interchangeable, but the authorship lives in five details. The skeleton (dark three-pane console, hairline panels, pill badges, outlined secondary buttons) is the stock "ops console" layout. What makes it Patient Zero: the UTC time spine and scenario clock, the scanner / grep / Patient Zero contrast rows, tier and path chip grammar (`debug@4.4.2` with the only underline), claim-verification chips, and the p5 scribble around "74 min". Remove those and it could be any security dashboard. Anti-slop checklist (design.md section 9), verified in the live DOM: no purple, gradient, glow, glass, emoji, Unicode ticks/arrows, centred layouts (except the figure), `transition: all`, or `ease-in`. Red appears on no button, link, focus ring or selection. Remaining AI tells: the "LLM live" and green "21/21 traced" pills, check-in-circle on 28 narrative chips (the "AI verified" trope), and the `Verdict / Notify / Do` narrative.

Deterministic scan (Assessment B): `detect.mjs --json web/src` exit 0, `[]`, regex engine only (HTML parser deps are not installed, so HTML coverage is degraded). Browser build injected at 1440 and 375: 24-26 findings, all false positives or injection artifacts: `text-overflow` x21 on the sr-only graph mirror (`PathGraph.tsx:164`), `clipped-overflow-container` x3 (react-force-graph's offscreen `float-tooltip-kap`, plus the intentional scribble crop at `ContrastCard.tsx:111`), `cramped-padding` and `nested-cards` on the segmented control (`ScenarioControl.tsx:53`, specified), `gradient-text` and `text-occlusion` (the detector matching its own injected source and overlay label). Agreement: both say the system rules are honoured. Disagreement: the detector found none of the real defects below (overlap, label collision, below-the-fold table, number mismatch); those are geometry and flow problems that static rules cannot see.

Typography verified by CDP `CSS.getPlatformFontsForNode` over every text node after `document.fonts.ready`: only Satoshi Variable (6,604 glyphs), Martian Mono (17,025) and Cabinet Grotesk (9) rendered. No system or banned font rendered anywhere (the one `sans-serif` computed value is the library's offscreen tooltip div with no text). Canvas labels use the token stacks.

---

## 3. Findings

Format: **what**, where (component, screenshot), why it matters to a judge, minimal fix.

### P0

**P0-1. The exposure table is not visible on laptop screens.**
- Where: `App.tsx` pane grid (`xl:h-dvh xl:overflow-clip`), `ExecSummary.tsx`, `ExposureTable.tsx` filter row. At 1366x768 the pane is 397px tall: exec summary card plus filter row consume it, the table header sits at y=781 and the first row at y=817 (viewport is 768), so 0 rows are visible. At 1280x720: header y=801, first row y=837. At 1440x900 the pane is 517px, header y=759, first row y=795, about 0.6 of one row visible, rows are 85px tall. Top band (header 52 + scrubber/contrast 225 + hint 62) takes 339px, 38% of the viewport. See `d-1366x768-triage.png`, `d-1280x720-triage.png`, `d-triage-done.png`.
- Why: the product's answer (which repos, which path, which owner) is the one thing a judge must see after clicking Run triage. On the most common judge laptop resolutions it is below a nested scroll they have no reason to discover. The feed (the Cypher and ms proof for FalkorDB) is equally hidden under the narrative.
- Fix: once a report exists, collapse the landing band to the scrubber row only (hide the contrast card and hint; the numbers are in the exec summary), and turn `ExecSummary` into one 40px strip (tier counts plus "+74 min") above the table. Put the filter controls on one row with no stacked labels. Target: header plus 6 rows visible at 1366x768.

### P1

**P1-1. Tier chip `dev` tag collides with the path chip; WOULD_PULL chip overflows its cell; Fix button touches the pane edge; rows are 55-107px, not 36px.**
- Where: `TierChip.tsx` (the `dev` span is inside the nowrap chip), `ExposureTable.tsx` `<colgroup>` (Tier `w-26` = 104px, Path `w-[38%]`, Fix `w-14`). Measured: Tier content box is 88px, the WOULD_PULL chip is 101px, with `dev` it is 140px, so it runs 36px into the Path cell on 7 of 21 rows (http-party/http-server, jquery, TypeScript, pdf.js, newman, swagger-ui, bootstrap). Fix button right edge = 1439.75px (pane edge, no gutter). Evidence: `d-table-overlap-zoom.png` (text literally overprints "dev" with "chalk"/"debug"), `d-table-scrolled.png`.
- Why: overprinted text in the core table reads as a broken product; the red `@4.4.2` path column is the hero string of the whole demo.
- Fix: move the `dev` tag out of the chip (render it after the chip in the wrapping parent, or fold it into the repo cell like `sample repo`); give the Tier column `w-[7.25rem]`; add `pr-3` on the Fix cell; set `tr` height with `h-(--row-h)` on `td` and let hop dots sit inline with the last chip.

**P1-2. The 74-minute payoff is spoiled on frame one.**
- Where: `ContrastCard.tsx` renders the figure, loop and arrow whenever `minutesAhead !== null` (comment says the old gating was removed); `App.tsx` computes it from the incident, not from the playhead. `d-landing-t1s.png` shows "74 min" circled at 13:05, 7 minutes before the first publish (13:12), with the counter at 0. design.md section 5 and 8 specify the scribble draws when the thumb passes the OSV marker (14:26), once.
- Why: the autoplay is built as a story (counter climbs, OSV holds at 0, then the circle at 14:26). The climax is on screen before the setup, and the "name grep: 21 repos" row is also there at 13:05 while exposures read 0.
- Fix: gate the figure and both scribble layers on `at >= incident.advisoryAt` (the `scribble` state already exists in `App.tsx` and is passed in but ignored); show an empty fixed-size slot before that so the layout does not move.

**P1-3. The headline number changes after Run triage on axios (128 min to 105 min), hidden on qix because both definitions equal 74.**
- Where: `App.tsx` line 217 `report?.minutesAhead ?? (advisoryAt - firstPublishAt)`. Landing axios shows "128 min" (23:59 publish to 02:07 advisory); after the run the circled figure and exec card read "105 min" / "+105 min" (server: `advisoryAt - first` in `server/agent/triage.ts:106`). Evidence: `d-axios-landing-end.png`, `d-axios-triage.png`. The 3-digit "128 min" also touches the hand-drawn ring on both sides (`d-axios-128min-zoom.png`; the loop art is sized for "74 min").
- Why: "Every number is time-indexed" is the brand promise; a judge who clicks "Try axios 2026" then "Run triage" sees the hero number change with no explanation.
- Fix: one definition. Either label the landing figure "from first publish" and the report figure "from first exposure", or compute the landing figure with the same rule (first exposure). Size the scribble ring from the figure's measured width, or scale the PNG to fit.

**P1-4. Scrubber marker labels collide on the axios timeline.**
- Where: `TimelineScrubber.tsx` marker rows (`row` 0/1 alternate, `pct(m.at) > 75` flip only). Axios: "02:19 alert" spans x 349-412 and "03:15 removed" spans x 399-483 on the same row, 13px overprint ("02:19 al03:15 removed"). Evidence: `d-axios-scrubber-zoom.png`.
- Why: "Try axios 2026" is one of the three primary actions; the second scenario is the proof that the product generalises, and its timeline is garbled.
- Fix: place labels with a measured-width pass (assign each label the first of 3 rows where it does not overlap the previous label), or drop the event word when the gap to the previous marker is under 12% of the track.

**P1-5. Phone: the run result lands below the fold, and the Table tab opens on 565px of summary and filters.**
- Where: `App.tsx` `showPane('feed')` scrolls the pane into view before the hint card mounts above it (the hint is about 130px tall at 375px), so after tapping Run triage the narrative starts at y=640 of 812 and only its first lines clear the tab bar (`m-triage-feed.png`; the viewport still shows the contrast card, "Run again" and the hint). `m-triage-table.png`: exec summary (about 370px) plus filter stack (about 125px) put the first card at y=565 and it is half under the tab bar. See also `m-triage-graph.png` (hint takes 16% of the viewport; the repo name is printed twice, once as a lone chip and again as the first hop).
- Why: Casey on a phone taps Run triage and sees the same screen. The hint is also irrelevant on touch (there is no Cypher-hover affordance, and it says "Click").
- Fix: do not render the hint under 1024px; call `scrollIntoView` after the hint/report layout settles (or `requestAnimationFrame` twice); under 768px move `ExecSummary` below the list or collapse it to its title row plus tier counts; drop the duplicate lone repo chip in the breadcrumb.

### P2

**P2-1. The narrative is a chip wall.**
- Where: `NarrativePanel.tsx`, feed pane. qix: 21 claim chips, axios: 28 (`d-axios-triage.png`), each with a green check-in-circle in mono; commas orphan at line starts ("CLI ,", "QA ,"); the axios sentence reads "Fresh resolves would fetch axios@1.14.1 for github/docs [E3], appium/appium [E4] ... and nestjs/nest, louislam/uptime-kuma would fetch axios@0.30.4 and axios@1.14.1" (garbled grammar).
- Why: it is the first text a judge reads, 360px wide at 16px, with 28 bordered mono boxes; the proof (verified claims) becomes the noise.
- Fix: chip only the first mention of an entity, keep the check icon only on the claims badge, render repeats as plain `fg-0` text with a dotted underline, and tighten the comma/chip spacing (`gap-x-0`, comma outside the chip's trailing margin).

**P2-2. Same numbers repeated, flat numeric hierarchy.**
- Where: after a run, one 1440x900 viewport shows 21 five times (hero counter, contrast card, exec "21 of 21", header "21/21 traced", name grep), 74 twice (circled figure and "+74 min"), and the clock four times (header chip, scrubber chip, thumb label, exec title). The hero counter is `text-3xl` 40px; design.md section 3 sets it at 80px (`text-5xl`) from 1280px.
- Why: when everything is a big number nothing is. A judge cannot tell which figure is "the" answer.
- Fix: after the report, keep exactly one of each: hide the contrast card's PZ row and the exec tier counts' duplicate total; keep the thumb label and header chip, drop the scrubber chip. Restore the 80px counter on landing only, or accept 40px and update the spec.

**P2-3. Three identical primary "Run triage" buttons at landing end, and the empty-state headings are the loudest type.**
- Where: contrast card actions (`App.tsx` `actions`), feed `EmptyState`, table `EmptyState` (`EmptyState.tsx` hard-codes `variant="primary"`). Spec: one primary per view. The three empty-state titles ("No triage yet", "No paths yet", "No exposures to show yet") are Cabinet 800 22px in `fg-0`, so they out-shout the data. `d-landing-end.png`, `d-error-timeline.png`.
- Fix: empty-state actions become secondary (or none, pointing to the one primary); empty-state titles to Satoshi 500 16px `fg-1`. Drop the legend while the graph is empty.

**P2-4. Placeholder copy in the contrast card: "a bad package in 21 repos".**
- Where: `ContrastCard.tsx:71` fallback `grepName ?? 'a bad package'`; the live API does not return `grepName` (only mock mode does, `mock.ts:78`). Design.md specified "debug in 15 repos". Visible in every landing and run screenshot, in monospace as if it were a package name.
- Fix: fall back to the incident's first package (`incident.versions[0].id` without the version), e.g. `debug`, or "debug, chalk, +2".

**P2-5. The onboarding hint is mistimed, mis-aimed and shifts the layout.**
- Where: `App.tsx` `showHint` is true as soon as autoplay ends. At that moment there is no row and no Cypher card (`d-landing-end.png`), step 1's scribble points down-left into the feed (the table is on the right), the card inserts about 62px above the panes on desktop (CLS 0.086 at 14.5 s, the graph re-fits) and about 130px on a phone, and stays after the report.
- Fix: show it only when `report !== null`, auto-dismiss on first row click or Cypher open, aim the scribble at the table column (or remove it), and give the slot a fixed height.

**P2-6. Run triage silently rewinds the timeline from 14:30 to 13:30.**
- Where: `App.tsx` effect `playback.seek(triage.at)`. After the click the contrast card flips: OSV advisories 1 to 0, and the header clock and scrubber go 14:30 to 13:30 (see `d-landing-end.png` vs `d-triage-done.png`). The result also lands with CLS 0.125 (header cluster plus `main`).
- Why: the pitch is "scanner says 0, graph says 21 at 13:30"; it works, but unexplained it looks like a state bug.
- Fix: one transient line in the contrast card or `ReportClock`: "Triage ran at 13:30 UTC (scrubber moved from 14:30)". Reserve the header cluster's width (`min-w`) so it does not reflow.

**P2-7. Errors are infection red, and the spec contradicts itself.**
- Where: `EmptyState.tsx` (`text-infect-400` cause), `ToolCard.tsx` error block, paste validation (`d-error-timeline.png`, `d-error-triage.png`, `d-paste-invalid.png`). design.md section 2 says red means infected only; section 5 allows it on real errors.
- Why: on a screen where red equals malware, "Cannot reach the Patient Zero server" reads as a malware finding.
- Fix: neutral error treatment: `fg-0` cause text, `fg-1` icon, `border-line-3` outline for the block; reserve red for infection. Show the request id in the same block (already done). Replace the raw "upstream failure" with a plain-language line.

**P2-8. Monospace is 72% of rendered glyphs.**
- Where: measured glyph counts: Martian Mono 17,025 vs Satoshi 6,604 vs Cabinet 9; 660 mono elements. Path chips, counts strip, args chips, scrubber labels, and every non-numeric cell in tool-card result tables (`ToolCard.tsx` `RowsTable`, `font-mono` for all non-number cells, including team names and `yes/no`). In the 360px feed this breaks identifiers mid-word ("acme/checkout-\nweb", "supports\n-color"; `d-feed-scrolled.png`).
- Fix: Satoshi for non-id cells (team, synthetic), mono only for repo/package ids, `truncate` with a `title` on ids; keep the 3-column cap but give column 1 `min-w-0`.

**P2-9. Spacing rhythm: four different left edges and off-grid steps.**
- Where: wordmark and hint at x=24 (`--gutter`), scrubber/contrast band at x=16 (`p-4`), feed and filter row at x=12 (`p-3`). design.md section 4: panel padding 16px desktop. Utility counts in `components/` and `App.tsx`: `gap-1.5` x14, `py-0.5` x12, `px-1.5` x10, `mt-0.5` x9, `py-1.5` x4, `px-2.5` x3, plus `gap-2.5` (10px, off the 4/8/12 scale), and pixel-fixed scribble canvases (`h-[100px]`, `h-[140px]`, `h-[170px]`).
- Fix: one left edge: bands `px-(--gutter)`, panes `p-4`. Replace `gap-2.5`/`px-2.5` with 8 or 12; allow 2/6px only inside chips.

**P2-10. Fix drawer footer: five controls wrap to two rows and the real next action is demoted.**
- Where: `FixDrawer.tsx` footer (`d-drawer-fix.png`, `m-drawer-fix.png`): "Copy fix" (white primary), "Report .md", "Report .json", link icon, then "Mark remediated" alone on row two. The two report exports act on the whole report inside a per-repo drawer.
- Fix: one row: primary "Copy fix", secondary "Mark remediated", overflow menu for exports and share link. Move "Report .md/.json" to the Share control in the exec summary.

**P2-11. 21 identical outlined Fix buttons.**
- Where: `ExposureTable.tsx` `fixButton`. Each is a 47x36 bordered button; the action column is the heaviest visual weight in the table and MAINTAINER rows open a drawer that says "Nothing to fix yet".
- Fix: ghost button (text `fg-1`, border on hover/focus), hide it on MAINTAINER rows; the whole row already opens the path.

### P3

- **P3-1. Red outside infection.** `ScenarioControl.tsx:71` biohazard is `text-infect-400` on the selected segment; the 74-min ring is a positive claim drawn in infection red; for a WOULD_PULL (amber) row the selected chain turns red (`d-row2-selected.png`). All three are specified, but they are the only non-infection reds. Fix: selected biohazard to `fg-0`; keep scribbles red (documented exception).
- **P3-2. Scenario control.** 40px tall under coarse pointers (spec 44; `ScenarioControl.tsx` `h-11` applies to the group, not the segments), selected `bg-3` on `bg-0` is barely distinguishable from unselected at a glance, role=radio where Enter runs the triage and the third segment opens a panel, and the third option is cut off ("Describe ar") on phones with no scroll cue.
- **P3-3. Header badge copy.** "LLM live" and "21/21 traced" are noun-less; "27 queries" in the header vs "17 tool calls" in the feed header looks inconsistent. Fix: "21/21 claims traced", "27 Cypher queries".
- **P3-4. Graph legend.** Seven entries wrap to two rows at 360px feed plus 480px table (`d-triage-done.png`), one is an invisible placeholder, and a legend shows for an empty graph (`d-error-timeline.png`). The "qix" label crowds "ansi-styles@6.2.2" when a WOULD_PULL chain is selected.
- **P3-5. Hop dots.** The "••" glyph on the selected row is 4.29:1 on `bg-3` (spec note: `fg-2` only down to bg-2) and floats far from its chip. Fix: `fg-1`, inline after the last chip.
- **P3-6. Exec summary.** Top-3 maintainer shares sum to 101% (43/29/29); "share of the top 3's combined PageRank" is jargon on a card that is the future share image; the card is `bg-1` on a `bg-1` pane (no lightness step).
- **P3-7. First-timer gap.** No one-line statement of what Patient Zero is on the page (only the meta description), favicon is `data:,`.
- **P3-8. Live regions.** 17 empty `aria-live=polite` containers (one per tool card for the plan block) plus the status regions; harmless, noisy for screen-reader users.
- **P3-9. Dead wiring.** `ContrastCard` ignores its `scribble` prop (comment says so), `min-h-(--row-h)` on `<tr>` has no effect, the `.animate-radar-blip` class is defined outside the token file.

### Verified good (do not regress)
- One red rule: red appears only on LOCKED, malicious version suffixes, first-publish marker, the tier bar segment, bad graph nodes, infection scribbles (plus the errors and selected biohazard noted above). Zero red buttons, links, focus rings or selections.
- Fonts: only the three allowed families rendered; preload works (woff2 at about 55 ms).
- Motion: no `transition: all`, no `ease-in`, all finite durations from tokens (draw 600, sweep 900, fade 120, enter 200, drawer 280). After a run completes there are 0 infinite animations (`INFINITE ANIMS after done: []`); the radar is the only infinite animation and only while pending. Drawer: native `<dialog>`, focus trapped, Esc closes.
- Reduced motion (`d-reduced-motion-landing-1s.png`, `d-reduced-motion-triage.png`): 0 running animations on landing and after the run, final state at once (clock 14:30, button reads "Play the 90 minutes"), scribble masks off, `--dur-fast` 0ms.
- Empty/error states state cause plus next action with a request id: timeline failure, triage failure, invalid paste URL (`d-error-timeline.png`, `d-error-triage.png`, `d-paste-invalid.png`).
- Theming: no hard-coded colour in components; contrast scan passes except decorative hop dots.

---

## 4. The 7 highest-leverage fixes

1. **Make the table the first thing a laptop sees after Run triage (P0-1).** Collapse the landing band and hint once a report exists, shrink `ExecSummary` to a one-line strip, single-row filters. Acceptance: header plus 6 rows visible at 1366x768.
2. **Fix the table geometry (P1-1, P2-11).** Move the `dev` tag out of the Tier chip, widen the Tier column, add the Fix cell gutter, ghost the Fix buttons. Removes the one visibly broken thing in the hero table.
3. **Give the 74-minute reveal its moment and one definition (P1-2, P1-3).** Gate the figure and scribble on the playhead passing 14:26; use the same rule for the landing and the report figure so axios does not flip 128 to 105; size the ring to the number.
4. **Make Try axios 2026 presentable (P1-4, P1-3).** Collision-free scrubber labels and a ring that fits "128 min"; the second scenario is the generalisation proof.
5. **Fix the phone flow (P1-5).** No hint under 1024px, scroll to the result after layout settles, and put the table before the summary under 768px.
6. **Copy and CTA pass (P2-3, P2-4, P2-5, P2-6, P3-3).** One primary button per view, real package name instead of "a bad package", hint only after a report and aimed at the table, one line explaining the 14:30 to 13:30 rewind, "21/21 claims traced".
7. **Quiet the narrative and the numbers (P2-1, P2-2, P2-8).** Chip only first mentions, remove the repeated tier counts and extra clocks, set non-id cells in Satoshi so identifiers stop breaking.

Next commands in order: `/impeccable layout` (1, 2, 5), `/impeccable harden` (3, 4), `/impeccable clarify` (6), `/impeccable distill` (7), `/impeccable polish`. Re-run `/impeccable critique` after the fixes; the 32/40 target needs the P0 and P1 items cleared.

Questions skipped: this run was delegated report-only with no interactive answer channel (no AskUserQuestion tool), so the targeted follow-up questions are returned to the caller instead of asked.

---

## 5. Screenshot index (`qa/reports/phase3-impeccable/`)

Desktop 1440x900: `d-landing-t1s.png`, `d-landing-t6s.png`, `d-landing-end.png`, `d-triage-running-1s.png`, `d-triage-running-5s.png`, `d-triage-done.png`, `d-table-scrolled.png`, `d-table-overlap-zoom.png`, `d-row2-selected.png`, `d-feed-scrolled.png`, `d-drawer-fix.png`, `d-drawer-notice.png`.
Other viewports and states: `d-1366x768-triage.png`, `d-1280x720-triage.png`, `d-reduced-motion-landing-1s.png`, `d-reduced-motion-triage.png`, `d-error-timeline.png`, `d-error-triage.png`, `d-paste-idle.png`, `d-paste-invalid.png`, `d-alert-panel.png`, `d-axios-landing-end.png`, `d-axios-scrubber-zoom.png`, `d-axios-128min-zoom.png`, `d-axios-triage.png`.
Mobile 375x812 (coarse pointer): `m-landing-t1s.png` (+ `-full`), `m-landing-end.png` (+ `-full`), `m-triage-feed.png` (+ `-full`), `m-triage-graph.png`, `m-triage-table.png`, `m-table-row.png` (identical to the table shot: the Fix button was already at the viewport edge), `m-drawer-fix.png`.
Note: the mobile `-full` shots show the fixed tab bar mid-page, an artefact of full-page capture.
