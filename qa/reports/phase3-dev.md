# Phase 3 QA: individual developer / OSS maintainer persona

Persona: solo OSS maintainer who heard about the 2025 "qix" and 2026 axios npm hijacks and asks "was MY repo exposed?". Never saw the product, reads no docs.
Target: http://localhost:5173/ (live API + FalkorDB). Headless Chromium 1440x900 via playwright-skill. No servers started or stopped, no repo files edited.
Screenshots: `qa/reports/phase3-dev/` (paths below are relative to `qa/reports/`).
Date: 2026-10-15.

## Summary

The mechanics are solid: fast, accessible, no JS errors, clean error handling for yarn/pnpm and nonexistent repos, and the `@HEAD` counterfactual label exists and is prominent. The problems are in what the product *tells a developer*:

1. The generated `overrides` fix **breaks the repo it is meant to protect** (reproduced on mocha).
2. The verdict never says what *my* lockfile actually pins, so a repo whose lockfile was safe is told "would fetch chalk@5.6.1 ... Pin chalk@5.6.0" (for npm/cli that "pin" is an upgrade from 5.4.1).
3. The headline counters (21 repos / 10 repos) are the demo org and contradict the verdict for the repo I pasted (axios verdict: "No exposure detected" under "10 repos one install from malware").
4. An invalid URL (the 169.254.169.254 case) gives **no feedback at all**: Analyze just stays grey.
5. Reading both incidents for one repo takes extra steps and passes through a mixed-state screen.

## Timed friction log

Scripted run in one session (`T+` = seconds since script start, which includes about 0.5 s browser launch; real-human time would be roughly 3 to 4 minutes). Latencies are click-to-visible.

| T+ | Step | What happened | Friction |
|---|---|---|---|
| 4.5 | Open `/` | Loaded in 0.5 s (4.0 s in the consolidated run; Vite dev server). Dark dashboard, auto-playing clock, counter climbing "0 -> 21 repos one install from malware". Screenshot `01-landing-fold.png` | No one-line "what is this / check your repo here". The autoplay demo (real orgs: jquery, mocha, TypeScript flagged) dominates. Reads as a demo, not as a tool for me. |
| 4.5-5.5 | Find the entry point | "Paste your repo" outline button top-right; it is the 3rd Tab stop (Skip, scenario radio, Paste). Found in about 1 look. | Small, low emphasis; the three big "Run triage" buttons compete. |
| 5.5 | Open panel (`02-paste-dialog.png`) | Panel pushes the page down. URL field + disabled Analyze + "Choose package-lock.json". | Microcopy says "paste or drop a package-lock.json on this panel"; no visible place to paste. (Pasting into the URL box does work, see below.) |
| 8.7 | Paste `https://github.com/mochajs/mocha`, Analyze | 5-step progress bar (Fetch, Parse, Write graph, Enrich, Check ranges) with "Step 3 of 5". Verdict in 2.0 to 3.8 s typical, 0.6 s warm, one run 11 s, one 15 s. Panel collapses on success. `04-mocha-final.png` | Good progress feedback. Result lands under unrelated "21 repos" counters. |
| 8.7+ | Read qix verdict | "mochajs/mocha would fetch debug@4.4.2, ansi-styles@6.2.2, chalk@5.6.1. Notify: Your team via #your-team. Do: Update dependencies to pin debug@4.4.1 ... No secrets rotation required as no repos are LOCKED." Tier chip WOULD_PULL. | Never says "you were / were not exposed". "LOCKED" sounds like "secure" but is the worst tier. "#your-team" is a placeholder. |
| 11.0 | Open Fix drawer (`09-fix-drawer.png`) | `overrides` block, 3 steps, PR body, Copy fix, Report .md/.json, Notice tab (Slack draft). | See P0 below: copy-pasting this breaks mocha. |
| 13.1 | Click "Try axios 2026" / axios tab | Clock jumps to axios (01:30, "10 repos one install from malware", LOCKED 1 / WOULD_PULL 9) but the narrative, graph and table are still the qix/mocha report. Small banner: "This report is for qix-2025-09-08 ... timeline above is for a different incident". `15-axios-tab-after-qix-result.png` | My repo is not re-run. Mixed state. |
| 13.9 | Re-open panel | URL field is empty again. Retype, Analyze. | 3 extra steps for the second incident. |
| 16.2 | axios verdict for mocha (`06-mocha-axios-verdict.png`) | "Verdict: No exposure detected for axios-2026-03-31. Notify: No teams ... Do: No action required." | Raw scenario id instead of my repo name; counters above still say "10 repos one install from malware" (contradiction); center graph says "No paths yet - Run a triage, or scrub the timeline..." although the triage just ran. |
| 19.9 | Paste CONTENTS of npm-cli lockfile (647 KB) with Ctrl+V into the URL field | Auto-detected as a lockfile and analysed (1.0 to 2.2 s). URL field stays empty, repo named `pasted/npm`. `08-lock-final.png` | Works but is undiscoverable and silent (no "parsed npm@11.6.0, N packages"). Verdict "pasted/npm would fetch chalk@5.6.1, supports-color@10.2.1, debug@4.4.2" although this lockfile pins chalk 5.4.1, supports-color 10.0.0, debug 4.4.1. |
| 22.4 | Paste fake yarn.lock | Instant inline red error (no network call): "yarn and pnpm lockfiles are not supported yet. Drop a package-lock.json (npm v2 or v3)." + sample-repo chips. `10-yarn-full-input.png` | Good and fast. A yarn user has no package-lock.json and is not told how to get one. |
| 23.1 | Type `http://169.254.169.254/latest` | Analyze stays disabled. **Nothing** else: no message, no `aria-invalid`. Enter does nothing. `11-enter-ssrf-metadata.png` | Silent failure. (Server rejects it with a clear 400 when called directly, but the UI never shows that.) |
| 23.9 | Non-existent repo | 0.65 s: "github.com/zzqx-.../nonexistent-repo-4471 is not a public repo. Try again, or try a sample repo. request <uuid>" + sample chips. `11-enter-nonexistent.png` | Good. "not a public repo" blurs typo vs private. |
| 24.5 | Repo with no pre-incident lockfile (`spinabot/brigade`, created after the incident) | Repo id becomes `spinabot/brigade@HEAD`; table sub-label "current lockfile, counterfactual"; "COUNTERFACTUAL" banner above the report card. `12-head-repo-final.png` | Clearly labelled (see check below). |

