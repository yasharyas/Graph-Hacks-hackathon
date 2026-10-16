# Proof points

The only numbers the README, video, blog and posts may quote. Each line names its source. Recompute with
`node scripts/exposure-oracle.ts <scenario> <atISO>` (graph-free) and, once the graph is up, the matching Cypher.
The oracle is a differential test, not a second engine: it reproduces the tier counts only, with no paths from the root, owners, carrier grouping, concentration or tenancy, and the app never calls it.

## Advisory timing (source: npm packument `time` map in `data/cache/npm/packuments.json`, OSV `published` in `data/cache/osv.json`)

- qix, 2025-09-08: first malicious publish `ansi-styles@6.2.2` at 13:12:10Z; `debug@4.4.2` at 13:12:39Z. First OSV record (MAL-2025-46974, debug) published 14:26:51Z. **74 minutes** with no advisory-based signal.
- axios, 2026-03-31: `axios@1.14.1` published 00:21:58Z; its own OSV record (MAL-2026-2307) at 03:15:49Z: **2 h 54 min**. The campaign's first OSV record was for the dropped dependency `plain-crypto-js@4.2.1` (MAL-2026-2306) at 02:07:58Z, 2 h 09 min after that package was published (23:59:12Z on 03-30). Say "axios@1.14.1 had no OSV record for 2 h 54 min", not "the campaign had none".
- Vendor detection was fast (Aikido flagged qix at ~13:16Z). We are a triage layer, not a detector.

## Acme exposure (source: `scripts/exposure-oracle.ts`, historical lockfiles in `data/cache/lockfiles/`)

- qix at 13:30Z: **20 of 20** real repos would fetch at least one malicious version on a fresh resolve; **13** through production dependencies.
- Declared directly in the repo's own package.json at the qix snapshot: `npm/cli` (`chalk ^5.4.1`, `supports-color ^10.0.0`), `mochajs/mocha` (`debug ^4.3.5`), `remy/nodemon` (`debug ^4`), `github/docs` (`chalk ^5.0.1`).
- axios at 01:30Z: **9 of 20** repos; `louislam/uptime-kuma` declares `axios ~0.30.3` directly, which resolved to the malicious 0.30.4.
- Wording rule: "would have fetched on a fresh resolve", never "was compromised". `npm ci` with a committed lockfile was safe.

## Graph-confirmed (source: `node server/agent/triage.ts <scenario> <atISO>` against the built graphs; matches the oracle exactly)

