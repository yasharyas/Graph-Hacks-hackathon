// Run: node --test web/src/data/export.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from '../../../shared/fixtures/triage-qix.json' with { type: 'json' };
import { detailsLink, DIRECT_NOTE, fixJson, pinTargets, publishedBy, reportToMarkdown, slackMessage } from './export.ts';
import type { Exposure, Remediation, Report } from './types.ts';

const report = fixture.events.find((e) => e.type === 'report')!.report as unknown as Report;

test('markdown carries the live report: clock, counts, every exposure, every notice and fix', () => {
  const md = reportToMarkdown(report);
  assert.ok(md.startsWith(`# ${report.incident.id}: `));
  assert.ok(md.includes(`LOCKED ${report.counts.LOCKED} · WOULD_PULL ${report.counts.WOULD_PULL} · MAINTAINER ${report.counts.MAINTAINER}`));
  for (const e of report.exposures) assert.ok(md.includes(`\`${e.repo}\` ${e.tier}, ${e.dev ? 'dev only' : 'prod'}`), e.repo);
  for (const n of report.notices) assert.ok(md.includes(n.text), n.team);
  for (const f of report.remediations) assert.ok(md.includes(fixJson(f)), f.repo);
  assert.ok(md.includes('Lockfile-pinned `npm ci` builds were safe.'));
});

test('the title counts versions published by the clock, not the whole incident', () => {
  const total = report.incident.versions.length;
  const early = Math.min(...report.incident.versions.map((v) => v.publishedAt)) + 1;
  const n = publishedBy(report.incident, early);
  assert.ok(n >= 1 && n < total, `fixture needs versions published after its first one (${n} of ${total})`);
  const md = reportToMarkdown({ ...report, at: early });
  assert.ok(md.startsWith(`# ${report.incident.id}: ${n} malicious version`), md.split('\n')[0]);
  assert.ok(md.includes(`The incident lists ${total} in total`));
  assert.ok(!md.split('\n')[0]!.includes(String(total)) || n === total);
  const all = reportToMarkdown(report).split('\n')[0]!;
  assert.ok(all.includes(`${publishedBy(report.incident, report.at)} malicious version`));
});

test('every exposure line says prod or dev, names the versions reached, and the paths show package@version', () => {
  const e = { ...report.exposures[0]!, dev: false, versions: ['debug@4.4.2'], locked: ['chalk@5.4.1'] } as Exposure;
  const dev = { ...report.exposures[1]!, dev: true };
  const md = reportToMarkdown({ ...report, exposures: [e, dev] });
  assert.ok(md.includes(`\`${e.repo}\` ${e.tier}, prod`));
  assert.ok(md.includes(`\`${dev.repo}\` ${dev.tier}, dev only`));
  assert.ok(md.includes('bad versions reached: `debug@4.4.2`'));
  assert.ok(md.includes('lockfile pins: `chalk@5.4.1`'));
  const p = report.paths.find((x) => x.repo === e.repo);
  if (p) assert.ok(md.includes(p.chain.map((c) => `\`${c}\``).join(' → ')));
});

test('a remediation mark shows on its line', () => {
  const e = report.exposures[0]!;
  const md = reportToMarkdown({ ...report, exposures: [{ ...e, remediated: { at: Date.UTC(2025, 8, 8, 14, 2), action: 'remediated' } }] });
  assert.ok(md.includes('remediated 14:02'));
});

