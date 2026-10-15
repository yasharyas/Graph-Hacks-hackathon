// Report export (Markdown or JSON) and the per-repo Slack message. Untrusted strings (repo ids, package names) only
// ever go inside code spans or fenced blocks, with backticks neutralised, so a hostile lockfile name cannot inject
// Markdown (S5).
import { plural, utc, utcLabel } from './format.ts';
import { lockNote, realTeam, repoLabel, repoShort } from './repoLabel.ts';
import { scopeReport, type ReportView } from './reportView.ts';
import type { Exposure, ExposurePath, IncidentMeta, LockSource, Remediation, Report, Tier } from './types.ts';
import { readUrlState, shareUrl, type OpenTab } from './urlState.ts';

export { scopeReport, viewLabel, type ReportView } from './reportView.ts';

const code = (s: string) => `\`${s.replaceAll('`', "'").replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/g, ' ')}\``;
// Server prose quotes lockfile data: one line, and outside its `code` spans no Markdown link or HTML syntax.
const prose = (s: string) => s.replace(/[\r\n]+/g, ' ').split('`').map((x, i) => (i % 2 ? x : x.replace(/[\\[\]<>]/g, '\\$&'))).join('`');
const fence = (s: string) => `\`\`\`\n${s.replaceAll('```', "'''")}\n\`\`\``;
const oneLine = (s: string) => s.replace(/\s+/g, ' ');
const word = (s: string) => (/^[A-Z_]{1,16}$/.test(s) ? s : code(s));
const chain = (p: ExposurePath) => `${p.chain.map(code).join(' → ')}${p.chain.at(-1) === p.version ? '' : ` → ${code(p.version)}`}${p.range ? ` (range ${code(p.range)})` : ''}`;
const depKind = (e: Exposure) => (e.dev ? 'dev only' : 'prod');

/** What the lockfile pins for the affected packages (Exposure.locked; absent on older servers). */
export const lockedOf = (e: Exposure): string[] => (e as Exposure & { locked?: string[] }).locked ?? [];

/** Malicious versions the registry had published by the scenario clock (the incident lists more than a run at 13:16 has seen). */
export const publishedBy = (incident: IncidentMeta, at: number) => incident.versions.filter((v) => v.publishedAt <= at).length;

/** `a@1.0.0` pinned by an override key `a@0.9.0` or `a`: the package name the pin applies to. */
const pinName = (key: string) => (key.lastIndexOf('@') > 0 ? key.slice(0, key.lastIndexOf('@')) : key);
/** "debug@4.4.1, chalk@5.6.0": what an overrides block pins. */
export const pinTargets = (overrides: Record<string, string>) => Object.entries(overrides).map(([k, v]) => `${pinName(k)}@${v}`);

/** Root dependencies to pin next to the overrides: npm rejects an override that conflicts with a direct dependency (EOVERRIDE). */
export const directOf = (f: Pick<Remediation, 'direct' | 'devDirect'>): Record<string, string> => ({ ...f.direct, ...f.devDirect });
export const hasDirect = (f: Pick<Remediation, 'direct' | 'devDirect'>): boolean => Object.keys(directOf(f)).length > 0;

/** The package.json edits that work when pasted on their own: the direct pins, each in the block the repo declares it in, and the overrides. */
export const fixJson = (f: Pick<Remediation, 'overrides' | 'direct' | 'devDirect'>): string =>
  JSON.stringify({
    ...(Object.keys(f.direct ?? {}).length && { dependencies: f.direct }),
    ...(Object.keys(f.devDirect ?? {}).length && { devDependencies: f.devDirect }),
    overrides: f.overrides,
  }, null, 2);

/** Said wherever the snippet is shown or copied: package.json may already have these blocks, and JSON keeps only the last of two. */
export const DIRECT_NOTE = 'Merge these keys into package.json: add them to its existing "overrides", "dependencies" or "devDependencies" block rather than adding a second one (JSON keeps only the last).';

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);
/** npm no longer serves the malicious versions. The removal time is approximate; `now` is injectable so tests do not depend on today's date. */
export const isClosed = (incident: IncidentMeta, now: number = Date.now()): boolean => now >= incident.removedAt;
/** "around 15:15 UTC on 2025-09-08" */
const removedWhen = (incident: IncidentMeta) => `around ${utcLabel(incident.removedAt)} on ${dayOf(incident.removedAt)}`;

/**
 * What the snippet was made for. It comes from the lockfile that was judged, as it stood at the incident, so it can disagree with
 * today's package.json (a range moved past the bad one, a dependency dropped). `subject` names that lockfile where the note is read.
 */
