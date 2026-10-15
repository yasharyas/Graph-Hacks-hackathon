/* Toasts: call toast() from anywhere (no provider, no hook); mount <Toasts /> once in App.
 * toast({ message, tone?: 'info' | 'success' | 'error', action?: { label, onClick }, ms? }) returns the id;
 * dismissToast(id) removes it. Defaults: 4 s, 10 s when an action (Undo) is attached.
 * Never covers the Ask input or the focused element (WCAG 2.4.11): from 1024px the stack sits bottom-right, above the
 * footer (the Ask bar is pinned in the left pane); below it, bottom-left above the fixed Ask bar and the tab bar. If the
 * focused element would still be under it, it moves to the top. Never steals focus, announced politely. Timers pause on
 * hover, while the toast holds focus and while the tab is hidden; Esc dismisses the newest (its Dismiss is far down the tab
 * order). Dismiss is 44x44 on touch. Errors are neutral, never infection red.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CircleAlert, Close } from './icons/Glyphs.tsx';
import { motionTokens } from './icons/motionTokens.ts';

export interface ToastInput {
  message: string;
  tone?: 'info' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
  ms?: number;
}
interface ToastItem extends ToastInput {
  id: number;
  tone: NonNullable<ToastInput['tone']>;
  ms: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: ToastInput): number {
  const item: ToastItem = { ...t, id: nextId++, tone: t.tone ?? 'info', ms: t.ms ?? (t.action ? 10_000 : 4_000) };
  items = [...items, item].slice(-3);
  emit();
  return item.id;
}
export function dismissToast(id: number): void {
  items = items.filter((i) => i.id !== id);
  emit();
}

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

function ToastView({ item }: { item: ToastItem }) {
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden);
  const left = useRef(item.ms);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (hover || focused || hidden) return;
    const t0 = performance.now();
    const timer = setTimeout(() => dismissToast(item.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current -= performance.now() - t0;
    };
  }, [hover, focused, hidden, item.id]);

  const Icon = item.tone === 'success' ? Check : CircleAlert;
  // red means infected here: a failed copy or save is neutral (fg-0 on the dark toast), only success is tinted
  const iconColor = item.tone === 'success' ? 'text-tier-clean' : item.tone === 'error' ? 'text-fg-0' : 'text-fg-1';
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: motionTokens().easeOut } }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-sm bg-bg-2 p-3 text-sm shadow-popover"
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${iconColor}`} />
      <span className="min-w-0 flex-1 break-words text-fg-0">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="shrink-0 rounded-xs px-1 font-medium text-link underline underline-offset-2 pointer-coarse:min-h-11 pointer-coarse:px-2"
          onClick={() => {
            item.action!.onClick();
            dismissToast(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      {/* 16px icon, 44x44 on touch: the padding grows into the toast's own (negative margin), so nothing moves */}
      <button type="button" aria-label="Dismiss notification" className="shrink-0 rounded-xs text-fg-2 pointer-coarse:-m-3.5 pointer-coarse:p-3.5" onClick={() => dismissToast(item.id)}>
        <Close size={16} />
      </button>
    </motion.li>
  );
}

const GAP = 8;
const overlaps = (a: DOMRect, b: { top: number; bottom: number; left: number; right: number }) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
/** Top edge of a bar fixed to the bottom of the screen (the phone's Ask bar or tab bar), or null when there is none. */
const fixedBarTop = (el: Element | null): number | null => {
  if (!el || getComputedStyle(el).position !== 'fixed') return null;
  const r = el.getBoundingClientRect();
  return r.height > 0 ? r.top : null;
};

export function Toasts() {
  const list = useSyncExternalStore(subscribe, () => items);
  const ref = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ left: 16, bottom: 16 });

  // Where the stack goes: clear of the fixed bars and of whatever has keyboard focus.
  const place = useCallback(() => {
    const ul = ref.current;
    if (!ul) return;
    const wide = matchMedia('(min-width: 1024px)').matches;
    const bars = [fixedBarTop(document.getElementById('ask')), fixedBarTop(document.querySelector('nav[aria-label="Panels"]'))].filter((t): t is number => t !== null);
    const footer = wide ? document.querySelector('body footer')?.getBoundingClientRect().top : undefined;
    const floor = Math.min(innerHeight, ...bars, ...(footer !== undefined && footer > 0 && footer < innerHeight ? [footer] : []));
    const bottom = Math.max(16, innerHeight - floor + GAP);
    const w = ul.offsetWidth;
    const h = ul.offsetHeight;
    const x = wide ? { left: innerWidth - 16 - w, right: innerWidth - 16 } : { left: 16, right: 16 + w };
    const side = wide ? { right: 16 } : { left: 16 };
    const f = document.activeElement;
    const covered = h > 0 && f instanceof HTMLElement && f !== document.body && !ul.contains(f) && overlaps(f.getBoundingClientRect(), { ...x, top: innerHeight - bottom - h, bottom: innerHeight - bottom });
    const header = document.querySelector('body header')?.getBoundingClientRect().bottom ?? 0;
    const next: CSSProperties = covered ? { ...side, top: Math.max(GAP, header + GAP) } : { ...side, bottom };
    setPos((p) => (JSON.stringify(p) === JSON.stringify(next) ? p : next));
  }, []);
  useLayoutEffect(place, [list, place]);
  useEffect(() => {
    if (!list.length) return;
    const on = () => place();
    const esc = (e: KeyboardEvent) => {
      // Esc dismisses the newest toast, unless a dialog or popover is taking it (they stop it before it gets here)
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) dismissToast(items.at(-1)!.id);
    };
    document.addEventListener('focusin', on);
    document.addEventListener('keydown', esc);
    addEventListener('resize', on);
    addEventListener('scroll', on, true);
    return () => {
      document.removeEventListener('focusin', on);
      document.removeEventListener('keydown', esc);
      removeEventListener('resize', on);
      removeEventListener('scroll', on, true);
    };
  }, [list.length, place]);

  return (
    <ul ref={ref} aria-live="polite" style={pos} className="pointer-events-none fixed z-(--z-toast) flex w-[min(320px,calc(100vw-32px))] flex-col gap-2">
      <AnimatePresence>
        {list.map((item) => (
          <ToastView key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
