# Patient Zero - Phase 3 QA: on-call AppSec engineer journey

Tester persona: on-call AppSec engineer, never seen the tool. Incident: npm maintainer `qix` hijacked.
App: http://localhost:5173/ (live API + FalkorDB). Browser: headless Chromium 1440x900 via playwright-skill. About 30 sessions. No repo files edited, no servers started or stopped.
Screenshots: `qa/reports/phase3-secops/NN-*.png` (paths below are relative to `qa/reports/`).

## 1. Verdict in one paragraph

The core graph answer is fast and the underlying numbers hold together: 21 exposed = 1 LOCKED + 20 WOULD_PULL = 21 table rows = `/api/exposure` = exported JSON. Prod-only filter = 14 rows = 21 minus 7 dev-only. Owners, fix pins (`debug@4.4.1`, `chalk@5.6.0`) and the "never says the repo was compromised" wording all check out. The product breaks down at the edges an on-call engineer will hit next. The **Ask box gives wrong, incomplete answers while stamping them "(verified)"**. The **header counters disagree with the table on odd-minute scrubs**. **16 of 21 repos have an empty Fix drawer** whose advertised workaround ("ask a follow-up") does not work. The **Slack message carries no path and no pin versions**. The narrative is non-deterministic and was truncated once. Not shippable for an incident until the P0/P1s below are fixed.

## 2. Timed friction log (time to first actionable answer)

Timings from scripted runs. Typing at 35 ms/char; a human would add about 3-5 s. Other QA agents were using the same server during my runs (their scripts shared the temp dir), so latency variance may be partly contention.

| t | Step | What I saw | Friction |
|---|------|-----------|----------|
| 0.0 s | Open `/` | Interactive in 1.3 s warm, 4.5 s on a cold profile. Demo clock already auto-playing (13:05 -> 13:44) with counters climbing 0 -> 21 before I did anything (Pause exists). Screenshot `01-landing.png` | 3 identical "Run triage" buttons visible at once; "Describe an alert..." is the 3rd of 3 tabs |
| +0.4 s | Click "Describe an alert..." | Textarea, 0/500 counter, placeholder `qix compromised, 13:16 UTC` taught me the format (`02-describe-tab.png`) | Good. Ctrl+Enter does not submit |
| +1.3 s (about 4 s human) | Type `npm account qix compromised 13:16 UTC`, click Run triage | `03-alert-typed.png` | |
| +0.64 s after submit | Alert banner + headline **"21 repos one install from malware"**, LOCKED 1 / WOULD_PULL 20 | Server total 200-350 ms, 28 queries (`04-after-run.png`) | **First answer** |
| +1.86 s after submit | Narrative Verdict / Notify / Do complete (best case, "LLM live") | Later runs: whole run 6-7 s (template) and 17.7-17.8 s (LLM live) including page load (`33-narrative-run1.png`) | Latency varies 3-10x between runs |
| **about 7-9 s from page open (scripted); realistically 12-15 s** | **First actionable answer: who to notify, what to do** | | |
| +0.3 s | "Prod only" click | Rows 21 -> 14, correct, but the list is below the fold: **no visible feedback** (`07-prod-only.png`, `07b`) | Table needs a 330 px scroll in a nested pane; only 35 px of row 1 is visible, half under the footer (`04`, `22`) |
| +0.3 s | Click a row | Graph redraws to `chalk@5.6.1 -> docs -> Docs` (`08-row-path-github-docs.png`) | Good |
| < 0.7 s | Fix drawer (checkout-web) | Fix + Notice tabs, overrides JSON, steps, PR body (`09-fix-drawer-checkout-web.png`) | Good for the 5 drafted repos |
| instant | Notice -> "Copy as Slack message" | Clipboard verified; status "Slack message copied" (`10`, `11`) | Message is thin, see C-7 |
| instant | Export .md (6.2 KB) / .json (24 KB) | Download works (`13-after-export.png`) | Content gaps, see C-6 |
| about 0.5 s | Mark remediated | Strike-through + check + 10-s Undo (`16`, `17`) | After Run again the Verdict still says "Rotate secrets and rebuild acme/checkout-web" (`18`) |
| 2.6 s | Ask "which exposures are prod-only and who owns them?" | **Wrong answer** (`20-ask-answer.png`, `21-ask-q1-autoscroll.png`) | Ask box found only after about 11,650 px of scrolling (`12`, `19`) |
| about 0.2-1.5 s | Scrub to 13:14 / 15:30 | 13:14 -> 21 exposed; 15:30 -> 1 exposed (`14`, `15`, `28`) | Header vs table mismatch at 13:13 and 15:15 (`36-*`) |

