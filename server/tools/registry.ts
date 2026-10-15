// Tool registry shared by the triage playbook, the Ask loop and MCP. Each tool = Cypher from cypher.ts (GRAPH.RO_QUERY
// via Graph.ro) + a one-line summary for the card and the LLM. recordTriage is the only write and is never a tool.
import { randomUUID } from 'node:crypto';
import type { Exposure, ExposurePath, IncidentMeta, Remediation, ScannerHit, Tier, ToolName, ToolResult } from '../../shared/events.ts';
import { write } from '../graph/client.ts';
import { safeVersion } from '../ingest/admits.ts';
import * as Q from './cypher.ts';
import type { Graph, ToolDef } from './types.ts';

type Row = Record<string, any>;
export const rowsOf = <R>(r: ToolResult) => r.rows as unknown as R[];
export type ExposureRow = Exposure & { since: number | null }; // since: when this repo first became exposed (null if CLEAN)
export type PathRow = Omit<ExposurePath, 'id'> & { depth: number };

// LLM-supplied arguments are untrusted (S1): coerce and cap. They only ever reach Cypher as $params (S3).
const str = (x: unknown, max = 214) => String(x ?? '').slice(0, max);
const strs = (x: unknown, max = 50) => (Array.isArray(x) ? x : x == null ? [] : [x]).slice(0, max).map((v) => str(v));
function time(x: unknown): number {
  const t = typeof x === 'number' ? x : Date.parse(str(x, 40));
  if (!Number.isFinite(t)) throw new Error('Expected a time: epoch ms or ISO 8601');
  return t;
}
export const utc = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
const few = (xs: unknown[], n = 3) => xs.slice(0, n).join(', ') + (xs.length > n ? ` +${xs.length - n} more` : '');
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const nameOf = (nv: string) => nv.slice(0, nv.lastIndexOf('@'));
const uniq = <T>(xs: T[]) => [...new Set(xs)];

// Incident header for a run or the API (not a tool): IncidentMeta with firstExposureAt, the lockfile snapshot time and
// the org id ('guest' for a pasted repo's graph). Guest graphs get their own firstExposureAt from the same query.
export async function incidentHeader(g: Graph, incident: string) {
  const [h] = (await g.ro(Q.INCIDENT, { incident })).rows as Row[];
  if (!h) return undefined;
  const starts = (await g.ro(Q.FIRST_EXPOSURE, { incident })).rows as Row[];
  const locked = new Map(starts.filter((r) => r.locked).map((r) => [r.repo, r.since as number]));
  const first = Math.min(...starts.map((r) => locked.get(r.repo) ?? r.since)); // a locked repo starts at its LOCKED since
  const meta: IncidentMeta = {
    id: h.id, title: h.title, maintainer: h.maintainer ?? null, firstPublishAt: h.firstPublishAt, firstExposureAt: Number.isFinite(first) ? first : null,
    alertAt: h.alertAt, advisoryAt: h.advisoryAt, removedAt: h.removedAt, versions: [...h.versions].sort((a, b) => a.publishedAt - b.publishedAt), sources: h.sources ?? [],
  };
  return { incident: meta, snapshotAt: (h.snapshotAt ?? null) as number | null, org: (h.org ?? null) as string | null };
}
// The one definition of "minutes ahead of the advisory": landing, report and narration all read it.
export const minutesAhead = (i: IncidentMeta) => (i.firstExposureAt == null ? 0 : Math.floor((i.advisoryAt - i.firstExposureAt) / 60_000));

// One tool call: runs queries, records each distinct Cypher verbatim, sums FalkorDB's internal time.
function call(g: Graph) {
  const cypher: string[] = [];
  let ms = 0;
  return {
    q: async (text: string, params: Record<string, unknown>) => {
      const r = await g.ro(text, params);
      if (!cypher.includes(text)) cypher.push(text);
      ms += r.ms;
      return r.rows as Row[];
    },
    result: (tool: ToolName, params: Record<string, unknown>, summary: string, rows: object[], evidence: unknown[]): ToolResult =>
      ({ tool, summary, rows: rows as Row[], evidence: [...new Set(evidence.filter((e): e is string => typeof e === 'string' && e !== ''))], cypher, params, ms: Math.round(ms * 1000) / 1000 }),
  };
}