## Requested checks

- **Fix snippet / overrides: would I trust it? No.** I applied the generated block to `mocha@^10.7` in a scratch dir (`npm ci --ignore-scripts`, then run a trivial spec):
  - Generated overrides (`debug 4.4.1, ansi-styles 6.2.1, chalk 5.6.0, strip-ansi 7.1.0, ansi-regex 6.2.0`): mocha crashes on load with `TypeError: chalk.blue is not a function` (log-symbols declares chalk ^4.1.0 and is forced onto ESM-only chalk 5; same blanket override also forces ansi-styles ^4, strip-ansi ^6 consumers onto ESM-only majors).
  - Control (no overrides): 1 passing.
  - Version-qualified keys (`"chalk@5.6.1": "5.6.0"`, `"debug@4.4.2": "4.4.1"`, etc.): installs and 1 passing. So a safe form exists.
  - For the pasted npm/cli lockfile the drawer proposes `chalk 5.6.0`, `supports-color 10.2.0` although the lockfile pins chalk 5.4.1 and supports-color 10.0.0 (so it is an upgrade, and `supports-color` is also used at ^5 and ^7 elsewhere in that tree). `19-fix-pasted-npm.png`.
  - The only genuinely sufficient advice, "install with npm ci from the committed lockfile, which never resolved the bad version", is step 3 of 3.
  - Good bits: it knows npm rejects an override that conflicts with a direct dependency, and it ships a Slack draft and report exports.
