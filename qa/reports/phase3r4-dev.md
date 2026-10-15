# Phase 3 round 4 QA: OSS maintainer persona

Headless Chromium (playwright-skill), 1440x900 and 1280x720 (spot checks at 1366x768), Vite dev http://localhost:5173 plus a production-build parity pass on http://localhost:8080, 2026-10-16. Shared server (other agents running), so latencies vary. npm 11.13.0 / Node 24.16 for the fix checks, axe-core 4.14 for accessibility, GitHub API/raw for ground truth. About 60 analyses across 15 repos, 10 lockfiles, 2 incidents. Screenshots: `qa/reports/phase3r4-dev/`. Scripts and temp npm projects live only in my own scratch folder `scratchpad/r4dev/`.

## 1. Verdict

Round 3's central complaint is fixed. Every result now says which lockfile it judged, with commit and date (`lockfile at commit 5f8e8a8 from 2025-09-01`), and I checked those against GitHub: all seven (mocha, nodemon, axios/axios, uptime-kuma under both incidents) are the true last-change-before-the-incident commits. Anything that is not a pre-incident snapshot (pasted file, renamed repo, HEAD fallback) says "counterfactual" in the hero line, the verdict sentence, the drawer and the Notice. The verdict window is dated and says npm removed the versions. The Fix drawer has a real "Copy JSON" (valid JSON, merges into a real package.json with no EOVERRIDE, devDependencies when dev-only), plus "Copy steps" and "Copy PR description". Share's banner is now honest ("not checked yet ... numbers below are the demo org's"), the verdict is no longer clipped at 1280x720, errors carry a command with a Copy button and no longer say "try again" when it cannot help, and Concentration is collapsed. axe: 0 violations in 10 states.

It is not a 9 yet, and the reason moved. The provenance problem is solved, but **the fix a maintainer would actually apply today is wrong in ways the UI claims it is not**. The drawer says "other versions of the same package in the tree are untouched". Real npm says otherwise: a version-qualified override matches every dependency whose range admits the bad version, so `npm install --package-lock-only` with the snippet moves safe, newer versions backwards (debug 4.4.3 to 4.4.1, error-ex 1.3.4 to 1.3.2, strip-ansi 7.2.0 to 7.1.0, and so on, on mocha, nodemon, axios/axios and uptime-kuma). Because the snippet is derived from a pre-incident snapshot, it can also add or downgrade things in today's package.json (axios/axios gets a `chalk` devDependency it no longer has; uptime-kuma's `axios ~0.33.0` becomes `0.30.3`). Both incidents ended long ago and the bad versions are gone from npm, so the honest answer to "what do I change?" is mostly "nothing, if you use npm ci", yet the drawer leads with an override block and the paste-to-team Notice still says "still live at 13:30 UTC". The verdict itself is correct but is one 75-word sentence that opens with "is exposed" and ends with "was safe".

**Overall: 8.3 / 10** (clarity 8, speed 9, correctness 8, trust 8, delight 8, accessibility 9). Up from 7.8.

## 2. Timed friction log (fresh browser, scripted)