**Console errors:** 0 `console.error` / `pageerror` from app code across about 30 sessions. One expected `400` on `/api/triage` for the deliberately invalid alert (browser logs "Failed to load resource"). Request-level noise: every page load aborts one `/api/timeline` request (`ERR_ABORTED`, harmless double fetch), and fast scrubbing aborts superseded `/api/exposure` requests.

## 3. Numbers cross-check (all done against the live API as well as the UI)

| Check | Result |
|---|---|
| Headline 21 = LOCKED 1 + WOULD_PULL 20 = PATIENT ZERO panel = slider text = 21 table rows = `/api/exposure` counts = JSON exposures[21] | OK |
| Prod only = 14; dev-only = 7 (`http-server`, `jquery`, `TypeScript`, `pdf.js`, `newman`, `swagger-ui`, `bootstrap`) | OK, 14 + 7 = 21 |
| Teams of the 14 prod rows | Payments 1, Platform 4, Docs 1, API Clients 1, QA 4, CLI 3 = 14. Narrative "Notify" lists exactly these 6 (Web is dev-only) |
| Whole-set team split | Payments 1, Platform 4, Docs 3, CLI 5, QA 4, API Clients 2, Web 2 = 21; the 7 exported Slack notices cover all 21 repos once |
| Fix pins | `debug@4.4.1`, `chalk@5.6.0` (13:16). Correct "previous good" versions. At 15:30 the tool pins `chalk@5.6.2` (a newer clean release): sensible |
| Suspect versions at 13:16 | 11 published by 13:16:00 (tool card) vs report title "19 malicious versions" (full incident). See C-6 |
| "74 min" | 14:26:51 OSV minus **13:12:10 first publish** = 74.7. Measured from the alert (13:16:00) the lead is 70.9 min. Re-triage at 15:30 shows "73 min" |
| Influence shares 43 + 29 + 29 | 101% (rounding) |
| Timeline API (`/api/timeline`) is sampled every 2 min (83 points) | Header/slider use it; table uses exact-minute `/api/exposure`. Source of C-3 |
| 13:12:00 -> 0 exposed; 13:12:20 -> WOULD_PULL 18 + MAINTAINER 3; 13:12:50 -> LOCKED 1 + WOULD_PULL 20 | API consistent with publish times |
| 15:14 -> 1/20/0; 15:15 -> 1/0/20 (removal 15:15:00) | API correct |

## 4. Wording check: "compromised" vs "would pull on a fresh install"

PASS, with two caveats.

- Searched the page at 13:14 / 13:16 / 15:30, all 21 Fix + Notice drawers, the `.md` export, and 3 Ask answers. "compromised" appears only as the **npm account / maintainer** (banner "Alert npm account qix compromised", legend "Compromised maintainer", "next compromised account"). The footer explicitly says "not that the repo was compromised". No repo is called breached, infected or hacked.
- Tier text is accurate: LOCKED "Lockfile pins a malicious version"; WOULD_PULL "A fresh install in the window would have fetched it".
- Caveat 1: the always-on footer and table caption say "Lockfile-pinned `npm ci` builds were safe" while LOCKED rows are exactly the case where `npm ci` is **not** safe (C-L1).
- Caveat 2: one LLM run wrote "Incident qix-2025-09-08 **affected** acme/checkout-web", and the 15:30 template narrative lists MAINTAINER-tier repos under "Top exposures ... from the compromised account" (C-5).

## 5. Screenshots index

