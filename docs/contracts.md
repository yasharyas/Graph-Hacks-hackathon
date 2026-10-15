# Contracts

Owned by the orchestrator. Workers build against this file, `shared/events.ts` and `server/tools/types.ts`, and never change them without the orchestrator.

## Graphs

One graph per (tenant, scenario). Times are epoch-ms integers (FalkorDB has no temporal arithmetic).

| Graph | Contents |
|---|---|
| `pz_registry` | Incidents, advisories, every version (with publish time) of every package the compromised accounts maintain, their `MAINTAINS` edges |
| `pz_acme_qix` | `GRAPH.COPY pz_registry` + Acme lockfiles as of `2025-09-08T13:00:00Z` |
| `pz_acme_axios` | `GRAPH.COPY pz_registry` + Acme lockfiles as of `2026-03-31T00:00:00Z` |
| `pz_guest_<sha256[0:12]>_<qix\|axios>` | `GRAPH.COPY pz_registry` + one pasted repo (LRU 4, TTL 1 h). The name is never user-controlled. |

## Nodes

| Label | Key | Properties |
|---|---|---|
| `Org` | `id` | `name`, `scenario`, `snapshotAt` |
| `Team` | `id` | `name`, `channel` (synthetic) |
| `Repo` | `id` = `owner/name` | `sha`, `snapshotAt`, `synthetic`, `depCount` |
| `Dep` | `id` = `repo\|lockPath` | `repo`, `path`, `name`, `version`, `dev`, `optional`, `depth` (one per lockfile location; root has `path = ""`) |
| `Version` | `id` = `name@version` | `name`, `version`, `publishedAt`, `removed`, `malicious`, `publisher` |
| `Package` | `name` | `pagerank` |
| `Maintainer` | `name` | (username only; emails are dropped at ingest) |
| `Incident` | `id` | `title`, `firstPublishAt`, `alertAt`, `advisoryAt`, `removedAt` |
| `Advisory` | `id` | `publishedAt` |
| `Triage` | `id` | `at`, `session`, `summary` |

## Relationships

```
(Repo)-[:IN_ORG]->(Org)            (Repo)-[:OWNED_BY]->(Team)       (Repo)-[:ROOT]->(Dep)
(Dep)-[:REQUIRES {range, kind}]->(Dep)                              kind: prod | dev | optional | peer
(Dep)-[:RESOLVES_TO]->(Version)    (Version)-[:OF]->(Package)
(Maintainer)-[:MAINTAINS]->(Package)                                (Version)-[:PUBLISHED_BY]->(Maintainer)
(Dep)-[:ADMITS {range, fromT, toT}]->(Version)                      the declared range resolved to this bad version while it was live
(Incident)-[:INVOLVES]->(Version)  (Incident)-[:COMPROMISED]->(Maintainer)   (Advisory)-[:FLAGS]->(Version)
(Version)-[:PULLS_IN]->(Version)   (Package)-[:PKG_DEPENDS]->(Package)      projection for PageRank
(Triage)-[:FOR]->(Incident)        (Triage)-[:ASSESSED {tier, action}]->(Repo)
```

## Tiers

- `LOCKED`: the lockfile resolves a malicious version (synthetic repos only, badged).
- `WOULD_PULL`: a declared range resolved to the malicious version while it was live, so a fresh resolve would have fetched it. Not a claim of compromise; `npm ci` with a lockfile was safe.
- `MAINTAINER`: depends on the compromised account's packages; malicious versions not known yet.
- `CLEAN`.

## Indexes (created before any bulk write)

Range: `Dep(id)`, `Dep(repo)`, `Dep(name)`, `Version(id)`, `Version(name)`, `Package(name)`, `Maintainer(name)`, `Repo(id)`, `Incident(id)`. Unique constraints: `Dep.id`, `Version.id`.

## Data files (written by `server/ingest/fetch.ts`, committed, read by `build.ts`)

Few large JSON files, not thousands of small ones (OneDrive and git both prefer it). Times are ISO strings on disk, epoch ms in the graph. No emails anywhere (S11).

