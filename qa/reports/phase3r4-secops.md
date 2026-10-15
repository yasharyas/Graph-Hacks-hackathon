# Patient Zero - Phase 3 round 4: on-call AppSec journey

Persona: AppSec engineer on call. Alert "qix's npm account was hijacked, 13:16 UTC". Headless Chromium (Playwright), 1440x900 and 1366x768, clipboard read granted, dev server `localhost:5173` for the journey, production build `localhost:8080` spot-checked. Screenshots and evidence files are in `phase3r4-secops/`. No repo file edited, no commit, `.env` not read, no server touched. Every number below was read from the screen, the clipboard, a downloaded file, real `npm 11.13`, or `scripts/exposure-oracle.ts`, not assumed.

One environment caveat up front: the LLM stopped answering early in the session (the first two triages showed "LLM live", every later one "LLM template" or "LLM replay"). Every model-routed Ask I sent afterwards (about 20) answered in 2 ms with "No language model is available right now" (raw SSE `done ms 2`), possibly the server's `LLM_DAILY_CAP` (800) used up by the parallel QA agents (not confirmed: I did not read `.env` or the server state). So model-written answers could not be judged live. I judged the graph-routed answers live, the model label through a **simulated** SSE answer (route interception, `98-simulated-model-answer.png`, UI only), and the model prompt from `server/agent/ask.ts`.

## 1. Verdict and overall score

**Overall 8.2 / 10. Same headline as round 3, but a different shape: the data is now right everywhere I could check it; what is left is judgement (priority order, input parsing, answer routing) and one accessibility state.**

What got fixed since round 3 (all re-tested with evidence, section 3): the Slack "Window" is dated and in the right tense for qix and axios (21/21 and 10/10 messages); the Slack link reopens the same repo, Notice tab and clock in a fresh browser (6/6); the export honours Prod only, says its scope in the menu, the file name and the first lines, and its team Notices carry the direct-dependency pin; every Fix JSON installs (31 of 31 repos run through real `npm install --package-lock-only --ignore-scripts`, two negative controls reproduce `EOVERRIDE`, see 4.5); Undo no longer expires and the reopened drawer offers it; the verdict is no longer clamped at 1366x768; Ask answers land above the pinned Ask bar; the Ask answers for "how bad", "CISO", "dev-only", "which team", "prod-only and owners" are graph-built and correct; raw Tabs to Prod only 83 -> 46 (4 + 3 with the skip link). Counts match `docs/proof-points.md` (qix 13:30 LOCKED 1 / WOULD_PULL 20, 13 prod, prod-only 14 repos across 6 teams, 7 teams; axios 01:30 LOCKED 1 / WOULD_PULL 9, 105 min). Verdict and table arrive 0.49 s after Run.

What would still make me hesitate on call: (1) "what should I do first in the next hour?" returns the 7-team roster and a Do list whose rotate-secrets step for the LOCKED repo is **step 3**, after "keep installing"; (2) free-text time handling: "1:16 PM" becomes 01:16 UTC and the verdict says "no repo is exposed", an ISO timestamp or "13:16UTC" is reported as "No time in the alert"; (3) with an alert typed, the big right-pane "Run triage at 13:30 UTC" button silently ignores it; (4) Ask answers questions it did not get, with a green "N of N claims verified" ("pause deployments" returns a timeline sentence, "riskiest after checkout-web" returns checkout-web), and its failure fallback is labelled "Answered from the graph"; (5) scrubbing leaves the narrative dimmed below WCAG contrast (axe serious, 20 nodes); (6) the headline still says "21 repos one install from malware" for 20 repos that `npm ci` does not touch.

## 2. Timed friction log

Scripted, so human reading, typing and thinking time is on top (paste about 1 s, typing 3-5 s). T+ is from the click on Run unless noted. 1440x900 / 1366x768.

