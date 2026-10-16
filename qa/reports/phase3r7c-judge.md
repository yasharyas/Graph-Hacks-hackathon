# Patient Zero: FalkorDB judge pass, round 7c (re-test of the round 7 fixes)

Persona: the same FalkorDB-team judge as `qa/reports/phase3r7-judge.md` (previous pass: overall 9.2, Trust 8.9). Build under test: main `f8c414c`, production build on `:8080` (real CSP), not restarted or reconfigured. Playwright headless Chromium, a fresh context per run, at 1440x900 (primary) and 1280x720. Screenshots: `qa/reports/phase3r7c-judge/`. Scripts: the session scratchpad, `r7cjudge/`.

Budgets kept: **2 model-backed open questions** (both used in the cold journey), **1 pasted repo** (`FalkorDB/falkordb-browser`). Every other Ask was graph-routed (free). FalkorDB was queried read-only (`GRAPH.RO_QUERY`). No repo file was edited, nothing committed, `.env` never read.

How I tested routing without spending model quota: a scratch script imports the repo's own `ask()` from `server/agent/ask.ts` with a fake chat function that only counts calls, runs it on a real qix 13:30 report, and prints `modelCalled`, mode, reason and the answer (`route.mjs`). Every graph-routed result below was then confirmed in the real app. Two refusal reasons that cannot be provoked live without burning quota (`no-model`, `cap`) were produced by the repo's own `ask()` and fed to the real UI through `page.route` (`emit.mjs`, `emu.cjs`): the labels are real UI output, the server events are emulated, and I say so below.

## 1. Verdict

**Overall 9.25 / 10 (about the same as 9.2).** All six dimensions are at or above the 9 bar this time, but **Trust is exactly 9.0**, not above it.

Six of the seven ranked fixes landed and hold under test: the three repro questions, the "through which packages" bug and the refusal labels, the observation-list docs, the video script's merge note, the submission copy, the handled-400 console line, and four of the five polish items. Fix 1 is **partly** fixed: the exact repro questions and five of my six new paraphrases now answer the right question, but a natural phrasing class still gets "Complete list: 21 repos" under a green "Answered from the graph, 30 of 30 claims verified" badge ("**Of all** the maintainers, which one has the widest reach…"), and I also hit a second route to the same symptom in the model path: the coverage rule threw away a model answer and printed the 21-repo list instead, charging one of the 4 follow-ups.

What holds it near 9.2 and not higher:

1. The "all / every / each" quantifier and "which one …" phrasing still bypass the head-noun routing (section 3, fix 1).
2. A model-written answer that names some repos without "N of 21" is replaced by the complete repo list under the green badge, on questions that did not ask for a list (live repro in the cold run; deterministic repro in `cover.mjs`).
3. `docs/launch-posts.md` still carries the pre-fix overclaim ("The LLM only picks one observation by id; it never writes a fact"), which `docs/submission.md` no longer does.

Everything else I tried held: console clean on every path including the unknown alert, 0 axe violations in 7 states, speed unchanged, paste works on a FalkorDB judge's own repo, three numbers re-computed in FalkorDB match.

## 2. Items table (previous report, section 5)