export function fixScopeNote(fix?: Pick<Remediation, 'direct' | 'devDirect'>, subject = 'the lockfile judged above'): string {
  const sets = fix
    ? [...Object.entries(fix.direct ?? {}).map(([n, v]) => `${n} ${v} under dependencies`), ...Object.entries(fix.devDirect ?? {}).map(([n, v]) => `${n} ${v} under devDependencies`)]
    : [];
  return `This is the fix for ${subject}, as it stood at the incident, not for today's package.json. Check it against your current file before you merge: yours may differ.${
    sets.length ? ` It also sets ${sets.join(', ')}: skip a package you have since removed, and keep a newer version if you already have one.` : ''
  }`;
}

/** What is true now: npm removed the malicious versions, so installing from a clean lockfile needs no change; a LOCKED lockfile pins a removed version. `tier` null = a report of many repos. */
export function fixTodayNote(incident: IncidentMeta, tier: Tier | null, now?: number): string {
  if (!isClosed(incident, now)) return 'The malicious versions are still on npm: keep installing from your committed lockfile (npm ci), and use the overrides only if you must re-resolve dependencies while they are live.';
  const gone = `npm removed the malicious versions ${removedWhen(incident)}`;
  if (tier === 'LOCKED') return `${gone}, so npm ci on a lockfile that pins one can no longer fetch it. Re-resolve to a clean release (the overrides below force it), rotate the secrets that builds could read, and rebuild.`;
  if (tier === null) return `${gone}. A lockfile that pins a clean version (npm ci) needs no change today and a fresh install resolves a clean release; a LOCKED repo's lockfile pins a removed version and has to be re-resolved.`;
  return `${gone}, so today npm ci needs no change and a fresh install resolves a clean release. Keep the overrides only to hold that release or to replay the window.`;
}

/** How npm applies an override key: a version-qualified key reaches every dependent whose range admits that version, not only the one that resolved it. */
export function fixPinsNote(overrides: Record<string, string>): string | null {
  const entries = Object.entries(overrides);
  if (!entries.length) return null;
  const q = entries.find(([k]) => k.lastIndexOf('@') > 0);
  return q
    ? `Each key names a bad version (${q[0]}) and pins every dependent whose range admits it to the clean release (${q[1]}), even one that would otherwise resolve a newer safe version. Other majors are untouched. The pin is the clean release at the incident clock: a newer one is fine too.`
    : 'Each override pins that package everywhere in the tree to the version shown.';
}

/** One line of Markdown prose from text a person typed (a filter's search): no line breaks, no link or HTML syntax. */
const label = (s: string) => prose(s.replaceAll('`', "'"));

const and = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/**
 * The summary a lead reads first, in the app's own plain words (the verdict's headline and its tier lines), built from the
 * report's numbers because the verdict text is not part of a report: how many repos are exposed and since when, the LOCKED
 * repos, the prod / dev split of WOULD_PULL, then who to notify, team by team. The headline and tier lines describe the whole
 * run; the notify list follows the rows in the file (`r`: the filtered report, or the whole one). Every repo, team and channel
 * is a code span (code()), as everywhere else in the export.
 */
