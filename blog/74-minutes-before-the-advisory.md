---
title: "74 minutes before the advisory: graph triage for npm account hijacks"
published: false
tags: falkordb, security, npm, graphdatabase
---

*Patient Zero is my entry to FalkorDB Graph Hacks, Track 1 (Agents That Act on Connected Data). Live demo: `https://<render-url>`. Code, MIT, with every Cypher query in the README: https://github.com/yasharyas/Graph-Hacks-hackathon.*

## Two incidents, one gap

On 8 September 2025 the npm account `qix` was hijacked. The first malicious release, `ansi-styles@6.2.2`, was published at 13:12:10 UTC; `debug@4.4.2` followed at 13:12:39. Aikido flagged the account at about 13:16. The first OSV record, MAL-2025-46974 for `debug`, came at 14:26:51. For 74 minutes `npm audit`, OSV lookups and Dependabot had no record to match against. Not because they were slow: they are advisory-based, and there was no advisory.

On 31 March 2026 the same shape repeated with `axios`. `axios@1.14.1` was published at 00:21:58 UTC and had no OSV record of its own for 2 h 54 min.

Patient Zero sits in that gap. It is not a detector. It is the triage layer for the question right after the alarm: *which of our repos does this reach, through which path, and who do I page?* It answers from a FalkorDB graph, and every answer carries its Cypher.

## Lockfile time-travel

The honest unit of exposure is not "do we use chalk". It is: given the lockfile we had committed at the moment of the publish, what would a fresh resolve have fetched?

So the graph is built from lockfiles as they were just before each incident: 20 real public repos (npm/cli, mocha, nodemon, github/docs, puppeteer, jquery and others), each at the commit of its `package-lock.json` as of 2025-09-08T13:00Z and again as of 2026-03-31T00:00Z. Two clearly badged synthetic repos are seeded with a malicious version locked in, because no real repo had one.

That gives two tiers with different meanings, and the app says so on every screen:

- `LOCKED`: the lockfile resolves a malicious version. `npm ci` installs it. Only the two synthetic repos.
- `WOULD_PULL`: a declared range resolved to the malicious version while it was live, so a fresh resolve (a new clone and `npm install`, a lockfile regeneration, `npx`, a Dependabot run, CI without `npm ci`, or your own downstream consumers) would have fetched it. It is not a claim of compromise. `npm ci` from the committed lockfile was safe throughout.

At 13:30 UTC on the qix day, 20 of 20 real repos were `WOULD_PULL`, 13 of them through production dependencies. Four declared a hijacked package directly in their own `package.json`: `npm/cli` (`chalk ^5.4.1`), `mochajs/mocha` (`debug ^4.3.5`), `remy/nodemon` (`debug ^4`) and `github/docs` (`chalk ^5.0.1`). For axios at 01:30 UTC it was 9 of 20; `louislam/uptime-kuma` declares `axios ~0.30.3`, which resolved to the malicious 0.30.4.

## One node per lockfile location

The first modelling decision made everything else work. A naive package graph has one node per `name@version` and dependency edges between versions. It is compact and wrong for this job: shared `Version -> Version` edges invent paths that exist in no real lockfile, because nested `node_modules` folders let two repos hold the same version with different children, and one repo hold it twice with different parents.

So Patient Zero has one `Dep` node per lockfile location, keyed `repo|lockPath`, with `REQUIRES {range, kind}` edges that mirror the lockfile tree exactly, a `RESOLVES_TO` edge to the `Version` it pins, and a `depth` property set by BFS from the root at ingest. The qix graph for the demo org comes to 46,810 nodes and 123,426 edges (24 MB), built in about 3.3 s.

## Time-windowed ADMITS edges

Exposure is a function of time. FalkorDB has no temporal type, so time is an integer property and the window is an edge. For every declared range in every lockfile, ingest works out whether it resolved to a malicious version at any point and when that stopped: the version's removal, or a later version that satisfies the range and outranks the bad one. The result is an `ADMITS {range, fromT, toT}` edge from the declaring `Dep` to the bad `Version`.

"Who was exposed at 13:30?" is then a property filter, not a replay of the registry:

```cypher
MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep)
WHERE a.fromT <= $at AND $at < a.toT AND l.name = bad.name AND r.range = a.range
RETURN p.repo AS repo, bad.id AS version, min(p.depth) AS depth, collect(DISTINCT l.dev) AS devFlags,
  collect(DISTINCT a.range)[0..3] AS ranges, min(a.fromT) AS since, collect(DISTINCT l.name + '@' + l.version) AS locked
```

