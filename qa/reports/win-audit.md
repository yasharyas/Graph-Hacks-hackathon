# Win-gap audit: what is still pending to WIN Track 1

**What this is.** A judge-persona audit run on 2026-10-16 as an arena: three independent auditors (Opus, Sonnet, Fable) and a Sonnet cross-judge.
- **Build audited:** main 2230c1b. The fix agents' merges since then (up to 0b6cca9) touched only the Fix drawer, export, table and paste box.
- **How:**
  - the GitHub API and repo page
  - the README
  - the production build on `:8080`, in headless Chromium at 1440x900
  - read-only FalkorDB queries (`GRAPH.RO_QUERY` and `GRAPH.EXPLAIN`)
  - the MCP server over stdio
  - the official hackathon page
- **Evidence:** the candidates' reports and screenshots are in the session scratchpad (`arena-win/`). Every item below was reproduced by at least one auditor and spot-checked by the cross-judge or by the orchestrator.

## Verdict

As of today the entry cannot win. It is not even complete: rule 10 requires a demo video and none exists (README:6 is `https://<video-url>`). There is no live URL either (README:5), so a judge would have to build three containers to see it.

The product itself is not the gap. All three auditors re-verified the following:

| What | Verified result |
|---|---|
| Numbers | 46,810 nodes and 123,426 edges; the 19 qix versions; 20 of 20 and 9 of 20 repos; 14 repos across 6 teams; 74 and 106 min; PageRank top 3 |
| Triage | 49 tool calls in under 1 s, with 61 of 61 claims traced |
| Cypher | every copied statement runs as pasted in FalkorDB |
| Graph features | `GRAPH.EXPLAIN` on every card, `GRAPH.COPY` tenancy, and the read-only ACL user |
| MCP | the server answers |
| Paste | works on `microsoft/vscode`, `axios/axios`, `vercel/next.js` and `FalkorDB/falkordb-browser` |
| Console | 0 errors |

What stands between this and first place is packaging, plus how the agent comes across. The Track 1 focus list on the official page names:
- multi-hop reasoning
- graph queries and algorithms as agent tools
- tool selection through MCP
- actions based on what the graph shows
- explainable results

The entry does all five, but a judge sees at most two of them in the first minute. The one place a judge talks to the agent (Ask) can answer the wrong question under a green "verified" badge.

**Prizes.** The page lists a **Best blog post** side prize (AirPods 5, 1 winner) and a **Top 50** T-shirt. The blog is already written. It is unpublished.

## Rule compliance

| Rule | Status | Evidence / gap |
|---|---|---|
| R10 public repo | Met | public, MIT, 77 commits, one author |
| R10 README: setup + graph data model | Met, buried | model at README:82-95; setup at README:357, after 230 lines of generated Cypher |
| R10 Cypher / algorithms | Met, strong | README:103-355 is generated from `cypher.ts` and drift-tested; `algo.pageRank`, `shortestPath` |
| R10 **demo video** | **Missing** | only `video/script.md` exists |
| R10 live deploy or local setup | Partly | local setup is complete on paper (not executed by the auditors); there is no live URL |
| R10 / R5 track named | Met in README | must also be picked on the form |
| R2 FalkorDB central | Met | every panel comes from `GRAPH.RO_QUERY` rows streamed as tool cards |
| R3 graph is not decoration | Met, one framing risk | `docs/proof-points.md:4` advertises a "graph-free" oracle, which hands a skeptic the line |
| R6 data | Met | 20 public lockfiles pinned by SHA; synthetic teams and two badged synthetic repos |
| R8/R9 work in the window | Met, optics | the first four commits share `2026-10-15 14:32:29 +0530` (Phase 0 history was rebuilt to 4 commits, `docs/decisions.md:24`), with no note saying why |
| R11 AI disclosure | Met | README:380, `docs/AI_USE.md` |
| R12 can explain | Met, one contradiction | README:77, blog:66 and decisions.md:63 say `EXPLAIN_PATH` "starts from the indexed `Version`". The app's own Show plan (and `GRAPH.EXPLAIN`) starts at `Node By Index Scan \| (x:Dep)` |
| R13 not wholly AI-made | Risk | the disclosure is honest, but it omits the AI persona QA, the AI security reviews ("Two independent security reviews", README:367) and any visible record of the author's own decisions |
| R16 no canvassing | Met | `docs/launch-posts.md:3` |

## Pending, ranked, by owner and day

Effort: S ≤ 1 h, M ≤ 4 h, L > 4 h. The deadlines are code freeze **Oct 18 13:00 IST** and submit about **20:00 IST**.

### USER: start today (Oct 16)

