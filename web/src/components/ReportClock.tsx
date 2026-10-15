/* ReportClock: says which clock the numbers in the results pane are true at (docs/design.md: every number is
 * time-indexed). A strip above the exec summary; renders nothing when there is nothing to say.
 * Props:
 *   runAt      the clock the triage ran at (Report.at); the path and fix drafts belong to it
 *   viewAt     the clock the table and counts on screen are true at (the last /api/exposure answer, or runAt)
 *   wantAt     the scrubber position when it differs from runAt, else null
 *   loading    a request for wantAt is in flight (shown visually only, so autoplay does not flood a screen reader)
 *   error      the failed request for wantAt: message, fix and request id
 *   guest      a pasted repo: its graph cannot follow the scrubber, so scrubbing offers a re-run instead
 *   head       the pasted repo was read at HEAD: a counterfactual, always labelled
 *   other      the incident id of the report when the scrubber now shows a different incident, else null
 *   onBack(), onRerun(at), onRetry()
 */
import { HEAD_NOTE, utcLabel } from '../data/format.ts';
import { Button } from './Button.tsx';
import { CircleAlert } from './icons/Glyphs.tsx';

export interface ReportClockProps {
  runAt: number;
  viewAt: number;
  wantAt: number | null;
  loading: boolean;
  error: { message: string; fix: string; requestId?: string } | null;
  guest: boolean;
  head: boolean;
  other: string | null;
  onBack: () => void;
  onRerun: (at: number) => void;
  onRetry: () => void;
}

export function ReportClock({ runAt, viewAt, wantAt, loading, error, guest, head, other, onBack, onRerun, onRetry }: ReportClockProps) {
  const notes: string[] = [];
  if (head) notes.push(HEAD_NOTE);
  if (other) notes.push(`This report is for ${other}, run at ${utcLabel(runAt)}. The timeline above is for a different incident, so scrubbing it does not change this table.`);
  if (!notes.length && wantAt === null) return null;

  return (
    <aside aria-label="Report clock" className="flex flex-col gap-2 border-b border-line-1 bg-bg-2 px-3 py-2 text-sm">
      {notes.map((n) => (
        <p key={n} role="note" className="max-w-(--measure) text-fg-1">
          {n === HEAD_NOTE && <span className="mr-2 rounded-xs bg-bg-3 px-1.5 py-0.5 font-mono text-2xs font-medium text-fg-0">COUNTERFACTUAL</span>}
          {n}
        </p>
      ))}
      {wantAt !== null && !other && (
        <div className="flex flex-col gap-2">
          {/* Only the sentence is the live region: the buttons below would make every settled scrub a long announcement. */}
          <div role="status">
            {loading ? (
              <p aria-hidden className="font-mono text-xs text-fg-1">
                Updating to {utcLabel(wantAt)}&hellip; showing {utcLabel(viewAt)} meanwhile
              </p>
            ) : error ? (
              <div className="flex flex-col gap-1">
                <p className="flex items-start gap-2 text-infect-400">
                  <CircleAlert size={16} className="mt-0.5 shrink-0" />
                  Could not load exposure at {utcLabel(wantAt)}: {error.message}
                </p>
                <p className="text-fg-1">{error.fix}</p>
                {error.requestId && <p className="font-mono text-xs text-fg-2">request <span className="select-all text-fg-1">{error.requestId}</span></p>}
              </div>
            ) : guest ? (
              <p className="max-w-(--measure) text-fg-1">
                A pasted repo is analysed at one clock. The table stays at {utcLabel(runAt)} while the timeline shows {utcLabel(wantAt)}.
              </p>
            ) : (
              <p className="max-w-(--measure) text-fg-1">
                Showing exposure at <span className="font-mono text-xs text-fg-0">{utcLabel(viewAt)}</span>. Paths and fix drafts belong to the triage run at {utcLabel(runAt)}.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {error && !guest && <Button onClick={onRetry}>Retry</Button>}
            <Button onClick={onBack}>Back to {utcLabel(runAt)}</Button>
            <Button onClick={() => onRerun(wantAt)}>Run triage at {utcLabel(wantAt)}</Button>
          </div>
        </div>
      )}
    </aside>
  );
}
