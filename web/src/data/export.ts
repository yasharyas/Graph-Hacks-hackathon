// Report export (Markdown or JSON). Untrusted strings (repo ids, package names) only ever go inside code
// spans or fenced blocks, with backticks neutralised, so a hostile lockfile name cannot inject Markdown (S5).
import { utc, utcLabel } from './format.ts';
import type { Report } from './types.ts';

const code = (s: string) => `\`${s.replaceAll('`', "'").replace(/\s+/g, ' ')}\``;
const fence = (s: string) => `\`\`\`\n${s.replaceAll('```', "'''")}\n\`\`\``;

export function reportToMarkdown(r: Report): string {
  const lines = [
    `# ${r.incident.title.replace(/[\r\n]+/g, ' ')}`,
    '',
    `Scenario clock: ${utcLabel(r.at)}. ${r.minutesAhead} min ahead of the first OSV record.`,
    `LOCKED ${r.counts.LOCKED} · WOULD_PULL ${r.counts.WOULD_PULL} · MAINTAINER ${r.counts.MAINTAINER} · CLEAN ${r.counts.CLEAN}`,
    '',
    '## Exposures',
    '',
    ...r.exposures.map((e) => {
      const path = r.paths.find((p) => p.repo === e.repo);
      return `- ${code(e.repo)} ${e.tier}${e.remediated ? ` (remediated ${utc(e.remediated.at)})` : ''}${e.team ? `, team ${code(e.team)}` : ''}${path ? `, path ${path.chain.map(code).join(' → ')}${path.range ? ` (range ${code(path.range)})` : ''}` : ''}`;
    }),
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
