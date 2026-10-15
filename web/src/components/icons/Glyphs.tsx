/* Glyphs: the static Lucide icons the UI needs (arrows, copy, play...). Same shell and stroke as the animated
 * five. Every glyph takes IconProps (size, title, className); decorative unless `title` is given.
 * Never use Unicode ticks or arrows in UI text: use these.
 */
import type { ReactNode } from 'react';
import { IconFrame, type IconProps } from './IconFrame.tsx';

const glyph = (paths: string[], extra?: ReactNode) =>
  function Glyph(props: IconProps) {
    return (
      <IconFrame {...props}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
        {extra}
      </IconFrame>
    );
  };

/** REQUIRES / RESOLVES_TO hop */
export const ArrowRight = glyph(['M5 12h14', 'm12 5 7 7-7 7']);
/** ADMITS range hop (arrow into a bar) */
export const ArrowRightToLine = glyph(['M17 12H3', 'm11 18 6-6-6-6', 'M21 5v14']);
export const Copy = glyph(['M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'], <rect x="8" y="8" width="14" height="14" rx="2" />);
export const Close = glyph(['M18 6 6 18', 'm6 6 12 12']);
export const Play = glyph(['M6 3 20 12 6 21Z']);
export const Pause = glyph([], (
  <>
    <rect x="14" y="4" width="4" height="16" rx="1" />
    <rect x="6" y="4" width="4" height="16" rx="1" />
  </>
));
export const ChevronDown = glyph(['m6 9 6 6 6-6']);
export const TriangleAlert = glyph(['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01']);
export const CircleAlert = glyph(['M12 8v4', 'M12 16h.01'], <circle cx="12" cy="12" r="10" />);
export const Download = glyph(['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3']);
export const Upload = glyph(['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12']);
export const LinkIcon = glyph([
  'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
  'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
]);
export const Undo = glyph(['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11']);
export const ListTree = glyph(['M21 12h-8', 'M21 6H8', 'M21 18h-8', 'M3 6v4c0 1.1.9 2 2 2h3', 'M3 10v6c0 1.1.9 2 2 2h3']);
export const Check = glyph(['M20 6 9 17l-5-5']);