| T+ (s) | Step | What happened | Evidence |
|---|---|---|---|
| 0.8 | Land | "Paste your repo" visible in header and hero, purpose line on top. Demo org Acme still fills the page: "0 repos one install from malware", LOCKED/WOULD_PULL/MAINTAINER tier jargon, clock "at 13:10 UTC" with no date. | `01-landing-fold.png` |
| 0.9 | Keyboard | 5 Tab presses to reach the CTA. | |
| 1.0 | Click CTA | Panel open, field focused. New helper: "If no pre-incident snapshot exists, the current lockfile is used and labelled as such." | `02-paste-panel.png` |
| 1.6 | Typed `jashkenas/underscore` | | |
| +0.07 | Progress | "Step 1 of 5: fetch lockfile" within 0.1 s, then step 3, step 5. | |
| +2.0 | Verdict (1st attempt: transient) | **One failure in about 60 runs**: step 3 "write graph", then "Analysis failed on our side. Try again. request 908e0b19-...". Retrying succeeded (0.86 s). Retry advice was right here. | |
| +0.9 to 3.5 | Verdict, other repos | underscore 0.9, mocha 1.0 to 2.2, nodemon 1.8, moment 2.1, backbone 1.8, vscode 2.5, uptime-kuma 2.1 to 3.5, axios/axios 2.5 to 4.4 (largest). | `03-mocha-result.png` |
| +0.2 | Open Fix | 90 to 213 ms. | `04-mocha-fix.png` |
| +0.3 | Copy JSON | Toast "package.json snippet copied"; clipboard is parseable JSON. | |
| +0.3 | Esc | Drawer closes, focus returns to the Fix button. | |
| +0.5 | Share | Link copied. | |
| +0.4 to 1.3 | Fresh context, open link, click "Re-check" | Same verdict sentence, 8 of 8 repo/incident combos (mocha, nodemon, axios/axios x2, kuma x2, renamed x2) plus 720 and prod. One click, but one click is needed. | `mocha-qix-06-share-fresh-before.png`, `mocha-qix-06-share-fresh.png` |
| 0.3 to 1.3 | Switch qix <-> axios, same pasted repo | Auto re-judges against a different snapshot (mocha: commit 661f349 from 2026-03-29 under axios), both directions, also for a pasted lockfile. | `mocha-sw2-axios.png`, `lockprod-sw2-axios.png` |
| 0.01 to 0.02 | Client-side errors | Inline, `aria-invalid`, focus stays in the field. | `err-hello-world.png` |
| 0.5 to 3.1 | Server-side errors | Alert in panel, command + Copy button, sample-repo chips. | `err-vuejs-core.png` |
| 0.3 to 1.1 | Lockfile upload, real Ctrl+V of a 375 KB lockfile | Auto-runs; 0.7 to 1.1 s. URL paste does not auto-run (needs Enter). | |

Prod parity (`:8080`): same verdict, same Copy JSON, share link on the :8080 origin reproduces in one click.

## 3. Results by input (is it plain and correct, which lockfile, next step)

