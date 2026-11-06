import type { CustomColumn } from './types';

export interface StandardColumnDef {
  name: string;
  type: CustomColumn['type'];
  standardField: NonNullable<CustomColumn['standardField']>;
  order: number;
  /** Criada oculta: fica disponível no gerenciador de colunas para o usuário mostrar */
  hidden?: boolean;
}

/**
 * Colunas padrão da tabela de tarefas. Projetos novos recebem todas; o
 * "Restaurar Padrão" do gerenciador acrescenta só as que faltam, no fim, sem
 * mexer nas existentes. "Planejado para" e "Estimativa" (Etapa 3) nascem ocultas.
 */
export const STANDARD_COLUMNS: StandardColumnDef[] = [
  { name: 'Tarefa', type: 'text', standardField: 'name', order: 1 },
  { name: 'Descrição', type: 'text', standardField: 'description', order: 2 },
  { name: 'Responsável', type: 'user', standardField: 'responsible', order: 3 },
  { name: 'Status', type: 'list', standardField: 'status', order: 4 },
  { name: 'Prioridade', type: 'list', standardField: 'priority', order: 5 },
  { name: 'Data Início', type: 'date', standardField: 'startDate', order: 6 },
  { name: 'Data Fim', type: 'date', standardField: 'endDate', order: 7 },
  { name: 'Progresso', type: 'percentage', standardField: 'progress', order: 8 },
  { name: 'Planejado para', type: 'date', standardField: 'plannedDate', order: 9, hidden: true },
  { name: 'Estimativa', type: 'number', standardField: 'estimate', order: 10, hidden: true },
];

export const STANDARD_FIELD_LABELS: Record<NonNullable<CustomColumn['standardField']>, string> = {
  name: 'Nome da Tarefa',
  description: 'Descrição',
  responsible: 'Responsável',
  status: 'Status',
  priority: 'Prioridade',
  startDate: 'Data de Início',
  endDate: 'Data de Fim',
  progress: 'Progresso',
  plannedDate: 'Planejado para',
  estimate: 'Estimativa',
};

/** Colunas padrão que o projeto ainda não tem (entre as ativas) */
export function missingStandardColumns(existing: Pick<CustomColumn, 'standardField'>[]): StandardColumnDef[] {
  const have = new Set(existing.map(c => c.standardField).filter(Boolean));
  return STANDARD_COLUMNS.filter(def => !have.has(def.standardField));
}
