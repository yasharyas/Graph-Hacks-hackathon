// Report export (Markdown or JSON) and the per-repo Slack message. Untrusted strings (repo ids, package names) only
// ever go inside code spans or fenced blocks, with backticks neutralised, so a hostile lockfile name cannot inject
// Markdown (S5).
import { utc, utcLabel } from './format.ts';
import type { Exposure, ExposurePath, IncidentMeta, Remediation, Report, Tier } from './types.ts';

const code = (s: string) => `\`${s.replaceAll('`', "'").replace(/\s+/g, ' ')}\``;
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

export function reportToMarkdown(r: Report): string {
  const live = publishedBy(r.incident, r.at);
  const total = r.incident.versions.length;
  const lines = [
    `# ${r.incident.id.replace(/[\r\n]+/g, ' ')}: ${live} malicious version${live === 1 ? '' : 's'} published by ${utcLabel(r.at)}`,
    '',
    `Scenario clock: ${utcLabel(r.at)}. ${r.minutesAhead} min ahead of the first OSV record.${live < total ? ` The incident lists ${total} in total; later publishes are not counted here.` : ''}`,
    `LOCKED ${r.counts.LOCKED} · WOULD_PULL ${r.counts.WOULD_PULL} · MAINTAINER ${r.counts.MAINTAINER} · CLEAN ${r.counts.CLEAN}`,
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
    ...r.remediations.flatMap((f) => [`### ${code(f.repo)}`, '', fence(JSON.stringify({ overrides: f.overrides }, null, 2)), '', ...f.steps.map((s, i) => `${i + 1}. ${s.replace(/[\r\n]+/g, ' ')}`), '']),
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

/** One repo's Slack message, complete on its own: repo, tier in words, prod/dev, path, pin target, window start and a link. */
export function slackMessage(i: { exposure: Exposure; paths: ExposurePath[]; fix?: Remediation; incident: IncidentMeta; link: string }): string {
  const { exposure: e } = i;
  const bad = new Set(i.incident.versions.map((v) => v.id));
  const pins = i.fix ? pinTargets(i.fix.overrides) : [];
  const locked = lockedOf(e).map((l) => `${code(l)} ${bad.has(l) ? '(malicious)' : '(safe)'}`);
  return [
    `${oneLine(e.team ?? 'Owner not mapped')}: npm incident ${oneLine(i.incident.id)}. ${code(e.repo)} ${TIER_WORDS[e.tier]} (${e.dev ? 'dev dependency only' : 'prod dependency'}).`,
    `Tier: ${e.tier}`,
    ...i.paths.slice(0, 2).map((p) => `Path: ${p.chain.map(code).join(' > ')}${p.chain.at(-1) === p.version ? '' : ` > ${code(p.version)}`}${p.range ? ` (range ${code(p.range)})` : ''}`),
    ...(locked.length ? [`Your lockfile pins: ${locked.join(', ')}`] : []),
    ...(pins.length ? [`Pin to: ${pins.map(code).join(', ')}`] : []),
    `Window: malicious versions have been live since ${utcLabel(i.incident.firstPublishAt)}.`,
    `Do: ${ACTION[e.tier]}`,
    `Details: ${i.link}`,
  ].join('\n');
}

/** Downloads the report and returns the file name. */
export function downloadReport(r: Report, format: 'md' | 'json'): string {
  const body = format === 'md' ? reportToMarkdown(r) : JSON.stringify(r, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: format === 'md' ? 'text/markdown' : 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `patient-zero-${r.incident.id}-${utc(r.at).replace(':', '')}z.${format}`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}