| File | What |
|---|---|
| `phase3-secops/01-landing.png` | Landing, auto-playing clock, 3 Run buttons |
| `02-describe-tab.png`, `03-alert-typed.png` | Free-text alert |
| `04-after-run.png`, `22-verdict-first-view.png` | First answer; table below the fold |
| `05-full-page.png`, `06-table-scrolled-all.png`, `07-prod-only.png`, `07b-prod-only-btn-zoom.png`, `27-prod-only-pressed-zoom.png` | Table, Prod-only filter and its pressed state |
| `08-row-path-github-docs.png` | Row -> path |
| `09-fix-drawer-checkout-web.png`, `10-notice-tab-checkout-web.png`, `11-notice-copied.png`, `34-no-fix-drawer-insomnia.png`, `35-kong-drawer-after-ask.png` | Fix drawer / Slack notice / empty drawer |
| `13-after-export.png` | Export |
| `16-marked-remediated-drawer.png`, `17-table-after-remediate.png`, `18-after-run-again.png`, `32-remembered-after-reload.png`, `31-after-undo.png` | Remediation |
| `12-left-pane-bottom.png`, `19-ask-box-scrolled.png`, `20-ask-answer.png`, `21-ask-q1/q2/q3-autoscroll.png` | Ask box and answers |
| `14-scrub-1314.png`, `15-scrub-1530.png`, `28-scrub-1530-summary.png`, `29-retriage-1530.png`, `30-drawer-1530.png`, `36-header-vs-table-1313.png`, `36-header-vs-table-1515.png` | Timeline |
| `23-variant-1..4*.png` | Alert variants / failure state |
| `24-skip-to-table.png`, `25-skip-link-result.png`, `26-dev-row-overlap.png` | Accessibility / layout |
| `33-narrative-run1.png` | Narrative variance |

## 6. Scores (bar >= 9; none met)

| Dimension | Score | One-line reason |
|---|---|---|
| Clarity | **6** | Honest tiers and a great 3-column story, but the answer sits below the fold, LOCKED is ambiguous, Ask is hidden 11,650 px down |
| Speed | **8** | 0.64 s to headline, 1.9 s to verdict at best; but 6-18 s narrative variance and a 4.5 s cold load |
| Correctness | **5** | Data layer is right; Ask answers wrong x3, header/table disagree on odd minutes, drafts missing for 16 repos |
| Trust | **5** | Careful wording and Cypher transparency, undermined by "(verified)" on wrong answers and non-deterministic / truncated narrative |
| Delight | **8** | Scrubber, 74-min callout, graph, Cypher cards are a pleasure; dead ends and clutter keep it from 9 |
| Accessibility | **8** | axe: 0 violations in the main view, 1 serious in the drawer; strong keyboard/landmarks; some contrast / cost issues |

### 6.1 Correctness issues (score 5)

