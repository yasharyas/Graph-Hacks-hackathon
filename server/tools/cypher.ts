// Every query the tools run, verbatim. Single source: the README is generated from this file.
// Rules (S3): values only ever arrive as $params; variable-length bounds are literals; all tool reads use GRAPH.RO_QUERY.

// find_target: exact, indexed lookups for the terms of a free-text alert (package, maintainer, name@version, incident id).
export const FIND_TARGET = `UNWIND $terms AS t MATCH (n:Maintainer {name: t}) RETURN 'Maintainer' AS label, n.name AS id
UNION UNWIND $terms AS t MATCH (n:Version {id: t}) RETURN 'Version' AS label, n.id AS id
UNION UNWIND $terms AS t MATCH (n:Package {name: t}) RETURN 'Package' AS label, n.name AS id
UNION UNWIND $terms AS t MATCH (n:Incident {id: t}) RETURN 'Incident' AS label, n.id AS id`;

// suspect_versions: pre-advisory detection. Every version of the account's packages published in the window.
export const SUSPECT_VERSIONS = `MATCH (:Maintainer {name: $maintainer})-[:MAINTAINS]->(p:Package)<-[:OF]-(v:Version)
WHERE v.publishedAt >= $since AND v.publishedAt < $until
RETURN v.id AS version, p.name AS package, v.publishedAt AS publishedAt, v.removed AS removed
ORDER BY publishedAt LIMIT 40`;

// Incident header for a run (not a tool): times, versions, the compromised account, the lockfile snapshot time and
// the org ('guest' for a pasted repo's graph).
export const INCIDENT = `MATCH (i:Incident {id: $incident})-[:INVOLVES]->(v:Version)
OPTIONAL MATCH (i)-[:COMPROMISED]->(m:Maintainer)
OPTIONAL MATCH (o:Org)
RETURN i.id AS id, i.title AS title, m.name AS maintainer, i.firstPublishAt AS firstPublishAt, i.alertAt AS alertAt,
  i.advisoryAt AS advisoryAt, i.removedAt AS removedAt, i.sources AS sources, o.snapshotAt AS snapshotAt, o.id AS org,
  collect({id: v.id, publishedAt: v.publishedAt}) AS versions`;

// Incident header (not a tool): the first moment this graph shows any repo exposed, under incident_exposure's rule (a
// repo that locks a bad version starts at its LOCKED since, any other at its earliest ADMITS window). It anchors
// "minutes ahead of the advisory" everywhere.
export const FIRST_EXPOSURE = `MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[:RESOLVES_TO]-(d:Dep)
RETURN d.repo AS repo, max(bad.publishedAt) AS since, true AS locked
UNION ALL
MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep)
WHERE a.fromT < a.toT AND l.name = bad.name AND r.range = a.range
RETURN p.repo AS repo, min(a.fromT) AS since, false AS locked`;

// incident_exposure (1/3): every repo and its owning team, so CLEAN is counted too.
export const REPOS = `MATCH (r:Repo) OPTIONAL MATCH (r)-[:OWNED_BY]->(t:Team)
RETURN r.id AS repo, r.synthetic AS synthetic, t.name AS team ORDER BY repo`;

// incident_exposure (2/3) LOCKED: lockfile entries that resolve to a malicious version. A lockfile can't predate the
// newest bad version it locks, so that publish time is the repo's `since`: before it, none of the repo's hits count.
export const EXPOSURE_LOCKED = `MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[:RESOLVES_TO]-(d:Dep)
WITH d.repo AS repo, bad, min(d.depth) AS depth, collect(DISTINCT d.dev) AS devFlags
WITH repo, max(bad.publishedAt) AS since, collect({version: bad.id, depth: depth, devFlags: devFlags}) AS hits
UNWIND hits AS h
RETURN repo, h.version AS version, h.depth AS depth, h.devFlags AS devFlags, since`;

