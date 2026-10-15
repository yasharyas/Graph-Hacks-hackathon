# Patient Zero - Phase 3 keyboard-only and screen-reader QA

Tester persona: first-time user, keyboard only (Tab, Shift+Tab, Enter, Space, Escape, arrow keys), plus accessibility-tree inspection.
App: http://localhost:5173/ (live API, live FalkorDB). Headless Chromium 151 via Playwright, 1440x900 and 375x812. axe-core 4.14.0 (from `node_modules/axe-core/axe.min.js`).
No repository file was edited. Screenshots are in `qa/reports/phase3-a11y/` (paths below are relative to `qa/reports/`).

## Verdict

The keyboard journey is complete end to end with no keyboard trap, and focus is visible on every real control. The app does not meet the accessibility bar of 9/10 or the "serious/critical = 0" gate, for three reasons:

1. axe reports 2 serious violations (WCAG 2.5.3 label-in-name) whenever the Fix drawer is open, at both 1440 and 375.
2. A genuine focus-loss bug on the "Pause the autoplay" control.
3. 71 tab stops stand between the first narrative claim and the Ask box, so the keyboard cost of the main journey is high.

Console: 0 app errors, 0 page errors, 0 HTTP >= 400 across all runs. One aborted request (`GET /api/timeline?scenario=qix-2025-09-08 net::ERR_ABORTED`) appears to be a normal fetch abort.

---

## 1. Keyboard journey log (1440x900, fresh browser, real key presses only)

| Step | Keys | Result |
|---|---|---|
| Load | - | 1.6 s to network idle, DOMContentLoaded 0.72 s, 2 KB HTML |
| First Tab | Tab | "Skip to results" link appears top-left with a visible ring (`J01-skip-link-focused.png`) |
| Skip link | Enter | Focus moves to `main#results`, hash `#results`. The main has no visible outline (see A-6). |
| Reach "Run triage" | 3 Tab | Pause, slider, Run triage. Without the skip link it is 7 Tab (skip, Pause-the-autoplay, scenario radio, Paste, Pause, slider, Run triage). |
| Run qix triage | Enter | `Triage complete: 17 tools` after 0.8-2.4 s. Focus moves to the Tool feed region. Narrative claim chips appear after about 3 s (the LLM narration is non-deterministic: 13, 21 and 26 claims across runs). |
| Tool feed and narrative | Tab | First stop is the first claim chip `qix-2025-09-08 (verified)`. Enter on a chip highlights its path in the graph (silent, no announcement). |
| Ask box | 71 more Tab | Each of the 17 tool cards has 3 stops (Copy Cypher, Show plan, Cypher toggle), plus about 20 claim and evidence chips. Typing the question and pressing Enter gives an answer in 1.1 s. Focus stays in the input. Status "Follow-up 1 answered" is announced. |
| Exposure table | 7 Tab from Ask | Share, Prod only, Tier select, Filter, REPO sort, TIER sort, first row button. About 85 Tab from the Tool feed to the first row, 80 to the first Fix button. |
| Row path | Enter on row button | The row gets `aria-current="true"`. The graph label becomes "Path graph. Selected: acme/checkout-web. Path: acme/checkout-web, then express@5.1.0, then debug@4.4.2." (`J05-row-path.png`). This is not a live region, so nothing is announced. |
| Fix drawer | Tab, Enter | Native `<dialog>` opened with `showModal` (`:modal` is true, role dialog, name "acme/checkout-web"). Focus lands on "Close". Tab cycle: Fix tab, Copy fix, Export Markdown, Export JSON, Copy share link, Mark remediated, then browser chrome, then Close again. Focus never reaches the page behind. The Fix/Notice tabs respond to ArrowLeft and ArrowRight. Escape closes it and focus returns to "Fix acme/checkout-web". Enter on Close does the same. |
| Paste panel | Enter on "Paste your repo" | Inline disclosure with `aria-expanded`. Focus moves to the "GitHub repo URL" input. Tab goes to Choose package-lock.json, then Close. Enter on Close collapses it and returns focus to the trigger. Ctrl+V of a lockfile triaged it in 0.7 s and moved focus to the Tool feed. Escape does nothing (see A-9). |
| Describe an alert | radio ArrowRight x2, Tab to textarea, type, Tab, Enter | Works at both widths. The textarea has a visible label and a 0/500 counter (`aria-describedby`). |
| Totals | - | 194 key presses for the full journey, including 33 typed characters |