function summaryLines(whole: Report, r: Report, now?: number): string[] {
  const { incident: inc, counts } = whole;
  const exposed = whole.exposures.filter((e) => e.tier === 'LOCKED' || e.tier === 'WOULD_PULL');
  const locked = exposed.filter((e) => e.tier === 'LOCKED');
  const pull = exposed.filter((e) => e.tier === 'WOULD_PULL');
  const total = whole.scope?.repos ?? Object.values(counts).reduce((a, b) => a + b, 0);
  const project = /^(\S+) npm account takeover/.exec(inc.title)?.[1]; // "axios npm account takeover: ..." -> axios
  const who = inc.maintainer ? `the ${code(inc.maintainer)} account compromise${project && project !== inc.maintainer ? ` (the ${code(project)} maintainer)` : ''}` : `incident ${code(inc.id)}`;
  const first = inc.firstExposureAt ?? inc.firstPublishAt; // an older server sends no first exposure: the first publish stands in
  const ahead = whole.minutesAhead > 0 && whole.at >= first ? ` The graph showed this ${whole.minutesAhead} minutes before the first OSV record.` : '';
  const when = `at ${utcLabel(whole.at)} on ${dayOf(whole.at)}`;
  const fixed = exposed.filter((e) => e.remediated);
  const out: string[] = [];

  if (whole.scope?.kind === 'guest') {
    const e = exposed[0];
    const lock = lockNote(whole.scope.source, e?.repo ?? whole.exposures[0]?.repo ?? whole.scope.label);
    const name = code(repoLabel(e?.repo ?? whole.scope.label));
    const would = lock?.counterfactual ? 'would have been' : 'was';
    if (!e) out.push(`${name} ${lock?.counterfactual ? 'would not have been' : 'is not'} exposed to ${who} ${when}: no malicious version is in its lockfile or admitted by its declared ranges.`);
    else if (e.tier === 'LOCKED') out.push(`LOCKED: ${name} ${would} exposed to ${who}: the lockfile itself pins the malicious ${e.versions.length === 1 ? 'version' : 'versions'} ${and(e.versions.map(code))}, so rotate secrets and rebuild.${ahead}`);
    else out.push(`WOULD_PULL: ${name} ${would} exposed to ${who} only on a fresh install (${e.dev ? 'dev dependencies only' : 'a prod dependency'}); installing from ${lock?.counterfactual ? 'that' : 'the committed'} lockfile (npm ci) ${would} safe.${ahead}`);
    if (lock) out.push(lock.text);
    out.push(windowLine(inc, whole.at, now), '', 'Who to notify: a pasted repo has no team on record here, so send the fix to whoever owns it.');
    return out;
  }

  if (!exposed.length) {
    out.push(`No repo is exposed to ${who} ${when}.`);
    if (counts.MAINTAINER) out.push(`${plural(counts.MAINTAINER, 'repo')} ${counts.MAINTAINER === 1 ? 'depends' : 'depend'} on packages from the compromised account, with no malicious version live for ${counts.MAINTAINER === 1 ? 'it' : 'them'}.`);
    return out;
  }
  const prod = pull.filter((e) => !e.dev).length;
  out.push(`${exposed.length} of ${plural(total, 'repo')} ${exposed.length === 1 ? 'is' : 'are'} exposed to ${who} ${when}.${ahead}`);
  if (locked.length) out.push(`LOCKED, ${plural(locked.length, 'repo')} (${and(locked.map((e) => code(e.repo)))}): the lockfile itself pins the malicious version, so rotate secrets and rebuild.`);
  if (pull.length) out.push(`WOULD_PULL, ${plural(pull.length, 'repo')} (${prod} prod, ${pull.length - prod} dev-only): exposed only on a fresh install; installing from the committed lockfile (npm ci) was safe.`);
  if (fixed.length) out.push(`Marked remediated: ${and(fixed.map((e) => code(e.repo)))}.`);
  if (counts.MAINTAINER) out.push(`${counts.MAINTAINER} more ${counts.MAINTAINER === 1 ? 'repo depends' : 'repos depend'} on packages from the compromised account, with no malicious version live for ${counts.MAINTAINER === 1 ? 'it' : 'them'}.`);
  out.push(windowLine(inc, whole.at, now));

  // who to notify: the teams that own the repos listed in this file, the one with a LOCKED repo first, then the most repos
  const lockedRepos = new Set(locked.map((e) => e.repo));
  const owners = r.owners
    .filter((o) => realTeam(o.team) && o.repos.length)
    .sort((a, b) => Number(b.repos.some((x) => lockedRepos.has(x))) - Number(a.repos.some((x) => lockedRepos.has(x))) || b.repos.length - a.repos.length || a.team.localeCompare(b.team));
  if (owners.length) {
    out.push('', `Who to notify (${plural(owners.length, 'team')}):`, '');
    for (const o of owners) out.push(`- ${code(o.team)} (${code(o.channel)}): ${o.repos.map(code).join(', ')}`);
  }
  return out;
}

/**
 * The report as Markdown. With a `view` (what the exposure table shows while a filter is on) it holds exactly those repos and
 * says so in the header; without one it is the whole report and says that. It opens with a summary (summaryLines), so a lead
 * does not have to read every repo block. `now` only dates "npm has removed the versions" and exists for tests.
 */