const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: 'object' as const, properties, required, additionalProperties: false as const });
const S = (description: string) => ({ type: 'string', description });
const AT = S('Scenario time, ISO 8601, e.g. 2025-09-08T13:30:00Z');
const LIST = (description: string) => ({ type: 'array', items: { type: 'string' }, description });

export async function findTarget(g: Graph, p: { q: unknown }) {
  const terms = [...new Set((str(p.q, 500).toLowerCase().match(/[a-z0-9@._/~-]+/g) ?? []).map((t) => t.replace(/[.,]+$/, '')))].filter((t) => t.length > 1).slice(0, 20);
  const c = call(g);
  const rows = terms.length ? await c.q(Q.FIND_TARGET, { terms }) : [];
  const summary = rows.length ? `found ${rows.map((r) => `${r.label.toLowerCase()} ${r.id}`).join(', ')}` : 'no known package, maintainer, version or incident in the text';
  return c.result('find_target', { terms }, summary, rows, rows.map((r) => r.id));
}

export async function suspectVersions(g: Graph, p: { maintainer: unknown; since: unknown; until: unknown }) {
  const params = { maintainer: str(p.maintainer), since: time(p.since), until: time(p.until) };
  const c = call(g);
  const rows = await c.q(Q.SUSPECT_VERSIONS, params);
  const removed = rows.filter((r) => r.removed).length;
  const summary = `${plural(rows.length, 'version')} of ${params.maintainer}'s packages published ${utc(params.since)} to ${utc(params.until)}`
    + (rows.length ? `: ${few(rows.map((r) => r.version))}` : '') + (removed ? `; ${removed} later removed from npm` : '');
  return c.result('suspect_versions', params, summary, rows, [params.maintainer, ...rows.map((r) => r.version)]);
}