1. **BLOCKER (in practice): deploy to Render (M).**
   - Create the Blueprint from `render.yaml`.
   - Set `GROQ_API_KEY`, `GEMINI_API_KEY` and a fine-grained read-only **`GH_TOKEN`**. Render's free instances share outbound IPs, so the anonymous 60/h GitHub quota runs out. Paste then falls back to the HEAD lockfile instead of the pre-incident snapshot.
   - Point UptimeRobot at `/api/health` every 5 minutes. A cold boot is about 28-30 s (an inference from `docs/proof-points.md`, not measured on Render).
   - **Done when** you send me the URL. I then smoke-test triage, a graph Ask, a paste and a share link, and fill every `<render-url>`.
2. **GitHub repo page (S).** This is the first screen a judge sees.
   - **Description:** "Exposed before the advisory exists: npm supply-chain triage on FalkorDB".
   - **Topics:** `falkordb`, `graph-database`, `cypher`, `npm`, `supply-chain-security`, `mcp`, `agents`.
   - **Homepage:** the live URL, after step 1.
   - **Social preview:** `web/public/og-card.png`.
   - Optional: rename the repo to `patient-zero`. GitHub redirects the old URL.
3. **Issue #1 (S).** A stranger's code-search alert, "plain-crypto-js … is in your lockfile" (open, 0 replies). It is triggered by the intentional synthetic fixture `fixtures/synthetic/billing-api.package-lock.json`. A security-minded judge clicks it first.
   - Reply that it is a deliberate LOCKED fixture for a supply-chain triage tool, thank them, then close.
   - Posting publicly is your call: do it yourself, or tell me to and I will do it with `gh`.
4. **A second free LLM key (S, optional).** Gemini returns 429, so Groq is the only live model. Under judge load, open-ended Asks get "Not answered: no language model is available". Any OpenAI-compatible free provider works; add it to `LLM_CHAIN` on Render. Items A1 and A2 below cut how often the model is needed at all.
5. **Publish the blog on dev.to (S)**, once the live URL exists (the video link can be added later). This is a second shot at a prize. The post is first-person, which is the best rule-12/13 evidence the entry has.

### AGENT: Oct 16-17, in this order

**A1. WIN (M): Ask must never answer a different question under a "verified" badge.** These six questions all fail today (`server/agent/ask.ts`):

| Question | What happens today |
|---|---|
| "If ljharb were hijacked, how many repos?" | The 21-repo incident list. The graph says ljharb reaches **20** (`how many` sets `listing`, ask.ts:94) |
| "Which malicious version reaches the most repos?" | Per-team counts (`TEAMS` matches "most repos", ask.ts:138) |
| "If we can only change one dependency today, which upgrade removes the most exposure?" | The urgency list (`PRIORITY`) |
| "Which single package should we remove first?" | The generic plan (`FIRST` matches "first") |
| "Which repos get debug@4.4.2 through @babel/core?" | Refused with no model, though the server already builds that carrier observation |
| "Explain this incident to a new on-call engineer in plain words" | Goes to the model, which said the LOCKED repo "pins debug@4.4.1 … instead of the malicious debug@4.4.2", the exact inverse, under "27 of 27 names found". `SUMMARY` has no `explain\|plain words\|walk me through\|what happened\|new on-call` |

Done when:
- A named maintainer routes to `maintainer_blast_radius`.
- "Which version / package / carrier / upgrade … most repos" and "through <pkg>" route to one deterministic grouping of exposures by bad version and by carrier.
- "Explain / plain words" routes to the graph summary with the tier glossary.
- A question whose named entity the chosen route does not use gets an honest "not answered from the graph".
- All six are regression tests.
- No prose-regex guard heuristics (dropped, see below).

**A2. WIN (S): show the agent on the first screen after triage.** Today the analyst pick, the 7-team Notify roster and the Do steps all sit behind one disclosure. Done when, at 1440x900 and 1366x768 with no click:
- one line reads "Analyst pick · LLM live|replayed: <observation>"
- one line reads "Notify 7 teams · Copy notices"
- one "Next qix? sindresorhus: 43% of PageRank, reaches 21 of 21 repos" line opens Concentration
- the Ask placeholder is an agent-style question

This keeps the round-6 fold for everything else.

**A3. WIN (S): the README's first screen.** Today there is no image anywhere, and "Run it locally" is at line 357. Done when, under the tagline, the README has:
- the og-card, or a post-triage screenshot
- one links row: Live · Video · Run locally · Data model · Cypher · MCP · AI use
- a five-step "Judges: 60 seconds" tour: land, Run triage, click mocha, Copy a Cypher and run it, paste a repo
- a "What the agent does" list in perceive / decide / act order:
  - turns an alert into a target
  - runs the playbook over FalkorDB
  - drafts fixes and notices
  - writes `(:Triage)-[:ASSESSED]->(:Repo)` and remediation marks back to the graph as `pz_rw`
  - the same tools over MCP, with a short real MCP transcript