| # | Fix | Status | Evidence |
|---|---|---|---|
| 1 | Ask answers a different question under "verified" | **Partly fixed** | The three repro questions: fixed (0 model calls, right route, numbers match FalkorDB). My 6 new paraphrases: 4 right, 1 model-routed (honest), **1 wrong** ("Of all the maintainers…" returns the repo list). Bonus probes: 4 more "all" phrasings give the list, alone or ahead of the right answer. Plus the model-path coverage replacement. `ask-f1-*.png`, `ask-p*.png`, `cold-04-open-2.png` |
| 2 | "through which packages" read as `via which`; refusal blamed the model | **Fixed** | "Which repos does the sindresorhus account reach, and through which packages?" now answers: 21 of 21 repos, most/fewest, "Its packages in those lockfiles include `ansi-regex`, `ansi-styles`, `chalk` …", 38 of 38 claims, 0.36 s, 0 model answers. The ljharb variant: 20 of 21, 38 of 38. Each refusal reason has its own label (below) |
| 3 | Docs describe the observation list wrongly | **Fixed, 3 nits** | README:28, README:121, `docs/AI_USE.md:17`, blog:76 now list the five kinds as `observations()` builds them and say the verdict's own facts are not offered. README:13 and `docs/proof-points.md` say 12 s (measured 12.1 s). Nits: "up to five" (at most four exist at once), `video/script.md:11` still says "about 14 s", `docs/AI_USE.md:9` "six rounds" |
| 4 | `video/script.md` merge note and missing disclosure step | **Fixed**, 1 nit | Beat 3 note rewritten ("The analyst pick and 'Notify 7 teams' are on screen with no click. Before Beat 4, open 'Show 2 more evidence paths …'"); Beat 4 now says to open the disclosure; chip text is "LLM replay" / "Analyst pick · LLM replayed" (matches `Header.tsx` and `pickLabel`). Live app: disclosure reads "Show 2 more evidence paths, who to notify, the steps and the claim map", `[E3]` exists after opening it. Nit: Beat 1 still "about 14 s" |
| 5 | Two submission-copy overclaims | **Fixed**, 1 related gap | `docs/submission.md` now: "each card showing its Cypher and, on request, its GRAPH.EXPLAIN plan"; "An LLM picks one graph-built observation by id and answers open follow-ups through the same tools, with every name and count checked"; 149 words (limit 150). The one-line AI note agrees. Related: `docs/launch-posts.md` L8, L28, L44, L53 still say the LLM only picks an observation and never writes a fact |
| 6 | Console 400 on the unknown-alert path | **Fixed** | `POST /api/triage` returns `200 text/event-stream` with one `error` event. Zero console errors, zero page errors, zero failed requests at 1440x900; the panel names both loaded incidents and "use Paste your repo" and does not echo the alert text. A valid alert typed afterwards runs (axios, 26 tools, 46 of 46). `alert-unknown-1440.png`, `alert-valid-after-error.png` |
| 7 | Polish batch | **Fixed except one declined item** | a) long package chip: **fixed**. b) `remediated` wrap in the recall card: **fixed**. c) "Time in FalkorDB" vs "Run total": **fixed**. d) MCP mismatched `incident`: **fixed**. e) stray period: **fixed**. Not changed, by design: the pasted repo's column still reads `Fa…/falkordb-browser` at 1440 (the dev note explains the 17 px shortfall) |

### Fix 1 detail: the three repro questions, my 6 new paraphrases, and bonus probes

Route and answer were checked offline (`modelCalled` always counted) and then in the app (`ask-*.png`, 0 of 4 model answers kept).

| Question | Answer | Result |
|---|---|---|
| **Repro A** Which library should I replace first to reduce the exposure? | Carrier answer only: override on `debug@4.4.2` reaches 21 of 21, "clears 1 repo completely (`postmanlabs/newman`)", carriers `@eslint/eslintrc` 19, `eslint` 18 … "and 152 more". No Do plan, no Notify roster. 21 of 21 claims, 0.34 s | **fixed** |
| **Repro B** Which maintainer account reaches the most repos if hijacked? | The PageRank paragraph alone: `sindresorhus` 307 packages, 21 of 21; `ljharb` 183, 20 of 21; `types` 234, 20 of 21. No per-team list. 9 of 9 claims | **fixed** |
| **Repro C** Which package carries the bad version into the most repos? | Carrier answer (same as A), not the by-version list. 21 of 21 | **fixed** |
| **P1 carrier** Which npm module is responsible for pulling the compromised release into most of our projects? | Carrier answer, 21 of 21 | right |
| **P2 carrier** Which transitive dependency lets debug@4.4.2 in for the most repos? | Not graph-routed ("transitive" is not in the head-noun adjective list), so it went to the model (one of my 2 open questions). Live, the model's second call failed: "Not answered: no language model is available", then the graph's summary "21 of 21 exposed repos match (reaches debug@4.4.2) across 7 teams", 2 of 2 claims, 4.1 s, no follow-up used. Honest, not wrong, but not the carrier answer. The free tier is shared and my own triage pick calls were on it, so I cannot say the failure was not my load | honest, not answered |
| **P3 maintainer** Which publisher's credentials, if stolen, would expose the most of our repos? | PageRank paragraph alone, 9 of 9 | right |
| **P4 maintainer** Of all the maintainers, which one has the widest reach into our dependency tree? | "Complete list (no filter): 21 repos across 7 teams. `Payments`: `acme/checkout-web` (LOCKED); `Docs`: …" under "Answered from the graph", **30 of 30 claims verified**, no maintainer named. `ask-p4-ofall.png` | **wrong question, green badge** |
| **P5 team** Which team is hit hardest by this? | "Open exposures by team, most first: `CLI` 5 repos; `QA` 4 …", 14 of 14 | right |
| **P6 version** Which release of debug is the poisoned one? | By-version list: `debug@4.4.2` 21 repos … `supports-color@10.2.1` 2 (`npm/cli` and `netlify/cli`), "the other 8 of the 19 reach no repo", 24 of 24 | right |