```jsonc
// data/org/acme.json — hand-written
{ "id": "acme", "name": "Acme Corp (simulated)",
  "teams": [{ "id": "docs", "name": "Docs", "channel": "#team-docs" }],
  "repos": [{ "id": "github/docs", "team": "docs", "synthetic": false }],
  "scenarios": { "qix-2025-09-08": "2025-09-08T13:00:00Z", "axios-2026-03-31": "2026-03-31T00:00:00Z" } }

// data/cache/lockfiles/manifest.json
{ "<scenarioId>": { "<owner/repo>": { "sha": "<40 hex>", "committedAt": "<ISO>", "file": "<owner>__<repo>__<sha7>.json", "deps": 1455, "unresolved": 0 } } }
// data/cache/lockfiles/<owner>__<repo>__<sha7>.json — minimized package-lock: lockfileVersion, name, and per entry only
//   name, version, dev, optional, link, resolved (links only), workspaces (root only), dependencies,
//   optionalDependencies, peerDependencies, peerDependenciesMeta, devDependencies

// data/cache/npm/maintainers.json — one entry per package name seen in any lockfile
{ "<name>": { "version": "<max locked version>", "maintainers": ["<username>"], "publisher": "<username>|null" } }

// data/cache/npm/packuments.json — every package maintained by a compromised account + every incident package
{ "<name>": { "maintainers": ["<username>"], "versions": { "<version>": { "publishedAt": "<ISO>", "removed": false } } } }

// data/cache/osv.json
{ "<advisory id>": { "publishedAt": "<ISO>", "affected": ["<name>@<version>"] } }

// data/incidents/<scenarioId>.json
{ "id": "qix-2025-09-08", "title": "...", "compromised": "qix",          // null unless a cited source names the account
  "alertAt": "<ISO>", "removedAt": "<ISO>", "removedAtNote": "approximate; <source url>",
  "versions": [{ "id": "debug@4.4.2", "publishedAt": "<ISO from packument time>", "advisories": ["MAL-2025-46974"] }],
  "pullsIn": [["axios@1.14.1", "plain-crypto-js@4.2.1"]],
  "sources": ["<url>"] }
```

## HTTP API

All JSON. SSE responses are `text/event-stream` with one JSON event per `data:` line. Errors are `{ error, requestId }` with no stack.

| Method + path | Body / query | Response |
|---|---|---|
| `GET /api/health` | | `{ ok: true }` |
| `GET /api/scenarios` | | `IncidentMeta[]` |
| `GET /api/timeline` | `?scenario=` | `{ incident: IncidentMeta, points: TimelinePoint[] }` |
| `GET /api/exposure` | `?scenario=&at=` | `{ at, counts, exposures: Exposure[], scanner: ScannerHit[], grepCount }` |
| `POST /api/triage` | `{ scenario, at? }` or `{ alert, at? }` or `{ guest, scenario, at? }` | SSE `TriageEvent` |
| `POST /api/ask` | `{ runId, question }` | SSE `TriageEvent` (tool_start, tool_result, narration, guard, done) |
| `POST /api/analyze` | `{ url }` or `{ lockfile }` (+ `scenario`) | SSE `AnalyzeEvent`, then call `/api/triage` with `guest` |
| `POST /api/remediate` | `{ scenario, repo, action }` | `{ ok: true }` (scoped to the session cookie) |
| `GET /api/plan` | `?scenario=&tool=` | `{ plan: string[] }` (`GRAPH.EXPLAIN`) |
| `GET /api/stats` | `?scenario=` | `{ graph, nodes: {label, count}[], edges: {type, count}[], ms }` (memoized per process) |

Mock streams for UI work live in `shared/fixtures/`.

### Semantics the UI relies on

- **Timeline:** one point per minute from the lockfile snapshot time to `removedAt + 30 min`. Each point comes from the same `exposureAt` as `/api/exposure`, which is re-run only at `CHANGE_TIMES`, and a test holds the two equal.
- **LOCKED** counts from the repo's newest locked bad publish, since a lockfile cannot pin a version before it exists. **WOULD_PULL** counts while the `ADMITS` window is open.
- **Minutes ahead** is always `advisoryAt - firstExposureAt`, on `/api/scenarios`, the `start` event and the report alike.
- **`Remediation.overrides`** keys are version-qualified (`"debug@4.4.2": "4.4.1"`), so they only re-pin the bad version. Steps run in order: `npm ci` (the lockfile is the fix for WOULD_PULL), then overrides only if you must re-resolve, then rotate secrets (LOCKED only).
- **Narration:** `text` is deterministic (Verdict / Why / Notify / Do, built from the report). `note` is an optional analyst pick: the server builds a few observations from the report (`observations()` in `narrate.ts`) and the LLM replies with one id. The words are never the model's.
