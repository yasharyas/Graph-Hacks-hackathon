// useBackClose(open, close): the browser's Back button (the default dismiss gesture on a phone) closes the open drawer or
// panel instead of leaving the app. Opening pushes one history entry; closing by any other means (Close, Esc) pops it again.
import { useEffect, useRef } from 'react';

export function useBackClose(open: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const marker = { pzOverlay: Math.random().toString(36).slice(2) };
    history.pushState(marker, '');
    const onPop = () => closeRef.current();
    addEventListener('popstate', onPop);
    return () => {
      removeEventListener('popstate', onPop);
      // closed some other way: drop the entry we pushed (Back itself already did when the marker is gone)
      if (history.state?.pzOverlay === marker.pzOverlay) history.back();
    };
  }, [open]);
}
