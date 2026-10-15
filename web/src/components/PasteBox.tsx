/* PasteBox: analyze a public GitHub repo URL or a dropped package-lock.json (docs/design.md section 5).
 * Props:
 *   analyze   AnalyzeState from useAnalyze() (status, stage, repo, error), drives progress and errors
 *   onAnalyze({ url } | { lockfile })   called only after client-side validation passes
 *   onClose
 * States: idle, dragover (dashed outline), invalid URL (inline error, button disabled), too large (> 5 MB),
 * unsupported (yarn / pnpm / lockfile v1 -> friendly error + sample repos), rate-limited (429, 20 s countdown),
 * analyzing (staged progress from AnalyzeEvent; announced politely on stage change only).
 * Server-side validation (S1) is authoritative; these checks only save a round trip.
 */
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import type { AnalyzeState } from '../data/useAnalyze.ts';
import { Button } from './Button.tsx';
import { CircleAlert, Close, Upload } from './icons/Glyphs.tsx';

const URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}\/?$/;
const MAX_BYTES = 5 * 1024 * 1024;
const STAGES = ['fetch', 'parse', 'write', 'enrich', 'admits'] as const;
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
  const [fileError, setFileError] = useState<string | null>(null);
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

  async function readFile(file: File) {
    setFileError(null);
    if (/yarn\.lock$|pnpm-lock\.ya?ml$/i.test(file.name)) {
      return setFileError('yarn and pnpm lockfiles are not supported yet. Drop a package-lock.json (npm v2 or v3).');
    }
    if (file.size > MAX_BYTES) return setFileError('That file is over 5 MB. Lockfiles up to 5 MB and 6,000 entries are supported.');
    const text = await file.text();
    const version = /"lockfileVersion"\s*:\s*(\d)/.exec(text)?.[1];
    if (!version || Number(version) < 2) {
      return setFileError('Only package-lock.json with lockfileVersion 2 or 3 is supported. Run npm install with npm 7 or newer to upgrade it.');
    }
    onAnalyze({ lockfile: text });
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const stageIndex = analyze.stage ? STAGES.indexOf(analyze.stage.stage) : -1;
  const progress = analyze.stage ? (stageIndex + analyze.stage.done / Math.max(1, analyze.stage.total)) / STAGES.length : 0;
  const error = fileError ? { message: fileError, requestId: undefined } : analyze.status === 'error' ? analyze.error : null;

  return (
    <section
      id="paste-panel"
      aria-label="Analyze your own repo"
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`border-b border-line-1 bg-bg-1 px-(--gutter) py-4 ${drag ? 'outline-2 -outline-offset-4 outline-dashed outline-fg-0' : ''}`}
    >
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !running && retryIn === 0) onAnalyze({ url: url.trim() });
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
            value={url}
            placeholder="https://github.com/owner/name"
            aria-invalid={urlError ? true : undefined}
            aria-describedby={`${id}-help`}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
          />
        </div>
        <Button type="submit" variant="primary" loading={running} disabled={!valid || retryIn > 0}>
          {retryIn > 0 ? `Retry in ${retryIn} s` : 'Analyze'}
        </Button>
        <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()} disabled={running}>
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

      <p id={`${id}-help`} className="mt-2 text-xs text-fg-2">
        Or drop a package-lock.json anywhere on this panel. Public repos only; nothing is stored beyond one hour.
      </p>

      {urlError && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-infect-400">
          <CircleAlert size={16} className="shrink-0" /> {urlError}
        </p>
      )}
      {error && (
        <div role="alert" className="mt-2 flex flex-col gap-2 text-sm">
          <p className="flex items-start gap-2 text-infect-400">
            <CircleAlert size={16} className="mt-0.5 shrink-0" />
            {rateLimited ? 'One analysis per 20 s. Wait for the countdown, then try again.' : error.message}
          </p>
          {error.requestId && (
            <p className="font-mono text-xs text-fg-2">
              request <span className="select-all text-fg-1">{error.requestId}</span>
            </p>
          )}
          <p className="flex flex-wrap items-center gap-2 text-fg-1">
            Or try a sample repo:
            {SAMPLES.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-xs bg-bg-2 px-1.5 py-0.5 font-mono text-xs text-link"
                onClick={() => {
                  setUrl(`https://github.com/${s}`);
                  setFileError(null);
                  setTouched(true);
                }}
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
            <div
              className="h-full origin-left bg-fg-0 transition-transform duration-(--dur-base) ease-out"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          {/* announced on stage changes only: the done/total counter is aria-hidden */}
          <p role="status" className="mt-1 font-mono text-xs text-fg-1">
            {analyze.stage?.stage ?? 'starting'}
            {analyze.stage && <span aria-hidden> {analyze.stage.done}/{analyze.stage.total}</span>}
          </p>
        </div>
      )}
    </section>
  );
}