const RANK: Record<Tier, number> = { LOCKED: 0, WOULD_PULL: 1, MAINTAINER: 2, CLEAN: 3 };
export async function incidentExposure(g: Graph, p: { incident: unknown; at: unknown }) {
  const params = { incident: str(p.incident), at: time(p.at) };
  const c = call(g);
  const repos = await c.q(Q.REPOS, {});
  const locks = await c.q(Q.EXPOSURE_LOCKED, params);
  // A repo whose lockfile locks a bad version can't be exposed before that lockfile could exist (its LOCKED since).
  const lockedSince = new Map(locks.map((h) => [h.repo as string, h.since as number]));
  const live = (h: Row) => (lockedSince.get(h.repo) ?? -Infinity) <= params.at;
  const hits: Row[] = [
    ...locks.filter(live).map((h) => ({ ...h, tier: 'LOCKED' as const, locked: [h.version] })),
    ...(await c.q(Q.EXPOSURE_ADMITS, params)).filter(live).map((h) => ({ ...h, tier: 'WOULD_PULL' as const })),
  ];
  // Same tiers as the triage report: a repo holding the compromised account's packages is MAINTAINER, not CLEAN.
  const maintainer = (await c.q(Q.INCIDENT, { incident: params.incident }))[0]?.maintainer as string | null | undefined;
  const blast = new Map((maintainer ? await c.q(Q.MAINTAINER_BLAST_RADIUS, { maintainer }) : []).map((b) => [b.repo as string, b]));
  const rows = repos.map((r): ExposureRow => {
    const own = hits.filter((h) => h.repo === r.repo);
    const locked = own.filter((h) => h.tier === 'LOCKED');
    const admits = own.filter((h) => h.tier === 'WOULD_PULL');
    // Versions shallowest first, locked ones first; publish order breaks ties.
    const order = [...own].sort((a, b) => +(b.tier === 'LOCKED') - +(a.tier === 'LOCKED') || a.depth - b.depth || a.since - b.since);
    // A lockfile can't predate any version it locks; otherwise exposure starts at the first bad publish a range admits.
    const since = locked.length ? Math.max(...locked.map((h) => h.since)) : Math.min(...admits.map((h) => h.since));
    const b = !own.length ? blast.get(r.repo) : undefined; // MAINTAINER: depth and dev badge come from the blast radius
    return {
      repo: r.repo, synthetic: !!r.synthetic, team: r.team ?? null,
      tier: locked.length ? 'LOCKED' : admits.length ? 'WOULD_PULL' : b ? 'MAINTAINER' : 'CLEAN',
      versions: uniq(order.map((h) => h.version as string)),
      locked: uniq(own.flatMap((h) => h.locked as string[])).sort(), // what the lockfile pins for each affected package
      depth: own.length ? Math.min(...own.map((h) => h.depth)) : (b?.shallowest ?? 0),
      dev: own.length ? own.every((h) => h.devFlags.every(Boolean)) : !!b && b.devFlags.every(Boolean),
      ranges: uniq(admits.flatMap((h) => h.ranges as string[])),
      packages: (b?.sample as string[] | undefined) ?? [],
      remediated: null, since: Number.isFinite(since) ? since : null,
    };
  }).sort((a, b) => RANK[a.tier] - RANK[b.tier] || a.depth - b.depth || a.repo.localeCompare(b.repo));
  const n = (t: Tier) => rows.filter((r) => r.tier === t).length;
  const exposed = rows.filter((r) => r.tier !== 'CLEAN');
  const summary = `at ${utc(params.at)}: ${n('LOCKED')} LOCKED, ${n('WOULD_PULL')} WOULD_PULL, ${n('MAINTAINER')} MAINTAINER, ${n('CLEAN')} CLEAN of ${plural(rows.length, 'repo')}`
    + (exposed.length ? `; e.g. ${few(exposed.map((r) => r.repo))}` : '');
  return c.result('incident_exposure', params, summary, rows, exposed.flatMap((r) => [r.repo, r.team, ...r.versions, ...(r.locked ?? []), ...r.ranges, ...r.packages]));
}

// filter_exposures: the complete list behind the exposure table (incident_exposure's non-CLEAN rows, same queries),
// filtered, with counts per team. Ask answers list, count and owner questions from it, so no match goes unnamed.
const FILTER_TIERS = new Set(['LOCKED', 'WOULD_PULL', 'MAINTAINER']);
export async function filterExposures(g: Graph, p: { incident: unknown; at: unknown; tier?: unknown; prod_only?: unknown; team?: unknown; repo?: unknown }) {
  const all = await incidentExposure(g, { incident: p.incident, at: p.at });
  const tier = p.tier == null ? '' : str(p.tier, 20).toUpperCase();
  const f = { tier: FILTER_TIERS.has(tier) ? tier : '', prodOnly: p.prod_only === true || p.prod_only === 'true', team: str(p.team ?? '', 60).toLowerCase(), repo: str(p.repo ?? '', 140).toLowerCase() };
  const exposed = rowsOf<ExposureRow>(all).filter((e) => e.tier !== 'CLEAN');
  const rows = exposed
    .filter((e) => (!f.tier || e.tier === f.tier) && (!f.prodOnly || !e.dev) && (!f.team || (e.team ?? '').toLowerCase() === f.team)
      && (!f.repo || e.repo.toLowerCase() === f.repo || e.repo.toLowerCase().split('/')[1] === f.repo))
    .map((e) => ({ repo: e.repo, tier: e.tier, team: e.team, dev: e.dev, versions: e.versions, locked: e.locked ?? [] }));
  const teams = new Map<string, number>();
  for (const r of rows) teams.set(r.team ?? 'no owner', (teams.get(r.team ?? 'no owner') ?? 0) + 1);
  const label = [f.tier && `tier ${f.tier}`, f.prodOnly && 'prod only', f.team && `team ${str(p.team, 60)}`, f.repo && `repo ${str(p.repo, 140)}`].filter(Boolean).join(', ') || 'no filter';
  const params = { incident: all.params.incident, at: all.params.at, ...(f.tier && { tier: f.tier }), ...(f.prodOnly && { prod_only: true }), ...(f.team && { team: str(p.team, 60) }), ...(f.repo && { repo: str(p.repo, 140) }) };
  const summary = `${rows.length} of ${plural(exposed.length, 'exposed repo')} ${rows.length === 1 ? 'matches' : 'match'} (${label})`
    + (rows.length ? ` across ${plural(teams.size, 'team')}: ${[...teams].map(([t, n]) => `${t} ${n}`).join(', ')}` : '');
  return { ...all, tool: 'filter_exposures' as const, params, summary, rows, evidence: uniq(rows.flatMap((r) => [r.repo, r.team ?? '', ...r.versions, ...r.locked]).filter(Boolean)) };
}

