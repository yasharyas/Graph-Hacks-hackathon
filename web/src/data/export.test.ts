// Run: node --test web/src/data/export.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from '../../../shared/fixtures/triage-qix.json' with { type: 'json' };
import { detailsLink, DIRECT_NOTE, fixJson, fixPinsNote, fixScopeNote, fixTodayNote, isClosed, pinTargets, publishedBy, reportToMarkdown, slackMessage } from './export.ts';
import type { Exposure, Remediation, Report } from './types.ts';

const report = fixture.events.find((e) => e.type === 'report')!.report as unknown as Report;
const LIVE = report.incident.firstPublishAt + 20 * 60_000; // inside the window, before npm removed the versions

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
  // Fix steps are server prose that quotes lockfile data: one line, link syntax escaped outside its code spans.
  const steps = reportToMarkdown({ ...report, remediations: [{ repo: 'a/b', overrides: {}, steps: ['Pin `x [y](z)` then [Click to fix](https://evil.example)\nDo: <b>run it</b>'], prBody: '' }] });
  assert.ok(steps.includes('1. Pin `x [y](z)` then \\[Click to fix\\](https://evil.example) Do: \\<b\\>run it\\</b\\>'));
});

test('pin targets read the version from the override, qualified or not', () => {
  assert.deepEqual(pinTargets({ 'debug@4.4.2': '4.4.1', chalk: '5.6.0', '@scope/pkg@1.0.0': '0.9.0' }), ['debug@4.4.1', 'chalk@5.6.0', '@scope/pkg@0.9.0']);
});