| ID | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| C-1 | **P0** | Left pane, bottom: "Ask about this triage" | Asked "which exposures are prod-only and who owns them?" -> "**acme/checkout-web is the only prod-only exposure; owned by Payments**", "2 of 2 claims traced". Table's own Prod-only filter shows **14 repos across 6 teams**. Re-phrased ("production (non-dev) dependencies ... grouped by team") -> only the 6 repos that have drafted paths (checkout-web, github/docs, mocha, nodemon, npm/cli, appium); **8 prod repos silently missing** (Kong/insomnia, uptime-kuma, nest, nest-cli, netlify/cli, nightwatch, puppeteer, socket.io), "6 of 6 claims traced". Reproduced 2/2. Shots `20`, `21-ask-q1`, `21-ask-q2` | Feed `ask` the same exposure rows as the table (incl. `dev` flag, team, path) for all 21 repos; add a "prod exposures by team" tool; make the verifier check quantifiers ("only", "all") and enumeration cardinality (14 expected, 6 given); show coverage "6 of 14" |
| C-2 | **P1** | Fix drawer, Fix tab, repos 6-21 | **16 of 21 drawers** (incl. 9 prod: appium, Kong/insomnia, uptime-kuma, nest, nest-cli, netlify/cli, nightwatch, puppeteer, socket.io) show only "No fix was drafted ... Each run drafts a path and a fix for its top 5 exposures only. **Ask a follow-up about this repo to get its path.**" and no PATH section. I asked "show the path and fix for Kong/insomnia" -> "**No information is available for Kong/insomnia**" (also badged verified, "1 of 1 claim"). The drawer's own instructions lead to a dead end. Copy fix is disabled. Shots `34`, `35` | Draft path + fix for every exposure (cheap: same template) or add a "Draft fix" button in the drawer that calls `explain_path` + `draft_remediation`; let Ask call those tools for any repo |
| C-3 | **P1** | Top-left counters + slider vs right table | At **13:13**: slider "13:13 UTC, 0 repos exposed", headline "0 repos one install from malware", LOCKED 0 / WOULD_PULL 0 / MAINTAINER 21, while the table directly beneath shows LOCKED 1 + WOULD_PULL 20 (and `/api/exposure?at=13:13` returns 1 + 20). At **15:15** (versions removed 15:15:00) header still says "21 repos exposed, WOULD_PULL 20" while the table shows MAINTAINER 20. Cause: header uses the 2-min `/api/timeline` samples, table uses exact `/api/exposure`. Shots `36-header-vs-table-1313`, `36-header-vs-table-1515` | Drive header from the same payload as the table, or set slider `step` to 120000 so only sampled minutes are reachable |
| C-4 | P2 | Left "Narrative" + right summary card at scrubbed times | At 15:30: headline "**1 repos**" (grammar), WOULD_PULL 0, but Narrative still says "20 would fetch malicious versions", and card "EXPOSED REPOS BY TIER: 21 of 21 repos" contradicts the 1. The "Showing exposure at 15:30. Paths and fix drafts belong to the triage run at 13:16" banner exists only at the top of the right pane and scrolls away. Shots `15`, `28` | Stamp the narrative "as of 13:16 UTC" and dim it when the clock differs; make the card count exposed only; pluralise |
| C-5 | P2 | Re-triage at 15:30, Narrative "Top exposures" / "Notify" | After "Run triage at 15:30": 0 repos would pull; narrative still lists appium and github/docs as "Top exposures ... depends on ansi-regex, ansi-styles from the compromised account" (MAINTAINER tier, not exposed) and tells Platform/Docs/CLI to be notified and rotate secrets. Shot `29` | When WOULD_PULL = 0 notify only LOCKED owners; keep MAINTAINER repos out of "exposures" |
| C-6 | P2 | Exported report (.md/.json) | Title "**19** malicious versions of chalk, debug, ansi-styles and 16 other packages" at scenario clock 13:16, when the tool card shows 11 published so far. Exposures list shows `WOULD_PULL` for all but drops the prod/dev distinction (7 dev-only listed as equals; JSON has `dev`, MD loses it). Path for github/docs is "`github/docs` (range `^5.0.1`)": **no package name and no bad version** (`chalk@5.6.1`); 16 repos have no path at all. `remediated: null` for all until marked | Put "as of" counts in the title; add Prod/Dev, package@version, depth columns to the MD; emit paths for all repos |
| C-7 | P2 | Fix drawer -> Notice tab (Slack message) | Message: "Payments: npm incident qix-2025-09-08. acme/checkout-web locks a malicious version: rotate build secrets and rebuild. Paths and fix PRs are in Patient Zero." Check: **repo yes; tier implicit only (no "LOCKED"/"WOULD_PULL" word); path NO** ("Paths ... are in Patient Zero", no link); **fix partial** (rotate + rebuild, but no `debug@4.4.1` / `chalk@5.6.0` pins, no window start 13:12 UTC). WOULD_PULL notices are per-team, not per-repo ("Platform: appium/appium, louislam/uptime-kuma, nestjs/nest, socketio/socket.io would pull ... add the pinned overrides"), bundle dev-only repos without saying so (CLI notice includes `microsoft/TypeScript`, `http-party/http-server`, both dev-only), and omit the versions to pin. Shots `10`, `11` | Template: `<team>: <repo> [LOCKED|WOULD_PULL, prod|dev] via <path> pulls <pkg@ver>; pin <pkg>@<safe>; secrets exposed since 13:12 UTC; link`. The Share link already exists, so use it |
| C-8 | P2 | Remediation memory | Works within one browser session: row strike-through, `recall_triage` card "1 repo assessed earlier in this session; 1 marked remediated", survives page reload (`32`). But: (a) memory is keyed to a **session cookie** (`pz_sid`, `expires=-1`, SameSite=Strict, localStorage empty); in a fresh/closed browser the repo is back to LOCKED; (b) **Undo exists for 10 s only**, afterwards no way to un-mark (drawer and row show no Undo); (c) Verdict/"Do" still says "Rotate secrets and rebuild acme/checkout-web [E1]" and counts still say 1 LOCKED / 21 repos after remediation (`18`); (d) the recall card sits as tool #5 in the feed, not in the verdict. Shots `16`, `17`, `18`, `32` | Persist per user/org, keep Undo available, add a "1 of 21 remediated" chip beside the headline, drop remediated repos from "Do" |
| C-9 | P3 | Headline "AHEAD OF THE ADVISORY +74 min" | Measured from first malicious publish (13:12:10), not from the alert (13:16): lead from the alert is about 71 min. Re-triage at 15:30 prints 73 | Label the baseline ("74 min after first publish") or use the alert time |
| C-10 | P3 | Free-text parser | `qix compromised` with no time silently sets the clock to **13:30 UTC**, not shown as an assumption (`23-variant-1.png`) | Show "no time given, assuming ..." |