Other verified behaviour:

- Scenario radiogroup uses roving tabindex. ArrowLeft and ArrowRight wrap and select immediately. Home and End do nothing.
- Time slider: 60 s step, PageUp and PageDown, Home and End all work. `aria-valuetext` is "13:19 UTC, 21 repos exposed", so it is not a raw epoch value. Thumb has a visible focus ring (`focus-06-slider.png`).
- Cypher toggle has `aria-expanded`. "Copy Cypher" announces "Cypher copied" in a polite live region.
- Tab order is logical top to bottom, left to right. The graph canvas is not a tab stop. It has `role=img` plus a hidden list "Exposed repos and their paths" for screen readers.
- Autoplay ends by itself at about 12 s (13:03 to 14:30). At that point the hero CTA row and hint strip are inserted and the layout shifts. Cumulative layout shift is 0.139 in the first 15 s (94 shifts, max 0.086).
- 375 wide: bottom "Panels" bar (Feed, Graph, Table) uses `aria-pressed` toggles. The skip link "Skip to exposure table" correctly switches to the Table panel and focuses `#exposures`. The drawer is full screen, modal, and Escape returns focus.

### Friction log (first-time user, in the order met)

1. After pressing "Run triage" focus jumps to the Tool feed region, but no ring is shown on it (it is a programmatic focus target with `outline: none`). I could not see where I was until the next Tab. (A-6)
2. I wanted to reach the table. There are two ways, both slow. Tab forward about 85 times through every tool card. Or Shift+Tab 9 times back to a second skip link "Skip to exposure table" that sits at the very top of the page, behind the user. (A-3)
3. The Ask box is 72 tab stops from the Tool feed focus. There is no shortcut to it. (A-3)
4. The first Tab stops on a hidden-until-focus "Pause the autoplay" button. Pressing Enter on it makes the button disappear and focus falls to `<body>`. I lost my place and the next Tab restarted from the top. If I only waited about 12 s on it, the same thing happened. (A-2)
5. At 1440x900 after triage, the hero, hint strip and (when replay is active) the "Narration replayed" banner use about 380 px. The three panes get about 485 px. The table shows one row and the Ask input is half clipped at the bottom edge (`J05-row-path.png`). (C-1)
6. In the table at 1440 the tier chip "WOULD_PULL dev" is wider than its column and collides with the first path chip (`06-table-zoom.png`). (C-2)
7. In the axios scenario the timeline labels "02:19 alert" and "08:15 removed" print on top of each other (`20-axios-landing-1440.png`). (C-3)
8. After pasting my own lockfile, the hero on the left still says "21 repos one install from malware, LOCKED 1, WOULD_PULL 20", while the right side says 1 of 1 repos (`11-paste-lockfile-result.png`). (C-4)
9. At 375 the scenario strip is clipped at the right edge, so "Describe an alert..." is only partly visible. The default panel is Graph and the only "Run triage" is in the hidden Feed panel. After pressing Enter on "Feed", Tab goes to Graph and Table, not into the panel, because the tab bar is last in the DOM. Shift+Tab is needed to reach "Run triage". (A-8)
10. Enter on a narrative claim chip or an [E1] chip changes the graph or scroll but nothing is announced and focus stays put. (A-10)

---

## 2. axe-core results (axe 4.14.0, all default rules, plus an extra run with wcag2a/aa/21/22aa, best-practice and target-size enabled)

Gate: serious/critical violations must be 0.