- qix at 13:30Z (21 repos incl. synthetic `acme/checkout-web`): LOCKED 1, WOULD_PULL 20, CLEAN 0; app shows **74 min** ahead.
- axios at 01:30Z (21 repos incl. synthetic `acme/billing-api`): LOCKED 1, WOULD_PULL 9, CLEAN 11; app shows **106 min** ahead (to the campaign's first OSV record, MAL-2026-2306).
- Graph size: `pz_acme_qix` 46,810 nodes / 123,426 edges / 24 MB, built in ~3.3 s. Baked RDB 11.6 MB.
- Top maintainer concentration (PageRank mass): sindresorhus, ljharb, types.

## Data scope

- 20 real public repos + 2 synthetic (badged), lockfiles as of 2025-09-08T13:00Z and 2026-03-31T00:00Z.
- Graph size (Graph stats in the app): the qix graph holds 5,373 packages, 10,210 versions and 27,349 lockfile entries for 21 repos; the axios graph 5,490 packages, 9,941 versions and 27,211 entries. Maintainers are stored as usernames only (no emails). 92 packuments carry full version timelines.

## Agent behaviour (source: live runs against the dev graphs, 2026-10-15/16; `test/api.test.ts`, `test/narrate.test.ts`)

- Ask "which exposures are prod-only and who owns them?" at qix 13:30Z: **14 repos across 6 teams**, answered from the graph (`filter_exposures`), never in a model's words.
- Analyst pick: the LLM chooses one of the observations the server built from the graph, so its words are always the graph's. The pick varies by run and provider; the recorded replays pick the shared-dependency observation: at qix 13:30Z "4 repos' shortest paths to a malicious version run through the same dependency, `@babel/core`" (socket.io, jquery, pdf.js and 1 more), at axios 01:30Z "2 repos' shortest paths ... through `nx`" (appium, nest). Counting every path, not only the shortest, 16 repos reach `debug@4.4.2` through `@babel/core` at qix 13:30Z (Ask "which repos get debug@4.4.2 through @babel/core?", `EXPOSURE_CARRIERS`). A live run may pick another observation; every option is built from the graph.
- Every claim in the narrative is checked against the run's evidence: a qix run traces **all of its claims, about 60** (the exact count depends on the analyst pick and on what the session has marked remediated).

## On screen (source: the production build on `:8080` in headless Chromium at 1440x900, plus a replay-mode API with `LLM_CHAIN=replay`, 2026-10-16)

- Landing (qix): the autoplay runs 13:05 to 14:30 UTC in about 14 s. From about 2 s the hero reads "21 repos one install from malware, 20 safe with npm ci" (LOCKED 1 + WOULD_PULL 20) next to "Advisory scanner 0", and the caption "13:12 malicious versions out · no advisory for 74 min, until 14:26" is on screen. The circled "74 min" appears at about 12 s, once the playhead passes 14:26.
- qix triage at 13:30: **49 tool calls** (with a browser session; `recall_triage` is one of them). The Notify roster lists **7 teams**. Replay mode traces 62 of 62 claims; a live run that picked another observation traced 61 of 61.
- axios triage at 01:30: **27 tool calls**; the hero reads "10 repos one install from malware, 9 safe with npm ci" (LOCKED 1 + WOULD_PULL 9). The timeline marks read 00:21 exposed, 02:07 OSV, 02:19 alert, 03:15 removed: the first OSV record came before the first vendor alert.
- A pasted repo (`mochajs/mocha`, qix 13:30) runs **9 tool calls**, judged on its `package-lock.json` at commit 5f8e8a8 (2025-09-01), the last change before the incident.
- Mark remediated on `mochajs/mocha`, then Run again: the `recall_triage` card reads "21 repos assessed earlier in this session; 1 marked remediated: mochajs/mocha", and Triage history lists the mark.
- Concentration tab (each maintainer's share of the top 3's combined PageRank): sindresorhus 43% (307 packages, reaches 21 of 21 repos), ljharb 29% (183 packages, 20 of 21), types 29% (234 packages, 20 of 21).

## Graph, read-only checks (source: `GRAPH.RO_QUERY` / `GRAPH.EXPLAIN` on `pz-falkor`, 2026-10-16)

- ljharb: the `MAINTAINER_BLAST_RADIUS` query reaches **20 repos** in `pz_acme_qix` (183 packages): every repo except the synthetic `acme/checkout-web`.
- `EXPLAIN_PATH` plan: `Node By Index Scan | (x:Dep)` (the `Dep.repo` index), then `Conditional Traverse | (x)-[e:RESOLVES_TO|:ADMITS]->(Version)` and a filter, in a cartesian product with `Node By Index Scan | (Repo)` and the `ROOT` hop; then sort, limit 3 and `shortestPath`.
- Scanner view: the only hit in `pz_acme_qix` is `acme/checkout-web` from 14:26:51 (MAL-2025-46974); the only hits in `pz_acme_axios` are `acme/billing-api` from 02:07:58 (MAL-2026-2306, 106 min after the first publish) and 03:15:49 (MAL-2026-2307). No `WOULD_PULL` repo is ever flagged.
- MCP over stdio: 10 read-only tools (`recall_triage` is not exposed); `explain_path` on `socketio/socket.io` returns 3 rows, the first through `@babel/core@7.24.7` (`^4.1.0`).

## Free-tier speed (source: `docker run --cpus=0.1 --memory=512m` of the production image, 2026-10-16)

- Cold boot to healthy: **~28–30 s** (baked 11.6 MB RDB loads in ~12.6 s). Memory in use: **~219 MB of 512 MB**.
- qix triage (49 tool calls) at the default clock: **2.3 s** end to end, first tool result in **~0.2 s** (path/fix lookups memoized on the immutable demo graphs, warmed at boot). At a scrubbed clock, uncached: ~20 s on 0.1 CPU, ~3 s on a laptop.
