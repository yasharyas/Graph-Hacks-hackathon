# Patient Zero - Phase 3 phone QA (judge on a phone)

- Tester persona: judge opening the link on a phone, never seen the app.
- Target: `http://localhost:5173/` (Vite dev server, proxying real `/api` on :8080, real FalkorDB data). I did not start/stop servers or edit any repo file.
- Tools: headless Chromium via playwright-skill, mobile emulation (iPhone UA, `isMobile`, `hasTouch`, DPR 2), 375x812 main pass, 360x740 quick pass, 812x375 landscape pass.
- First load throttled with CDP to "Fast 3G" (1.6 Mbps down, 750 Kbps up, 562 ms RTT) plus 4x CPU slowdown; everything after first load is unthrottled.
- Screenshots: `C:\Users\Yash Arya\OneDrive\Documents\genric\patient-zero\qa\reports\phase3-phone\` (referenced below as `phase3-phone/<file>`).
- Caveats: headless Chromium has no on-screen keyboard. "Keyboard covers input" was checked by shrinking the viewport (Android-style resize) and re-focusing the field; iOS (visual-viewport) behaviour will differ. I did not click "Mark remediated", "Copy fix" or the Report downloads (would mutate data or download files). Test data I created through the UI: one analysis of `axios/axios`, one failed analysis of a non-existent repo (the app says it keeps nothing beyond one hour).

---

## 1. Scores (bar is 9)

| Area | Score | Meets 9? | One-line why |
|---|---|---|---|
| Clarity | **5** | no | No on-screen explanation of what the app is; CTA hidden/late; "Graph" tab has no graph on a phone; jargon-first. |
| Speed | **5** | no | As served (dev server) a Fast 3G phone sees a blank screen for 38 s; prod build 5.6 s FCP; CLS 0.3-0.5. Triage itself is superb (2.4 s). |
| Correctness | **7** | no | Hero numbers stay at the demo's 21/1/20 after analysing your own repo; duplicate rows; "1 repos". |
| Trust | **7** | no | "21 of 21 claims traced" + visible Cypher is great; contradictory counts and placeholder owner undercut it. |
| Delight | **7** | no | Scribble "74 min", auto-playing incident replay, instant triage; but 13,000 px feed and an empty Graph tab. |
| Accessibility | **7** | no | axe-core is clean (4 states), reduced motion honoured; but many targets < 44 px, 11 px text, Back button leaves the app. |

None of the six reaches the bar. Console: **0 errors, 0 warnings, 0 uncaught exceptions** across ~20 sessions on :5173 (one benign aborted duplicate `GET /api/timeline?scenario=qix-2025-09-08` per page load, ERR_ABORTED). Horizontal page scroll: **none** at 375, 360 or 812 in any state (document scrollWidth == viewport everywhere). Motion: not nauseating (see section 4).

---

## 2. Timed friction log

### 2a. First load (Fast 3G + 4x CPU, dev server :5173)

| t | What the judge sees | Evidence |
|---|---|---|
| 0.0 s | Tap link | |
| 0.8 s | HTML arrived; screen is flat `#111` | `phase3-phone/load-throttled-blank-0500ms.png` (identical frame at 0.5, 1, 1.5, 2, 3, 4.5, 7, 10 s) |
| 0.8 - 38 s | **Blank dark screen, no text, no spinner, no skeleton.** Body innerText length is 0 the whole time. | same file |
| 37.4 s | network idle: 60 requests, **6.6 MB** (unbundled Vite modules: react-dom_client 3.1 MB, motion_react 2.0 MB, App.tsx 74 KB, plus ~50 more) | request list in test log |
| 38.1 s | FCP = LCP (first content) | `phase3-phone/load-final.png` |

Bandwidth alone explains ~33 s of that. For comparison, the production build served by the API server on :8080 under the same throttling (informational, not the shipped link): FCP 5.6 s, LCP 7.2 s, DCL 5.0 s, idle 10.3 s, CLS 0.44; JS (446 KB) and CSS are sent **uncompressed** (no `content-encoding`). In 1 of 2 throttled prod runs every asset request failed with `ERR_CONNECTION_RESET` (blank page, 13 console messages); the rerun was fine, cause not isolated. Screens: `phase3-phone/prod-load-final.png`.

