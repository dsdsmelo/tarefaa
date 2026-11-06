// Conversão dos objetos do app para colunas do banco (insert e update).
//
// REGRA DE "LIMPAR" (Etapa 4, item 5): em um campo que aceita null, se a chave
// veio no objeto, ela é gravada, mesmo vazia. undefined, '' (ou só espaços) e
// lista vazia viram null. Chave ausente = não mexe. Campos obrigatórios (nome,
// status, prioridade, projeto...) só são enviados quando têm valor.
// Testado em src/test/dbMappers.test.ts.
import type { Milestone, Person, Phase, Project, Task, Cell } from './types';

type Row = Record<string, unknown>;

const blankToNull = (value: unknown): unknown => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return value;
};

/** Campo que aceita null: presente no objeto = grava (vazio vira null) */
function nullable<T extends object>(row: Row, obj: T, key: keyof T, column: string) {
  if (key in obj) row[column] = blankToNull(obj[key]);
}

/** Campo obrigatório: só grava quando tem valor */
function required<T extends object>(row: Row, obj: T, key: keyof T, column: string) {
  if (obj[key] !== undefined) row[column] = obj[key];
}

export function taskToDb(task: Partial<Task>): Row {
  const row: Row = {};
  required(row, task, 'name', 'name');
  required(row, task, 'projectId', 'project_id');
  required(row, task, 'status', 'status');
  required(row, task, 'priority', 'priority');
  required(row, task, 'updatedAt', 'updated_at');
  nullable(row, task, 'description', 'description');
  nullable(row, task, 'phaseId', 'phase_id');
  nullable(row, task, 'cellId', 'cell_id');
  nullable(row, task, 'deviceId', 'device_id');
  if ('responsibleIds' in task) {
    row.responsible_ids = blankToNull(task.responsibleIds);
    // Campo antigo de responsável único: sem zerar, o app voltaria a lê-lo
    // quando responsible_ids fica vazio (mapTask usa como fallback)
    row.responsible_id = null;
  }
  nullable(row, task, 'quantity', 'quantity');
  nullable(row, task, 'collected', 'collected');
  nullable(row, task, 'startDate', 'start_date');
  nullable(row, task, 'endDate', 'end_date');
  nullable(row, task, 'sprintDate', 'sprint_date');
  nullable(row, task, 'plannedDate', 'planned_date');
  nullable(row, task, 'estimateMinutes', 'estimate_minutes');
  nullable(row, task, 'todayOrder', 'today_order');
  nullable(row, task, 'observation', 'observation');
  nullable(row, task, 'waitingOnPersonId', 'waiting_on_person_id');
  nullable(row, task, 'waitingOnText', 'waiting_on_text');
  nullable(row, task, 'followUpDate', 'follow_up_date');
  // jsonb com default '{}': vazio grava {}
  if ('customValues' in task) row.custom_values = task.customValues ?? {};
  // completed_at não é enviado: o trigger set_task_completed_at é quem grava
  return row;
}

export function projectToDb(project: Partial<Project>): Row {
  const row: Row = {};
  required(row, project, 'workspaceId', 'workspace_id');
  required(row, project, 'name', 'name');
  required(row, project, 'status', 'status');
  nullable(row, project, 'description', 'description');
  nullable(row, project, 'startDate', 'start_date');
  nullable(row, project, 'endDate', 'end_date');
  nullable(row, project, 'coverColor', 'cover_color');
  nullable(row, project, 'imageUrl', 'image_url');
  nullable(row, project, 'healthOverride', 'health_override');
  nullable(row, project, 'nextActionTaskId', 'next_action_task_id');
  // health_override_at não é enviado: o trigger do banco é quem grava
  return row;
}

export function phaseToDb(phase: Partial<Phase>): Row {
  const row: Row = {};
  required(row, phase, 'name', 'name');
  required(row, phase, 'order', 'order');
  required(row, phase, 'projectId', 'project_id');
  nullable(row, phase, 'color', 'color');
  nullable(row, phase, 'startDate', 'start_date');
  nullable(row, phase, 'endDate', 'end_date');
  nullable(row, phase, 'description', 'description');
  return row;
}

export function milestoneToDb(milestone: Partial<Milestone>): Row {
  const row: Row = {};
  required(row, milestone, 'name', 'name');
  required(row, milestone, 'projectId', 'project_id');
  required(row, milestone, 'date', 'date');
  required(row, milestone, 'completed', 'completed');
  nullable(row, milestone, 'phaseId', 'phase_id');
  nullable(row, milestone, 'description', 'description');
  nullable(row, milestone, 'color', 'color');
  return row;
}

export function personToDb(person: Partial<Person>): Row {
  const row: Row = {};
  required(row, person, 'name', 'name');
  required(row, person, 'type', 'type');
  required(row, person, 'color', 'color');
  required(row, person, 'active', 'active');
  required(row, person, 'inviteStatus', 'invite_status');
  // Vínculo com a conta: só o convite muda; nunca zera por acidente
  required(row, person, 'authUserId', 'auth_user_id');
  nullable(row, person, 'email', 'email');
  nullable(row, person, 'firstName', 'first_name');
  nullable(row, person, 'lastName', 'last_name');
  nullable(row, person, 'avatarUrl', 'avatar_url');
  nullable(row, person, 'workspaceId', 'workspace_id');
  return row;
}

export function cellToDb(cell: Partial<Cell>): Row {
  const row: Row = {};
  required(row, cell, 'name', 'name');
  required(row, cell, 'active', 'active');
  nullable(row, cell, 'description', 'description');
  return row;
}

/** Valor de campo personalizado: vazio remove a chave (em vez de gravar "") */
export function withCustomValue(
  values: Record<string, string | number> | undefined,
  columnId: string,
  value: string | number | null | undefined,
): Record<string, string | number> {
  const next = { ...(values ?? {}) };
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    delete next[columnId];
  } else {
    next[columnId] = value;
  }
  return next;
}
