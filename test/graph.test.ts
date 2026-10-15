// Integration: builds the real data into throwaway pz_test_<pid>_* graphs on a live FalkorDB and checks the tools,
// including a differential test against the graph-free oracle. Skipped cleanly when FalkorDB is unreachable.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { exposures } from '../scripts/exposure-oracle.ts';
import { triage } from '../server/agent/triage.ts';
import { close, db, graph, orgGraph, registryGraph } from '../server/graph/client.ts';
import { build } from '../server/ingest/build.ts';
import * as T from '../server/tools/registry.ts';
import type { ScenarioId, TriageEvent } from '../shared/events.ts';
import type { Graph } from '../server/tools/types.ts';

const host = process.env.FALKOR_HOST || '127.0.0.1';
const port = Number(process.env.FALKOR_PORT || 6380);
const up = await new Promise<boolean>((res) => {
  const s = connect(port, host, () => (s.destroy(), res(true)));
  s.setTimeout(1000, () => (s.destroy(), res(false)));
  s.on('error', () => res(false));
});

const prefix = `pz_test_${process.pid}`;
const QIX = graph(orgGraph('qix-2025-09-08', prefix));
const AX = graph(orgGraph('axios-2026-03-31', prefix));
const QAT = Date.parse('2025-09-08T13:30:00Z');
const AAT = Date.parse('2026-03-31T01:30:00Z');
const exposure = async (g: Graph, incident: ScenarioId, at: number) => T.rowsOf<T.ExposureRow>(await T.incidentExposure(g, { incident, at }));
const best = async (g: Graph, repo: string, version: string, at: number) => T.rowsOf<T.PathRow>(await T.explainPath(g, { repo, version, at }))[0];