### 6.2 Trust issues (score 5)

| ID | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| T-1 | **P0** | "(verified)" chips and "N of N claims traced to a graph query" under every Ask answer and in the header chip "21/21 traced" | Same wrong answer as C-1 carries "2 of 2 claims traced" and green check chips on `acme/checkout-web` and `Payments`; "No information is available for Kong/insomnia (verified)" is also badged. The check proves an entity exists in a tool result, not that the sentence is true. Q3 "Notify the **Payments** team first" shows "0 of 0 claims traced" (zero evidence, no tool calls) with raw `**` markdown | Rename to "entities found in graph", or verify quantifiers/counts; render "0 of 0" as "Unverified"; strip markdown |
| T-2 | **P1** | Left pane "Narrative" | Across seven runs of the identical alert I saw **four different narratives** (six consecutive runs gave three). Run 1 (LLM live): 5 repos + 6 teams. Run 3 (LLM live): "Incident ... **affected** acme/checkout-web", "Do" covers only checkout-web, 22/22 traced. Runs 2, 4, 5, 6 (template): 4 teams "and the other owners in the report". A fresh-profile LLM run was **truncated mid-list**: "Notify: Payments #team-payments, Docs #team-docs, `" with a stray backtick, **no "Do" section at all**, still "5 of 5 claims traced" and green "5/5 traced" (shot `32`). Mode flips between "LLM live" and "LLM template" with a banner that shifts the layout 31 px | Fixed Verdict/Notify/Do skeleton from data (all teams, all drafted repos), LLM only for phrasing; detect truncation (finish_reason) and fall back to template; reserve the banner height |
| T-3 | P2 | Failed triage state | Alert "npm account zzzunknown compromised 14:00 UTC" -> good message ("names no known incident ... Try `qix compromised, 13:16 UTC`", request id) but the dashboard behind it keeps the demo scenario's confident "**21 repos one install from malware**, LOCKED 1, WOULD_PULL 20" and the full repo list. Shot `23-variant-3.png` | Blank or grey the dashboard when triage failed |
| T-4 | P2 | Footer `WOULD_PULL means ... Lockfile-pinned npm ci builds were safe` | See C-L1: reassures about exactly the tier (LOCKED) where it is false | Per-tier footnote |
| T-5 | P3 | "Remediated 16:15" timestamp | Wall-clock local time (no TZ) next to scenario times that are UTC (13:16 UTC) | Show "remediated just now" or ISO UTC |

### 6.3 Clarity issues (score 6)

