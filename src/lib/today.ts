// Regras da página Hoje (Etapa 3). Puro e testado (src/test/today.test.ts).
//
// QUAIS TAREFAS ENTRAM (decisão D3)
// - Projetos do usuário (projects.user_id = ele), incluindo a Caixa de entrada:
//     "Todas"          -> todas as tarefas;
//     "Só as minhas"   -> só as sem responsável ou em que ele é responsável.
// - Projetos de outras pessoas em que ele participa: só as tarefas em que ele
//   está entre os responsáveis (responsible_ids contém uma pessoa com
//   people.auth_user_id = ele), nos dois modos.
// - Projetos em Ideia (geladeira) nunca entram (Etapa 4).
//
// SEÇÕES E PRECEDÊNCIA (cada tarefa aparece em uma só, na primeira que casar)
//   1. Concluídas hoje: status concluído e completed_at no dia local de hoje.
//      Outras concluídas e as canceladas não aparecem.
//   1b. Aguardando (Etapa 4): sai de todas as outras seções e só aparece em
//      "Aguardando cobrança hoje" quando follow_up_date <= hoje.
//   2. Planejadas para hoje: planned_date = hoje. Vence "Atrasadas" para que
//      arrastar uma atrasada para cá (planned_date = hoje) tenha efeito; se o
//      prazo já passou, ganha o selo "prazo vencido".
//   3. Atrasadas: planned_date < hoje, ou end_date < hoje — exceto quando a
//      tarefa foi replanejada para um dia futuro (planned_date > hoje): aí ela
//      sai daqui e volta no dia planejado com o selo "prazo vencido" (D4).
//   4. Vencem hoje: end_date = hoje (planned_date não é hoje).
//   5. Aguardando cobrança hoje: tarefas Aguardando com cobrança vencida ou hoje.
// "Hoje" é sempre a data local do navegador (todayISO), nunca UTC.
import type { Project, Task, TaskPriority } from './types';

export type TodayScope = 'all' | 'mine';
export type TodaySectionKey = 'planned' | 'overdue' | 'dueToday' | 'waiting' | 'done';

export const SECTION_ORDER: TodaySectionKey[] = ['overdue', 'planned', 'dueToday', 'waiting', 'done'];

export interface TodayItem {
  task: Task;
  section: TodaySectionKey;
  /** Prazo (end_date) já passou */
  dueOverdue: boolean;
  /** "Tirar do dia" faz sentido: desativado quando o atraso é pelo prazo */
  canClearPlan: boolean;
}

export interface TodayContext {
  today: string;
  userId: string | null | undefined;
  /** ids de people ligados ao usuário (people.auth_user_id = userId) */
  myPersonIds: Set<string>;
  scope: TodayScope;
}

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const pad = (n: number) => String(n).padStart(2, '0');
/** Data local "YYYY-MM-DD" de um timestamp */
export const localDateOf = (timestamp: string): string => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Regra D3 + filtro "Só as minhas / Todas" */
export function isRelevantForToday(task: Task, project: Project | undefined, ctx: TodayContext): boolean {
  if (!project || !ctx.userId) return false;
  const responsible = task.responsibleIds ?? [];
  const mineByResponsible = responsible.some(id => ctx.myPersonIds.has(id));
  if (project.status === 'idea') return false;
  const ownProject = project.isInbox || project.userId === ctx.userId;
  if (!ownProject) return mineByResponsible;
  if (ctx.scope === 'all') return true;
  return responsible.length === 0 || mineByResponsible;
}

/** Seção da tarefa hoje, ou null se ela não aparece na página */
export function classifyForToday(task: Task, today: string): Omit<TodayItem, 'task'> | null {
  const dueOverdue = !!task.endDate && task.endDate.slice(0, 10) < today;
  const planned = task.plannedDate ? task.plannedDate.slice(0, 10) : null;
  const due = task.endDate ? task.endDate.slice(0, 10) : null;

  if (task.status === 'cancelled') return null;
  if (task.status === 'completed') {
    return task.completedAt && localDateOf(task.completedAt) === today
      ? { section: 'done', dueOverdue: false, canClearPlan: false }
      : null;
  }
  if (task.status === 'waiting') {
    const followUp = task.followUpDate ? task.followUpDate.slice(0, 10) : null;
    return followUp !== null && followUp <= today ? { section: 'waiting', dueOverdue, canClearPlan: false } : null;
  }
  if (planned === today) return { section: 'planned', dueOverdue, canClearPlan: !dueOverdue };
  if (planned !== null && planned < today) return { section: 'overdue', dueOverdue, canClearPlan: !dueOverdue };
  if (dueOverdue && !(planned !== null && planned > today)) return { section: 'overdue', dueOverdue, canClearPlan: false };
  if (due === today) return { section: 'dueToday', dueOverdue: false, canClearPlan: planned !== null };
  return null;
}

