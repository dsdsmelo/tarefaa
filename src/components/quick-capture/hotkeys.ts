// Regras dos atalhos globais (captura rápida e triagem).

/** Campo de texto, select ou editor rico (TipTap): teclas são digitação */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable || target.closest('[contenteditable="true"], [contenteditable=""]')) return true;
  return false;
}

/** Algum diálogo/menu aberto: atalhos de uma letra ficam desligados */
export function hasOpenOverlay(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');
}

/** Tela que usa letras soltas (planilha): a tecla Q não abre a captura */
export function hasLetterKeyOwner(): boolean {
  return !!document.querySelector('[data-quick-capture-off]');
}

/** Atalho de uma letra sem modificadores, fora de campos de texto */
export function isPlainKey(e: KeyboardEvent): boolean {
  return !e.metaKey && !e.ctrlKey && !e.altKey && !e.isComposing && !isTypingTarget(e.target);
}