### 2b. Unthrottled journey (375x812)

| t (from navigation) | Step | Observation |
|---|---|---|
| 0.04 s | HTML paints | black |
| 0.37 s | Skeleton paints | Header + grey blocks **plus a "Run triage / Try axios 2026 / Paste your repo" button set and "No paths yet"** (`phase3-phone/frame-01-t372.png`). |
| 1.18 s | Real hero swaps in | **Layout shift 0.28** (CLS 0.308 total). The three CTAs disappear; hero shows "0 repos one install from malware", clock 13:00, bottom nav on "Graph" (`phase3-phone/frame-02-t1178.png`). Auto-replay is already running. |
| 3.1 s | Replay counts to "21 repos" | Another 0.13 CLS as numbers/chips re-wrap (`phase3-phone/frame-04-t3078.png`). Final CLS over 13 s: **0.49** ("poor" is > 0.25). |
| 10 s | **Judge's "what is this?" test** | Sees: title, 3 scenario chips (third clipped: "Describe ar"), Pause, big "21 repos one install from malware", LOCKED / WOULD_PULL / MAINTAINER / OSV counters, a scrubber with four bare times, "ADVISORY SCANNER vs NAME GREP vs PATIENT ZERO", "74 min before the OSV record existed". **No sentence says what the product does** and no button says what to do next (`phase3-phone/first10s-1-t8.6.png`). The perfect sentence exists only in `<meta name=description>`: "Patient Zero turns an npm supply-chain alert into an answer in seconds: which repos are exposed, through which dependency path, and which team owns the fix." |
| 11-13 s | Replay ends at 14:30 | Pause becomes "Play the 90 minutes"; **now** the "Run triage / Try axios 2026 / Paste your repo" buttons appear at y ~ 612 of 812 (`phase3-phone/first10s-4-t21.8.png`). At 360x740 the Run triage button is half hidden by the bottom nav (`phase3-phone/s360-00-settled.png`). |
| ~15 s | Tap Feed tab (no triage yet) | "No triage yet ... Run triage" empty state. Graph tab pre-triage: ~600 px of empty black (`phase3-phone/x2-graph-full.png`). Table pre-triage: empty state. |
| +0 s | Tap **Run triage** | Server work 234 ms for 17 tools; UI settled in ~2.4 s. Page only scrolls ~194 px, so the **verdict is not on screen**: header counters + "Run again / Try axios 2026 / Paste your repo" (`phase3-phone/tri-02.png`). The narrative starts at document y ~ 1075 (`phase3-phone/feed-00-y900.png`). A hint card "1 Click a row... 2 Click Cypher... 3 Paste your repo" shows (desktop wording "Click"). |
| +2 min | Scroll the Feed | 13,376 px tall (~16.5 screens). 17 tool cards, each with args, summary, table, Cypher toggle. Good content, but long. Ask box ("Ask about this triage") is the very last thing, ~12,500 px down (`phase3-phone/feed-09-y12564.png`). |
| | Switch to Table | Tab tap scrolls to the panel (y 1063). Summary card (21 of 21, tier bar, +74 min, top maintainers), Prod only / Tier / Filter, then 21 repo rows with a 44 px **Fix** button each. Table page height 7,495 px (`phase3-phone/tbl-02-y1000.png`, `tbl-03-y1600.png`). |
| | Open a path (tap repo name `github/docs`) | Row gets a faint amber left border and lighter background. **Nothing else visible happens**; the path was written to the Graph tab (`phase3-phone/path-03-after-row-tap-1200.png`, `path-04-graph-tab.png`). |
| | Graph tab | **No graph**: only a text chip "github/docs ^5.0.1 -> chalk@5.6.1" and ~500 px of void. 0 `<canvas>` at 375 and 600 px wide, 1 at >= 768 px (`phase3-phone/canvas-375.png` vs `canvas-1280.png`; source gates on `matchMedia('(min-width: 768px)')`). |
| | Fix drawer (tap Fix) | Full-screen dialog in < 350 ms, focus on Close, Escape closes, body scroll locked, great content: path chips, `package.json` overrides, steps, PR body, sticky footer (Copy fix, Report .md, Report .json, share link, Mark remediated) (`phase3-phone/fix-02-open-350ms.png`). Browser **Back leaves the app** (goes to `about:blank`) instead of closing the drawer. |
| | Paste a repo URL | Header icon opens inline panel above the hero, input autofocused, 16 px font (no iOS zoom). `hello world`, `owner/name`, `github.com/expressjs/express` (no scheme), gitlab URL: Analyze just stays disabled, **no message**. `https://github.com/this-owner-does-not-exist-zzz/nope-xyz` gives a clear red "is not a public repo", request id and sample-repo chips (`phase3-phone/paste-missing-05.png`). `https://github.com/axios/axios`: analysed in **1.1 s**, narrative + table for the repo (`phase3-phone/paste-axios-04.png`) - but see K1 below. |
| | Ask box | Typed "Which team should I notify first?"; streamed answer in **0.7 s**: "Notify the Payments (verified) team first. 1 of 1 claim traced"; counter "Follow-up 2 of 4" (`phase3-phone/ask-03-answer-1.png`). |
| | Scrubber | Touch-drag works (44 px hit area), tap-on-track works, arrow keys work; scrubbing to 15:44 reads "**1 repos** one install from malware" (`phase3-phone/scrub-01-end.png`). |
| | Scenario chips | "axios · Mar 2026" loads in ~2 s ("9 repos", "128 min" scribble, clock starts 23:59); "Describe an alert..." opens a 500-char textarea + Run triage (`phase3-phone/scen-00-describe.png`, `scen-01-axios.png`). |
| | Rotate to 812x375 | No horizontal scroll. Layout switches to the >= 768 px variant: wide tab bar, graph canvas present, timeline marks gain labels ("first publish", "alert", "OSV record", "removed") that **portrait lacks** (`phase3-phone/land-00-settled.png`). 56 px bottom nav = 15% of the 375 px height. Fix drawer becomes a right-hand panel whose scrolling body is only **135 px** tall; the JSON/steps are out of sight under header + 110 px footer (`phase3-phone/land-04-fix-drawer.png`). With a simulated 175 px landscape keyboard the paste input (y 131-175) sits entirely under the fixed nav (y 119-175) (`phase3-phone/land-05-paste-keyboard.png`). |
| | 360x740 pass | No overflow, same flows work. Header wraps to three rows after triage (title / chips / upload icon) (`phase3-phone/s360-04-paste-keyboard.png`); drawer fine (`phase3-phone/s360-03-fix-drawer.png`). Simulated keyboard (420 px tall): input y 215-259, Analyze 267-311, nav at 364: OK. |