const byPriorityThenCreated = (a: Task, b: Task) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  (a.createdAt ?? a.updatedAt).localeCompare(b.createdAt ?? b.updatedAt);

/** Ordem manual primeiro; sem ordem, por prioridade e criação */
export const comparePlanned = (a: Task, b: Task) => {
  const ao = a.todayOrder ?? null;
  const bo = b.todayOrder ?? null;
  if (ao !== null && bo !== null && ao !== bo) return ao - bo;
  if (ao !== null && bo === null) return -1;
  if (ao === null && bo !== null) return 1;
  return byPriorityThenCreated(a, b);
};

const oldestDate = (t: Task) => [t.plannedDate, t.endDate].filter(Boolean).map(d => d!.slice(0, 10)).sort()[0] ?? '';

export type TodaySections = Record<TodaySectionKey, TodayItem[]>;

export function buildTodaySections(tasks: Task[], projectsById: Map<string, Project>, ctx: TodayContext): TodaySections {
  const sections: TodaySections = { planned: [], overdue: [], dueToday: [], waiting: [], done: [] };
  for (const task of tasks) {
    const c = classifyForToday(task, ctx.today);
    if (!c) continue;
    if (!isRelevantForToday(task, projectsById.get(task.projectId), ctx)) continue;
    sections[c.section].push({ task, ...c });
  }
  sections.planned.sort((a, b) => comparePlanned(a.task, b.task));
  sections.overdue.sort((a, b) => oldestDate(a.task).localeCompare(oldestDate(b.task)) || byPriorityThenCreated(a.task, b.task));
  sections.dueToday.sort((a, b) => byPriorityThenCreated(a.task, b.task));
  sections.waiting.sort((a, b) => (a.task.followUpDate ?? '').localeCompare(b.task.followUpDate ?? '') || byPriorityThenCreated(a.task, b.task));
  sections.done.sort((a, b) => (b.task.completedAt ?? '').localeCompare(a.task.completedAt ?? ''));
  return sections;
}

export interface TodaySummary {
  /** Planejadas + atrasadas + cobranças do dia (contador da barra lateral e card da Dashboard) */
  count: number;
  /** Cobranças do dia: Aguardando com follow_up_date <= hoje */
  followUps: number;
  plannedMinutes: number;
  /** Planejadas para hoje sem estimativa */
  missingEstimate: number;
}

export function summarize(sections: TodaySections): TodaySummary {
  return {
    count: sections.planned.length + sections.overdue.length + sections.waiting.length,
    followUps: sections.waiting.length,
    plannedMinutes: sections.planned.reduce((sum, item) => sum + (item.task.estimateMinutes ?? 0), 0),
    missingEstimate: sections.planned.filter(item => !item.task.estimateMinutes).length,
  };
}

// ---------- Ordem manual (today_order) ----------
export const ORDER_STEP = 1000;

/**
 * Coloca `movedId` na posição `targetIndex` da lista de "Planejadas para hoje"
 * (a lista pode ainda não ter a tarefa, quando ela vem de outra seção).
 * Devolve só as gravações necessárias: normalmente a tarefa movida, com um
 * valor entre os vizinhos; quando não há espaço ou os vizinhos não têm ordem,
 * renumera a lista toda em passos de 1000.
 */
export function planReorder(list: Task[], moved: Task, targetIndex: number): { id: string; todayOrder: number }[] {
  const rest = list.filter(t => t.id !== moved.id);
  const index = Math.max(0, Math.min(targetIndex, rest.length));
  const next = [...rest.slice(0, index), moved, ...rest.slice(index)];
  const prev = next[index - 1];
  const after = next[index + 1];
  const prevOrder = prev?.todayOrder ?? null;
  const afterOrder = after?.todayOrder ?? null;

  let value: number | null = null;
  if (!prev && !after) value = ORDER_STEP;
  else if (!prev && afterOrder !== null) value = afterOrder - ORDER_STEP;
  else if (prevOrder !== null && (!after || afterOrder === null)) value = prevOrder + ORDER_STEP;
  else if (prevOrder !== null && afterOrder !== null && afterOrder - prevOrder > 1) value = Math.floor((prevOrder + afterOrder) / 2);

  if (value !== null) return moved.todayOrder === value ? [] : [{ id: moved.id, todayOrder: value }];

  return next
    .map((t, i) => ({ id: t.id, todayOrder: (i + 1) * ORDER_STEP, current: t.todayOrder ?? null }))
    .filter(u => u.current !== u.todayOrder)
    .map(({ id, todayOrder }) => ({ id, todayOrder }));
}

/** Ordem para quem entra no fim do dia (h, "Adicionar ao dia") */
export function orderAtEnd(list: Task[]): number | null {
  const orders = list.map(t => t.todayOrder).filter((o): o is number => typeof o === 'number');
  return orders.length > 0 ? Math.max(...orders) + ORDER_STEP : null;
}
