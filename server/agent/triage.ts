// Deterministic, graph-driven triage playbook: each step is a registry tool, and what runs next depends on what the
// graph returned. One LLM call at the end narrates the report; the guard checks it, and the template narrator is
// the fallback. CLI: node --env-file-if-exists=.env server/agent/triage.ts qix-2025-09-08 2025-09-08T13:30:00Z
import { randomUUID } from 'node:crypto';
import type {
  Concentration, Exposure, ExposurePath, IncidentMeta, LlmMode, Notice, OwnerGroup, Remediation, Report, ScannerHit, ScenarioId, Tier, ToolName, ToolResult, TriageEvent,
} from '../../shared/events.ts';
import { close, graph, orgGraph } from '../graph/client.ts';
import { INCIDENT } from '../tools/cypher.ts';
import * as T from '../tools/registry.ts';
import type { Graph } from '../tools/types.ts';
import { guard } from './guard.ts';
import { chat } from './llm.ts';
import { evidenceSet, narrationMessages, templateNarration } from './narrate.ts';

const TOP = 5; // repos that get an explain_path and a draft_remediation
const DAY = 86_400_000;
// Most severe first: LOCKED, WOULD_PULL prod, WOULD_PULL dev, MAINTAINER, CLEAN; then shallowest.
const rank = (e: Exposure) => ({ LOCKED: 0, WOULD_PULL: e.dev ? 2 : 1, MAINTAINER: 3, CLEAN: 4 })[e.tier];