- **HEAD fetch labelled as counterfactual: yes, with two gaps.** Three signals: `@HEAD` suffix on the repo id (everywhere, including the narrative), table sub-label "current lockfile, counterfactual" (11 px, tooltip holds the full explanation), and a bold "COUNTERFACTUAL: This is the current lockfile (fetched at HEAD): no snapshot from before the incident was available..." banner at the top of the report card. Gaps: (a) the verdict sentence itself carries no counterfactual wording; (b) non-HEAD results (mocha) show no provenance at all: I cannot tell which commit/date the lockfile came from, yet the verdict is phrased as fact. From code reading, `fetchLock` also silently falls back to HEAD when the unauthenticated GitHub commits API is rate-limited (403); it is labelled `@HEAD`, so OK, but the user is never told why.
- **Invalid URL (`http://169.254.169.254/latest`): safe but mute.** Blocked client-side (button disabled) and server-side (direct POST returns 400 "Use a public repo URL..." in about 10 ms; same for `github.com.evil.example` and a `../` path). No SSRF concern observed. UX is the issue (P1-3).
- **Both incidents for mocha:** qix = WOULD_PULL (debug ^4.3.5 admits 4.4.2); axios = No exposure. Both correct for the data, both hard to reach and read (P1-5, P2-7).

## Console / network health

- Console errors: **0**, warnings: **0** across the full scripted journey (about 25 s, 12 steps) and across every other run, except: 1 console error when a truncated lockfile was pasted (browser logs the HTTP 400 resource; message shown to the user is fine: "That is not valid JSON").
- 2 `net::ERR_ABORTED` on `/api/timeline` and `/api/analyze` (superseded in-flight requests being cancelled; benign).
- axe-core (wcag2a/2aa/21/22aa + best-practice): landing 0, paste panel with error 0, result view 1 (serious), Fix drawer 1 (serious).

## Scores (bar >= 9)

| Dimension | Score | Why |
|---|---|---|
| Clarity | **5** | Answer to "was I exposed?" requires decoding WOULD_PULL/LOCKED; counters contradict the verdict; mixed scenario state; silent invalid input. |
| Speed | **9** | Click-to-verdict 0.6 s warm, 2 to 4 s cold; table fills before the narrative; progress bar. Tail: 11 s and 15 s on slow narrative runs. Meets bar. |
| Correctness | **6** | Tier logic matches data (mocha, axios, HEAD), 0 console errors. But fix snippet breaks the build, "Pin chalk@5.6.0" on a repo already on 5.4.1, no statement of what the lockfile pins, raw scenario id in verdict. |
| Trust | **5** | Strong signals: "(verified)" chips, "11 of 11 claims traced to a graph query", Cypher on every tool card, honest footer, counterfactual banner. Undermined by the P0 fix, placeholder `#your-team`, lockfile provenance not shown, Share that copies only the home URL. |
| Delight | **7** | Evidence-first tool feed, path graph, hand-drawn "74 min" callout, instant yarn error with sample chips are lovely. Dragged down by autoplay noise, demo-corpus counters, scenario flip. |
| Accessibility | **8** | Skip links, landmarks, h1/h2, `lang`, 2 px focus rings, full keyboard-only journey (Tab, type, Enter) works, focus moves to the Tool feed on completion, native dialog with Esc and focus return, live regions, axe 0 on two states. Misses: 4.28:1 contrast, label-in-name mismatch, silent invalid input (WCAG 3.3.1), pause-able autoplay is fine but noisy. |

## Issues for every score below 9

Severity: P0 blocks release / harms the user, P1 high, P2 medium, P3 polish.

### Clarity (5)

