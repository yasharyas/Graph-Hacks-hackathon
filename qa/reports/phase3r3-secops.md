# Patient Zero - Phase 3 round 3: on-call AppSec journey

Persona: AppSec on call, alert "qix's npm account was hijacked, 13:16 UTC". Headless Chromium (Playwright), 1440x900 and 1366x768, clipboard read granted, live API on `localhost:5173`. Screenshots and evidence files in `phase3r3-secops/`. No repo file edited, no commit, `.env` not read. Every number below was read from the screen, the clipboard or a downloaded file, not assumed.

## 1. Verdict and overall score

**Overall 8.2 / 10. Not yet 9s; two dimensions (correctness, trust) are the gap.**

Round 2's two P1 Ask failures are fixed: the Ask answers for "rotate secrets / is npm ci safe" and "what should checkout-web do" are now deterministic, graph-sourced and correct 3 of 3 runs. Direct-dependency overrides now install (real npm 11.13 `install --package-lock-only` passes for github/docs, mocha, npm/cli, nodemon, plus checkout-web, appium and the axios uptime-kuma case). The Slack "Details" link now opens the same repo, same Notice tab, same 13:16 clock in a fresh browser (3 of 3). All 21 repos have valid JSON, a Slack message equal to the on-screen text, a path, pins, window and a link (21/21 scripted). Counts match `docs/proof-points.md`: qix 13:30 LOCKED 1 / WOULD_PULL 20 (13 prod), prod-only 14 repos across 6 teams, axios 01:30 LOCKED 1 / WOULD_PULL 9, 105 min. Failed triage no longer leaves a stale "21 repos" header. Speed is excellent (verdict and table 0.55 s after Run).