| T+ | Step | What happened | Shot |
|---|---|---|---|
| 0.45 / 0.47 s | Page load, "Describe an alert" tab present | Autoplay of the timeline starts at once (clock 13:00 -> 15:45 in about 20 s) while you type; a Pause button is on screen | `00-landing` |
| about 1.4 s | Type the 41-char alert (20 ms/char) | Textarea fine. **Two Run buttons are visible**: "Run triage" (next to the box) and the primary "Run triage at 13:30 UTC" in the right pane. The second ignores the typed alert (F7) | `93-typed-two-ctas` |
| **+0.49 / +0.53 s** | Run -> verdict with the LOCKED sentence, header 21 / LOCKED 1 / WOULD_PULL 20, table of 21, "Triage complete: 50 tools, 57 of 57" | LOCKED sentence is on screen at y 375-435 (of 900) and 377-437 (of 768): no clamp, no scroll | `10-triaged-1440`, `10-triaged-1366` |
| +0.36 s | "Show the rest of why, who to notify and the steps" | NOTIFY (7 teams, channels) and DO (3 steps) appear. Still one click away; at 1366x768 the link is below the fold of the narrative pane. The verdict scrolls out of view when it opens | `90-friction-1366-after-show` |
| +0.08 / +0.12 s | Prod only | "14 of 21 shown", `aria-pressed=true` | `12-prod-only` |
| +0.26 / +0.23 s | Open Fix drawer (github/docs) | Copy fix and Mark remediated at y 848 (of 900) and 716 (of 768): in view | `13-drawer-checkout-fix`, `90-friction-1366-drawer-fix` |
| 0.15 s each | Copy JSON, Copy fix, Notice tab, Copy message, More actions | Clipboard equals screen (31/31 repos, steps, PR body and JSON too). "Slack message copied" no longer lingers on the other tab | `14`, `15` |
| 2.3 s | Slack link in a fresh browser | Same repo, Notice tab, clock 13:16, narrative rebuilt, message identical (6/6) | `40-slacklink-*` |
| instant | Export .md / .json, with and without Prod only | Menu says "The whole report, 21 repos." or "Only the rows shown: prod only, 14 of 21 repos."; file name gets `-filtered` | `30-*-export-menu-*`, `export-*` |
| instant / 3.2 s | Mark remediated -> Undo -> Run again | Chip "2 marked remediated", row struck through, verdict "WOULD_PULL, 19 repos ... Marked remediated: ...", Undo still there after 14 s and on a reopened drawer | `70`-`73` |
| 1.3 s | Ask, graph-routed (7 of the 8 persona questions) | Short answers end just above the Ask bar; long answers align to the pane top and their lower part runs under the bar (F11) | `A-B-q1`, `A-B-q4`, `A-F1366-q3` |
| instant (2 ms) | Ask, model-routed ("customers", open question, "Am I affected?") | "No language model is available", labelled "Answered from the graph" (F5) | `A-D-q1` |
| 3 x 3.2 s | Nine questions need three re-runs | The cap is still 4 follow-ups per triage ("4 of 4 used") | `A-B-q4` |
| 1.3 s per stop (1.5 s settle) | Scrub 13:00 ... 15:45 | Header, table and slider text agree with the oracle at 14 stops. The "clock moved" banner and Re-run button appear after a 1.5 s settle; until then the narrative still reads as current | `50-scrub-qix-*`, `51-scrub-mouse-late` |
| 0.55 s | axios alert 01:30 | LOCKED 1 / WOULD_PULL 9, "+105 min", 48/48 | `60-axios0130` |

Console: no `pageerror`, no app `console.error`. Only `ERR_ABORTED` on superseded `/api/timeline|triage` fetches, plus the expected `400` for an alert that names nothing.

## 3. Round-3 items (every item from `phase3r3-secops.md`, sections 3 and 5)

