# Phase 3 round 6 QA: OSS maintainer persona

Headless Chromium (playwright-skill) at 1440x900, 1280x720 and 1366x768 against Vite dev http://localhost:5173 (all journeys) and the production build http://localhost:8080 (parity runs), 2026-10-16. npm 11.13.0 / Node 24.16 for the fix checks, axe-core for accessibility, GitHub raw and `npm view` for ground truth. About 60 UI analyses across 13 repos, 12 files/pastes, both incidents; 18 fresh-context share round trips (12 dev, 6 prod). Screenshots: `qa/reports/phase3r6-dev/` (about 150 files). Scripts and temp npm projects only in my own scratch folder `scratchpad/r6dev/`. No repo file edited, no commits, `.env` not read.

## 1. Verdict

Round 5's biggest complaints are fixed, and I checked them against real npm, not the text:

- **The verdict now leads with the plain answer.** "mochajs/mocha was safe if installed from your committed lockfile, which pins ... Only a fresh install between 13:12 UTC and 15:15 UTC on 2025-09-08 would have fetched debug@4.4.2 ...". The hero strip says "npm ci is safe". The hindsight is labelled ("In hindsight: ... npm removed the malicious versions around 15:15 UTC"). At a 15:45 clock the verdict explains the window instead of going silent ("The malicious versions were removed around 15:15 UTC; to check the window itself, run at a clock between 13:12 UTC and 15:15 UTC").
- **The Fix tab leads with "Today, in hindsight: ... today npm ci needs no change"**, bold, as the first callout. It now has a section "Checked against today's package.json" and a "Before you paste:" line pinned next to Copy JSON. It caught both round-5 problem cases: axios/axios ("Today's package.json no longer declares chalk: skip its pin") and uptime-kuma/axios ("declares axios ~0.33.0, which no longer admits 0.30.4: skip ... Before you paste: skip all of it").
- **Renamed repo: fixed.** `visionmedia/mocha` is judged on the real pre-incident snapshot (5f8e8a8, the same commit as mochajs/mocha), not "no lockfile was available". It no longer says "counterfactual".
- Still holding: 7 of 7 snapshot commits identical to round 5 (5f8e8a8, 533ad9c, d03f245, cd9f83c, 0902502, df23942, 661f349; socket.io c714492 is new and plausible), 18 of 18 shares reproduce the same verdict in one click, 0 console errors or warnings in about 60 runs, axe 0 violations in 13 states, prod build gives the same verdicts and the same Copy JSON as dev.

It is still not a 9. The remaining problems are narrower but two of them are new or misleading:

1. **The "Checked against today's package.json ... still match this fix" tick is false assurance for mocha, nodemon and kuma-qix.** The check only looks for removed direct dependencies and overrides whose bad version today's range no longer admits. It never compares the snippet's direct pin to your declared range. Merged into real HEAD, mocha's `debug ^4.3.5` becomes the exact `4.4.1` and the lockfile downgrades (debug 4.4.3 -> 4.4.1, ansi-styles 6.2.3 -> 6.2.1, nested ansi-regex 6.4.0 -> 6.2.0, strip-ansi 7.2.0 -> 7.1.0), under a green tick.
2. **The Notice tab regressed.** It is back to in-window language ("still live at 13:30 UTC", "Do: Keep npm ci on the committed lockfile and add the pin if you resolve fresh", and for kuma/axios "Also set ... axios@0.30.3"), which contradicts the Fix tab's "nothing to change today" and "skip all of it". Round 5's Notice said "Nothing to change".
3. **The pnpm/yarn primary command fails.** The one-liner shown first, with a Copy button, is `npm install --package-lock-only`; it errors on all three example repos (vuejs/core `catalog:`, next.js `workspace:`, react ERESOLVE). The caveat is hidden in a collapsed disclosure and covers only `workspace:`.
4. **"Run again" is clipped at 1280x720 for mochajs/mocha** (right edge 1305 of 1280; round 5 was fine at 1256). Long verdict still ~90 words, pin list still incomplete.

**Overall: 8.7 / 10** (clarity 8.5, speed 9, correctness 8.5, trust 8.5, delight 9, accessibility 8.5). Up from 8.6. Not at the 9 bar on four dimensions.

## 2. Timed friction log (fresh browser, scripted, dev)

