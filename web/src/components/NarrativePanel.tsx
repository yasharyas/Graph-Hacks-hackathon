/* NarrativePanel: the LLM narrative as text + claim chips (docs/design.md section 5). Never innerHTML (S5).
 * The narration is untrusted, so a claim is "verified" ONLY if the server's guard listed that exact text with
 * ok=true (data/narration.ts decides; this file renders). Verified backticked entities show CheckDrawIcon and
 * select their path on click; backticked text the guard never listed stays neutral; flagged claims are struck
 * through in red with a visible "(not returned by any graph query)" suffix. `[E1]` ids become buttons only when
 * the guard verified them. "Flagged claims (N)" is a native disclosure (id="flagged-claims") listing
 * guard.flagged as text.
 * NarrativePanel props:  narration (Narration | null), guard (Guard | null), onSelectEntity(entity: string)
 * NarrationBlock props:  narration, guard, onSelectEntity (the same body without the heading, reused by Ask
 *                        follow-ups; pass idSuffix to keep ids unique).
 * The first 6 checks draw on (40ms stagger); the rest appear.
 */
import { plural } from '../data/format.ts';
import { segments } from '../data/narration.ts';
import type { Guard, Narration } from '../data/useTriage.ts';
import { CheckDrawIcon } from './icons/CheckDrawIcon.tsx';

interface BlockProps {
  narration: Narration;
  guard: Guard | null;
  onSelectEntity: (entity: string) => void;
  idSuffix?: string;
}

const NOT_RETURNED = 'not returned by any graph query';

export function NarrationBlock({ narration, guard, onSelectEntity, idSuffix = '' }: BlockProps) {
  let checks = 0;
  const segs = segments(narration.text, guard);
  const unchecked = segs.some((s) => s.kind === 'entity' && s.verdict === 'plain');
  return (
    <div>
      <p className="max-w-(--measure) text-md whitespace-pre-line text-fg-0">
        {segs.map((s, i) => {
          if (s.kind === 'text') return s.text;
          if (s.kind === 'struck') {
            return (
              <span key={i}>
                <span className="text-infect-400 line-through">{s.text}</span>
                <span className="text-xs text-infect-400"> ({NOT_RETURNED})</span>
              </span>
            );
          }
          if (s.kind === 'cite') {
            if (s.verdict === 'verified') {
              return (
                <button key={i} type="button" onClick={() => onSelectEntity(s.id)} className="rounded-xs font-mono text-xs text-fg-1 underline underline-offset-2 hov:text-fg-0">
                  [{s.id}]
                </button>
              );
            }
            return (
              <span key={i} className={`font-mono text-xs ${s.verdict === 'flagged' ? 'text-infect-400 line-through' : 'text-fg-1'}`}>
                [{s.id}]<span className="sr-only"> {s.verdict === 'flagged' ? 'is not an evidence id from this run' : 'was not checked'}</span>
              </span>
            );
          }
          if (s.verdict === 'flagged') {
            return (
              <span key={i}>
                <span className="rounded-xs bg-bg-2 px-1.5 py-0.5 font-mono text-xs text-infect-400 line-through">{s.text}</span>
                <span className="text-xs text-infect-400"> ({NOT_RETURNED})</span>
              </span>
            );
          }
          if (s.verdict === 'plain') {
            return (
              <span key={i} className="rounded-xs bg-bg-2 px-1.5 py-0.5 font-mono text-xs text-fg-1" title="The guard did not check this text">
                {s.text}
                <span className="sr-only"> (not checked)</span>
              </span>
            );
          }
          const n = checks++;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectEntity(s.text)}
              title="Verified against a graph query. Click to highlight its path."
              className="mx-0.5 inline-flex items-center gap-1 rounded-xs bg-bg-2 px-1.5 py-0.5 align-baseline font-mono text-xs text-tier-clean transition-transform duration-(--dur-press) ease-out active:scale-(--press-scale) hov:bg-bg-3"
            >
              <CheckDrawIcon size={14} animate={n < 6} delay={n * 0.04} />
              <span className="text-fg-0">{s.text}</span>
              <span className="sr-only"> (verified)</span>
            </button>
          );
        })}
      </p>
      {guard && (
        <p className="mt-2 text-xs text-fg-2">
          {guard.verified} of {plural(guard.total, 'claim')} traced to a graph query
          {unchecked && '. Grey chips were not checked.'}
        </p>
      )}
      {guard && guard.flagged.length > 0 && (
        <details id={`flagged-claims${idSuffix}`} className="mt-2 text-sm">
          <summary className="inline-flex cursor-pointer items-center rounded-xs text-tier-would-pull">Flagged claims ({guard.flagged.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-fg-1">
            {guard.flagged.map((f, i) => (
              <li key={`${f}-${i}`}>
                <span className="font-mono text-xs text-infect-400 line-through">{f}</span> was {NOT_RETURNED}.
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
