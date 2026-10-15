# Proof points

The only numbers the README, video, blog and posts may quote. Each line names its source. Recompute with
`node scripts/exposure-oracle.ts <scenario> <atISO>` (graph-free) and, once the graph is up, the matching Cypher.

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
- axios at 01:30Z (21 repos incl. synthetic `acme/billing-api`): LOCKED 1, WOULD_PULL 9, CLEAN 11; app shows **105 min** ahead (to the campaign's first OSV record, MAL-2026-2306).
- Graph size: `pz_acme_qix` 46,810 nodes / 123,426 edges / 24 MB, built in ~3.3 s. Baked RDB 11.6 MB.
- Top maintainer concentration (PageRank mass): sindresorhus, ljharb, types.

## Data scope

- 20 real public repos + 2 synthetic (badged), lockfiles as of 2025-09-08T13:00Z and 2026-03-31T00:00Z.
- Graph size (Graph stats in the app): the qix graph holds 5,373 packages, 10,210 versions and 27,349 lockfile entries for 21 repos; the axios graph 5,490 packages, 9,941 versions and 27,211 entries. Maintainers are stored as usernames only (no emails). 92 packuments carry full version timelines.

## Agent behaviour (source: live runs against the dev graphs, 2026-10-15/16; `test/api.test.ts`, `test/narrate.test.ts`)

- Ask "which exposures are prod-only and who owns them?" at qix 13:30Z: **14 repos across 6 teams**, answered from the graph (`filter_exposures`), never in a model's words.
- Analyst pick: the LLM chooses one of the observations the server built from the graph, so its words are always the graph's. The pick varies by run and provider; the recorded replays pick the shared-dependency observation: at qix 13:30Z "4 repos get a malicious version through the same dependency, `@babel/core`" (socket.io, jquery, pdf.js and 1 more), at axios 01:30Z "2 repos ... through `nx`" (appium, nest). A live run may pick another observation; every option is built from the graph.
- Every claim in the narrative is checked against the run's evidence: a qix run traces **all of its claims, about 60** (the exact count depends on the analyst pick and on what the session has marked remediated).

## Free-tier speed (source: `docker run --cpus=0.1 --memory=512m` of the production image, 2026-10-16)

- Cold boot to healthy: **~28–30 s** (baked 11.6 MB RDB loads in ~12.6 s). Memory in use: **~219 MB of 512 MB**.
- qix triage (49 tool calls) at the default clock: **2.3 s** end to end, first tool result in **~0.2 s** (path/fix lookups memoized on the immutable demo graphs, warmed at boot). At a scrubbed clock, uncached: ~20 s on 0.1 CPU, ~3 s on a laptop.
