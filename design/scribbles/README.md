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
| `contrast-arrow` | Phase 3 | 320×160 | contrast card, from "Advisory scanner: 0" to the Patient Zero column | wipe left→right 400ms |
| `empty-lockfile` | Phase 3 | 480×360 | empty / error state: magnifier over a lockfile sheet, grey ink with one red mark | fade only |
| `coach-hint` | Phase 3 | 160×120 | the single inline onboarding hint under the scenario chips | wipe |
| `tagline-underline` | Phase 3, optional | 640×48 | under the landing tagline; never on screen together with the 74-min loop | wipe 500ms |

Details, placements and reduced-motion behaviour are in `docs/design.md` → "Scribbles".