The `REQUIRES` hop to the locked entry lets the UI say "your lockfile pins chalk@5.4.1: safe" next to the range that would have pulled 5.6.1. The same edges drive the timeline: the server collects every instant a tier can change (publishes, window starts and ends, advisory times) and re-runs the exposure query only between them.

## shortestPath as the explanation

A tool that says "mocha is exposed" without showing why gets ignored at two in the morning. So every exposed repo is explained as the exact lockfile chain from its root to the entry whose range admits the bad version:

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

Two FalkorDB details carried this. `shortestPath` is allowed in `WITH` and `RETURN`, and `*0..` covers a range declared by the root itself, so a direct dependency is a zero-hop path with no special case. And because `Dep.depth` equals the hop count, the query starts from the indexed `Version`, sorts candidates by depth and walks `shortestPath` only for the three shallowest. With path and fix lookups memoized on the immutable demo graphs, a warm qix triage on a 0.1-CPU container takes 2.3 s. Every card shows its Cypher and offers `GRAPH.EXPLAIN` for its plan.

## The graph decides, the LLM picks, never writes

This is the part I expected to be the easy demo, and it was the hardest to make honest.

The triage is a deterministic playbook: suspect versions, exposure, blast radius, paths, owners, remediation, maintainer concentration, scanner view. 49 read-only tool calls, all `GRAPH.RO_QUERY` as an ACL user that cannot write. Verdict, notify list and fix steps are assembled from those rows, so with no model at all the triage is complete.

The first design let a free-tier model write a short analyst note on top. Then QA started. One run said mocha was "currently using" the bad version, which is false: it would have fetched it on a fresh resolve. A claims guard checks every repo, `name@version`, count and `[E#]` citation against the tool results, but verbs are not entities, so it cannot catch "using". After each fix the notes found a new way to be subtly wrong: "the sole malicious version" for an account that had just published a list of them; `chalk@5.6.1` paired with another package's range; "all 20 would fetch it" about a version only some of them reached. Each passed the entity check.

So free text went away. The server builds three to six observations from the report (the carrier dependency that reaches the most repos, the production share, the directly declared ones, the advisory gap), each as true as the verdict because it comes from the same rows. The model answers with one id. It still makes the judgement call: on the qix run it chose "4 repos get a malicious version through the same dependency, `@babel/core`", on axios "2 repos through `nx`". But no sentence of its own reaches the screen, and replays record an id, not prose.

The Ask box follows the same rule. Questions the graph can answer by itself (lists and filters, a named repo, "is npm ci safe", who to notify) get server-built answers with server-chosen tool calls; at qix 13:30, "which exposures are prod-only and who owns them?" returns 14 repos across 6 teams from the graph. Only open-ended questions go to a bounded tool loop where the model picks tools and the guard checks every name in its reply.

## What the scanner would have said

For contrast, the "graph off" baseline is one hop, lockfile against published OSV records:

```cypher
MATCH (a:Advisory)-[:FLAGS]->(v:Version)<-[:RESOLVES_TO]-(d:Dep)
WHERE a.publishedAt <= $at
RETURN DISTINCT d.repo AS repo, v.id AS version, a.id AS advisory ORDER BY repo, version, advisory
```

Zero rows for the whole 74-minute window, and zero for 2 h 54 min on the axios day. That is not a criticism of those tools. It is what advisory-based means.

## Free tiers, measured

The whole thing runs for $0: Render's free single container, Groq and Gemini free tiers, FalkorDB in the same image. Measured under `docker run --cpus=0.1 --memory=512m`:

- Cold boot to healthy in about 28–30 s; the baked 11.6 MB RDB loads in about 12.6 s. Memory in use about 219 MB of 512 MB.
- A qix triage at the default clock: 2.3 s end to end, first tool result in about 0.2 s. The cards say "cached" when a path or fix lookup came from the warmed memo. At a scrubbed clock the queries run live: about 20 s on 0.1 CPU, about 3 s on a laptop.

Every tenant and scenario is its own graph via `GRAPH.COPY` of a registry template, which is also how a pasted repo gets a private graph (LRU 4, TTL 1 h). The same read-only tools are exposed over MCP, so Claude Code can call `incident_exposure` and `explain_path` and get the rows and the Cypher back.

## What it is not

Not a detector. Not proof that any of the 20 repos was compromised: `WOULD_PULL` is exposure surface on a fresh resolve, and `npm ci` was safe. Not yarn, pnpm or PyPI yet. `latest` is modelled as "highest stable", not a moving dist-tag, and removal times are approximate because the registry keeps none. Teams and channels are synthetic; the repos and lockfiles are real.

What it is: a graph that answers the on-call question before the advisory exists, with the query attached. Try it at `https://<render-url>`, and read every Cypher query at https://github.com/yasharyas/Graph-Hacks-hackathon.
