import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { QuickCaptureDialog } from './QuickCaptureDialog';
import { QuickCaptureContext } from './context';
import { hasLetterKeyOwner, hasOpenOverlay, isPlainKey } from './hotkeys';

/**
 * Captura rápida disponível em todas as telas do app:
 * - Q (fora de campos de texto, diálogos e da planilha);
 * - Ctrl+K / Cmd+K (menos dentro do editor de texto rico);
 * - botão "Nova tarefa" da barra lateral.
 */
export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openQuickCapture = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        const target = e.target instanceof HTMLElement ? e.target : null;
        if (target?.closest('[contenteditable="true"], [contenteditable=""]')) return;
        e.preventDefault();
        setOpen(true);
        return;
      }

      if ((e.key === 'q' || e.key === 'Q') && !e.repeat && isPlainKey(e)) {
        if (hasOpenOverlay() || hasLetterKeyOwner()) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <QuickCaptureContext.Provider value={{ openQuickCapture }}>
      {children}
      <QuickCaptureDialog open={open} onOpenChange={setOpen} />
    </QuickCaptureContext.Provider>
  );
}
