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

// Incident header for a run (not a tool): times, versions, the compromised account and the lockfile snapshot time.
export const INCIDENT = `MATCH (i:Incident {id: $incident})-[:INVOLVES]->(v:Version)
OPTIONAL MATCH (i)-[:COMPROMISED]->(m:Maintainer)
OPTIONAL MATCH (o:Org)
RETURN i.id AS id, i.title AS title, m.name AS maintainer, i.firstPublishAt AS firstPublishAt, i.alertAt AS alertAt,
  i.advisoryAt AS advisoryAt, i.removedAt AS removedAt, i.sources AS sources, o.snapshotAt AS snapshotAt,
  collect({id: v.id, publishedAt: v.publishedAt}) AS versions`;

// incident_exposure (1/3): every repo and its owning team, so CLEAN is counted too.
export const REPOS = `MATCH (r:Repo) OPTIONAL MATCH (r)-[:OWNED_BY]->(t:Team)
RETURN r.id AS repo, r.synthetic AS synthetic, t.name AS team ORDER BY repo`;

// incident_exposure (2/3) LOCKED: a lockfile entry resolves to a malicious version that exists at $at.
export const EXPOSURE_LOCKED = `MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[:RESOLVES_TO]-(d:Dep)
WHERE bad.publishedAt <= $at
RETURN d.repo AS repo, bad.id AS version, min(d.depth) AS depth, collect(DISTINCT d.dev) AS devFlags, bad.publishedAt AS since`;

// incident_exposure (3/3) WOULD_PULL: a declared range resolved to a malicious version while it was live at $at.
// The REQUIRES hop to the locked entry gives the dev/prod badge.
export const EXPOSURE_ADMITS = `MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)<-[a:ADMITS]-(p:Dep)-[r:REQUIRES]->(l:Dep)
WHERE a.fromT <= $at AND $at < a.toT AND l.name = bad.name AND r.range = a.range
RETURN p.repo AS repo, bad.id AS version, min(p.depth) AS depth, collect(DISTINCT l.dev) AS devFlags,
  collect(DISTINCT a.range)[0..3] AS ranges, min(a.fromT) AS since`;

// maintainer_blast_radius: MAINTAINER tier. Repos whose lockfile contains any package the account maintains.
export const MAINTAINER_BLAST_RADIUS = `MATCH (:Maintainer {name: $maintainer})-[:MAINTAINS]->(pkg:Package)<-[:OF]-(:Version)<-[:RESOLVES_TO]-(d:Dep)
RETURN d.repo AS repo, count(DISTINCT pkg) AS packages, collect(DISTINCT pkg.name)[0..6] AS sample,
  min(d.depth) AS shallowest, collect(DISTINCT d.dev) AS devFlags
ORDER BY packages DESC, repo`;

// explain_path: the exact lockfile chain from the repo root to the entry that locks (RESOLVES_TO) or declares a range
// admitting (ADMITS, live at $at) the version. *0.. covers a range declared by the root itself (0 hops).
export const EXPLAIN_PATH = `MATCH (:Repo {id: $repo})-[:ROOT]->(root:Dep)
MATCH (x:Dep {repo: $repo})-[e:RESOLVES_TO|ADMITS]->(:Version {id: $version})
WHERE type(e) = 'RESOLVES_TO' OR (e.fromT <= $at AND $at < e.toT)
WITH root, x, e, shortestPath((root)-[:REQUIRES*0..]->(x)) AS p
RETURN type(e) AS kind, e.range AS range, length(p) AS hops, x.depth AS depth,
  [n IN nodes(p) | n.name + '@' + n.version] AS chain, [n IN nodes(p) | n.path] AS lockPaths
ORDER BY kind DESC, hops LIMIT 3`;

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
// and whether the repo root declares it (npm rejects an override that conflicts with a direct dependency).
export const REMEDIATION_RANGES = `MATCH (bad:Version)<-[:RESOLVES_TO]-(d:Dep)<-[r:REQUIRES]-(p:Dep)
WHERE bad.id IN $versions AND d.repo = $repo
RETURN bad.id AS bad, r.range AS range, 'RESOLVES_TO' AS kind, p.path = '' AS direct
UNION
MATCH (bad:Version)<-[a:ADMITS]-(p:Dep)
WHERE bad.id IN $versions AND p.repo = $repo
RETURN bad.id AS bad, a.range AS range, 'ADMITS' AS kind, p.path = '' AS direct`;

// scanner_view (1/2): the "graph off" baseline. What an advisory-based scanner reports at $at (lockfile vs. OSV, one hop).
export const SCANNER_VIEW = `MATCH (a:Advisory)-[:FLAGS]->(v:Version)<-[:RESOLVES_TO]-(d:Dep)
WHERE a.publishedAt <= $at
RETURN DISTINCT d.repo AS repo, v.id AS version, a.id AS advisory ORDER BY repo, version, advisory`;

// scanner_view (2/2): name grep. Repos where a bad package's name appears at all, with no version, path or owner.
export const NAME_GREP = `MATCH (:Incident {id: $incident})-[:INVOLVES]->(bad:Version)
MATCH (d:Dep) WHERE d.name = bad.name
RETURN count(DISTINCT d.repo) AS repos`;

// recall_triage: this session's earlier assessments and remediation marks for the incident (S10: scoped by session).
export const RECALL_TRIAGE = `MATCH (t:Triage {session: $session})-[:FOR]->(:Incident {id: $incident})
MATCH (t)-[a:ASSESSED]->(r:Repo)
RETURN r.id AS repo, a.tier AS tier, a.action AS action, t.at AS at ORDER BY at DESC`;

// recordTriage (server only, GRAPH.QUERY): never exposed as a tool.
export const RECORD_TRIAGE = `MATCH (i:Incident {id: $incident})
CREATE (t:Triage {id: $id, at: $at, session: $session, summary: $summary})-[:FOR]->(i)
WITH t UNWIND $assessed AS x
MATCH (r:Repo {id: x.repo})
CREATE (t)-[:ASSESSED {tier: x.tier, action: x.action}]->(r)`;
