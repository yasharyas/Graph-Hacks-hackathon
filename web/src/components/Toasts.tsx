/* Toasts: call toast() from anywhere (no provider, no hook); mount <Toasts /> once in App.
 * toast({ message, tone?: 'info' | 'success' | 'error', action?: { label, onClick }, ms? }) returns the id;
 * dismissToast(id) removes it. Defaults: 4 s, 10 s when an action (Undo) is attached.
 * Bottom-left, above the tab bar on mobile, never steals focus, announced politely. Timers pause on hover and
 * while the tab is hidden.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden);
  const left = useRef(item.ms);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (hover || hidden) return;
    const t0 = performance.now();
    const timer = setTimeout(() => dismissToast(item.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current -= performance.now() - t0;
    };
  }, [hover, hidden, item.id]);

  const Icon = item.tone === 'success' ? Check : CircleAlert;
  const iconColor = item.tone === 'success' ? 'text-tier-clean' : item.tone === 'error' ? 'text-infect-400' : 'text-fg-1';
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: motionTokens().easeOut } }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-sm bg-bg-2 p-3 text-sm shadow-popover"
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${iconColor}`} />
      <span className="min-w-0 flex-1 break-words text-fg-0">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="shrink-0 rounded-xs px-1 font-medium text-link underline underline-offset-2"
          onClick={() => {
            item.action!.onClick();
            dismissToast(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss" className="shrink-0 text-fg-2" onClick={() => dismissToast(item.id)}>
        <Close size={16} />
      </button>
    </motion.li>
  );
}

export function Toasts() {
  const list = useSyncExternalStore(subscribe, () => items);
  return (
    <ul
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(var(--tabbar-h)+8px)] left-4 z-(--z-toast) flex w-[min(320px,calc(100vw-32px))] flex-col gap-2 lg:bottom-4"
    >
      <AnimatePresence>
        {list.map((item) => (
          <ToastView key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