Bonus probes (offline oracle only, all `modelCalled` 0 unless stated):

- Right: "Which maintainer has the widest reach into our dependency tree?"; "Which of the maintainers could hurt us the most?"; "Which account is the worst case for us?"; "Which of our teams has the most exposed repos?"; "Which version of chalk got hijacked?"; "Which dependency, when bumped, shields the most repos?"; "Which library would you drop first to cut the risk?"; "Which dependency matters most across all our repos?" (the carrier answer despite "all").
- Wrong or mixed, every one containing "all": "Out of all the maintainers, who is the biggest risk?" (list only); "Of all the packages involved, which one should I patch first?" (list only); "Which team should handle all of this?" (list only, no team named); "Which maintainer, out of all of them, is the riskiest?" (list, then the PageRank paragraph).
- Model-routed (honest if the model is up): "Which one of the maintainers has the widest reach?"; "Which one should I patch first?"; "Which one is the weakest link in our dependencies?"; "What is the single biggest weak link among our dependencies?".

Cause (from reading `ask.ts`): `questionFilter` (L122) sets `list` when the question contains `all|every|each|how many|list`, and `ask()` then prints `completeList()` first; `HEAD` fails to parse "which one …" (it takes "one" as an adjective and "of"/"has" as the noun) and "which transitive dependency" (an unknown adjective).

### Fix 1 detail: the model path (live)

Second open question in the cold run: "Is chalk or debug the bigger problem here?" (same question as round 7, when it returned "`debug@4.4.2` is the larger problem … 21 versus 17"). This time it returned "Answered from the graph", "Complete list (no filter): 21 repos across 7 teams", 30 of 30 claims, 11.3 s, and the counter read **1 of 4 model answers**: the model answered, `enforceCoverage()` found its text named some of the 21 repos without "of 21", discarded it and printed the list. `cold-04-open-2.png`. Deterministic repro without a model: `cover.mjs` feeds the repo's `ask()` a fake model reply, "`debug@4.4.2` is the bigger problem: it reaches 21 repos, including `acme/checkout-web` and `mochajs/mocha`, while `chalk@5.6.1` reaches 17 repos." Result: mode `template`, used 1, the list shown. With "21 of 21 exposed repos" in the reply it is kept (mode `live`); with no repo named, the list is appended to it. The rule is right for "list all repos" questions and wrong for a comparison.

### Fix 2 detail: refusal labels

| Reason | Label above the answer | How produced |
|---|---|---|
| `off-topic` | "Not answered from the graph: the graph's answers here are about something other than what this question names" | **Live on `:8080`**: "When was debug@4.4.2 published?", 0 of 4 kept, three clickable graph questions offered, header "LLM live" unchanged (`ask-r-offtopic.png`) |
| `no-model` | "Not answered: no language model is available" | Emulated events from the repo's `ask()` with a failing chat function, rendered by the real UI (`ask-emu-nomodel.png`). Also seen live in P2 above |
| `cap` | "Not answered: this triage's 4 model answers are used", counter "4 of 4 model answers" | Emulated (`ask-emu-cap.png`); reaching it live needs 4 model answers |

Each label is distinct and states the server's reason; the graph router refusal no longer blames model availability. Nits: the label and the first sentence of the body say the same thing twice, and a refusal shows both "Not checked against the graph." and "Unverified: no claim in this text was checked against the graph."

### Fix 3 to 5 detail: docs checked against code and app

