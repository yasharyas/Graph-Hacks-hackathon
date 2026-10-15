# Patient Zero - Phase 3 round 2: on-call AppSec journey

Persona: AppSec on call, alert "qix hijacked, 13:16 UTC". Headless Chromium 1440x900 and 1366x768, live API. Screenshots in `phase3r2-secops/`. No repo files edited.

## Verdict

Big improvement. Every cross-checked number agrees: 21 = 1 LOCKED + 20 WOULD_PULL; prod 14, dev 7; header = table = narrative = `.md` = `.json`; scrubs 13:12-15:30 consistent. All 21 repos have path, fix and Slack text. Still open: Ask answers one security-critical question wrongly, plus remediation and edge-state gaps. Usable for the main flow; not yet 9s.

## Timed friction log (scripted, 35 ms/char typing)

| t | Step | Result |
|---|---|---|
| 0.85 s | Interactive | OK |
| 5.7 s | Alert typed (human +3-5 s, paste ~1 s) | `01`, `02` |
| +0.4 s | Run | Headline 21 / LOCKED 1 / WOULD_PULL 20 |
| **+1.3 s (7.3 s total)** | **First actionable answer**: Verdict, Notify (7 teams), Do, 21 rows, Ask pinned (`05`) | Round 1: 1.9 s |
| +0.3 s | Prod only | "14 of 21 shown", visible at once (`06`) |
| <0.7 s | Fix / Notice / Copy | Clipboard equals on-screen text (`10a`, `10b`) |
| 2.3-15.6 s | Ask answers | Slow tail |

Console: no `console.error` or `pageerror` from app code. Only `ERR_ABORTED` on superseded `/api/timeline|exposure|triage|ask` fetches, and the expected `400` for the unknown alert.

## Findings

| # | Sev | Finding, repro, expected vs actual | Shot |
|---|---|---|---|
| 1 | **P1** | Ask: "which repos need secrets rotated, and is npm ci safe for the rest?" Expected: only checkout-web rotates; `npm ci` is safe for the 20 (the narrative says so). Actual, 3 of 3 runs: "npm ci is not safe for the other 20". Chip "2 of 5 traced, 3 flagged" flags entity words, not the false claim; inline "(not returned by any graph query)" clutters the prose | `19-ask-q3` |
| 2 | **P1** | "what should acme/checkout-web do?" says only "apply overrides pinning debug@4.4.1, chalk@5.6.0" (3 of 3 runs). Expected: LOCKED, rotate secrets, rebuild. Marked "5 of 5 verified" | `19-ask-q2` |
| 3 | P2 | Overrides JSON fails in npm for the 4 direct-dependency repos. I ran `npm 11.13 install --package-lock-only` with github/docs' JSON and root `chalk ^5.0.1`: `EOVERRIDE ... conflicts with direct dependency` (same for mocha, npm/cli, nodemon). Step 3 of the drawer gives a workaround I verified, but it is after the JSON and absent from Slack text and PR body | `08b` |
| 4 | P2 | Remediation vs header. Mark checkout-web and github/docs, Run again: verdict says "WOULD_PULL 19 ... Marked remediated", but header still LOCKED 1 / WOULD_PULL 20, table "21 of 21 exposed", no "2 remediated, 19 open" chip. Undo lasts 10 s only. "remediated 18:09" has no time zone. A fresh browser shows LOCKED again | `14`, `15`, `16`, `17` |
| 5 | P2 | Export: `.md`/`.json` match the table (21, 14/7, paths, pins). But "Notices" is still team-level text with no tier, path or pins, and it bundles dev-only repos. Export lives only under "..." in a single-repo drawer | `11`, `12-after-export-md` |
| 6 | P2 | Failed triage (unknown account): clear error, but the header keeps "21 repos one install from malware, LOCKED 1" while the right pane says "No exposures" | `29` |
| 7 | P2 | WOULD_PULL drawers (appium): 16 lines of "safe" pins push the Fix/Notice content below the fold | `08c`, `09c` |
| 8 | P3 | Slack "Details" link `?repo=` opens at 13:30, not 13:16, and no drawer. The header share link (`&at=`) works | `30-link-slack-details` |
| 9 | P3 | "+74 min" is 74.68 truncated, measured from first publish; from the alert it is 71. Verdict reads "the graph showed this 74 minutes before" | `05` |
| 10 | P3 | No-time alert silently uses 13:30 (`31`); 82 Tab presses to "Prod only" (`26`); 4-follow-up cap; Analyst pick names 3 of 4 ("and 1 more"); NOTIFY/DO need a scroll; clipped "Filter repo or te"; "1 repos" | `06` |