| ID | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| C-L1 | **P1** | Tier label "LOCKED" + footer | A first-timer reads "LOCKED" as "pinned/secured". It means the lockfile pins the **malicious** version (worst case, rotate secrets). The footer right under it says lockfile-pinned `npm ci` builds were safe. Nowhere on the first screen is LOCKED defined | Rename to e.g. `INSTALLED (lockfile pins bad version)` or add a legend + tooltips; per-tier footer ("LOCKED: npm ci installs it; WOULD_PULL: only fresh resolves") |
| C-L2 | **P1** | Ask input at bottom of the left pane | At 1440x900 the left pane scrolls 12,130 px (18 tool cards x 3 tab stops each). Ask box is at scrollTop about 11,650. Nothing on the page (including the 3-step onboarding strip) mentions Ask. Shots `12`, `19` | Pin the Ask input at the bottom of the left pane or put it directly under the Verdict; add it to the onboarding hints |
| C-L3 | **P1** | Layout above the fold (right pane) | The deliverable (repo / tier / path / owner / Fix) is below the fold: only 35 px of the first row show at 900 px, partly covered by the footer; "Fix" on row 1 is half-hidden (`04`, `22`). The filter bar (Prod only / Tier / Filter repos) is the last thing visible, so toggling it changes nothing you can see, and there is no "Showing 14 of 21" text. Top bar, alert banner, hero counters, onboarding strip and the summary card push the first table row to y=841 of 900. "Skip to exposure table" lands on the pane top (summary), not the table (`25`) | After triage collapse the hero to one line; sticky table header with filters; add result count; make the skip link focus the table caption |
| C-L4 | P2 | "Prod only" toggle | Pressed state differs by a background of rgb(25,25,28) -> rgb(32,32,36) (about 1.1:1); only `aria-pressed` tells you. `07b`, `27` | Filled accent when on + "14 of 21" |
| C-L5 | P2 | Table rows of dev-only repos (7) | At 1440 the "dev" pill (x 1207-1240) overlaps the package name (x 1216-1258): "dev" sits on top of "chalk"/"debug". Fix buttons also touch the viewport edge (x 1392-1440), right border clipped. Shots `26`, `17`, `36` | Give the Tier cell a fixed min-width / wrap the pill under the tier; add right padding to the pane |
| C-L6 | P3 | Misc copy | Path dots "•"/"••" (hop depth) have no legend; direct-dependency path reads "github/docs ^5.0.1 -> chalk@5.6.1 direct" as if `github/docs` were a package; 3 identical Run triage buttons; demo clock autoplays on load before any input; Notify names 6 teams while the export has 7 notices (Web, dev-only); a green "(verified)" chip on every entity makes the narrative visually noisy | Legend row; "declares chalk ^5.0.1 -> resolves 5.6.1"; one primary CTA |

### 6.4 Speed issues (score 8)

| ID | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| S-1 | P2 | Narrative after "Run triage" | Headline at 0.64 s; narrative best case 1.86 s, but whole-run times 17.7 s / 17.8 s (LLM live) vs 6.1-6.9 s (template) when the server was shared. No progress indicator beyond the feed filling | Stream the template verdict first, swap to LLM phrasing later; show "narrating..." |
| S-2 | P3 | First load | 4.5 s on a cold profile (dev server), 1.3 s warm | Prod build / preload |
| S-3 | P3 | Slider | Keyboard stepping about 220 ms/step in headless (136 steps = 30 s); once a run of 122 presses landed on 15:14 instead of 15:15. Low confidence it is an app bug | Throttle heavy redraw on `input`, update graph on `change` |
| S-4 | P3 | Network | One aborted `/api/timeline` per load (double fetch), aborted `/api/exposure` per scrub | De-dupe in an effect cleanup |

### 6.5 Delight issues (score 8)

| ID | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| D-1 | P2 | Fix drawer for 16 of 21 repos | Empty state ("No fix was drafted") is the most-seen state after the first 5 rows; kills the "wow" of the first drafted fix (`34`) | See C-2 |
| D-2 | P3 | Ask feedback | Wrong confident answer + raw `**Payments**` markdown (`21-ask-q3`) | See T-1 |
| D-3 | P3 | Layout shift | "Narration from a template" banner pushes everything down 31 px when it appears (`34`, `36`) | Reserve the row |
| D-4 | P3 | Strengths worth keeping | Clock scrubber with `aria-valuetext`, the "74 min" callout, Cypher cards with plan, "Run triage at 15:30 UTC" prompt, Slack copy toast, strike-through remediation with Undo | |

### 6.6 Accessibility issues (score 8)