| Input | Result | Plain and correct? Which lockfile? Next step? |
|---|---|---|
| mochajs/mocha (qix) | WOULD_PULL; "installing from your committed lockfile was safe: it pins ...". | Correct (verified: snapshot 5f8e8a8, 2025-09-01). Names the lockfile in hero, verdict and drawer. Pin list still omits dev `debug@4.3.4`. Verdict is one dense sentence. |
| remy/nodemon (qix) | WOULD_PULL, snapshot 533ad9c from 2023-12-01 (verified: last lockfile change). | Correct. |
| axios/axios (qix) | WOULD_PULL via dev-only chalk; snippet now uses `devDependencies`. | Correct and placed right for the snapshot; but HEAD package.json has no chalk (see F2). |
| axios/axios (axios) | "not exposed to the jasonsaayman account compromise (the axios maintainer) at 01:30 UTC on 2026-03-31", snapshot 0902502 from 2026-03-28, 2/2 traced, green. | Correct. No Fix button for a clean result (good). "No path" pane glues the incident title into a sentence ("a malicious version of axios npm account takeover: 1.14.1 and 0.30.4 depend on the plain-crypto-js@4.2.1 RAT dropper"). |
| louislam/uptime-kuma (axios) | WOULD_PULL, snapshot df23942 from 2026-03-06, pins axios@0.30.3 and 1.13.2. | Verdict correct. Snippet sets `axios 0.30.3`; HEAD declares `~0.33.0`. Generic caveat shown, not specific (F2). |
| louislam/uptime-kuma (qix) | WOULD_PULL via `@typescript-eslint/eslint-plugin@6.21.0 -> ^4.3.4 -> debug@4.4.2`. | Correct; merges into the repo's existing nested overrides (`knex: "$knex"`, `tedious: {...}`) without error. WHY line clamped mid-sentence at the default view. |
| visionmedia/mocha (renamed) | Counterfactual label in hero ("today's lockfile, a counterfactual"), verdict, drawer; "visionmedia/mocha@HEAD". | Clearly labelled. But the reason is wrong: "no lockfile from before the incident was available" (mochajs/mocha has one, we just served it). Not followed to the new name. |
| vuejs/core, vercel/next.js (pnpm), facebook/react (yarn) | "uses pnpm (pnpm-lock.yaml) ... run npm install --package-lock-only ... (pnpm workspaces with workspace: dependencies cannot be converted this way)" + command with Copy + sample chips. | Named and actionable, but self-contradicting for the two repos you named: the advised command is the one the message says will not work for workspaces. Dead end (F5). |
| expressjs/express, gulpjs/gulp (no lockfile) | "No package-lock.json at the root ... run npm install --package-lock-only ... and drop the generated package-lock.json here." + Copy. | Yes. |
| lodash/lodash (lockfileVersion 1) | "Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install with npm 7 or newer to upgrade it." | Yes (the paste path says `npm install --package-lock-only`; wording differs). |
| `github.com/foo`, `hello world`, `mochajs` | Inline, `aria-invalid`, 12 to 22 ms: "missing the owner or the repo name ...", "not a repo address ...". | Yes. |
| gitlab.com, bitbucket.org | "Only github.com repos can be analysed. Use a public GitHub repo like owner/name ..." | Yes. |
| nonexistentorg123/doesnotexist-repo | "github.com/nonexistentorg123/doesnotexist-repo is not a public repo." + sample chips, no "Try again". | Fixed. Could add "check the spelling, or paste its lockfile below" for private repos. |
| `git@github.com:remy/nodemon.git`, `MOCHAJS/Mocha.git`, `.../tree/main/lib`, `github.com/remy/nodemon/` | All resolve to the repo. | Yes. |
| microsoft/vscode, moment/moment, jashkenas/backbone | Snapshot verdicts in 1.8 to 2.5 s. | Yes. |
| This repo's package-lock.json (chooser, 4 fresh contexts) | "Verdict (counterfactual: this checks the lockfile you pasted as if it had been committed on 2025-09-08): pasted/patient-zero would not have been exposed ...". Share toast: "A dropped lockfile can't be shared: it exists only in this tab ... Share the repo's URL, or send the file." | Correct, labelled, share explained. |
| Handmade v1 lockfile | "Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install --package-lock-only with npm 7 or newer to upgrade it." | Yes. |
| Handmade v3: debug@4.4.2 pinned (prod), chalk@5.6.1 (dev), axios@1.14.1 + plain-crypto-js@4.2.1 | "LOCKED for the qix account compromise: the lockfile itself pins the malicious version debug@4.4.2, so rotate secrets and rebuild." Dev case: "(dev dependencies only)" and `devDependencies` in the snippet. | Plain and correct. |
| Handmade v3: debug ^4.3.5 pinned 4.3.5 | WOULD_PULL, "installing from that lockfile would have been safe: it pins debug@4.3.5". | Correct. |
| broken JSON, empty, notes.txt, package.json, yarn.lock | Each says what is wrong and the command to run. | Yes ("The paste may have been cut off" is slightly off for a chosen file). |

## 4. Fix snippet verification (real npm 11.13, merged into the repo's real HEAD package.json)

Method: `curl` HEAD package.json, merge the Copy JSON keys (overrides merged into existing, dependency keys set in the block the snippet names), `npm install --package-lock-only --ignore-scripts`, compare with the same run without the snippet.

| Repo / incident | Exit | EOVERRIDE | Malicious in lock | Side effects of the snippet (base lockfile -> fixed lockfile) |
|---|---|---|---|---|
| mochajs/mocha / qix | 0 | no | none | debug 4.4.3 -> 4.4.1, ansi-styles 6.2.3 -> 6.2.1, strip-ansi 7.2.0 -> 7.1.0, ansi-regex 6.4.0 -> 6.2.0 (debug 4.4.1 is also written as an exact direct pin; was `^4.3.5`) |
| remy/nodemon / qix | 0 | no | none | debug 4.4.3 -> 4.4.1, error-ex 1.3.4 -> 1.3.2, marked-terminal's chalk 5.6.2 -> 5.6.0 |
| axios/axios / qix | 0 | no | none | Adds `devDependencies.chalk 5.6.0` (HEAD package.json has no chalk; the 2025-09-04 snapshot did), root chalk 4.1.2 -> 5.6.0, debug 4.4.3 -> 4.4.1, error-ex 1.3.4 -> 1.3.2, strip-ansi/ansi-regex nested downgrades |
| louislam/uptime-kuma / qix | 0 (with `--legacy-peer-deps`; plain install hits a pre-existing ERESOLVE unrelated to the fix) | no | none | debug 4.4.3 -> 4.4.1, error-ex 1.3.4 -> 1.3.2, nested ansi-* / strip-ansi downgrades; existing overrides preserved |
| louislam/uptime-kuma / axios | 0 (legacy peers) | no | none | `axios` 0.33.0 -> 0.30.3, wait-on's nested axios 1.20.0 -> 1.14.0 |