| T+ (s) | Step | What happened | Evidence |
|---|---|---|---|
| 0.77 | Land | "Paste your repo" CTA visible; dated clock; tiers glossed ("lockfile pins it", "a fresh install fetches it"). Demo org still fills the fold ("0 repos one install from malware, Acme demo org"). | `01-landing-fold.png` |
| 0.79 | Keyboard | 5 Tab presses to the CTA. | |
| 0.89 | Click CTA | Panel open, field focused. | `02-paste-panel.png` |
| 1.31 | Typed `mochajs/mocha` | 15 ms/char. | |
| 2.04 | Verdict | 0.73 s after Enter (server-warm). Fresh first analyses in the same session: mocha 3.7, nodemon 4.2, axios/axios 2.9 / 3.9, kuma 2.9 / 2.0, renamed 3.0 / 2.4, socket.io 2.3 (never analysed before). Prod build 0.6 to 4.1. | `mocha-qix-01-result.png` |
| +0.25 | Open Fix | 247 ms. | `mocha-qix-03-fix.png` |
| +0.6 | Copy JSON | Toast "package.json snippet copied"; clipboard is parseable JSON. | |
| +0.4 | Esc | Drawer closes, focus returns to the Fix button. | |
| +0.57 | Share | Link copied (`...&guest=mochajs/mocha`). | |
| 0.28 to 0.63 | Fresh context, open link, click "Re-check" | 18 of 18 reproduce the same verdict sentence (12 dev, 6 prod). One click needed. First screen is still the demo org (21 repos) behind the banner. | `mocha-qix-06-share-fresh-before.png` |
| 0.3 to 1.6 | Switch qix <-> axios, same pasted repo | Auto re-judges against a different snapshot, both ways, for mocha, kuma and a pasted lockfile (0.3 to 1.6 s). | |
| 0.3 to 0.9 | Lockfile chooser / drop onto panel | 0.3 to 0.9 s. Real Ctrl+V of a 375 KB lockfile: 0.8 to 1.5 s, auto-runs. A pasted repo URL does not auto-run (needs Enter). | `drop-own-lock.png` |
| 0.011 to 0.019 | Client-side errors | Inline in the panel, focus stays in the field. | `err-hello-world.png` |
| 0.4 to 2.4 | Server-side errors | Alert in panel, working Copy command, sample chips. | `err-expressjs-express.png` |
| 0.1 | Busy (4 simultaneous) | "Another repo is being analyzed right now. Try again in a few seconds." for 3 of 4. | `busy-alert.png` |

Reliability: 0 transient failures, 0 "analysis has expired", 0 console errors. One environmental event: the server's unauthenticated GitHub quota (60/h from this IP) ran out partway through; see section 6.

## 3. Results by input

