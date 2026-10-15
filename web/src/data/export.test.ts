// Run: node --test web/src/data/export.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from '../../../shared/fixtures/triage-qix.json' with { type: 'json' };
import { reportToMarkdown } from './export.ts';
import type { Report } from './types.ts';

const report = fixture.events.find((e) => e.type === 'report')!.report as unknown as Report;

test('markdown carries the live report: clock, counts, every exposure, every notice and fix', () => {
  const md = reportToMarkdown(report);
  assert.match(md, new RegExp(`^# ${report.incident.title}`));
  assert.ok(md.includes(`LOCKED ${report.counts.LOCKED} · WOULD_PULL ${report.counts.WOULD_PULL} · MAINTAINER ${report.counts.MAINTAINER}`));
  for (const e of report.exposures) assert.ok(md.includes(`\`${e.repo}\` ${e.tier}`), e.repo);
  for (const n of report.notices) assert.ok(md.includes(n.text), n.team);
  for (const f of report.remediations) assert.ok(md.includes(JSON.stringify({ overrides: f.overrides }, null, 2)), f.repo);
  assert.ok(md.includes('Lockfile-pinned `npm ci` builds were safe.'));
});

test('a remediation mark shows on its line', () => {
  const e = report.exposures[0]!;
  const md = reportToMarkdown({ ...report, exposures: [{ ...e, remediated: { at: Date.UTC(2025, 8, 8, 14, 2), action: 'remediated' } }] });
  assert.ok(md.includes(`\`${e.repo}\` ${e.tier} (remediated 14:02)`));
});

test('hostile repo and package names cannot inject Markdown', () => {
  const evil = 'evil`\n# Injected heading\n![x](http://x)';
  const md = reportToMarkdown({ ...report, exposures: [{ ...report.exposures[0]!, repo: evil }], paths: [] });
  assert.ok(!/^# Injected/m.test(md));
  assert.ok(md.includes("`evil' # Injected heading ![x](http://x)`"));
});
