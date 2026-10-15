# Patient Zero: Phase 3 round 3, keyboard and screen-reader QA

Persona: keyboard-only screen-reader user (no mouse; `keyboard.press` only). Headless Chromium via Playwright, 1440x900 and 375x812 (plus 720x450 = 200% zoom and 320x256 = 400% reflow), dev server `localhost:5173`. axe-core 4.14.0 (repo copy), a MutationObserver recorder on `[aria-live]` / `role=status|alert|log`, one pass each with `prefers-reduced-motion: reduce` and `forced-colors: active`. No repo file edited. Screenshots: `phase3r3-a11y/`. Other QA agents were using the same servers at the same time, so absolute timings are approximate; counts and focus facts are exact.

## 1. Verdict

**Automated gate: PASS (0 violations of any impact in 14 states, plus 7 re-runs under the wcag22aa + best-practice tag set; contrast sweep of about 1,690 text nodes min 4.94:1). Manual accessibility bar: not yet met, 8/10 overall (round 2: 7/10).**

Round 2 is mostly fixed and the keyboard model is now genuinely good: roving-tabindex table (its 21 rows are two tab stops, repo and Fix, instead of about 40), no focus hidden behind the sticky bars (0 of 83/73/73 stops at 1440/720/375), autoplay is silent (74 announcements in 15 s down to 0 to 1), the radio group no longer runs on arrow keys, "Show N more" lands focus on the first new card and says so, Home/End work on the drawer tabs, and selection is visible in forced colors. What keeps it under 9 is a new cluster that axe cannot see: (1) a **false "The clock moved to 00:00 UTC. Re-run to update" status spoken after every triage**, with a contradictory strip flashing on screen; (2) the **slider is still chatty at a human key cadence** (22 to 40 status messages per 10 presses, 4 per step, each about 25 words); (3) **Undo drops focus to `<body>`** (inside an open modal, and silently in the table row); (4) a **toast fully covers the focused Ask input** for about 3 s after every triage; (5) **"Show all N rows" leaves focus off screen**; (6) **55 Tab stops** to the first tool card because the Narrative opens itself on focus and has no skip link past it.

## 2. Friction log (keystrokes counted from a fresh page, no mouse)

