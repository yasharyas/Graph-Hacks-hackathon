# Phase 3 round 2 QA: OSS maintainer persona

Headless Chromium 1440x900 (playwright-skill), http://localhost:5173, 2026-10-15. Shared server, so latencies vary. Screenshots: `qa/reports/phase3r2-dev/`.

## Verdict

Big step forward. The P0 is fixed, the verdict says "installing from your committed lockfile was safe" and lists what the lockfile pins, the hero names my repo, switching incident re-runs it, invalid input is explained inline, and axe is clean in 5 states. Not yet a 9: sharing hands the co-maintainer the **demo org**, `facebook/react` gets a wrong error, and a clean verdict shows an amber "1 flagged" warning.

## Timed friction log (scripted, T+ s)

| T+ | Step | Result |
|---|---|---|
| 0.8 | Land | Purpose line and "Paste your repo" visible (`01-landing-fold.png`). Passes the 10 s test. |
| 2.4 | Panel | URL box, textarea, file chooser (`02-paste-panel.png`). |
| 10.5 | Verdict for axios/axios | 6.8 s this run; others 1.1, 1.7, 4.4, 12 s. Table row lands at 0.3 to 2 s. |
| 16.8 | Fix, Copy fix | Instant (`20-journey-fix.png`). |
| 18.1 | Switch to axios | 0.66 s, re-runs my repo, both directions. |
| n/a | Errors | foo 0.09 s, nonexistent 0.57 s, express 0.89 s, react 0.2 s. |
| n/a | Ctrl+V of 650 KB lockfile | Auto-analyses in 0.6 to 3.7 s. |

## URL results (qix, then switch to axios)

| Input | Result | Friendly, with next step? |
|---|---|---|
| axios/axios | qix: WOULD_PULL (dev only); axios: clean | Yes |
| expressjs/express | "No package-lock.json at the root... Drop the lockfile instead." (persists on switch) | Partly: express has none, so that is a dead end |
| facebook/react | "GitHub did not answer. Try again..." | **No** (P1-2) |
| `github.com/foo` | "missing the owner or the repo name. Use owner/name..." | Yes |
| nonexistent org | "...is not a public repo." plus sample chips | Yes |

Uploads: mocha and npm-cli lockfiles work (chooser, drop, Ctrl+V). Text file: "does not look like a package-lock.json". yarn.lock and package.json: "run npm install --package-lock-only".

## Findings

**P1-1. Share does not reproduce my result (X3).** Paste axios/axios, click the link icon (toast "Link copied"), open `?scenario=qix-2025-09-08&at=1757338200000` in a fresh context. Expected: my verdict. Actual: "Acme demo org, 21 repos", "No triage yet". The Fix > Notice "Details: ?repo=axios%2Faxios" link opens the demo triage too, with no "expired" notice. `11-share-clicked.png`, `11-share-fresh-context.png`, `16-details-link-fresh.png`.

**P1-2. React gets the wrong error.** Expected: a yarn or no-lockfile explanation. Actual: "GitHub did not answer. Try again" (6 of 6; GitHub API healthy). babel, vuejs/core, webpack and docusaurus get "No package-lock.json... Drop the lockfile instead", with no mention of yarn or `npm install --package-lock-only` (the file-drop path has it). `05-react-qix.png`.

**P1-3. Clean verdict looks flagged.** Any repo under the axios incident: "axios/axios (not returned by any graph query) is not exposed to the jasonsaayman account compromise", badge "1/2 claims traced, 1 flagged" in amber. Correct answer, but the verifier leaks into the copy. `20-journey-axios-result.png`.

**P2-4. Copied overrides fail alone.** Pasted into mocha's package.json: `EOVERRIDE: Override for debug@^4.3.5 conflicts with direct dependency` (axios-style: chalk). Works after step 3's root-dependency change (npm 11.13: resolves, other majors untouched). Put that edit in the snippet. `10-mocha-fix-drawer.png`.

**P2-5. "Still open at 13:30 UTC", no date.** Verdict, notice and step 2 ("while the malicious versions are live") read as a live incident; it closed 15:15 UTC on 2025-09-08. Say "2025-09-08 13:12 to 15:15 UTC, closed". `20-journey-qix-result.png`.

