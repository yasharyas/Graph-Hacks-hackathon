/* Path chips: `express@5.1.0 -> debug@4.4.2` is the hero string of the product (docs/design.md section 3).
 * PathChip props: item ("name@version" or "owner/repo"), bad (a malicious version: red, underlined).
 * PathChain props: path (ExposurePath), badVersions (ids from IncidentMeta.versions), last (true = only the final
 *   hop, as the table shows it), className.
 * HopDots props: hops. Dot per hop, capped at 5 then +N.
 * Separators are inline SVG arrows (Martian Mono has no U+2192): single = REQUIRES/RESOLVES_TO, bar = ADMITS.
 */
import type { ExposurePath } from '../data/types.ts';
import { ArrowRight, ArrowRightToLine } from './icons/Glyphs.tsx';

/** "name@1.2.3" -> ["name", "1.2.3"]; scoped "@a/b@1.0.0" and repo ids ("owner/name") are handled. */
export function splitRef(ref: string): [name: string, version: string | null] {
  const i = ref.lastIndexOf('@');
  return i > 0 ? [ref.slice(0, i), ref.slice(i + 1)] : [ref, null];
}

export function PathChip({ item, bad = false }: { item: string; bad?: boolean }) {
  const [name, version] = splitRef(item);
  return (
    <span className="inline-flex max-w-full items-center rounded-xs bg-bg-2 px-1.5 py-0.5 font-mono text-xs break-words">
      <span className="text-fg-0">{name}</span>
      {version && (
        <span className={bad ? 'text-infect-400 underline decoration-1 underline-offset-2' : 'text-fg-1'}>@{version}</span>
      )}
    </span>
  );
}

export function HopDots({ hops }: { hops: number }) {
  const label = hops === 0 ? 'declared directly by the repo' : `${hops} ${hops === 1 ? 'hop' : 'hops'}`;
  return (
    <span title={label} className="font-mono text-xs text-fg-1">
      <span aria-hidden>{hops === 0 ? 'direct' : '•'.repeat(Math.min(hops, 5)) + (hops > 5 ? `+${hops - 5}` : '')}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PathChain({
  path,
  badVersions,
  last = false,
  className = '',
}: {
  path: ExposurePath;
  badVersions: ReadonlySet<string>;
  last?: boolean;
  className?: string;
}) {
  // ADMITS chains end at the repo or dep whose range admits the version, so the version is appended.
  const nodes = path.chain.at(-1) === path.version ? path.chain : [...path.chain, path.version];
  const shown = last ? nodes.slice(-2) : nodes;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {shown.map((item, i) => {
        const isLast = i === shown.length - 1;
        const admits = isLast && path.kind === 'ADMITS';
        return (
          <span key={`${item}-${i}`} className="inline-flex max-w-full flex-wrap items-center gap-1">
            {i > 0 &&
              (admits ? (
                <>
                  {path.range && <span className="font-mono text-xs text-warn">{path.range}</span>}
                  <ArrowRightToLine size={12} className="text-fg-2" title="admits" />
                </>
              ) : (
                <ArrowRight size={12} className="text-fg-2" title="requires" />
              ))}
            <PathChip item={item} bad={badVersions.has(item)} />
          </span>
        );
      })}
    </span>
  );
}