| Item (round 3) | Status | Evidence |
|---|---|---|
| 5.1 axios Slack "Window" 23:59 vs 00:21, undated; "have been live" after removal | **Fixed** | axios: "Window: malicious versions live since 00:21 UTC on 2026-03-31 (still live at 01:30 UTC)" in 10/10 messages. qix at 15:30: "were live from 13:12 UTC on 2025-09-08 until npm removed them around 15:15 UTC" (`61-qix1530-notice`) |
| 5.2 green "verified" on wrong LLM prose | **Partly** | Graph-routed now: how bad, CISO, dev-only, first-hour, teams (all correct counts, 7 teams). Model answers carry "LLM answer: the model wrote the words · provider" and "N of M names and numbers found in the graph results; the wording is the model's" (simulated SSE, `98`). Not testable live (LLM unavailable). New wrong-question answers with green badge: F6 |
| 5.3 ordinary questions mis-routed to the NOTIFY roster | **Partly** | CISO / how bad -> verdict paragraph (not a 2-sentence briefing, but correct); which team -> "CLI 5; QA 4; Platform 4; Docs 3; API Clients 2; Web 2; Payments 1" (matches export 21/21); customers -> model (unavailable). Other phrasings still mis-route (F6) |
| 5.4 answers land under the Ask bar | **Partly** | First line always visible. Short answers end 12 px above the bar (bottom 776 vs bar top 788 at 1440x900; 644 vs 656 at 1366x768); long ones align to the pane top (192). Long answers (first-hour) still run under the bar: DO block starts at y 733 vs bar top 656 at 1366x768 (`A-F1366-q3`) |
| 5.5 NOTIFY/DO hidden, verdict clamped | **Partly** | Clamp gone: whole verdict readable at 1366x768. NOTIFY/DO still need the "Show the rest..." click, below the pane fold at 768 |
| 5.6 export ignores filter / Notices `EOVERRIDE` / wrong "via" range / no scope | **Fixed** | Filtered export 14 rows (md, json, table identical sets), scope in menu, file name, md line 4 and `view` in JSON; Notices carry "set chalk to 5.6.0 in devDependencies"; "via" ranges now equal the path ranges (checked for Kong, kuma, npm/cli, docs). Residual: the md has no verdict/notify/do summary on top (F8) |
| 5.7 Undo 10 s, no "mark open" | **Fixed** | Undo visible at 0.3, 3, 6, 9, 11, 14 s; reopened drawer has "remediated 16 Oct ... Undo"; Undone -> "Mark remediated" returns (`71`) |
| 5.8 "+74 min" truncated / from first publish | **Not fixed** | Still "+74 min ahead of the advisory" and "74 minutes before the first OSV record" (74.68, first publish 13:12:10; 71 from the 13:16 alert). Matches `proof-points.md` |
| 5.9 post-removal header wording | **Not fixed** | 15:30: "1 repo one install from malware" |
| 5.10 headline "21 repos one install from malware" beside "npm ci safe" | **Not fixed** | Same headline; chip is "2 marked remediated" not "19 open, 2 remediated" (F4) |
| 5.11a "as of" floats into the first sentence | **Fixed** | Stamp sits on the VERDICT heading line |
| 5.11b "Fix copied" persists on Notice tab | **Fixed** | `99-notice-after-fixcopy`; Notice tab shows only its own "Slack message copied" |
| 5.11c share link drops Prod only and the alert | **Not fixed** | Link `...&repo=mochajs/mocha`; fresh open: Prod only unpressed, no Alert banner |
| 5.11d failed triage leaves the old qix graph | **Not fixed** | `80-alert-10`: header "no result: the triage did not run", but the qix path graph and "Run triage at 13:30" stay; autoplay keeps running behind the error |
| 5.11e analyst pick names 3 of 4 | **Not fixed** | "(github/docs, mochajs/mocha, npm/cli and 1 more)" at 13:16; "socketio/socket.io, jquery/jquery, mozilla/pdf.js and 1 more" at 13:30 (`listed()` caps at 3) |
| 5.11f 83 raw Tabs | **Improved** | 46 raw; skip link on Tab 4, then 3 to Prod only |
| 5.11g `proof-points.md` "58-60/58-61 claims" | **Still stale** | 13:30 default run, 3 of 3: "62/62 claims traced" (13:16 alert, template: 57/57) |
| R3 §3-1 Ask rotate secrets / npm ci for the rest | **Fixed** | 3 of 3 runs: "Rotate secrets for the 1 LOCKED repo: acme/checkout-web ... For the other 20 ... npm ci is safe", "Answered from the graph" |
| R3 §3-1b flagged-claim clutter | **Not testable live** | Only shows on model answers (LLM unavailable). Simulated: one honest sentence, no struck-through tokens |
| R3 §3-2 "what should checkout-web do" | **Fixed** | 3 of 3: LOCKED, rotate secrets, overrides, rebuild, "12 of 12 verified" |
| R3 §3-3 `EOVERRIDE` for direct-dependency repos | **Fixed** | 4.5: Fix tab, Copy JSON, Slack, PR body and export Notices all carry the `dependencies` pin; real npm passes; negative control fails |
| R3 §3-4 remediation not reflected | **Partly** | Chip "2 marked remediated", struck rows, verdict line, history list, survives reload and new tab, fresh browser clean. Header counts stay 1 / 20 (by design: "true at the scenario clock"); Ask is blind to marks until a re-run (F9) |
| R3 §3-5 export placement / content | **Fixed** (see 5.6) | Table toolbar button |
| R3 §3-6 failed triage header | **Fixed** (residue in 5.11d) | Header "no result", LOCKED -, WOULD_PULL - |
| R3 §3-7 drawer fold | **Fixed** | "+6 more" collapse; Fix tab and Copy fix in view at 1366x768 |
| R3 §3-8 Slack link opens 13:30 / no drawer | **Fixed** | 6/6 (4 qix, 2 axios) |
| R3 §3-10a no-time alert | **Fixed** | Banner shown; nit: axios banner suggests "13:16 UTC" (qix's time) |
| R3 §3-10c follow-up cap | **Not fixed** | "4 of 4 used", then "Follow-ups used up"; Run again resets |
| R3 §3-10e NOTIFY/DO need a scroll | see 5.5 | Partly |
| R3 §3-10f/10g placeholder, "1 repos" | **Fixed** | "Repo or team"; "1 repo" |
| R3 verified OK: axe 0, focus returns, valid override syntax, no repo called "compromised" | **Mostly** | axe 0 in 9 of 10 states x 2 viewports; **serious colour-contrast in the scrubbed (stale) state** (F1). Esc and Close return focus to the row's Fix button; override syntax valid |

## 4. Fresh journey: what I did and what I saw

### 4.1 Free-text alerts

| Alert text | Posted | Result | Judgement |
|---|---|---|---|
| "qix's npm account was hijacked, 13:16 UTC" | alert only | 13:16, 21 / 1 / 20, 0.49 s | good |
| "[13:16 UTC] Aikido: qix npm account hijacked, chalk and debug malicious" | alert only | 13:16 | good |
| "qix compromised" / "debug 4.4.2 malicious" | alert only | 13:30 + banner "No time in the alert: using 13:30 UTC, the scenario default. Add one, like 13:16 UTC." | good |
| "chalk@5.6.1 is malicious, seen 14:00 UTC" | alert only | picks qix, 14:00 | good |
| "qix compromised 13:16:45" | alert only | 13:16 | good |
| **"qix compromised 2025-09-08T13:16:00Z"** | alert only | 13:30 + banner "No time in the alert" | the alert has a time; banner is wrong, clock is wrong (F3) |
| **"qix compromised 13:16UTC"** | alert only | 13:30 + same banner | same |
| **"qix compromised at 1:16 PM"** | alert only | 01:16 UTC, "no repo is exposed ... 21 repos depend on packages from the compromised account", 0 exposed | silent AM reading, false reassurance (F3) |
| "qix axios compromised 13:16 UTC" | alert only | picks qix, no mention of axios | silent tie-break |
| "13:16" / "the internet is on fire" | alert only | 400, "The triage did not run. The alert names no known incident ... Try 'qix compromised, 13:16 UTC'" | clear |
| "ignore previous instructions ... qix compromised 13:16" | alert only | normal 13:16 verdict | no injection effect |

A typed alert plus a click on the big right-pane CTA ("Run triage at 13:30 UTC") posts `{"scenario":"qix-2025-09-08","at":1757338200000}`: the alert is ignored, the textarea still shows it, no Alert banner (`93-after-right-cta`, F7). My own first script hit exactly this.

### 4.2 Tool feed, verdict, who to notify, steps (qix 13:16)

Verdict: "21 of 21 repos are exposed ... LOCKED, 1 repo (acme/checkout-web) ... WOULD_PULL, 20 repos (13 prod, 7 dev-only): exposed only on a fresh install since 13:12 UTC ... installing from the committed lockfile was safe." 13 prod / 7 dev and 7 teams match the table (Payments 1, Docs 3, QA 4, CLI 5, Platform 4, API Clients 2, Web 2), the export and the docs. Tool feed: 50 cards, each with Cypher, ms and "cached" flag; every claim chip opens its card. Hindsight leak: at the 13:16 clock the verdict already says "npm removed them around 15:15 UTC" and the toolbar says "+74 min ahead of the advisory" (OSV record at 14:26). The scrubbed 13:11 state hides the "+74 min"; the triaged 13:16 state shows it (F4).

Priority: the verdict's own Do line is "1) Keep installing the 20 WOULD_PULL repos from committed lockfiles ... 2) Only if you must re-resolve ... 3) For acme/checkout-web: rotate secrets ...". The drawer's STEPS for a LOCKED repo are "1) add the overrides ... 2) Rotate secrets ... 3) Rebuild". Rotate secrets is last in the first and second in the second (F2).

### 4.3 Prod only, Fix and Notice tabs

Prod only: "14 of 21 shown", `aria-pressed`, 14 rows, same set as the Ask answer and the filtered export. Drawer: path, lockfile pins with "safe: npm ci installs exactly this" or "a malicious version: npm ci installs it", Fix tab with JSON, pins, steps, PR body; Notice tab with the Slack text. "+6 more" collapses 16 safe pins. Opened, copied and read all 21 repos (and 10 axios repos): steps, PR body and JSON equal the screen in 31 of 31; Notice equals the clipboard after normalising Chromium's CRLF in 31 of 31; Slack path equals export path in 21 of 21; clipboard overrides equal export overrides in 21 of 21.

### 4.4 Slack message, qix and axios

qix 13:16: "Window: malicious versions live since 13:12 UTC on 2025-09-08 (still live at 13:16 UTC)." axios 01:30: "... since 00:21 UTC on 2026-03-31 (still live at 01:30 UTC)", which equals the verdict. qix 15:30: past tense with the removal time. LOCKED messages say rotate secrets and rebuild; WOULD_PULL messages say "Keep npm ci on the committed lockfile and add the pin if you resolve fresh"; direct-dependency repos add "Also set in package.json, under dependencies: ...". Link: `?scenario=...&at=...&repo=...&open=notice`, opens the same repo, Notice tab and clock in a fresh browser in 2.3 s (4 qix, 2 axios). The production build (`:8080`) gives the same numbers, fix JSON, Slack text and an `:8080` link.

### 4.5 Copy JSON -> real `package.json` -> `npm install --package-lock-only --ignore-scripts`

Flags: `--package-lock-only --ignore-scripts` everywhere; `--legacy-peer-deps` where a repo's own peers conflict. package.json rebuilt from each repo's historical lockfile root (`dependencies`, `devDependencies`, `overrides`), snippet merged the way the drawer says (a key already declared is replaced in its own block, `overrides` merged), npm 11.13.

| Repo | Result |
|---|---|
| mochajs/mocha (`debug ^4.3.5` -> `4.4.1`) | exit 0, no malicious version in the lock. Negative control (overrides only): **`EOVERRIDE`** |
| github/docs (`devDependencies.chalk` -> `5.6.0`) | exit 0 |
| remy/nodemon (`debug ^4` -> `4.4.1`) | exit 0 |
| npm/cli (`chalk`, `supports-color` -> exact) | exit 0 (workspace links dropped) |
| acme/checkout-web and 14 qix repos with no direct bad dependency (appium, netlify/cli, nest, nest-cli, puppeteer, nightwatch, insomnia, jquery, bootstrap, pdf.js, swagger-ui, TypeScript, newman, http-server) | exit 0 (overrides only needed) |
| socketio/socket.io | EBADPLATFORM on this Windows host (`eiows`), identical without any fix; exit 0 with `--force` |
| louislam/uptime-kuma qix and axios | `ERESOLVE` on this repo's own peers, identical with **no** fix at all (control); exit 0 with `--legacy-peer-deps`. axios negative control: **`EOVERRIDE`** |
| acme/billing-api (axios LOCKED) | exit 0 |
| 8 other axios repos (appium, github/docs, insomnia, nest, nightwatch, socket.io, swagger-ui, bootstrap) | exit 0 with `--legacy-peer-deps --force` (none declares axios directly, so overrides alone are valid; the direct-dependency cases billing-api and uptime-kuma above ran without `--force`) |

So the direct-dependency pin is both necessary (controls fail) and present (fix passes) in the Fix tab, Copy JSON, Slack, PR body and the export Notices. 21/21 qix repos and 10/10 axios repos have a fix that installs; the only failures are the two environment ones above, shown to fail identically without the fix.

### 4.6 Export with and without a filter

| | qix 13:16 | axios 01:30 |
|---|---|---|
| Whole report | menu "The whole report, 21 repos."; md 38,099 B, json 63,904 B; 21 rows = table; LOCKED 1 / WOULD_PULL 20; 14 prod / 7 dev; 7 teams; 74 min | menu "The whole report, 10 repos."; md 11,833 B; 10 rows = table; counts LOCKED 1 / WOULD_PULL 9 / CLEAN 11; 105 min |
| Prod only | menu "Only the rows shown: prod only, 14 of 21 repos."; `...-filtered.md/json`; md line 4 "Filter: prod only, 14 of 21 repos. Only these repos are listed."; json `view.label`, `view.repos[14]`; 14 rows = table; 6 team notices | "6 of 10 repos"; 6 rows = table; LOCKED 1 / WOULD_PULL 5 |

Cross-checks: row set equals the table in md and json for both; md and json agree; the drawer's More actions still exports the "Whole report" and says so. Gaps: no verdict / who to notify / do summary at the top of the md (a lead has to read 21 repo blocks; the only "npm ci was safe" sentence is the last line); for axios "The whole report, 10 repos" reads as the whole 21-repo org (11 CLEAN repos are only a count).

### 4.7 Mark remediated, Undo, rerun, history

Mark docs -> drawer "Marked remediated. You can undo it here." + "remediated 16 Oct, 04:05 GMT+5:30" + Undo; Undo clicks back to "Undone: not marked remediated". Two marked -> chip "2 marked remediated", rows struck through with a local time stamp, "Marks are saved for this browser session only". Run again (3.2 s): verdict "WOULD_PULL, 19 repos (12 prod, 7 dev-only) ... Marked remediated: acme/checkout-web and github/docs.", LOCKED sentence and the rotate-secrets step drop out, NOTIFY lists "(remediated)". Header LOCKED 1 / WOULD_PULL 20 unchanged. History tab: with marks it lists them; after three runs and no marks it says "No saved triages yet. The recall_triage tool has not returned any earlier runs in this session." (tool name leaked, no run list). Persistence: marks survive reload (flushed on pagehide), new tab in the same session, not a fresh browser. The write to the server is deferred to the next re-run, so Ask answers made before a re-run ignore the marks (F9).

### 4.8 Ask (qix 13:16; graph answers 1.3 s)

| Question | Label | Answer | Correct? |
|---|---|---|---|
| Which repos need secrets rotated, and is npm ci safe for the rest? (3 runs) | graph, 1 of 1 | Rotate secrets for acme/checkout-web; npm ci safe for the other 20; fresh resolves treat like LOCKED | yes |
| What should acme/checkout-web do? (3 runs) | graph, 12 of 12 | LOCKED, why, rotate secrets, overrides, rebuild | yes |
| which exposures are prod-only and who owns them? | graph, 22 of 22 | "14 repos across 6 teams", grouped by team, LOCKED flagged | yes, equals docs and table |
| is npm ci safe? | graph, 1 of 1 | same rotate/npm ci paragraph | yes; leads with rotation, not a yes/no |
| how bad is this? | graph, 6 of 6 | verdict paragraph + "The exposed repos belong to 7 teams." | yes |
| what do I tell my CISO? | graph, 6 of 6 | identical to "how bad" | facts right; not a two-sentence briefing |
| can I ignore dev-only? | graph, 7 of 7 | names the 7 dev-only repos, "not safe to ignore: npm install and npm ci install devDependencies by default ...", npm ci from lockfile stays safe | yes; "No" is in the second sentence |
| what should I do first in the next hour? | graph, 39 of 39 | 7-team roster, then Do with rotate secrets as step 3 | **no, priority wrong (F2)**; Do block below the Ask bar at 1366x768 |
| which team has the most work? | graph, 14 of 14 | "CLI 5; QA 4; Platform 4; Docs 3; API Clients 2; Web 2; Payments 1 (one LOCKED)" | yes |
| do I need to notify customers? | "Answered from the graph" + "Not checked against the graph" | "No language model is available right now, so this question cannot be answered." | label wrong (F5); no help |
| Open: "Is anything unusual about the qix account that I should tell my vendor manager?", "Am I affected?", "What is the single riskiest assumption in this triage?" | same | same | same; "Am I affected?" is the most natural first question and has a graph answer (summary) |
| Should we pause deployments until the malicious versions are removed? | graph, 1 of 1 | "Exposure began at 13:12 UTC ... first OSV record came at 14:26 UTC ... At 13:16 UTC they were still live." | does not answer the question (`removed` matched the timeline rule) |
| Which exposed repos are the riskiest after checkout-web and why? | graph, 12 of 12 | only checkout-web | answers the one it was asked to skip |
| Explain in plain words why a fresh install is riskier than npm ci | graph, 1 of 1 | the rotate/npm ci paragraph | partial |
| Why is mochajs/mocha exposed if its committed lockfile is safe? | graph, 20 of 20 | mocha path and fix, then an unrelated checkout-web paragraph (`safe` matched the rotate rule) | correct, noisy |

axios: prod-only "6 repos across 4 teams" equals the export; team ranking equals the export (Platform 4, Docs 2, Payments/API Clients/QA/Web 1).

### 4.9 Scrub before 13:12 and after 15:15 (qix), and axios

Oracle (`scripts/exposure-oracle.ts`, plus the synthetic checkout-web, which pins both bad versions once `chalk@5.6.1` is out at 13:13:05) against the screen at each stop: 13:00, 13:11, 13:12 -> 0 exposed (table lists 21 MAINTAINER rows, "0 of 21 exposed"); 13:13 -> 20 (header "20 repos", LOCKED 0 / WOULD_PULL 20); 13:16 and 13:30 -> 21; 14:25-15:14 -> 21; 15:15, 15:16, 15:30, 15:45 -> 1 (checkout-web, LOCKED; MAINTAINER 20; "OSV advisories 1"). Header, slider text ("13:11 UTC, 0 repos exposed"), table count and "N of 21 exposed" agree at all 14 stops. After a 1.5 s settle: "The clock moved to 15:35 UTC. [Re-run to update]", "Showing exposure at 15:35 UTC. Paths and fix drafts belong to the triage run at 13:16 UTC." [Back to 13:16 UTC] [Run triage at 15:35 UTC]. Re-triage at 15:30: "1 of 21 repos is exposed ... 20 more repos depend on packages from the compromised account, with no malicious version live for them", Pin to `chalk@5.6.2` (the clean release exists by then), past-tense Slack window. Triage at 13:05: "no repo is exposed ... at 13:05 UTC. 21 repos depend on packages from the compromised account" (lower-case "no", no "yet"). axios (UI scrub, 11 stops, equals the oracle plus billing-api): 00:00-00:21 -> 0 (the first publish is 00:21:58), 00:22 -> 9 (LOCKED 1 / WOULD_PULL 8), 01:30-03:14 -> 10 (1 / 9), 03:15 and after -> 1 (billing-api). At 01:30: LOCKED 1 / WOULD_PULL 9, "+105 min", Analyst pick "2 repos ... through nx: appium/appium and nestjs/nest" replayed and labelled as replayed.

### 4.10 Contradictions between screen, clipboard, export and docs

| Pair | Result |
|---|---|
| Screen vs clipboard (Fix JSON, steps, PR body, Slack message) | 0 differences in 31 repos |
| Screen vs export (rows, tiers, teams, dev/prod, minutes) | 0 differences, qix and axios, filtered and not |
| Verdict window vs Slack window | equal (qix, axios, before and after removal) |
| Ask vs table (prod-only, teams) | equal; **but** after marking and before a re-run Ask still says "Payments 1 repo (one LOCKED: rotate secrets)" while the row shows remediated |
| Screen vs `proof-points.md` | all counts equal; claims "58 to 61" vs 62/62 (3 of 3 default runs); "74 minutes" equals screen, 71 from the alert |
| Header chip "LLM live/template/replay" vs Ask label | consistent; Ask fallback label is the exception (F5) |

## 5. Scores (bar >= 9)

| Dimension | Score | Justification |
|---|---|---|
| Clarity | 8 | The first screen answers exposed or not, where, and what to do in 0.5 s, and the LOCKED sentence is visible at 768 px. Held back by: NOTIFY/DO behind a click and below the pane fold at 768; rotate-secrets is third in the Do line and in the "what first" answer; two Run buttons with different meaning; headline "one install from malware" for 20 repos that npm ci does not touch |
| Speed | 9 | Verdict and table 0.49-0.53 s, copy 0.15 s, drawer 0.25 s, export instant, graph answers 1.3 s, re-run 3.2 s. Cap of 4 follow-ups forces re-runs for a nine-question session |
| Correctness | 8 | Every count, window, fix, path and export row I could check is right: 31/31 clipboard = screen, 21/21 qix and 10/10 axios fixes install, controls fail where they should, scrub matches the oracle at 14 stops. Docked for: wrong priority in the "first hour" answer, AM/PM and ISO times mis-read (1:16 PM -> "no repo is exposed"), Ask answering a different question from the one asked, Ask blind to marks until re-run |
| Trust | 8 | Evidence ids, Cypher, "as of" stamps, honest model label and scope labels on exports are strong. Docked for: green "N of N claims verified" on answers that do not address the question, fallback labelled "Answered from the graph" while saying no model answered, overstated headline, hindsight facts (removal, OSV gap) shown at the 13:16 clock. Round 3: 7 |
| Delight | 8 | Deep links that rebuild the exact view, persistent Undo, honest scrub banners, filter-aware export, "Slack message copied". Missing: one-click per-team notice from the NOTIFY roster (7 notices = 21 drawers or the .md), no run history, follow-up cap |
| Accessibility | 8 | axe 0 in landing, triaged, expanded narrative, Prod only, both drawer tabs, More actions, Ask answer, export menu at both viewports; skip link on Tab 4; focus returns to the row's Fix button; slider has valuetext. One serious violation (20 nodes, `color-contrast` 4.35:1 and 3.5:1) in the scrubbed state, reached by anyone who scrubs |

Overall (mean) 8.2. Blocking-9 items are F1-F7 below: F1 alone moves accessibility to 9; F2, F3 and F7 move correctness and clarity; F4, F5 and F6 move trust.

## 6. Ranked fixes to reach >= 9

**Blocking-9**

1. **Scrubbed (stale) narrative fails WCAG contrast (axe serious, 20 nodes).**
   Repro: alert "qix compromised 13:16 UTC", focus the time slider, ArrowRight x4, wait 2 s (or drag), run axe.
   Saw: `color-contrast` 4.35:1 (#7b7a76 on #121214, 12 px caps labels and the "as of" stamp) and 3.5:1 (#b8443d LOCKED text) because the whole narration gets `opacity-70` (`91-scrubbed-stale-contrast`). Same at 1366x768.
   Expected: 0 violations in every state; dim by weight or a dedicated stale token that keeps >= 4.5:1.
   File: `web/src/components/NarrativePanel.tsx:364` (`stale ? 'opacity-70'`).

2. **Rotate secrets is not first, and "what should I do first" does not answer.**
   Repro: qix 13:16, Ask "what should I do first in the next hour?"; read the verdict's Do line; open acme/checkout-web Fix.
   Saw: 7-team roster, then "1) Keep installing the 20 WOULD_PULL repos ... 2) ... overrides ... 3) For acme/checkout-web: rotate secrets"; drawer STEPS for the LOCKED repo: 1) overrides, 2) rotate secrets, 3) rebuild; at 1366x768 the Do block starts below the Ask bar (`A-F1366-q3`).
   Expected: for LOCKED, "rotate secrets" is step 1 in the verdict, the drawer and the Ask answer; the first-hour answer is a 3-line plan (rotate checkout-web now, notify 7 teams, keep npm ci), roster after it.
   File: `server/agent/narrate.ts:376-380` (step order; the comment at `:278` already says "rotate LOCKED first"), `:349` (repo verdict), `server/tools/registry.ts:263` (drawer steps), `firstFacts` `:279`.

