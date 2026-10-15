/* PasteBox: analyze a public GitHub repo URL, or a package-lock.json dropped, chosen or pasted (docs/design.md
 * section 5).
 * Props:
 *   analyze   AnalyzeState from useAnalyze() (status, stage, repo, error), drives progress and errors
 *   onAnalyze({ url } | { lockfile })   called only after client-side validation passes
 *   onClose
 * States: idle, dragover (dashed outline), invalid URL (inline error, button disabled), unsupported (yarn / pnpm /
 * lockfile v1, too large: the server's own words + "try a sample repo"), rate-limited (429, 20 s countdown),
 * analyzing (fetch -> parse -> write -> enrich -> admits, announced politely on stage change only).
 * Server-side validation (S1) is authoritative; the client checks only save a round trip (data/lockfile.ts).
 */
import { useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { fixFor } from '../data/errors.ts';
import { lockfileProblem, looksLikeLockfile, MAX_LOCKFILE_BYTES, TOO_BIG } from '../data/lockfile.ts';
import type { AnalyzeState } from '../data/useAnalyze.ts';
import { Button } from './Button.tsx';
import { Check, CircleAlert, Close, Upload } from './icons/Glyphs.tsx';

const URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}\/?$/;
const STAGES = [
  { id: 'fetch', label: 'Fetch lockfile' },
  { id: 'parse', label: 'Parse' },
  { id: 'write', label: 'Write graph' },
  { id: 'enrich', label: 'Enrich' },
  { id: 'admits', label: 'Check ranges' },
] as const;
const SAMPLES = ['mochajs/mocha', 'remy/nodemon'];

export type PasteRequest = { url: string } | { lockfile: string };

