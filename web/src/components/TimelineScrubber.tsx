/* TimelineScrubber: the time spine. Play/pause (FIRST in tab order: WCAG 2.2.2), the climbing counter, a counts strip,
 * and a native range track with incident markers.
 * Props:
 *   incident, points   from useTimeline(); the track spans points[0].at .. points.at(-1).at. `incident` null = still
 *                      loading: the same layout with placeholders, so nothing moves when the data lands
 *   at                 scrubber position (epoch ms, whole minutes)
 *   snapshot           the counts + scanner hits shown. App decides whose: the timeline sample on the landing, the exact
 *                      /api/exposure answer (or the report's) once a triage exists, the pasted repo's for a guest
 *   playing, onPlay, onPause, onSeek(at)
 *   landingEnd         where the first-load autoplay stops; a finished autoplay labels the button "Play the N minutes"
 *   compact            report mode: one row (play, headline, counts, track). Landing mode is the hero band: its counts
 *                      strip carries a plain sublabel under each count (from 640px). Both carry the tier "?" legend right
 *                      after the counts, and a tap or click on the counts opens it too (a phone reader taps "WOULD_PULL 20")
 *   scope, scopeNote, scopeNoteShort   what the numbers are about ("Acme demo org · 21 repos") and what is real in it: the sentence
 *                      in the landing band, a few words after the scope on the compact row's one label line
 *   scopeSource        a pasted repo: which lockfile it was judged on ("lockfile at commit 5f8e8a8 from 2025-09-01", or a
 *                      counterfactual), in place of scopeNoteShort. The compact label is ONE line ("Acme demo org · 21 repos ·
 *                      teams synthetic", truncated, full text in the title), so the band keeps its height when a pasted
 *                      repo's report replaces the demo org's labels: nothing below it shifts
 *   failed             the triage did not run: no counter, no counts (a stale number beside "did not run" reads as a result)
 *   remediated         repos marked remediated: printed beside the exposed count ("· 2 marked remediated")
 *   trailing           compact row only: the action at its end ("Run again", or "Cancel run" while one runs)
 *   back               a control right after the slider in the tab order ("Back to 13:30 UTC" after a scrub, shown on focus)
 *   stale              the previous incident, dimmed while the next one loads (no skeleton flash)
 *   fixedCount         a pasted repo's count, true at the one clock it was analysed at: the slider then says that ("13:45 UTC;
 *                      this repo: 1 of 1 exposed at 13:30 UTC"), not the demo org's timeline count
 * The headline is as of the clock: past the removal ("15:15 removed") it is past tense, "1 repo was one install from malware
 * until 15:15": npm no longer serves the version, so "one install from malware" is no longer true.
 * The compact label line never sets the row's width (`w-0 min-w-full`): a pasted repo's long provenance pushed "Run again"
 * past the right edge at 1280px. It shows the scope and the few-word note; the provenance is in its title and in the verdict.
 * The landing band's last line is the autoplay's caption (data/markers.ts autoplayCaption: what the 90 minutes are showing,
 * in three states). It is a polite live region only while the autoplay plays, so it speaks at its two changes and never on
 * a scrub (the slider's own aria-valuetext does that). The clock is printed by the header chip and the scrub bubble only.
 * The autoplay pauses when the slider takes focus: a focused slider must not read out a moving value.
 * Marker labels never collide, from 320 to 1920px: each is measured and put on the first row where it fits, flipped left of
 * its tick (and clamped) at the right edge (data/markers.ts placeLabels); short words below 520px. The layout is redone
 * whenever the incident, the track's width or the fonts change, wherever the track sits (the landing and the compact row
 * are different parents). The first marker is the first exposure, so its label to OSV's is the figure on screen. The scrub
 * bubble is clamped inside the track. Keyboard: left/right = 1 min, Shift+arrows = 10 min, Space = play/pause. Scrubbing is
 * instant. aria-valuetext reads "13:42 UTC, 5 repos exposed" (the timeline's own count at that minute).
 * Forced colors: the track, its fill and the ticks are drawn in system colours (styles.css, data-scrub-*), not backgrounds
 * the browser would drop.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { IncidentMeta, TimelinePoint } from '../data/types.ts';
import { plural, utc, utcLabel, utcSec } from '../data/format.ts';
import { autoplayCaption, clampCentre, markersOf, placeLabels } from '../data/markers.ts';
import { exposedCount, snapshotAt } from '../data/snapshot.ts';
import { Button } from './Button.tsx';
import { Pause, Play } from './icons/Glyphs.tsx';
import { TierLegend } from './TierLegend.tsx';

const MIN = 60_000;
const ROW = 16; // px per label row
const SAFE_TITLE = 'Installing from the committed lockfile (npm ci) is safe for these repos: only a fresh install in the window would fetch the malicious version.';

export interface TimelineScrubberProps {
  incident: IncidentMeta | null;
  points: TimelinePoint[];
  at: number;
  snapshot: TimelinePoint | null;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (at: number) => void;
  landingEnd: number | null;
  compact?: boolean;
  scope?: string | null;
  scopeNote?: string | null;
  scopeNoteShort?: string | null;
  scopeSource?: string | null;
  failed?: boolean;
  remediated?: number;
  stale?: boolean;
  /** Compact row only: the action at its end ("Run again"). */
  trailing?: ReactNode;
  /** Right after the slider in the tab order: "Back to 13:30 UTC" after a scrub (App). */
  back?: ReactNode;
  /** A pasted repo's count at the clock it was analysed at: what the slider says instead of the timeline's count. */
  fixedCount?: { exposed: number; total: number; at: number } | null;
}

