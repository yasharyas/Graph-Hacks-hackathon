// copyText(text, label): clipboard write with a toast (one copy toast at a time: the next copy replaces it). If the clipboard is denied the toast says so; callers
// that can show a selectable text block should do so (the Cypher block and drawer blocks always are).
// `quiet` skips the toasts: the Fix drawer is a modal dialog, so toasts raised under it are dimmed and inert, and it
// reports the outcome inline instead.
import { toast } from './Toasts.tsx';

export async function copyText(text: string, label: string, quiet = false): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    if (!quiet) toast({ message: `${label} copied`, tone: 'success', group: 'copy' });
    return true;
  } catch {
    if (!quiet) toast({ message: `Clipboard blocked. Select the ${label.toLowerCase()} text and copy it manually.`, tone: 'error', group: 'copy' });
    return false;
  }
}