| Input | Result | Plain and correct? Which lockfile? Understandable path? Next step? |
|---|---|---|
| mochajs/mocha (qix) | WOULD_PULL | Verdict leads "was safe if installed from your committed lockfile"; snapshot 5f8e8a8 (2025-09-01) shown in the caption, hero and Fix. WHY "declares ^4.3.5, which admits debug@4.4.2 [E1]". Fix: "today npm ci needs no change". Pin list omits debug@4.3.4. |
| remy/nodemon (qix) | WOULD_PULL | 533ad9c (2023-12-01). Same shape. Lists chalk@4.1.2 (not the affected major) as a pin. |
| axios/axios (qix) | WOULD_PULL, "dev only" | d03f245 (2025-09-04). Fix flags the chalk pin as "skip" (correct). Pin list omits chalk@5.2.0. |
| axios/axios (axios) | CLEAN | 0902502 (2026-03-28). "is not exposed to the jasonsaayman account compromise (the axios maintainer) ... no malicious version is in its lockfile or admitted by its declared ranges." No Fix button (correct). |
| louislam/uptime-kuma (axios) | WOULD_PULL | df23942 (2026-03-06); pins axios@0.30.3 and 1.13.2. Fix says "skip all of it" (correct: HEAD is `~0.33.0`). |
| louislam/uptime-kuma (qix) | WOULD_PULL via @typescript-eslint/eslint-plugin@6.21.0 -> ^4.3.4 -> debug@4.4.2 | cd9f83c (2025-08-30). Pin list omits debug@4.3.7 and 4.3.4. Fix says "still match" while the snippet downgrades 7 packages and adds 2 (F1). |
| mochajs/mocha (axios) | CLEAN, 661f349 (2026-03-29) | Correct. |
| visionmedia/mocha (renamed) | Same as mochajs/mocha, both incidents | Reads the new repo's snapshot (5f8e8a8 / 661f349). Name stays `visionmedia/mocha`; nothing says it now lives at mochajs/mocha (F8). |
| socketio/socket.io (qix, never seen before) | WOULD_PULL | c714492 (2025-09-04); same shape. Share reproduces. |
| vuejs/core, vercel/next.js (pnpm), facebook/react (yarn) | Alert | Names the tool, 2 lines visible plus a collapsed "How to check it by hand" with the right malicious versions per incident. The visible Copy command fails on all three (F5). |
| expressjs/express (no lockfile) | Alert | "No package-lock.json at the root of expressjs/express. Generate one and drop it here." + working Copy (`npm install --package-lock-only`) + "How to generate it". Yes. |
| lodash/lodash (lockfileVersion 1) | Alert | "Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install with npm 7 or newer to upgrade it." Yes (I checked: `npm install --package-lock-only` upgrades a v1 lockfile to v3). |
| `github.com/foo`, `hello world`, `mochajs`, `https://github.com/axios` | Inline | "That is missing the owner or the repo name ..." / "That is not a repo address ..." in 11 to 19 ms. Yes. |
| gitlab.com, example.com, `javascript:alert(1)` | Inline | "Only github.com repos can be analysed. Use a public GitHub repo like owner/name ..." Yes, nothing injected. |
| nonexistentorg123/doesnotexist-repo | Alert | "github.com/... is not a public repo. Check the spelling, or paste its package-lock.json below if the repo is private." + chips. Yes. |
| `git@github.com:remy/nodemon.git` | Resolves | Right repo and snapshot. |
| This repo's package-lock.json (chooser and drop) | CLEAN, labelled counterfactual | "Counterfactual: this checks the lockfile you pasted as if it had been committed on 2025-09-08 ... would not have been exposed". "No path" pane now plain ("Nothing in your pasted lockfile (patient-zero) reaches a malicious version from the qix npm account takeover at this clock"). Share toast: "A dropped lockfile can't be shared: it exists only in this tab ... Share the repo's URL, or send the file." |
| Tiny v1 lockfile; broken JSON; empty; text; package.json; yarn.lock | Alert | Each says what it is and what to do ("That is a package.json, not a lockfile. In the project run npm install --package-lock-only ...", "yarn and pnpm lockfiles are not supported yet ..."). 390 to 510 ms. |
| Handmade v3: debug@4.4.2 / chalk@5.6.1 dev / axios@1.14.1 + plain-crypto-js | LOCKED | "LOCKED for the qix account compromise: the lockfile itself pins the malicious version debug@4.4.2, so rotate secrets and rebuild." Fix: "npm ci on a lockfile that pins one can no longer fetch it. Re-resolve ..." Correct. |
| Handmade v3: debug ^4.3.5 pinned 4.3.5 | WOULD_PULL | "would have been safe if installed from that lockfile, which pins debug@4.3.5." Correct. |

## 4. Fix snippet verification (real npm 11.13, merged into each repo's real HEAD package.json)

Method: `curl` HEAD package.json, merge the Copy JSON keys the way the drawer instructs, `npm install --package-lock-only --ignore-scripts`, diff against the same run on the untouched package.json (`scratchpad/r6dev/verify.cjs`, `npm-*.json`).