axe-core (the version installed in the repo's `node_modules`, loaded read-only) found **0 violations** in the triaged main view and at 15:30, and **1 serious** with the Fix drawer open.

| ID | Sev | Where | Evidence | Suggested fix |
|---|---|---|---|---|
| A-1 | P2 | Fix drawer footer "Report .md" / "Report .json" | axe `label-content-name-mismatch` x2: `aria-label="Export the whole report as Markdown/JSON"` does not contain the visible text "Report .md" (WCAG 2.5.3, voice-control users) | `aria-label="Report .md, export whole report as Markdown"` or drop the label |
| A-2 | P2 | Keyboard path to the table | 77 Tab presses from the start of the feed to "Prod only" (each tool card has Copy Cypher + Show plan + Cypher). "Skip to exposure table" lands on the pane top, not the table | Skip-feed link; focus the table caption; collapse cards by default |
| A-3 | P2 | "Prod only" pressed state | About 1.1:1 background change, fails 1.4.11 non-text contrast (C-L4) | Stronger state |
| A-4 | P3 | Hop-depth dots | `••` 11 px `#85837E`: 4.29:1 (need 4.5:1) | Lighten to `#9a988f` |
| A-5 | P3 | Dev rows | "dev" pill overlaps text (C-L5) | Layout fix |

What is good: skip links; landmarks (header, main, aside, nav "Panels", labelled sections); every control has a name; visible 2 px focus ring on all 77 stops; native `<dialog>` modal with focus on Close, Esc returns focus to the invoking Fix button; slider `aria-valuetext` "13:16 UTC, 21 repos exposed"; `aria-live` regions and `role=status`; table has caption, `scope`, `aria-sort`; decorative SVGs `aria-hidden`; text alternative for the graph; autoplay has a Pause control; tiers are text, not colour-only.

## 7. Timeline scrub results (does it change sensibly?)

| Clock | Header (UI) | Table (UI) / API | Sensible? |
|---|---|---|---|
| 13:12 | 0 exposed, MAINTAINER 21 | same | Yes (first publish 13:12:10) |
| **13:13** | **0 exposed**, 0/0/21 | **LOCKED 1 + WOULD_PULL 20** | **No: header stale (C-3)** |
| 13:14 | 21 exposed, 1/20/0 (5 versions live) | same | Yes. Same counts as 13:16 but different bad versions and paths (`14-scrub-1314.png`) |
| 13:16 | 21 exposed, 1/20/0 (11 versions live) | same | Yes |
| 14:26 | OSV advisories 0 | 1/20/0 | Marker says "14:26 OSV record" but record is 14:26:51, so counter flips a minute later. Minor |
| 15:14 | 21 exposed, OSV 1 | 1/20/0 | Yes |
| **15:15** | 21 exposed, WOULD_PULL 20 | LOCKED 1 + MAINTAINER 20 | **No: header stale (C-3)** |
| 15:30 | **1 "repos"**, 1/0/20, OSV 1 | 1/0/20 | Counts right; narrative/card stale (C-4) |

## 8. Notes and housekeeping

- Not tested: mobile viewport, axios scenario, "Paste your repo".
- Test state left in the live graph: remediation records for `acme/checkout-web` (a session that predates my cookie loss) and one for `github/docs` (fresh session) under now-orphaned `pz_sid` cookies. I could not Undo them (10 s window / session lost). They are only visible to those session ids.
- Only files created: this report and screenshots in `qa/reports/phase3-secops/`. Helper scripts live in the shared temp dir, not the repo.

## Top 5 fixes

1. **Make Ask truthful (C-1, C-2, T-1, P0).** Ground it on the same exposure rows the table uses (dev flag, team, path, all 21 repos); verify quantifiers and counts, not entity presence; let it draft path/fix for any repo; replace "(verified)" on enumerations with coverage ("6 of 14").
2. **Make header, slider and table one source of truth (C-3, C-4, P1).** Drive counters from the same `/api/exposure` payload (or snap the slider to the 2-min samples); stamp the narrative "as of 13:16" and dim it when the clock moves; fix "1 repos" and the "21 of 21 exposed" card.
3. **Put the answer above the fold (C-L2, C-L3, C-L4, P1).** Collapse the hero after triage; show the table with filters and "Showing 14 of 21" in the first viewport; pin the Ask input; make the Prod-only pressed state unmistakable; define LOCKED vs WOULD_PULL with a per-tier footnote (replace the "npm ci builds were safe" line for LOCKED).
4. **Make drafts complete and Slack messages self-contained (C-2, C-7, C-6, P1/P2).** Draft path + fix for every exposure; Slack text = repo, tier, prod/dev, path (`express -> debug@4.4.2`), pin target (`debug@4.4.1`, `chalk@5.6.0`), exposure window start (13:12 UTC) and a deep link; carry the same fields (package@version, prod/dev) into the .md export.
5. **Make the narrative deterministic and remediation visible (T-2, C-8, P1).** Fixed Verdict/Notify/Do skeleton from data, LLM only for phrasing; detect truncation and fall back; reflect remediation in the verdict ("1 of 21 remediated, 20 open"); keep Undo and persist beyond the browser session.
