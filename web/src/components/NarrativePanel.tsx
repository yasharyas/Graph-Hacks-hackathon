/* NarrativePanel: the LLM narrative as text + claim chips (docs/design.md section 5). Never innerHTML (S5).
 * Backticked entities in the narration become chips: verified ones (in no guard.flagged) show CheckDrawIcon and
 * select their path on click; flagged ones are struck through in red with a visible "(not returned by any graph
 * query)" suffix. `[E1]` evidence ids become small buttons that select that path. "Flagged claims (N)" is a
 * native disclosure (id="flagged-claims") listing guard.flagged as text.
 * NarrativePanel props:  narration (Narration | null), guard (Guard | null), onSelectEntity(entity: string)
 * NarrationBlock props:  narration, guard, onSelectEntity (the same body without the heading, reused by Ask
 *                        follow-ups; pass idSuffix to keep ids unique).
 * The first 6 checks draw on (40ms stagger); the rest appear.
 */
import type { Guard, Narration } from '../data/useTriage.ts';
import { CheckDrawIcon } from './icons/CheckDrawIcon.tsx';

const TOKEN = /(`[^`]+`|\[E\d+\])/g;
const ID_REF = /^\[(E\d+)\]$/;

interface BlockProps {
  narration: Narration;
  guard: Guard | null;
  onSelectEntity: (entity: string) => void;
  idSuffix?: string;
}

export function NarrationBlock({ narration, guard, onSelectEntity, idSuffix = '' }: BlockProps) {
  let checks = 0;
  const flagged = new Set(guard?.flagged ?? []);
  return (
    <div>
      <p className="max-w-(--measure) text-md text-fg-0">
        {narration.text.split(TOKEN).map((seg, i) => {
          if (seg.startsWith('`')) {
            const entity = seg.slice(1, -1);
            if (flagged.has(entity)) {
              return (
                <span key={i}>
                  <span className="rounded-xs bg-bg-2 px-1.5 py-0.5 font-mono text-xs text-infect-400 line-through">{entity}</span>
                  <span className="text-xs text-infect-400"> (not returned by any graph query)</span>
                </span>
              );
            }
            const n = checks++;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectEntity(entity)}
                title="Verified against a graph query. Click to highlight its path."
                className="mx-0.5 inline-flex items-center gap-1 rounded-xs bg-bg-2 px-1.5 py-0.5 align-baseline font-mono text-xs text-tier-clean transition-transform duration-(--dur-press) ease-out active:scale-(--press-scale) hov:bg-bg-3"
              >
                <CheckDrawIcon size={14} animate={n < 6} delay={n * 0.04} />
                <span className="text-fg-0">{entity}</span>
              </button>
            );
          }
          const ref = ID_REF.exec(seg);
          if (ref) {
            return (
              <button key={i} type="button" onClick={() => onSelectEntity(ref[1]!)} className="font-mono text-xs text-fg-1 underline underline-offset-2 hov:text-fg-0">
                {seg}
              </button>
            );
          }
          return seg;
        })}
      </p>
      {guard && guard.flagged.length > 0 && (
        <details id={`flagged-claims${idSuffix}`} className="mt-3 text-sm">
          <summary className="inline-flex cursor-pointer items-center rounded-xs text-tier-would-pull">Flagged claims ({guard.flagged.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-fg-1">
            {guard.flagged.map((f) => (
              <li key={f}>
                <span className="font-mono text-xs text-infect-400 line-through">{f}</span> was not returned by any graph query.
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function NarrativePanel({ narration, guard, onSelectEntity }: Omit<BlockProps, 'narration' | 'idSuffix'> & { narration: Narration | null }) {
  if (!narration) return null;
  return (
    <section aria-label="Narrative" className="animate-enter flex flex-col gap-2">
      <h3 className="label-caps">Narrative</h3>
      <NarrationBlock narration={narration} guard={guard} onSelectEntity={onSelectEntity} />
    </section>
  );
}