| Claim | Code or app | Result |
|---|---|---|
| README:28, README:121, AI_USE:17, blog:76: "up to five observations": widest-reaching malicious version, shared carrier, directly declared ranges, busiest team, a repo with several malicious versions; verdict facts not offered | `observations()` in `server/agent/narrate.ts` builds `spread`, `carrier`, `own`, `team`, `many`; qix 13:30 yields 4 (`spread,carrier,own,team`); `many` needs exactly one exposed repo, which excludes the other three on an org, so five at once never happens (`obs.mjs`) | accurate list; "up to five" is one too many (say "up to four at a time") |
| README:13, proof-points: autoplay "about 12 s"; hero from ~2 s | measured: hero 21 at 1.96 s, caption 1.81 s, "Play the 90 minutes" at 12.1 s | true |
| `video/script.md:11` Beat 1 "about 14 s" | same measurement | **stale** (12.1 s) |
| `video/script.md` Beat 3 and 4 | pick and Notify on screen with no click; disclosure label as quoted; `[E3]` present after opening; chip strings match `Header.tsx`, `pickLabel()` | true |
| `docs/submission.md` description | 149 words by whitespace; card Cypher and on-request plan, open follow-ups through the tools with names and counts checked, MCP, paste: all match the app | true |
| `docs/launch-posts.md` L8, L28, L44, L53 | "The LLM only picks one observation by id; it never writes a fact" / "The LLM's only job is to pick one observation" / "An LLM only picks one observation from graph-built facts"; open Ask answers are model-written (labelled, guarded) | **overclaim**, the same one submission.md had |
| README:122 "Anything else goes to a bounded tool loop" | account, team, version and carrier routes exist, and a graph answer about the wrong entity is refused without a model | undersells; the refusal route is undocumented |
| `docs/AI_USE.md:9` "six rounds" | seven QA judge rounds exist (phase 3 and r2 to r7), plus this re-test | stale number |

### Fix 6 detail: console on the unknown-alert path

`Describe an alert…`, "log4j is on fire, 14:00 UTC", Enter: one `POST /api/triage 200 text/event-stream`, panel "The triage did not run: The alert names neither loaded incident: the qix compromise on 2025-09-08 (try "qix compromised, 13:16 UTC") or axios on 2026-03-31 (try "axios compromised, 00:30 UTC"). For anything else, use Paste your repo." Console 0 errors, 0 warnings, 0 page errors, 0 failed requests. Re-opening the alert box gives an empty field; "axios compromised, 00:30 UTC" then runs (26 tools, 46 of 46 claims, Mar 31 2026 00:30 UTC, 9 repos one install from malware).

### Fix 7 detail: polish items

- **Long chip (fixed).** In the pasted `FalkorDB/falkordb-browser` WHY line, `@typescript-eslint/eslint-plugin@6.21.0` is now a `span role="button"` that breaks like prose across two boxed lines (`paste-falkordb-browser-1440.png`); in a graph Ask answer, `@typescript-eslint/typescript-estree` does the same (`chip-long-answer.png`). The sentence is readable. Keyboard: Enter and Space activate it and open the trace; ArrowRight walks the row. Cosmetic: the first boxed line touches the preceding word. A11y nit: the span keeps `tabindex=0` while the row's other chips are roving (`-1`), so a row with a long chip has two Tab stops.
- **Repo column (not changed, by design).** Still `Fa…/falkordb-browser` at 1440; the header subtitle names the full repo.
- **`recall_triage` ACTION column (fixed).** After Mark remediated then Run again the cell reads `remediated` on one line (`recall-card-body-1440.png`); `swagger-api/ swagger-ui` wraps at the slash, acceptable.
- **FalkorDB time wording (fixed).** Graph stats now reads "FalkorDB time, summed over queries 502.2 ms / includes 42 cached calls, each at the time it first took" above "Run total, wall clock 214 ms". The header pill title and the tool-calls heading title say the same. The visible pill still reads "Built on FalkorDB 502.2 ms" with the explanation only in the tooltip and screen-reader text, which is enough. `stats-1440.png`.
- **MCP `incident` mismatch (fixed).** `incident_exposure` with `{scenario: qix, incident: axios}` and the reverse now return `isError` "incident must equal scenario: each Acme org graph holds only its own incident. Omit incident to use the scenario's."; with only `{scenario, at}` or a matching `incident` it returns 21 rows (1 LOCKED, 20 WOULD_PULL); missing `at` gives the validation error; `tools/list` returns the same 10 tools.
- **Stray period (fixed).** "how many repos pull chalk through supports-color?" now reads "No exposed repo gets `chalk@5.6.1` through `supports-color` at 13:30 UTC: in no lockfile here does `supports-color` declare a range that admits it." 3 of 3 claims, one `filter_exposures` card, "0 of 21 exposed repos match".

