# Phase 3 round 3 QA: OSS maintainer persona

Headless Chromium (playwright), 1440x900 and 1280x720, http://localhost:5173, 2026-10-16. Shared server (other agents were running), so latencies vary. npm 11.13.0 for the fix checks, axe-core for accessibility. Screenshots: `qa/reports/phase3r3-dev/`. Scripts: `qa/tmp/dev/r3-*.cjs`.

## 1. Verdict

Real progress since round 2. The three trust-breakers are gone: Share now reproduces my result in a fresh context with one click ("Re-check"), a clean verdict no longer shows an amber "1 flagged" (33/33, 39/39, 2/2 claims traced), and yarn/pnpm repos get a named explanation with a next step instead of "GitHub did not answer". The fix snippet now includes the root dependency change, and I confirmed with real npm that it resolves with zero malicious versions for mocha and nodemon. Speed is good (first-time repo 2.4 to 3.4 s after Enter), errors say what to do, axe is clean in 8 states.

It is still not a 9 on clarity, correctness or trust, for one reason that runs through everything: **the tool does not say which lockfile it judged and when, and it never says the incident is over.** Historical results give no commit or date (mocha's "safe" lockfile is from 2025-09-01); a pasted lockfile is today's file but is not labelled a counterfactual (only `@HEAD` URL results are); the verdict says "still open at 13:30 UTC" with no close time; and the fix is derived from the old snapshot, so for uptime-kuma it tells me to set axios to 0.30.3 when my package.json says ~0.33.0 today. At 1280x720 the verdict is cut off mid-sentence before the "installing from your committed lockfile was safe" half.

**Overall: 7.8 / 10** (clarity 7, speed 9, correctness 7, trust 7, delight 8, accessibility 9).

## 2. Timed friction log (scripted, T+ in seconds, fresh browser, first-time repos)

| T+ | Step | What happened | Screenshot |
|---|---|---|---|
| 0.5 | Land | "Paste your repo" visible in header and hero; purpose line on top. Landing shows the Acme demo org ("0 repos one install from malware", clock "at 13:05 UTC", no date). | `01-landing-fold.png` |
| 0.6 | Click CTA | Panel open, field focused. Tab count to reach CTA from page load: 5. | `02-paste-panel.png` |
| 1.1 to 1.5 | Type `tj/commander.js` / `jashkenas/underscore`, Enter | Submits on Enter. | |
| 1.2 | Progress | "Step 1 of 5: fetch lockfile" shows within 0.1 s. | `15-commander-02-progress.png` |
| 3.9 to 4.5 | Verdict | 2.4 s (underscore) and 3.4 s (commander) after Enter. Cached repeats 0.15 to 0.7 s. mocha 0.7 to 2.6 s, axios/axios 3.2 s. | `15-commander-03-result.png`, `03-mocha-result.png` |
| 5.7 to 6.2 | Open Fix | Instant. | `06-mocha-fix.png` |
| 6.4 to 7.0 | Copy fix | Toast "Fix copied". Clipboard holds prose + JSON + steps + PR body (finding F5). | |
| 7.2 to 7.8 | Share icon | "Link copied". | `mocha-05-share-clicked.png` |
| +1.3 to 2.1 | Fresh context, open link, click "Re-check" | Same verdict (text diff: only FalkorDB ms differ). Banner says "Shared result" but the page shows demo org counts (21 repos) until the click. | `mocha-06-share-fresh-before.png`, `mocha-06-share-fresh.png` |
| 0.3 to 2.8 | Switch qix <-> axios with pasted repo | Auto re-run, both directions, also for a pasted lockfile (1.6 s). | `kuma-sw2-axios.png`, `21-lockfile-switch-axios.png` |
| 0.02 to 0.29 | Client-side errors | Inline, `aria-invalid`, focus stays in field. | `07-err-*.png` |
| 0.45 to 1.7 | Server-side errors | Alert in panel, with sample-repo chips and a 16 s retry countdown on 429. | `07-err-react-yarn.png`, `20-busy-B.png` |
| 0.4 to 2.0 | Lockfile upload (chooser, drop, textarea, Ctrl+V) | All four work. Ctrl+V of a 437 KB lockfile: 0.7 to 0.9 s. | `08-own-chooser.png`, `18-ctrlv-textarea.png` |

## URL and file results

| Input | Result | Plain and correct? Next step? |
|---|---|---|
| mochajs/mocha (qix) | WOULD_PULL, "installing from your committed lockfile was safe: it pins ...". Fix with `dependencies` + `overrides`. | Correct (pins re-derived from the commit; one dev pin omitted, see F8). No snapshot date. |
| remy/nodemon | Same shape, 3 malicious versions admitted, `^4` declared. | Correct. |
| axios/axios (qix) | WOULD_PULL, dev-only chalk path. Snippet puts chalk under `dependencies` though it is a devDependency (F4). | Verdict correct, snippet misleading. |
| axios/axios (axios incident) | "not exposed ... no malicious version is in its lockfile or admitted by its declared ranges", 2/2 traced, no amber. | Plain and correct. "jasonsaayman account compromise" is jargon. |
| louislam/uptime-kuma (qix then switch to axios) | axios incident: `~0.30.3` admits 0.30.4, fix says set axios to 0.30.3. | Verdict right for the snapshot; fix is wrong for today's package.json (`~0.33.0`, verified). |
| visionmedia/mocha (renamed to mochajs/mocha) | Works, but falls back to HEAD: "visionmedia/mocha@HEAD", COUNTERFACTUAL banner, verdict starts "Verdict (counterfactual: ...)". | Clear label. Not followed to a historical snapshot. |
| vuejs/core, vercel/next.js (pnpm) | "uses pnpm (pnpm-lock.yaml), and Patient Zero reads npm's package-lock.json ... Run npm install --package-lock-only ... drop the generated package-lock.json". | Named and actionable, but the command fails for next.js (F6). |
| facebook/react, bevacqua/dragula (yarn) | Same message with `yarn.lock`. | Good. |
| expressjs/express (no lockfile) | "No package-lock.json at the root ... Drop the lockfile instead." | Partly: no command for someone who has none. |
| `github.com/foo`, `hello world` | Inline: "missing the owner or the repo name. Use owner/name ...", "not a repo address ...". | Yes. |
| gitlab.com, bitbucket.org, localhost URL | "Only github.com repos can be analysed. Use a public GitHub repo like owner/name ...". | Yes. |
| nonexistent org/repo | "... is not a public repo. Try again, or try a sample repo." | "Try again" is wrong advice; no "check spelling". |
| `.../mocha/tree/main/lib`, `mocha.git`, `MOCHAJS/Mocha` | All resolve to the repo. | Yes. |
| This repo's package-lock.json (chooser, drop, paste) | "pasted/patient-zero is not exposed to the qix account compromise at 13:30 UTC". Share shows a toast: a dropped lockfile can't be shared. | Correct and plain. Not labelled as today's file. |
| Handmade v1 lockfile | "Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install --package-lock-only with npm 7 or newer to upgrade it." | Yes. |
| Broken JSON, empty, notes.txt, yarn.lock, package.json | Each says what is wrong and what to run. | Yes. |
| Handmade lockfile pinning debug@4.4.2 | "LOCKED: the lockfile itself pins the malicious versions debug@4.4.2 and chalk@5.6.1, so rotate secrets and rebuild." | Plain. Fix lists rotate-secrets and rebuild steps. |

## 3. Round-2 items

| Item | Status | Evidence |
|---|---|---|
| P1-1 Share does not reproduce my result | **Fixed** (one click) | `?scenario=...&at=...&guest=owner/repo` opens a banner "re-check mochajs/mocha against qix Sept 2025"; clicking Re-check gave the identical verdict for mocha, nodemon, axios/axios (both incidents) and the renamed repo (1.3 to 2.1 s). The Notice "Details" link (`&open=notice`) re-checks and opens the Notice drawer. Lockfile share gives an explanatory toast. Residual: banner says "Shared result" and the demo counters (21 repos) sit behind it. `mocha-06-share-fresh-before.png` |
| P1-2 react/vue wrong error | **Fixed** | react and dragula: "uses yarn (yarn.lock) ... run npm install --package-lock-only"; vuejs/core, next.js: "uses pnpm". Residual: command fails for pnpm workspace repos (see F6). `07-err-react-yarn.png` |
| P1-3 clean verdict shows amber flag | **Fixed** | axios/axios under axios: "2/2 claims traced" green; 16/16, 33/33, 39/39 elsewhere. `axios-axios-01-result.png` |
| P2-4 copied overrides fail alone (EOVERRIDE) | **Fixed for the common case** | Snippet now carries `"dependencies": {"debug": "4.4.1"}` plus version-qualified overrides. Merged into real HEAD package.json of mochajs/mocha and remy/nodemon, `npm install --package-lock-only` on npm 11.13: no EOVERRIDE, 0 malicious versions in the lockfile. New residuals F4, F5. |
| P2-5 "Still open at 13:30 UTC", no date | **Partly** | Verdict now says "since 13:12 UTC on 2025-09-08", but still "(still open at 13:30 UTC)", header clock has no date, and nothing says it closed at 15:15 or that the versions are gone from npm (verified: axios 0.30.4 / 1.14.1 are no longer on the registry). F3. |
| P2-6 intermittent "analysis has expired" | **Not reproduced** | 0 of about 22 analyses (8 fresh-context lockfile uploads, 12 URL runs, 3 concurrent). Server code only throws it when the guest graph is missing or the scenario differs; likely eviction on a busy shared server. Unverified. |
| P2-7a centre graph says "No paths yet" after a clean triage (C4) | **Fixed** | Now "No path to a malicious version ... Try the other incident, or paste another repo." `14-npmcli-result.png` |
| P2-7b snapshot result shows no lockfile commit or date (C8) | **Not fixed** | Mocha's judged lockfile is commit 5f8e8a8 from 2025-09-01 (recomputed via GitHub); UI shows neither. Only HEAD fallbacks are labelled. F1. |
| P3-8 100 KB `input` event freezes tab | **Partly** | 20 KB: 0.7 s; 100 KB: 19.7 s (was over 40 s); 437 KB valid lockfile via `fill`: over 90 s. Real Ctrl+V of 437 KB: 0.7 to 0.9 s, so only synthetic input events. |
| P3-9a pin list omits dev debug@4.3.4 | **Not fixed** | Mocha snapshot has debug 2.6.9, 3.2.7, 4.3.2, 4.3.4, 4.3.5, 4.4.0; UI lists 4.3.2, 4.3.5, 4.4.0 only. |
| P3-9b "74 minutes before the first OSV record" vendor talk | **Not fixed** | Still the last sentence of every verdict. |
| P3-9c "Next compromised account" on a solo result | **Not fixed** | Concentration tab is the default pane: sindresorhus 53% on mocha; reinink/malfaitrobin on a lockfile with 2 maintainers. |
| P3-9d "Your team" placeholder | **Not fixed** | Verdict table row, drawer ("Team Your team"), Notice text, route_owners `#your-team`. |
| C6, C9 (round 1) | Partly | As P3-9d and P2-5. |
| Round-2 positives still holding | Holding | Purpose line, hero names pasted repo, incident switch re-runs, inline errors, axe 0. |

## 4. Scores (bar 9)

| Dimension | Score | Why, and what blocks 9 |
|---|---|---|
| Clarity | 7 | Lead-with-safe verdict, inline errors, plain LOCKED sentence. Blocked by the clipped verdict at 1280x720, "still open at 13:30 UTC" with no close, jargon (WOULD_PULL, "account compromise", "Concentration", "@HEAD", "RAT dropper"), "Your team", and a pnpm instruction that fails. |
| Speed | 9 | CTA 0.5 s, progress 0.1 s, first-time verdict 2.4 to 3.4 s, cached under 1 s, errors under 0.3 s client / 1.7 s server, switch 0.3 to 2.8 s. Only synthetic 100 KB+ input events are slow. |
| Correctness | 7 | Pins and Analyst pick verified; snippet resolves in real npm for mocha and nodemon. Blocked by dev deps placed under `dependencies`, no "merge into your existing overrides", snapshot-derived pins that downgrade today's package.json (kuma), missing dev pin, renamed repo not followed to a snapshot. |
| Trust | 7 | No amber flag, share reproduces, counterfactual banner on HEAD. Blocked by no snapshot provenance, pasted lockfile unlabelled as counterfactual, closed incident reads live, demo counters behind the share banner. |
| Delight | 8 | Instant switch, sample chips, Enter submits, one-click re-check, pasted file just works. Held back by "Try again" on errors that cannot succeed, request UUIDs, irrelevant Concentration panel. |
| Accessibility | 9 | axe 0 violations in landing, panel, client error, server error, result, Fix drawer, share-banner landing; Enter submit keeps focus, Esc returns focus to opener, drawer returns focus to Fix; no horizontal scroll at 1280. Not tested: screen reader, mobile, forced-colours. |

## 5. Ranked fixes to reach >= 9

**F1 (blocking-9: trust, clarity). Show which lockfile was judged, and label every non-snapshot.**
Repro: paste `mochajs/mocha` under qix. Saw: "installing from your committed lockfile was safe: it pins ..." with no commit or date (judged commit is 2025-09-01, seven days pre-incident). Paste npm/cli's current package-lock.json: "pasted/npm ... was safe", pins chalk@5.6.2 (post-incident), no counterfactual note. Under the axios incident a HEAD result has the banner only in the right pane, not in the verdict. Expected: one line "Lockfile: <sha7>, 2025-09-01" for snapshots; "Today's lockfile: a counterfactual" for pasted files and HEAD in the verdict itself. Files: `server/ingest/guest.ts` (already returns `sha`), `web/src/data/format.ts` (`HEAD_NOTE`, `isHead`), `web/src/components/ReportClock.tsx`, `server/agent/narrate.ts`.

**F2 (blocking-9: clarity). Verdict truncated at 1280x720.**
Repro: 1280x720, analyze `mochajs/mocha`. Saw: "...since 13:12 UTC on 2025-09-08 (still open at 13:30 UTC); installing..." cut off; WHY line also cut; the expander says "Show the rest: who to notify and the steps", which does not hint it reveals the verdict. Expected: the safe/unsafe sentence never clamped (or the expander labelled "Show full verdict"). Cause is an intentional clamp: `web/src/components/NarrativePanel.tsx` line 221 (`Verdict` is `line-clamp-4` when the window is under 740 px tall). The fix is to keep the safe/unsafe sentence short enough to survive the clamp, or lead with it. `13-720-result.png`, `13-720-showrest.png`.

**F3 (blocking-9: clarity). Say the incident is closed.**
Repro: any qix result. Saw: "(still open at 13:30 UTC)", header "at 13:30 UTC" with no date, step 2 "Only if you must re-resolve ... while the malicious versions are live". Expected: "2025-09-08 13:12 to 15:15 UTC, closed; those versions are no longer on npm. If you installed (not npm ci) in that window, rotate secrets; otherwise nothing to change today." Files: `server/agent/narrate.ts`, `web/src/components/ReportClock.tsx`, remediation steps in `server/tools`.

**F4 (blocking-9: correctness). Make the fix snippet safe to apply as shown.**
Repro: (a) `axios/axios` under qix: path is dev-only chalk, snippet shows `"dependencies": {"chalk": "5.6.0"}`; also locked-app lockfile with `devDependencies` chalk. (b) `mochajs/mocha`, `louislam/uptime-kuma` already have `overrides` (verified); pasting a second `"overrides"` key is last-key-wins, so either the fix or the existing overrides silently vanish; nothing says "merge". (c) uptime-kuma under axios: snapshot declared `~0.30.3`, snippet says `"axios": "0.30.3"`, today's package.json is `~0.33.0`, so applying it downgrades (verified against GitHub HEAD). Expected: `devDependencies` when dev-only, "merge into your existing overrides" line, "based on your lockfile as of <date>; compare with your current version". Files: `web/src/components/FixDrawer.tsx`, remediation draft (`draft_remediation` tool in `server/tools`).

**F5 (nice-to-have: delight, correctness). "Copy fix" is not copy-pasteable JSON.**
Repro: Fix drawer > Copy fix on any direct-dependency result. Saw: clipboard starts with prose ("Set these in package.json...") then JSON, numbered steps, PR body; the code block has no copy button and clicking it copies nothing. Expected: "Copy JSON" that yields only the object, plus a separate "Copy PR text". File: `FixDrawer.tsx`.

**F6 (blocking-9: correctness/clarity). yarn/pnpm and no-lockfile dead ends.**
Repro: `vercel/next.js` then run the advised `npm install --package-lock-only`: `EUNSUPPORTEDPROTOCOL Unsupported URL Type "workspace:"` (verified on npm 11.13). `expressjs/express`: "Drop the lockfile instead" with no command; `nonexistent/repo` and all server errors say "Try again" plus a bare `request <uuid>`. Expected: for pnpm workspaces say it will not work and offer another route (a note or `pnpm import`), for no-lockfile give the command, drop "Try again" on deterministic errors. Files: `server/ingest/guest.ts` (lockfile-kind message), `web/src/components/PasteBox.tsx`.

**F7 (nice-to-have: clarity). Strip jargon and placeholders on a solo result.**
Repro: any result. Saw: WOULD_PULL, "jasonsaayman account compromise", "visionmedia/mocha@HEAD", "pasted/patient-zero", "Your team"/`#your-team`, default Concentration pane naming real maintainers, "74 minutes before the first OSV record". Expected: plain words ("a fresh install would have pulled it"), no team for a solo repo, Concentration collapsed or hidden. Files: `web/src/components/copy.ts`, `ExposureTable.tsx`, `InsightTabs.tsx`, `narrate.ts`.

**F8 (nice-to-have: trust, correctness).**
(a) Share banner says "Shared result" while demo counters (21 repos, LOCKED 1) show behind it; auto-run or hide the demo counts. (b) A renamed repo (`visionmedia/mocha`) is not followed to a snapshot, so it is labelled HEAD (server comment: redirect means no history). (c) Mocha pin list omits dev `debug@4.3.4`. (d) 100 KB+ synthetic input into the lockfile textarea takes 20 s to over 90 s (Ctrl+V is fine). (e) Esc then switching incident within about 0.6 s of Enter silently drops the pasted run and returns to the demo org. (f) The 429 text mixes "Another repo is being analyzed" with "One analysis per 20 seconds. Wait for the countdown".

## Console

No JavaScript errors or warnings on any path. `net::ERR_ABORTED` on superseded `/api/timeline` and `/api/analyze` requests every run (benign). One `Failed to load resource: 429` only when the concurrency limit was deliberately hit.
