// Saúde do projeto no card (Etapa 4, item 3). Puro e testado (src/test/projectHealth.test.ts).
//
// SEMÁFORO CALCULADO ("aberta" = não concluída nem cancelada; inclui Aguardando)
//   vermelho: alguma tarefa aberta com prazo vencido, ou marco não concluído
//             com data no passado;
//   amarelo:  marco não concluído nos próximos 7 dias (hoje incluído) com tarefas
//             pendentes, ou mais de 30% das tarefas abertas sem responsável
//             (a partir de 1 tarefa aberta). "Tarefas pendentes do marco" = as
//             abertas da fase do marco; marco sem fase = qualquer tarefa aberta
//             do projeto (D8);
//   verde:    nos outros casos.
// Projetos em Ideia, Concluído e Cancelado não têm semáforo.
//
// AJUSTE MANUAL (projects.health_override): vale no lugar do calculado e não
// expira. O card mostra "manual há N dias"; a partir de 14 dias, o aviso
// "revise o status manual", com a cor calculada na dica (D9).
//
// TAMBÉM NO CARD: próximo marco não concluído (o de data mais próxima, mesmo
// vencido), "parado há X dias" quando a tarefa atualizada mais recentemente
// passou de 7 dias (projeto sem tarefas não mostra), e a próxima ação: se ela
// foi concluída, cancelada ou saiu do projeto, "Defina a próxima ação" (D10).
import type { HealthColor, Milestone, Project, Task } from './types';
import { isTaskOpen } from './taskDates';

export const HEALTH_LABELS: Record<HealthColor, string> = { green: 'Em dia', yellow: 'Atenção', red: 'Em risco' };
export const STALE_AFTER_DAYS = 7;
export const REVIEW_MANUAL_AFTER_DAYS = 14;
export const UNASSIGNED_LIMIT = 0.3;
export const MILESTONE_WINDOW_DAYS = 7;

const NO_HEALTH: Project['status'][] = ['idea', 'completed', 'cancelled'];

export interface ProjectHealth {
  /** null = projeto sem semáforo (Ideia, Concluído, Cancelado) */
  color: HealthColor | null;
  calculated: HealthColor | null;
  manual: boolean;
  /** Dias desde o ajuste manual */
  manualDays: number | null;
  /** Ajuste manual com 14 dias ou mais */
  reviewManual: boolean;
  /** Motivos do calculado, para a dica */
  reasons: string[];
  nextMilestone: Milestone | null;
  /** Dias sem atualização em tarefas (só quando passa de 7) */
  staleDays: number | null;
  /** Próxima ação válida (aberta e do projeto) */
  nextAction: Task | null;
  /** Havia próxima ação, mas ela foi concluída/cancelada/movida */
  nextActionDone: boolean;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (timestamp: string) => {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function computeProjectHealth(
  project: Project,
  allTasks: Task[],
  allMilestones: Milestone[],
  today: string,
): ProjectHealth {
  const tasks = allTasks.filter(t => t.projectId === project.id);
  const milestones = allMilestones.filter(m => m.projectId === project.id);
  const open = tasks.filter(isTaskOpen);
  const todayN = dayNumber(today);
  const pendingMilestones = milestones
    .filter(m => !m.completed && m.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Próxima ação
  const candidate = project.nextActionTaskId ? allTasks.find(t => t.id === project.nextActionTaskId) : undefined;
  const nextAction = candidate && candidate.projectId === project.id && isTaskOpen(candidate) ? candidate : null;
  const nextActionDone = !!project.nextActionTaskId && !nextAction;

  // Parado
  const lastUpdate = tasks.map(t => t.updatedAt).filter(Boolean).sort().pop();
  const idle = lastUpdate ? todayN - dayNumber(localDate(lastUpdate)) : null;
  const staleDays = idle !== null && idle > STALE_AFTER_DAYS ? idle : null;

  const base = { nextMilestone: pendingMilestones[0] ?? null, staleDays, nextAction, nextActionDone };

  if (NO_HEALTH.includes(project.status)) {
    return { color: null, calculated: null, manual: false, manualDays: null, reviewManual: false, reasons: [], ...base };
  }

  // Calculado
  const reasons: string[] = [];
  const overdueTasks = open.filter(t => t.endDate && dayNumber(t.endDate) < todayN).length;
  const overdueMilestones = pendingMilestones.filter(m => dayNumber(m.date) < todayN).length;
  if (overdueTasks > 0) reasons.push(`${overdueTasks} ${overdueTasks === 1 ? 'tarefa com prazo vencido' : 'tarefas com prazo vencido'}`);
  if (overdueMilestones > 0) reasons.push(`${overdueMilestones} ${overdueMilestones === 1 ? 'marco vencido' : 'marcos vencidos'}`);

  let calculated: HealthColor = 'green';
  if (reasons.length > 0) {
    calculated = 'red';
  } else {
    const soon = pendingMilestones.filter(m => {
      const diff = dayNumber(m.date) - todayN;
      if (diff < 0 || diff > MILESTONE_WINDOW_DAYS) return false;
      return m.phaseId ? open.some(t => t.phaseId === m.phaseId) : open.length > 0;
    });
    if (soon.length > 0) reasons.push(`marco "${soon[0].name}" em até ${MILESTONE_WINDOW_DAYS} dias com tarefas pendentes`);
    const unassigned = open.filter(t => !t.responsibleIds || t.responsibleIds.length === 0).length;
    if (open.length > 0 && unassigned / open.length > UNASSIGNED_LIMIT) {
      reasons.push(`${Math.round((unassigned / open.length) * 100)}% das tarefas abertas sem responsável`);
    }
    if (reasons.length > 0) calculated = 'yellow';
  }

  const manual = !!project.healthOverride;
  const manualDays = manual && project.healthOverrideAt ? Math.max(0, todayN - dayNumber(localDate(project.healthOverrideAt))) : null;
  return {
    color: manual ? project.healthOverride! : calculated,
    calculated,
    manual,
    manualDays,
    reviewManual: manualDays !== null && manualDays >= REVIEW_MANUAL_AFTER_DAYS,
    reasons,
    ...base,
  };
}

/** Texto da dica: motivos do calculado e, se manual, a cor calculada */
export function healthTooltip(health: ProjectHealth): string {
  const calculated = health.calculated ? HEALTH_LABELS[health.calculated] : '';
  const why = health.reasons.length > 0 ? `: ${health.reasons.join('; ')}` : '';
  return health.manual
    ? `Ajuste manual${health.manualDays !== null ? ` há ${health.manualDays} ${health.manualDays === 1 ? 'dia' : 'dias'}` : ''}. Calculado: ${calculated}${why}`
    : `${calculated}${why}`;
}