export function TimelineScrubber({ incident, points, at, snapshot, playing, onPlay, onPause, onSeek, landingEnd, compact = false, scope = null, scopeNote = null, scopeNoteShort = null, scopeSource = null, failed = false, remediated = 0, stale = false, trailing, back = null, fixedCount = null }: TimelineScrubberProps) {
  const ready = incident !== null && points.length > 0;
  const start = ready ? points[0]!.at : 0;
  const end = ready ? points.at(-1)!.at : 1;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
  const exposed = snapshot && !failed ? exposedCount(snapshot.counts) : null;
  const safe = exposed ? (snapshot?.counts.WOULD_PULL ?? 0) : 0; // exposed only to a fresh install: npm ci from the lockfile is safe
  // past the removal npm no longer serves the malicious versions: the count is what was true until then
  const gone = !!exposed && incident !== null && snapshot !== null && snapshot.at >= incident.removedAt;
  const sample = ready ? snapshotAt(points, at) : null; // the slider speaks for the timeline, whoever's numbers the band shows

  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null); // state, not a ref: the track is re-parented when the band collapses
  const [trackW, setTrackW] = useState(0);
  const [fonts, setFonts] = useState(0);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [bubbleW, setBubbleW] = useState(0);
  const [placed, setPlaced] = useState<{ left: number; row: number }[]>([]);
  const [legend, setLegend] = useState(false);
  const wide = trackW >= 520;
  const marks = incident ? markersOf(incident).map((m) => ({ ...m, label: wide ? m.long : m.short })) : [];
  const sig = `${start}|${end}|${marks.map((m) => `${m.t}${m.label}`).join()}`;

  // Measure whichever track is mounted now, and again when it resizes.
  useLayoutEffect(() => {
    if (!trackEl) return;
    const ro = new ResizeObserver(() => setTrackW(Math.floor(trackEl.clientWidth)));
    ro.observe(trackEl);
    setTrackW(Math.floor(trackEl.clientWidth));
    return () => ro.disconnect();
  }, [trackEl]);
  // Label widths depend on the fonts: place them again when they arrive.
  useEffect(() => {
    void document.fonts?.ready.then(() => setFonts((n) => n + 1));
  }, []);
  // Place every label before the first paint (no visible jump, no layout shift).
  useLayoutEffect(() => {
    if (!trackW || !marks.length) return;
    const next = placeLabels(
      marks.map((m, i) => ({ x: (pct(m.t) / 100) * trackW, w: labelRefs.current[i]?.offsetWidth ?? 0 })),
      trackW,
    );
    setPlaced((prev) => (prev.length === next.length && prev.every((p, i) => p.left === next[i]!.left && p.row === next[i]!.row) ? prev : next));
    setBubbleW(bubbleRef.current?.offsetWidth ?? 0);
  }, [trackW, sig, fonts]);
  const positioned = placed.length === marks.length && marks.length > 0;
  const rows = Math.max(2, ...placed.map((p) => p.row + 1));
  const bubbleX = clampCentre((pct(at) / 100) * trackW, bubbleW, trackW);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ') {
      e.preventDefault();
      playing ? onPause() : onPlay();
    } else if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const next = at + (e.key === 'ArrowRight' ? 10 : -10) * MIN;
      onSeek(Math.min(end, Math.max(start, next)));
    }
  };

  // The placeholder dash takes one digit's width: a wider dash wrapped the landing strip to two rows until the timeline
  // landed, then back to one (CLS 0.134 at 1366x768).
  const num = (n: number | undefined) => (n === undefined || !snapshot || failed ? <span className="inline-block w-[1ch] text-center">–</span> : n);
  const stats: { label: string; value: number | undefined; cls: string; sub: string }[] = [
    { label: 'LOCKED', value: snapshot?.counts.LOCKED, cls: 'text-tier-locked', sub: 'lockfile pins it' },
    { label: 'WOULD_PULL', value: snapshot?.counts.WOULD_PULL, cls: 'text-tier-would-pull', sub: 'a fresh install fetches it' },
    { label: 'MAINTAINER', value: snapshot?.counts.MAINTAINER, cls: 'text-tier-maintainer', sub: 'uses the account’s packages, nothing malicious yet' },
    { label: 'OSV advisories', value: snapshot?.scanner, cls: 'text-fg-1', sub: 'OSV records published' },
  ];
  const valueText = fixedCount
    ? `${utcLabel(at)}; this repo: ${fixedCount.exposed} of ${plural(fixedCount.total, 'repo')} exposed at ${utcLabel(fixedCount.at)}, the clock it was analysed at`
    : `${utcLabel(at)}, ${plural(sample ? exposedCount(sample.counts) : 0, 'repo')} exposed`;
  const minutes = landingEnd !== null && ready ? Math.round((landingEnd - start) / MIN) : 90;
  const playLabel = playing ? 'Pause' : ready && landingEnd !== null && at >= landingEnd ? `Play the ${minutes} minutes` : 'Play';

  const playButton = (
    <Button
      variant="secondary"
      icon={playing ? <Pause size={16} /> : <Play size={16} />}
      onClick={playing ? onPause : onPlay}
      disabled={!ready}
      aria-label={compact ? playLabel : undefined}
      title={compact ? playLabel : undefined}
      // landing: wide enough for "Play the 163 minutes" (the label changes when the autoplay ends and must not push the
      // counter); compact, and a phone held sideways: the icon alone (the label stays as screen-reader text), so the one-row
      // band fits 1280px with its action at the end, and the sideways band keeps its track and caption above the tab bar
      className={compact ? 'w-(--control-h) px-0' : 'min-w-[12rem] short:w-(--control-h) short:min-w-0 short:px-0'}
    >
      {compact ? null : <span className="short:sr-only">{playLabel}</span>}
    </Button>
  );

  const headline = (
    // sideways on a phone it shares the row with the icon-only Play and wraps inside itself, so the track stays above the tab bar
    <div className={`flex min-w-0 flex-col ${compact ? '' : 'short:flex-1 short:basis-0'}`}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`inline-block min-w-[2ch] text-right font-bold text-fg-0 tabular-nums ${compact ? 'text-2xl' : 'text-3xl short:text-2xl'}`}>{exposed ?? '–'}</span>
        <span className="text-sm text-fg-1">
          {failed
            ? 'no result: the triage did not run'
            : gone
              ? `${exposed === 1 ? 'repo was' : 'repos were'} one install from malware until ${utc(incident!.removedAt)}${safe > 0 ? ',' : ''}`
              : `${exposed === 1 ? 'repo' : 'repos'} one install from malware${safe > 0 ? ',' : ''}`}
        </span>
        {/* the number is not the whole story: WOULD_PULL repos are safe as long as they install from their lockfile. One repo
            (a pasted one) says it plainly: a bare "safe" read as a missing word, or as "the repo is safe". */}
        {/* the slot is always laid out (invisible when it does not apply), so a narrow band never gains or loses a line when
            the first exposure lands (the autoplay at 13:12) or a pasted repo's numbers do */}
        {safe > 0 ? (
          <span className={`text-sm whitespace-nowrap text-fg-1 ${compact ? '' : 'max-sm:basis-full'}`} title={SAFE_TITLE}>
            {safe === exposed ? (exposed === 1 ? 'npm ci is safe' : 'all safe with npm ci') : `${safe} safe with npm ci`}
          </span>
        ) : (
          !failed && (
            <span aria-hidden className={`invisible text-sm whitespace-nowrap ${compact ? '' : 'max-sm:basis-full'}`}>
              20 safe with npm ci
            </span>
          )
        )}
        {remediated > 0 && !failed && <span className="text-sm whitespace-nowrap text-tier-clean">· {remediated} marked remediated</span>}
      </p>
      {scope &&
        (compact ? (
          // one line: "Acme demo org · 21 repos · teams synthetic" (truncated, the whole of it in the title); never wider than the headline
          <p className="w-0 min-w-full truncate text-xs text-fg-1" title={[scope, scopeSource ?? scopeNoteShort].filter(Boolean).join(' · ')}>
            {scope}
            {!scopeSource && scopeNoteShort && <span className="text-fg-2"> · {scopeNoteShort}</span>}
          </p>
        ) : (
          <p className="text-xs text-fg-1">
            {scope}
            {/* a phone gets the few-word note: one line, so the Run action stays above the tab bar at 320x640 (and, held
                sideways, the track and its caption above the tab bar) */}
            {scopeNote && <span className="text-fg-2 max-sm:hidden short:hidden"> · {scopeNote}</span>}
            {scopeNoteShort && <span className="text-fg-2 sm:hidden short:inline"> · {scopeNoteShort}</span>}
          </p>
        ))}
    </div>
  );

  // Compact: one run of numbers. Landing: a strip with a plain sublabel under each count (from 640px). The "?" legend sits
  // right after the counts in both, and a tap on the counts opens it (the "?" is the keyboard and screen-reader way in).
  const openLegend = () => setLegend(true);
  const counts = compact ? (
    <div className="flex items-center gap-2">
      <dl data-legend-trigger="" onClick={openLegend} className="flex cursor-help flex-wrap gap-x-3 gap-y-1">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            {/* the row has no width to spare at 1280: "OSV" (the legend beside it says what an OSV advisory is) */}
            <dt className="font-mono text-2xs text-fg-1" title={s.sub}>
              {s.label === 'OSV advisories' ? (
                <>
                  OSV<span className="sr-only"> advisories</span>
                </>
              ) : (
                s.label
              )}
            </dt>
            <dd className={`min-w-[1.5ch] text-right text-md font-bold tabular-nums ${s.value && !failed ? s.cls : 'text-fg-2'}`}>{num(s.value)}</dd>
          </div>
        ))}
      </dl>
      <TierLegend open={legend} onOpenChange={setLegend} />
    </div>
  ) : (
    <div className="flex items-start gap-2 border-y border-line-1 py-1.5 short:py-1">
      <dl data-legend-trigger="" onClick={openLegend} className="flex min-w-0 flex-1 cursor-help flex-wrap gap-x-4 gap-y-1 sm:grid sm:grid-cols-4 sm:gap-x-5 short:grid-cols-2 xl:grid-cols-2 xl:[@media(max-height:800px)]:flex">
        {stats.map((s) => (
          <div key={s.label} className="grid min-w-0 grid-cols-[auto_1fr] items-baseline gap-x-1.5">
            <dt className="font-mono text-2xs whitespace-nowrap text-fg-1">{s.label}</dt>
            <dd className={`text-md font-bold tabular-nums ${s.value && !failed ? s.cls : 'text-fg-2'}`}>{num(s.value)}</dd>
            <dd className="col-span-2 text-xs text-fg-1 max-sm:hidden short:hidden lg:[@media(max-height:800px)]:hidden">{s.sub}</dd>
          </div>
        ))}
      </dl>
      <TierLegend open={legend} onOpenChange={setLegend} />
    </div>
  );

  // The compact row's track is 8px lower than the landing's (a 16px slider under a 16px bubble): the band is what a laptop
  // pays for before the feed starts.
  const track = (
    <div className={`relative ${compact ? 'pt-4' : 'pt-5'}`} style={{ paddingBottom: rows * ROW + 4 }}>
      <div ref={setTrackEl} className={`pointer-events-none absolute inset-x-2 ${compact ? 'top-4 h-4' : 'top-5 h-6'}`}>
        <div data-scrub-track="" className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line-3" />
        {ready && <div data-scrub-fill="" className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full bg-fg-1" style={{ width: `${pct(at)}%` }} />}
        {/* while loading, the placeholder sits at the track's start, whole (centred on x = 0, half of it was cut off) */}
        <span
          ref={bubbleRef}
          className={`absolute rounded-xs bg-bg-2 px-1.5 font-mono text-2xs text-fg-0 tabular-nums ${ready ? '-translate-x-1/2' : ''} ${compact ? '-top-4' : '-top-5'}`}
          style={{ left: ready ? bubbleX : 0 }}
          aria-hidden
        >
          {ready ? utc(at) : '--:--'}
        </span>
        {marks.map((m) => (
          <span key={m.key} data-scrub-tick={m.bad ? 'bad' : ''} className={`absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 ${m.bad ? 'bg-infect-400' : 'bg-fg-2'}`} style={{ left: `${pct(m.t)}%` }} />
        ))}
        {marks.map((m, i) => (
          <span
            key={m.key}
            ref={(el) => void (labelRefs.current[i] = el)}
            title={`${utcSec(m.t)} UTC ${m.key === 'exposed' ? 'first repo exposed' : m.long}`}
            className={`absolute top-full h-4 font-mono text-2xs whitespace-nowrap ${m.bad ? 'text-infect-400' : 'text-fg-1'}`}
            style={{ left: positioned ? placed[i]!.left : (pct(m.t) / 100) * trackW, marginTop: (positioned ? placed[i]!.row : 0) * ROW + 2, visibility: positioned ? undefined : 'hidden' }}
          >
            {utc(m.shown)}
            <span className="font-sans"> {m.label}</span>
          </span>
        ))}
      </div>
      <input
        type="range"
        // 24px tall wherever it sits (the compact row lends it 4px above and below), 44px on a coarse pointer
        className={`scrub relative ${compact ? '-my-1 pointer-coarse:-my-3.5' : 'pointer-coarse:-my-2.5'} pointer-coarse:h-11`}
        aria-label="Scenario time, UTC"
        min={start}
        max={end}
        step={MIN}
        value={ready ? at : start}
        disabled={!ready}
        aria-valuetext={!ready ? 'Loading' : valueText}
        onChange={(e) => onSeek(Number(e.target.value))}
        onKeyDown={onKeyDown}
        onFocus={() => playing && onPause()}
      />
      {back}
    </div>
  );

  return (
    <section aria-label="Incident timeline" aria-busy={stale || !ready || undefined} className={`flex flex-col gap-2 transition-opacity duration-(--dur-fast) ease-out ${compact ? 'px-(--gutter) py-1' : 'p-3 max-sm:gap-1.5 sm:p-4 short:gap-1.5 short:py-2'} ${stale ? 'pointer-events-none opacity-50' : ''}`}>
      {compact ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 xl:flex-nowrap">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 xl:shrink-0 xl:flex-nowrap">
            {playButton}
            {headline}
            {counts}
          </div>
          <div className="min-w-64 flex-1 basis-72">{track}</div>
          {trailing}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {playButton}
            {headline}
          </div>
          {counts}
          {track}
          {/* One line, reserved from the first paint (each state is written to fit it): what the autoplay is showing. The short
              wording on a phone and in the half-width column of a phone held sideways, where the long one took two lines. */}
          <p aria-live={playing ? 'polite' : 'off'} className="-mt-1 min-h-[18px] text-xs text-fg-1 max-sm:-mt-2 short:-mt-2">
            {incident && ready && (
              <>
                <span className="lg:hidden [@media(min-width:640px)_and_(min-height:501px)]:hidden">{autoplayCaption(incident, at, true)}</span>
                <span className="max-sm:hidden short:hidden">{autoplayCaption(incident, at)}</span>
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