## 3. Timed 60-second cold journey

Cold judge, 1440x900, `:8080`, one fresh context (`cold.cjs`), times from `page.goto`.

| T+ | Step | What happened | SS |
|---|---|---|---|
| 0:00.2 | Land | DOMContentLoaded; hero "21 repos one install from malware" at 1.96 s, caption "no advisory for 74 min, until 14:26" at 1.81 s | `cold-01-land` |
| 0:12.4 | Autoplay done | "Play the 90 minutes" at 12.1 s | |
| 0:14.1 | Run triage | first card 163 ms, "Triage complete: 49 tools, 61 of 61 claims traced to graph queries." at 415 ms | `cold-02-triage` |
| 0:15.0 | First viewport | pick line y=490, Notify y=568, "Next qix?" y=594, Ask box y=797, table y=279, all in view with no scroll; at 1280x720 pick 424, Notify 518, Ask 617, table 273, no horizontal scroll ("Next qix?" dropped by design) | `triage-1280` |
| 0:15.5 | Click `mochajs/mocha`, open "Show 2 more evidence paths …" | `[E3]` appears only after the disclosure; clicking it opens the card | `cold-03-disclosure` |
| 0:20.7 | Open question 1 (P2) | 4.1 s, "Not answered: no language model is available" plus the graph's summary; no follow-up used | `cold-04-open-1` |
| 0:32.1 | Open question 2, "Is chalk or debug the bigger problem here?" | 11.3 s; the 21-repo list under "Answered from the graph", counter 1 of 4 | `cold-04-open-2` |
| 0:36.4 | Paste `FalkorDB/falkordb-browser` | 3.4 s, "Triage complete: 9 tools, 30 of 30 claims traced". WHY: "its dependency `@typescript-eslint/eslint-plugin@6.21.0` declares `^4.3.4`, which admits `debug@4.4.2` [E1]". Verdict "was safe if installed from your committed lockfile … Only a fresh install between 13:12 UTC and 15:15 UTC on 2025-09-08 would have fetched `debug@4.4.2` …". Header "LLM template". Toast "2 follow-ups from the 13:30 UTC run cleared: this run starts a fresh set of 4." Still the strongest moment of the journey | `paste-falkordb-browser-1440` |

Other timings: graph Ask 0.33 to 0.40 s in all 12 runs; page weight 12 requests, 357 KB; CLS 0.0039 at landing (0.002 at 1280) and 0.063 over the whole journey including the paste. One measurement caveat: with no input, the page's last LCP candidate is the decorative "74 min" scribble image appearing at 11.9 s (1440) and 11.8 s (1280); real content paints at 0.18 to 0.25 s. Lab or field tools that wait for an idle visitor would report about 12 s.

## 4. Numbers spot-checked in FalkorDB (read-only, my own Cypher)

| App says | FalkorDB | Result |
|---|---|---|
| "12 repos across 5 teams" reach `debug@4.4.2` through `@typescript-eslint/typescript-estree` | `MATCH (:Incident {id:'qix-2025-09-08'})-[:INVOLVES]->(bad:Version {id:'debug@4.4.2'})<-[a:ADMITS]-(p:Dep {name:'@typescript-eslint/typescript-estree'}) WHERE a.fromT <= 1757338200000 AND 1757338200000 < a.toT RETURN count(DISTINCT p.repo)` gives 12 | match |
| `chalk@5.6.1` reaches 17 repos (by-version answer) | repos locking it (1) union repos with a live `ADMITS` edge to it (17), union 17 | match |
| `CLI` 5 repos; 21 repos across 7 teams | `(:Repo)-[:OWNED_BY]->(:Team {name:'CLI'})` gives 5 (`npm/cli`, `microsoft/TypeScript`, `nestjs/nest-cli`, `http-party/http-server`, `netlify/cli`); 21 repos, 7 teams | match |