| State | 1440 violations | 375 violations |
|---|---|---|
| Landing | 0 | 0 |
| After triage (375: Feed, Graph and Table panels each run) | 0 | 0 |
| Fix drawer open | **2 (serious)** | **2 (serious)** |
| Paste panel open | 0 | 0 |

Violation detail (identical at both widths, drawer open):

| Rule | Impact | Element | Count |
|---|---|---|---|
| `label-content-name-mismatch` (WCAG 2.5.3 Label in Name, level A) | serious | `dialog .border-t.p-4.gap-2 > button.btn.btn-secondary:nth-child(3)` - visible text "Report .md", `aria-label="Export the whole report as Markdown"` | 1 |
| `label-content-name-mismatch` | serious | `... > button.btn.btn-secondary:nth-child(4)` - visible text "Report .json", `aria-label="Export the whole report as JSON"` | 1 |

Result: serious/critical count is 2 at each width, so the gate is not met.

"Incomplete" (needs manual review) items, with my manual verdict:

| Rule | Where | Count | Verdict |
|---|---|---|---|
| `aria-prohibited-attr` (serious) | after triage, 1440: 41 nodes, 375: 19 (Feed), 2 (Graph), 23 (Table). `aria-label` on role-less `<span>`: 17x "FalkorDB execution time N ms", 15x "1 hop", 2x "2 hops", 4x "declared directly by the repo", plus "FalkorDB execution time N milliseconds across 27 queries", "Narration mode: replay/live", "All claims verified: 21 of 21 traced to graph queries" | 41 | Real defect. Many screen readers ignore `aria-label` on a generic span, so the dots "•" and "••" read as "bullet" and the claims badge loses "All claims verified". Chromium does fold the labels into row names, so this is partly mitigated. (A-5) |
| `color-contrast` (serious) | "74 min" scribble heading, "before the OSV record existed", row path chips, drawer text (backgrounds overlapped by an image, canvas or another element) | 2-8 | Cannot be computed by axe. I computed these by hand: all pass (see section 4). |
| `skip-link` (moderate) | 375 after triage: `a[href$="#exposures"]` | 1 | False positive. I verified it switches to the Table panel and focuses `#exposures` (`13-after-skip2-375.png`). |
| `heading-order` (moderate) | 375 axios after triage | 18 | Hidden panels. Heading levels in the live tree are H1, H2, H3 with no skipped level (H1 Patient Zero, H2 Tool feed, H3 Narrative, H3 tool names, H2 Path graph, H2 summary, dialog H2). |

Also checked: with `target-size` enabled (WCAG 2.2, 24 px) there are no violations, even though claim chips are 22 px tall, [E1] chips 18 px and "Cypher" toggles 18 px (spacing exception).

Screenshots: `axe-1440-after-triage.png`, `axe-1440-drawer.png`, `axe-1440-paste-panel.png`, `axe-375-landing-feed.png`, `axe-375-after-triage.png`, `axe-375-after-triage-graph.png`, `axe-375-after-triage-table.png`, `axe-375-drawer.png`, `axe-375-paste-panel.png`, `00-landing-1440.png`.

---

## 3. Landmarks, headings, names, live regions

- Landmarks: skip links, `banner` (header), `main#results`, `contentinfo` (footer), `navigation "Panels"` (375 only), `complementary "Narration mode"` (when active), and labelled regions: Incident timeline, Scanner versus graph, Tool feed, Narrative, Path graph, Exposure results, Executive summary, Exposed repos, Details. Good.
- Headings: one H1. No skipped levels. Tool cards use H3 inside the H2 Tool feed. Repeated H3 names ("explain_path" x5, "draft_remediation" x5) are indistinguishable when navigating by heading (P3).
- Accessible names: 137 interactive nodes in the AX tree, 0 unnamed. Icon-only buttons are all named: Close, Copy Cypher, Show plan, Copy fix, Copy share link, the 375 header paste icon ("Paste your repo"), "Fix <repo>" (visible text "Fix" is contained in the name, so it passes label-in-name). Table has a caption and sortable headers expose `aria-sort`. "Show plan" flips to "Hide plan" and also sets `aria-pressed=true`, which is double state (P3).
- Live regions:
  - Tool feed progress: `role=status` ("N of M tools done", then "Triage complete: 17 tools"). It does not read every card, which is the right level. Follow-up status: "Follow-up 1 answered".
  - Claims badge: header `div[aria-live=polite]` with "21/21 traced". Present and working. The `aria-label` inside it is not announced (see A-5).
  - Toast list `ul[aria-live=polite]` announces "Cypher copied". Each tool card also has an empty polite region (used for the plan text).
  - Not announced: row selection (only `aria-current`), claim chip highlight, graph path change.
