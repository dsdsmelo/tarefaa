import { createContext, useContext } from 'react';

export interface QuickCaptureContextValue {
  openQuickCapture: () => void;
}

export const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null);

export function useQuickCapture(): QuickCaptureContextValue {
  const value = useContext(QuickCaptureContext);
  // Fora do provider (telas públicas) o botão simplesmente não faz nada
  return value ?? { openQuickCapture: () => {} };
}
