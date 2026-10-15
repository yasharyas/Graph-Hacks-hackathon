// Run: node --test web/src/data/reportView.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from '../../../shared/fixtures/triage-qix.json' with { type: 'json' };
import { reportToMarkdown } from './export.ts';
import { scopeReport, viewLabel } from './reportView.ts';
import type { Report } from './types.ts';

const report = fixture.events.find((e) => e.type === 'report')!.report as unknown as Report;

test('the filter is worded the way the table shows it', () => {
  assert.equal(viewLabel({ prodOnly: true, tier: 'ALL', query: '', shown: 14, total: 21 }), 'prod only, 14 of 21 repos');
  assert.equal(viewLabel({ prodOnly: false, tier: 'LOCKED', query: '  kong  ', shown: 1, total: 21 }), 'tier LOCKED, search "kong", 1 of 21 repos');
  assert.equal(viewLabel({ prodOnly: true, tier: 'WOULD_PULL', query: 'a'.repeat(80), shown: 0, total: 1 }), `prod only, tier WOULD_PULL, search "${'a'.repeat(40)}", 0 of 1 repo`);
});

test('a view keeps its repos in its order, in every repo-keyed list, and recounts the tiers', () => {
  const repos = report.exposures.map((e) => e.repo).slice(0, 5).reverse();
  const s = scopeReport(report, { repos, label: 'five' });
  assert.deepEqual(s.exposures.map((e) => e.repo), repos, 'the table order, not the report order');
  const set = new Set(repos);
  assert.ok(s.paths.every((p) => set.has(p.repo)) && s.remediations.every((f) => set.has(f.repo)) && s.scanner.every((h) => set.has(h.repo)));
  assert.ok(s.owners.every((o) => o.repos.length > 0 && o.repos.every((x) => set.has(x))));
  assert.equal(s.counts.LOCKED + s.counts.WOULD_PULL + s.counts.MAINTAINER, repos.length);
  assert.equal(s.counts.CLEAN, 0);
  assert.deepEqual(s.view, { label: 'five', repos, total: report.exposures.length, outside: 0 });
  assert.equal(s.incident, report.incident, 'the incident and the clock describe the whole run');
});

test('a repo the run does not list is counted as outside, not invented', () => {
  const s = scopeReport(report, { repos: [report.exposures[0]!.repo, 'nobody/nothing'], label: 'x' });
  assert.equal(s.exposures.length, 1);
  assert.equal(s.view.outside, 1);
  assert.deepEqual(s.view.repos, [report.exposures[0]!.repo]);
});

test('team notices keep their header, footer and only the lines of repos in the view', () => {
  const text = 'Web: npm incident qix.\n- a/one: LOCKED, pins x.\n- b/two (dev-only): WOULD_PULL, a fresh resolve.\n- c/three: WOULD_PULL, y.\nPaths and fix PRs are in Patient Zero.';
  const other = 'Other: npm incident qix.\n- d/four: LOCKED.\nPaths and fix PRs are in Patient Zero.';
  const r = { ...report, notices: [{ team: 'Web', channel: '#w', text }, { team: 'Other', channel: '#o', text: other }] };
  const s = scopeReport(r, { repos: ['b/two', 'c/three'], label: 'two' });
  assert.equal(s.notices.length, 1, 'the team with no repo in the view has no notice');
  assert.equal(s.notices[0]!.text, 'Web: npm incident qix.\n- b/two (dev-only): WOULD_PULL, a fresh resolve.\n- c/three: WOULD_PULL, y.\nPaths and fix PRs are in Patient Zero.');
  assert.equal(scopeReport(r, { repos: [], label: 'none' }).notices.length, 0);
});

test("an older server's one-line notice stays when it names a repo in the view", () => {
  const first = report.exposures[0]!.repo;
  const s = scopeReport(report, { repos: [first], label: 'one' });
  assert.ok(s.notices.length >= 1 && s.notices.every((n) => n.text.includes(first)));
});

test('the Markdown says it is filtered, lists exactly the view, and a whole export says so too', () => {
  const dev = report.exposures.filter((e) => !e.dev);
  const md = reportToMarkdown(report, { repos: dev.map((e) => e.repo), label: `prod only, ${dev.length} of ${report.exposures.length} repos` });
  assert.ok(md.includes(`Filter: prod only, ${dev.length} of ${report.exposures.length} repos. Only these repos are listed.`));
  for (const e of report.exposures) assert.equal(md.includes(`- \`${e.repo}\` `), !e.dev, e.repo);
  assert.ok(!md.includes('CLEAN'), 'a table lists no clean repos');
  const whole = reportToMarkdown(report);
  assert.ok(whole.includes(`Scope: whole report, ${report.exposures.length} repos.`));
  assert.ok(whole.includes('CLEAN'));
});

test('a search typed into the filter cannot inject Markdown through the label', () => {
  const md = reportToMarkdown(report, { repos: [report.exposures[0]!.repo], label: 'search "x`\n# Injected\n![y](http://y)", 1 of 21 repos' });
  assert.ok(!/^# Injected/m.test(md));
  assert.ok(!md.includes('![y](http://y)'));
});