export async function maintainerBlastRadius(g: Graph, p: { maintainer: unknown }) {
  const params = { maintainer: str(p.maintainer) };
  const c = call(g);
  const rows = (await c.q(Q.MAINTAINER_BLAST_RADIUS, params)).map((r) => ({ repo: r.repo, packages: r.packages, sample: r.sample, shallowest: r.shallowest, dev: r.devFlags.every(Boolean) }));
  const summary = `${params.maintainer}'s packages are in the lockfiles of ${plural(rows.length, 'repo')}` + (rows.length ? `; most: ${rows[0].repo} (${plural(rows[0].packages, 'package')})` : '');
  return c.result('maintainer_blast_radius', params, summary, rows, [params.maintainer, ...rows.flatMap((r) => [r.repo, ...r.sample])]);
}

export async function explainPath(g: Graph, p: { repo: unknown; version: unknown; at: unknown }) {
  const params = { repo: str(p.repo), version: str(p.version), at: time(p.at) };
  const c = call(g);
  const seen = new Set<string>();
  // Chain, range and hops first (the card shows the leading columns); identical paths through different lockfile
  // locations collapse to one row.
  const rows = (await c.q(Q.EXPLAIN_PATH, params)).map((r): PathRow => ({
    chain: [params.repo, ...r.chain.slice(1)], range: r.range ?? null, hops: r.hops, kind: r.kind,
    repo: params.repo, version: params.version, depth: r.depth, lockPaths: r.lockPaths,
  })).filter((r) => {
    const k = `${r.kind} ${r.range} ${r.chain.join(' > ')}`;
    return !seen.has(k) && !!seen.add(k);
  });
  const b = rows[0];
  const summary = !b ? `no path from ${params.repo} to ${params.version} at ${utc(params.at)}`
    : b.kind === 'RESOLVES_TO'
      ? `${params.repo} locks ${params.version}${b.hops > 1 ? `, ${plural(b.hops, 'hop')} deep via ${b.chain.slice(1, -1).join(' > ')}` : ' as a direct dependency'}`
      : b.hops ? `${params.repo}: its dependency ${b.chain.at(-1)} declares ${b.range}, admitting ${params.version} (${plural(b.hops, 'hop')} deep)`
        : `${params.repo} declares ${b.range} at the root, admitting ${params.version}`;
  return c.result('explain_path', params, summary, rows, rows.flatMap((r) => [r.repo, r.version, r.range, ...r.chain]));
}

export async function routeOwners(g: Graph, p: { repos: unknown }) {
  const params = { repos: strs(p.repos, 200) };
  const c = call(g);
  const rows = await c.q(Q.ROUTE_OWNERS, params);
  const summary = `${plural(rows.length, 'team')} to notify: ${few(rows.map((r) => `${r.team} (${r.repos.length})`), 6)}`;
  return c.result('route_owners', params, summary, rows, rows.flatMap((r) => [r.team, r.channel, ...r.repos]));
}

