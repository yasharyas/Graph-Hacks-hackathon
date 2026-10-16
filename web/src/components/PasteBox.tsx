/* PasteBox: analyze a public GitHub repo, or a package-lock.json pasted, dropped or chosen (docs/design.md section 5).
 * It opens in a Sheet (a modal right drawer; a full-height sheet on a phone): the working panes never move for it, Esc and
 * Back close it, focus is trapped and returned. Progress and errors come AFTER both fields (sticky to the foot of the
 * scrolling area: right under the fields when there is room, on screen at the bottom when there is not), so no field moves
 * when they appear: the repo field keeps its place from the tap to the verdict, and a dead end costs no layout shift. A
 * long server message (yarn, pnpm, no lockfile) opens with one line (data/pasteError.ts lead); the versions to check by hand
 * and the longer instruction sit behind a disclosure, and the Copy-command button stays outside it.
 * Props:
 *   open      whether the sheet is showing (it stays mounted, so typed text survives closing)
 *   analyze   AnalyzeState from useAnalyze() (status, stage, repo, error), drives progress and errors
 *   onAnalyze({ url } | { lockfile })   called only after client-side checks pass
 *   onClose   called for every way of closing it
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
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { inspectLockfile, looksLikeLockfile, MAX_LOCKFILE_BYTES, repoFromInput, TOO_BIG } from '../data/lockfile.ts';
import { pasteProblem } from '../data/pasteError.ts';
import type { AnalyzeState } from '../data/useAnalyze.ts';
import { Button, IconButton } from './Button.tsx';
import { copyText } from './copy.ts';
import { Check, ChevronDown, CircleAlert, Close, Copy, Upload } from './icons/Glyphs.tsx';
import { Sheet } from './Sheet.tsx';

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
  <p id={id} role="alert" className="mt-1.5 flex items-start gap-2 text-sm text-fg-0">
    <CircleAlert size={16} className="mt-0.5 shrink-0 text-fg-1" />
    {children}
  </p>
);

export function PasteBox({
  open,
  analyze,
  onAnalyze,
  onClose,
}: {
  open: boolean;
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
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false); // the analysis finished while the sheet is still open (App closes it a moment later)
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const lockRef = useRef<HTMLTextAreaElement>(null);

  const running = analyze.status === 'running';
  // The progress block stays after the analysis ends: App closes the sheet in the same render (or a few ms later), and a block
  // that vanished first would move the form up under a person's eyes (a layout shift) just before the sheet slides out. It
  // is frozen through the exit and cleared when the sheet opens again or a new analysis starts.
  const [last, setLast] = useState({ status: analyze.status, open });
  if (last.status !== analyze.status || last.open !== open) {
    setLast({ status: analyze.status, open });
    if (open && !last.open) setDone(false);
    else if (analyze.status !== last.status) setDone(analyze.status === 'ready');
  }
  const busy = running || done;

  // The server's message is the cause, shown whole; what goes around it comes from data/pasteError.ts.
  const problem = analyze.status === 'error' && analyze.error ? pasteProblem(analyze.error) : null;
  const rateLimited = problem !== null && problem.wait > 0;
  const wait = problem?.wait ?? 0;
  useEffect(() => {
    if (!rateLimited) return;
    setRetryIn(wait);
    const t = setInterval(() => setRetryIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [rateLimited, wait]);
  const blocked = busy || retryIn > 0;

  const repo = repoFromInput(url);
  const urlError = urlTouched && 'error' in repo ? repo.error : null;
  const urlNote = !urlError && url.trim() && 'url' in repo && repo.url !== url.trim() ? repo.url : null;
  // The check parses the whole text: run it for the value React has caught up with, not for every keystroke of a big one.
  const deferredLock = useDeferredValue(lock);
  const check = useMemo(() => (deferredLock.trim() ? inspectLockfile('pasted lockfile', deferredLock) : null), [deferredLock]);
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
  const shownLockError = fileProblem ?? lockError;
  const copyCommand = async (cmd: string) => {
    setCopied(await copyText(cmd, 'Command', true)); // quiet: a toast would sit under this modal's scrim
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Sheet id="paste-panel" open={open} onClose={onClose} labelledBy={`${id}-title`} onDragOver={(e) => (e.preventDefault(), setDrag(true))} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
      <div className={`flex h-full flex-col ${drag ? 'outline-2 -outline-offset-4 outline-dashed outline-fg-0' : ''}`}>
        <div className="flex items-start gap-3 border-b border-line-1 p-4">
          <h2 id={`${id}-title`} className="min-w-0 flex-1 font-display text-xl font-extrabold text-fg-0">
            Analyze your own repo
          </h2>
          <IconButton label="Close" icon={<Close size={20} />} onClick={onClose} />
        </div>

        <div className="scroll-pane min-h-0 flex-1 p-4">
          <div className="flex flex-col gap-6">
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
                  data-autofocus
                  className="field min-w-0 aria-invalid:border-fg-0"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={url}
                  placeholder="owner/name or github.com/owner/name"
                  aria-invalid={urlError ? true : undefined}
                  aria-describedby={`${id}-url-help${urlError ? ` ${id}-url-err` : ''}`}
                  onChange={(e) => (setUrl(e.target.value), e.target.value.trim() || setUrlTouched(false))}
                  onPaste={onPasteUrl}
                  onBlur={() => url.trim() && setUrlTouched(true)}
                />
                <Button type="submit" variant="primary" loading={busy && kind === 'url'} disabled={blocked}>
                  {retryIn > 0 ? `Retry in ${retryIn} s` : 'Analyze'}
                </Button>
              </div>
              <p id={`${id}-url-help`} className="mt-1.5 text-xs text-fg-2">
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
                onChange={(e) => {
                  const v = e.target.value;
                  // A lockfile too big to read in a textarea arriving as one input event (an IME, a drag of text, a test harness) is
                  // taken whole, like a paste: the box never holds it, so no keystroke re-renders, re-measures or re-parses 100 kB.
                  if (v.length > SHOW_MAX) return blocked ? undefined : take('pasted lockfile', v);
                  setLock(v);
                  setFileProblem(null);
                }}
                onPaste={onPasteLock}
                onBlur={() => lock.trim() && setLockTouched(true)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button loading={busy && kind === 'lockfile'} disabled={blocked || !lock.trim()} onClick={() => analyzeLock()}>
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

          {/* Progress and errors come AFTER both fields, so nothing the person is looking at moves when they appear: the repo
              field keeps its place from the tap to the verdict (it used to jump 125px down, then up to 480px). Sticky to the
              foot of the scrolling area: right under the fields when there is room, on screen at the bottom when there is not. */}
          {(problem || busy) && (
            <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-6 max-h-[45dvh] min-w-0 overflow-y-auto border-t border-line-1 bg-bg-2 p-4">
              {problem && (
                <div role="alert" className="flex flex-col gap-2 text-sm">
                  {/* a short opening; the server's longer words (versions to search for, why the command) are in the disclosure */}
                  <p className="flex items-start gap-2 text-fg-0">
                    <CircleAlert size={16} className="mt-0.5 shrink-0 text-fg-1" />
                    {problem.lead}
                  </p>
                  {problem.hint && <p className="pl-6 text-fg-1">{problem.hint}</p>}
                  {problem.command && (
                    <p className="flex flex-wrap items-center gap-2 pl-6 max-sm:pl-0">
                      <code className="rounded-xs bg-bg-3 px-2 py-1 font-mono text-xs text-fg-0 select-all">{problem.command}</code>
                      <Button className="px-2.5" icon={<Copy size={14} />} aria-label="Copy command" onClick={() => void copyCommand(problem.command!)}>
                        Copy
                      </Button>
                      <span role="status" className="text-xs text-fg-1">
                        {copied ? 'Copied' : ''}
                      </span>
                    </p>
                  )}
                  {problem.details && (
                    <details key={problem.message} className="group pl-6">
                      <summary className="inline-flex min-h-(--control-h) cursor-pointer list-none items-center gap-1.5 rounded-xs text-link underline underline-offset-2 [&::-webkit-details-marker]:hidden">
                        {problem.detailsLabel}
                        <ChevronDown size={14} className="transition-transform duration-(--dur-fast) group-open:rotate-180" />
                      </summary>
                      <p className="pb-1 text-fg-1">{problem.details}</p>
                    </details>
                  )}
                  {problem.requestId && (
                    <p className="pl-6 font-mono text-xs text-fg-2">
                      request <span className="select-all text-fg-1">{problem.requestId}</span>
                    </p>
                  )}
                  <p className="flex flex-wrap items-center gap-2 pl-6 text-fg-1">
                    Try a sample repo:
                    {SAMPLES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={blocked}
                        className="min-h-(--control-h) rounded-xs bg-bg-3 px-2 font-mono text-xs text-link disabled:opacity-(--opacity-disabled)"
                        onClick={() => trySample(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </p>
                </div>
              )}
              {busy && (
                <div>
                  <div className="h-1 overflow-hidden rounded-xs bg-bg-3" aria-hidden>
                    <div className="h-full origin-left bg-fg-0 transition-transform duration-(--dur-base) ease-out" style={{ transform: `scaleX(${done ? 1 : progress})` }} />
                  </div>
                  {/* every mark is the same width, so a finished stage never re-wraps the row */}
                  <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {stages.map((s) => {
                      const state = done ? 'done' : at < 0 ? 'todo' : stages.indexOf(s) < at ? 'done' : stages.indexOf(s) === at ? 'now' : 'todo';
                      return (
                        <li key={s.id} aria-current={state === 'now' ? 'step' : undefined} className={`inline-flex items-center gap-1 ${state === 'now' ? 'text-fg-0' : state === 'done' ? 'text-tier-clean' : 'text-fg-2'}`}>
                          <span aria-hidden className="grid size-3 shrink-0 place-items-center">
                            {state === 'done' ? <Check size={12} /> : <span className={`size-1.5 rounded-full ${state === 'now' ? 'bg-fg-0' : 'bg-line-3'}`} />}
                          </span>
                          {s.label}
                        </li>
                      );
                    })}
                  </ol>
                  {/* announced on stage changes only: the counter is aria-hidden. Two lines are kept for it, so a longer step never moves the form. */}
                  <p role="status" className="mt-1 min-h-9 font-mono text-xs text-fg-1">
                    {taken && kind === 'lockfile' ? `Parsed ${taken.packages.toLocaleString('en-US')} packages. ` : ''}
                    {done ? 'Done. Opening the result' : step < 0 ? 'Starting' : `Step ${at + 1} of ${stages.length}: ${STAGES[step]!.label.toLowerCase()}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