export function reportToMarkdown(whole: Report, view?: ReportView, now?: number): string {
  const scoped = view ? scopeReport(whole, view) : null;
  const r: Report = scoped ?? whole;
  const live = publishedBy(r.incident, r.at);
  const total = r.incident.versions.length;
  const lock = lockNote(whole.scope?.source, whole.exposures[0]?.repo ?? whole.scope?.label ?? '');
  const lines = [
    `# ${r.incident.id.replace(/[\r\n]+/g, ' ')}: ${live} malicious version${live === 1 ? '' : 's'} published by ${utcLabel(r.at)}`,
    '',
    '## Summary',
    '',
    ...summaryLines(whole, r, now),
    '',
    `Scenario clock: ${utcLabel(r.at)}. ${r.minutesAhead} min ahead of the first OSV record.${live < total ? ` The incident lists ${total} in total; later publishes are not counted here.` : ''}`,
    scoped
      ? `Filter: ${label(scoped.view.label)}. Only these repos are listed.${scoped.view.outside ? ` ${scoped.view.outside} repo${scoped.view.outside === 1 ? '' : 's'} on screen ${scoped.view.outside === 1 ? 'is' : 'are'} not part of this run.` : ''}`
      : `Scope: whole report, ${r.exposures.length} exposed repo${r.exposures.length === 1 ? '' : 's'}; clean repos are only counted.`,
    ...(lock ? [`Lockfile: ${lock.text}`] : []),
    `LOCKED ${r.counts.LOCKED} · WOULD_PULL ${r.counts.WOULD_PULL} · MAINTAINER ${r.counts.MAINTAINER}${scoped ? '' : ` · CLEAN ${r.counts.CLEAN}`}`,
    '',
    '## Exposures',
    '',
    ...r.exposures.flatMap((e) => [
      `- ${code(e.repo)} ${word(e.tier)}, ${depKind(e)}${realTeam(e.team) ? `, team ${code(e.team!)}` : ''}`,
      ...(e.versions.length ? [`  - bad versions reached: ${e.versions.map(code).join(', ')}`] : []),
      ...(lockedOf(e).length ? [`  - lockfile pins: ${lockedOf(e).map(code).join(', ')}`] : []),
      ...r.paths.filter((p) => p.repo === e.repo).map((p) => `  - path ${p.id ? `${code(p.id)}: ` : ''}${chain(p)}`),
      ...(e.remediated ? [`  - remediated ${utc(e.remediated.at)}`] : []),
    ]),
    '',
    '## Fixes',
    '',
    ...(r.remediations.length ? [fixScopeNote(undefined, 'the lockfile each repo was judged on'), '', fixTodayNote(r.incident, null), '', 'Each override key names a bad version and pins every dependent whose range admits it to the clean release, other majors untouched.', ''] : []),
    ...r.remediations.flatMap((f) => [`### ${code(f.repo)}`, '', DIRECT_NOTE, '', fence(fixJson(f)), '', ...f.steps.map((s, i) => `${i + 1}. ${prose(s)}`), '']),
    '## Notices',
    '',
    ...r.notices.flatMap((n) => [realTeam(n.team) ? `${code(n.team)} (${code(n.channel)})` : 'Draft for your own team (a pasted repo has no team on record)', '', fence(n.text), '']),
    'WOULD_PULL means a fresh install during the window would have fetched the malicious version. Lockfile-pinned `npm ci` builds were safe.',
  ];
  return lines.join('\n');
}

const TIER_WORDS: Record<Tier, string> = {
  LOCKED: 'locks a malicious version, so npm ci installs it',
  WOULD_PULL: 'would pull a malicious version on a fresh install (a committed lockfile would not)',
  MAINTAINER: "depends on the compromised account's packages; no malicious version is reachable yet",
  CLEAN: 'has no path to a malicious version',
};
const ACTION: Record<Tier, string> = {
  LOCKED: 'Rotate secrets that builds and CI could read, then rebuild from a clean lockfile.',
  WOULD_PULL: 'Keep npm ci on the committed lockfile and add the pin if you resolve fresh.',
  MAINTAINER: 'Nothing to change yet. Watch for new advisories.',
  CLEAN: 'Nothing to do.',
};
// Once npm has removed the malicious versions: a clean lockfile needs nothing, a LOCKED one pins a version npm no longer serves.
const ACTION_CLOSED: Record<Tier, string> = {
  ...ACTION,
  LOCKED: 'Rotate secrets that builds and CI could read, re-resolve to a clean release (npm no longer serves the locked version) and rebuild.',
  WOULD_PULL: 'Nothing to change: npm ci on the committed lockfile was safe, and the bad versions are gone from npm, so a fresh install resolves a clean release.',
};

/**
 * The link a notice carries: this screen's address pointed at the repo and the tab, built by shareUrl. A pasted public repo is
 * re-analysed on load (guest); a dropped lockfile has nothing to reopen, so it has no link (null).
 */
export function detailsLink(base: string, report: Pick<Report, 'incident' | 'at' | 'scope'>, repo: string, open: OpenTab): string | null {
  const guest = report.scope?.kind === 'guest';
  const name = repo.replace(/@HEAD$/, '');
  if (guest && name.startsWith('pasted/')) return null;
  try {
    const url = shareUrl(base, { scenario: report.incident.id, at: report.at, ...(guest ? { guest: name } : { repo: name }), open });
    const s = readUrlState(new URL(url).search);
    return (guest ? s.guest : s.repo) === name ? url : null; // a name shareUrl refuses would open the wrong thing
  } catch {
    return null;
  }
}