Replay and earlier-pass numbers were not repeated. Also confirmed: the Graph stats tab still shows `pz_acme_qix`, 46,810 nodes, 123,426 edges, Dep 27,349, Version 10,210, Package 5,373, Maintainer 3,817, Advisory 30.

## 5. Scores

| Dimension | Score | Justification |
|---|---|---|
| Clarity | 9.4 | Point in 2 s, one primary CTA, and after triage the verdict, pick, Notify, next target, table and Ask box all in the first viewport at 1440x900; at 1280x720 everything but the deliberately dropped "Next qix?". Refusals say the server's real reason, the FalkorDB figure says what it sums, the long chip reads as a sentence, the recall column no longer breaks. Docked: refusal text says the same thing in the label and the first sentence, plus a double "not checked" line; "Roster" is still open-only; the circle appears at 12 s |
| Speed | 9.4 | First card 163 ms, triage complete 415 ms, graph Ask 0.33 to 0.40 s, paste 3.4 s, 12 requests and 357 KB, CLS under 0.01 at landing. Docked: the two model answers took 4.1 s (failed) and 11.3 s against 1.9 to 2.1 s last pass (shared free tier, partly my own load); the idle-visitor LCP is the decorative circle at about 12 s |
| Correctness | 9.1 | Every number I re-computed matches. The three repro questions, "through which packages" and five of six new paraphrases answer the right question; docs now describe the observations as built. Docked: "Of all the maintainers, which one …" and three more "all" phrasings print the 21-repo list as the answer (or ahead of it); a model comparison answer is replaced by the same list; "up to five" and "about 14 s" are still wrong in the docs |
| Trust | 9.0 | Honest labels on every refusal and model answer, write-back real and session-scoped, MCP guarded against the mismatched incident, console clean even on the unknown alert, submission copy now accurate, merge note gone. At the bar, not over it: a green "verified" badge still appears on a different question in two reachable ways (the `all` phrasing; the coverage replacement that also spends a follow-up), `docs/launch-posts.md` still says the LLM never writes a fact, the author-addressed "confirm and restate" note remains in `docs/AI_USE.md`, and README `<render-url>` / `<video-url>` are placeholders (user-owned) |
| Delight | 9.3 | Instant cards, the paste of a judge's own repo flagged in 3.4 s with a proper sentence, the "follow-ups cleared" toast, a graph answer in a third of a second, Mark remediated read back by the next run. Docked: my two open questions gave a provider refusal and a list dump |
| Accessibility | 9.3 | axe (wcag2a/aa, 21a/aa, 22aa, best-practice) 0 violations in 7 states: landing, after triage, graph Ask with a long chip, refusal, Graph stats, alert error, 1280x720 after triage (contrast "incomplete" only on the dense states). The new `span role=button` chip works from the keyboard (Enter, Space, ArrowRight). Docked: that chip is always a Tab stop (a row with one has two), "Roster" exposes no expanded state, contrast "incomplete" unresolved |

Mean of the six: 9.25. Bar of 9 met on all six; Trust is exactly at it.

## 6. Remaining ranked fixes

1. **Ask: "all / every / each" and "which one …" still bypass the head-noun routing (Correctness, Trust).**
   - Repro: after triage, Ask "Of all the maintainers, which one has the widest reach into our dependency tree?" Also "Which team should handle all of this?" and "Which maintainer, out of all of them, is the riskiest?".
   - Saw: "Answered from the graph", 30 of 30 claims verified, "Complete list (no filter): 21 repos across 7 teams. `Payments`: …" with no maintainer or team named (the third prints the list, then the PageRank paragraph).
   - Expected: the PageRank answer alone (account head), the per-team list (team head), or an honest refusal.
   - Suspect: `server/agent/ask.ts`: `questionFilter` sets `listing` on `\b(all|every|each|how many|list)\b` (L105 `REPOS_Q` and L122) and `ask()` prints `completeList()` first; `list` should be false when `headOf(lead)` resolved to account, team, version or incident. `HEAD` (L220) should skip a filler "one" ("which one of the maintainers") and one unknown adjective ("which transitive dependency"), so P2 routes to the carrier answer too.
