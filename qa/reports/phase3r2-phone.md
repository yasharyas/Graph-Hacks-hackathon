# Patient Zero: Phase 3 round 2, phone QA (Slack-ping persona)

Target `http://localhost:5173/` (Vite dev server). Chromium via playwright-skill, iPhone UA, `isMobile`, `hasTouch`, DPR 3, taps only (scrubber via CDP touch). 375x812 main; 390x844, 320x640, 812x375 re-run on 9 states each. Shots: `qa/reports/phase3r2-phone/`. Caveat: no soft keyboard in headless; I shrank the viewport instead.

## Verdict
**Big step up; not yet a 9.** Round 1's blockers are fixed: the first screen explains itself, the CTA is there from first paint, the verdict lands on screen, Back closes the drawer, text is >= 12 px, load CLS is ~0. Remaining: timeline labels collide after "Try axios 2026", the verdict wait shows no progress, the Slack deep link ignores `?repo=`, and the dev-server load is 36 s on 3G.

## Timed friction log (375x812)
| t | Step | Result |
|---|---|---|
| 0.35-0.84 s | Land | Skeleton with title, subhead, **Run triage (44 px, y 526)**, Try axios, Paste. `land-t00400.png` |
| 1.4-15 s | Autoplay | Counters 0 to 21, scrubber slides, CTAs stay visible; ends on "Play the 90 minutes". Clear, but uncaptioned. `land-t07000.png` |
| tap | Run triage | 49 tools done <0.5 s; verdict at top after 2.2-6.9 s, blank gap meanwhile (F2). `wait-02768.png`, `tri-t04000.png` |
| +0.9 s | Table | 21 cards, path inline ("2 hops"). `table-00.png` |
| +0.15 s | Fix, Notice, Copy | "Slack message copied" at 250 ms; clipboard verified. `fix-02-notice.png` |
| +0.7 s | `goBack()` | **Drawer closes, app stays**; scroll and focus restored |
| | Scrubber | Touch drag, track tap and page swipe work; 44 px hit area. `scrub-w375-02-mid.png` |
| 0.4 / 4.2 s | Ask | Echo, then answer; 16 px; pinned above nav. `ask-09-answer-812.png` |
| 2.5 s | Paste axios/axios | 5-step progress, hero "1 repo", table "1 of 1". `pasted-table.png` |
| 3-4.5 s | Try axios 2026 | 27 tools in 0.2 s, then F1 |

## Findings
| # | Sev | Repro, expected vs actual | Shot |
|---|---|---|---|
| F1 | **P1** | Tap **Try axios 2026**, read the scrubber. Expected 3 staggered label rows (the axios chip gives them). Actual: stale 2-row layout, "02:19 alert" prints over "03:15 removed" (375) or "02:07 OSV" (320), and stays. | `axios-t05000.png`, `labels2-320x640-tryaxios-3s.png`; ok: `labels-375x812-axios.png` |
| F2 | P2 | Run triage. Expected verdict or progress at once. Actual: verdict in view at 2.2, 6.3, 6.5, 6.9 s (R1 2.4 s), blank gap, no text. LLM latency; shared server. | `wait-02768.png` |
| F3 | P2 | Open `/?repo=acme%2Fcheckout-web` (the Notice message link). Expected that repo's drawer. Actual: generic qix triage. | `deeplink-t07000.png` |
| F4 | P2 | 320x640: Run triage (y 580-624) is under the nav (584). Paste error renders at y 617-827, off-screen, 400 px below Analyze. | `home-320x640-t1500.png`, `aud-320x640-08-paste-error.png` |
| F5 | P2 | Paste axios/axios: counted CLS **0.94** when the ~1,100 px panel collapses. | `paste-06-analyzing-250.png`, `-3000.png` |
| F6 | P2 | Ask "Which team first?": answer right, but chips struck through, "(not returned by any graph query)", "5 of 7 traced, 2 flagged", though `filter_exposures` did return tier LOCKED. | `ask-09-answer-812.png` |
| F7 | P3 | Targets < 44: Fix x21 39.8x44, drawer Fix tab 41x44, `npm/cli` 42.8x44, tool toggles 266x22, claims summary 247x24. | `table-00.png`, `fix-01-open.png` |
| F8 | P3 | Scrub bubble flush with the right edge at 15:43 (0 px at 320). | `scrub-w320-03-end.png` |
| F9 | P3 | Landscape: Run triage below fold, drawer body 187 px. | `aud-812x375-05-fix.png` |
| F10 | P3 | Jargon labels unchanged; icon-only header paste button; Notice link carries page origin; Ask bar un-pins below ~540 px tall, so the input jumps ~2,400 px. | `land-t15000.png` |

