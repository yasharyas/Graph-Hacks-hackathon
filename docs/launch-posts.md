# Launch posts

Placeholders still to fill: `<render-url>` (live demo), `<video-url>`, `<blog-url>` (dev.to). No vote requests anywhere; the hackathon rules forbid canvassing judges.

## FalkorDB Discord, #showcase (3 lines)

Patient Zero: npm account-hijack triage on FalkorDB. When `qix` was hijacked, advisory-based scanners (npm audit, OSV, Dependabot) had no record for 74 minutes; the graph shows which repos would have fetched the malware on a fresh install, through which exact lockfile path, and who owns the fix.
FalkorDB does the reasoning: `GRAPH.COPY` per tenant and scenario, time-windowed `ADMITS` edges, `shortestPath` explanations, PageRank for "who could be the next qix", `GRAPH.EXPLAIN` on every card, a read-only ACL user. The LLM only picks one observation by id; it never writes a fact.
Live: <render-url> · Code, MIT, every Cypher query in the README: https://github.com/yasharyas/Graph-Hacks-hackathon · Graph Hacks Track 1 entry.

## LinkedIn

On 8 September 2025 the npm account qix was hijacked. debug@4.4.2 was published at 13:12 UTC. A vendor raised the alarm about four minutes later. The first OSV record arrived at 14:26.

For 74 minutes, the tools most teams rely on had nothing to match against. Not because they were slow; because they are advisory-based, and there was no advisory.

I built Patient Zero for FalkorDB Graph Hacks to sit in that gap. It is a triage layer, not a detector. Give it the alarm and it answers the on-call question: which of our repos would fetch this on a fresh install, through which lockfile path, and who owns the fix.

How it works:
- Lockfiles as they were just before the incident, one node per lockfile location, so no path is invented.
- Time-windowed edges that record when a declared range started and stopped resolving to a bad version. "Who was exposed at 13:30?" is a property filter.
- shortestPath from the repo root for every exposed repo, with GRAPH.EXPLAIN one click away.
- PageRank over the package graph for "who could be the next qix".
- One graph per tenant and scenario via GRAPH.COPY, including a private graph for any repo you paste.

What it found at 13:30 UTC: 20 of 20 real public repos would have fetched at least one malicious version on a fresh resolve, 13 through production dependencies. npm ci from a committed lockfile was safe throughout; this is exposure surface, not compromise.

The LLM's only job is to pick one observation, by id, from facts the graph produced. It never writes the verdict. I replaced free-text model notes after QA kept finding subtle errors the guard could not catch; the story is in the blog post.

Runs on free tiers, $0. MIT.

Live: <render-url>
Code: https://github.com/yasharyas/Graph-Hacks-hackathon
Write-up: <blog-url>

## X thread (5 posts)

1/ When the npm account qix was hijacked, debug@4.4.2 went out at 13:12 UTC. Someone raised the alarm in 4 minutes. The first OSV record came at 14:26. For 74 minutes, npm audit, OSV and Dependabot had nothing to match. I built a triage layer for that window on @FalkorDB for @WeMakeDevs Graph Hacks.

2/ Patient Zero answers the on-call question, not the detection one: which repos would fetch the malware on a fresh install, through which exact lockfile path, and who owns the fix. At 13:30 UTC: 20 of 20 real public repos, 13 via production deps. npm ci from a lockfile was safe; this is exposure, not compromise.

3/ The graph does the work. One Dep node per lockfile location (shared version edges invent paths). ADMITS edges carry {range, fromT, toT}, so "exposed at 13:30?" is a property filter. shortestPath from the repo root explains every row. GRAPH.EXPLAIN on every card. One graph per tenant via GRAPH.COPY.

4/ The LLM never writes a fact. The server builds observations from graph rows and the model picks one by id. Free-text notes were cut after QA kept catching errors like "currently using" for a repo that would only have fetched it on a fresh resolve. Deterministic triage, 49 read-only calls, 2.3 s warm on a 0.1-CPU free tier.

5/ Also an MCP server (same read-only tools in Claude Code), a paste-your-repo mode, and an Ask box where list questions are answered from the graph. $0 to run, MIT.
Live: <render-url>
Code: https://github.com/yasharyas/Graph-Hacks-hackathon
Write-up: <blog-url>

## falkordb.com community projects blurb

**Patient Zero** is an npm supply-chain triage agent built on FalkorDB for Graph Hacks (Track 1). When a maintainer account is hijacked, it shows which repos would fetch the malicious version on a fresh install, through which exact lockfile path, and who owns the fix, before advisory-based scanners have a record (74 minutes ahead in the qix incident). The graph does the reasoning: `GRAPH.COPY` per tenant and scenario, time-windowed `ADMITS` edges, `shortestPath` explanations, PageRank for maintainer concentration, `GRAPH.EXPLAIN` on every query, and a read-only ACL user for every tool. An LLM only picks one observation from graph-built facts. MIT, runs on free tiers, also exposed over MCP. Demo: <render-url>. Code: https://github.com/yasharyas/Graph-Hacks-hackathon.