test('the Slack message is complete on its own: repo, tier in words, prod/dev, path, pin target, window start, link', () => {
  const e = report.exposures.find((x) => x.tier === 'LOCKED') ?? report.exposures[0]!;
  const path = report.paths.find((p) => p.repo === e.repo);
  const fix = report.remediations.find((f) => f.repo === e.repo) ?? { repo: e.repo, overrides: { 'debug@4.4.2': '4.4.1' }, steps: [], prBody: '' };
  // `now` inside the window: the message is read while the versions are still live (a message sent today is tested below)
  const msg = slackMessage({ exposure: { ...e, dev: false, locked: [e.versions[0] ?? 'debug@4.4.2'] } as Exposure, paths: path ? [path] : [], fix, incident: report.incident, link: 'https://pz.example/?repo=x', now: LIVE });
  assert.ok(msg.includes(e.repo));
  assert.match(msg, /locks a malicious version|would pull a malicious version|depends on the compromised/);
  assert.ok(msg.includes('prod dependency'));
  assert.ok(msg.includes(`Tier: ${e.tier}`));
  if (path) assert.ok(msg.includes(`Path: ${path.chain.map((c) => `\`${c}\``).join(' > ')}`));
  assert.ok(msg.includes('Pin to: `' + pinTargets(fix.overrides)[0] + '`'));
  assert.match(msg, /live since \d\d:\d\d UTC on \d{4}-\d\d-\d\d/);
  const from = report.incident.firstPublishAt + 9 * 60_000; // a later first exposure than the first publish (axios: a decoy came first)
  assert.ok(slackMessage({ exposure: e, paths: [], incident: report.incident, link: null, at: report.incident.removedAt + 60_000 }).includes('until npm removed them'), 'past tense after removal');
  assert.ok(slackMessage({ exposure: e, paths: [], incident: { ...report.incident, firstExposureAt: from }, link: null }).includes(new Date(from).toISOString().slice(11, 16)), 'the first exposure, not the first publish');
  assert.ok(msg.endsWith('Details: https://pz.example/?repo=x'));
  assert.ok(msg.includes('(malicious)'), 'a locked bad version is called out');
  assert.ok(slackMessage({ exposure: { ...e, locked: ['chalk@5.4.1'] } as Exposure, paths: [], incident: report.incident, link: 'x' }).includes('`chalk@5.4.1` (safe)'));
});

const mocha: Remediation = { repo: 'mochajs/mocha', overrides: { 'debug@4.4.2': '4.4.1' }, direct: { debug: '4.4.1' }, steps: [], prBody: '' };

test('the fix snippet carries the direct pins next to the overrides, so it works when pasted alone', () => {
  assert.deepEqual(JSON.parse(fixJson(mocha)), { dependencies: { debug: '4.4.1' }, overrides: { 'debug@4.4.2': '4.4.1' } });
  assert.deepEqual(JSON.parse(fixJson({ ...mocha, direct: undefined })), { overrides: { 'debug@4.4.2': '4.4.1' } }, 'no direct pins: overrides only');
  assert.deepEqual(JSON.parse(fixJson({ ...mocha, direct: {} })), { overrides: { 'debug@4.4.2': '4.4.1' } });
  assert.deepEqual(JSON.parse(fixJson({ ...mocha, direct: undefined, devDirect: { chalk: '5.6.0' } })), { devDependencies: { chalk: '5.6.0' }, overrides: { 'debug@4.4.2': '4.4.1' } }, 'a devDependency is pinned where it is declared');
});

test('the Markdown export and the Slack message include the direct pins', () => {
  const e = report.exposures.find((x) => x.tier === 'WOULD_PULL') ?? report.exposures[0]!;
  const md = reportToMarkdown({ ...report, remediations: [mocha] });
  assert.ok(md.includes(fixJson(mocha)) && md.includes('"dependencies"'));
  assert.ok(md.includes(DIRECT_NOTE));
  const msg = slackMessage({ exposure: e, paths: [], fix: mocha, incident: report.incident, link: null, now: LIVE });
  assert.ok(msg.includes('Pin to: `debug@4.4.1`'));
  assert.ok(slackMessage({ exposure: e, paths: [], fix: mocha, incident: report.incident, link: null }).includes('Pin to (optional now): `debug@4.4.1`'), 'sent today, the pin is optional');
  assert.match(msg, /Also set in package\.json, under dependencies: `debug@4\.4\.1`/);
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

test('the merge note is in every exported fix, not only the ones with direct pins (existing overrides blocks are common)', () => {
  const plain: Remediation = { repo: 'a/b', overrides: { 'debug@4.4.2': '4.4.1' }, steps: [], prBody: '' };
  const md = reportToMarkdown({ ...report, remediations: [plain] });
  assert.ok(md.includes(DIRECT_NOTE));
  assert.ok(md.includes('existing "overrides"'));
});

test('a pasted repo has no team in its notice and says which lockfile it was judged on', () => {
  const e = { ...report.exposures[0]!, repo: 'mochajs/mocha@HEAD', team: 'Your team', tier: 'WOULD_PULL' as const };
  const head = slackMessage({ exposure: e, paths: [], incident: report.incident, link: null, anonymous: true, source: { kind: 'head' } });
  assert.ok(head.startsWith('npm incident '), head.split('\n')[0]);
  assert.ok(!head.includes('Your team'));
  assert.ok(head.includes("`mochajs/mocha (today's lockfile)`"));
  assert.ok(head.includes("Lockfile judged: today's lockfile (counterfactual)"));
  const snap = slackMessage({ exposure: { ...e, repo: 'mochajs/mocha' }, paths: [], incident: report.incident, link: null, anonymous: true, source: { kind: 'snapshot', sha: 'abcdef1234567890', date: Date.UTC(2025, 8, 1) } });
  assert.ok(snap.includes('Lockfile judged: the lockfile at commit abcdef1 from 2025-09-01, the last change before the incident'));
  const org = slackMessage({ exposure: report.exposures[0]!, paths: [], incident: report.incident, link: null });
  assert.ok(!org.includes('Lockfile judged'), 'the demo org has no lockfile question');
  assert.ok(org.startsWith(`${report.exposures[0]!.team}: npm incident`));
});

test('the Markdown header names the lockfile a pasted repo was judged on', () => {
  const guest = { ...report, scope: { kind: 'guest' as const, label: 'mochajs/mocha', repos: 1, source: { kind: 'pasted' as const } } };
  assert.ok(reportToMarkdown(guest).includes('Lockfile: Judged on your pasted lockfile (counterfactual)'));
  assert.ok(!reportToMarkdown(report).includes('Lockfile: Judged'));
});

test('the fix says what it was made for: the judged lockfile at the incident, not today\'s package.json', () => {
  const note = fixScopeNote(mocha);
  assert.match(note, /fix for the lockfile judged above, as it stood at the incident, not for today's package\.json/);
  assert.match(note, /Check it against your current file before you merge/);
  assert.match(note, /It also sets debug 4\.4\.1 under dependencies: skip a package you have since removed, and keep a newer version if you already have one\./);
  assert.match(fixScopeNote({ devDirect: { chalk: '5.6.0' } }), /sets chalk 5\.6\.0 under devDependencies/);
  assert.ok(!fixScopeNote({}).includes('It also sets'), 'no direct pins, nothing to skip');
  assert.match(fixScopeNote(undefined, 'the lockfile each repo was judged on'), /fix for the lockfile each repo was judged on/);
});

test('today, with the versions removed from npm, a clean lockfile needs no change; a LOCKED one has to be re-resolved', () => {
  const inc = report.incident;
  assert.ok(isClosed(inc, inc.removedAt) && !isClosed(inc, inc.removedAt - 1));
  const clean = fixTodayNote(inc, 'WOULD_PULL', inc.removedAt + 1);
  assert.match(clean, /npm removed the malicious versions around \d\d:\d\d UTC on \d{4}-\d\d-\d\d/);
  assert.match(clean, /npm ci needs no change/);
  assert.ok(!/still live|replaces only/.test(clean));
  const locked = fixTodayNote(inc, 'LOCKED', inc.removedAt + 1);
  assert.match(locked, /npm ci on a lockfile that pins one can no longer fetch it/);
  assert.match(locked, /rotate the secrets/);
  assert.ok(!locked.includes('needs no change'));
  assert.match(fixTodayNote(inc, null, inc.removedAt + 1), /LOCKED repo's lockfile pins a removed version/);
  assert.match(fixTodayNote(inc, 'WOULD_PULL', inc.removedAt - 1), /still on npm: keep installing from your committed lockfile/);
});

test('an override key reaches every dependent whose range admits the bad version, and the fix says so', () => {
  const note = fixPinsNote({ 'debug@4.4.2': '4.4.1' })!;
  assert.match(note, /pins every dependent whose range admits it to the clean release \(4\.4\.1\)/);
  assert.match(note, /even one that would otherwise resolve a newer safe version/);
  assert.ok(!/replaces only|only the (exact )?(malicious|bad) version/i.test(note), note);
  assert.match(fixPinsNote({ chalk: '5.6.0' })!, /pins that package everywhere/);
  assert.equal(fixPinsNote({}), null);
});

test('the Markdown export carries the same honesty and no "replaces only" claim', () => {
  const md = reportToMarkdown({ ...report, remediations: [mocha] });
  assert.ok(md.includes("not for today's package.json"));
  assert.ok(md.includes('pins every dependent whose range admits it to the clean release'));
  assert.ok(md.includes('npm removed the malicious versions around'));
  assert.ok(!/replaces only|only the (exact )?(malicious|bad) version/i.test(md));
  assert.ok(!reportToMarkdown({ ...report, remediations: [] }).includes('not for today'), 'no fixes, no fix note');
});

test('a message sent after the versions are gone says the window is closed, in the Notice and in "Do"', () => {
  const inc = report.incident;
  const wp = { ...report.exposures[1]!, tier: 'WOULD_PULL' as const };
  const sent = slackMessage({ exposure: wp, paths: [], incident: inc, link: null, now: inc.removedAt + 3_600_000 });
  assert.match(sent, /Window: malicious versions were live from \d\d:\d\d UTC on \d{4}-\d\d-\d\d until npm removed them around \d\d:\d\d UTC\./);
  assert.ok(!sent.includes('still live'));
  assert.match(sent, /Do: Nothing to change: npm ci on the committed lockfile was safe/);
  const locked = slackMessage({ exposure: { ...wp, tier: 'LOCKED' }, paths: [], incident: inc, link: null, now: inc.removedAt + 1 });
  assert.match(locked, /Do: Rotate secrets .* re-resolve to a clean release/);
  // inside the window it keeps the live wording (a replay read on the scenario clock)
  const live = slackMessage({ exposure: wp, paths: [], incident: inc, link: null, at: LIVE, now: LIVE });
  assert.match(live, /live since \d\d:\d\d UTC on \d{4}-\d\d-\d\d \(still live at /);
  assert.match(live, /Do: Keep npm ci on the committed lockfile and add the pin if you resolve fresh\./);
  // the window ends on another day than it began
  const overnight = slackMessage({ exposure: wp, paths: [], incident: { ...inc, removedAt: inc.firstPublishAt + 30 * 3_600_000 }, link: null, now: inc.firstPublishAt + 40 * 3_600_000 });
  assert.match(overnight, /until npm removed them around \d\d:\d\d UTC on \d{4}-\d\d-\d\d\./);
});

test('the Markdown opens with a summary: the headline, the tier lines, the window, then who to notify team by team', () => {
  const md = reportToMarkdown(report, undefined, report.incident.removedAt + 1);
  const lines = md.split('\n');
  assert.equal(lines[2], '## Summary', 'right under the title, before the scope and counts');
  assert.ok(md.indexOf('## Summary') < md.indexOf('Scenario clock:') && md.indexOf('Scenario clock:') < md.indexOf('## Exposures'));
  const exposed = report.counts.LOCKED + report.counts.WOULD_PULL;
  const total = Object.values(report.counts).reduce((a, b) => a + b, 0);
  const head = lines[4]!;
  assert.match(head, new RegExp(`^${exposed} of ${total} repos are exposed to the \`qix\` account compromise at 13:30 UTC on 2025-09-08\\.`));
  assert.ok(head.includes(`No OSV record exists yet at 13:30 UTC (in hindsight, it came at 14:26 UTC, ${report.minutesAhead} minutes after the first exposure).`), head); // as of the clock
  const locked = report.exposures.filter((e) => e.tier === 'LOCKED').map((e) => `\`${e.repo}\``);
  assert.ok(md.includes(`LOCKED, ${locked.length} repo${locked.length === 1 ? '' : 's'} (${locked.join(', ')}): the lockfile itself pins the malicious version, so rotate secrets and rebuild.`));
  const pull = report.exposures.filter((e) => e.tier === 'WOULD_PULL');
  const prod = pull.filter((e) => !e.dev).length;
  assert.ok(md.includes(`WOULD_PULL, ${pull.length} repos (${prod} prod, ${pull.length - prod} dev-only): exposed only on a fresh install; installing from the committed lockfile (npm ci) was safe.`));
  assert.match(md, /Window: malicious versions live since \d\d:\d\d UTC on \d{4}-\d\d-\d\d \(still live at 13:30 UTC\)\./); // as of the scenario clock
  // who to notify: team, channel, repos; the team with the LOCKED repo first
  const notify = md.slice(md.indexOf('Who to notify'), md.indexOf('Scenario clock:')).split('\n').filter((l) => l.startsWith('- '));
  assert.equal(notify.length, report.owners.length);
  assert.equal(notify[0], '- `Payments` (`#team-payments`): `acme/checkout-web`');
  assert.ok(notify.includes('- `CLI` (`#team-cli`): `npm/cli`, `http-party/http-server`'));
  assert.ok(md.includes(`Who to notify (${report.owners.length} teams):`));
  // the existing sections follow
  assert.ok(md.includes('## Exposures') && md.includes('## Fixes') && md.includes('## Notices'));
});

test('the summary escapes every repo, team and channel it prints, and a filter shortens only the notify list', () => {
  const evil = 'evil`\n# Injected\n[x](http://x)';
  const hostile = {
    ...report,
    exposures: [{ ...report.exposures[0]!, repo: evil, tier: 'LOCKED' as const }, report.exposures[1]!],
    owners: [{ team: evil, channel: evil, repos: [evil] }, ...report.owners.slice(1)],
  };
  const md = reportToMarkdown(hostile);
  assert.ok(!/^# Injected/m.test(md) && !/^\[x\]/m.test(md), md);
  assert.ok(md.includes("- `evil' # Injected [x](http://x)` (`evil' # Injected [x](http://x)`): `evil' # Injected [x](http://x)`"));
  // a filtered file summarises its own repos (not the whole run) and lists only the owners of the listed repos
  const one = report.exposures[1]!;
  const filtered = reportToMarkdown(report, { repos: [one.repo], label: `search "${one.repo}", 1 of ${report.exposures.length} repos` });
  assert.match(filtered, /\b1 repo in this filter is exposed to /, 'headline is the filter');
  const teams = filtered.slice(filtered.indexOf('Who to notify'), filtered.indexOf('Scenario clock:')).split('\n').filter((l) => l.startsWith('- '));
  assert.equal(teams.length, 1);
  assert.ok(teams[0]!.includes(`\`${one.repo}\``));
  assert.ok(filtered.includes('Filter: '));
});

test('the summary of a pasted repo is one plain answer, with no team routing and no placeholder', () => {
  const e = { ...report.exposures[1]!, repo: 'mochajs/mocha', team: 'Your team', tier: 'WOULD_PULL' as const, dev: false };
  const guest = { ...report, scope: { kind: 'guest' as const, label: 'mochajs/mocha', repos: 1, source: { kind: 'snapshot' as const, sha: 'abcdef1234567890', date: Date.UTC(2025, 8, 1) } }, exposures: [e], owners: [{ team: 'Your team', channel: '#your-team', repos: ['mochajs/mocha'] }], counts: { LOCKED: 0, WOULD_PULL: 1, MAINTAINER: 0, CLEAN: 0 } };
  const md = reportToMarkdown(guest, undefined, report.incident.removedAt + 1);
  const summary = md.slice(md.indexOf('## Summary'), md.indexOf('Scenario clock:'));
  assert.match(summary, /WOULD_PULL: `mochajs\/mocha` was exposed to the `qix` account compromise only on a fresh install/);
  assert.match(summary, /installing from the committed lockfile \(npm ci\) was safe/);
  assert.ok(summary.includes('Judged on the lockfile at commit abcdef1 from 2025-09-01'));
  assert.ok(summary.includes('Who to notify: a pasted repo has no team on record here'));
  assert.ok(!summary.includes('Your team') && !summary.includes('- `'), summary);
  const none = reportToMarkdown({ ...guest, exposures: [], counts: { LOCKED: 0, WOULD_PULL: 0, MAINTAINER: 0, CLEAN: 1 } });
  assert.match(none, /`mochajs\/mocha` is not exposed to the `qix` account compromise/);
});

test('a report with nothing exposed says so instead of a headline', () => {
  const md = reportToMarkdown({ ...report, exposures: [], paths: [], remediations: [], notices: [], owners: [], counts: { LOCKED: 0, WOULD_PULL: 0, MAINTAINER: 2, CLEAN: 19 } });
  assert.match(md, /## Summary\n\nNo repo is exposed to the `qix` account compromise at 13:30 UTC/);
  assert.ok(md.includes('2 repos depend on packages from the compromised account'));
  assert.ok(!md.includes('Who to notify'));
});

test('a pasted repo never prints the placeholder team, in the export or in its notices', () => {
  const guest = { ...report, scope: { kind: 'guest' as const, label: 'mochajs/mocha', repos: 1 }, exposures: [{ ...report.exposures[0]!, team: 'Your team' }], notices: [{ team: 'Your team', channel: '#your-team', text: 'x' }] };
  const md = reportToMarkdown(guest);
  assert.ok(!md.includes('Your team') && !md.includes('#your-team'), md);
  assert.ok(md.includes('Draft for your own team'));
  assert.ok(!md.includes(', team '), 'no team on the exposure line');
  assert.ok(reportToMarkdown({ ...report, exposures: [{ ...report.exposures[0]!, team: 'Payments' }], notices: [{ team: 'Payments', channel: '#pay', text: 'x' }] }).includes(', team `Payments`'));
});