export async function concentrationRisk(g: Graph, p: { top?: unknown }) {
  const params = { top: Math.min(10, Math.max(1, Math.trunc(Number(p.top) || 3))) };
  const c = call(g);
  const rows = await c.q(Q.CONCENTRATION_RISK, params);
  const summary = `top ${plural(rows.length, 'maintainer')} by PageRank influence: ${rows.map((r) => `${r.maintainer} (${plural(r.packages, 'package')}, ${plural(r.reposReached, 'repo')})`).join(', ')}`;
  return c.result('concentration_risk', params, summary, rows, rows.map((r) => r.maintainer));
}

export async function draftRemediation(g: Graph, p: { repo: unknown; versions: unknown; at: unknown }) {
  const params = { repo: str(p.repo), versions: strs(p.versions, 20), at: time(p.at) };
  const c = call(g);
  const versions = await c.q(Q.REMEDIATION_VERSIONS, params);
  const ranges = await c.q(Q.REMEDIATION_RANGES, params);
  // Override keys are version-qualified ("debug@4.4.2": "4.4.1"): npm then replaces only the malicious version, so a
  // dependent on another major (log-symbols on chalk ^4) is never forced onto an incompatible one.
  const overrides: Record<string, string> = {};
  const notes: string[] = [];
  for (const bad of params.versions) {
    const name = nameOf(bad);
    const vs = versions.filter((v) => v.bad === bad).map((v) => ({ version: v.version, publishedAt: v.publishedAt, malicious: v.malicious }));
    const mine = ranges.filter((r) => r.bad === bad);
    const pin = safeVersion(uniq(mine.map((r) => r.range as string)), vs, params.at) ?? safeVersion([], vs, params.at); // no version fits every range: latest clean
    if (!pin) notes.push(`${name} had no clean release at ${utc(params.at)}: remove it, or pin the package that pulls it in`);
    else {
      overrides[bad] = pin;
      if (mine.some((r) => r.direct)) notes.push(`If you add the ${name} override, set the root dependency on ${name} to ${pin} too: npm rejects an override that conflicts with a direct dependency`);
    }
  }
  const isLocked = ranges.some((r) => r.kind === 'RESOLVES_TO');
  const badLocked = uniq(ranges.filter((r) => r.kind === 'RESOLVES_TO').map((r) => r.bad as string));
  const safeLocked = uniq(ranges.filter((r) => r.kind === 'ADMITS' && r.locked && !params.versions.includes(r.locked)).map((r) => r.locked as string)).sort();
  const until = Math.max(...ranges.filter((r) => r.until != null).map((r) => r.until as number));
  const pairs = Object.entries(overrides).map(([k, v]) => `"${k}": "${v}"`).join(', ');
  const pins = Object.entries(overrides).map(([k, v]) => `${nameOf(k)}@${v}`);
  const missing = uniq(params.versions.filter((v) => !overrides[v]).map(nameOf));
  // Order: what keeps you safe today, then the conditional override, then LOCKED's rotate-and-rebuild.
  const steps = (isLocked
    ? [
      `Your lockfile pins ${badLocked.join(', ')}, which ${badLocked.length === 1 ? 'is' : 'are'} malicious: ${pairs ? `add the overrides ${pairs} to package.json, run npm install to regenerate the lockfile and commit it` : 'remove them and regenerate the lockfile'}`,
      ...notes,
      'Rotate secrets that builds and CI could read since the first malicious publish',
      'Rebuild and redeploy anything built from this lockfile during the window',
    ]
    : [
      `Keep installing from your committed lockfile (npm ci): ${safeLocked.length ? `it pins ${safeLocked.join(', ')} (safe)` : 'it never resolved the malicious version'}`,
      !pairs ? ''
        : Number.isFinite(until) && until <= params.at ? `The malicious versions stopped resolving at ${utc(until)}, so a fresh resolve now gets a clean one; to be sure anyway, add the overrides ${pairs} to package.json`
          // the removal time is not known yet at params.at, so the step never names it
          : `Only if you must re-resolve dependencies while the malicious versions are live, add the overrides ${pairs} to package.json; each replaces only the malicious version`,
      ...notes,
    ]).filter(Boolean);
  const prBody = `${isLocked ? 'The lockfile resolves' : 'Declared ranges admit'} ${params.versions.join(', ')}. `
    + (pairs ? `This adds version-qualified overrides (${pairs}) that replace only the malicious versions.` : 'No clean version to pin yet.');
  const row: Remediation = { repo: params.repo, overrides, steps: uniq(steps), prBody };
  const summary = `${params.repo}: lockfile pins ${isLocked ? `${badLocked.join(', ')} (malicious)` : safeLocked.length ? `${safeLocked.join(', ')} (safe)` : 'no malicious version'}; `
    + `${pins.length ? `override to ${pins.join(', ')}` : 'nothing safe to pin'}${missing.length ? `; no clean ${missing.join(', ')}` : ''}${isLocked ? '; rotate secrets and rebuild' : ''}`;
  return c.result('draft_remediation', params, summary, [row], [params.repo, ...pins, ...Object.keys(overrides), ...badLocked, ...safeLocked]);
}

