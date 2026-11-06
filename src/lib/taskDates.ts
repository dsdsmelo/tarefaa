import type { Task } from './types';

// Datas de tarefa são "YYYY-MM-DD" (coluna DATE). Comparar como string no
// fuso local evita o bug de `new Date('YYYY-MM-DD')`, que interpreta em UTC
// e faz uma tarefa de hoje parecer atrasada desde a meia-noite UTC (21h BRT).

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const todayISO = (): string => toISODate(new Date());

export const addDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
};

/** Soma dias úteis (segunda a sexta; feriados não são considerados) */
export const addBusinessDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  let left = days;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) left--;
  }
  return toISODate(date);
};

export const isTaskOpen = (task: Task): boolean =>
  task.status !== 'completed' && task.status !== 'cancelled';

// Dias até a data: negativo = passou, 0 = hoje. null quando não há data.
export const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = todayISO().split('-').map(Number);
  const ms = new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime();
  return Math.round(ms / 86_400_000);
};

export const daysUntilDue = (task: Task): number | null => daysUntil(task.endDate);

export const formatDueLabel = (days: number | null): string => {
  if (days === null) return 'Sem prazo';
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days === -1) return 'Ontem';
  if (days < 0) return `${Math.abs(days)} dias atrás`;
  return `Em ${days} dias`;
};
