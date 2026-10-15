/* Scribble: a pre-rendered p5.brush stroke from web/public/scribbles/<name>.webp (+ .png fallback), revealed once with
 * a CSS mask that slides along the stroke's drawing direction (docs/design.md section 8). Decorative only: alt="",
 * aria-hidden, pointer-events none; the parent positions the <picture> and keeps it off text and controls.
 * Props: name (file slug), width / height (1x CSS px; the files are 2x), angle (mask travel: 90 = left to right,
 *        180 = top to bottom, 135 = top-left to bottom-right), duration (ms; default --dur-draw, 600), className.
 * The reveal runs once per name per session with --ease-out; later mounts and prefers-reduced-motion show the image
 * whole.
 */
import { useCallback } from 'react';
import { motionTokens } from './icons/motionTokens.ts';

const drawn = new Set<string>();
const MASK_PROPS = ['mask-image', 'mask-size', 'mask-repeat', 'mask-position'];

export interface ScribbleProps {
  name: string;
  width: number;
  height: number;
  angle?: number;
  duration?: number;
  className?: string;
}

export function Scribble({ name, width, height, angle = 90, duration, className = '' }: ScribbleProps) {
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.animate || drawn.has(name) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      drawn.add(name);
      const { draw, easeOut } = motionTokens();
      // The mask is 2.2x the image with a 10% feathered edge in its middle; sliding it from 100% to 0% moves that edge
      // across the whole image (fully transparent at the start, fully opaque at the end) in the direction of `angle`.
      const set = (prop: string, value: string) => {
        img.style.setProperty(prop, value);
        img.style.setProperty(`-webkit-${prop}`, value);
      };
      set('mask-image', `linear-gradient(${angle}deg, #000 45%, transparent 55%)`);
      set('mask-size', '220% 220%');
      set('mask-repeat', 'no-repeat');
      set('mask-position', '100% 100%');
      const start = () => {
        const anim = img.animate(
          [
            { maskPosition: '100% 100%', webkitMaskPosition: '100% 100%' },
            { maskPosition: '0% 0%', webkitMaskPosition: '0% 0%' },
          ],
          { duration: duration ?? draw * 1000, easing: `cubic-bezier(${easeOut.join(', ')})`, fill: 'forwards' },
        );
        anim.onfinish = () => {
          anim.cancel();
          for (const p of MASK_PROPS) {
            img.style.removeProperty(p);
            img.style.removeProperty(`-webkit-${p}`);
          }
        };
      };
      img.decode().then(start, start); // draw when the bitmap is ready; a failed decode still shows the fallback
    },
    [name, angle, duration],
  );
  return (
    <picture aria-hidden="true" className={`pointer-events-none select-none ${className}`}>
      <source srcSet={`/scribbles/${name}.webp`} type="image/webp" />
      {/* max-w-none: preflight caps images at their parent's width, and an absolutely positioned <picture> shrink-wraps to
          its anchor (the 63px "Click a row"), which would squeeze the stroke. h-full: a parent that gives the <picture> an
          explicit height (the contrast arrow's lane) stretches the stroke to it; elsewhere the height is auto. */}
      <img ref={ref} src={`/scribbles/${name}.png`} alt="" width={width} height={height} decoding="async" className="block h-full max-w-none" />
    </picture>
  );
}