2. **Coverage rule replaces a model answer with the complete repo list on non-list questions (Trust).**
   - Repro: Ask "Is chalk or debug the bigger problem here?" (model-backed; wording dependent, so run it a few times), or `node cover.mjs` for the deterministic version.
   - Saw: "Answered from the graph", the 21-repo list, 30 of 30 claims, counter "1 of 4 model answers": the model's comparison was discarded and a follow-up was spent.
   - Expected: keep the model's answer (it already passed the guard); apply `enforceCoverage` only when the question asked for a list, or append the list instead of replacing; do not charge the follow-up when the text is replaced.
   - Suspect: `server/agent/ask.ts` `enforceCoverage(text, last)` call in `modelAnswer()` (L462) and `run.used` accounting (L394).
3. **Launch copy still carries the old overclaim, and four small doc drifts (Trust).**
   - Repro: read `docs/launch-posts.md` L8, L28, L44, L53.
   - Saw: "The LLM only picks one observation by id; it never writes a fact" and "An LLM only picks one observation from graph-built facts".
   - Expected: the submission.md wording ("picks one graph-built observation by id and answers open follow-ups through the same tools, with every name and count checked"). In the same pass: "up to four at a time" instead of "up to five" (README:28, README:121, AI_USE:17, blog:76); `video/script.md:11` "about 12 s"; `docs/AI_USE.md:9` "seven rounds"; README:122 should name the account, team, version and carrier routes and the refusal.
4. **Long chip keeps `tabindex=0` (Accessibility, minor).**
   - Repro: Ask "Which repos get debug@4.4.2 through @typescript-eslint/typescript-estree?" and Tab through the answer; the row has the `span` plus one roving button as Tab stops.
   - Expected: one Tab stop per row, as the roving design says; `web/src/components/NarrativePanel.tsx` span chip (`tabIndex={0}`) should take the roving tabindex. Also add a little inline margin so the first boxed line does not touch the previous word.
5. **Idle LCP is the decorative circle (Speed, minor).**
   - Repro: open `http://localhost:8080/` at 1440x900 or 1280x720, touch nothing for 14 s, read the `largest-contentful-paint` entries: 0.25 s footer text, then 11.9 s `IMG.scribble`.
   - Expected: the end-of-autoplay flourish does not become the LCP element. Draw it as an inline SVG path with a stroke animation (SVG shapes are not LCP candidates).
6. **Known, not ranked (user-owned).** README links row `https://<render-url>` and `https://<video-url>`; `<blog-url>`; A9 absolute `og:image`; the "for the author to confirm and restate" decisions list in `docs/AI_USE.md`; refusal text duplication (label and first sentence).

## 7. Console, measurements and process notes

- **Console**: 0 errors, 0 warnings, 0 page errors and 0 failed requests in the Ask battery (12 questions), the two emulated refusals, the cold journey (triage, disclosure, two model questions, paste), the unknown alert and the valid alert after it, the mark-remediated run, the long-chip walk and the 1280x720 run. `requestfailed` showed only cancelled fetches. axe ran in separate `bypassCSP` contexts so the console runs stayed on the real CSP.
- **axe-core**: 0 violations in 7 states (section 5).
- **FalkorDB reads**: `GRAPH.RO_QUERY` only; three numbers in section 4, plus the `Triage` / `ASSESSED` counts below.
- **Process notes**: about 12 triage runs went through the app, each making one model pick call on the shared free tier; I used exactly 2 model-backed open questions and 1 pasted repo as allowed. One **Mark remediated** on `mochajs/mocha` (the recall-card check) wrote a session-scoped `(:Triage)-[:ASSESSED {action:'remediated'}]->(:Repo)` record through the app; my script's Undo click did not find a button, so that mark stays (read-only count now: 1,030 `Triage` nodes, 30 `remediated` edges; it is invisible to any other browser session and pruned with the rest). I imported repo modules (`ask.ts`, `narrate.ts`) in my own scripts, read-only; the offline oracle uses a fake chat function and spent no quota.
- **Not tested**: replay mode on `:8080` (the replay strings are code-verified in `Header.tsx` and `pickLabel()`, and were reproduced offline last pass), the `cap` and `no-model` labels against a real exhausted or failing model (emulated events through the real UI), share link, phone widths, Firefox and WebKit, cold boot and the Render deploy, the Claude Code MCP session in Beat 10, a second paste for axe on a pasted-repo state (the 1-paste budget was spent on the cold journey; the long chip was axe-checked in the org run through an Ask answer instead).