---

## 3. Checklist results

| Check | Result |
|---|---|
| No horizontal scroll | **Pass** at 375, 360, 812 in all states (only the scenario chip row and Concentration/Graph-stats tab strip scroll inside themselves). |
| Tap targets >= 44 px | **Fail.** Scenario chips 135x40 / 144x40 / 129x40; hero Pause / Play / Run triage / Try axios / Paste your repo **36 px** tall; narrative evidence chips **22 px** tall and `[E1]`.. `[E5]` **34x18**; drawer tabs Fix 41x40 / Notice 64x40; short repo links (`npm/cli`) 42 wide. Passing: bottom nav 125x56, header paste icon 44x44, Fix 44, Cypher / copy / plan icons 44-65x44, scrubber 44, Ask input and button 44, Analyze 44. |
| Text >= 12 px and readable | **Partial fail.** Body copy is 14 px (good), data/Cypher 12-13 px. **11 px** is used for stat labels (LOCKED, WOULD_PULL, OSV advisories), scrubber ticks, section captions (ADVISORY SCANNER, NAME GREP, PATIENT ZERO, NARRATIVE), table headings, tool arg chips, drawer captions: 135 chars at the settled home screen, 64 distinct runs in the Feed. axe-core colour contrast: 0 violations. |
| Nothing hidden behind sticky bars | **Mostly pass.** Only sticky element is the 56 px bottom nav; footer note, Ask input and last cards are padded above it. Exceptions: primary CTA half-covered at the fold on 360x740 (`s360-00-settled.png`); focused input fully covered by nav in landscape + resized viewport (`land-05-paste-keyboard.png`). |
| Keyboard doesn't cover inputs | **Pass in portrait (simulated), fail in landscape resize mode.** Inputs are 16 px so iOS will not zoom. |
| Motion not nauseating | **Pass.** No infinite animations (`getAnimations()` = 2 finite scribble wipes, 0.6-0.9 s). The 90-minute replay runs in ~11 s as number counters and a sliding scrubber thumb; no parallax, no scroll-jacking. With `prefers-reduced-motion: reduce` there are 0 animations and the replay does not autoplay (jumps straight to 14:30). |
| Console errors | **0** errors/warnings/exceptions on :5173 (plus 1 aborted duplicate timeline fetch per load). |
| axe-core 4.14 (wcag2a/aa, 21, 22aa, best-practice) | 0 violations on home, Feed, Table; 1 on the drawer (`label-content-name-mismatch` x2: "Report .md" and "Report .json" buttons' accessible names omit visible text). |

---

## 4. Issues by score (each score below 9)

Severity: P0 blocks the judge, P1 hurts the first impression or shows wrong info, P2 real friction, P3 polish.

### Clarity (5)

| # | Sev | Where | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|---|
| C1 | **P1** | Home, header / first screen | Nothing says what the product is. The one good sentence lives only in `<meta name=description>`. First view is a data wall (21, LOCKED, WOULD_PULL, OSV, "Name grep"). | `first10s-1-t8.6.png` | Render that sentence as a 2-line subhead under "Patient Zero" and a plain-language caption on the big number ("21 repos exposed to the qix npm attack"). |
| C2 | **P1** | Home, hero | No primary action in the first 10 s. During the replay the hero shows only Pause; "Run triage" first appears when the replay ends (~11-13 s) at y ~ 612 (half hidden under the nav at 360x740). The skeleton shows the CTAs for 0.8 s then removes them. Default tab is "Graph", which cannot run anything. | `first10s-4-t21.8.png`, `s360-00-settled.png`, `frame-01-t372.png` | Put one persistent "Run triage on this incident" button directly under the title (or sticky above the nav) from first paint; start on Feed; do not render CTAs in the skeleton. |
| C3 | **P1** | Bottom nav "Graph" tab (< 768 px) | The tab labelled Graph shows **no graph**: only a text path chip and ~500-600 px of empty space and the line "Select a repo in the table to change the path" (which points at a table that is empty until triage). | `x2-graph-full.png`, `path-04-graph-tab.png`, `canvas-375.png` | Render a compact SVG path graph (3-6 nodes fit in 343 px) or rename the tab "Path" and drop the void; fix copy to "Tap a repo in Table". |
| C4 | P2 | Table rows | Tapping a repo gives no visible outcome; the path appears on another tab. Hint card says "Click". | `path-03-after-row-tap-1200.png` | Expand the path inline under the row, or switch tab and toast "Path for github/docs"; reword to "Tap". |
| C5 | P2 | Feed after Run triage | Verdict is ~1,070 px below the viewport; screen shows counters and three buttons only. | `tri-02.png`, `feed-00-y900.png` | Auto-scroll to the Narrative card (or pin a 2-line verdict card at top of Feed). |
| C6 | P2 | Home counters / compare block | Jargon-first labels: LOCKED, WOULD_PULL, MAINTAINER, OSV, "Name grep", "Patient Zero" (also the product name used as a section label). | `x1-top` equivalent `first10s-1-t8.6.png` | Plain labels with long text on tap: "Pinned (installed)", "Would have installed", "Maintainer at risk"; one-line legend. |
| C3b | P2 | Scrubber, portrait | Portrait shows bare times (13:12 13:16 14:26 15:15); the meaning (first publish, alert, OSV record, removed) only appears in landscape. | `first10s-1-t8.6.png` vs `land-00-settled.png` | Show short labels in portrait too (stagger rows, 11-12 px "publish", "alert", "OSV", "removed"). |
| C7 | P2 | Paste panel | Invalid input leaves Analyze silently disabled; `github.com/owner/repo` and `owner/name` (what people copy) are rejected without a word. | `paste-02-invalid-disabled.png` | Accept scheme-less and `owner/name`; show an inline hint ("Use https://github.com/owner/name"). |
| C8 | P3 | Header upload icon | Icon-only button (arrow out of tray) whose label "Paste your repo" is only in `aria-label`; reads as share/upload. | `first10s-1-t8.6.png` | Add visible text or a link/paste icon. |
| C9 | P3 | Scenario chip row | Third chip clipped ("Describe ar") with no scroll cue (row content 429 px in a 343 px box). | `first10s-1-t8.6.png` | Edge fade mask, or scroll-snap with a visible partial chip + chevron. |
| C10 | P3 | Replay | A 90-minute story auto-plays in ~11 s before the user knows what it is, then stops. | `frame-04-t3078.png` | Start paused with "Play the 90-minute incident" or caption the three beats as it plays. |
| C11 | P3 | Table "Filter repos" | Empty black box with no placeholder. | `tbl-02-y1000.png` | Placeholder "owner/name or team". |

### Speed (5)

| # | Sev | Where | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|---|
| S1 | **P1** (P0 if judges are given this origin on a real phone) | Whole app on :5173 | The link is the Vite dev server: 60 requests, 6.6 MB, **38 s blank screen** on Fast 3G (4x CPU), no loading UI. | `load-throttled-blank-0500ms.png`, `load-final.png` | Hand judges the production build (`vite build`, already served by :8080) behind a CDN or the API server; ship an inline minimal shell (title + skeleton) in `index.html` so first paint needs one request. |
| S2 | P2 | Home, first 3 s | CLS **0.49** unthrottled (0.31 at skeleton -> hero, +0.13 when counters grow, +0.05 later); 0.44 on prod under Fast 3G. Worst offenders: `SECTION.@container p-4` hero, "ml-auto flex" chip row, hero number wrapping. | `frame-01-t372.png` -> `frame-02-t1178.png` -> `frame-04-t3078.png` | Skeleton must match final geometry; set `min-height` on hero and compare blocks; reserve the chip row; tabular-nums / fixed-width counters; do not mount CTAs in the skeleton. |
| S3 | P2 | Prod server :8080 | No gzip/brotli (446 KB JS, 40 KB CSS raw); one throttled run saw `ERR_CONNECTION_RESET` on every asset. | `prod-load-final.png` | Enable compression + `Cache-Control: immutable` on hashed assets; check keep-alive/timeouts. Expected FCP under Fast 3G < 3 s. |
| S4 | P3 | `/api/timeline` | Duplicate request aborted on every load (ERR_ABORTED). | log | Dedupe / cache the first fetch (likely StrictMode double effect in dev). |
| S5 | P3 | Pre-triage Feed/Table | Tap "Run triage" works instantly after that (2.4 s end to end) - keep it; consider a progress indicator while the 17 tool calls stream (currently the page just grows). | `tri-01.png` | Show "Running 3/17..." in the header chip. |

### Correctness (7)

| # | Sev | Where | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|---|
| K1 | **P1** | Home hero + "Patient Zero" compare, after pasting a repo | After analysing `axios/axios`, hero still says "**21** repos one install from malware, LOCKED 1, WOULD_PULL 20" and the Patient Zero row "1 LOCKED 20 WOULD_PULL", while the Name-grep row says "in **1** repos" and the Table says "**1 of 1 repos, 0 LOCKED, 1 WOULD_PULL**" with a `dev`-only WOULD_PULL. The same screen contradicts itself. | `repo-00-top.png`, `repo-02-table.png` | Recompute hero + compare from the analysed set, or label the hero "Demo org (qix): 21" and show a separate "Your repo" result card. |
| K2 | P2 | Feed, `explain_path` tool tables | Three identical rows (e.g. `mochajs/mocha | debug@4.4.2 | ADMITS` x3); the differentiating range column is not shown. | `feed-05-y4500.png` | Dedupe or add the "range" column. |
| K3 | P3 | Hero / Name grep | "1 repos one install from malware", "in 1 repos". | `scrub-01-end.png` | Pluralise. |
| K4 | P3 | Feed `concentration_risk` table | 16-digit floats (0.0147567075018742) wrap mid-number. | `feed-09-y12564.png` | Round (4 sig figs) or show as % like the Table summary. |
| K5 | P3 | Axios scenario | "128 min" overflows its scribble ring on the right ("min" crosses the stroke). | `scen-01-axios.png` | Scale ring with text or allow wrap. |
| K6 | P3 | Scrubber thumb label | Bubble ("15:44") hugs / touches the right viewport edge at the end of the track. | `scrub-01-end.png` | Clamp bubble within 8 px of the edge. |

### Trust (7)

| # | Sev | Where | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|---|
| T1 | **P1** | see K1 | Contradictory numbers on one screen after "Paste your repo", the most personal action in the demo. | `repo-00-top.png` | See K1. |
| T2 | P2 | Narrative for a pasted repo | Placeholder owner "Your team in #your-team" shown with a green "verified" check. | `paste-axios-04.png` | Say "No owner mapped - add CODEOWNERS" and do not stamp it verified. |
| T3 | P3 | Table rows | Two nearly identical sentences stacked in every WOULD_PULL row ("A fresh install in the window would have fetched it" + "A fresh install during the window would have fetched the malicious version..."). Reads as a bug. | `tbl-03-y1600.png` | Keep the short line, move the long one to a "What does WOULD_PULL mean?" disclosure (the page footer already has it). |
| T4 | P3 | Disabled Analyze with no reason | Looks like the app is ignoring input. | `paste-02-invalid-disabled.png` | See C7. |
| + | Positive | Feed / narrative | "21 of 21 claims traced to a graph query", per-claim green checks, Cypher + copy + plan icons on every card, WOULD_PULL footnote. This is the strongest trust signal in the app. | `feed-00-y900.png` | Keep; surface the "traced" count above the fold. |

### Delight (7)

| # | Sev | Where | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|---|
| D1 | P2 | Feed | 13,376 px of scroll on a phone, Ask box last. The best moments (verdict, Ask) are buried. | `feed-09-y12564.png` | Verdict card first; collapse tool cards to a one-line summary with "Show 17 tool calls"; make Ask a sticky bottom input or FAB. |
| D2 | P2 | Graph tab | The signature visual is missing on phone (see C3). | `x2-graph-full.png` | See C3. |
| D3 | P3 | Row tap, Fix open, triage done | No micro-feedback beyond tint (no haptic-style press state, no toast "Triage complete: 17 tools in 234 ms"). | `tri-02.png` | Toast + subtle press state. |
| + | Positive | Home | Hand-drawn "74 min" scribble, replay counters, instant triage (2.4 s) and Ask (0.7 s), reduced-motion respected. | `first10s-4-t21.8.png` | Keep. |

### Accessibility (7)

| # | Sev | Where | Issue | Screenshot | Suggested fix |
|---|---|---|---|---|---|
| A1 | P2 | Hero buttons, scenario chips, evidence chips, drawer tabs | Targets under 44 px: chips 40 px, Pause / Play / Run triage / Try axios / Paste your repo 36 px, evidence chips 22 px, `[E1]` 34x18, drawer Fix / Notice tabs 40 px. | `first10s-4-t21.8.png`, `feed-00-y900.png`, `fix-02-open-350ms.png` | `min-height: 44px` (or 11) on `.btn`, chips and tabs; pad inline chips with transparent hit area. |
| A2 | P2 | Labels everywhere | 11 px text (stat labels, ticks, table headers, Cypher, arg chips). | `first10s-1-t8.6.png`, `feed-01-y1300.png` | Floor at 12 px (13 for data). |
| A3 | P2 | Fix drawer and paste panel | Browser/OS **Back leaves the app** (history length unchanged when drawer opens; `goBack()` -> `about:blank`). On phones this is the default dismiss gesture. | log | `history.pushState` when opening, close on `popstate`. |
| A4 | P3 | Fix drawer footer | axe `label-content-name-mismatch` x2 (Report .md / Report .json). | (axe log) | Make `aria-label` start with the visible text ("Report .md - download"). |
| A5 | P3 | Landscape Fix drawer | Scroll body 135 px of 375; core content (overrides JSON, steps) hidden by header + 110 px sticky footer. | `land-04-fix-drawer.png` | In landscape collapse the footer into a menu / make the header scroll with content, use `100dvh`. |
| A6 | P3 | Landscape / resized viewport | 56 px bottom nav overlays a focused input; nav takes 15% of height. | `land-05-paste-keyboard.png` | Hide nav while an input has focus (`:has(input:focus)`) or use `interactive-widget=resizes-visual`; keep nav shorter in landscape. |
| A7 | P3 | Header at 360 px after triage | "live" and "21/21 traced" chips push the upload button to a third header row. | `s360-04-paste-keyboard.png` | Hide chips at < 400 px or collapse into one pill. |
| + | Positive | | Skip links, labelled radiogroup, `dialog` with focus on Close and Escape, 16 px inputs, reduced-motion support, 0 axe violations on home/Feed/Table, contrast passes. | | Keep. |

---

## 5. Top 5 fixes (highest impact first)

1. **Serve the production build, compressed, with a real first paint.** Today's link is the Vite dev server (6.6 MB, 38 s blank on Fast 3G). Hand out the `web/dist` build with gzip/brotli and immutable caching, inline a title + skeleton shell, and make the skeleton geometry match the hero so CLS drops from 0.49 to < 0.1. (S1, S2, S3)
2. **Make the first screen explain itself and offer one obvious action.** Show the meta-description sentence as a subhead, caption the big number in plain language, label the timeline marks in portrait, and pin a single "Run triage" button from first paint (not after the replay ends, not half hidden under the nav). (C1, C2, C3b, C6, C10)
3. **Fix the phone Graph tab and path feedback.** Either render a compact path graph below 768 px or rename the tab and remove the empty void; make tapping a repo show its path immediately (inline or via tab switch + toast); scroll to the verdict after triage. (C3, C4, C5, D2)
4. **Make the numbers consistent after "Paste your repo".** Hero and compare block must reflect the analysed repo (1 of 1, 0 LOCKED, 1 WOULD_PULL) or be explicitly labelled as the demo org; fix "1 repos", duplicate `explain_path` rows and the placeholder "Your team / #your-team" verified chip. (K1, T1, T2, K2, K3)
5. **Do a touch/type/back-button pass.** 44 px minimum on chips, hero buttons, evidence chips and drawer tabs; 12 px type floor; push history state for the Fix drawer and paste panel so Back closes them; give the landscape drawer a usable scroll area; accept scheme-less repo URLs with an inline hint. (A1-A6, C7)

---

## 6. Screenshot index

All under `C:\Users\Yash Arya\OneDrive\Documents\genric\patient-zero\qa\reports\phase3-phone\`.

- First load: `load-throttled-blank-0500ms.png` (blank through 10 s), `load-final.png`, `load-final-full.png`, `prod-load-*.png` (prod build), `frame-00..06-*.png` (unthrottled skeleton to hero, with CLS), `first10s-*.png`, `x2-graph-vp/full.png`, `x2-feed-*.png`, `x2-table-*.png`.
- Triage + Feed: `tri-00-before.png`, `tri-01.png`, `tri-02.png`, `tri-final-full.png`, `feed-00..09-*.png`, `cypher-00-open.png`.
- Table / path / Graph: `tbl-00..04-*.png`, `path-02..04-*.png`, `canvas-375.png`, `canvas-1280.png`.
- Fix drawer: `fix-00-before.png`, `fix-01-open-150ms.png`, `fix-02-open-350ms.png`, `fix-07-after-escape.png`.
- Paste / repo: `paste-00-open.png`, `paste-01-keyboard-sim.png`, `paste-02-invalid-disabled.png`, `paste-missing-01..05.png`, `paste-axios-01..04.png`, `repo-00..03-*.png`.
- Ask: `ask-00-before.png`, `ask-01-keyboard-sim.png`, `ask-02-typed.png`, `ask-03-answer-1.png`, `ask-03-answer-2.png`.
- Scrubber / scenarios: `scrub-00-dragged.png`, `scrub-01-end.png`, `scen-00-describe.png`, `scen-01-axios.png`.
- 360x740: `s360-00..04-*.png`.
- Landscape 812x375: `land-00..05-*.png`.