**P2-6. Intermittent "That analysis has expired"** (404 on `/api/triage`, console error). 2 of about 14 guest analyses, both first lockfile uploads. Text says "Paste the repo again", button says "Run triage"; recovery unverified. Possibly shared-server eviction. `09-npmcli-try0.png`.

**P2-7. Round-1 leftovers.** Centre graph after a finished clean triage still says "No paths yet. Run a triage..." (C4). Snapshot results show no lockfile commit or date (C8; only HEAD is labelled).

**P3-8.** An `input` event (not Ctrl+V) of 100 KB into the lockfile textarea freezes the tab over 40 s (20 KB: 0.7 s).

**P3-9.** Mocha's pin list omits a dev `debug@4.3.4`. "The graph showed this 74 minutes before the first OSV record" is vendor talk. "Next compromised account" names real maintainers (sindresorhus 42%) on a solo result. "Your team" placeholder remains.

## Independent checks

- Pins match the lockfiles for npm-cli, mocha and the axios snapshot (recomputed with node).
- Analyst pick (LLM) is true: 7 (npm/cli), 5 (mocha), 6 (axios/axios) distinct malicious versions admitted by declared ranges, matching my semver recomputation.
- Override keys (`name@badversion`) are valid npm syntax.

## Round-1 regression

| ID | Sev | Status | Evidence |
|---|---|---|---|
| X1 overrides break repo | P0 | FIXED | Version-qualified keys; npm resolves, strip-ansi 6.0.1 kept. Residual P2-4 |
| C1 plain verdict | P1 | PARTLY | Leads with lockfile-safe; dense, undated |
| C2 demo counters | P1 | FIXED | Hero "axios/axios, pasted repo"; demo labelled "Acme demo org" |
| C3 incident switch | P1 | FIXED | Auto re-run 0.4 to 0.7 s |
| X2 pins/upgrade | P1 | FIXED | "YOUR LOCKFILE PINS ... safe"; notice still says "Pin to chalk@5.6.0" |
| A1 silent invalid | P1 | FIXED | 169.254.169.254, gitlab, "hello world": inline error, `aria-invalid` |
| C4 empty state | P2 | STILL BROKEN | P2-7 |
| C5 purpose line | P2 | FIXED | Line at top |
| C6 `#your-team` | P2 | PARTLY | Notify gone; "Your team" remains |
| C7 paste microcopy | P2 | FIXED | Visible textarea, Ctrl+V runs |
| C8 provenance | P2 | PARTLY | HEAD verdict says "(counterfactual...)"; snapshots none |
| C9 stale advice | P2 | PARTLY | P2-5 |
| X3 share | P2 | STILL BROKEN | P1-1 |
| T1 disclaimer | P2 | FIXED | In verdict and drawer |
| A2, A3 | P2 | FIXED | axe 0 violations |
| A4 timeline overlap | P2 | FIXED | Labels staggered |

## Scores (bar 9)

| Dimension | Score | Why, and what blocks 9 |
|---|---|---|
| Clarity | 7 | Plain, lead-with-safe verdict. Blocked by undated "still open", jargon (WOULD_PULL, "jasonsaayman account compromise"), yarn and no-lockfile dead ends. |
| Speed | 9 | CTA 0.8 s, errors under 1 s, switch 0.66 s, verdict 1 to 7 s typical (12 s worst). |
| Correctness | 7 | Pins and Analyst pick verified. Blocked by react misdiagnosis, EOVERRIDE alone, missing debug pin. |
| Trust | 6 | Blocked by amber flag on a correct verdict, share and Details links showing the wrong repo, no snapshot provenance. |
| Delight | 8 | Instant incident flip, inline errors with sample chips. Sharing is the broken payoff. |
| Accessibility | 9 | axe 0 in landing, two results, drawer, error panel; `aria-invalid`; Enter submits. Untested: screen reader, mobile. |

## Console

0 JS errors or warnings on the full journey. 4 benign `net::ERR_ABORTED` per run (superseded requests). One `Failed to load resource: 404` on `/api/triage` during P2-6.
