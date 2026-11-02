import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tarefaa-theme';

const readStoredTheme = (): Theme => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

// Aplica o tema salvo antes do primeiro render (evita piscar no claro)
export const initTheme = () => {
  document.documentElement.classList.toggle('dark', readStoredTheme() === 'dark');
};

// A classe `dark` no <html> é a fonte da verdade; o observer mantém
// sincronizados todos os componentes que exibem o seletor de tema.
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
};

const getSnapshot = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem storage (aba privada/bloqueada): o tema vale só para esta sessão
    }
  }, []);

  return { theme, setTheme };
};
