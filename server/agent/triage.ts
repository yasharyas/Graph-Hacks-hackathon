// Deterministic, graph-driven triage playbook: each step is a registry tool, and what runs next depends on what the
// graph returned. The narration text is built from the report (narrate.ts); one LLM call picks an analyst observation
// that the guard must pass in full. CLI: node --env-file-if-exists=.env server/agent/triage.ts qix-2025-09-08 2025-09-08T13:30:00Z
import { randomUUID } from 'node:crypto';
import semver from 'semver';
import type {
  Concentration, Exposure, ExposurePath, IncidentMeta, LlmMode, LockSource, Notice, OwnerGroup, Remediation, Report, ScannerHit, ScenarioId, Tier, ToolName, ToolResult, TriageEvent,
} from '../../shared/events.ts';
import { close, graph, orgGraph } from '../graph/client.ts';
import * as T from '../tools/registry.ts';
import type { Graph } from '../tools/types.ts';
import { chat } from './llm.ts';
import { evidenceSet, observations, parsePick, pickMessages, verdictText } from './narrate.ts';
import { guardEvent } from './replay.ts';

const DAY = 86_400_000;
// Most severe first: LOCKED, WOULD_PULL prod, WOULD_PULL dev, MAINTAINER, CLEAN; then shallowest.
const rank = (e: Exposure) => ({ LOCKED: 0, WOULD_PULL: e.dev ? 2 : 1, MAINTAINER: 3, CLEAN: 4 })[e.tier];

export async function* triage({ graph: g, scenario, at, alert, session, source, today, signal }: { graph: Graph; scenario: ScenarioId; at: number; alert?: string; session?: string; source?: LockSource; today?: Today; signal?: AbortSignal }): AsyncGenerator<TriageEvent> {
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
    const head = await T.incidentHeader(g, scenario);
    if (!head) throw new Error(`Incident ${scenario} is not in graph ${g.name}`);
    const { incident } = head;
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
      const p = { maintainer: account, since: head.snapshotAt ?? at - DAY, until: at };
      yield* step('suspect_versions', p, () => T.suspectVersions(g, p));
    }

    const exp = yield* step('incident_exposure', { incident: incident.id, at }, () => T.incidentExposure(g, { incident: incident.id, at }));
    const rows = T.rowsOf<T.ExposureRow>(exp);
    if (account) {
      const blast = yield* step('maintainer_blast_radius', { maintainer: account }, () => T.maintainerBlastRadius(g, { maintainer: account }));
      for (const b of T.rowsOf<{ repo: string; sample: string[]; shallowest: number; dev: boolean }>(blast)) { // an alert may name another account
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
    const hit = exposures.filter((e) => e.tier === 'LOCKED' || e.tier === 'WOULD_PULL'); // every exposed repo: a path and a fix are cheap

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
    if (today) for (const m of remediations) applyToday(m, today);
    const concentration = T.rowsOf<Concentration>(yield* step('concentration_risk', { top: 3 }, () => T.concentrationRisk(g, { top: 3 })));
    const scan = yield* step('scanner_view', { incident: incident.id, at }, () => T.scannerView(g, { incident: incident.id, at }));

    const counts = Object.fromEntries((['LOCKED', 'WOULD_PULL', 'MAINTAINER', 'CLEAN'] as Tier[]).map((t) => [t, rows.filter((r) => r.tier === t).length])) as Record<Tier, number>;
    const guest = head.org === 'guest';
    const report: Report = {
      incident, at, counts, minutesAhead: T.minutesAhead(incident),
      scope: guest ? { kind: 'guest', label: rows[0]?.repo ?? 'pasted repo', repos: rows.length, ...(source && { source }) } : { kind: 'org', label: 'Acme demo org', repos: rows.length },
      scanner: T.rowsOf<ScannerHit>(scan.result), grepCount: scan.grepCount,
      exposures, paths, owners, remediations, notices: guest ? [] : notices(incident, exposures, owners, remediations, paths, at), concentration,
    };
    yield { type: 'report', report };

    // Session memory: every run is a Triage summary (tiers, no action), so recall_triage and the history tab have it.
    if (session) {
      const summary = `triage at ${T.utc(at)}: ${(['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as Tier[]).map((t) => `${counts[t]} ${t}`).join(', ')}`;
      await T.recordTriage(g.name, { session, incident: incident.id, at: Date.now(), summary, assessed: exposures.map((e) => ({ repo: e.repo, tier: e.tier, action: null })) })
        .catch((e) => console.error(`[${runId}] triage memory`, e)); // memory is a nicety: never fail the run for it
    }

    // The text is deterministic. The LLM picks the one observation (also built from the report) most worth acting on;
    // it never writes the words, so the note is as true as the text.
    const ev = evidenceSet(report);
    const text = verdictText(report);
    const obs = observations(report);
    let narration = { mode: 'template' as LlmMode, provider: null as string | null, note: null as string | null };
    if (obs.length >= 2) {
      yield { type: 'narration', ...narration, text, at, draft: true }; // the verdict shows while the model picks
      try {
        const res = await chat({ messages: pickMessages(report, obs), maxTokens: 1500, signal }); // reasoning models (gpt-oss) think before the id
        const pick = parsePick(res.text, obs);
        if (pick) narration = { mode: 'live', provider: res.provider, note: pick.text };
      } catch {
        // every provider failed or none is configured: no pick
      }
    }
    yield { type: 'narration', ...narration, text, at };
    yield guardEvent(narration.note ? `${text}\n${narration.note}` : text, ev);
    yield { type: 'done', ms: Math.round(performance.now() - t0) };
  } catch (err) {
    console.error(`[${runId}]`, err); // S12: details in the server log, a generic message to the client
    yield { type: 'error', message: 'Triage failed on our side.', requestId: runId };
  }
}