/** One repo's Slack message, complete on its own: repo, tier in words, prod/dev, path, pin target (and the direct pins), window start and a link (none for a dropped lockfile). */
// "since 00:21 UTC on 2026-03-31 (still live at 01:30 UTC)", or the closed window once npm removed the versions: the first
// version that exposed a repo here, not the incident's first publish (axios published a decoy before any bad version).
function windowLine(incident: IncidentMeta, at?: number, now?: number): string {
  const from = incident.firstExposureAt ?? incident.firstPublishAt;
  const day = dayOf;
  // closed by today's date (a message sent now) or by the scenario clock: either way it is past tense
  if (isClosed(incident, now) || (at !== undefined && at >= incident.removedAt)) {
    return `Window: malicious versions were live from ${utcLabel(from)} on ${day(from)} until npm removed them around ${utcLabel(incident.removedAt)}${day(incident.removedAt) === day(from) ? '' : ` on ${day(incident.removedAt)}`}.`;
  }
  return `Window: malicious versions live since ${utcLabel(from)} on ${day(from)}${at !== undefined ? ` (still live at ${utcLabel(at)}; npm removed them around ${utcLabel(incident.removedAt)})` : ''}.`;
}

/**
 * `anonymous`: a pasted repo has no owning team, so the message opens without one (the placeholder team is not a person to
 * tell). `source`: which lockfile the repo was judged on (Report.scope.source); a pasted or today's lockfile says so.
 */
export function slackMessage(i: { exposure: Exposure; paths: ExposurePath[]; fix?: Remediation; incident: IncidentMeta; link: string | null; at?: number; anonymous?: boolean; source?: LockSource; now?: number }): string {
  const { exposure: e } = i;
  const closed = isClosed(i.incident, i.now) || (i.at !== undefined && i.at >= i.incident.removedAt);
  const lock = lockNote(i.source, e.repo);
  const bad = new Set(i.incident.versions.map((v) => v.id));
  const pins = i.fix ? pinTargets(i.fix.overrides) : [];
  const locked = lockedOf(e).map((l) => `${code(l)} ${bad.has(l) ? '(malicious)' : '(safe)'}`);
  return [
    `${i.anonymous ? '' : `${oneLine(e.team ?? 'Owner not mapped')}: `}npm incident ${oneLine(i.incident.id)}. ${code(repoLabel(e.repo))} ${TIER_WORDS[e.tier]} (${e.dev ? 'dev dependency only' : 'prod dependency'}).`,
    `Tier: ${e.tier}`,
    ...(lock ? [`Lockfile judged: ${lock.short}`] : []),
    ...i.paths.slice(0, 2).map((p) => `Path: ${p.chain.map((c, n) => code(n === 0 ? repoShort(c) : c)).join(' > ')}${p.chain.at(-1) === p.version ? '' : ` > ${code(p.version)}`}${p.range ? ` (range ${code(p.range)})` : ''}`),
    ...(locked.length ? [`Your lockfile pins: ${locked.join(', ')}`] : []),
    ...(pins.length ? [`Pin to${closed ? ' (optional now)' : ''}: ${pins.map(code).join(', ')}`] : []),
    ...(i.fix && hasDirect(i.fix) ? [`Also set in package.json${Object.keys(i.fix.direct ?? {}).length ? `, under dependencies: ${pinTargets(i.fix.direct!).map(code).join(', ')}` : ''}${Object.keys(i.fix.devDirect ?? {}).length ? `${Object.keys(i.fix.direct ?? {}).length ? ';' : ','} under devDependencies: ${pinTargets(i.fix.devDirect!).map(code).join(', ')}` : ''}. npm rejects an override that conflicts with a direct dependency.`] : []),
    windowLine(i.incident, i.at, i.now),
    `Do: ${(closed ? ACTION_CLOSED : ACTION)[e.tier]}`,
    ...(i.link ? [`Details: ${i.link}`] : []),
  ].join('\n');
}

/** Downloads the report (or, with a `view`, only the repos the table shows) and returns the file name. */
export function downloadReport(r: Report, format: 'md' | 'json', view?: ReportView): string {
  const body = format === 'md' ? reportToMarkdown(r, view) : JSON.stringify(view ? scopeReport(r, view) : r, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: format === 'md' ? 'text/markdown' : 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `patient-zero-${r.incident.id}-${utc(r.at).replace(':', '')}z${view ? '-filtered' : ''}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}