- Slider: label "Scenario time, UTC", `aria-valuetext` "13:19 UTC, 21 repos exposed". Good.

## 4. Colour contrast (computed by hand, all text nodes in landing, after-triage, drawer and paste states)

| Item | Ratio | Note |
|---|---|---|
| Tier chip LOCKED (#ff5a4f on #331c1c) | 5.16:1 | pass (11 px) |
| Tier chip WOULD_PULL (#e8a33d on #30261a) | 6.87:1 | pass |
| "dev" badge on WOULD_PULL | 6.08:1 | pass |
| Muted `text-fg-1` (#a8a6a0) | min 6.08:1 (7.69 on panels) | pass |
| Muted `text-fg-2` (#85837e) | min 4.63:1 on panels | pass |
| `••` hop dots (fg-2 on bg-3 #202024, 11 px) | **4.29:1** | fails 4.5 (P3) |
| Placeholder text, e.g. Ask input "Which team should I notify first?" (fg-3 #6b6964) | **3.61:1** | fails 4.5 (P3). The describe and paste placeholders use the same token. |
| Focus ring (#eceae6, 2 px, 2 px offset) | about 16:1 | pass |

## 5. prefers-reduced-motion: reduce (emulated)

Passes. Compared with the default:

| | Default | Reduce |
|---|---|---|
| Landing autoplay | clock 13:03 to 14:30 over about 12 s, counters animate | clock frozen at 14:30. Button reads "Play the 90 minutes". The "Pause the autoplay" button is absent. Screenshot hash identical over 5 s. |
| `document.getAnimations()` on landing | 4 (scribble wipe-in, sweep-in, 2 fades) | 0 |
| Scribbles (the "74 min" ring, arrows, underline) | animate in | rendered complete and static (`14-reduced-motion-landing-1440.png`) |
| Graph particles (canvas) | moving red dots | none. Canvas stable over 2 s. |
| During triage | 19, 21, 7, 16, 10 and 1 concurrent animations | 0 except two 120 ms WAAPI tweens on SVG `circle` and `path` (path highlight). Acceptable. |
| Drawer open | `translate` and `opacity` animation (0.2 s) | none. `transition-duration: 0s`. |

In reduce mode the hero CTAs and hint strip are present from the start, so "Run triage" is 6 Tab away instead of 7 (tab order differs from default).

---

## 6. Scores (1-10)

| Dimension | Score | Bar 9 |
|---|---|---|
| Clarity | 8 | below |
| Speed | 8 | below |
| Correctness | 8 | below |
| Trust | 9 | ok |
| Delight | 9 | ok |
| Accessibility | 7 | below |

Trust 9: claims are marked "(verified)" and traced ("21 of 21 claims traced to a graph query"), every tool call exposes its Cypher, plan and FalkorDB time, and the LOCKED versus WOULD_PULL caveat is always visible. Delight 9: scribbles, the timeline scrubber, the paste-a-lockfile flow, and genuinely respectful reduced-motion behaviour.

### Issues for each score below 9

**Accessibility (7)**

| ID | Sev | Element | Problem | Fix |
|---|---|---|---|---|
| A-1 | P1 | `dialog` footer: `button[aria-label="Export the whole report as Markdown"]` (visible "Report .md") and `button[aria-label="Export the whole report as JSON"]` (visible "Report .json"), nth-child(3) and (4) of `.border-t.p-4.gap-2` | axe serious `label-content-name-mismatch`, WCAG 2.5.3. Voice-control users saying "click Report .md" fail. Repeats at 1440 and 375. | Make the name start with the visible text: `aria-label="Report .md: whole triage report as Markdown"` and `aria-label="Report .json: whole triage report as JSON"`. Or drop `aria-label` and move the long text to `title` / `aria-describedby`. |
| A-2 | P2 | Hidden-until-focus `button` "Pause the autoplay" (tab stop 2, rect 8,8,140x38) | It is only mounted while autoplay runs. Pressing Enter or Space on it, or letting the autoplay finish (about 12 s) while it has focus, removes it from the DOM and focus falls to `<body>` (WCAG 2.4.3 and a focus-loss bug). | Keep it mounted and flip its label to "Resume autoplay", or hand focus to the visible Pause/Play button before unmounting. Better still, keep one Pause/Play control rather than two adjacent ones. |
| A-3 | P2 | Tool feed: per-card `button[aria-label="Copy Cypher"]`, `button[aria-label="Show plan"]`, `button` "Cypher" (3 x 17 cards) plus about 20 claim and evidence chips | 71 tab stops before the Ask input, about 85 before the first table row. The skip link "Skip to exposure table" is at the top of the DOM and 9 Shift+Tab behind the user after triage. There is no skip to Ask. | (a) Add "Skip tool calls to Ask / table" links at the start of `section[aria-label="Tool feed"]`. Or (b) after triage, put the exposure skip link right after the Run triage trigger or make it focus-visible near the feed. Or (c) group Copy and Plan inside the Cypher disclosure (expanded content only), or use a roving-tabindex toolbar per card. Or (d) put the Ask form before the tool list in DOM order. |
| A-4 | P2 | `[role=img][aria-label^="Path graph"]`, table row buttons | Selecting a row only updates `aria-current` and the graph `aria-label`. Nothing is announced. | Add a polite `role=status` line: "Selected acme/checkout-web: path express@5.1.0 then debug@4.4.2". |
| A-5 | P2/P3 | 41 role-less `<span aria-label>`: hop dots `span[aria-label="2 hops"][title="2 hops"]` ("••", "•"), `span[aria-label="declared directly by the repo"]`, `span[aria-label="FalkorDB execution time 2.4 ms"]`, `span[aria-label="Narration mode: replay"]`, claims badge `span[aria-label="All claims verified: 21 of 21 traced to graph queries"]` | axe `aria-prohibited-attr` (serious, incomplete). AT may ignore the label on a generic span. Hop counts read as "bullet". The badge announces only "21/21 traced". | Use visually-hidden text: `<span aria-hidden="true">••</span><span class="sr-only">2 hops</span>`, and `<span class="sr-only">All claims verified: </span>21/21 traced`. Or give the span `role="img"` where it is purely symbolic. |
| A-6 | P3 | `main#results`, `section[aria-label="Tool feed"]`, `section#exposures` (all `tabindex=-1`) | They receive programmatic focus (skip link, Run triage, Paste-lockfile) but show `outline: none`, so the position after Enter is invisible. | Add `[tabindex="-1"]:focus-visible { outline: 2px solid var(--fg-0); outline-offset: -2px }`, or flash a ring for 1 s. |
| A-7 | P3 | Placeholders (fg-3 #6b6964), `span.font-mono.text-2xs.text-fg-2` "••" on bg-3 | 3.61:1 and 4.29:1, both below 4.5:1 | Use fg-2 (#85837e, 4.63:1) for placeholders. Use fg-1 for the dots. |
| A-8 | P3 | `nav[aria-label=Panels]` at 375 (last in DOM) and the default Graph panel | Pressing a panel button does not move focus into the panel. Tab goes to the next tab, so the user has to Shift+Tab. On landing the only "Run triage" is in the hidden Feed panel. | After activating a panel, move focus to that panel's region heading. Or default to Feed until a triage exists, or add Run triage to the Graph empty state. |
| A-9 | P3 | Paste panel (`form` with input "GitHub repo URL") | Escape does not close it. Enter on Close does, and focus returns correctly. | Optional: close on Escape and return focus to "Paste your repo". |
| A-10 | P3 | claim chips `button[title="Verified against a graph query. Click to highlight its path."]`, `[E1]` chips | Activation gives no feedback to AT. Also: "Show plan" becomes "Hide plan" while `aria-pressed=true`. Repeated H3 names in tool cards. | Announce "Path highlighted: ...". Keep the label fixed and use `aria-pressed`, or change the label and drop `aria-pressed`. Add the claim or repo to card headings (e.g. "explain_path - mochajs/mocha"). |

**Clarity (8)**

| ID | Sev | Element | Problem | Fix |
|---|---|---|---|---|
| C-1 | P2 | Results layout at 1440x900 after triage | Hero plus hint strip (plus the "Narration replayed" banner) take about 380-410 px. The panes get about 485 px. The table shows one row, and the Ask input is clipped by the footer (`J05-row-path.png`). | Collapse the hero to one line after triage, auto-dismiss the hint strip after the first interaction, and make the panes `min-h` fill the rest of the viewport. |
| C-2 | P2 | `#exposures table` tier cell: `span.inline-flex.h-5` "WOULD_PULL" containing `span.rounded-xs.border.border-current` "dev" | The chip is 140 px wide in a 104 px column (x 1106-1246 vs column 1098-1202). The "dev" badge overlaps the first path chip ("chalk", "debug") at 1440 (`06-table-zoom.png`). | Give the tier column `min-width` of about 150 px. Or wrap the "dev" badge under the chip. Or let the path cell start after the tier cell with `overflow:hidden` or `gap`. |
| C-3 | P2 | Incident timeline label row in the axios scenario (`[aria-label="Incident timeline"]`, "02:19 alert" and "08:15 removed") | Labels collide and print on top of each other (`20-axios-landing-1440.png`). | Stagger labels vertically when the gap is under about 60 px, as the qix row already does. |
| C-4 | P3 | Hero left (21 repos, LOCKED 1, WOULD_PULL 20, scrubber) after a pasted-lockfile triage | It still shows the seeded qix numbers while the summary shows 1 of 1 repos (`11-paste-lockfile-result.png`). | Re-scope the hero to the pasted result, or label it "Seeded scenario: qix". |
| C-5 | P3 | `[role=radiogroup][aria-label=Scenario]` at 375 | "Describe an alert..." is clipped at the right edge with no scroll cue. | Show a fade or chevron, or wrap the radios. |

**Speed (8)**

| ID | Sev | Element | Problem | Fix |
|---|---|---|---|---|
| S-1 | P2 | Keyboard path (see A-3) | 194 key presses for the full journey. About 85 Tab to reach the table. | See A-3. |
| S-2 | P3 | Hero autoplay | CLS 0.139 in the first 15 s (94 shifts, max 0.086). Autoplay end inserts the CTA row and hint strip, pushing content down about 100 px. | Reserve the CTA and hint space from first paint. |
| S-3 | P3 | Narration | LLM narration chips arrive about 3 s after the table (triage itself is 0.8-2.4 s). The cards are usable earlier. | Announce "Narrative ready" via the existing status region. |

**Correctness (8)**

| ID | Sev | Element | Problem | Fix |
|---|---|---|---|---|
| X-1 | P2 | See C-2 and C-3 | Visual overlap of the dev badge and the axios timeline labels, which makes the facts hard to read. | See C-2 and C-3. |
| X-2 | P3 | Claims badge across runs | "13/13", "21/21", "26/26 traced" varies run to run (LLM-driven). All were fully verified. No incorrect claim seen. | Acceptable. Note it so tests do not hard-code counts. |
| X-3 | P3 | See C-4 | Stale hero numbers after a paste. | See C-4. |

---

## 7. Top 5 fixes

1. **Fix label-in-name on the drawer export buttons** (A-1). `Report .md` and `Report .json` must be a prefix of their `aria-label`. This clears the only serious axe violations (2 at 1440, 2 at 375) and makes the accessibility gate pass.
2. **Stop unmounting "Pause the autoplay" under focus** (A-2). Keep it mounted and relabel it, or move focus to the visible Pause/Play button. This removes a real keyboard focus-loss bug that hits the very first controls.
3. **Cut the keyboard cost of the tool feed** (A-3, S-1). Add "Skip to Ask" and "Skip to exposure table" links inside the Tool feed, or collapse Copy, Plan and Cypher into one tab stop per card. Today it is 71 stops to Ask and about 85 to the first table row.
4. **Fix the two visible overlaps** (C-2 tier chip "dev" badge over the path column at 1440, C-3 axios timeline labels). Also give the results panes more height at 1440x900 (C-1).
5. **Replace `aria-label` on role-less spans with sr-only text** (A-5), and show a focus ring on programmatic focus targets `main#results`, `section[aria-label="Tool feed"]` and `section#exposures` (A-6). That clears 41 axe "incomplete" nodes and makes the position after Enter visible.

## 8. Screenshot index (under `qa/reports/phase3-a11y/`)

- Landing and focus: `00-landing-1440.png`, `01-after-tabs.png`, `focus-01-skip.png`, `focus-02-pause-autoplay-sr.png`, `focus-03-radio-qix.png`, `focus-04-paste.png`, `focus-05-pause.png`, `focus-06-slider.png`, `focus-07-run-feed.png`, `focus-08-run-table.png`, `03-after-skiplink.png`, `J01-skip-link-focused.png`
- Journey (1440): `J02-after-triage-1440.png`, `J03-ask-focused.png`, `J04-ask-answered.png`, `J05-row-path.png`, `J06-drawer-open.png`, `J07-drawer-notice-tab.png`, `J08-paste-panel.png`, `J09-paste-result.png`, `02-after-triage-1440.png`, `05-row-path-selected.png`, `06-table-zoom.png`, `07-fix-drawer-open-1440.png`, `08-ask-focused.png`, `09-ask-answer.png`, `10-paste-panel-open-1440.png`, `11-paste-lockfile-result.png`, `18-claim-chip-enter-1440.png`, `19-evidence-chip-enter-1440.png`
- Skip links: `12-skip-link-2-1440.png`, `12-skip-link-2-375.png`, `13-after-skip2-1440.png`, `13-after-skip2-375.png`
- Axios and describe: `20-axios-landing-1440.png`, `20-axios-landing-375.png`, `21-axios-after-triage-1440.png`, `21-axios-after-triage-375.png`, `04-describe-alert-radio.png`, `M05-1440-describe.png`, `M05-375-describe.png`, `M06-1440-describe-result.png`, `M06-375-describe-result.png`
- 375: `m-01-landing-375.png`, `m-02-after-triage-375.png`, `m-03-feed-tab-landing-375.png`, `M01-375-after-triage-feed.png`, `M02-375-table-panel.png`, `M03-375-drawer.png`, `M04-375-paste-panel.png`
- axe states: `axe-1440-after-triage.png`, `axe-1440-drawer.png`, `axe-1440-paste-panel.png`, `axe-375-landing-feed.png`, `axe-375-after-triage.png`, `axe-375-after-triage-graph.png`, `axe-375-after-triage-table.png`, `axe-375-drawer.png`, `axe-375-paste-panel.png`
- Reduced motion: `14-reduced-motion-landing-1440.png`, `15-reduced-motion-before-triage.png`, `16-reduced-motion-after-triage-1440.png`, `17-reduced-motion-drawer-1440.png`

Method notes: the journey in section 1 was run in a fresh headless Chromium with real key presses (`J*` screenshots). Exploration and axe passes reused one headless instance over CDP, and I used `element.click()` or `.focus()` only to position axe states (never in the journey). The "Run triage" tab count depends on autoplay state (7 Tab while autoplay runs, 6 after it ends or with reduced motion). Narration (LLM live or replay) varies per run.
