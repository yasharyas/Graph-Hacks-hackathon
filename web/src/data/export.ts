// Report export (Markdown or JSON) and the per-repo Slack message. Untrusted strings (repo ids, package names) only
// ever go inside code spans or fenced blocks, with backticks neutralised, so a hostile lockfile name cannot inject
// Markdown (S5).
import { utc, utcLabel } from './format.ts';
import { lockNote, repoLabel, repoShort } from './repoLabel.ts';
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

/** One line of Markdown prose from text a person typed (a filter's search): no line breaks, no link or HTML syntax. */
const label = (s: string) => prose(s.replaceAll('`', "'"));

/**
 * The report as Markdown. With a `view` (what the exposure table shows while a filter is on) it holds exactly those repos and
 * says so in the header; without one it is the whole report and says that.
 */
export function reportToMarkdown(whole: Report, view?: ReportView): string {
  const scoped = view ? scopeReport(whole, view) : null;
  const r: Report = scoped ?? whole;
  const live = publishedBy(r.incident, r.at);
  const total = r.incident.versions.length;
  const lock = lockNote(whole.scope?.source, whole.exposures[0]?.repo ?? whole.scope?.label ?? '');
  const lines = [
    `# ${r.incident.id.replace(/[\r\n]+/g, ' ')}: ${live} malicious version${live === 1 ? '' : 's'} published by ${utcLabel(r.at)}`,
    '',
    `Scenario clock: ${utcLabel(r.at)}. ${r.minutesAhead} min ahead of the first OSV record.${live < total ? ` The incident lists ${total} in total; later publishes are not counted here.` : ''}`,
    scoped
      ? `Filter: ${label(scoped.view.label)}. Only these repos are listed.${scoped.view.outside ? ` ${scoped.view.outside} repo${scoped.view.outside === 1 ? '' : 's'} on screen ${scoped.view.outside === 1 ? 'is' : 'are'} not part of this run.` : ''}`
      : `Scope: whole report, ${r.exposures.length} repo${r.exposures.length === 1 ? '' : 's'}.`,
    ...(lock ? [`Lockfile: ${lock.text}`] : []),
    `LOCKED ${r.counts.LOCKED} · WOULD_PULL ${r.counts.WOULD_PULL} · MAINTAINER ${r.counts.MAINTAINER}${scoped ? '' : ` · CLEAN ${r.counts.CLEAN}`}`,
    '',
    '## Exposures',
    '',
    ...r.exposures.flatMap((e) => [
      `- ${code(e.repo)} ${word(e.tier)}, ${depKind(e)}${e.team ? `, team ${code(e.team)}` : ''}`,
      ...(e.versions.length ? [`  - bad versions reached: ${e.versions.map(code).join(', ')}`] : []),
      ...(lockedOf(e).length ? [`  - lockfile pins: ${lockedOf(e).map(code).join(', ')}`] : []),
      ...r.paths.filter((p) => p.repo === e.repo).map((p) => `  - path ${p.id ? `${code(p.id)}: ` : ''}${chain(p)}`),
      ...(e.remediated ? [`  - remediated ${utc(e.remediated.at)}`] : []),
    ]),
    '',
    '## Fixes',
    '',
    ...r.remediations.flatMap((f) => [`### ${code(f.repo)}`, '', DIRECT_NOTE, '', fence(fixJson(f)), '', ...f.steps.map((s, i) => `${i + 1}. ${prose(s)}`), '']),
    '## Notices',
    '',
    ...r.notices.flatMap((n) => [`${code(n.team)} (${code(n.channel)})`, '', fence(n.text), '']),
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
function windowLine(incident: IncidentMeta, at?: number): string {
  const from = incident.firstExposureAt ?? incident.firstPublishAt;
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  if (at !== undefined && at >= incident.removedAt) return `Window: malicious versions were live from ${utcLabel(from)} on ${day(from)} until npm removed them around ${utcLabel(incident.removedAt)}.`;
  return `Window: malicious versions live since ${utcLabel(from)} on ${day(from)}${at !== undefined ? ` (still live at ${utcLabel(at)}; npm removed them around ${utcLabel(incident.removedAt)})` : ''}.`;
}

/**
 * `anonymous`: a pasted repo has no owning team, so the message opens without one (the placeholder team is not a person to
 * tell). `source`: which lockfile the repo was judged on (Report.scope.source); a pasted or today's lockfile says so.
 */
export function slackMessage(i: { exposure: Exposure; paths: ExposurePath[]; fix?: Remediation; incident: IncidentMeta; link: string | null; at?: number; anonymous?: boolean; source?: LockSource }): string {
  const { exposure: e } = i;
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
    ...(pins.length ? [`Pin to: ${pins.map(code).join(', ')}`] : []),
    ...(i.fix && hasDirect(i.fix) ? [`Also set in package.json${Object.keys(i.fix.direct ?? {}).length ? `, under dependencies: ${pinTargets(i.fix.direct!).map(code).join(', ')}` : ''}${Object.keys(i.fix.devDirect ?? {}).length ? `${Object.keys(i.fix.direct ?? {}).length ? ';' : ','} under devDependencies: ${pinTargets(i.fix.devDirect!).map(code).join(', ')}` : ''}. npm rejects an override that conflicts with a direct dependency.`] : []),
    windowLine(i.incident, i.at),
    `Do: ${ACTION[e.tier]}`,
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