The mechanism, reproduced in isolation: `dependencies: {debug: "^4.3.4"}` + `overrides: {"debug@4.4.2": "4.4.1"}` fails with `EOVERRIDE: Override for debug@^4.3.4 conflicts with direct dependency` (so the tool's exact direct pin is needed and is correct), and with the exact pin it resolves 4.4.1 where no override resolves 4.4.3. The override key matches any edge whose range admits 4.4.2, not just resolutions of 4.4.2. The drawer line "Each key names the exact bad version it replaces, so other versions of the same package in the tree are untouched" (`web/src/components/FixDrawer.tsx:274`) is therefore false on a fresh install, and nothing says the bad versions are no longer on npm so none of this is needed today.

## 5. Round-3 items

| Round-3 item | Status | Evidence |
|---|---|---|
| F1 Show which lockfile was judged; label every non-snapshot | **Fixed** | Hero "lockfile at commit 5f8e8a8 from 2025-09-01"; verdict "(its package-lock.json at commit ..., the last change before the incident)"; drawer "Judged on the lockfile at commit ..."; pasted and HEAD: "counterfactual" in hero, verdict, drawer, Notice, even under axios. Commits verified via GitHub API. Residual: "its package-lock.json" reads oddly; "pasted/patient-zero", "visionmedia/mocha@HEAD". |
| F2 Verdict truncated at 1280x720 | **Fixed** (verdict) | `mocha-720-01-result.png`, DOM: verdict `line-clamp: none`, scrollHeight == clientHeight at 1280x720, 1366x768, 1440x900. **New residuals:** the WHY line is still clamped (intentional, `NarrativePanel.tsx:258`; scrollHeight 103 vs 58 at 1440x900 on uptime-kuma, so "declares ^4.3.4, which admits debug@4.4.2" is cut), and the header's "Run again" button overflows the viewport by 28 px at 1280x720 (right = 1308). `overflow-1280x720.png`, `whyclip-1440x900.png`. |
| F3 Say the incident is closed | **Partly** | Verdict: "since 13:12 UTC on 2025-09-08 (still live at 13:30 UTC; npm removed them around 15:15 UTC)". Moving the clock to 15:45 and re-running gives a proper closed verdict (`mocha-1545-result.png`). Still open: header clock "at 13:30 UTC" with no date; verdict tense "is exposed ... still live"; Do step 2 "while the malicious versions are live" (`server/tools/registry.ts:271`); the paste-to-team Notice says "Window: malicious versions live since 13:12 UTC on 2025-09-08 (still live at 13:30 UTC)" (`web/src/data/export.ts:128`), which would be wrong in a Slack message sent today. |
| F4a dev dep under `dependencies` | **Fixed** | axios/axios (qix) and handmade dev lockfile: `devDependencies` in snippet and drawer title "PACKAGE.JSON: devDependencies and overrides". |
| F4b "merge into existing overrides" | **Fixed** | Drawer: "Merge these keys into package.json: add them to its existing "overrides", "dependencies" or "devDependencies" block rather than adding a second one". Merged into mocha, kuma (nested overrides, `$knex`) with no error. |
| F4c snapshot-derived pin downgrades today's package.json (kuma) | **Partly** | New generic line: "These pins come from the lockfile above. Check them against your current package.json before applying: a version you have moved to since is not reflected." Not specific; still adds `chalk` to axios/axios and downgrades kuma's axios 0.33.0 -> 0.30.3 (section 4). |
| F5 Copy fix is not copy-pasteable JSON | **Fixed** | "Copy JSON" yields only the object (parses); "More actions" has Copy steps, Copy PR description, whole report (.md/.json), Copy share link. Residual: "Copy fix" is byte-identical to "Copy JSON". |
| F6 yarn/pnpm and no-lockfile dead ends | **Mostly fixed** | Express/gulp: command + Copy. yarn/pnpm: command + Copy + the workspace caveat, no "Try again". nonexistent repo: "is not a public repo" plus chips. Residual: pnpm/yarn workspace repos (vuejs/core, next.js, react) still have no route; the message advises a command and says it will not work. |
| F7 Strip jargon and placeholders on a solo result | **Partly** | Fixed: Concentration is collapsed behind "Show the 3 maintainers in this repo's tree"; Notify row hidden for a pasted repo; `route_owners` says "No team to notify: a pasted repo has no owner in the graph". Still there: WOULD_PULL/MAINTAINER, "Your team" node in the path graph and TEAM column, "The graph showed this 74 minutes before the first OSV record", "RAT dropper", "(the axios maintainer)", "@HEAD". |
| F8a Share banner "Shared result" over demo counters | **Fixed** | Banner: "A shared link for mochajs/mocha against qix Sept 2025: not checked yet. The link carries no result, and the numbers below are the demo org's until you re-check". `mocha-qix-06-share-fresh-before.png`. Re-check is still a click, and the demo "21" still dominates the page behind it. |
| F8b Renamed repo not followed | **Not fixed** (wording regressed to inaccurate) | `visionmedia/mocha` -> counterfactual HEAD under both incidents. The text says no pre-incident lockfile was available; the cause is the redirect (`server/ingest/guest.ts:57,81`). |
| F8c Mocha pin list omits dev debug@4.3.4 | **Not fixed** | Snapshot 5f8e8a8 has debug 2.6.9, 3.2.7, 4.3.2, 4.3.4, 4.3.5, 4.4.0; verdict lists 4.3.2, 4.3.5, 4.4.0. |
| F8d 100 KB synthetic input freezes | **Unchanged** | `fill` 20 KB 0.7 s, 100 KB 23.8 s, 375 KB valid > 90 s. Real Ctrl+V of 375 KB: 0.7 to 1.1 s into either field. Only synthetic input is slow. |
| F8e Esc + incident switch drops pasted run | **Mostly fixed** | Esc then switch at 600 ms and 1200 ms: auto re-run works. At 0 and 150 ms the run is dropped (`r4-19-race-0.png`); not reachable by a human. |
| F8f 429 text mixes two messages | **Fixed** | Busy: "Another repo is being analyzed right now. Try again in a few seconds." with "Retry in 4 s" (waiting helps). Per-address limit has its own text ("One analysis per 20 seconds. Wait for the countdown, then try again", `web/src/data/errors.ts:33`). |
| R2 P1-1 Share reproduces | **Holding** | One click, identical verdict sentence, 8 of 8 combos; lockfile share explained by toast; `&open=notice` deep link re-checks and opens Notice (`notice-deeplink.png`). Analyst pick can differ between sender and recipient (LLM: "A fresh resolve ... 3 different malicious versions" vs "No observation was picked"). |
| R2 P2-6 intermittent "analysis has expired" | **Not reproduced** | 0 of 8 fresh-context lockfile uploads, 0 of about 40 URL runs, and the only failure was one transient "Analysis failed on our side" at step 3 (retry worked). |
| R2 P2-7a, P1-3 (clean verdict shows amber) | **Holding** | axios/axios under axios: 2/2 traced, green; 34/34, 36/36, 30/30 elsewhere. |
| Console | Clean | No JS errors or warnings on any path. `429` only when concurrency was hit; `net::ERR_ABORTED` on superseded requests. |

## 6. New findings this round

1. **Fix text vs real npm (F1 below).** See section 4.
2. **Slider announces wrong data.** `input[type=range]` has `aria-valuetext="13:30 UTC, 21 repos exposed"` while the page shows a pasted result with 1 repo (axios: "10 repos exposed"). `web/src/components/TimelineScrubber.tsx:29` documents it as the timeline's own count, which is the demo org's.
3. **Paste-to-team Notice** (`Fix > Notice`) says "(still live at 13:30 UTC)" for an incident that closed in 2025 or 2026.
4. **axios LOCKED fix pins `axios 1.14.0`** (an ancient release; today's is 1.20.0) with no "upgrade to a current version" option.
5. **One transient 500** during step 3 "write graph" (1 of about 60), with a bare request UUID; retry worked.

## 7. Scores (bar >= 9; honest)

| Dimension | Score | Why, and what blocks 9 |
|---|---|---|
| Clarity | 8 | Lockfile named everywhere; counterfactuals labelled; LOCKED sentence plain; errors give a command; verdict never clipped; Concentration collapsed. Blocked by: the verdict is one 70+ word sentence with nested parentheses that opens "is exposed" and ends "was safe" for an incident that closed long ago; header clock without a date; WOULD_PULL/MAINTAINER/"Your team"/"74 minutes before the first OSV record"/"RAT dropper"; pnpm dead-end message contradicts itself; WHY line clipped for transitive paths; "Run again" cut off at 1280x720. |
| Speed | 9 | CTA 0.8 s, progress 0.07 s, first verdict 0.9 to 3.5 s (axios/axios 4.4 s), lockfile 0.3 to 1.1 s, switch 0.3 to 1.3 s, Re-check 0.4 to 1.3 s, client errors 12 to 22 ms. One transient 500 in about 60 runs. Only synthetic 100 KB+ input events are slow. |
| Correctness | 8 | Verdicts and provenance verified against GitHub for 7 snapshots; snippet resolves in real npm 11.13 for five repo/incident pairs with no EOVERRIDE and correct block placement; handmade LOCKED/WOULD_PULL/CLEAN verdicts right. Blocked by the false "untouched" claim and the resulting silent downgrades of safe newer versions, snapshot-derived keys applied to today's package.json (chalk added, axios 0.33 -> 0.30), exact old pins with no "bad versions are gone, update instead", pin list missing debug@4.3.4, renamed-repo reason wrong. |
| Trust | 8 | Green traced-claims badge everywhere, provenance and counterfactual labels, honest share banner, share reproduces in one click. Blocked by the false "untouched" claim, Notice saying "still live", different analyst pick for the recipient, slider announcing demo-org counts on a pasted result, renamed-repo explanation. |
| Delight | 8 | Sample chips, Enter submits, Copy buttons on commands, Copy JSON / steps / PR text, lockfile paste auto-runs, instant incident switch, one-click Re-check, SSH remote and `.git` URLs accepted. Held back by two identical copy buttons, Re-check not automatic, dense verdict, pnpm workspace dead end. |
| Accessibility | 9 | axe 0 violations in landing, panel, client error, server error, result, Fix drawer, Notice tab, steps expanded, share-banner landing, 1280x720 locked result; focus stays in the field after errors, goes to the Verdict section after a result, returns to Fix after Esc; live regions present. Not tested: screen reader, mobile, forced-colours. Held at 9 despite the stale slider `aria-valuetext` and the clipped "Run again", both nice-to-have. |

## 8. Ranked fixes to reach >= 9

**F1 (blocking-9: correctness, trust). The Fix drawer claim "other versions ... are untouched" is false, and applying the snippet today downgrades safe versions.**
Repro: `mochajs/mocha` under qix > Fix > Copy JSON; merge into the HEAD package.json; `npm install --package-lock-only --ignore-scripts`; compare with and without. Saw: debug 4.4.3 -> 4.4.1, ansi-styles 6.2.3 -> 6.2.1, strip-ansi 7.2.0 -> 7.1.0, ansi-regex 6.4.0 -> 6.2.0 (nodemon: debug, error-ex 1.3.4 -> 1.3.2, chalk 5.6.2 -> 5.6.0). Isolated: `debug ^4.3.4` + `"debug@4.4.2": "4.4.1"` is EOVERRIDE; exact `4.4.1` resolves 4.4.1, not 4.4.3. Expected: say it replaces every range that admits the bad version and so pins down to the listed versions; and lead with "The bad versions are gone from npm. If you install from your lockfile (npm ci) there is nothing to change; if you re-resolve you get current safe versions. Use this only if you must reproduce the window." Files: `web/src/components/FixDrawer.tsx:274`, `server/tools/registry.ts` (draft_remediation, line ~271 text).

**F2 (blocking-9: correctness). Snapshot-derived snippet is applied to today's package.json without checking it.**
Repro: (a) `axios/axios` under qix > Copy JSON gives `devDependencies.chalk 5.6.0`; HEAD package.json has no chalk (the 2025-09-04 snapshot did) so applying adds a dependency and moves root chalk 4.1.2 -> 5.6.0. (b) `louislam/uptime-kuma` under axios gives `axios 0.30.3`; HEAD declares `~0.33.0`; applying gives lockfile axios 0.33.0 -> 0.30.3 and wait-on's axios 1.20.0 -> 1.14.0. (c) LOCKED axios pins `axios 1.14.0` while current is 1.20.0. Saw: only the generic "check them against your current package.json". Expected: diff the snippet against HEAD's package.json (the server already fetches HEAD for the fallback) and either drop keys that are already past the bad range ("your package.json says ~0.33.0, which never admitted 0.30.4: nothing to do") or recommend "upgrade to the current release". Files: `server/ingest/guest.ts`, `server/tools/registry.ts` (draft_remediation), `FixDrawer.tsx`.

**F3 (blocking-9: clarity). Break the verdict into two short sentences, in the right tense, with a dated clock.**
Repro: any qix result. Saw: one 75-word sentence: "Verdict (its package-lock.json at commit 5f8e8a8 from 2025-09-01, the last change before the incident): mochajs/mocha is exposed to the qix account compromise only on a fresh install since 13:12 UTC on 2025-09-08 (still live at 13:30 UTC; npm removed them around 15:15 UTC); installing from your committed lockfile was safe: it pins ...". Header "at 13:30 UTC" with no date. Expected: "You were safe if you installed from your lockfile (commit 5f8e8a8, 2025-09-01). A fresh npm install between 13:12 and 15:15 UTC on 2025-09-08 would have pulled debug@4.4.2." Header "2025-09-08 13:30 UTC". Files: `server/agent/narrate.ts:305-334`, `web/src/components/ReportClock.tsx`.

**F4 (blocking-9: trust, clarity). Closed-incident wording in Notice and Do.**
Repro: any qix result > Fix > Notice; or "Show the steps". Saw: "Window: malicious versions live since 13:12 UTC on 2025-09-08 (still live at 13:30 UTC)"; step 2 "while the malicious versions are live". Expected: "closed 15:15 UTC; versions removed from npm" whenever the removal time is known. Files: `web/src/data/export.ts:128`, `server/tools/registry.ts:271`.

**F5 (blocking-9: clarity, coverage). pnpm/yarn workspace repos.**
Repro: `vercel/next.js` (or vuejs/core, facebook/react). Saw: "run npm install --package-lock-only ... (pnpm workspaces with workspace: dependencies cannot be converted this way)" with a Copy button for that command. Expected: when the repo uses workspaces, say plainly that this route will not work and offer something that can (analyse one package's lockfile, or a stated ETA), instead of advising the failing command first. Files: `server/ingest/guest.ts` (lockfile-kind message), `web/src/components/PasteBox.tsx`.

**F6 (nice-to-have: trust). Renamed repo reason and follow-through.**
Repro: `visionmedia/mocha`. Saw: "no lockfile from before the incident was available", "@HEAD". Expected: "visionmedia/mocha now lives at mochajs/mocha" and analyse the snapshot under the new name (the 301 is refused today). Files: `server/ingest/guest.ts:57,81`, `server/agent/narrate.ts:334`.

**F7 (nice-to-have: accessibility, trust). Slider text and clipped control.**
Repro: analyse any repo, inspect `input[type=range]`: `aria-valuetext="13:30 UTC, 21 repos exposed"` (axios: "10 repos exposed") over a 1-repo pasted result. At 1280x720 the "Run again" button's right edge is 1308 px (28 px off-screen, not scrollable). Files: `web/src/components/TimelineScrubber.tsx:29`, header/hero layout.

**F8 (nice-to-have: clarity, delight).** Residual jargon and small things: WOULD_PULL/MAINTAINER, "Your team" graph node and TEAM column for a pasted repo, "74 minutes before the first OSV record", "RAT dropper" glued into the "No path" sentence, "(the axios maintainer)", "@HEAD"; "Copy fix" duplicates "Copy JSON"; the recipient of a shared link sees a different analyst pick; the WHY line is clamped mid-sentence for transitive paths (`NarrativePanel.tsx:258`); verdict pin list omits dev `debug@4.3.4`; 100 KB+ synthetic input into the textarea takes 24 s to over 90 s (real paste is fine); one transient "Analysis failed on our side" at step 3 (retry worked); nonexistent-repo message could add "check the spelling, or paste its lockfile".
