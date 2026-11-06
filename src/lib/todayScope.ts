// Filtro "Só as minhas / Todas" da página Hoje, salvo por usuário no navegador.
// A barra lateral e a Dashboard leem o mesmo valor (useSyncExternalStore).
import { useCallback, useSyncExternalStore } from 'react';
import type { TodayScope } from './today';

const EVENT = 'tarefaa:today-scope';
const storageKey = (userId: string) => `tarefaa.today.scope.${userId}`;

// Sem localStorage (bloqueado, aba anônima restrita) a escolha vale até recarregar
const memory = new Map<string, TodayScope>();

export function readTodayScope(userId: string | null | undefined): TodayScope {
  if (!userId) return 'all';
  try {
    return window.localStorage.getItem(storageKey(userId)) === 'mine' ? 'mine' : 'all';
  } catch {
    return memory.get(userId) ?? 'all';
  }
}

export function writeTodayScope(userId: string | null | undefined, scope: TodayScope) {
  if (!userId) return;
  memory.set(userId, scope);
  try { window.localStorage.setItem(storageKey(userId), scope); } catch { /* fica só em memória */ }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
};

export function useTodayScope(userId: string | null | undefined): [TodayScope, (scope: TodayScope) => void] {
  const getSnapshot = useCallback(() => readTodayScope(userId), [userId]);
  const scope = useSyncExternalStore(subscribe, getSnapshot, () => 'all' as TodayScope);
  const setScope = useCallback((next: TodayScope) => writeTodayScope(userId, next), [userId]);
  return [scope, setScope];
}