What still stops me trusting it blindly: (1) the axios Slack message says malicious versions have been "live since 23:59 UTC" while the verdict says 00:21 UTC on 2026-03-31; (2) open-ended LLM answers carry a green "N of N claims verified" badge on wrong or ungrounded prose ("21 exposed repositories across 6 teams" is 7 teams; "dev-only repos ... can still execute arbitrary code during installation" contradicts the tool's own npm ci rule); (3) three ordinary questions ("what do I tell my CISO", "do I need to notify customers", "which team has the most work") all return the same team roster labelled "Answered from the graph"; (4) the answer to any follow-up lands half hidden under the pinned Ask bar; (5) the export ignores the Prod-only filter and its team Notices still produce `EOVERRIDE` for the four direct-dependency repos.

## 2. Timed friction log

Scripted, 35 ms/char typing. Human typing adds 3-5 s (paste about 1 s). Times are from the click on Run unless noted.

| T+ | Step | What happened | Shot |
|---|---|---|---|
| 0.5 s | Page load | Interactive | `00-landing` |
| 1.9 s | Type "qix compromised 13:16 UTC" (25 chars) | Textarea accepts; placeholder is the same sentence | `02-alert-typed` |
| +0.26 s | Run | First tool card (`find_target`) | `03-run-300ms` (header already 21 / LOCKED 1 / WOULD_PULL 20, table still "No exposures yet") |
| **+0.55 s** | **First actionable view** | Header 21, tiers, table of 21 with tier/path/team, verdict text. Round 2: 1.3 s | `03-run-800ms`, `03-run-1500ms` |
| +1.6 s | "Triage complete: 50 tools", "61/61 claims traced" | Done | `03-run-4000ms` |
| +click | "Show the rest: who to notify and the steps" | NOTIFY (7 teams) and DO (3 steps) are behind this click; verdict clamped at 1366x768 | `04-show-rest`, `60-1366-verdict` |
| +0.5 s | Prod only | "14 of 21 shown", pressed state, 14 rows | `08-prod-only` |
| 0.5 s | Open Fix drawer | Path, pins, overrides, steps, PR body; Copy fix / Mark remediated at the bottom | `09-drawer-checkout-fix` |
| <0.3 s | Copy fix, Notice tab, Copy message | Clipboard equals screen (21/21) | `10`-`13` series |
| 3.8 s | Slack link in fresh context | Same repo, Notice tab, 13:16 clock, narrative rebuilt | `15a`-`15c` |
| instant | Export .md (34 KB) and .json (63 KB) | 21 rows; same file with or without Prod-only | `16-export-menu`, `export-qix-1316-prodfilter-on.*` |
| 4.3 s | Mark 2 repos, Run again | Chip "2 marked remediated", verdict "19 repos ... Marked remediated" | `21`, `22` |
| 0.75-0.9 s / 1.9-3.2 s | Ask: graph answers / LLM answers | Fast; answer sits under the Ask bar | `A-ask-q1`, `64-1366-ask-answer-noscroll` |
| per minute | Scrub 13:11 to 15:30 | Table, header and banner agree at every stop | `30-scrub-*` |
| 1.6 s | axios 01:30 triage | LOCKED 1 / WOULD_PULL 9, "+105 min" | `41-axios-triage` |

Console: no `pageerror`, no app `console.error`. Only `ERR_ABORTED` on superseded `/api/timeline|triage|exposure` fetches, plus the expected `400` (and the browser's own "Failed to load resource") for the unknown-account alert.

## 3. Round-2 items

| Item (round 2) | Status | Evidence |
|---|---|---|
| 1 (P1) Ask "rotate secrets, is npm ci safe for the rest" wrong | **Fixed** | 3 of 3 runs: "Rotate secrets for the 1 LOCKED repo: acme/checkout-web ... For the other 20 ... npm ci is safe", "Answered from the graph" (`R1`-`R3-ask-q1`) |
| 1b Flagged-claim clutter "(not returned by any graph query)" | **Partly** | Gone from graph answers. LLM answers still show a struck-through token and "7 of 8 claims traced · 1 flagged" (`O2-ask-q1`); honest, still cluttered |
| 2 (P1) "what should checkout-web do" says only overrides | **Fixed** | 3 of 3: LOCKED, rotate secrets, rebuild, overrides, "12 of 12 verified" (`R1-ask-q2`) |
| 3 (P2) Overrides JSON throws `EOVERRIDE` for 4 direct-dep repos | **Partly** | **Fixed** in Fix tab, Copy fix, Slack message, PR body: JSON now carries a `dependencies` pin; npm 11.13 passes for github/docs, mocha, npm/cli, nodemon, checkout-web, appium, axios uptime-kuma. **Not fixed** in the export's team Notices, which say only "override debug@4.4.2 -> 4.4.1"; negative control `EOVERRIDE: Override for debug@^4.3.5 conflicts with direct dependency` |
| 4 (P2) Remediation not reflected | **Partly** | Header chip "· 2 marked remediated", panel "Marks are saved for this browser session only", verdict "WOULD_PULL, 19 repos ... Marked remediated: ...", row strike-through with "01:54 GMT+5:30" (zone added), marks survive reload and new tab (`21`, `22`, `25`). Still: header LOCKED 1 / WOULD_PULL 20 and "21 of 21 exposed" unchanged; Undo lasts about 10 s (count 1 at 0 s, 0 at 12 s); a reopened drawer has no Undo or "mark open" (`24`); fresh browser shows LOCKED again (disclosed) |
| 5 (P2) Export lives only in drawer; Notices lack tier, path, pins | **Partly** | Export is now a table-toolbar button; menu "Report (.md) / (.json)" (`16`). `.md`/`.json` match table: 21 rows, 14 prod / 7 dev, tiers, teams (0 mismatches), 74 min. Notices: team-level, tier present, dev tagged, no path, wrong "via" range, no root-dep step; ignores Prod-only filter |
| 6 (P2) Failed triage keeps "21 repos" header | **Fixed** | Header "–", "no result: the triage did not run", LOCKED – / WOULD_PULL – (`70`, `71`). Residue: stale qix graph behind the error; right pane offers "Run triage at 13:30 UTC" |
| 7 (P2) WOULD_PULL drawer: 16 safe-pin lines push Fix below fold | **Fixed** | "+13 more" collapse; Fix tab and Copy fix visible at 1366x768 (`62`, buttons at y 716-752 of 768) |
| 8 (P3) Slack "Details" link opens 13:30, no drawer | **Fixed** | Link `...&at=1757337360000&repo=...&open=notice`; fresh context opens drawer, Notice tab, 13:16 for 3 of 3 repos |
| 9 (P3) "+74 min" truncated, from first publish | **Not fixed** | Still "+74 min ahead" and "graph showed this 74 minutes before"; 74.68 truncated, from 13:12:10 publish; from the 13:16 alert it is 71. Matches `proof-points.md` |
| 10a No-time alert silently uses 13:30 | **Fixed** | Banner "No time in the alert: using 13:30 UTC, the scenario default. Add one, like 13:16 UTC." (`07`) |
| 10b 82 Tab presses to Prod only | **Partly** | 83 Tabs raw. Skip link "Skip to exposure table" then 3 Tabs (`50`); skip links exist for results, table, Ask |
| 10c 4-follow-up cap | **Not fixed** | "Follow-up 4 of 4", then "Follow-ups used up"; Run again resets |
| 10d Analyst pick names 3 of 4 | **Not fixed** | "(github/docs, mochajs/mocha, npm/cli and 1 more)" even expanded; remy/nodemon unnamed |
| 10e NOTIFY/DO need a scroll | **Regressed (first glance)** | Now behind a "Show the rest" click, so not visible until opened; at 1366x768 verdict clamps at "LOCKED, 1..." (`60`) |
| 10f Clipped "Filter repo or te" | **Fixed** | Placeholder "Repo or team" |
| 10g "1 repos" | **Fixed** | "1 repo", "1 of 21 exposed" at 15:30 |
| Verified OK in round 2: step order, valid override syntax, no repo called "compromised", axe 0, focus returns | **Still OK** | axe 0 violations main and drawer; Esc and Close return focus to the row's Fix button; Slack text names repo, tier, path, pins, window, link |

## 4. Scores (bar >= 9)

| Dimension | Score | One line |
|---|---|---|
| Clarity | 8 | Strong table, drawer and banners; but NOTIFY/DO are one click away, the verdict clamps mid-sentence on a 768 laptop, answers hide under the Ask bar, "as of" stamp splits the first sentence |
| Speed | 9 | Verdict and table 0.55 s after Run, full 1.6 s, graph answers under 1 s, LLM 2-3 s |
| Correctness | 8 | Every count and all 21 fixes check out against the docs and real npm; but axios window 23:59 vs 00:21, "have been live" after removal, export Notices EOVERRIDE and wrong "via" range, export ignores filter |
| Trust | 7 | Evidence ids, Cypher, "as of" stamps and the assumed-time banner are excellent; but green "N of N verified" on wrong or ungrounded LLM prose, mis-routed questions labelled "from the graph", 71 vs 74 min |
| Delight | 8 | Deep links, scrub banners, per-repo Slack, row strike-through; Undo gone in 10 s, answers need scrolling |
| Accessibility | 9 | axe 0 on main and drawer, three skip links, focus returns, pressed state, slider has valuetext; nit: 83 raw Tabs |

## 5. Ranked fixes to reach >= 9

**Blocking-9**

1. **Axios Slack "Window" is wrong and undated.**
   Repro: axios scenario, Run at 01:30, open `louislam/uptime-kuma` (or `acme/billing-api`) Fix, Notice tab, Copy message.
   Saw: "Window: malicious versions have been live since 23:59 UTC." Verdict says "since 00:21 UTC on 2026-03-31"; 23:59 is the `plain-crypto-js` publish on 2026-03-30 (JSON: `firstPublishAt` 23:59:12Z, `firstExposureAt` 00:21:58Z).
   Expected: the same start as the verdict, with the date. Also past tense once removed: qix re-triaged at 15:30 still says "have been live since 13:12 UTC" though removal was 15:15 (`33`).
   File: `web/src/data/export.ts:110` (uses `incident.firstPublishAt`; use `firstExposureAt`, add date, branch on `removedAt`).

2. **Green "verified" badge on wrong or ungrounded LLM answers.**
   Repro: qix 13:16, Ask "how bad is this?" -> "21 exposed repositories across 6 teams" (route_owners says 7; 24 of 24 verified). Ask "can I ignore the dev-only repos?" -> "No, because malicious packages ... can still execute arbitrary code during installation" (2 of 2 runs, 7 of 7 verified; contradicts the tool's rule that npm ci from the lockfile was safe). Ask "what should I do first in the next hour?" -> omits rotate secrets (3 of 3 LLM runs), says "Use draft_remediation" (tool name leaks).
   Expected: counts checked against the evidence, no claims about install-time code execution, secrets rotation always present for LOCKED, plain words not tool names; badge wording "names found in the graph" rather than "claims verified" when prose is unconstrained.
   File: `server/agent/ask.ts` (prompt and claim check), `web/src/data/narration.ts` answerLabel.

3. **Ordinary questions mis-routed to the NOTIFY roster.**
   Repro: Ask "what do I tell my CISO in two sentences?", "do I need to notify customers?", "which team has the most work?" -> all return the 7-team roster, "35 of 35 claims verified", "Answered from the graph".
   Expected: a two-sentence briefing; "the graph cannot tell you that"; a per-team count (CLI 5, Platform 4, QA 4).
   File: `server/agent/ask.ts:117` (`NOTIFY` regex catches `tell|team|notify`).

4. **Follow-up answers land under the Ask bar.**
   Repro: 1366x768 or 1440x900, Ask any question.
   Saw: pane scrolls to the end of 50 tool cards; "YOU ASKED" visible, answer text clipped by the pinned input (`64-1366-ask-answer-noscroll`, `A1-ask-q1`).
   Expected: answer scrolled to the top of the pane (account for the sticky Ask bar height).
   File: `web/src/components/scrollPane.ts`, `AskBox.tsx`.

5. **NOTIFY / DO hidden; verdict clamped.**
   Repro: 1366x768, any qix run.
   Saw: verdict ends "LOCKED, 1..." (the secrets-rotation sentence is cut); who-to-notify and the steps need "Show the rest".
   Expected: when LOCKED > 0, keep the LOCKED sentence and a one-line "Notify 7 teams" visible without a click.
   File: `web/src/components/NarrativePanel.tsx:221` (line-clamp by viewport height), `:308`.

6. **Export: filter ignored; team Notices unsafe for direct-dep repos.**
   Repro: Prod only, Export .md/.json -> byte-identical to the unfiltered export (34021 / 63090 bytes), 21 exposures vs 14 shown, no statement of scope. In Notices, github/docs, mocha, npm/cli, nodemon say only "override ... -> ..." (npm `EOVERRIDE`, reproduced). "via ^6.1.0" for Kong/insomnia's `debug@4.4.2` (path says `^4.3.4`); npm/cli "via ^7.0.1" (path `^5.4.1`).
   Expected: honour the filter or label "Whole report (21 repos)"; add the root-dependency step; cite the range of the first named version; include path; order rows as the table.
   File: `server/agent/triage.ts:147` (`e.ranges[0]` is not the range of `versions[0]`), `web/src/data/export.ts`.

**Nice-to-have**

7. Undo for "Mark remediated": 10 s only; reopened drawer has no Undo. Add "Mark open" in the drawer and row (`web/src/components/FixDrawer.tsx:291`).
8. Baseline wording: "+74 min" and "The graph showed this 74 minutes before" - 74.68 truncated, from first publish; at the 13:16 alert it is 71. Say "74 min after first publish, 71 from the alert" (and keep `proof-points.md` aligned).
9. Post-removal wording: at 15:30 the header still says "1 repo one install from malware" though the versions left npm at 15:15. Say "1 repo pins a removed malicious version".
10. Headline "21 repos one install from malware" beside "npm ci was safe" for 20: add "1 locked, 20 would pull on a fresh install" next to the number; open the chip total "19 open, 2 remediated" after marking.
11. Polish: "as of 13:16 UTC" floats into the first sentence of the verdict; "Fix copied" persists on the Notice tab; share link drops Prod only and the alert text; failed triage leaves the old qix graph; Analyst pick should name all 4 repos (remy/nodemon missing); 83 raw Tabs; `proof-points.md` says "58-60 of 58-60 claims" while the page shows 61/61.