3. **Free-text clock mis-read in both directions.**
   Repro: alert "qix compromised at 1:16 PM"; alert "qix compromised 2025-09-08T13:16:00Z"; alert "qix compromised 13:16UTC".
   Saw: 01:16 UTC, "no repo is exposed ... at 01:16 UTC", 0 / 0 / 21 maintainer; the other two run at 13:30 with "No time in the alert: using 13:30 UTC" although the alert has a time.
   Expected: parse AM/PM, ISO and "HH:MMUTC", or refuse with "I read 1:16 PM as ... confirm"; never answer "no repo is exposed" from a guessed clock without saying how it was read. The banner example should use the incident's own time (axios shows 13:16).
   File: `server/index.ts:249-259` (`fromAlert`, `\b...\b` regex), `web/src/data/clock.ts` (`hasClock`), `web/src/App.tsx:450`.

4. **Overstated headline and hindsight facts.**
   Repro: qix 13:16 triage; read the header and the verdict; compare with the oracle.
   Saw: "21 repos one install from malware" (20 of them are safe on `npm ci`; the legend says so in 11 px at the foot); at the 13:16 clock the verdict states "npm removed them around 15:15 UTC" and the toolbar "+74 min ahead of the advisory" (OSV record 14:26); at 15:30 "1 repo one install from malware" for a removed version.
   Expected: "1 LOCKED, 20 would pull on a fresh install" beside the number; future facts hidden or marked "in hindsight" until the clock passes them; "pins a removed malicious version" after 15:15.
   File: `web/src/components/TimelineScrubber.tsx:151`, `web/src/components/ExecSummary.tsx:70`, `server/agent/narrate.ts:323-324` (`window`, `ahead`).