describe('graph', { skip: !up && `FalkorDB unreachable at ${host}:${port}` }, () => {
  before(() => {
    process.env.LLM_CHAIN = 'replay'; // no LLM calls from tests
    return build(prefix);
  }, { timeout: 180_000 });
  after(async () => {
    for (const g of [registryGraph(prefix), QIX.name, AX.name]) await (await db()).selectGraph(g).delete().catch(() => {});
    await close();
  });

  test('suspect_versions(qix, 13:00Z, 14:30Z) is exactly the 19 incident versions', async () => {
    const r = await T.suspectVersions(QIX, { maintainer: 'qix', since: '2025-09-08T13:00:00Z', until: '2025-09-08T14:30:00Z' });
    const inc = JSON.parse(readFileSync('data/incidents/qix-2025-09-08.json', 'utf8'));
    assert.deepEqual(r.rows.map((x) => x.version).sort(), inc.versions.map((v: { id: string }) => v.id).sort());
    assert.equal(r.rows.length, 19);
  });

  for (const [scenario, g, at] of [['qix-2025-09-08', QIX, QAT], ['axios-2026-03-31', AX, AAT]] as const) {
    test(`incident_exposure matches the graph-free oracle: ${scenario} at ${new Date(at).toISOString()}`, async () => {
      const rows = (await exposure(g, scenario, at)).filter((e) => !e.synthetic);
      const oracle = exposures(scenario, at);
      const pairs = rows.flatMap((e) => e.versions.map((v) => `${e.repo} ${v}`)).sort();
      assert.deepEqual(pairs, [...new Set(oracle.map((o) => `${o.repo} ${o.version}`))].sort());
      assert.ok(pairs.length > 0);
      for (const e of rows.filter((x) => x.tier !== 'CLEAN')) // dev badge: every hit dev-only
        assert.equal(e.dev, oracle.filter((o) => o.repo === e.repo).every((o) => o.dev), `${e.repo} dev flag`);
    });
  }

  test('mocha would pull debug@4.4.2 through its own ^4.3.5 (0 hops)', async () => {
    const mocha = (await exposure(QIX, 'qix-2025-09-08', QAT)).find((e) => e.repo === 'mochajs/mocha')!;
    assert.equal(mocha.tier, 'WOULD_PULL');
    assert.ok(mocha.ranges.includes('^4.3.5'));
    assert.deepEqual(await best(QIX, 'mochajs/mocha', 'debug@4.4.2', QAT), {
      repo: 'mochajs/mocha', version: 'debug@4.4.2', kind: 'ADMITS', range: '^4.3.5', hops: 0, depth: 0, chain: ['mochajs/mocha'], lockPaths: [''],
    });
  });

  test('uptime-kuma would pull axios@0.30.4 through its own ~0.30.3, in production', async () => {
    const kuma = (await exposure(AX, 'axios-2026-03-31', AAT)).find((e) => e.repo === 'louislam/uptime-kuma')!;
    assert.equal(kuma.tier, 'WOULD_PULL');
    assert.equal(kuma.dev, false);
    const p = await best(AX, 'louislam/uptime-kuma', 'axios@0.30.4', AAT);
    assert.deepEqual([p.kind, p.range, p.hops], ['ADMITS', '~0.30.3', 0]);
  });

  test('synthetic acme/checkout-web is LOCKED on debug@4.4.2 and chalk@5.6.1; the fix overrides exactly those versions', async () => {
    const web = (await exposure(QIX, 'qix-2025-09-08', QAT)).find((e) => e.repo === 'acme/checkout-web')!;
    assert.equal(web.tier, 'LOCKED');
    assert.deepEqual([...web.versions].sort(), ['chalk@5.6.1', 'debug@4.4.2']);
    assert.deepEqual(web.locked, ['chalk@5.6.1', 'debug@4.4.2']);
    const [fix] = T.rowsOf<{ overrides: Record<string, string>; steps: string[] }>(await T.draftRemediation(QIX, { repo: 'acme/checkout-web', versions: web.versions, at: QAT }));
    // version-qualified keys: a blanket "chalk": "5.6.0" forced ESM chalk 5 onto log-symbols' ^4 and crashed mocha
    assert.deepEqual(fix.overrides, { 'debug@4.4.2': '4.4.1', 'chalk@5.6.1': '5.6.0' });
    assert.match(fix.steps[0], /^Your lockfile pins (debug@4\.4\.2, chalk@5\.6\.1|chalk@5\.6\.1, debug@4\.4\.2), which are malicious: add the overrides/);
    assert.deepEqual(fix.steps.slice(-2).map((s) => s.split(' ')[0]), ['Rotate', 'Rebuild']);
  });

  test('a WOULD_PULL fix starts from what the lockfile pins: npm ci first, overrides only to re-resolve', async () => {
    const cli = (await exposure(QIX, 'qix-2025-09-08', QAT)).find((e) => e.repo === 'npm/cli')!;
    assert.equal(cli.tier, 'WOULD_PULL');
    assert.ok(cli.locked!.includes('chalk@5.4.1') && cli.locked!.includes('supports-color@10.0.0'), cli.locked!.join());
    assert.ok(!cli.locked!.some((v) => cli.versions.includes(v)), 'a WOULD_PULL lockfile pins no malicious version');
    const [fix] = T.rowsOf<{ overrides: Record<string, string>; steps: string[] }>(await T.draftRemediation(QIX, { repo: 'npm/cli', versions: cli.versions, at: QAT }));
    assert.match(fix.steps[0], /^Keep installing from your committed lockfile \(npm ci\): it pins .*chalk@5\.4\.1.* \(safe\)$/);
    assert.match(fix.steps[1], /^Only if you must re-resolve dependencies while the malicious versions are live, add the overrides "chalk@5\.6\.1": "5\.6\.0"/);
    assert.ok(Object.keys(fix.overrides).every((k) => cli.versions.includes(k)));
    assert.ok(!fix.steps.some((s) => /rotate/i.test(s)));
  });

  test('firstExposureAt per graph: qix 13:12:10 (74 min ahead), axios 00:21:58 (105 min); a locked repo is not exposed before its lockfile could exist', async () => {
    const q = (await T.incidentHeader(QIX, 'qix-2025-09-08'))!;
    const a = (await T.incidentHeader(AX, 'axios-2026-03-31'))!;
    assert.deepEqual([q.incident.firstExposureAt, T.minutesAhead(q.incident), q.org], [Date.parse('2025-09-08T13:12:10.343Z'), 74, 'acme']);
    assert.deepEqual([a.incident.firstExposureAt, T.minutesAhead(a.incident)], [Date.parse('2026-03-31T00:21:58.168Z'), 105]);
    // acme/billing-api locks axios@1.14.1 (00:21:58) and plain-crypto-js@4.2.1 (23:59:12): it can't be exposed at 00:00
    const billing = async (at: number) => (await exposure(AX, 'axios-2026-03-31', at)).find((e) => e.repo === 'acme/billing-api')!.tier;
    assert.notEqual(await billing(Date.parse('2026-03-31T00:00:00Z')), 'LOCKED');
    assert.notEqual(await billing(Date.parse('2026-03-31T00:00:00Z')), 'WOULD_PULL');
    assert.equal(await billing(Date.parse('2026-03-31T00:22:00Z')), 'LOCKED');
    assert.equal((await exposure(AX, 'axios-2026-03-31', a.incident.firstExposureAt! - 1)).filter((e) => e.tier === 'LOCKED' || e.tier === 'WOULD_PULL').length, 0);
  });

  test('filter_exposures returns the complete matching list: prod-only at 13:30 is 14 repos across 6 teams', async () => {
    const r = await T.filterExposures(QIX, { incident: 'qix-2025-09-08', at: QAT, prod_only: true });
    assert.equal(r.rows.length, 14);
    assert.equal(new Set(r.rows.map((x) => x.team)).size, 6);
    assert.match(r.summary, /^14 of 21 exposed repos match \(prod only\) across 6 teams: /);
    assert.deepEqual((await T.filterExposures(QIX, { incident: 'qix-2025-09-08', at: QAT, team: 'qa' })).rows.map((x) => x.repo).sort(), ['mochajs/mocha', 'nightwatchjs/nightwatch', 'puppeteer/puppeteer', 'remy/nodemon']);
    assert.deepEqual((await T.filterExposures(QIX, { incident: 'qix-2025-09-08', at: QAT, repo: 'insomnia' })).rows.map((x) => x.repo), ['Kong/insomnia']);
    assert.deepEqual((await T.filterExposures(QIX, { incident: 'qix-2025-09-08', at: QAT, tier: 'locked' })).rows.map((x) => x.repo), ['acme/checkout-web']);
  });

  test('scanner_view sees nothing before MAL-2025-46974 is published at 14:26:51Z', async () => {
    const before = await T.scannerView(QIX, { incident: 'qix-2025-09-08', at: Date.parse('2025-09-08T14:26:51Z') - 1 });
    assert.equal(before.result.rows.length, 0);
    assert.ok(before.grepCount > 0);
    const at = await T.scannerView(QIX, { incident: 'qix-2025-09-08', at: '2025-09-08T14:26:51Z' });
    assert.ok(at.result.rows.some((r) => r.repo === 'acme/checkout-web' && r.advisory === 'MAL-2025-46974'));
  });

  test('every explain_path chain is a shortest lockfile path: hops = target Dep.depth', async () => {
    let n = 0;
    for (const [scenario, g, at] of [['qix-2025-09-08', QIX, QAT], ['axios-2026-03-31', AX, AAT]] as const)
      for (const e of await exposure(g, scenario, at))
        for (const v of e.versions)
          for (const p of T.rowsOf<T.PathRow>(await T.explainPath(g, { repo: e.repo, version: v, at }))) {
            assert.equal(p.hops, p.depth, `${e.repo} ${v} ${p.kind}`);
            assert.equal(p.chain.length, p.hops + 1);
            if (p.kind === 'RESOLVES_TO') n++;
          }
    assert.ok(n >= 4, `only ${n} RESOLVES_TO paths`); // checkout-web x2, billing-api x2
  });

  test('explain_path and draft_remediation are memoized on demo org graphs only; a hit is the same result, marked cached', async () => {
    const at = Date.parse('2025-09-08T13:31:00Z'); // a clock no other test uses, so the first call is a miss
    const args = { repo: 'mochajs/mocha', version: 'debug@4.4.2', at };
    const a = await T.explainPath(QIX, args);
    const b = await T.explainPath(QIX, args);
    assert.equal(a.cached, undefined);
    assert.equal(b.cached, true);
    assert.deepEqual({ ...b, cached: undefined }, { ...a, cached: undefined });
    const fix = { repo: 'mochajs/mocha', versions: ['debug@4.4.2'], at };
    assert.equal((await T.draftRemediation(QIX, fix)).cached, undefined);
    assert.equal((await T.draftRemediation(QIX, fix)).cached, true);
    const guest: Graph = { ...QIX, name: QIX.name.replace('_acme_', '_guest_') }; // same data, guest-style name: never memoized
    for (let i = 0; i < 2; i++) assert.equal((await T.explainPath(guest, args)).cached, undefined);
  });

  test('scenario graphs are isolated: neither returns the other scenario\'s repos or snapshots', async () => {
    const manifest = JSON.parse(readFileSync('data/cache/lockfiles/manifest.json', 'utf8'));
    const q = (await exposure(QIX, 'qix-2025-09-08', QAT)).map((e) => e.repo);
    const a = (await exposure(AX, 'axios-2026-03-31', AAT)).map((e) => e.repo);
    assert.ok(q.includes('acme/checkout-web') && !q.includes('acme/billing-api'));
    assert.ok(a.includes('acme/billing-api') && !a.includes('acme/checkout-web'));
    assert.equal(await best(QIX, 'acme/billing-api', 'axios@1.14.1', AAT), undefined);
    assert.equal(await best(QIX, "acme/checkout-web'}) MATCH (n) DETACH DELETE n //", 'debug@4.4.2', QAT), undefined); // S3: data, not Cypher
    for (const [g, s] of [[QIX, 'qix-2025-09-08'], [AX, 'axios-2026-03-31']] as const)
      for (const r of (await g.ro('MATCH (r:Repo {synthetic: false}) RETURN r.id AS id, r.sha AS sha')).rows)
        assert.equal(r.sha, manifest[s][r.id as string].sha, `${g.name} ${r.id}`);
  });

  test('no Maintainer name contains "@" (S11: usernames only)', async () => {
    for (const g of [graph(registryGraph(prefix)), QIX, AX]) {
      const [{ total, emails }] = (await g.ro("MATCH (m:Maintainer) RETURN count(m) AS total, sum(CASE WHEN m.name CONTAINS '@' THEN 1 ELSE 0 END) AS emails")).rows;
      assert.ok((total as number) > 0);
      assert.equal(emails, 0, g.name);
    }
  });

  test('triage memory is scoped to the session (S10)', async () => {
    await T.recordTriage(QIX.name, { session: 'session-a', incident: 'qix-2025-09-08', at: QAT, summary: 'test', assessed: [{ repo: 'mochajs/mocha', tier: 'WOULD_PULL', action: 'remediated' }] });
    assert.deepEqual((await T.recallTriage(QIX, { session: 'session-a', incident: 'qix-2025-09-08' })).rows.map((r) => [r.repo, r.action]), [['mochajs/mocha', 'remediated']]);
    assert.equal((await T.recallTriage(QIX, { session: 'session-b', incident: 'qix-2025-09-08' })).rows.length, 0);
    const evs: TriageEvent[] = [];
    for await (const e of triage({ graph: QIX, scenario: 'qix-2025-09-08', at: QAT, session: 'session-a' })) evs.push(e);
    const report = evs.find((e) => e.type === 'report')!.report;
    assert.equal(report.exposures.find((e) => e.repo === 'mochajs/mocha')!.remediated?.action, 'remediated');
  });

  test('triage() without an LLM: start, tools in playbook order, report, template narration, clean guard, done', async () => {
    const evs: TriageEvent[] = [];
    for await (const e of triage({ graph: QIX, scenario: 'qix-2025-09-08', at: QAT })) evs.push(e);
    assert.equal(evs[0].type, 'start');
    assert.deepEqual(evs.slice(-4).map((e) => e.type), ['report', 'narration', 'guard', 'done']);
    const tools = evs.slice(1, -4);
    assert.ok(tools.every((e, i) => e.type === (i % 2 ? 'tool_result' : 'tool_start')), tools.map((e) => e.type).join(','));
    assert.deepEqual([...new Set(tools.flatMap((e) => (e.type === 'tool_start' ? [e.tool] : [])))],
      ['suspect_versions', 'incident_exposure', 'maintainer_blast_radius', 'explain_path', 'route_owners', 'draft_remediation', 'concentration_risk', 'scanner_view']);
    const ev = <K extends TriageEvent['type']>(k: K) => evs.find((e) => e.type === k) as Extract<TriageEvent, { type: K }>;
    assert.equal(ev('narration').mode, 'template');
    assert.deepEqual(ev('guard').flagged, []);
    assert.ok(ev('guard').total > 5);
    const r = ev('report').report;
    assert.deepEqual([r.counts.LOCKED, r.counts.WOULD_PULL, r.minutesAhead], [1, 20, 74]);
    assert.deepEqual([r.paths[0].id, r.paths[0].repo, r.paths[0].kind], ['E1', 'acme/checkout-web', 'RESOLVES_TO']);
    assert.deepEqual([r.paths.length, r.remediations.length, r.paths.at(-1)!.id], [21, 21, 'E21']); // every exposed repo, not a top 5
    assert.equal(r.scanner.length, 0);
    assert.equal(ev('narration').note, null);
    assert.equal(ev('narration').at, QAT);

    const ax: TriageEvent[] = [];
    for await (const e of triage({ graph: AX, scenario: 'axios-2026-03-31', at: AAT })) ax.push(e);
    const ar = (ax.find((e) => e.type === 'report') as Extract<TriageEvent, { type: 'report' }>).report;
    // axios@1.14.1 at 00:21:58.168Z -> first OSV record (MAL-2026-2306) at 02:07:58Z: 105 min 59.8 s, floored like qix's 74
    assert.deepEqual([ar.counts.LOCKED, ar.counts.WOULD_PULL, ar.minutesAhead], [1, 9, 105]);
  });
});
