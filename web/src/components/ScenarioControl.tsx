/* ScenarioControl: segmented radiogroup (radius sm): qix, axios, "Describe an alert...".
 * Props: value (ScenarioChoice), onChange (a click or Space: choose it, and re-run what is on screen for it), onMove
 * (an arrow key: the selection moves and nothing else happens: no run, no panel, focus stays in the group), onRun (Enter
 * on a scenario segment runs the triage), running, turnKey (bump it per run: the biohazard turns ONCE when a run starts,
 * never while merely selected).
 * Arrow keys move the selection (roving tabindex), the group is role=radiogroup. Nothing runs on an arrow (WCAG 3.2.2):
 * running is an explicit activation (Enter, a click, the Run button), and "Describe an alert…" is reachable without opening
 * anything until it is activated.
 *
 * Also exported here:
 *   scenarioLabel(id)  "qix Sept 2025" / "axios Mar 2026", for sentences
 *   AlertField props: onRun(text), disabled. Free text, 500 chars max with a counter, label always visible. Takes focus when it opens.
 *   AlertBanner props: text, pulseKey, note. Shown while a free-text alert run is on screen; the shield pulses twice.
 *     `text` is untrusted and rendered as text only. `note` says which clock a run without a time in its text used.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { ScenarioId } from '../data/types.ts';
import { Button } from './Button.tsx';
import { BiohazardIcon } from './icons/BiohazardIcon.tsx';
import { ShieldPulseIcon } from './icons/ShieldPulseIcon.tsx';

export type ScenarioChoice = ScenarioId | 'alert';

// `tail` (the date) is dropped on phones so all three segments fit in 328px without a hidden, clipped third one.
const OPTIONS: { id: ScenarioChoice; label: string; tail?: string }[] = [
  { id: 'qix-2025-09-08', label: 'qix', tail: ' · Sept 2025' },
  { id: 'axios-2026-03-31', label: 'axios', tail: ' · Mar 2026' },
  { id: 'alert', label: 'Describe an alert…' },
];

export const scenarioLabel = (id: ScenarioId): string => {
  const o = OPTIONS.find((x) => x.id === id)!;
  return `${o.label}${o.tail?.replace(' · ', ' ') ?? ''}`;
};

export function ScenarioControl({
  value,
  onChange,
  onMove,
  onRun,
  running,
  turnKey,
}: {
  value: ScenarioChoice;
  onChange: (v: ScenarioChoice) => void;
  onMove: (v: ScenarioChoice) => void;
  onRun: () => void;
  running: boolean;
  turnKey: number;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step) {
      e.preventDefault();
      const next = (i + step + OPTIONS.length) % OPTIONS.length;
      onMove(OPTIONS[next]!.id);
      refs.current[next]?.focus();
    } else if (e.key === 'Enter' && OPTIONS[i]!.id !== 'alert') {
      e.preventDefault(); // the run, not the click a button would also make
      onRun();
    }
  };

  return (
    // 48px tall on phones and touch: the segments inside are 44px.
    <div role="radiogroup" aria-label="Scenario" className="inline-flex h-8 shrink-0 rounded-sm border border-line-2 p-px max-md:h-12 pointer-coarse:h-12">
      {OPTIONS.map((o, i) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => void (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xs px-3 text-sm transition-colors duration-(--dur-fast) ease-out max-sm:gap-1.5 max-sm:px-2.5 hov:bg-bg-3 aria-checked:bg-bg-3 aria-checked:text-fg-0 ${
              selected ? '' : 'text-fg-1'
            }`}
          >
            {o.id !== 'alert' && (
              <span className={selected ? 'text-fg-0' : 'text-fg-2'}>
                <BiohazardIcon size={16} turn={selected && running} turnKey={turnKey} />
              </span>
            )}
            <span>
              {o.label}
              {o.tail && <span className="max-sm:hidden">{o.tail}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const MAX = 500;

export function AlertField({ onRun, disabled }: { onRun: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const ok = text.trim().length > 0 && !disabled;
  useEffect(() => field.current?.focus({ preventScroll: true }), []); // it opens only when activated: the person is about to type
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onRun(text.trim());
      }}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="mb-1 block text-xs text-fg-1">
          Describe the alert
        </label>
        <textarea
          ref={field}
          id={id}
          className="field"
          rows={2}
          maxLength={MAX}
          value={text}
          placeholder="qix compromised, 13:16 UTC"
          onChange={(e) => setText(e.target.value)}
          // Enter runs it, like a search box; Shift+Enter keeps a newline.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) (e.preventDefault(), e.currentTarget.form?.requestSubmit());
          }}
          aria-describedby={`${id}-count`}
        />
        <p id={`${id}-count`} className="mt-1 font-mono text-2xs text-fg-2">
          {text.length}/{MAX}
        </p>
      </div>
      <Button type="submit" variant="primary" disabled={!ok} className="mb-6 self-start sm:self-end">
        Run triage
      </Button>
    </form>
  );
}

export function AlertBanner({ text, pulseKey, note }: { text: string; pulseKey: number; note?: string | null }) {
  return (
    <aside aria-label="Alert" className="flex items-start gap-3 bg-accent-soft px-(--gutter) py-2 text-sm text-fg-0">
      <span className="mt-0.5 shrink-0 text-infect-400">
        <ShieldPulseIcon alert pulseKey={pulseKey} size={20} />
      </span>
      <div className="min-w-0">
        <p className="break-words">
          <span className="font-medium text-infect-400">Alert </span>
          {text}
        </p>
        {note && <p className="mt-0.5 text-fg-1">{note}</p>}
      </div>
    </aside>
  );
}