Also:
- "Run it locally" moves above the Cypher block.
- The Cypher block may go inside `<details>` if `test/readme.test.ts` stays green.

**A4. WIN (S): README, blog and docs claims the app contradicts.**
- `EXPLAIN_PATH` wording at README:77, blog:66 and decisions.md:63 must match the plan: Dep index on `repo`, then the traverse to Version.
- README:24: the 74-min caption shows at about 2 s; it is only the scribble that waits.
- README:367: "independent" becomes "two AI-run security reviews (Opus)".
- One sentence: the graph-free oracle is a differential test of the tier counts only. It has no paths, owners, carriers, concentration or tenancy, and the app never calls it.
- README Limits: two incidents are ingested (qix, axios). Paste-your-repo is general.
- One sentence: a replay is a recorded pick id, not prose.

**A5. WIN (S): a complete AI disclosure and a record of the author's decisions** (rule 13). In `docs/AI_USE.md`:
- name the AI persona QA (`qa/reports/`), the AI security reviews, and AI-drafted copy
- add a dated factual list of decisions taken during the build, for the author to review and restate in their own words:
  - one `Dep` per lockfile location
  - cutting the LLM's free text after QA
  - the `WOULD_PULL` wording
  - the scope cuts
  - the security rules
- add a one-line build timeline explaining the four Phase-0 commits at 14:32:29

**A6. WIN (S): re-walk `video/script.md` against the merged app.** The script has drifted:

| Script | App today |
|---|---|
| Paste beat: "same 49 calls" | A pasted repo runs **9** |
| "Playhead stops at 13:30" | Autoplay runs to 14:30 |
| VO and caption "twenty / 20 of 20" | The hero reads 21 (20 + 1 LOCKED) |
| Beat 7 "Click Try axios" | After triage it is the `axios · Mar 2026` radio |
| Beat 7: "106 min" on screen, "2 h 54" in the VO | No explanation of the difference |
| Axios shown with vendor alert first | Its OSV record (02:07) came *before* the vendor alert (02:19) |
| Notify / Do "land" | They are folded (until A2) |
| End card | `<repo-url>` and `<render-url>` |

Also add a 10 s **Mark remediated → graph write → Triage history** beat. It is the one place the agent acts back on the graph. Recording notes must name each control and each disclosure to open.

**A7. WIN (S): `docs/submission.md`, the form copy pack.**
- title and tagline
- a 150-word description
- "How FalkorDB is used" bullets
- Track 1
- a one-line AI note
- links in judge order (video, live, repo, blog)
- cover image `og-card.png`
- one checklist of placeholders

**A8. POLISH (S): MCP and the alert box.**
- `incident_exposure` takes `incident` defaulting to `scenario`. The impact is small, since the server's instructions say they are equal, but it is one line.
- The alert-box error names the two loaded incidents and points to Paste.
- Do not document a `docker compose exec` MCP one-liner until it has been run.

**A9. POLISH (S, after the URL exists): absolute `og:image` / `twitter:image` and add `og:url`.** Today `web/index.html:15,26` is relative, so LinkedIn, X and Slack unfurls show no card.

**A10. POLISH (S): Docker font fetch.** Retry with backoff before failing (`Dockerfile:8-10`, `fetch-fonts.mjs:101,112`). The Fontshare licence forbids committing the fonts, and a silent system-sans fallback breaks the type rule, so retry is the fix.

### USER: after the freeze (Oct 18 13:00-20:00)

6. **BLOCKER: record and publish the video (L)** from the corrected script (A6), in replay mode, in your own voice. Explaining one `Dep` per lockfile location, the `ADMITS {fromT, toT}` edge and `EXPLAIN_PATH` yourself is the strongest rule-12/13 evidence there is.
7. **Freeze checklist (S):**
   - tag `v1.0-submission` and pin Render to it
   - fill `<video-url>` (I can do this)
   - submit the form with `docs/submission.md`, Track 1
   - then the launch posts, with no vote requests

## Not worth doing

- **Real Slack sends or GitHub PRs.** They need OAuth on a public demo and risk spamming real OSS repos. Surface the existing acts instead (A2, A3, A6).
- **Text-to-Cypher in Ask.** It breaks the read-only, every-claim-traced story. Deterministic routes (A1) are the better trade.
- **A scale benchmark against a naive scan.** The graph-free oracle does the qix tiers in 0.67 s, so the comparison backfires. Argue on capabilities instead.
- **A bigger or 3D graph view.** The selected chain already reads at a glance, and flash does not beat Cypher that runs verbatim.
- **Entering Track 2 or 3 as well.** The memory is session-scoped and the scoring of multi-track entries is unstated, so it dilutes the one clear story.
- **A third incident ingest, or yarn/pnpm/PyPI.** These are L effort with regression risk. Paste-your-repo already shows generality, and the limits are documented.
- **More persona QA rounds.** Round 6 sits at 8.7 to 9.2 with 0 high/medium security findings. The remaining gaps are routing and packaging, which another round would not find.
- **A "recorded agent run" in the Ask refusal state.** It is a new feature near the freeze, and it could read as a simulated agent. A README MCP transcript and a second key cover it.