Verified OK: step order (npm ci first, overrides only if re-resolving, rotate only for LOCKED); override syntax valid on 3 more npm runs; Slack text names repo, tier, path, pins, window, link; Ask Q1 lists all 14 prod repos (22/22); Analyst pick is true (4 repos declare the range directly), mildly useful; no repo called "compromised"; 1366x768 fits Ask, table, drawer buttons (`22`, `24`).

## Scrub

Band = table at every minute. 13:12 0/0/21; 13:13 0/20/1 (API agrees); 13:30, 14:30, 15:14 1/20/0 (OSV 1 from 14:26); 15:15 and 15:30 1/0/20, "1 repo". Narrative stamped "as of 13:16" with "clock moved, Re-run" banner (`21-scrub-*`). Re-triage at 15:30 lists only checkout-web (`28`).

## Round-1 regression

| ID (sev) | Status | Evidence |
|---|---|---|
| C-1 Ask wrong (P0) | **FIXED** | Q1 complete |
| T-1 "verified" on wrong answers (P0) | **PARTLY** | Flags counted, semantic errors pass (1, 2) |
| C-2 16 empty fix drawers (P1) | **FIXED** | 21/21 complete |
| C-3 header vs table (P1) | **FIXED** | 13:12, 13:13, 15:15 agree |
| T-2 narrative variance (P1) | **FIXED** | 6 identical runs, none truncated |
| C-L1 LOCKED unclear (P1) | **FIXED** | `?` popover, `27` |
| C-L2 Ask buried (P1), C-L3 table below fold (P1) | **FIXED** | Pinned Ask; table, filters in view at both sizes |
| C-4, C-5 stale narrative and 15:30 re-triage (P2) | **FIXED** | |
| C-6 export, C-7 Slack (P2) | **PARTLY** | Findings 3, 5, 8 |
| C-8 remediation (P2) | **STILL BROKEN** | Finding 4 |
| T-3 failed state (P2) | **PARTLY** | Finding 6 |
| T-4 footer, C-L4/A-3 pressed state, C-L5 overlap, A-1 axe, S-1 latency (P2) | **FIXED** | axe 0 violations, main and drawer |
| A-2 keyboard path (P2) | **STILL BROKEN** | 82 Tabs (was 77) |
| C-9, C-10 (P3) | **STILL** | Findings 9, 10 |

## Scores (bar >= 9)

| Dimension | Score | Why not 9 |
|---|---|---|
| Clarity | 8 | NOTIFY/DO below fold in a narrow pane; fix under 16 pin lines; ambiguous 74-min baseline; export hidden |
| Speed | 9 | 1.3 s to full verdict; Ask tail 2-16 s |
| Correctness | 7 | Counts right, overrides valid, but Ask Q3 wrong, Q2 incomplete, direct-dep JSON throws EOVERRIDE, header ignores remediation |
| Trust | 7 | Honest flags and as-of stamps, but wrong sentences survive, "5/5 verified" on an incomplete answer, stale failed-triage header |
| Delight | 8 | Scrub banners, tier help, per-repo Slack; Undo vanishes in 10 s; cluttered Ask prose |
| Accessibility | 8 | axe 0, focus returns, pressed state visible; 82 Tabs to the filters, skip link lands on the pane |

**Blocks 9:** ground Ask on `npm ci` and tier semantics and on LOCKED actions; emit direct-dep-safe overrides; show remediation in the header; harden failed-triage; move export out of the drawer; shorten the keyboard path.
