/* PasteBox: analyze a public GitHub repo, or a package-lock.json pasted, dropped or chosen (docs/design.md section 5).
 * Props:
 *   analyze   AnalyzeState from useAnalyze() (status, stage, repo, error), drives progress and errors
 *   onAnalyze({ url } | { lockfile })   called only after client-side checks pass
 *   onClose   also called by Escape inside the panel
 * Never silent: every input that cannot be analysed gets a sentence in a role=alert next to the field, the field is
 * aria-invalid, and the Analyze buttons stay enabled so pressing one says why (data/lockfile.ts decides the wording).
 *   Repo      owner/name, github.com/owner/name, ssh and .git clones and /tree/... pages all become
 *             https://github.com/owner/name (shown before it is sent); other hosts get a plain error.
 *   Lockfile  a visible paste area (a paste into the repo field lands there too), a file chooser, or a drop anywhere on
 *             the panel. "Parsed N packages" confirms what was read. yarn / pnpm / package.json / v1 each get their own
 *             diagnosis and the npm command that produces a usable file.
 * States: idle, dragover (dashed outline), invalid (inline, per field), unsupported / too big (the same words),
 * rate-limited (429, 20 s countdown), analyzing (fetch -> parse -> write -> enrich -> admits, announced politely on
 * stage change only). Server-side validation (S1) is authoritative; the client checks only explain and save a round trip.
 */
import { useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { fixFor, plainError } from '../data/errors.ts';
import { inspectLockfile, looksLikeLockfile, MAX_LOCKFILE_BYTES, repoFromInput, TOO_BIG } from '../data/lockfile.ts';
import type { AnalyzeState } from '../data/useAnalyze.ts';
import { Button } from './Button.tsx';
import { Check, CircleAlert, Close, Upload } from './icons/Glyphs.tsx';

const STAGES = [
  { id: 'fetch', label: 'Fetch lockfile' },
  { id: 'parse', label: 'Parse' },
  { id: 'write', label: 'Write graph' },
  { id: 'enrich', label: 'Enrich' },
  { id: 'admits', label: 'Check ranges' },
] as const;
const SAMPLES = ['mochajs/mocha', 'remy/nodemon'];
const SHOW_MAX = 20_000; // a bigger lockfile is analysed but not put into a textarea: nobody reads it there and it would freeze the page

export type PasteRequest = { url: string } | { lockfile: string };

const Problem = ({ id, children }: { id: string; children: string }) => (
  <p id={id} role="alert" className="mt-1.5 flex max-w-xl items-start gap-2 text-sm text-fg-0">
    <CircleAlert size={16} className="mt-0.5 shrink-0 text-fg-1" />
    {children}
  </p>
);

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
  const [urlTouched, setUrlTouched] = useState(false);
  const [lock, setLock] = useState('');
  const [lockTouched, setLockTouched] = useState(false);
  const [fileProblem, setFileProblem] = useState<string | null>(null); // a dropped or chosen file that never reached the field
  const [taken, setTaken] = useState<{ packages: number; version: number | null } | null>(null); // what was last read whole (file, drop, paste): "Parsed N packages"
  const [kind, setKind] = useState<'url' | 'lockfile'>('url');
  const [drag, setDrag] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const lockRef = useRef<HTMLTextAreaElement>(null);

  const running = analyze.status === 'running';

  // 429: one analysis per 20 s, with a visible countdown.
  const rateLimited = analyze.status === 'error' && analyze.error?.status === 429;
  useEffect(() => {
    if (!rateLimited) return;
    setRetryIn(20);
    const t = setInterval(() => setRetryIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [rateLimited]);
  const blocked = running || retryIn > 0;

  const repo = repoFromInput(url);
  const urlError = urlTouched && 'error' in repo ? repo.error : null;
  const urlNote = !urlError && url.trim() && 'url' in repo && repo.url !== url.trim() ? repo.url : null;
  const check = useMemo(() => (lock.trim() ? inspectLockfile('pasted lockfile', lock) : null), [lock]);
  const lockError = lockTouched ? (check?.problem ?? null) : null;
  const ok = check && !check.problem ? check : lock.trim() ? null : taken; // an emptied field has nothing parsed

  const submit = (req: PasteRequest) => {
    setFileProblem(null);
    setKind('url' in req ? 'url' : 'lockfile');
    onAnalyze(req);
  };
  const analyzeRepo = () => {
    setUrlTouched(true);
    if ('url' in repo) submit({ url: repo.url });
    else urlRef.current?.focus();
  };
  const analyzeLock = (text = lock) => {
    setLockTouched(true);
    const c = inspectLockfile('pasted lockfile', text);
    if (c.problem) return lockRef.current?.focus();
    setTaken(c);
    submit({ lockfile: text });
  };
  /** A lockfile that arrived whole (a file, a drop, a paste into the repo field): put it where it can be seen, then analyze it. */
  const take = (name: string, text: string, bytes?: number) => {
    const c = inspectLockfile(name, text, bytes);
    setLockTouched(true);
    if (c.problem) {
      if (c.problem !== TOO_BIG && text.length <= SHOW_MAX) setLock(text); // show what was taken so the problem has something to point at
      return setFileProblem(c.problem);
    }
    setLock(text.length <= SHOW_MAX ? text : '');
    setFileProblem(null);
    setTaken(c);
    submit({ lockfile: text });
  };
  async function readFile(file: File) {
    if (file.size > MAX_LOCKFILE_BYTES) return setFileProblem(TOO_BIG); // never read a huge file into memory
    take(file.name, await file.text(), file.size);
  }
  const trySample = (name: string) => {
    setUrl(name);
    setUrlTouched(true);
    if (!blocked) submit({ url: `https://github.com/${name}` });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file && !blocked) void readFile(file);
  };
  // A pasted file is analysed as it lands (like a dropped one); typing or editing waits for the button.
  const onPasteLock = (e: ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text.trim().length < 2) return;
    e.preventDefault();
    if (!blocked) take('pasted lockfile', text);
  };
  // A multi-line paste into the one-line repo field is a lockfile: take it instead of letting the field flatten it.
  const onPasteUrl = (e: ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!looksLikeLockfile(text)) return;
    e.preventDefault();
    if (!blocked) take('pasted lockfile', text);
  };

  const step = analyze.stage ? STAGES.findIndex((s) => s.id === analyze.stage!.stage) : -1;
  const stages = kind === 'url' ? STAGES : STAGES.slice(1); // a pasted lockfile has nothing to fetch
  const at = stages.findIndex((s) => s.id === analyze.stage?.stage);
  const progress = analyze.stage ? (at + analyze.stage.done / Math.max(1, analyze.stage.total)) / stages.length : 0;
  const serverError = analyze.status === 'error' && analyze.error ? { ...analyze.error, message: plainError(analyze.error), fix: fixFor(analyze.error, 'analyze') } : null;
  const shownLockError = fileProblem ?? lockError;

  return (
    <section
      id="paste-panel"
      aria-label="Analyze your own repo"
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className={`border-b border-line-1 bg-bg-1 px-(--gutter) py-4 ${drag ? 'outline-2 -outline-offset-4 outline-dashed outline-fg-0' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium text-fg-0">Analyze your own repo</h2>
        <Button variant="ghost" className="-mr-2" onClick={onClose}>
          <Close size={16} /> Close
        </Button>
      </div>
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!blocked) analyzeRepo();
          }}
        >
          <label htmlFor={`${id}-url`} className="mb-1 block text-xs text-fg-1">
            GitHub repo
          </label>
          <div className="flex gap-2">
            <input
              ref={urlRef}
              id={`${id}-url`}
              className="field aria-invalid:border-fg-0"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              value={url}
              placeholder="owner/name or github.com/owner/name"
              aria-invalid={urlError ? true : undefined}
              aria-describedby={`${id}-url-help${urlError ? ` ${id}-url-err` : ''}`}
              onChange={(e) => (setUrl(e.target.value), e.target.value.trim() || setUrlTouched(false))}
              onPaste={onPasteUrl}
              onBlur={() => url.trim() && setUrlTouched(true)}
            />
            <Button type="submit" variant="primary" loading={running && kind === 'url'} disabled={blocked}>
              {retryIn > 0 ? `Retry in ${retryIn} s` : 'Analyze'}
            </Button>
          </div>
          <p id={`${id}-url-help`} className="mt-1.5 max-w-xl text-xs text-fg-2">
            {urlNote ? (
              <>
                Will analyze <span className="font-mono text-fg-1">{urlNote}</span>.{' '}
              </>
            ) : null}
            Public repos only; nothing is stored beyond one hour. If no pre-incident snapshot exists, the current lockfile is used and labelled as such.
          </p>
          {urlError && <Problem id={`${id}-url-err`}>{urlError}</Problem>}
        </form>

        <div>
          <label htmlFor={`${id}-lock`} className="mb-1 block text-xs text-fg-1">
            Or paste a package-lock.json, or drop the file anywhere on this panel
          </label>
          <textarea
            ref={lockRef}
            id={`${id}-lock`}
            className="field h-24 resize-y font-mono text-xs aria-invalid:border-fg-0"
            rows={4}
            spellCheck={false}
            value={lock}
            placeholder={'{ "lockfileVersion": 3, "packages": { ... } }'}
            aria-invalid={shownLockError ? true : undefined}
            aria-describedby={shownLockError ? `${id}-lock-err` : ok ? `${id}-lock-ok` : undefined}
            onFocus={() => url.trim() || setUrlTouched(false)} // an empty repo field is not an error while the lockfile is being filled in
            onChange={(e) => (setLock(e.target.value), setFileProblem(null))}
            onPaste={onPasteLock}
            onBlur={() => lock.trim() && setLockTouched(true)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button loading={running && kind === 'lockfile'} disabled={blocked || !lock.trim()} onClick={() => analyzeLock()}>
              Analyze lockfile
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
          </div>
          {ok && !shownLockError && (
            <p id={`${id}-lock-ok`} role="status" className="mt-1.5 flex items-center gap-1.5 text-sm text-fg-0">
              <Check size={14} className="text-tier-clean" />
              Parsed {ok.packages.toLocaleString('en-US')} package{ok.packages === 1 ? '' : 's'} (lockfileVersion {ok.version}).
            </p>
          )}
          {shownLockError && <Problem id={`${id}-lock-err`}>{shownLockError}</Problem>}
        </div>
      </div>

      {(serverError || running) && (
        <div className="mt-3 min-w-0">
          {serverError && (
            <div role="alert" className="flex flex-col gap-1.5 text-sm">
              <p className="flex max-w-xl items-start gap-2 text-fg-0">
                <CircleAlert size={16} className="mt-0.5 shrink-0 text-fg-1" />
                {serverError.message}
              </p>
              {serverError.fix && <p className="max-w-xl text-fg-1">{serverError.fix}</p>}
              {serverError.requestId && (
                <p className="font-mono text-xs text-fg-2">
                  request <span className="select-all text-fg-1">{serverError.requestId}</span>
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
            <div className="max-w-xl">
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
                {taken && kind === 'lockfile' ? `Parsed ${taken.packages.toLocaleString('en-US')} packages. ` : ''}
                {step < 0 ? 'Starting' : `Step ${at + 1} of ${stages.length}: ${STAGES[step]!.label.toLowerCase()}`}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