| Repo / incident | Exit | EOVERRIDE | Malicious in lock | What the snippet does to HEAD | Did the UI warn? |
|---|---|---|---|---|---|
| mochajs/mocha / qix | 0 | no | none | `debug` `^4.3.5` -> exact `4.4.1`; lock: debug 4.4.3 -> 4.4.1, ansi-styles 6.2.3 -> 6.2.1, nested ansi-regex 6.4.0 -> 6.2.0, strip-ansi 7.2.0 -> 7.1.0 | **No.** Green "its direct dependencies still match this fix". Only the generic "even one that would otherwise resolve a newer safe version". |
| remy/nodemon / qix | 0 | no | none | `debug` `^4` -> `4.4.1`; debug 4.4.3 -> 4.4.1, error-ex 1.3.4 -> 1.3.2, marked-terminal's chalk 5.6.2 -> 5.6.0 | **No** (same green tick). |
| axios/axios / qix | 0 | no | none | Adds `devDependencies.chalk 5.6.0` (HEAD has none); 6 downgrades (debug, error-ex, nested ansi-regex/strip-ansi x2); 5 packages added, 1 removed | **Yes for the chalk pin** ("no longer declares chalk: skip its pin", plus the footer). Following that advice (overrides only): exit 0, no chalk added, same 6 downgrades, 3 nested debug copies added; the downgrades are not mentioned per entry. |
| louislam/uptime-kuma / qix | 0 (`--legacy-peer-deps`) | no | none | 7 downgrades (debug 4.4.3 -> 4.4.1, error-ex, nested ansi-*), 2 packages added | **No** (green tick). |
| louislam/uptime-kuma / axios | 0 (`--legacy-peer-deps`) | no | none | `axios` `~0.33.0` -> 0.30.3 (lock 0.33.0 -> 0.30.3), wait-on's axios 1.20.0 -> 1.14.0, 2 packages removed | **Yes**: both overrides flagged "skip" and "Before you paste: skip all of it". |
| visionmedia/mocha (renamed, merged into mochajs/mocha HEAD) | 0 | no | none | Same as mocha | No (same green tick). |
| mochajs/mocha, overrides only (no direct pin) | **1** | **EOVERRIDE** "Override for debug@^4.3.5 conflicts with direct dependency" | n/a | n/a | The drawer's sentence "npm rejects an override that conflicts with a direct dependency" is true, so the direct pin is genuinely required for a replay. |
| Handmade LOCKED debug / chalk dev / axios | 0 (round 5) | no | none | Intended re-resolve | Yes ("Re-resolve to a clean release ..."). Wording unchanged this round. |

Every copied snippet is parseable JSON, resolves in real npm and leaves no malicious version. Every one downgrades safe packages; the UI warns per entry only when a pin refers to something HEAD no longer declares or no longer admits (2 of 5 repo/incident pairs). Also confirmed: `npm view debug@4.4.2`, `axios@1.14.1`, `axios@0.30.4`, `chalk@5.6.1`, `plain-crypto-js@4.2.1` all E404, so "npm removed the malicious versions" is true.

## 5. Round-5 items