5. **Ask: fallback mislabelled; natural questions dead-end.**
   Repro: qix 13:16, Ask "Am I affected?", "do I need to notify customers?", any open question while the model is down.
   Saw: label "Answered from the graph", line "Not checked against the graph", text "No language model is available right now, so this question cannot be answered" (2 ms, 5 of 5 tries, 8 questions).
   Expected: label "No answer: the model is unavailable"; best-effort graph fact for "affected/exposed" (summary) and a sentence that the graph cannot know customers; never "from the graph" on a failure.
   File: `server/agent/ask.ts:249-254` (`mode = 'template'`), `web/src/data/narration.ts:130` (`answerLabel`), `ask.ts:122` (`SUMMARY` lacks "affected|exposed").

6. **Ask answers a different question with a green "N of N claims verified".**
   Repro: Ask "Should we pause deployments until the malicious versions are removed?"; "Which exposed repos are the riskiest after checkout-web and why?"; "Explain in plain words why a fresh install is riskier than npm ci"; "Why is mochajs/mocha exposed if its committed lockfile is safe?".
   Saw: a timeline sentence (`removed` matches `WHEN`), only checkout-web (named repo wins over "after"), the rotate paragraph, mocha plus an unrelated checkout-web paragraph (`safe` matches `ROTATE`); each labelled "Answered from the graph", "1 of 1 / 12 of 12 / 20 of 20 verified".
   Expected: a graph answer says which question it answers ("Nearest graph fact: when exposure began") or hands the question to the model; no unrelated second paragraph.
   File: `server/agent/ask.ts:117-140` (`graphAnswer` keyword intents, `questionFilter` `:76`).

