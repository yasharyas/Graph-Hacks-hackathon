# Submission form copy

Paste-ready text for the Graph Hacks form. The numbers come from `docs/proof-points.md`.

## Title

Patient Zero

## Tagline

Exposed before the advisory exists.

## Description (150 words max)

Patient Zero is a triage agent for npm maintainer-account hijacks, built on FalkorDB. When the qix account was hijacked in September 2025, advisory-based scanners had no record to match for 74 minutes. Patient Zero answers the on-call question in that gap: which of our repos would fetch the malicious version on a fresh install, by which lockfile path, and who owns the fix. It loads pre-incident lockfiles into a graph with one node per lockfile location and time-windowed ADMITS edges, then runs a read-only playbook of graph tools, each card showing its Cypher and, on request, its GRAPH.EXPLAIN plan. It drafts fixes and team notices and writes remediation marks back. An LLM picks one graph-built observation by id and answers open follow-ups through the same tools, with every name and count checked. The tools also run over MCP, and any public repo can be pasted into its own graph.

## How FalkorDB is used

- **`GRAPH.COPY` per tenant and scenario.** A `pz_registry` template holds the incidents, advisories and version timelines once. Copies become `pz_acme_qix`, `pz_acme_axios` and one `pz_guest_<sha>_<scenario>` graph per pasted repo (LRU 4, TTL 1 h).
- **Time-windowed `ADMITS {range, fromT, toT}` edges.** They record when a declared range resolved to a malicious version, so "who was exposed at 13:30?" is a property filter on an edge.
- **`shortestPath` with `Dep.depth`.** The exact lockfile chain from the repo root, walked only for the three shallowest candidate entries. `*0..` covers a range the repo declares itself.
- **`algo.pageRank`** over the `PKG_DEPENDS` projection, summed per maintainer: who could be the next hijacked account?
- **`GRAPH.EXPLAIN` on every card.** "Show plan" fetches the execution plan of the query behind any tool result.
- **ACL users.** Every tool runs `GRAPH.RO_QUERY` as the read-only user `pz_ro` (`GRAPH.QUERY` gets NOPERM). A separate `pz_rw` user does every write at runtime: a pasted repo's ingest, and the session-scoped `(:Triage)-[:ASSESSED]->(:Repo)` records and remediation marks that the next run reads back.
- **MCP.** The same ten read-only tools are a stdio MCP server for Claude Code and Claude Desktop.

## Track

Track 1: Agents That Act on Connected Data

## AI use (one line)

Built with Claude Code under the author's direction, with AI-run QA and security reviews and AI-drafted docs; at runtime an LLM only picks one graph-built observation by id, or picks read-only tools for open questions (`docs/AI_USE.md`).

## Links (in judge order)

1. Video: `https://<video-url>`
2. Live demo: `https://<render-url>`
3. Repo: https://github.com/yasharyas/Graph-Hacks-hackathon
4. Blog: `<blog-url>`

## Cover image

`web/public/og-card.png` (1200x630)

## Placeholders to fill before submitting

- [ ] `<video-url>`: `README.md` (links row), this file
- [ ] `<render-url>`: `README.md` (links row), `blog/74-minutes-before-the-advisory.md` (twice), `video/script.md` (end card), `docs/launch-posts.md`, this file
- [ ] `<blog-url>`: `docs/launch-posts.md`, this file
- [ ] Blog: set `published: true` when it goes live on dev.to