| # | Step | Keys | What happened | Screenshot |
|---|---|---|---|---|
| 1 | Pause autoplay | Tab x2, Enter | Tab 1 = "Skip to results", Tab 2 = "Pause the autoplay". Enter flips it to "Resume the autoplay", focus kept, clock frozen, 0 announcements (the label change is the feedback). Good. | `r3-01-paused.png`, `r3-80-skip-link-visible.png` |
| 2 | Scenario radio, before a triage | Tab, ArrowRight | One tab stop (roving). ArrowRight selects axios, **nothing runs, focus stays**, no panel opens (round-2 P2 fixed). But each arrow press announces two long empty-state statuses ("No paths yet...", "No exposures to show yet ... Run triage at 01:30") (nice-to-have). ArrowRight onto "Describe an alert..." opens nothing; Space opens the textarea and focuses it; Enter on a scenario runs it (verified: axios). Space on an already selected scenario with no result on screen does nothing. Home/End do not move the selection (not required by the APG radio pattern). | `r3-02-radio-qix.png`, `r3-03-alert-field.png`, `r3-70-axios-triage.png` |
| 3 | Run triage | Tab x8 after Pause (10 from the top), Enter | Focus moves to the "Tool feed" region, ring visible. 9 status messages in 2.5 s: Starting the triage / 1 of 2 tools done / 47 of 48 / Scrubber moved... / 49 of 49 tools done / All claims verified: 61/61 / Triage complete: 49 tools / Follow-up 1 of 4 / **"The clock moved to 00:00 UTC. Re-run to update" (false, see fix 1)**. Server was cached, so about 0.5 s end to end. | `r3-04-after-triage.png` |
| 4 | Skip links | Tab x2, Enter | From the feed region: "Skip to Ask", "Skip to exposure table". Enter on the latter focuses `#exposures` with a ring. Header skip link "Skip to results" focuses `main#results` with a ring. | `r3-05-skip-link-focus.png`, `r3-06-after-skip-table.png`, `r3-81-after-skip-results.png` |
| 5 | Reach "Prod only" | after triage: Tab, Tab, Enter, Tab x3 = 6 keys, then Enter/Space | Skip to table, then Dismiss, Copy share link, Prod only. From a cold page it is 7 keys to land in the table plus 3 Tabs (10). At 375 it is 2 Tabs after the Table panel opens. Enter announces "14 of 21 shown", Space "21 repos". | `r3-07-table-focus.png` |
| 6 | Rows and row path | Tab x7 from Prod only; Up/Down/Home/End | Roving tabindex: Tier, Filter, Export, REPO, TIER, "?", then one row button; Tab continues to that row's Fix. Up/Down/Home/End move row to row in the repo column and in the Fix column. Enter selects and announces "Selected acme/checkout-web: acme/checkout-web, then express@5.1.0, then debug@4.4.2." The path graph `img` label updates to the same sentence. | `r3-08-row-selected.png` |
| 7 | Fix drawer | Tab x1 to Fix, Enter | Native modal, focus on Close, Tab cycles Close > Fix tab > Copy fix > Mark remediated > More actions > (chrome) > Close. Tabs: arrows wrap and activate, **Home/End now work**. Copy announces "Fix copied" (635 chars on the clipboard). Esc returns focus to "Fix acme/checkout-web" (also after Mark remediated). More actions: Tab walks items, first Esc closes the menu, second the dialog. | `r3-09`, `r3-10`, `r3-11-copy.png` |
| 8 | Mark remediated, Undo | Enter, Enter | Mark remediated moves focus to Undo and announces "Marked remediated. Undo is available for 10 seconds." Enter on Undo: **focus goes to `<body>` while the dialog is still open** ("Undone: not marked remediated" is announced). In the table row (Shift+Tab from Fix, Enter on Undo): **focus to `<body>` and no announcement at all**. After 10 s the Undo vanishes silently and cannot be recovered. | `r3-13`, `r3-15-row-undo-focus.png`, `r3-16` |
| 9 | Tool cards | Tab x55 from the feed region to the first card header | The Narrative has 57 buttons; focusing a clamped line opens "Show the rest" (adds about 38 chips), and there is no skip link past it. Cards toggle with Enter/Space, `aria-expanded` correct, Cypher toggle and "Show plan" ("Query plan loaded for suspect_versions.") work. | `r3-17-card-toggled.png`, `r3-19-show-plan.png`, `r3-20-narr-show-less.png` |
| 10 | "Show all 19 rows" | Enter | Focus is kept (round-2 loss fixed) but lands on "Show the first 5 rows", which is **below the visible pane (vis=false)**; the pane is not scrolled. Nothing announced. | `r3-18-show-all-rows.png` |
| 11 | "Show 18 more explain_path calls" | Enter | Focus goes to the first revealed card (in view) and "Showing 18 more explain_path calls. Focus is on the first of them." is announced. "Show fewer" keeps focus on the toggle. Fixed. | `r3-21-show-more-focus.png`, `r3-22-show-fewer.png` |
| 12 | Claim chip, `[E1]`, "qix" | Enter | Focus moves to the proving card header, which opens; announced ("Opened explain_path, acme/checkout-web, the call that returned E1. Its Cypher is shown and the matching row is highlighted."). The `debug@4.4.2` chip also selects the repo first, so two messages. | `r3-23-chip-activated.png` |
| 13 | Ask a follow-up | Tab x1 (Skip to Ask), Enter, type, Enter | Focus stays in the input. Announced: "Follow-up 1: 0 of 0 tools done", "Follow-up 1 of 4, answering", "Follow-up 1 answered", "Follow-up 2 of 4". The answer text is not announced and sits at the bottom of the feed with its first lines clipped by the pinned Ask bar. Reaching it by keyboard means Shift+Tab then PageDown. | `r3-24-ask-focused.png`, `r3-25-ask-answered.png` |
| 14 | Paste sheet | Enter | Native modal, focus on the URL field, Tab cycles inside. Invalid input: `aria-invalid` plus `role=alert` ("That is not a repo address..."). Unknown repo: alert with request id and sample-repo buttons, focus stays in the field. Typed lockfile: triage runs, dialog closes, focus lands on the feed, hero re-scopes to "pasted/qa-demo". Esc returns focus to "Paste your repo". | `r3-27`, `r3-28`, `r3-95`, `r3-96` |
| 15 | Graph stats | Enter on "Built on FalkorDB" | At 1440 it selects the "Graph stats" tab of the Details panel and focuses that tab (inline, ring visible, no dialog). At 375 there is no header opener; the same tab is inside the Table panel. There is no stats sheet to close in this build, so there is no focus-return to test (Esc does nothing, which is correct for a tab). | `r3-26-stats-sheet.png`, `r3-43-375-stats.png` |
| 16 | Tier legend popover | Enter, Esc | Enter sets `aria-expanded=true` and shows the legend after the button in DOM order (no announcement; reading it is the user's choice). Tab closes it, Esc closes it with focus kept on "?". | `r3-29-tier-legend.png` |
| 17 | Timeline slider | Tab, arrows | `aria-valuetext` "13:05 UTC, 0 repos exposed" (changes per step). Left/Right 1 min, Shift+Arrow 10 min, PageUp/PageDown about 16 min (native), Home/End the ends. The thumb gets a visible ring. See section "Announcement counts" for chatter. | `r3-31-slider-focus.png`, `r3-33-slider-settled.png` |
| 18 | Share link, fresh context | Tab x7 to "Re-check axios/axios" | Nothing steals focus on load; the "Shared result" aside follows the header. Enter on Re-check: focus drops to `<body>` while it analyses (button busy), then lands on the Tool feed; each step is announced. Org-repo link (`&repo=acme/checkout-web&open=notice`) auto-runs and opens the drawer with focus on Close. | `r3-35-share-prompt.png`, `r3-36`, `r3-37` |
| 19 | Free-text alert | Space on radio, type, Tab, Enter | Textarea focused, Tab goes to "Run triage", run lands focus on the feed, "Alert qix compromised, 13:16 UTC" banner shown. 10 messages (includes the false clock one and two empty-state dumps). | `r3-82-alert-run.png` |
| 20 | 375x812 | Tab, Panels bar | 13 tab stops reach the Panels bar; Feed/Graph/Table (`aria-pressed`) move focus into the panel with a ring and nothing is hidden behind the bar. Prod only is 2 Tabs from the Table panel; the drawer opens and Esc returns focus. 44px targets. | `r3-40` to `r3-48` |
| 21 | Reduced motion | n/a | Autoplay does not start (clock frozen), 0 running animations, drawer 0s, Play works on demand. One dev-only console warning from the motion library (as in round 2). | `r3-60`, `r3-61` |
| 22 | Forced colors | n/a | Selected radio is filled with Highlight, the selected row has a 6px Highlight bar plus outline, the selected drawer tab is bold and underlined, "Prod only" pressed shows a check. **The timeline track and event ticks disappear** (only the thumb remains). | `r3-62` to `r3-66` |

### Announcement counts

| Situation | Count | Detail |
|---|---|---|
| 15 s of autoplay on the landing page (no interaction) | **0** | clock runs 13:00 to 14:30 silently |
| 15 s of autoplay after a triage (Play pressed by keyboard) | **1** | "The clock moved to 14:30 UTC. Re-run to update" at the end (round 2: 74) |
| 10 slider steps, 150 ms apart | **4** | 0 while pressing, then 4 on settle |
| 10 slider steps, 400 ms apart | **22** | 2 per step |
| 10 slider steps, 700 ms and 1200 ms apart | **40** | 4 per step: "Updating to 13:00 UTC... showing 13:00 UTC meanwhile", "Showing exposure at 13:01 UTC. Paths and fix drafts belong to the triage run at 13:30 UTC.", "The clock moved to 13:01 UTC.", "Showing exposure at 13:01 UTC..." (each includes the button labels because `role=status` is atomic) |
| Single Home/End jump | 4 | same four messages |
| After a triage completes (+2.5 s) | **9** (qix), 7 (axios), 10 (free text), 8 (pasted lockfile) | includes one false clock message every time, a duplicate "49 of 49 tools done" + "Triage complete: 49 tools", and "Follow-up 1 of 4" |

## 3. Round-2 items

| Round-2 item | Status | Evidence |
|---|---|---|
| P1-1 Focus hidden behind sticky Ask / Panels bars (2.4.11) | **Fixed** | Walked every Tab stop after a triage: 83 / 73 / 73 stops at 1440x900 / 720x450 / 375x812, **0 fully hidden**, none partly covered by a fixed or sticky element (round 2: 14 / 19 / 19). `r3-98-fno-1440x900.png`, `r3-98-fno-720x450.png` (topmost element at the focus centre is the element itself). |
| P1-2 Live-region spam: autoplay 74 / 15 s | **Fixed** | 0 on landing, 1 after triage. |
| P1-2 Live-region spam: slider 2 per step | **Partly, regressed at human pace** | 150 ms cadence: 4 per 10 steps (was 20). 400 ms: 22; 700 ms+: 40, i.e. 4 per step, because the 600 ms debounce (`App.tsx:142`) is shorter than a screen-reader user's cadence and a new stale-clock banner adds two more messages per step. Fix 2. |
| P2-1 Focus lost to `<body>`: hint "Dismiss" | **Fixed** | Enter on Dismiss lands on `section#exposures`. |
| P2-1 Focus lost: "Show all N rows" | **Partly** | Focus kept now, but it ends on "Show the first 5 rows" outside the viewport (`r3-18`). Fix 5. |
| P2-2 Radio group steals focus / silently re-runs | **Fixed** | Arrow moves selection only, focus stays, no run, no panel; Enter runs. After a triage the old report stays on screen with its own heading until Enter (acceptable; `r3-99`). |
| P2-3 "Show N more calls" strands focus | **Fixed** | Focus on the first new card (y=447, in view), announced. |
| P2-4 Forced colors: selected radio / tab / row identical | **Fixed** | Highlight fill, row bar + outline, bold + underlined tab (`r3-62` to `r3-66`). New P3: slider track/ticks vanish. |
| P3 Home/End on drawer tabs | **Fixed** | Home -> Fix, End -> Notice, arrows wrap. |
| P3 "0 of 0 tools done" at every run | **Partly** | Gone from triage runs ("1 of 2", "47 of 48", "49 of 49"); still "Follow-up 1: 0 of 0 tools done" on every Ask. |
| P3 Ask answer sits before the input, not announced | **Partly** | "Follow-up 1 answered" is announced now, but not the answer, no focus/scroll to it, and the pinned Ask bar clips it (`r3-25`). |
| P3 3x "Run triage", 2x "Paste your repo" | **Not fixed** | Landing still has "Run triage at 13:30 UTC" x2 + "Run triage", and "Paste your repo" in header and hero. |
| P3 about 40 landmarks named "Query" | **Partly** | Now `role=group`, not landmarks: 21 identical "Query" plus 13 "Query N of M" in the post-triage tree. |
| P3 "?" and "[E1]" cryptic names (2.5.3) | **Partly** | Landing help button now "? What the tiers and OSV mean". The table's "?" is still `aria-label="What the tiers mean"` (axe `label-content-name-mismatch` incomplete in states 3, 6 and 8). `[E1]` unchanged. |
| Friction 2: Pause keeps focus, 8 Tab to Run triage, focus to feed | **Same / fixed** | 2 Tabs to Pause, 8 more to Run triage, focus on the feed. Status count went from 7 to 9 (incl. 1 false). |
| Friction 3: table 78 stops, row announce, Fix modal, Esc return | **Fixed and better** | Roving tabindex (7 Tabs to first row), "Selected ..." announcement, Esc returns to the Fix opener. |
| Friction 4: Copy "Slack message copied", More actions | **Same** | Notice tab still announces "Slack message copied", Fix tab "Fix copied"; More actions menu and Esc order correct. |
| Friction 5: slider keys + valuetext | **Same** | All keys work; valuetext fine. |
| Friction 6: chips move focus and announce | **Same** | Works. |
| Friction 8/9: Ask focus, paste alerts, Esc, lockfile | **Same** | Works. |
| Friction 10: reduced motion, 200% zoom, 320 px | **Same** | 0 animations; no horizontal scroll at 720x450 or 320x256. |
| R1 S-3 "narrative ready" | **Fixed** | "All claims verified: 61/61 claims traced to graph queries" then "Triage complete: 49 tools". |

## 4. axe results (axe-core 4.14.0, all rules; states 2, 3, 4, 6, 7, 8 and 9b were re-run with the wcag22aa + best-practice tag set and gave identical results)

| # | State | Critical | Serious | Moderate | Minor | Incomplete (manual verdict) |
|---|---|---|---|---|---|---|
| 1 | 1440 landing, autoplay running | 0 | 0 | 0 | 0 | 0 |
| 2 | Landing, autoplay paused | 0 | 0 | 0 | 0 | 1 h1 contrast (overlap); passes manually |
| 3 | After qix triage | 0 | 0 | 0 | 0 | 2 contrast (overlap, manual min 4.94:1); table "?" label-in-name (P3) |
| 4 | Fix drawer | 0 | 0 | 0 | 0 | 0 |
| 5 | Notice tab | 0 | 0 | 0 | 0 | 0 |
| 6 | After Ask answer | 0 | 0 | 0 | 0 | 2 (16 contrast nodes, partially obscured; manual pass), same "?" |
| 7 | Paste sheet with error | 0 | 0 | 0 | 0 | 0 |
| 8 | After axios triage (keyboard, Enter on radio) | 0 | 0 | 0 | 0 | 2 as 3 |
| 9 | 375: landing / Feed / Graph / Table | 0 | 0 | 0 | 0 | 1 each: skip-link "target should become visible" (false positive, ring and focus verified) |
| 10 | 720x450 landing and triage | 0 | 0 | 0 | 0 | 1 skip-link, same |
| 11 | Reduced motion + forced colors, after triage | 0 | 1 (312 nodes) | 0 | 0 | 2 | 

State 11: `color-contrast` x312 is an **axe false positive**: under `forced-colors: active` the page is system black on white (`r3-62`, `r3-63`); axe cannot resolve system colours. Excluding it: 0.

**Totals: 0 critical, 0 serious, 0 moderate, 0 minor across states 1 to 10.** Own contrast sweep (about 1,690 text nodes, all cards expanded, drawer, paste panel): 0 failures, minimum 4.94:1, placeholders 5.23:1. Other measured checks: no horizontal scroll at 720x450 or 320x256; 1.4.12 text-spacing override clips nothing new; target size 2.5.8: 63 on-screen targets at 1440, 18 under 24 px, all pass the spacing exemption (the 2 flagged were card headers sliding under the pinned Ask bar); CLS 0.014 at 1440 and 0.087 at 375 after a triage.

## 5. Scores (bar >= 9, honest)

| Dimension | Score | Why |
|---|---|---|
| Clarity | 8 | Names, "Selected / Opened" messages and forced-colors selection are clear, but a false and self-contradictory clock banner flashes on screen after every run ("Run triage at 13:08 UTC" next to "Showing exposure at 13:30 UTC"). |
| Speed | 8 | 2 Tabs to Pause, 10 to Run triage, 2 to Ask / table, 7 to the first row, CLS fine; but 55 Tabs to the first tool card (the FalkorDB proof) and no skip link to it. |
| Correctness | 7 | Data and traces are right; the UI speaks a wrong time after every triage, Undo drops focus (and is silent in the row), "Show all rows" leaves focus off screen. |
| Trust | 8 | 61/61 claims traced, alerts on every error, 0 console errors; a spoken "00:00 UTC" erodes it. |
| Delight | 9 | Chips jump to evidence, roving table, Home/End, silent autoplay, reduced motion honoured, clean forced-colors selection. |
| Accessibility | 8 | axe clean, contrast clean, reflow and spacing fine; four manual P2 issues (slider chatter, Undo focus loss, toast over focus, off-screen focus) plus the false status. |

Overall 8/10.

## 6. Ranked fixes to reach >= 9

1. **blocking-9: false "The clock moved to ..." after every triage.** Repro: Tab, Enter (Pause), Tab x8, Enter on "Run triage at 13:30 UTC"; watch `role=status` about 1.6 s later. Saw: "The clock moved to 00:00 UTC. Re-run to update" (also "13:08 UTC" after a lockfile paste, "13:30 UTC" when re-running axios after qix) for about 160 ms while the run is still going, plus a strip reading "Showing exposure at 13:30 UTC ... Run triage at 13:08 UTC" (`r3-97-false-clock-banner.png`); header and slider already say 13:30. Seen after qix, axios, free-text, share-link and paste runs. Expected: no stale banner when the run clock equals the scrubber. WCAG 4.1.3 (misleading status), 3.3 intent. Suspected: `NarrativePanel.tsx:350-357` fed by `settledAt = useSettled(at, 600, playing)` (`App.tsx:142,473`), which lags `at` and starts from a stale or zero value; set the settled value when a run completes or require `settledAt` to have caught up before computing `stale`.
2. **blocking-9: slider and clock status chatter at human cadence.** Repro: finish a triage, Tab to "Scenario time, UTC", press ArrowRight 10 times about 700 ms apart. Saw 40 status messages (4 per step, about 25 words each, with button labels because the region is atomic), including "Updating to 13:00 UTC... showing 13:00 UTC meanwhile". Expected: at most one message after about 1.5 s idle, or none (the slider's own `aria-valuetext` already speaks each step); never "Updating to X" in a live region. WCAG 4.1.3, persona "not chatty". Suspected: `App.tsx:142` (600 ms), the "Showing exposure at ..." / "Updating to ..." strip in `TimelineScrubber.tsx` and the stale paragraph in `NarrativePanel.tsx`.
3. **blocking-9: Undo drops focus.** Repro A: open Fix, Mark remediated (focus goes to Undo), Enter. Saw focus on `<body>` with the modal still open. Repro B: Esc, Shift+Tab from "Fix acme/checkout-web" to "Undo", Enter: focus on `<body>`, no announcement. Expected: focus to "Mark remediated" (A) or to the row's Fix button (B), and "Undone" announced in both. WCAG 2.4.3, 4.1.3. Suspected: `FixDrawer.tsx:291` (no focus after `onUndo`), table row Undo in `ExposureTable.tsx` `tierCell` (about line 237).
4. **blocking-9: toast covers the focused Ask input.** Repro: after a triage press Tab, Tab to "Skip to Ask" and Enter within 3 s. Saw the "Scrubber moved from 13:08 UTC to 13:30 UTC, the clock this triage ran at." toast (16,820 320x64) cover the input (12,821 274x36) on all sample points at 1440 and 375 (`r3-38-toast-over-ask-1440.png`); its Dismiss is last in DOM so unreachable. Expected: toasts never hide a focused control. WCAG 2.4.11. Suspected: `Toasts.tsx` (fixed bottom-left) vs the pinned Ask bar; move toasts (top right or above the Ask bar) and drop this one, it duplicates the live region.
5. **blocking-9: "Show all N rows" leaves focus off screen.** Repro: Tab to the first card header, Enter, Tab, Enter on "Show all 19 rows". Saw focus on "Show the first 5 rows" below the pane (vis=false), pane not scrolled (`r3-18-show-all-rows.png`). Expected: toggle stays in view (`scrollIntoView({block:'nearest'})`) or sits above the rows. WCAG 2.4.7, 2.4.11. Suspected: `ToolCard.tsx:99-130` `RowsTable`.
6. **blocking-9 (Speed): 55 Tab stops to the first tool card.** Repro: after a triage focus the Tool feed region, Tab until "suspect_versions". Saw 55 (Narrative has 57 buttons; tabbing into a clamped line expands "Show the rest" and adds about 38 more). Expected: a "Skip to tool calls" link beside "Skip to Ask / table", or chips inside one composite stop. WCAG 2.4.1, 2.4.3 efficiency. Suspected: skip nav in `ToolFeed.tsx`; focus-expand handler `NarrativePanel.tsx:249`.
7. **nice-to-have: Ask answer delivery.** Repro: Skip to Ask, type, Enter. Saw "Follow-up 1: 0 of 0 tools done" then "Follow-up 1 answered" only; the answer starts at y=701 and its text is clipped under the Ask bar (`r3-25`). Expected: announce the first sentence (or move the answer into view), drop "0 of 0". WCAG 2.4.3, 4.1.3.
8. **nice-to-have: forced-colors slider.** Repro: `forced-colors: active`, look at the timeline: no track or ticks, only the thumb (`r3-62-fc-landing.png`). Expected: ButtonText track and ticks. WCAG 1.4.11. Suspected: `TimelineScrubber.tsx` / `styles.css` range track.
9. **nice-to-have: names.** Table "?" `aria-label="What the tiers mean"` vs visible "?" (2.5.3); 21 identical `group "Query"`; `[E1]`; 3x "Run triage", 2x "Paste your repo". Suspected: `ExposureTable.tsx:130`, `ToolCard.tsx:399,421`.
10. **nice-to-have: quieter completion.** After a triage there are 7 to 10 messages; fold "49 of 49 tools done" + "Triage complete" + "Follow-up 1 of 4" into one, and stop re-announcing the two empty-state paragraphs on every arrow press on the radio. WCAG 4.1.3, best practice.
11. **nice-to-have: Undo window.** 10 s, no extension, silent expiry. WCAG 2.2.1.

## Console

0 console errors, 0 page errors, 0 HTTP >= 400 in every run (paste, share, axios, 375, forced colors, reduced motion). One dev-only warning under reduced-motion emulation from the motion library ("You have Reduced Motion enabled on your device..."), although `MotionConfig reducedMotion="user"` is set (`main.tsx`). `net::ERR_ABORTED` on `/api/timeline`, `/api/triage`, `/api/analyze` are client fetch cancels.
