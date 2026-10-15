// copyText(text, label): clipboard write with a toast. If the clipboard is denied the toast says so; callers
// that can show a selectable text block should do so (the Cypher block and drawer blocks always are).
import { toast } from './Toasts.tsx';

export async function copyText(text: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast({ message: `${label} copied`, tone: 'success' });
    return true;
  } catch {
    toast({ message: `Clipboard blocked. Select the ${label.toLowerCase()} text and copy it manually.`, tone: 'error' });
    return false;
  }
}