// scanner_view also returns grepCount (the other "graph off" baseline) for the report.
export async function scannerView(g: Graph, p: { incident: unknown; at: unknown }) {
  const params = { incident: str(p.incident), at: time(p.at) };
  const c = call(g);
  const rows = (await c.q(Q.SCANNER_VIEW, params)) as ScannerHit[];
  const grepCount = Number((await c.q(Q.NAME_GREP, params))[0]?.repos ?? 0);
  const summary = `advisory scanner at ${utc(params.at)}: ${plural(rows.length, 'hit')}${rows.length ? ` (${few(rows.map((r) => `${r.repo} ${r.version}`))})` : ''}; name grep: ${plural(grepCount, 'repo')} mention a bad package name, with no version, path or owner`;
  return { result: c.result('scanner_view', params, summary, rows, rows.flatMap((r) => [r.repo, r.version])), grepCount };
}

export async function recallTriage(g: Graph, p: { session: unknown; incident: unknown }) {
  const params = { session: str(p.session, 64), incident: str(p.incident) };
  if (!params.session) throw new Error('recall_triage needs the server-side session');
  const c = call(g);
  const seen = new Set<string>();
  // Latest row per repo, but a remediation mark outlives the plain per-run records (action null) written after it.
  const rows = (await c.q(Q.RECALL_TRIAGE, params)).sort((a, b) => +!a.action - +!b.action).filter((r) => !seen.has(r.repo) && seen.add(r.repo));
  const done = rows.filter((r) => r.action === 'remediated');
  const summary = rows.length ? `${plural(rows.length, 'repo')} assessed earlier in this session; ${done.length} marked remediated${done.length ? `: ${few(done.map((r) => r.repo))}` : ''}` : 'no earlier assessments in this session';
  return c.result('recall_triage', { incident: params.incident }, summary, rows, rows.map((r) => r.repo)); // the session id stays server-side
}

const TIERS = new Set<string>(['LOCKED', 'WOULD_PULL', 'MAINTAINER', 'CLEAN']);
export const ACTIONS = new Set<string>(['remediated', 'notified', 'accepted-risk']);

// Server only (S10): triage memory and "mark remediated", scoped to the caller's anonymous session id.
export async function recordTriage(graphName: string, t: { session: string; incident: string; at: number; summary: string; assessed: { repo: string; tier: Tier; action: string | null }[] }) {
  const id = randomUUID();
  // Rebuild each row from allowlisted fields: never pass caller objects into a query as maps (S3/S10).
  const assessed = t.assessed.slice(0, 200).map((a) => ({
    repo: str(a.repo, 140),
    tier: TIERS.has(a.tier) ? a.tier : 'CLEAN',
    action: a.action !== null && ACTIONS.has(a.action) ? a.action : null,
  }));
  const marked = assessed.some((a) => a.action !== null);
  await write(graphName, Q.RECORD_TRIAGE, { id, session: str(t.session, 64), incident: str(t.incident), at: time(t.at), summary: str(t.summary, 500), assessed, marked });
  await write(graphName, Q.PRUNE_TRIAGE, { marked }); // shared org graphs get no TTL, so cap what visitors can accumulate
  return id;
}

