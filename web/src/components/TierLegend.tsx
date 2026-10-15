/* TierLegend: the "?" beside the band's counts. What LOCKED, WOULD_PULL, MAINTAINER and "OSV advisories" mean, as real
 * text in a popover, from the first paint (the table's own "?" only exists after a triage). A button, so keyboard, touch
 * and screen-reader users get it as well as pointers; Esc or leaving it closes the popover and Esc returns focus here.
 * The words are TierChip's own (TIER_SUBTITLE), so the band, the table and the drawer never define a tier two ways.
 */
import { useId, useRef, useState } from 'react';
import { TIER_SUBTITLE, TierChip } from './TierChip.tsx';

export const OSV_MEANING = 'The open vulnerability database. A scanner can only flag what already has an OSV record.';

export function TierLegend() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  return (
    <span
      className="relative inline-flex shrink-0"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex size-6 items-center justify-center rounded-full pointer-coarse:size-11 hov:bg-bg-3"
      >
        {/* the circle stays 24px; the button around it is the 44px touch target */}
        <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full border border-line-3 text-xs font-medium text-fg-1 group-aria-expanded:border-fg-0 group-aria-expanded:text-fg-0">
          ?
        </span>
        <span className="sr-only">What the tiers and OSV mean</span>
      </button>
      {open && (
        <dl id={id} className="absolute top-full right-0 z-(--z-dropdown) mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-sm bg-bg-2 p-3 text-left text-xs shadow-popover">
          {(['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as const).map((t) => (
            <div key={t} className="flex flex-col items-start gap-1">
              <dt>
                <TierChip tier={t} />
              </dt>
              <dd className="text-fg-0">{TIER_SUBTITLE[t]}</dd>
            </div>
          ))}
          <div className="flex flex-col items-start gap-1">
            <dt className="font-mono text-2xs font-medium text-fg-1">OSV advisories</dt>
            <dd className="text-fg-0">{OSV_MEANING}</dd>
          </div>
        </dl>
      )}
    </span>
  );
}