| ID | Sev | Where | Screenshot | Issue | Suggested fix |
|---|---|---|---|---|---|
| C1 | P1 | Left column "NARRATIVE": Verdict / Notify / Do | `04-mocha-final.png`, `08-lock-final.png` | No plain answer to "was my repo exposed?". Says "would fetch X" and "no repos are LOCKED". `LOCKED` reads as secure but is the worst tier. | Lead with a one-line answer: "Not compromised if you installed from your lockfile. You were only at risk if you resolved fresh between 13:12 and 15:15 UTC." Rename tiers for humans: LOCKED = "Bad version in your lockfile", WOULD_PULL = "Would have resolved to it on a fresh install". |
| C2 | P1 | Top-left KPI strip + scanner strip ("21 repos one install from malware", "LOCKED 1 / WOULD_PULL 20") | `06-mocha-axios-verdict.png`, `04-mocha-final.png` | After pasting my own repo the headline still shows the demo org (21, or 10 for axios) while the report says "1 of 1 repos" / "No exposure detected". Directly contradictory. | When a guest report is active, relabel the strip "Demo org (21 sample repos)" and dim it, or replace it with guest numbers. |
| C3 | P1 | Scenario tabs / "Try axios 2026" / "Run again" after a pasted result | `15-axios-tab-after-qix-result.png` | Switching incident shows axios clock and counters with the qix/mocha verdict beneath it; only a small notice explains. To get the axios verdict I had to reopen Paste and retype the URL (field not retained). | When a guest repo is loaded, switching incident (or "Try axios 2026") should re-run that repo under the new incident and keep its URL; show a two-incident summary ("qix: WOULD_PULL, axios: clear"). |
| C4 | P2 | Centre graph empty state after triage | `06-mocha-axios-verdict.png` | "No paths yet. Run a triage, or scrub the timeline past the first publish" appears after the triage has run and found nothing. | Context-aware empty state: "No path from the compromised account to your repo at 01:30 UTC." |
| C5 | P2 | Landing, first screen | `01-landing-fold.png` | No one-line purpose; the auto-playing demo is the first thing; "Paste your repo" is a small outline button, duplicated in the scanner strip after triage; three "Run triage" CTAs. | Add one sentence under "Patient Zero" ("Check whether your repo's lockfile ever resolved a hijacked npm version") and make "Check my repo" the primary button. |
| C6 | P2 | Verdict "Notify: Your team via #your-team" | `04-mocha-final.png` | Placeholder team/channel for a solo dev. | Hide Notify when there is no team mapping; show it only for org mode. |
| C7 | P2 | Paste panel microcopy | `02-paste-dialog.png` | "Or paste or drop a package-lock.json on this panel" gives no visible target; the working path (Ctrl+V into the URL box, which silently auto-analyses and leaves the box empty) is undiscoverable. | Add a visible textarea/drop zone ("Paste package-lock.json here") and a confirmation chip ("Parsed npm@11.6.0, N packages"). |
| C8 | P2 | Mocha (pre-incident snapshot) provenance | `04-mocha-final.png` | HEAD is labelled; the snapshot case is not. I cannot see which commit/date the lockfile is from, yet the verdict reads as fact. | Show "lockfile @ 5f8e8a8, <commit date>" under the repo name (and on the verdict line). |
| C9 | P2 | Stale advice | `04-mocha-final.png` | "Update dependencies to pin debug@4.4.1" 13 months after the malicious versions were removed from npm; no verification command. | Say the bad versions were unpublished, and give `npm ls debug chalk ansi-styles ...` / a `grep` for the lockfile. |
| C10 | P3 | Verdict line for clear result | `06-mocha-axios-verdict.png` | "No exposure detected for axios-2026-03-31" shows a raw id, not my repo name. | "mochajs/mocha: no axios 1.14.1 / 0.30.4 in the tree or reachable by range". |

### Correctness (6)

| ID | Sev | Where | Screenshot | Issue | Suggested fix |
|---|---|---|---|---|---|
| X1 | **P0** | Fix drawer > "PACKAGE.JSON OVERRIDES" + "Copy fix" | `09-fix-drawer.png`, `19-fix-pasted-npm.png` | Blanket overrides collapse every major of chalk / ansi-styles / strip-ansi / ansi-regex to one version. Reproduced: mocha with the generated block crashes with `TypeError: chalk.blue is not a function`. | Emit version-qualified keys (`"chalk@5.6.1": "5.6.0"`) or nest under the parent; dry-run `npm install --package-lock-only` against the pasted lockfile and refuse to offer overrides that change any other resolved version; make "use npm ci" the first step. |
| X2 | P1 | Verdict + Fix for pasted lockfile | `08-lock-final.png`, `19-fix-pasted-npm.png` | npm/cli lockfile pins chalk 5.4.1, debug 4.4.1, supports-color 10.0.0 (all safe), yet verdict says "would fetch chalk@5.6.1, supports-color@10.2.1" and "Pin chalk@5.6.0, supports-color@10.2.0" (an upgrade). The product never states what the lockfile pins. | Show "your lockfile pins chalk@5.4.1 (safe)" per package; only recommend pins that are not already satisfied; if lockfile is safe say "no action needed". |
| X3 | P2 | Fix > Share / "Link copied" | `15-share-clicked.png` | Share copies only `http://localhost:5173/` for demo and guest reports; toast says "Link copied". | Encode scenario + report id (or disable for guest reports with a tooltip). |