export const TOOLS: Record<ToolName, ToolDef<any>> = {
  find_target: { name: 'find_target', description: 'Find known maintainers, packages, name@version ids and incidents mentioned in free text (e.g. an alert).', parameters: obj({ q: S('Free text, e.g. "debug@4.4.2 and chalk hijacked"') }, ['q']), run: findTarget },
  suspect_versions: { name: 'suspect_versions', description: "Versions of a maintainer's packages published in a time window: catches hijacked releases before any advisory exists.", parameters: obj({ maintainer: S('npm username'), since: AT, until: AT }, ['maintainer', 'since', 'until']), run: suspectVersions },
  incident_exposure: { name: 'incident_exposure', description: 'Tier every repo at a moment: LOCKED (lockfile resolves a malicious version), WOULD_PULL (a declared range resolved to one while it was live), MAINTAINER (holds packages of the compromised account), CLEAN.', parameters: obj({ incident: S('Incident id, e.g. qix-2025-09-08'), at: AT }, ['incident', 'at']), run: incidentExposure },
  maintainer_blast_radius: { name: 'maintainer_blast_radius', description: "Repos whose lockfiles contain any package the maintainer publishes (MAINTAINER tier), with the shallowest depth.", parameters: obj({ maintainer: S('npm username') }, ['maintainer']), run: maintainerBlastRadius },
  explain_path: { name: 'explain_path', description: 'Exact lockfile chain from a repo root to the entry that locks a version or declares a range admitting it.', parameters: obj({ repo: S('owner/name'), version: S('name@version'), at: AT }, ['repo', 'version', 'at']), run: explainPath },
  route_owners: { name: 'route_owners', description: 'Owning team and channel for each repo, grouped by team.', parameters: obj({ repos: LIST('owner/name ids') }, ['repos']), run: routeOwners },
  concentration_risk: { name: 'concentration_risk', description: 'Maintainers whose packages carry the most PageRank across the org dependency graph: who could be the next compromised account.', parameters: obj({ top: { type: 'integer', minimum: 1, maximum: 10, description: 'How many maintainers' } }, []), run: concentrationRisk },
  draft_remediation: { name: 'draft_remediation', description: 'Safe "overrides" pins (highest clean version live at the time that every affected range accepts) and steps for one repo.', parameters: obj({ repo: S('owner/name'), versions: LIST('malicious name@version ids in this repo'), at: AT }, ['repo', 'versions', 'at']), run: draftRemediation },
  scanner_view: { name: 'scanner_view', description: 'What an advisory-based scanner reports at a moment (lockfile x published OSV records), plus a plain name grep.', parameters: obj({ incident: S('Incident id'), at: AT }, ['incident', 'at']), run: async (g, p) => (await scannerView(g, p)).result },
  filter_exposures: {
    name: 'filter_exposures',
    description: 'The complete list of exposed repos at a moment (the exposure table), optionally filtered by tier, prod-only, owning team or repo, with team, dev flag, malicious versions and what each lockfile pins, plus counts per team. Use it for every list, count or owner question: it never omits a match.',
    parameters: obj({
      incident: S('Incident id'), at: AT,
      tier: { type: 'string', enum: ['LOCKED', 'WOULD_PULL', 'MAINTAINER'], description: 'Only this tier' },
      prod_only: { type: 'boolean', description: 'Only repos with a production (not dev-only) hit' },
      team: S('Owning team name, e.g. QA'), repo: S('owner/name, or just the name'),
    }, ['incident', 'at']),
    run: filterExposures,
  },
  // The session is never an LLM argument (S10): the dispatcher must overwrite p.session with the caller's cookie session.
  recall_triage: { name: 'recall_triage', description: 'Earlier assessments and remediation marks for this incident in the current session.', parameters: obj({ incident: S('Incident id') }, ['incident']), run: recallTriage },
};