## Measurements
| Metric | Result |
|---|---|
| Horizontal overflow | **None** at 375, 390, 320, 812 in all 9 states |
| Text < 12 px | **0 runs** everywhere (R1: 135 on home) |
| Targets < 44x44 | Home, autoplay, paste panel: 0. Table, drawer, Feed: F7 (+45 in-sentence chips at 24 px, excluded). Landscape adds sort headers 16 px |
| CLS | Load 0.0007; triage 0.063; tab, drawer, Back 0; paste **0.94**; Try axios 0.063 |
| First verdict | Triage 2.2-6.9 s (n=5); axios 3.1-4.5 s; paste 2.5 s; Ask 4.2 s |
| First paint | 0.35-0.84 s localhost. Fast 3G + 4x CPU: dev :5173 **35.8 s** (67 req, 6.7 MB); prod :8080 3.1 s (271 KB, brotli) |
| axe-core 4.14 | 0 violations in 8 states |

## Round-1 regression
| R1 item | Status | Evidence |
|---|---|---|
| C1 no explanation (P1) | FIXED | Subhead |
| C2 early CTA (P1) | PARTLY | 375/390 yes; 320x640 covered (F4) |
| C3/D2 Graph tab empty (P1) | FIXED | Path list: `reg-graph-tab.png` |
| S1 38 s blank load (P1) | **STILL BROKEN** | 35.8 s dev; build is 3.1 s |
| K1/T1 contradictory counts (P1) | FIXED | Hero 1 repo, table 1 of 1 |
| C4 row tap silent (P2) | PARTLY | Path inline; tap only tints |
| C5 verdict off-screen (P2) | FIXED | Auto-scroll |
| C6 jargon (P2) | STILL BROKEN | Unchanged |
| C3b bare times (P2) | PARTLY | Labelled, but F1 |
| C7 silent Analyze (P2) | FIXED | Inline message; `owner/name` works |
| S2 CLS 0.49 (P2) | FIXED | 0.0007 on load (F5 new) |
| S3 compression (P2) | FIXED | br + immutable |
| K2 duplicate rows, D1 13k px feed (P2) | FIXED | ~3.7k px collapsed |
| A1 targets (P2) | PARTLY | F7 |
| A2 11 px text (P2) | FIXED | 0 runs |
| A3 Back leaves app (P2) | FIXED | pushState |
| P3: A4, K3, K4, T2, T3 | FIXED | axe 0; "1 repo"; 0.0148 |
| P3: K6, A7 (3-row header at 320), S4, C10, A5 | STILL / PARTLY | A5 187 vs 135 px |

## Scores (bar 9)
| Area | Score | Why, and what blocks a 9 |
|---|---|---|
| Clarity | 8 | Subhead, CTA, verdict first. Jargon, uncaptioned autoplay, F3, F4 |
| Speed | 6 | Dev-server link 36 s on 3G, verdict wait (F2), paste CLS (F5) |
| Correctness | 8 | Counts consistent; F1 label collision; deep link ignores repo |
| Trust | 8 | "59 of 59 traced", Cypher, "draft only"; F6 flags a true claim; localhost URL in Slack text |
| Delight | 8 | Auto-scroll, Back, toast, progress steps; blank wait, paste jump |
| Accessibility | 8 | axe 0, 12 px floor, Back and focus return; 44 px misses, F4, real keyboard untested |

## Console
0 errors, 0 warnings, 0 page errors in ~40 sessions. Only aborted requests: duplicate `GET /api/timeline?scenario=qix-2025-09-08` on every load, plus `POST /api/triage` and `/api/analyze` when the client closes its stream.
