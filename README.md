# Patient Zero

**Exposed before the advisory exists.** A FalkorDB-backed triage agent for npm supply-chain hijacks: which of your repos are one fresh install away from malware, through which exact lockfile path, who owns the fix, and what to pin.

> Built for **FalkorDB Graph Hacks** (WeMakeDevs), **Track 1: Agents That Act on Connected Data**.

## The 74-minute window

On 2025-09-08 an npm maintainer account (`qix`) was phished. The first malicious release (`ansi-styles@6.2.2`) went out at 13:12:10 UTC, `debug@4.4.2` at 13:12:39. The first OSV advisory record (MAL-2025-46974) was published at 14:26:51. For **74 minutes**, advisory-based scanners (`npm audit`, OSV, Dependabot) had nothing to report. In 2026, `axios@1.14.1` went **2 h 54 min** without its own OSV record.

Patient Zero is a **triage layer, not a detector**: once anyone raises the alarm ("account X is compromised"), it answers *what does this mean for us* in seconds, from a graph of maintainers, versions, declared ranges, repos and teams.

> **Honest semantics.** `WOULD_PULL` means a *fresh resolve* during the window (new install, lockfile regeneration, `npx`, Dependabot, CI without `npm ci`, or the project's own consumers) would have fetched the malicious version. It is **not** a claim that the project was compromised; `npm ci` with a committed lockfile was safe. `LOCKED` appears only on two clearly badged synthetic repos.

## What it found (verified numbers, see `docs/proof-points.md`)

- **qix at 13:30 UTC:** 20 of 20 real public repos would fetch at least one malicious version on a fresh resolve (13 through production dependencies), plus the synthetic `acme/checkout-web` (LOCKED). `npm/cli`, `mochajs/mocha`, `remy/nodemon` and `github/docs` declare a hijacked package directly in their own `package.json`.
- **axios at 01:30 UTC:** 9 of 20 repos; `louislam/uptime-kuma` declares `axios ~0.30.3`, which resolved to the malicious 0.30.4.
- Repos are real public projects, analysed as of their lockfiles just before each incident (`data/cache/lockfiles/manifest.json` pins every SHA).

## Why the graph does the work

Every answer is a traversal; there is no in-app dependency model. Kill FalkorDB and nothing renders.

| Question | How the graph answers |
|---|---|
| Which versions did the hijacked account just publish? | `Maintainer -MAINTAINS-> Package <-OF- Version` filtered by publish time (`SUSPECT_VERSIONS`), before any advisory |
| Who would fetch them on a fresh install, and when? | time-windowed `ADMITS {range, fromT, toT}` edges from the declaring lockfile entry to the bad version (`EXPOSURE_ADMITS`) |
| Through which exact path? | `shortestPath` over per-repo `REQUIRES` from the repo root (`EXPLAIN_PATH`) |
| Who owns the fix? | `Repo -OWNED_BY-> Team` (`ROUTE_OWNERS`) |
| Who could be the next qix? | `algo.pageRank` over the package dependency projection, summed per maintainer (`CONCENTRATION_RISK`) |
| What would a scanner see? | one hop, lockfile vs. published OSV records (`SCANNER_VIEW`): **0** for the whole window |

One graph per (tenant, scenario) via `GRAPH.COPY` of a registry template; pasted repos get their own `pz_guest_*` graph.

## Graph data model

```
(Repo)-[:IN_ORG]->(Org)            (Repo)-[:OWNED_BY]->(Team)       (Repo)-[:ROOT]->(Dep)
(Dep)-[:REQUIRES {range, kind}]->(Dep)                              one Dep per lockfile location
(Dep)-[:RESOLVES_TO]->(Version)    (Version)-[:OF]->(Package)
(Maintainer)-[:MAINTAINS]->(Package)                                (Version)-[:PUBLISHED_BY]->(Maintainer)
(Dep)-[:ADMITS {range, fromT, toT}]->(Version)                      range resolved to the bad version while it was live
(Incident)-[:INVOLVES]->(Version)  (Incident)-[:COMPROMISED]->(Maintainer)   (Advisory)-[:FLAGS]->(Version)
(Version)-[:PULLS_IN]->(Version)   (Package)-[:PKG_DEPENDS]->(Package)      projection for PageRank
(Triage)-[:FOR]->(Incident)        (Triage)-[:ASSESSED {tier, action}]->(Repo)
```

Why one `Dep` node per lockfile location instead of shared `Version -> Version` edges: shared edges would invent paths that exist in no real lockfile. Full schema: `docs/contracts.md`.

## The agent

- **Triage** (default): a deterministic, graph-driven playbook (suspect versions -> exposure -> blast radius -> paths -> owners -> remediation -> concentration -> scanner view). The verdict, notify list and fix steps are built straight from those results, so they are complete with no LLM at all. **One** LLM call then picks the observation most worth acting on from a few the server builds from the graph (the carrier dependency, the prod share, the advisory gap and so on). It answers with an id, so it chooses but never writes. A guard checks every claim (repos, `name@version`, counts, `[E#]` citations) against the tool results. Free tiers: Groq `qwen/qwen3.8-27b` -> Groq `gpt-oss-120b` -> Gemini `3.5-flash-lite` -> recorded pick -> none.
- **Ask**: questions the graph can answer itself get a server-built answer and server-chosen tool calls. These are lists and filters ("which exposures are prod-only?"), a named repo ("what should acme/checkout-web do?"), "which repos need secrets rotated, is npm ci safe?", who to notify, and when it started. Anything else goes to a bounded tool loop (4 LLM calls, 6 tool calls) where the model picks graph tools itself, and the guard checks every name in its answer.
- **MCP**: the same read-only tools over stdio for Claude Code / Claude Desktop (`docs/mcp.md`).

## Every Cypher query

Generated from `server/tools/cypher.ts` by `node scripts/gen-readme-cypher.ts`; `test/readme.test.ts` fails if this drifts from the code.

<!-- cypher:start -->

#### `FIND_TARGET`

find_target: exact, indexed lookups for the terms of a free-text alert (package, maintainer, name@version, incident id).

```cypher
UNWIND $terms AS t MATCH (n:Maintainer {name: t}) RETURN 'Maintainer' AS label, n.name AS id
UNION UNWIND $terms AS t MATCH (n:Version {id: t}) RETURN 'Version' AS label, n.id AS id
UNION UNWIND $terms AS t MATCH (n:Package {name: t}) RETURN 'Package' AS label, n.name AS id
UNION UNWIND $terms AS t MATCH (n:Incident {id: t}) RETURN 'Incident' AS label, n.id AS id
```

#### `SUSPECT_VERSIONS`

suspect_versions: pre-advisory detection. Every version of the account's packages published in the window.

```cypher
MATCH (:Maintainer {name: $maintainer})-[:MAINTAINS]->(p:Package)<-[:OF]-(v:Version)
WHERE v.publishedAt >= $since AND v.publishedAt < $until
RETURN v.id AS version, p.name AS package, v.publishedAt AS publishedAt, v.removed AS removed
ORDER BY publishedAt LIMIT 40
```

#### `INCIDENT`

Incident header for a run (not a tool): times, versions, the compromised account, the lockfile snapshot time and the org ('guest' for a pasted repo's graph).

```cypher
MATCH (i:Incident {id: $incident})-[:INVOLVES]->(v:Version)
OPTIONAL MATCH (i)-[:COMPROMISED]->(m:Maintainer)
OPTIONAL MATCH (o:Org)
RETURN i.id AS id, i.title AS title, m.name AS maintainer, i.firstPublishAt AS firstPublishAt, i.alertAt AS alertAt,
  i.advisoryAt AS advisoryAt, i.removedAt AS removedAt, i.sources AS sources, o.snapshotAt AS snapshotAt, o.id AS org,
  collect({id: v.id, publishedAt: v.publishedAt}) AS versions
```

#### `FIRST_EXPOSURE`

Incident header (not a tool): the first moment this graph shows any repo exposed, under incident_exposure's rule (a repo that locks a bad version starts at its LOCKED since, any other at its earliest ADMITS window). It anchors "minutes ahead of the advisory" everywhere.

```cypher
MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[:RESOLVES_TO]-(d:Dep)
RETURN d.repo AS repo, max(bad.publishedAt) AS since, true AS locked
UNION ALL
MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep)
WHERE a.fromT < a.toT AND l.name = bad.name AND r.range = a.range
RETURN p.repo AS repo, min(a.fromT) AS since, false AS locked
```

#### `REPOS`

incident_exposure (1/3): every repo and its owning team, so CLEAN is counted too.

```cypher
MATCH (r:Repo) OPTIONAL MATCH (r)-[:OWNED_BY]->(t:Team)
RETURN r.id AS repo, r.synthetic AS synthetic, t.name AS team ORDER BY repo
```

#### `EXPOSURE_LOCKED`

incident_exposure (2/3) LOCKED: lockfile entries that resolve to a malicious version. A lockfile can't predate the newest bad version it locks, so that publish time is the repo's `since`: before it, none of the repo's hits count.

```cypher
MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[:RESOLVES_TO]-(d:Dep)
WITH d.repo AS repo, bad, min(d.depth) AS depth, collect(DISTINCT d.dev) AS devFlags
WITH repo, max(bad.publishedAt) AS since, collect({version: bad.id, depth: depth, devFlags: devFlags}) AS hits
UNWIND hits AS h
RETURN repo, h.version AS version, h.depth AS depth, h.devFlags AS devFlags, since
```

#### `EXPOSURE_ADMITS`

incident_exposure (3/3) WOULD_PULL: a declared range resolved to a malicious version while it was live at $at. The REQUIRES hop to the locked entry gives the dev/prod badge and what the lockfile pins for that range instead.

```cypher
MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep)
WHERE a.fromT <= $at AND $at < a.toT AND l.name = bad.name AND r.range = a.range
RETURN p.repo AS repo, bad.id AS version, min(p.depth) AS depth, collect(DISTINCT l.dev) AS devFlags,
  collect(DISTINCT a.range)[0..3] AS ranges, min(a.fromT) AS since, collect(DISTINCT l.name + '@' + l.version) AS locked
```

#### `MAINTAINER_BLAST_RADIUS`

maintainer_blast_radius: MAINTAINER tier. Repos whose lockfile contains any package the account maintains.

```cypher
MATCH (:Maintainer {name: $maintainer})-[:MAINTAINS]->(pkg:Package)<-[:OF]-(:Version)<-[:RESOLVES_TO]-(d:Dep)
RETURN d.repo AS repo, count(DISTINCT pkg) AS packages, collect(DISTINCT pkg.name)[0..6] AS sample,
  min(d.depth) AS shallowest, collect(DISTINCT d.dev) AS devFlags
ORDER BY packages DESC, repo
```

#### `EXPLAIN_PATH`

explain_path: the exact lockfile chain from the repo root to the entry that locks (RESOLVES_TO) or declares a range admitting (ADMITS, live at $at) the version. *0.. covers a range declared by the root itself (0 hops). Dep.depth is the BFS depth from the root, so only the 3 shallowest entries need a shortestPath walk.

```cypher
MATCH (:Repo {id: $repo})-[:ROOT]->(root:Dep)
MATCH (:Version {id: $version})<-[e:RESOLVES_TO|ADMITS]-(x:Dep {repo: $repo})
WHERE type(e) = 'RESOLVES_TO' OR (e.fromT <= $at AND $at < e.toT)
WITH root, x, e ORDER BY type(e) DESC, x.depth LIMIT 3
WITH root, x, e, shortestPath((root)-[:REQUIRES*0..]->(x)) AS p
RETURN type(e) AS kind, e.range AS range, length(p) AS hops, x.depth AS depth,
  [n IN nodes(p) | n.name + '@' + n.version] AS chain, [n IN nodes(p) | n.path] AS lockPaths
ORDER BY kind DESC, hops LIMIT 3
```

#### `NODE_COUNTS`

graph stats (the Graph stats tab, before any triage): how many nodes each demo graph holds, per label.

```cypher
MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC
```

#### `EDGE_COUNTS`

graph stats: how many relationships, per type (REQUIRES is the lockfile tree, ADMITS the time-windowed exposure).

```cypher
MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC
```

#### `ROUTE_OWNERS`

route_owners: who to notify.

```cypher
MATCH (r:Repo)-[:OWNED_BY]->(t:Team) WHERE r.id IN $repos
RETURN t.name AS team, t.channel AS channel, collect(r.id) AS repos ORDER BY team
```

#### `CONCENTRATION_RISK`

concentration_risk: "who is the next qix?" PageRank over the package dependency projection, summed per maintainer.

```cypher
MATCH (m:Maintainer)-[:MAINTAINS]->(p:Package)
WITH m, sum(p.pagerank) AS influence, count(p) AS packages ORDER BY influence DESC LIMIT $top
MATCH (m)-[:MAINTAINS]->(:Package)<-[:OF]-(:Version)<-[:RESOLVES_TO]-(d:Dep)
RETURN m.name AS maintainer, influence, packages, count(DISTINCT d.repo) AS reposReached ORDER BY influence DESC
```

#### `REMEDIATION_VERSIONS`

draft_remediation (1/2): installable, non-malicious versions of each bad version's package that were live at $at.

```cypher
MATCH (bad:Version)-[:OF]->(:Package)<-[:OF]-(v:Version)
WHERE bad.id IN $versions AND v.publishedAt <= $at AND coalesce(v.removed, false) = false
RETURN bad.id AS bad, bad.name AS package, v.version AS version, v.publishedAt AS publishedAt, coalesce(v.malicious, false) AS malicious
```

#### `REMEDIATION_RANGES`

draft_remediation (2/2): the repo's ranges that lock or admit each bad version (the pin must satisfy all of them), whether the repo root declares it (npm rejects an override that conflicts with a direct dependency), what the lockfile pins for that range, and when the range stopped admitting the bad version.

```cypher
MATCH (bad:Version)<-[:RESOLVES_TO]-(d:Dep)<-[r:REQUIRES]-(p:Dep)
WHERE bad.id IN $versions AND d.repo = $repo
RETURN bad.id AS bad, r.range AS range, 'RESOLVES_TO' AS kind, p.path = '' AS direct, bad.id AS locked, null AS until
UNION
MATCH (bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep)
WHERE bad.id IN $versions AND p.repo = $repo AND l.name = bad.name AND r.range = a.range
RETURN bad.id AS bad, a.range AS range, 'ADMITS' AS kind, p.path = '' AS direct, l.name + '@' + l.version AS locked, a.toT AS until
```

#### `SCANNER_VIEW`

scanner_view (1/2): the "graph off" baseline. What an advisory-based scanner reports at $at (lockfile vs. OSV, one hop).

```cypher
MATCH (a:Advisory)-[:FLAGS]->(v:Version)<-[:RESOLVES_TO]-(d:Dep)
WHERE a.publishedAt <= $at
RETURN DISTINCT d.repo AS repo, v.id AS version, a.id AS advisory ORDER BY repo, version, advisory
```

#### `NAME_GREP`

scanner_view (2/2): name grep. Repos where a bad package's name appears at all, with no version, path or owner.

```cypher
MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)
MATCH (d:Dep) WHERE d.name = bad.name
RETURN count(DISTINCT d.repo) AS repos
```

#### `CHANGE_TIMES`

Timeline (server only): every moment an exposure tier or scanner count can change. Between two of them every incident_exposure / scanner_view answer is the same, so the 1-minute timeline runs those once per segment.

```cypher
MATCH (:Incident {id: $incident})-[:INVOLVES]->(v:Version) RETURN v.publishedAt AS t
UNION MATCH (:Incident {id: $incident})-[:INVOLVES]->(:Version)<-[a:ADMITS]-(:Dep) RETURN a.fromT AS t
UNION MATCH (:Incident {id: $incident})-[:INVOLVES]->(:Version)<-[a:ADMITS]-(:Dep) RETURN a.toT AS t
UNION MATCH (a:Advisory) RETURN a.publishedAt AS t
```

#### `RECALL_TRIAGE`

recall_triage: this session's earlier assessments and remediation marks for the incident (S10: scoped by session).

```cypher
MATCH (t:Triage {session: $session})-[:FOR]->(:Incident {id: $incident})
MATCH (t)-[a:ASSESSED]->(r:Repo)
RETURN r.id AS repo, a.tier AS tier, a.action AS action, t.at AS at ORDER BY at DESC
```

#### `RECORD_TRIAGE`

recordTriage (server only, GRAPH.QUERY): never exposed as a tool.

```cypher
MATCH (i:Incident {id: $incident})
CREATE (t:Triage {id: $id, at: $at, session: $session, summary: $summary, marked: $marked})-[:FOR]->(i)
WITH t UNWIND $assessed AS x
MATCH (r:Repo {id: x.repo})
CREATE (t)-[:ASSESSED {tier: x.tier, action: x.action}]->(r)
```

#### `PRUNE_TRIAGE`

recordTriage (server only): keep runtime triage memory bounded in the shared graphs, oldest first. Runs and remediation marks are capped apart, so other visitors' runs can never push a session's marks out.

```cypher
MATCH (t:Triage) WHERE coalesce(t.marked, false) = $marked
WITH t ORDER BY t.at DESC SKIP 1000 DETACH DELETE t
```

<!-- cypher:end -->

## Run it locally

```bash
docker compose up --build
```

App on http://localhost:8080, FalkorDB Browser on http://localhost:3000 (run the queries above yourself). Development: `docker run -d -p 6380:6379 -e REDIS_ARGS="--requirepass devpass" falkordb/falkordb`, then `npm ci`, `npm run fonts`, `npm run build:graph`, `npm run dev` and `npm run dev:web`. Tests: `npm test`.

## Security

A public, unauthenticated demo, built to 13 written rules (`docs/decisions.md`): parameterized Cypher only (params are validated because the client inlines them), read-only ACL user for every tool and a separate write user, no SSRF (we build every outbound URL ourselves, allowlisted hosts, no redirects), lockfile size and shape caps, prompt-injection guard, strict CSP, per-client rate limits, session-scoped memory, no emails stored, non-root container with read-only code. Two independent security reviews ran during the build; their findings and fixes are in `docs/decisions.md`.

## Limits

npm `package-lock.json` v2/v3 only (no yarn/pnpm yet). `overrides`/`resolutions` are not modelled. `latest` is treated as "highest stable" rather than a moving dist-tag. Removal times are approximate (the registry keeps no removal timestamp).

## AI-use disclosure

Built with Claude Code (Anthropic) as the coding assistant, orchestrating several agents; every query and design decision was reviewed by the author. At runtime, free-tier models (Groq / Gemini) only parse alerts, narrate and pick tools in Ask mode; every fact is Cypher-backed and guard-checked.

## License

MIT