7. **Typed alert plus the right-pane Run button.**
   Repro: Describe an alert, type "qix compromised 13:16 UTC", click the primary "Run triage at 13:30 UTC" in the right pane.
   Saw: POST `{"scenario":"qix-2025-09-08","at":1757338200000}`, clock 13:30, the textarea still holds the 13:16 alert, no Alert banner. Two Run buttons visible at once.
   Expected: while the box has text, the pane button runs the alert (or is hidden); one Run action.
   File: `web/src/App.tsx` (`run` uses the committed `alertText`, not the draft; `actions`, `runLabel` `:167`), `web/src/components/ScenarioControl.tsx:141`.

**Nice-to-have**

8. Export report for a lead has no verdict, who-to-notify or do summary at the top; the only "npm ci was safe" sentence is the last line. Axios menu says "The whole report, 10 repos" for a 21-repo org. File: `web/src/data/export.ts`, `web/src/components/ExposureTable.tsx:199`.
9. Ask is blind to marks until a re-run: mark checkout-web, Ask "which team has the most work?" -> "Payments 1 repo (one LOCKED: rotate secrets)". The write is deferred (`web/src/data/useRemediation.ts:2-4`). Either commit on mark or say "marks apply after Run again". History tab shows the tool name ("The recall_triage tool has not returned...") and no run list (`web/src/components/InsightTabs.tsx:191`).
10. No per-team "Copy notice" in the NOTIFY roster (the team chips only open the `route_owners` card); seven notices mean 21 drawers or the .md. The cap of 4 follow-ups costs three re-runs for nine questions.
11. Long Ask answers run under the pinned bar at 1366x768 (first-hour DO block at y 733, bar top 656) and the bar grows after the 4th question (`A-B-q4`). `web/src/components/scrollPane.ts`, `ToolFeed.tsx:324`.
12. Analyst pick names 3 of 4 ("and 1 more", remy/nodemon): `server/agent/narrate.ts:124` (`listed` caps at 3). Baseline wording 74 vs 71 min (r3 #8). Share link drops Prod only and the alert (`App.tsx` `link()`). Failed triage leaves the qix graph and autoplay running (`80-alert-10`). `docs/proof-points.md` claims "58 to 61", screen shows 62/62. Verdict at 13:05 starts lower-case "no repo is exposed" and has no "yet" (`narrate.ts:360`).

## 7. Evidence index (`phase3r4-secops/`)

Screenshots `00`-`99` (landing, run, drawer, Slack links, export menus, scrub stops, mark/undo, Ask `A-*`, failed triage, contrast). Files: `export-{qix1316,axios0130}-{nofilter,prodonly}.{md,json}`, `clipboard-qix-1316.json` and `clipboard-axios-0130.json` (Copy JSON, Slack message, steps, PR body and link for every repo). Scripts and npm run logs are in the scratch folder only.