// versions: the clean releases of each affected package known today (the committed npm cache), to tell what a fresh
// resolve gets now.
export type Today = { deps: Record<string, string>; dev: Record<string, string>; versions?: Record<string, string[]> };
const LOOSE = { loose: true };
const MATCH = "Checked against today's package.json: its direct dependencies still match this fix.";
// A fix drafted from a pre-incident snapshot, read against today's package.json: an override that today's declared range no
// longer needs, or that would hold a package below what a fresh resolve gets today (the malicious versions are gone), only
// moves it backwards; a pin for a package no longer declared would add it. `skip`: the packages whose override and pin to
// leave out (unless replaying the window).
export function todayNotes(m: Remediation, today: Today): { notes: string[]; skip: string[] } {
  const declared = (n: string) => today.deps[n] ?? today.dev[n];
  const notes: string[] = [];
  const skip: string[] = [];
  for (const [key, pin] of Object.entries(m.overrides)) {
    const at = key.lastIndexOf('@');
    const [name, bad] = at > 0 ? [key.slice(0, at), key.slice(at + 1)] : [key, ''];
    const range = declared(name);
    const valid = range !== undefined && semver.validRange(range, LOOSE) !== null;
    if (valid && bad && !semver.satisfies(bad, range, LOOSE)) {
      notes.push(`Today's package.json declares ${name} ${range}, which no longer admits ${bad}: skip the ${key} override (it would hold ${name} at ${pin}).`);
      skip.push(name);
      continue;
    }
    // what a fresh resolve gets today: under today's declared range, or (a dependency's range) the newest release on the pin's major
    const now = semver.maxSatisfying(today.versions?.[name] ?? [], valid ? range : `^${pin}`, LOOSE);
    if (!now || !semver.gt(now, pin, LOOSE)) continue;
    const exact = Object.hasOwn({ ...m.direct, ...m.devDirect }, name);
    notes.push(valid
      ? `Today's package.json declares ${name} ${range}, which resolves ${now} today; the ${key} override${exact ? ` and the exact ${name} ${pin} pin` : ''} would downgrade it to ${pin}: skip the ${key} override${exact ? ' and its pin' : ''} unless you are replaying the window.`
      : `${key} is gone from npm, so ranges that admitted it now resolve ${name} ${now}; the ${key} override would hold them at ${pin}: skip the ${key} override unless you are replaying the window.`);
    skip.push(name);
  }
  for (const [name, block, other] of [...Object.keys(m.direct ?? {}).map((n) => [n, 'dependencies', 'devDependencies'] as const), ...Object.keys(m.devDirect ?? {}).map((n) => [n, 'devDependencies', 'dependencies'] as const)]) {
    const here = block === 'dependencies' ? today.deps : today.dev;
    if (name in here) continue;
    const moved = (block === 'dependencies' ? today.dev : today.deps)[name] !== undefined;
    notes.push(moved ? `Today's package.json declares ${name} in ${other}, not ${block}: move its pin there.` : `Today's package.json no longer declares ${name}: skip its pin.`);
    if (!moved) skip.push(name);
  }
  return { notes: notes.length ? notes : [MATCH], skip };
}

// The notes go on the fix itself: the Fix tab shows them, the PR description carries them, and no step or PR line still says
// to set a pin they say to skip.
function applyToday(m: Remediation, today: Today) {
  const { notes, skip } = todayNotes(m, today);
  m.today = notes;
  m.steps = m.steps.filter((s) => !skip.some((n) => s.startsWith(`If you add the ${n} override,`)));
  const all = { ...m.direct, ...m.devDirect };
  const kept = Object.fromEntries(Object.entries(all).filter(([n]) => !skip.includes(n)));
  m.prBody = `${m.prBody.replace(T.directNote(all), T.directNote(kept))} Checked against today's package.json: ${notes.map((n) => n.replace(/^Checked against today's package\.json: /, '')).join(' ')}`;
}