### Trust (5)

Issues X1, X2, X3, C6, C8 above are the trust drivers. Additional:

| ID | Sev | Where | Screenshot | Issue | Suggested fix |
|---|---|---|---|---|---|
| T1 | P2 | Footer disclaimer | `04-mocha-final.png` | The most important sentence ("WOULD_PULL ... not that the repo was compromised. Lockfile-pinned npm ci builds were safe") is 11 px grey text pinned to the bottom bar. | Promote to the verdict card, next to the tier chip. |
| T2 | P3 | Narrative "(verified)" chips | `04-mocha-final.png` | Eleven "(verified)" tokens inline make the sentence noisy (and noisy for screen readers). | One "11 of 11 claims verified" badge plus hover/disclosure per claim. |

### Delight (7)

| ID | Sev | Where | Screenshot | Issue | Suggested fix |
|---|---|---|---|---|---|
| D1 | P3 | Autoplay clock/counters during paste | `02-paste-dialog.png` | Clock runs 13:10 -> 13:13 and counters change while I type a URL; competes for attention. Has a Pause button, but defaults to on. | Pause autoplay while the paste panel is open or a guest report is shown. |
| D2 | P3 | Verdict wait | `18-triage-slow-run1-t3522.png` | Table is filled at about 1.5 s but the Verdict slot is empty for up to 11 to 15 s on slow runs, with no "writing verdict" state. | Show a pending line in the Verdict slot, or render a deterministic one-liner first and replace it when the LLM text arrives. |

### Accessibility (8)

| ID | Sev | Where | Screenshot | Issue | Suggested fix |
|---|---|---|---|---|---|
| A1 | P1 | Paste panel URL input + Analyze | `11-enter-ssrf-metadata.png`, `11-typed-gitlab.png` | Invalid input is rejected silently: button `disabled`, no `aria-invalid`, no error text or live message (WCAG 3.3.1 / 3.3.3). Same for `gitlab.com` URLs, `owner/name` shorthand and `/tree/main` URLs. | Validate on input, set `aria-invalid` + `aria-describedby`, show the existing message "Use a public repo URL like https://github.com/owner/name" in the alert region; accept shorthand and `/tree/...` URLs. |
| A2 | P2 | "direct" label in the exposure row (11 px, `#85837e` on `#202024`) | `04-mocha-final.png` | axe color-contrast 4.28:1 (needs 4.5). | Raise `text-fg-2` lightness for small text. |
| A3 | P2 | Fix drawer buttons "Report .md" / "Report .json" | `09-fix-drawer.png` | axe label-content-name-mismatch: aria-label "Export the whole report as Markdown/JSON" does not contain the visible text (WCAG 2.5.3, breaks voice control). | Make aria-label start with the visible text ("Report .md, export whole report as Markdown"). |
| A4 | P2 | Axios timeline labels | `15-timeline-overlap-zoom.png` | "02:19 alert" and "03:15 removed" overlap into "02:19 al03:15 removed" (also unreadable for low-vision users). | Stagger overlapping labels vertically or collapse them into one tick. |
| A5 | P3 | Fix drawer focus order | (keyboard run, no image) | Tab from the last drawer button reaches page-level "Skip to results / Skip to exposure table" before wrapping to Close. | Make background inert (`showModal()`) or trap focus strictly. |
| A6 | P3 | Exposure table, `Fix` button and repo cell | `12-head-label-hover.png`, `17-guest-head-layout.png` | `Fix` button is flush to the viewport edge (right edge = 1440 px, no gutter) and a long id wraps mid-token ("spinabot/brigade@H / EAD"). | Add right padding on the row; allow wrapping only at `/` or truncate with title. |
| A7 | P3 | Yarn/pnpm / package.json messages | `10-yarn-full-input.png`, `16-paste-package-json.png` | Yarn/pnpm users are told to "Drop a package-lock.json" without being told how to make one. Pasting a package.json gets "Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install with npm 7 or newer", which is the wrong diagnosis. | Detect package.json and say so; for yarn/pnpm either parse v1/pnpm lockfiles or offer `npm i --package-lock-only`. |

