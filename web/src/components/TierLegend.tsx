/* TierLegend: the "?" beside the band's counts. What LOCKED, WOULD_PULL, MAINTAINER and "OSV advisories" mean, as real
 * text in a popover, from the first paint (the table's own "?" only exists after a triage). A button, so keyboard, touch
 * and screen-reader users get it as well as pointers; Esc, a tap outside or leaving it closes the popover and Esc returns
 * focus here. The words are TierChip's own (TIER_SUBTITLE), so the band, the table and the drawer never define a tier two ways.
 * Props (optional, to control it from outside: the band opens it when a count is tapped): open, onOpenChange(open).
 * Elements marked data-legend-trigger (the counts) do not count as "outside".
 * The popover opens below the "?" where it fits, above it where it does not (the phone's fixed tab bar at 320x640). When
 * neither side has the room (a phone held sideways), it sits beside the "?" in the window's free height, whole: it was capped
 * there, its last line cut with no sign that it scrolled. Only a window too short for the whole key gets a scrolling one.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { TIER_SUBTITLE, TierChip } from './TierChip.tsx';

export const OSV_MEANING = 'The open vulnerability database. A scanner can only flag what already has an OSV record.';

type Place = { up: boolean; max: number | null; at?: { top: number; left: number } };
/** Where the popover goes: below the "?" when it fits above the phone's fixed tab bar (and the window's edge), else above it,
 * else beside it (left of it, or right when there is no room on the left), centred on it within the free height. */
function placement(button: DOMRect, height: number, width: number): Place {
  const bar = document.querySelector<HTMLElement>('nav[aria-label="Panels"]');
  const barTop = bar && getComputedStyle(bar).display !== 'none' && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().top : innerHeight;
  const floor = Math.min(innerHeight, barTop);
  const below = floor - button.bottom - 8;
  const above = button.top - 8;
  if (height <= below) return { up: false, max: null };
  if (height <= above) return { up: true, max: null };
  const room = floor - 16;
  const h = Math.min(height, room);
  const top = Math.min(Math.max(8, button.top + button.height / 2 - h / 2), floor - 8 - h);
  const left = button.left - 8 - width >= 8 ? button.left - 8 - width : Math.min(button.right + 8, innerWidth - 8 - width);
  return { up: false, max: height > room ? room : null, at: { top, left: Math.max(8, left) } };
}

export function TierLegend({ open: openProp, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInner(o));
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLDListElement>(null);
  const [place, setPlace] = useState<Place>({ up: false, max: null });
  // Measured before paint, so it never shows under the tab bar first (320x640, a phone held sideways).
  useLayoutEffect(() => {
    if (!open || !button.current || !pop.current) return setPlace({ up: false, max: null });
    setPlace(placement(button.current.getBoundingClientRect(), pop.current.scrollHeight, pop.current.offsetWidth));
  }, [open]);
  // a tap outside closes it (iOS does not blur a button on a tap elsewhere)
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t && !root.current?.contains(t) && !t.closest('[data-legend-trigger]')) setOpen(false);
    };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [open]);
  return (
    <span
      ref={root}
      className="relative inline-flex shrink-0"
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false);
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
        onClick={() => setOpen(!open)}
        className="group inline-flex size-6 items-center justify-center rounded-full pointer-coarse:-m-2.5 pointer-coarse:size-11 hov:bg-bg-3"
      >
        {/* the circle stays 24px; the button around it is the 44px touch target, grown into its margin so the counts keep their room */}
        <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full border border-line-3 text-xs font-medium text-fg-1 group-aria-expanded:border-fg-0 group-aria-expanded:text-fg-0">
          ?
        </span>
        <span className="sr-only">What the tiers and OSV mean</span>
      </button>
      {open && (
        <dl
          ref={pop}
          id={id}
          tabIndex={place.max !== null ? 0 : undefined} // capped and scrollable: the keyboard can scroll it too
          style={{ ...(place.max !== null && { maxHeight: place.max }), ...(place.at && { position: 'fixed', top: place.at.top, left: place.at.left, right: 'auto', margin: 0 }) }}
          // A phone held sideways (under 500px tall): 320px wide and a step tighter, so the whole key is shorter than the window
          className={`absolute right-0 z-(--z-dropdown) flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto rounded-sm bg-bg-2 p-3 text-left text-xs shadow-popover [@media(max-height:500px)]:w-80 [@media(max-height:500px)]:gap-1.5 [@media(max-height:500px)]:p-2 ${place.up ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {(['LOCKED', 'WOULD_PULL', 'MAINTAINER'] as const).map((t) => (
            <div key={t} className="flex flex-col items-start gap-1 [@media(max-height:500px)]:gap-0.5">
              <dt>
                <TierChip tier={t} define={false} />
              </dt>
              <dd className="text-fg-0">{TIER_SUBTITLE[t]}</dd>
            </div>
          ))}
          <div className="flex flex-col items-start gap-1 [@media(max-height:500px)]:gap-0.5">
            <dt className="font-mono text-2xs font-medium text-fg-1">OSV advisories</dt>
            <dd className="text-fg-0">{OSV_MEANING}</dd>
          </div>
        </dl>
      )}
    </span>
  );
}
