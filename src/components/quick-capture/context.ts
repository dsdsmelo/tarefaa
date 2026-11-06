import { createContext, useContext } from 'react';

export interface QuickCaptureContextValue {
  openQuickCapture: () => void;
}

export const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

const noop: QuickCaptureContextValue = {
  openQuickCapture: () => {
    // Quem chama está fora do QuickCaptureProvider (montado pelo MainLayout).
    // Uma página que usa o hook no próprio corpo fica ACIMA do provider e cai
    // aqui: o clique não faz nada. Em desenvolvimento, avisa.
    if (import.meta.env.DEV) {
      console.warn('[captura rápida] openQuickCapture chamado fora do QuickCaptureProvider: nada foi aberto.');
    }
  },
};

export function useQuickCapture(): QuickCaptureContextValue {
  return useContext(QuickCaptureContext) ?? noop;
}