test('hostile repo and package names cannot inject Markdown', () => {
  const evil = 'evil`\n# Injected heading\n![x](http://x)';
  const md = reportToMarkdown({ ...report, exposures: [{ ...report.exposures[0]!, repo: evil, team: evil, versions: [evil], locked: [evil] } as Exposure], paths: [] });
  assert.ok(!/^# Injected/m.test(md));
  assert.ok(md.includes("`evil' # Injected heading ![x](http://x)`"));
  const slack = slackMessage({ exposure: { ...report.exposures[0]!, repo: evil, team: evil }, paths: [], incident: report.incident, link: 'http://x' });
  assert.ok(!/^# Injected/m.test(slack) && slack.split('\n').every((l) => !l.startsWith('![')));
});

test('pin targets read the version from the override, qualified or not', () => {
  assert.deepEqual(pinTargets({ 'debug@4.4.2': '4.4.1', chalk: '5.6.0', '@scope/pkg@1.0.0': '0.9.0' }), ['debug@4.4.1', 'chalk@5.6.0', '@scope/pkg@0.9.0']);
});

test('the Slack message is complete on its own: repo, tier in words, prod/dev, path, pin target, window start, link', () => {
  const e = report.exposures.find((x) => x.tier === 'LOCKED') ?? report.exposures[0]!;
  const path = report.paths.find((p) => p.repo === e.repo);
  const fix = report.remediations.find((f) => f.repo === e.repo) ?? { repo: e.repo, overrides: { 'debug@4.4.2': '4.4.1' }, steps: [], prBody: '' };
  const msg = slackMessage({ exposure: { ...e, dev: false, locked: [e.versions[0] ?? 'debug@4.4.2'] } as Exposure, paths: path ? [path] : [], fix, incident: report.incident, link: 'https://pz.example/?repo=x' });
  assert.ok(msg.includes(e.repo));
  assert.match(msg, /locks a malicious version|would pull a malicious version|depends on the compromised/);
  assert.ok(msg.includes('prod dependency'));
  assert.ok(msg.includes(`Tier: ${e.tier}`));
  if (path) assert.ok(msg.includes(`Path: ${path.chain.map((c) => `\`${c}\``).join(' > ')}`));
  assert.ok(msg.includes('Pin to: `' + pinTargets(fix.overrides)[0] + '`'));
  assert.match(msg, /live since \d\d:\d\d UTC/);
  assert.ok(msg.endsWith('Details: https://pz.example/?repo=x'));
  assert.ok(msg.includes('(malicious)'), 'a locked bad version is called out');
  assert.ok(slackMessage({ exposure: { ...e, locked: ['chalk@5.4.1'] } as Exposure, paths: [], incident: report.incident, link: 'x' }).includes('`chalk@5.4.1` (safe)'));
});

const mocha: Remediation = { repo: 'mochajs/mocha', overrides: { 'debug@4.4.2': '4.4.1' }, direct: { debug: '4.4.1' }, steps: [], prBody: '' };

test('the fix snippet carries the direct pins next to the overrides, so it works when pasted alone', () => {
  assert.deepEqual(JSON.parse(fixJson(mocha)), { dependencies: { debug: '4.4.1' }, overrides: { 'debug@4.4.2': '4.4.1' } });
  assert.deepEqual(JSON.parse(fixJson({ ...mocha, direct: undefined })), { overrides: { 'debug@4.4.2': '4.4.1' } }, 'no direct pins: overrides only');
  assert.deepEqual(JSON.parse(fixJson({ ...mocha, direct: {} })), { overrides: { 'debug@4.4.2': '4.4.1' } });
});

test('the Markdown export and the Slack message include the direct pins', () => {
  const e = report.exposures.find((x) => x.tier === 'WOULD_PULL') ?? report.exposures[0]!;
  const md = reportToMarkdown({ ...report, remediations: [mocha] });
  assert.ok(md.includes(fixJson(mocha)) && md.includes('"dependencies"'));
  assert.ok(md.includes(DIRECT_NOTE));
  const msg = slackMessage({ exposure: e, paths: [], fix: mocha, incident: report.incident, link: null });
  assert.ok(msg.includes('Pin to: `debug@4.4.1`'));
  assert.match(msg, /Also set in package\.json, under dependencies or devDependencies.*`debug@4\.4\.1`/);
  assert.ok(!slackMessage({ exposure: e, paths: [], fix: { ...mocha, direct: undefined }, incident: report.incident, link: null }).includes('Also set in package.json'));
});

test('the Details link is a shareUrl for the repo (org) or the pasted repo (guest); a dropped lockfile has none', () => {
  const base = 'http://localhost:5173/?mock=1#x';
  const u = new URL(detailsLink(base, report, 'acme/checkout-web', 'notice')!);
  assert.equal(u.searchParams.get('scenario'), report.incident.id);
  assert.equal(u.searchParams.get('repo'), 'acme/checkout-web');
  assert.equal(u.searchParams.get('open'), 'notice');
  assert.equal(u.searchParams.get('at'), String(Math.floor(report.at / 60_000) * 60_000));
  assert.equal(u.searchParams.get('mock'), '1', 'keeps the base query');
  const guest = { ...report, scope: { kind: 'guest' as const, label: 'mochajs/mocha@HEAD', repos: 1 } };
  const g = new URL(detailsLink(base, guest, 'mochajs/mocha@HEAD', 'fix')!);
  assert.equal(g.searchParams.get('guest'), 'mochajs/mocha', '@HEAD is not part of the repo name');
  assert.equal(g.searchParams.get('repo'), null);
  assert.equal(g.searchParams.get('open'), 'fix');
  assert.equal(detailsLink(base, guest, 'pasted/lockfile', 'notice'), null);
  assert.equal(detailsLink(base, report, 'not a repo', 'notice'), null, 'a name shareUrl refuses has no link');
  assert.ok(!slackMessage({ exposure: report.exposures[0]!, paths: [], incident: report.incident, link: null }).includes('Details:'));
});