// incident_exposure (3/3) WOULD_PULL: a declared range resolved to a malicious version while it was live at $at.
// The REQUIRES hop to the locked entry gives the dev/prod badge and what the lockfile pins for that range instead.
export const EXPOSURE_ADMITS = `MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep)
WHERE a.fromT <= $at AND $at < a.toT AND l.name = bad.name AND r.range = a.range
RETURN p.repo AS repo, bad.id AS version, min(p.depth) AS depth, collect(DISTINCT l.dev) AS devFlags,
  collect(DISTINCT a.range)[0..3] AS ranges, min(a.fromT) AS since, collect(DISTINCT l.name + '@' + l.version) AS locked`;

// maintainer_blast_radius: MAINTAINER tier. Repos whose lockfile contains any package the account maintains.
export const MAINTAINER_BLAST_RADIUS = `MATCH (:Maintainer {name: $maintainer})-[:MAINTAINS]->(pkg:Package)<-[:OF]-(:Version)<-[:RESOLVES_TO]-(d:Dep)
RETURN d.repo AS repo, count(DISTINCT pkg) AS packages, collect(DISTINCT pkg.name)[0..6] AS sample,
  min(d.depth) AS shallowest, collect(DISTINCT d.dev) AS devFlags
ORDER BY packages DESC, repo`;

// explain_path: the exact lockfile chain from the repo root to the entry that locks (RESOLVES_TO) or declares a range
// admitting (ADMITS, live at $at) the version. *0.. covers a range declared by the root itself (0 hops). Dep.depth is
// the BFS depth from the root, so only the 3 shallowest entries need a shortestPath walk.
export const EXPLAIN_PATH = `MATCH (:Repo {id: $repo})-[:ROOT]->(root:Dep)
MATCH (:Version {id: $version})<-[e:RESOLVES_TO|ADMITS]-(x:Dep {repo: $repo})
WHERE type(e) = 'RESOLVES_TO' OR (e.fromT <= $at AND $at < e.toT)
WITH root, x, e ORDER BY type(e) DESC, x.depth LIMIT 3
WITH root, x, e, shortestPath((root)-[:REQUIRES*0..]->(x)) AS p
RETURN type(e) AS kind, e.range AS range, length(p) AS hops, x.depth AS depth,
  [n IN nodes(p) | n.name + '@' + n.version] AS chain, [n IN nodes(p) | n.path] AS lockPaths
ORDER BY kind DESC, hops LIMIT 3`;

// graph stats (the Graph stats tab, before any triage): how many nodes each demo graph holds, per label (visitors'
// session Triage records left out).
export const NODE_COUNTS = `MATCH (n) WHERE NOT n:Triage RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC`;
// graph stats: how many relationships, per type (REQUIRES is the lockfile tree, ADMITS the time-windowed exposure).
export const EDGE_COUNTS = `MATCH ()-[r]->() WHERE NOT type(r) IN ['FOR', 'ASSESSED'] RETURN type(r) AS type, count(r) AS count ORDER BY count DESC`;

// route_owners: who to notify.
export const ROUTE_OWNERS = `MATCH (r:Repo)-[:OWNED_BY]->(t:Team) WHERE r.id IN $repos
RETURN t.name AS team, t.channel AS channel, collect(r.id) AS repos ORDER BY team`;

// concentration_risk: "who is the next qix?" PageRank over the package dependency projection, summed per maintainer.
export const CONCENTRATION_RISK = `MATCH (m:Maintainer)-[:MAINTAINS]->(p:Package)
WITH m, sum(p.pagerank) AS influence, count(p) AS packages ORDER BY influence DESC LIMIT $top
MATCH (m)-[:MAINTAINS]->(:Package)<-[:OF]-(:Version)<-[:RESOLVES_TO]-(d:Dep)
RETURN m.name AS maintainer, influence, packages, count(DISTINCT d.repo) AS reposReached ORDER BY influence DESC`;

// draft_remediation (1/2): installable, non-malicious versions of each bad version's package that were live at $at.
export const REMEDIATION_VERSIONS = `MATCH (bad:Version)-[:OF]->(:Package)<-[:OF]-(v:Version)
WHERE bad.id IN $versions AND v.publishedAt <= $at AND coalesce(v.removed, false) = false
RETURN bad.id AS bad, bad.name AS package, v.version AS version, v.publishedAt AS publishedAt, coalesce(v.malicious, false) AS malicious`;