export async function* triage({ graph: g, scenario, at, alert, session, signal }: { graph: Graph; scenario: ScenarioId; at: number; alert?: string; session?: string; signal?: AbortSignal }): AsyncGenerator<TriageEvent> {
  const t0 = performance.now();
  const runId = randomUUID();
  let n = 0;
  // Emits tool_start, runs the tool, lets `tag` touch the rows (evidence ids), emits tool_result.
  async function* step<R extends ToolResult | { result: ToolResult }>(tool: ToolName, params: Record<string, unknown>, run: () => Promise<R>, tag?: (r: ToolResult) => void): AsyncGenerator<TriageEvent, R> {
    const id = `t${++n}`;
    yield { type: 'tool_start', id, tool, params };
    const r = await run();
    const result = ('result' in r ? r.result : r) as ToolResult;
    tag?.(result);
    yield { type: 'tool_result', id, result };
    return r;
  }

  try {
    const [h] = (await g.ro(INCIDENT, { incident: scenario })).rows as Record<string, any>[];
    if (!h) throw new Error(`Incident ${scenario} is not in graph ${g.name}`);
    const incident: IncidentMeta = {
      id: h.id, title: h.title, maintainer: h.maintainer ?? null, firstPublishAt: h.firstPublishAt, alertAt: h.alertAt, advisoryAt: h.advisoryAt,
      removedAt: h.removedAt, versions: [...h.versions].sort((a, b) => a.publishedAt - b.publishedAt), sources: h.sources ?? [],
    };
    yield { type: 'start', runId, graph: g.name, incident, at };

    // Before the first advisory nobody has a version list: derive suspects from publish times. An alert that names
    // a version counts as knowing one; an alert that names an account switches the account under suspicion.
    let account = incident.maintainer;
    let versionsKnown = at >= incident.advisoryAt;
    if (alert) {
      const found = yield* step('find_target', { q: alert }, () => T.findTarget(g, { q: alert }));
      versionsKnown = found.rows.some((r) => r.label === 'Version');
      account = (found.rows.find((r) => r.label === 'Maintainer')?.id as string) ?? account;
    }
    if (!versionsKnown && account) {
      const p = { maintainer: account, since: h.snapshotAt ?? at - DAY, until: at };
      yield* step('suspect_versions', p, () => T.suspectVersions(g, p));
    }

    const exp = yield* step('incident_exposure', { incident: incident.id, at }, () => T.incidentExposure(g, { incident: incident.id, at }));
    const rows = T.rowsOf<T.ExposureRow>(exp);
    if (account) {
      const blast = yield* step('maintainer_blast_radius', { maintainer: account }, () => T.maintainerBlastRadius(g, { maintainer: account }));
      for (const b of T.rowsOf<{ repo: string; sample: string[]; shallowest: number; dev: boolean }>(blast)) {
        const e = rows.find((r) => r.repo === b.repo);
        if (e?.tier === 'CLEAN') Object.assign(e, { tier: 'MAINTAINER', packages: b.sample, depth: b.shallowest, dev: b.dev });
      }
    }
    if (session) {
      const recall = yield* step('recall_triage', { incident: incident.id }, () => T.recallTriage(g, { session, incident: incident.id }));
      for (const r of T.rowsOf<{ repo: string; action: string | null; at: number }>(recall)) {
        const e = rows.find((x) => x.repo === r.repo);
        if (e && r.action) e.remediated = { at: r.at, action: r.action };
      }
    }

    const exposures: Exposure[] = rows.filter((r) => r.tier !== 'CLEAN').sort((a, b) => rank(a) - rank(b) || a.depth - b.depth || a.repo.localeCompare(b.repo))
      .map(({ since, ...e }) => e);
    const hit = exposures.filter((e) => e.tier === 'LOCKED' || e.tier === 'WOULD_PULL').slice(0, TOP);

    const paths: ExposurePath[] = [];
    for (const e of hit) {
      const p = { repo: e.repo, version: e.versions[0], at };
      yield* step('explain_path', p, () => T.explainPath(g, p), (r) => {
        const best = T.rowsOf<T.PathRow & { id?: string }>(r)[0]; // rows come best first: locked entries, then fewest hops
        if (!best) return;
        best.id = `E${paths.length + 1}`;
        const { depth, ...path } = best;
        paths.push(path as ExposurePath);
      });
    }

    const repos = exposures.map((e) => e.repo);
    const owners = repos.length ? T.rowsOf<OwnerGroup>(yield* step('route_owners', { repos }, () => T.routeOwners(g, { repos }))) : [];
    const remediations: Remediation[] = [];
    for (const e of hit) {
      const p = { repo: e.repo, versions: e.versions, at };
      remediations.push(...T.rowsOf<Remediation>(yield* step('draft_remediation', p, () => T.draftRemediation(g, p))));
    }
    const concentration = T.rowsOf<Concentration>(yield* step('concentration_risk', { top: 3 }, () => T.concentrationRisk(g, { top: 3 })));
    const scan = yield* step('scanner_view', { incident: incident.id, at }, () => T.scannerView(g, { incident: incident.id, at }));

    const counts = Object.fromEntries((['LOCKED', 'WOULD_PULL', 'MAINTAINER', 'CLEAN'] as Tier[]).map((t) => [t, rows.filter((r) => r.tier === t).length])) as Record<Tier, number>;
    const first = Math.min(...rows.filter((r) => r.tier === 'LOCKED' || r.tier === 'WOULD_PULL').map((r) => r.since ?? Infinity));
    const report: Report = {
      incident, at, counts,
      minutesAhead: Number.isFinite(first) ? Math.floor((incident.advisoryAt - first) / 60_000) : 0,
      scanner: T.rowsOf<ScannerHit>(scan.result), grepCount: scan.grepCount,
      exposures, paths, owners, remediations, notices: notices(incident, exposures, owners), concentration,
    };
    yield { type: 'report', report };

    // One narration call. Any unverified entity or citation from the LLM falls back to the template, which passes
    // the guard by construction; an unverified number alone is shown struck through by the UI instead.
    const ev = evidenceSet(report);
    let narration = { mode: 'template' as LlmMode, provider: null as string | null, text: templateNarration(report) };
    try {
      const res = await chat({ messages: narrationMessages(report), signal });
      if (res.text && !guard(res.text, ev).claims.some((c) => !c.ok && c.kind !== 'number')) narration = { mode: 'live', provider: res.provider, text: res.text };
    } catch {
      // every provider failed or none is configured: keep the template
    }
    const checked = guard(narration.text, ev);
    yield { type: 'narration', ...narration };
    yield { type: 'guard', verified: checked.verified, total: checked.total, flagged: checked.flagged, claims: checked.claims.map((c) => ({ text: c.text, ok: c.ok })) };
    yield { type: 'done', ms: Math.round(performance.now() - t0) };
  } catch (err) {
    console.error(`[${runId}]`, err); // S12: details in the server log, a generic message to the client
    yield { type: 'error', message: 'Triage failed on our side.', requestId: runId };
  }
}