// As of the scenario clock, like the verdict and the per-repo notice: the clock, the window then, and the same Do order
// (LOCKED: rotate, fix the lockfile, then rebuild from it; WOULD_PULL: npm ci, the override only for a re-resolve).
function notices(incident: IncidentMeta, exposures: Exposure[], owners: OwnerGroup[], remediations: Remediation[], paths: ExposurePath[], at: number): Notice[] {
  const hm = (t: number) => `${new Date(t).toISOString().slice(11, 16)} UTC`;
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const from = incident.firstExposureAt ?? incident.firstPublishAt;
  const closed = at >= incident.removedAt;
  const window = closed ? `Window: malicious versions were live from ${hm(from)} on ${day(from)} until npm removed them around ${hm(incident.removedAt)}.`
    : at < from ? `Window: no malicious version was live yet at ${hm(at)} on ${day(at)}.`
      : `Window: malicious versions live since ${hm(from)} on ${day(from)} (still live at ${hm(at)}).`;
  // The overrides, plus the root dependencies npm needs set to the same version (EOVERRIDE otherwise).
  const fix = (repo: string) => {
    const m = remediations.find((x) => x.repo === repo);
    const pins = Object.entries(m?.overrides ?? {}).map(([k, v]) => `${k} -> ${v}`).join(', ');
    const roots = [...Object.entries(m?.direct ?? {}).map(([n, v]) => `${n} to ${v} in dependencies`), ...Object.entries(m?.devDirect ?? {}).map(([n, v]) => `${n} to ${v} in devDependencies`)];
    return pins && roots.length ? `${pins}, and set ${roots.join(', ')} (npm rejects an override that conflicts with a direct dependency)` : pins;
  };
  const line = (e: Exposure) => {
    const pins = fix(e.repo);
    const p = paths.find((x) => x.repo === e.repo && x.kind === 'ADMITS' && x.range); // its own range, paired with the version it admits
    if (e.remediated && e.tier !== 'MAINTAINER') return `- ${e.repo}: ${e.tier}, marked remediated.`;
    if (e.tier === 'LOCKED') return `- ${e.repo}: LOCKED, its lockfile pins ${e.versions.join(', ')}. Rotate build secrets, then ${closed ? 're-resolve to a clean release (npm no longer serves the locked version)' : pins ? `fix the lockfile (override ${pins}, then regenerate it)` : 'remove the malicious versions and regenerate the lockfile'}, then rebuild and redeploy from the fixed lockfile.`;
    // (a WOULD_PULL repo is only exposed while the window is open)
    if (e.tier === 'WOULD_PULL') return `- ${e.repo}${e.dev ? ' (dev-only)' : ''}: WOULD_PULL, a fresh resolve would fetch ${e.versions.slice(0, 3).join(', ')}${e.versions.length > 3 ? ` +${e.versions.length - 3} more` : ''}${p ? ` (${p.version} via ${p.range})` : ''}. Keep npm ci on the committed lockfile${pins ? `; only if you must re-resolve, override ${pins}` : ''}.`;
    return `- ${e.repo}: depends on packages from the compromised account; no malicious version is live for it.`;
  };
  return owners.map((o) => {
    const mine = exposures.filter((e) => e.tier !== 'CLEAN' && o.repos.includes(e.repo));
    return { team: o.team, channel: o.channel, text: `${o.team}: npm incident ${incident.id}, as of ${hm(at)} on ${day(at)}.\n${window}\n${mine.map(line).join('\n')}\nPaths and fix PRs are in Patient Zero.` };
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
  console.log(`  scanner: ${T.plural(r.scanner.length, 'hit')}; name grep: ${T.plural(r.grepCount, 'repo')}`);
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
      else if (ev.type === 'narration') console.log(`\nNarration:\n${ev.text}\nNote (${ev.mode}${ev.provider ? `, ${ev.provider}` : ''}): ${ev.note ?? 'none'}`);
      else if (ev.type === 'guard') console.log(`\nGuard: ${ev.verified}/${ev.total} claims traced${ev.flagged.length ? `; flagged: ${ev.flagged.join(', ')}` : ''}`);
      else if (ev.type === 'error') process.exitCode = 1;
      else if (ev.type === 'done') console.log(`done in ${ev.ms} ms`);
    }
  } finally {
    await close();
  }
}