// draft_remediation (2/2): the repo's ranges that lock or admit each bad version (the pin must satisfy all of them),
// whether the repo root declares it and as what (npm rejects an override that conflicts with a direct dependency), what the
// lockfile pins for that range, and when the range stopped admitting the bad version.
export const REMEDIATION_RANGES = `MATCH (bad:Version)<-[:RESOLVES_TO]-(d:Dep)<-[r:REQUIRES]-(p:Dep)
WHERE bad.id IN $versions AND d.repo = $repo
RETURN bad.id AS bad, r.range AS range, 'RESOLVES_TO' AS kind, p.path = '' AS direct, r.kind AS dep, bad.id AS locked, null AS until
UNION
MATCH (bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep)
WHERE bad.id IN $versions AND p.repo = $repo AND l.name = bad.name AND r.range = a.range
RETURN bad.id AS bad, a.range AS range, 'ADMITS' AS kind, p.path = '' AS direct, r.kind AS dep, l.name + '@' + l.version AS locked, a.toT AS until`;

// scanner_view (1/2): the "graph off" baseline. What an advisory-based scanner reports at $at (lockfile vs. OSV, one hop).
export const SCANNER_VIEW = `MATCH (a:Advisory)-[:FLAGS]->(v:Version)<-[:RESOLVES_TO]-(d:Dep)
WHERE a.publishedAt <= $at
RETURN DISTINCT d.repo AS repo, v.id AS version, a.id AS advisory ORDER BY repo, version, advisory`;

// scanner_view (2/2): name grep. Repos where a bad package's name appears at all, with no version, path or owner.
export const NAME_GREP = `MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)
MATCH (d:Dep) WHERE d.name = bad.name
RETURN count(DISTINCT d.repo) AS repos`;

// Timeline (server only): every moment an exposure tier or scanner count can change. Between two of them every
// incident_exposure / scanner_view answer is the same, so the 1-minute timeline runs those once per segment.
export const CHANGE_TIMES = `MATCH (:Incident {id: $incident})-[:INVOLVES]->(v:Version) RETURN v.publishedAt AS t
UNION MATCH (:Incident {id: $incident})-[:INVOLVES]->(:Version)<-[a:ADMITS]-(:Dep) RETURN a.fromT AS t
UNION MATCH (:Incident {id: $incident})-[:INVOLVES]->(:Version)<-[a:ADMITS]-(:Dep) RETURN a.toT AS t
UNION MATCH (a:Advisory) RETURN a.publishedAt AS t`;

// recall_triage: this session's earlier assessments and remediation marks for the incident (S10: scoped by session).
export const RECALL_TRIAGE = `MATCH (t:Triage {session: $session})-[:FOR]->(:Incident {id: $incident})
MATCH (t)-[a:ASSESSED]->(r:Repo)
RETURN r.id AS repo, a.tier AS tier, a.action AS action, t.at AS at ORDER BY at DESC`;

// recordTriage (server only, GRAPH.QUERY): never exposed as a tool.
export const RECORD_TRIAGE = `MATCH (i:Incident {id: $incident})
CREATE (t:Triage {id: $id, at: $at, session: $session, summary: $summary, marked: $marked})-[:FOR]->(i)
WITH t UNWIND $assessed AS x
MATCH (r:Repo {id: x.repo})
CREATE (t)-[:ASSESSED {tier: x.tier, action: x.action}]->(r)`;

// recordTriage (server only): keep runtime triage memory bounded in the shared graphs, oldest first. Runs and
// remediation marks are capped apart, so other visitors' runs can never push a session's marks out.
export const PRUNE_TRIAGE = `MATCH (t:Triage) WHERE coalesce(t.marked, false) = $marked
WITH t ORDER BY t.at DESC SKIP 1000 DETACH DELETE t`;