export function PasteBox({
  analyze,
  onAnalyze,
  onClose,
}: {
  analyze: AnalyzeState;
  onAnalyze: (req: PasteRequest) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);
  const [local, setLocal] = useState<string | null>(null); // a problem found before any request
  const [kind, setKind] = useState<'url' | 'lockfile'>('url');
  const [drag, setDrag] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const running = analyze.status === 'running';
  const valid = URL_RE.test(url.trim());
  const urlError = touched && url.trim() && !valid ? 'Use a public repo URL like https://github.com/owner/name' : null;

  // 429: one analysis per 20 s, with a visible countdown.
  const rateLimited = analyze.status === 'error' && analyze.error?.status === 429;
  useEffect(() => {
    if (!rateLimited) return;
    setRetryIn(20);
    const t = setInterval(() => setRetryIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [rateLimited]);
  const blocked = running || retryIn > 0;

  const submit = (req: PasteRequest) => {
    setLocal(null);
    setKind('url' in req ? 'url' : 'lockfile');
    onAnalyze(req);
  };
  const submitLockfile = (name: string, text: string, bytes?: number) => {
    const problem = lockfileProblem(name, text, bytes);
    if (problem) setLocal(problem);
    else submit({ lockfile: text });
  };
  async function readFile(file: File) {
    if (file.size > MAX_LOCKFILE_BYTES) return setLocal(TOO_BIG); // never read a huge file into memory
    submitLockfile(file.name, await file.text(), file.size);
  }
  const trySample = (repo: string) => {
    setUrl(`https://github.com/${repo}`);
    setTouched(true);
    if (!blocked) submit({ url: `https://github.com/${repo}` });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file && !blocked) void readFile(file);
  };
  // A multi-line paste is a lockfile, not a URL: take it instead of letting the one-line field flatten it.
  const onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!looksLikeLockfile(text)) return;
    e.preventDefault();
    if (!blocked) submitLockfile('pasted lockfile', text);
  };

  const step = analyze.stage ? STAGES.findIndex((s) => s.id === analyze.stage!.stage) : -1;
  const stages = kind === 'url' ? STAGES : STAGES.slice(1); // a pasted lockfile has nothing to fetch
  const at = stages.findIndex((s) => s.id === analyze.stage?.stage);
  const progress = analyze.stage ? (at + analyze.stage.done / Math.max(1, analyze.stage.total)) / stages.length : 0;
  const error = local ? { message: local, fix: '' } : analyze.status === 'error' && analyze.error ? { ...analyze.error, fix: fixFor(analyze.error, 'analyze') } : null;

  return (
    <section
      id="paste-panel"
      aria-label="Analyze your own repo"
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onPaste={onPaste}
      className={`border-b border-line-1 bg-bg-1 px-(--gutter) py-4 ${drag ? 'outline-2 -outline-offset-4 outline-dashed outline-fg-0' : ''}`}
    >
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !blocked) submit({ url: url.trim() });
        }}
      >
        <div className="min-w-0 flex-1 sm:max-w-xl">
          <label htmlFor={id} className="mb-1 block text-xs text-fg-1">
            GitHub repo URL
          </label>
          <input
            id={id}
            className="field"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoFocus
            value={url}
            placeholder="https://github.com/owner/name"
            aria-invalid={urlError ? true : undefined}
            aria-describedby={`${id}-help`}
            onChange={(e) => (setUrl(e.target.value), setLocal(null))}
            onBlur={() => setTouched(true)}
          />
        </div>
        <Button type="submit" variant="primary" loading={running} disabled={!valid || retryIn > 0}>
          {retryIn > 0 ? `Retry in ${retryIn} s` : 'Analyze'}
        </Button>
        <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()} disabled={blocked}>
          Choose package-lock.json
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label="package-lock.json file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = '';
          }}
        />
        <Button variant="ghost" className="sm:ml-auto" aria-label="Close" onClick={onClose}>
          <Close size={16} /> Close
        </Button>
      </form>

      <p id={`${id}-help`} className="mt-2 max-w-xl text-xs text-fg-2">
        Or paste or drop a package-lock.json on this panel. Public repos only; nothing is stored beyond one hour. If no pre-incident snapshot exists, the
        current lockfile is used and labelled as such.
      </p>

      {urlError && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-infect-400">
          <CircleAlert size={16} className="shrink-0" /> {urlError}
        </p>
      )}
      {error && (
        <div role="alert" className="mt-2 flex flex-col gap-1.5 text-sm">
          <p className="flex max-w-xl items-start gap-2 text-infect-400">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            {error.message}
          </p>
          {error.fix && <p className="max-w-xl text-fg-1">{error.fix}</p>}
          {'requestId' in error && error.requestId && (
            <p className="font-mono text-xs text-fg-2">
              request <span className="select-all text-fg-1">{error.requestId}</span>
            </p>
          )}
          <p className="flex flex-wrap items-center gap-2 text-fg-1">
            Try a sample repo:
            {SAMPLES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={blocked}
                className="min-h-(--control-h) rounded-xs bg-bg-2 px-2 font-mono text-xs text-link disabled:opacity-(--opacity-disabled)"
                onClick={() => trySample(s)}
              >
                {s}
              </button>
            ))}
          </p>
        </div>
      )}
      {running && (
        <div className="mt-3 max-w-xl">
          <div className="h-1 overflow-hidden rounded-xs bg-bg-3" aria-hidden>
            <div className="h-full origin-left bg-fg-0 transition-transform duration-(--dur-base) ease-out" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {stages.map((s) => {
              const state = at < 0 ? 'todo' : stages.indexOf(s) < at ? 'done' : stages.indexOf(s) === at ? 'now' : 'todo';
              return (
                <li key={s.id} aria-current={state === 'now' ? 'step' : undefined} className={`inline-flex items-center gap-1 ${state === 'now' ? 'text-fg-0' : state === 'done' ? 'text-tier-clean' : 'text-fg-2'}`}>
                  {state === 'done' ? <Check size={12} /> : <span aria-hidden className={`size-1.5 rounded-full ${state === 'now' ? 'bg-fg-0' : 'bg-line-3'}`} />}
                  {s.label}
                </li>
              );
            })}
          </ol>
          {/* announced on stage changes only: the counter is aria-hidden */}
          <p role="status" className="mt-1 font-mono text-xs text-fg-1">
            {step < 0 ? 'Starting' : `Step ${at + 1} of ${stages.length}: ${STAGES[step]!.label.toLowerCase()}`}
          </p>
        </div>
      )}
    </section>
  );
}
