// Shared by the Phase 3 sketches: p5 2.x as an ES module + p5.brush in instance mode, a 2D snapshot of the WebGL
// canvas taken in p5's postdraw hook, recolour + feather, and the POST to the dev server's /__export endpoint.
// seventy-four-min.html predates this file and keeps its own inline copy of the same steps.
import p5 from 'p5';
window.p5 = p5; // p5.brush registers itself as a p5 addon only if a global p5 exists when it is evaluated
export const brush = await import('p5.brush');

export const say = (s) => (document.getElementById('log').textContent += s + '\n');
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mount a sketch whose draw(p, state) paints only the strokes of `state.layer`. Returns { state, render }. */
export function mount({ W, H, DPR, stage, sketch }) {
  const snap = document.createElement('canvas');
  snap.width = W * DPR;
  snap.height = H * DPR;
  let ready = false;
  p5.registerAddon((_p5, _fn, lifecycles) => {
    lifecycles.postdraw = function () {
      const gl = this._renderer?.canvas ?? this.canvas;
      if (!gl) return;
      const ctx = snap.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, snap.width, snap.height);
      ctx.drawImage(gl, 0, 0, snap.width, snap.height);
      ready = true;
    };
  });
  const state = { layer: 'all' };
  let p;
  new p5((inst) => {
    p = inst;
    brush.instance(p);
    sketch(p, state);
  }, stage);
  // Explicit redraw + timer, not requestAnimationFrame: rAF does not fire while the browser pane is hidden.
  const render = async (layer) => {
    state.layer = layer;
    ready = false;
    await p.redraw();
    await settle(80);
    if (!ready) throw new Error(`${layer}: not rendered`);
    return snap;
  };
  return { state, render, redraw: () => p.redraw() };
}

/** Recolour every painted pixel to `hex` (alpha kept) and feather 1px at 2x: p5.brush composites the pen as opaque,
 *  darkened pixels, and the UI wants the exact token colour with anti-aliased edges. */
export function finish(src, hex) {
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = r; d[i + 1] = g; d[i + 2] = b; }
  const flat = document.createElement('canvas');
  flat.width = src.width;
  flat.height = src.height;
  flat.getContext('2d').putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const octx = out.getContext('2d');
  octx.filter = 'blur(0.8px)';
  octx.drawImage(flat, 0, 0);
  return out;
}

/** Render each [layer, ink] in order, recolour it, and composite everything into one transparent canvas. */
export async function compose(render, layers) {
  let out;
  for (const [layer, ink] of layers) {
    const snap = await render(layer);
    out ??= Object.assign(document.createElement('canvas'), { width: snap.width, height: snap.height });
    out.getContext('2d').drawImage(finish(snap, ink), 0, 0);
  }
  return out;
}

const toBlob = (c, type) => new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('toBlob failed'))), type, 0.92));

/** POST PNG + WebP to the dev server, which writes web/public/scribbles/<slug>.<fmt>. */
export async function post(canvas, slug) {
  for (const fmt of ['png', 'webp']) {
    const blob = await toBlob(canvas, `image/${fmt}`);
    const res = await fetch(`/__export?name=${slug}&fmt=${fmt}`, { method: 'POST', body: blob });
    say(`${slug}.${fmt}: ${res.status} ${await res.text()}`);
  }
}

/** Wire the Export button, the stand-in toggle and the ?export=1 autorun. */
export function wire(exportAll) {
  document.getElementById('export')?.addEventListener('click', exportAll);
  document.getElementById('standin-toggle')?.addEventListener('change', (e) => {
    document.getElementById('standin').style.display = e.target.checked ? '' : 'none';
  });
  if (new URLSearchParams(location.search).has('export')) {
    const wait = () => (document.querySelector('#stage canvas') ? settle(300).then(exportAll) : setTimeout(wait, 100));
    wait();
  }
}