| Round-5 item | Status | Evidence |
|---|---|---|
| F1 verdict: answer first, one clock, right tense | **Mostly fixed** | Leads "was safe if installed from your committed lockfile"; hindsight labelled; 15:45 clock explains the window. Residual: still 88 to 96 words, the 7 to 10 item pin list sits before the sentence that explains the exposure, the OSV-timing tail remains ("No OSV record exists yet at 13:30 UTC. In hindsight: it came at 14:26 UTC, 74 minutes after ..."), the caption "Its package-lock.json at commit ..." is a dangling pronoun above the repo name, and "nothing to change today" is not in the verdict itself (it is in the hero and Fix). |
| F2 renamed repo reason, follow the new name | **Fixed** (judgement), residual (name) | visionmedia/mocha judged on 5f8e8a8 / 661f349, no counterfactual label. The display name stays `visionmedia/mocha`; no "now mochajs/mocha" note. |
| F3 Fix tab checked against today's package.json; Copy JSON warns per entry | **Partly** | New "Checked against today's package.json" block and a "Before you paste" footer; right for axios/axios and kuma/axios. Missing: direct pin vs declared range (mocha, nodemon: `^` -> exact, still "match"), no per-entry annotation in the copied JSON (the clipboard JSON is unchanged, axios/axios still copies the chalk pin), downgrade of transitives only in generic words. |
| F4 stale-tense strings in Copy steps and Copy PR | **Partly** | PR text now "They only matter while the malicious versions are on npm." (neutral). Copy steps step 2 reads "(in hindsight, it closed at 2025-09-08 15:15Z) ... and can come out once the window has closed" (still self-contradicting). Copy steps and Copy PR carry none of the "skip" warnings the drawer shows: for kuma/axios Copy steps still says "set axios to 0.30.3 in package.json's dependencies too" while the drawer says skip all of it. Notice tab and Whole report (.md) say "(still live at 13:30 UTC)". |
| F5 pin list incomplete | **Not fixed** | mocha omits debug@4.3.4; axios/axios omits chalk@5.2.0; kuma qix omits debug@4.3.7 and 4.3.4; nodemon lists chalk@4.1.2 (not the affected major). None omitted is malicious; "which pins ..." reads exhaustive. |
| F6 pnpm/yarn dead end | **Partly** | Visible text is now 2 lines + collapsed "How to check it by hand" (75 to 89 words total, was 80+). The visible Copy command `npm install --package-lock-only` fails on vuejs/core (EUNSUPPORTEDPROTOCOL `catalog:`), vercel/next.js (`workspace:`), facebook/react (ERESOLVE); the caveat is only in the collapsed text and does not mention `catalog:`. |
| F7 residual jargon and glue | **Partly** | "RAT dropper" gone from the No-path pane; "pasted/patient-zero" still in the table and verdict ("pasted/tiny-range would have been safe"); WOULD_PULL / MAINTAINER on the strip, "(the axios maintainer)", "@HEAD" in the fallback, duplicate hero "your pasted lockfile ..., a counterfactual" remain. |
| F8a shared link lands on demo org | **Unchanged** | "21 repos one install from malware" behind a banner with a one-click Re-check. |
| F8b panel hint overflow | **Not fixed** | "Will analyze https://github.com/nonexistentorg123/doesnotexis..." still runs past the panel and the 1440 px viewport edge and is cut (`err-nonexistentorg123-doesnotexist-repo.png`). |
| F8c 38 Tab stops to Fix | **Unchanged** (40) | Skip link exists. |
| F8d Esc + incident switch within 150 ms | **Not retested** | Not reachable by a human. |
| F8e 100 KB synthetic fill | **Not retested** | Real Ctrl+V of 375 KB: 0.8 to 1.5 s. |
| R4/R5 provenance, share banner, share reproduces, expiry, console | **Holding** | 7 of 7 commits identical to round 5, 18 of 18 shares, 0 expiries, 0 console messages, prod parity. |

## 6. New findings this round