## First 10 s / first 60 s (measured on `:8080`)

- **0.4 s:** the shell paints.
- **About 1 s:** the graph of 21 MAINTAINER repos is drawn.
- **2.2 s:** "21 repos one install from malware, 20 safe with npm ci", LOCKED 1 / WOULD_PULL 20 against "Advisory scanner 0", and the caption "no advisory for 74 min, until 14:26".
- **About 12 s:** the circled "74 min".
- **Run triage:** the first card in 0.4-0.8 s, the full verdict in under 1.1 s.
- **Within about 60 s:**
  - a row click draws the chain
  - Copy Cypher runs verbatim
  - Show plan takes 70 ms
  - a graph Ask answers in 0.8-1.8 s
  - axios takes 0.3-1.8 s
  - a paste takes 1-5 s
- **What does not land:**
  - the agent and its acts (A2)
  - MCP (A3)
  - PageRank (A2)
  - FalkorDB, which shows only as a small pill
  - "qix", which is better known as the chalk/debug compromise; the hero never says chalk
  - everything on GitHub: no image, no description, placeholders, and an open malware issue

## Arena synthesis note

- **Runners:**
  - C1: Opus. Cross-judge 19/20, my score 20.
  - C2: Sonnet. Cross-judge 17, my score 19.
  - C3: Fable. Cross-judge 16, my score 18.
  - The cross-judge was Sonnet, read-only.
  - No dropouts.
- **Convergence:** all three independently ranked the same shape. That is two USER blockers (video and deploy), then the README first screen, script drift, Ask trust, the GitHub page and the rule-13 defence. That agreement is the strongest signal in this audit.
- **Base: C1.** It had the cleanest evidence with zero false positives, the best ordering, and the only R12 hazard (the EXPLAIN wording that the app's own plan contradicts). Its Ask-misroute item was already one agent brief. The cross-judge agreed.
- **Grafted from C2:**
  - the blog side prize, and the Track 1 focus list behind A2 and A3
  - the maintainer misroute and the `FIRST` misroute (A1)
  - 106 vs 2 h 54 and axios-OSV-before-alert (A6)
  - the Mark-remediated beat (A6)
  - the two-incident alert box (A8)
  - the MCP `incident` default (A8)
  - the "Next qix?" line (A2)
  - the decisions list (A5)
  - cold-start as an inference
- **Grafted from C3:**
  - the inverted LOCKED answer and the "plain words" route (A1)
  - the folded agent (A2)
  - the "Try axios" drift (A6)
  - moving "Run it locally" up (A3)
  - `og:url` (A9)
  - the replay sentence (A4)
  - the author's own voice in the video (6)
- **The orchestrator added:**
  - the day-by-day ordering, which none of the three gave
  - retry rather than a system-sans fallback, because of the Fontshare licence and the type rule
  - the Top 50 prize note (from the cross-judge)
- **Rejected:**
  - **all win probabilities** (2-55% across the three): no criteria are published, so these were guesses
  - **C3's sentence-level guard heuristics** (LOCKED next to a safe pin, and superlatives): fragile prose regexes two days before the freeze. Routing fixes the cases found.
  - **C2's recorded agent run** (see "Not worth doing")
  - **C2's untested compose MCP one-liner**
  - **C3's beat-5 Fix-drawer mismatch:** stale after 901c879
  - **C2's "Graph stats below the fold":** the header pill opens it in one click; only Concentration is buried
  - **C1's "evasive" framing of the disclosure:** kept only the factual edit
  - **The git tag as a ranked item:** moved to the freeze checklist
- **Verification:**
  - **The cross-judge re-checked the six riskiest claims against HEAD 0b6cca9 and found all of them true:**
    - ljharb reaches 20 repos
    - the EXPLAIN plan starts at the `Dep` index
    - the LOCKED fixture pins 4.4.2 and 5.6.1
    - the blog prize exists
    - the four commits share one timestamp
    - MCP requires `incident`; true, but the impact was overstated
  - **I re-ran:**
    - `GRAPH.EXPLAIN` on `EXPLAIN_PATH`: `Node By Index Scan | (x:Dep)` first
    - grep for "independent" at README:367
    - the routing regexes at ask.ts:94 and :135-139
    - the relative og tags at index.html:15,26
    - issue #1 through the GitHub API