## Top 5 fixes

1. **Make the fix safe (X1).** Version-qualified `overrides` keys (or parent-scoped), dry-run against the pasted lockfile, and put "npm ci from your committed lockfile" first. Right now Copy fix can break a user's install.
2. **Answer the question in plain language and show what the lockfile pins (C1 + X2).** One sentence: "Your lockfile pinned chalk 5.4.1: not exposed. Only a fresh resolve in the window would have pulled 5.6.1." Rename LOCKED/WOULD_PULL; drop pins that are already satisfied.
3. **Stop contradicting the report with the demo counters, and carry the repo across incidents (C2 + C3).** Scope or relabel the KPI strip when a guest report is shown; make "Try axios 2026" re-run the pasted repo and show both verdicts side by side.
4. **Never fail silently on bad input (A1).** Inline, announced error for non-GitHub URLs, shorthand, `/tree/` URLs and random text; keep the button focusable with an explanation; accept `owner/repo`.
5. **Show lockfile provenance everywhere (C8 + HEAD wording).** "lockfile @ <sha>, <date>" for snapshots, and put the counterfactual wording into the verdict sentence for `@HEAD` results (not just the banner/tooltip).

Honorable mentions: wrong empty-state copy after a completed triage (C4), garbled timeline labels (A4), Share link that copies only the home URL (X3), landing page with no purpose statement (C5).

## Not covered

- Report .md / .json downloads (not clicked; downloads need explicit permission).
- Viewports other than 1440x900.
- Pending-verdict state on the 11 to 15 s runs was inferred from a 3.5 s capture, not an 11 s one.
- `owner/repo@HEAD` also arises on GitHub rate-limit fallback; I read this in `server/ingest/guest.ts` but did not trigger it.

## Screenshot index (`qa/reports/phase3-dev/`)

| Topic | Files |
|---|---|
| Landing / panel | `01-landing-fold.png`, `01-landing-full.png`, `02-paste-dialog.png`, `20-journey-landing.png` |
| mocha qix | `03-mocha-typed.png`, `04-mocha-final.png`, `14-time-mocha-qix.png`, `20-journey-mocha-qix.png` |
| Progress / waiting | `18-triage-wait-t468.png`, `18-triage-wait-t1651.png`, `18-triage-slow-run1-t3522.png` |
| axios | `05-axios-after-try.png`, `06-axios-tab-selected.png`, `06-mocha-axios-verdict.png`, `15-axios-tab-after-qix-result.png`, `15-timeline-overlap-zoom.png`, `20-journey-mocha-axios.png` |
| Lockfile paste | `07-lock-pasted-in-url-field.png`, `08-lock-t00794.png`, `08-lock-final.png`, `20-journey-lockfile-npm.png`, `19-fix-pasted-npm.png` |
| Fix drawer | `09-fix-drawer.png`, `09-fix-notice-tab.png`, `20-journey-mocha-fix.png` |
| yarn / pnpm / bad paste | `10-yarn-full-input.png`, `10-yarn-minimal-input.png`, `16-paste-package-json.png`, `16-paste-pnpm-lock.png`, `16-paste-random-text.png`, `16-paste-truncated-lock.png`, `20-journey-yarn.png` |
| Invalid URL / not found | `11-typed-*.png`, `11-enter-*.png`, `20-journey-ssrf-url.png` |
| @HEAD counterfactual | `12-head-repo-final.png`, `12-head-label-hover.png`, `17-guest-head-layout.png`, `20-journey-head-repo.png` |
| Other | `13-focus-paste-button.png`, `14-time-axios-axios.png`, `14-time-nodemon-qix.png`, `15-share-clicked.png`, `15-share-link-opened.png` |
