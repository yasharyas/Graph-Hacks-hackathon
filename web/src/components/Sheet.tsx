/* Sheet: a native modal <dialog> styled as the right drawer (styles.css `dialog.drawer`): a panel at the right edge from
 * 768px, a full-height sheet below. The browser gives the focus trap, Esc, the inert page and focus returned to the opener;
 * App adds Back (useBackClose). The paste panel and the graph stats open in it, so neither pushes the working panes around.
 * Props: open, onClose (any way of closing: Esc, the backdrop, close()), labelledBy (the id of its heading), plus any
 * <dialog> prop. Always mounted: what a person typed survives closing it. The element marked `data-autofocus` takes focus
 * on open (a fine pointer only: on a phone it would raise the keyboard over the sheet before anything has been read).
 */
import { useEffect, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

export interface SheetProps extends Omit<ComponentPropsWithoutRef<'dialog'>, 'open' | 'onClose' | 'className'> {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, labelledBy, children, ...rest }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (matchMedia('(pointer: fine)').matches) d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="drawer" aria-labelledby={labelledBy} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} {...rest}>
      {children}
    </dialog>
  );
}
