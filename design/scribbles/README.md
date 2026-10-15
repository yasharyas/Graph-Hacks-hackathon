# Scribbles (p5.brush, pre-rendered)

Hand-drawn accents for the war room, drawn once with `p5` 2.3.4 + `p5.brush` 2.2.3 and shipped as transparent PNG + WebP in `web/public/scribbles/`. The app never loads p5 or WebGL; it loads a picture and reveals it along its own drawing direction with the `.scribble-wipe` / `.scribble-sweep` primitives in `web/src/design/tokens.css`.

## Run

```
node node_modules/vite/bin/vite.js --config design/scribbles/vite.config.mjs
# http://localhost:5190/             design bench: tokens compiled through Tailwind, fonts, scribbles in place
# http://localhost:5190/<slug>.html  one sketch; ?export=1 writes every layer as PNG + WebP on load
```

The dev server exposes `POST /__export?name=<slug>&fmt=png|webp` (body = image bytes) and writes `web/public/scribbles/<slug>.<fmt>`. Names are `[a-z0-9-]`; nothing else is accepted.

## Rules for every sketch

- One file per asset, `<slug>.html`, ESM: `import p5 from 'p5'; window.p5 = p5; const brush = await import('p5.brush')`, instance mode with `brush.instance(p)`.
- Fixed `SEED`, `noLoop()`, `p.clear()` for transparency, `pixelDensity(2)`; the export is the 2× bitmap, the `<img>` declares the 1× `width`/`height`.
- Ink is a token colour, usually `--red-400 #ff5a4f`; neutral drawings use `--fg-1 #a8a6a0`. Brush `pen` at weight 1.2–1.6 after `brush.scaleBrushes(2.4)` for a 480px canvas (scale linearly with width).
- p5.brush composites the pen as opaque, darkened pixels. `finish()` recolours every painted pixel to the exact ink and feathers 1px at 2× so edges are anti-aliased and the colour matches the token (the reviewer measured `#C03830` and zero partial-alpha pixels before this step).
- Strokes that are revealed differently are exported as separate layers (`<slug>-arrow`, `<slug>-loop`) plus a combined `<slug>` for README / social use.
- An HTML "stand-in" of the UI text the scribble annotates sits under the canvas (not exported) so the fit is judged against the real type size.
- Snapshot the WebGL canvas in a `postdraw` addon hook (see `seventy-four-min.html`); do not rely on `preserveDrawingBuffer`.
- At most two scribbles visible in one viewport.

## Assets

| Slug | Status | Canvas (1×) | Placement | Reveal |
|---|---|---|---|---|
| `seventy-four-min-arrow`, `seventy-four-min-loop` (+ combined) | done (Phase 0) | 480×300 | contrast-card footer / landing timeline, loop ≈ 216×100 around the 56px "74 min" centred at (300,160); arrow from below the caption to the loop's upper-left shoulder | arrow `.scribble-wipe` 400ms, then loop `.scribble-sweep` from `--pen-x: 62.5%; --pen-y: 53%; --pen-from: 282deg`, delay 350ms |
| `contrast-arrow` | done (Phase 3) | 28×100 | contrast card: the 1.75rem lane between the labels and the numbers, from the scanner's "0" (row 1) down to the first Patient Zero count (row 3); shown only while scanner = 0 and the graph found something, and only from a 420px container (below that the rows stack and there is no lane). The lane's bottom is CSS-anchored to the first tier count, so the stroke stretches when the name-grep row wraps | mask top→bottom 600ms |
| `empty-lockfile` | done (Phase 3) | 144×108 | `EmptyState`, left of the copy, only for empty states that have a next action and only in a ≥ 400px container (the table pane, never the feed, never phones). Grey ink (`fg-1`) for the sheet, its entries, the glass and the handle; the one entry under the lens is `red-400` | mask diagonal 600ms |
| `coach-hint` | done (Phase 3) | 96×32 | `OnboardingHint`: underline under "Click a row" (step 1), then a hook that curls down out of the card toward the panes; ink `fg-0` (red would mean infected); hidden under 1024px where the steps can wrap under the hook | mask left→right 400ms |
| `tagline-underline` | dropped | — | the app has no tagline (the wordmark stands alone), so there is nothing to underline | — |

The Phase 3 sketches share `lib.mjs` (bootstrap, snapshot, recolour, composite, export). Their reveal is the `Scribble` component (`web/src/components/Scribble.tsx`): a CSS mask slid along the stroke's direction with the Web Animations API, once per asset per session, ease-out, nothing under `prefers-reduced-motion`. The 74-min pair keeps the CSS-class primitives above.

Details, placements and reduced-motion behaviour are in `docs/design.md` → "Scribbles".
