// Status "Aguardando" (Etapa 4): de quem se espera e quando cobrar.
// O banco garante: data de cobrança obrigatória, pessoa OU texto livre (até 120
// caracteres) e limpeza dos três campos ao sair de Aguardando (trigger
// task_waiting_fields).
import type { Person, Task } from './types';
import { addBusinessDaysISO } from './taskDates';

export const WAITING_TEXT_MAX = 120;
export const DEFAULT_FOLLOW_UP_BUSINESS_DAYS = 3;

/** Sugestão padrão da data de cobrança: daqui a 3 dias úteis */
export const defaultFollowUpDate = (today: string) => addBusinessDaysISO(today, DEFAULT_FOLLOW_UP_BUSINESS_DAYS);

export interface WaitingInput {
  waitingOnPersonId: string | null;
  waitingOnText: string | null;
  followUpDate: string;
}

/** Campos para marcar como Aguardando (um só "de quem") */
export function waitingUpdates(input: WaitingInput): Partial<Task> {
  const text = input.waitingOnText?.trim() || null;
  return {
    status: 'waiting',
    waitingOnPersonId: input.waitingOnPersonId,
    waitingOnText: input.waitingOnPersonId ? null : text,
    followUpDate: input.followUpDate,
  };
}

/** "Maria Silva", "cliente" ou null */
export function waitingOnLabel(task: Pick<Task, 'waitingOnPersonId' | 'waitingOnText'>, people: Pick<Person, 'id' | 'name'>[]): string | null {
  if (task.waitingOnPersonId) {
    return people.find(p => p.id === task.waitingOnPersonId)?.name ?? 'pessoa sem acesso';
  }
  return task.waitingOnText?.trim() || null;
}

/** Validação da tela (D4): de quem (pessoa ou texto) e data obrigatórios */
export function validateWaiting(input: { personId: string | null; text: string; followUpDate: string }): string | null {
  if (!input.personId && !input.text.trim()) return 'Diga de quem você está aguardando';
  if (input.text.trim().length > WAITING_TEXT_MAX) return `Use até ${WAITING_TEXT_MAX} caracteres`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.followUpDate)) return 'Escolha a data de cobrança';
  return null;
}
