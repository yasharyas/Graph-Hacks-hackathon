/* ScenarioControl: segmented radiogroup (radius sm): qix, axios, "Describe an alert...".
 * Props: value (ScenarioChoice), onChange, onRun (Enter on a scenario segment runs the triage), running,
 * turnKey (bump it per run: the biohazard turns ONCE when a run starts, never while merely selected).
 * Arrow keys move the selection (roving tabindex), the group is role=radiogroup.
 *
 * Also exported here:
 *   AlertField props: onRun(text), disabled. Free text, 500 chars max with a counter, label always visible.
 *   AlertBanner props: text, pulseKey. Shown while a free-text alert run is on screen; the shield pulses twice.
 *     `text` is untrusted and rendered as text only.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { ScenarioId } from '../data/types.ts';
import { Button } from './Button.tsx';
import { BiohazardIcon } from './icons/BiohazardIcon.tsx';
import { ShieldPulseIcon } from './icons/ShieldPulseIcon.tsx';

export type ScenarioChoice = ScenarioId | 'alert';

const OPTIONS: { id: ScenarioChoice; label: string }[] = [
  { id: 'qix-2025-09-08', label: 'qix · Sept 2025' },
  { id: 'axios-2026-03-31', label: 'axios · Mar 2026' },
  { id: 'alert', label: 'Describe an alert…' },
];

export function ScenarioControl({
  value,
  onChange,
  onRun,
  running,
  turnKey,
}: {
  value: ScenarioChoice;
  onChange: (v: ScenarioChoice) => void;
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
      onChange(OPTIONS[next]!.id);
      refs.current[next]?.focus();
    } else if (e.key === 'Enter' && OPTIONS[i]!.id !== 'alert') {
      onRun();
    }
  };

  return (
    <div role="radiogroup" aria-label="Scenario" className="inline-flex h-8 shrink-0 rounded-sm border border-line-2 p-px pointer-coarse:h-11">
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
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xs px-3 text-sm transition-colors duration-(--dur-fast) ease-out hov:bg-bg-3 aria-checked:bg-bg-3 aria-checked:text-fg-0 ${
              selected ? '' : 'text-fg-1'
            }`}
          >
            {o.id !== 'alert' && (
              <span className={selected ? 'text-infect-400' : 'text-fg-2'}>
                <BiohazardIcon size={16} turn={selected && running} turnKey={turnKey} />
              </span>
            )}
            {o.label}
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
  const ok = text.trim().length > 0 && !disabled;
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
          id={id}
          className="field"
          rows={2}
          maxLength={MAX}
          value={text}
          placeholder="qix compromised, 13:16 UTC"
          onChange={(e) => setText(e.target.value)}
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

export function AlertBanner({ text, pulseKey }: { text: string; pulseKey: number }) {
  return (
    <aside aria-label="Alert" className="flex items-start gap-3 bg-accent-soft px-(--gutter) py-2 text-sm text-fg-0">
      <span className="mt-0.5 shrink-0 text-infect-400">
        <ShieldPulseIcon alert pulseKey={pulseKey} size={20} />
      </span>
      <p className="min-w-0 break-words">
        <span className="font-medium text-infect-400">Alert </span>
        {text}
      </p>
    </aside>
  );
}