1. **Notice tab regression** (see F2 below). Round 5: "Window: ... until npm removed them around 15:15 UTC", "Do: Nothing to change". Round 6: "Window: malicious versions live since 13:12 UTC on 2025-09-08 (still live at 13:30 UTC). Do: Keep npm ci on the committed lockfile and add the pin if you resolve fresh."
2. **"Run again" clipped at 1280x720** for mochajs/mocha: button right 1305 of 1280, "Run agai" visible (`mocha-720-01-result.png`). kuma 1266, lockfile 1275 to 1280 (touching the edge). 1366x768 is fine (1342). The hero strip got wider with "npm ci is safe".
3. **GitHub fallback.** At about 04:26 UTC the unauthenticated GitHub API quota for this machine was 0 of 60. Fresh repos (and the prod server's kuma and axios/axios) fell back, honestly: "Counterfactual: GitHub's commit history could not be read just now, so this checks today's lockfile; try again later for the lockfile as it was" with hero "today's lockfile, a counterfactual" and a COUNTERFACTUAL strip. After the reset (04:42) the same inputs returned the real snapshot (so the fallback is not cached). Two residual problems in the fallback: the Fix drawer still says "as it stood at the incident" about today's lockfile, and the name reads `axios/axios@HEAD` (`p8080-axiosqix-01-result.png`, `dotenv-qix-03-fix.png`). Ops note: if the deployed server has no GitHub token, it degrades to this fallback after about 30 analyses an hour (I cannot see `.env`).
4. **Hero strip reads contradictory at a glance.** Big "1 repo one install from malware," then small "npm ci is safe". The plain answer is the small part.
5. **"Mark remediated" on a repo that needs no change** works ("Marked remediated. You can undo it here.") but invites the wrong action for a "nothing to do today" result.

axe-core: 0 violations in 13 states (landing, panel, client error, pnpm server error, result, Fix drawer, Notice tab, steps expanded, share-banner landing, 1280x720 LOCKED lockfile). Focus: stays in the field after errors, goes to the result section after a verdict, returns to Fix after Esc, Enter on a keyboard-reached Fix opens the drawer with focus on Close, Copy JSON 3 Tab stops away; 40 Tab presses from the verdict to Fix.

## 7. Scores (bar >= 9; honest)

| Dimension | Score | Why, and what blocks 9 |
|---|---|---|
| Clarity | 8.5 | The verdict now answers the question in its first clause, the Fix tab leads with "nothing to change today" and a visible check, renamed repo and pasted-lockfile pane read plainly, 15:45 clock explained. Blocked by: ~90-word verdict with a long pin list and OSV tail, Notice tab contradicting the Fix tab, hero strip headline "1 repo one install from malware" over "npm ci is safe", WOULD_PULL / counterfactual / @HEAD jargon. |
| Speed | 9 | Landing to verdict 2.0 s warm, 2.3 to 4.2 s fresh; lockfile 0.3 to 0.9 s; switch 0.3 to 1.6 s; Re-check 0.3 to 0.6 s; client errors 11 to 19 ms; 0 failures. |
| Correctness | 8.5 | 7 of 7 snapshots exact, renamed repo follows the new name, every snippet resolves in real npm with no malicious version and the "npm rejects an override that conflicts with a direct dependency" claim is true, "bad versions are gone" true. Blocked by: "still match this fix" tick while the snippet rewrites `^4.3.5` / `^4` to `4.4.1` and downgrades the lock (3 of 5 pairs), clipboard JSON not annotated, pin lists still incomplete (mocha, axios/axios, kuma), Copy steps contradicts the drawer for kuma/axios. |
| Trust | 8.5 | Honest fallback labels (and not cached), honest share banner, 18 of 18 share reproductions, 0 console errors, traced-claims badge. Blocked by: the false green tick, Notice tab saying "add the pin" and "still live" against "nothing to change", the pnpm command that fails, "as it stood at the incident" on a today's-lockfile fallback. |
| Delight | 9 | "Before you paste" footer next to Copy JSON, skip notes in plain words, one-click share and Re-check, instant incident switch, lockfile drop/paste auto-runs, working Copy on every command, SSH/.git/query URLs accepted, precise file-type errors. Held at 9 (not higher) by the pnpm dead end and Re-check not automatic. |
| Accessibility | 8.5 | axe 0 violations in 13 states, focus handled on every transition, slider text correct. Blocked by: "Run again" clipped at 1280x720 for the headline example (regression from round 5), the panel hint still cut at the viewport edge for long repo names, 40 Tab stops to Fix. Not tested: screen reader, forced colours, phone (own agent). |

## 8. Ranked fixes to reach >= 9

**F1 (blocking-9: correctness, trust). The "still match" check ignores the direct pin versus your range.**
Repro: `mochajs/mocha` (qix) > Fix. Also `remy/nodemon`, `louislam/uptime-kuma` (qix). Saw: green "Checked against today's package.json: its direct dependencies still match this fix." above a snippet that sets `"debug": "4.4.1"` over HEAD's `^4.3.5` (nodemon `^4`); merged into HEAD and run with npm 11.13: debug 4.4.3 -> 4.4.1, ansi-styles 6.2.3 -> 6.2.1, nested ansi-regex / strip-ansi down, kuma +2 packages. Expected: compare each direct pin with the declared range ("your package.json says ^4.3.5; this pins 4.4.1, which would downgrade your 4.4.3: skip it") and show the "Before you paste" footer there too, or drop the tick when any key downgrades; ideally annotate each entry in the clipboard JSON or put an honest "nothing to do today" first with Copy JSON secondary. Files: `server/agent/triage.ts:151-165` (`todayNotes` only checks overrides whose bad version leaves the range and missing direct deps), `web/src/components/FixDrawer.tsx` (footer line), `web/src/data/todayCheck.ts`.

**F2 (blocking-9: trust, clarity). Notice tab contradicts the Fix tab.**
Repro: any WOULD_PULL > Fix > Notice (mocha qix; kuma axios). Saw: "Window: malicious versions live since 13:12 UTC on 2025-09-08 (still live at 13:30 UTC). Do: Keep npm ci on the committed lockfile and add the pin if you resolve fresh." and, for kuma/axios, "Also set in package.json, under dependencies: `axios@0.30.3`" with no today check, while the Fix tab says "today npm ci needs no change" and "skip all of it". Expected: same hindsight sentence and same today check as the Fix tab ("Do: nothing to change today; the bad versions are gone from npm"), and the skip notes carried into the paste-to-team message. Files: `server/agent/triage.ts` `notices()` (~167+), `web/src/data/export.ts:198` (the .md report has the same "still live" line).

**F3 (blocking-9: clarity). Shrink the verdict to the answer.**
Repro: `mochajs/mocha` (qix). Saw: 94 words including a 7-item pin list ahead of the explanation, then "No OSV record exists yet at 13:30 UTC. In hindsight: it came at 14:26 UTC, 74 minutes after the first exposure ...". Expected: "Safe if you installed from your lockfile (5f8e8a8, 2025-09-01). Only a fresh install between 13:12 and 15:15 UTC on 2025-09-08 would have pulled debug@4.4.2 (your ^4.3.5 admits it). Nothing to change today." Pins in the drawer, OSV timing in the steps; make the caption "Judged on the package-lock.json at commit 5f8e8a8 ..." instead of the dangling "Its package-lock.json ...". Files: `server/agent/narrate.ts` (`verdictText`), `web/src/components/NarrativePanel.tsx` (caption).

**F4 (blocking-9: coverage, trust). pnpm/yarn: lead with what works.**
Repro: `vuejs/core`, `vercel/next.js`, `facebook/react`. Saw: visible `npm install --package-lock-only` + Copy; it fails (vue: EUNSUPPORTEDPROTOCOL `catalog:`, next: `workspace:`, react: ERESOLVE); the only caveat is collapsed and omits `catalog:`. Expected: put the by-hand check first as a copyable one-liner (`git show <commit>:pnpm-lock.yaml | grep -E "debug@4.4.2|..."` or the versions), demote the npm command to "only if the project has no workspace or catalog dependencies (try `--legacy-peer-deps` on ERESOLVE)". Files: `server/ingest/guest.ts:~106`, `web/src/data/pasteError.ts`.

**F5 (blocking-9 for accessibility: layout regression). "Run again" clipped at 1280x720.**
Repro: 1280x720, `mochajs/mocha` (qix). Saw: button right edge 1305 of 1280, label "Run agai" (`mocha-720-01-result.png`); round 5 was 1256. Expected: the hero strip shrinks or wraps so the primary button fits (also at 1366x768, where it is fine). Files: `web/src/components/ExecSummary.tsx` / `TimelineScrubber.tsx` header strip widths.

**F6 (nice-to-have: correctness). Copy steps and Copy PR drop the skip warnings and keep a contradictory tense.**
Repro: kuma/axios > Fix > More actions > Copy steps. Saw: "3. If you add the axios override, set axios to 0.30.3 in package.json's dependencies too" and "(in hindsight, it closed at 2026-03-31 03:15Z) ... can come out once the window has closed"; the drawer says "skip all of it". Expected: same "skip" lines as the drawer and "already gone" wording. Files: `server/tools/registry.ts` (draft_remediation steps), `web/src/data/export.ts`.

**F7 (nice-to-have: correctness). Pin list is still incomplete.**
Repro: mochajs/mocha qix (lock 5f8e8a8 has debug@4.3.4; verdict lists 4.3.2, 4.3.5, 4.4.0), axios/axios qix (omits chalk@5.2.0), kuma qix (omits debug@4.3.7, 4.3.4); nodemon lists chalk@4.1.2 (a different major). Expected: list every pin in the affected major or "and N more". Files: the lockfile-pin collection in `server/tools/registry.ts` / graph query.

**F8 (nice-to-have: delight, clarity). Small leftovers.**
(a) Renamed repo keeps the old name with no "now lives at mochajs/mocha" line (`server/ingest/guest.ts`). (b) Today's-lockfile fallback says "as it stood at the incident" in the Fix drawer and shows `axios/axios@HEAD` (`web/src/components/FixDrawer.tsx`, `server/agent/narrate.ts`); make sure the deployed server uses a GitHub token. (c) Shared link first screen is the demo org's 21 repos behind a Re-check banner; auto-run when `guest=` is present. (d) Hero "1 repo one install from malware, npm ci is safe": put the plain answer first. (e) "pasted/tiny-range", "WOULD_PULL", "counterfactual", duplicate hero line for a pasted lockfile. (f) 40 Tab stops to Fix.