// One plain-text notice per owning team (synthetic team channels only).
function notices(incident: IncidentMeta, exposures: Exposure[], owners: OwnerGroup[]): Notice[] {
  return owners.map((o) => {
    const of = (t: Tier) => exposures.filter((e) => e.tier === t && o.repos.includes(e.repo)).map((e) => e.repo);
    const [lk, wp, mt] = [of('LOCKED'), of('WOULD_PULL'), of('MAINTAINER')];
    const parts = [
      lk.length ? `${lk.join(', ')} ${lk.length === 1 ? 'locks' : 'lock'} a malicious version: rotate build secrets and rebuild` : '',
      wp.length ? `${wp.join(', ')} would pull a malicious version on a fresh resolve: keep npm ci on the committed lockfile and add the pinned overrides` : '',
      mt.length ? `${mt.join(', ')} ${mt.length === 1 ? 'depends' : 'depend'} on packages from the compromised account` : '',
    ].filter(Boolean);
    return { team: o.team, channel: o.channel, text: `${o.team}: npm incident ${incident.id}. ${parts.join('. ')}. Paths and fix PRs are in Patient Zero.` };
  });
}

function printReport(r: Report) {
  const cols = [10, 26, 5, 34, 18, 12];
  const line = (xs: string[]) => console.log('  ' + xs.map((x, i) => x.padEnd(cols[i])).join(' ').trimEnd());
  const path = (repo: string) => r.paths.find((p) => p.repo === repo);
  console.log(`\n${r.incident.id} at ${T.utc(r.at)}: ${Object.entries(r.counts).map(([t, c]) => `${t} ${c}`).join(', ')}; ${r.minutesAhead} min before the first OSV record`);
  line(['TIER', 'REPO', 'DEV', 'VERSIONS', 'VIA', 'TEAM']);
  for (const e of r.exposures) {
    const p = path(e.repo);
    const via = p ? `${p.kind === 'ADMITS' ? p.range : `${p.hops} hop${p.hops === 1 ? '' : 's'}`} [${p.id}]` : e.ranges[0] ?? e.packages.slice(0, 2).join(',');
    line([e.tier, e.repo, e.dev ? 'dev' : 'prod', `${e.versions.slice(0, 2).join(' ')}${e.versions.length > 2 ? ` +${e.versions.length - 2}` : ''}`, via, e.team ?? '']);
  }
  console.log(`  scanner: ${r.scanner.length} hits; name grep: ${r.grepCount} repos`);
  for (const m of r.remediations) console.log(`  fix ${m.repo}: ${JSON.stringify(m.overrides)}`);
  console.log(`  concentration: ${r.concentration.map((c) => `${c.maintainer} ${c.influence.toFixed(4)}`).join(', ')}`);
}

if (import.meta.main) {
  const [scenario = 'qix-2025-09-08', atIso] = process.argv.slice(2);
  const at = atIso ? Date.parse(atIso) : Date.now();
  try {
    if (!Number.isFinite(at)) throw new Error('Usage: triage.ts <scenarioId> [atISO]');
    for await (const ev of triage({ graph: graph(orgGraph(scenario as ScenarioId)), scenario: scenario as ScenarioId, at })) {
      if (ev.type === 'tool_result') console.log(`  ${ev.result.tool.padEnd(24)} ${ev.result.ms.toFixed(1).padStart(6)} ms  ${ev.result.summary}`);
      else if (ev.type === 'report') printReport(ev.report);
      else if (ev.type === 'narration') console.log(`\nNarration (${ev.mode}${ev.provider ? `, ${ev.provider}` : ''}):\n${ev.text}`);
      else if (ev.type === 'guard') console.log(`\nGuard: ${ev.verified}/${ev.total} claims traced${ev.flagged.length ? `; flagged: ${ev.flagged.join(', ')}` : ''}`);
      else if (ev.type === 'error') process.exitCode = 1;
      else if (ev.type === 'done') console.log(`done in ${ev.ms} ms`);
    }
  } finally {
    await close();
  }
}
