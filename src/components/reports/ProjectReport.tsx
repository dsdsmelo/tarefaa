import { Fragment, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calculatePercentage, isTaskOverdue } from '@/lib/mockData';
import {
  Project,
  Task,
  Phase,
  Milestone,
  Person,
  statusLabels,
  priorityLabels,
  projectStatusLabels,
  TaskStatus,
} from '@/lib/types';

interface ProjectReportProps {
  project: Project;
  tasks: Task[];
  phases: Phase[];
  milestones: Milestone[];
  people: Person[];
  onClose: () => void;
}

// Parse "YYYY-MM-DD" as UTC noon (evita problemas de timezone/meia-noite)
const parseDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '') : '—';

const statusColor: Record<TaskStatus, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  blocked: '#ef4444',
  completed: '#10b981',
  cancelled: '#9ca3af',
};

const barColor = (task: Task) => {
  if (isTaskOverdue(task)) return '#ef4444';
  return statusColor[task.status];
};

// CSS de impressão: esconde o app e imprime só o relatório, com cores fiéis
const PRINT_CSS = `
@media screen {
  .tf-report-root { position: fixed; inset: 0; z-index: 100; overflow: auto; background: rgba(15, 23, 42, 0.55); }
}
@media print {
  @page { size: A4; margin: 10mm; }
  html, body { background: #ffffff !important; }
  body > #root { display: none !important; }
  .tf-report-root { position: static !important; background: #ffffff !important; overflow: visible !important; }
  .tf-no-print { display: none !important; }
  .tf-report { box-shadow: none !important; margin: 0 !important; width: auto !important; max-width: none !important; border-radius: 0 !important; padding: 0 !important; }
  .tf-report, .tf-report * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .tf-avoid-break { break-inside: avoid; }
}
`;

export function ProjectReport({ project, tasks, phases, milestones, people, onClose }: ProjectReportProps) {
  // Fecha com ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const orderedPhases = useMemo(() => [...phases].sort((a, b) => a.order - b.order), [phases]);

  const personName = (id: string) => people.find(p => p.id === id)?.name || '—';
  const responsibleNames = (task: Task) => {
    const names = (task.responsibleIds || []).map(personName).filter(n => n && n !== '—');
    return names.length ? names.join(', ') : '—';
  };

  // Resumo
  const summary = useMemo(() => {
    const total = tasks.length;
    const byStatus = (s: TaskStatus) => tasks.filter(t => t.status === s).length;
    const avgProgress = total > 0
      ? Math.round(tasks.reduce((acc, t) => acc + calculatePercentage(t), 0) / total)
      : 0;
    return {
      total,
      pending: byStatus('pending'),
      inProgress: byStatus('in_progress'),
      blocked: byStatus('blocked'),
      completed: byStatus('completed'),
      cancelled: byStatus('cancelled'),
      avgProgress,
    };
  }, [tasks]);

  // Faixa de datas do cronograma
  const range = useMemo(() => {
    const dates: string[] = [];
    tasks.forEach(t => { if (t.startDate) dates.push(t.startDate); if (t.endDate) dates.push(t.endDate); });
    phases.forEach(p => { if (p.startDate) dates.push(p.startDate); if (p.endDate) dates.push(p.endDate); });
    milestones.forEach(m => { if (m.date) dates.push(m.date); });
    if (project.startDate) dates.push(project.startDate);
    if (project.endDate) dates.push(project.endDate);

    if (dates.length === 0) return null;

    const parsed = dates.map(parseDate);
    let min = new Date(Math.min(...parsed.map(d => d.getTime())));
    let max = new Date(Math.max(...parsed.map(d => d.getTime())));
    // padding: começa no 1º dia do mês do início, termina no fim do mês do fim
    min = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1, 12, 0, 0));
    max = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth() + 1, 0, 12, 0, 0));
    return { start: min, end: max };
  }, [tasks, phases, milestones, project]);

  const totalMs = range ? range.end.getTime() - range.start.getTime() : 1;

  const pos = (start?: string | null, end?: string | null) => {
    if (!range || !start) return null;
    const s = parseDate(start);
    const e = end ? parseDate(end) : s;
    const left = ((s.getTime() - range.start.getTime()) / totalMs) * 100;
    const width = Math.max(((e.getTime() - s.getTime()) / totalMs) * 100, 0.6);
    return { left: `${left}%`, width: `${width}%` };
  };

  const datePos = (d: string) => {
    if (!range) return '0%';
    return `${((parseDate(d).getTime() - range.start.getTime()) / totalMs) * 100}%`;
  };

  // Colunas de mês para o cabeçalho e as linhas de grade
  const months = useMemo(() => {
    if (!range) return [] as { left: string; label: string }[];
    const cols: { left: string; label: string }[] = [];
    const cur = new Date(range.start);
    while (cur <= range.end) {
      cols.push({
        left: `${((cur.getTime() - range.start.getTime()) / totalMs) * 100}%`,
        label: cur.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', ''),
      });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return cols;
  }, [range, totalMs]);

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const todayLeft = range && parseDate(todayStr) >= range.start && parseDate(todayStr) <= range.end
    ? datePos(todayStr)
    : null;

  const tasksByPhase = (phaseId: string) => tasks.filter(t => t.phaseId === phaseId);
  const tasksNoPhase = tasks.filter(t => !t.phaseId);

  const generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

  const LABEL_W = 172; // largura da coluna de rótulos no cronograma

  // Linha de grade + linha "hoje" reutilizável dentro da área do gráfico
  const GridLines = () => (
    <>
      {months.map((m, i) => (
        <div key={i} className="absolute top-0 bottom-0 border-l border-slate-200" style={{ left: m.left }} />
      ))}
      {todayLeft && (
        <div className="absolute top-0 bottom-0 border-l-2 border-rose-400" style={{ left: todayLeft }} />
      )}
    </>
  );

  const report = (
    <div className="tf-report-root" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{PRINT_CSS}</style>

      {/* Toolbar (não sai na impressão) */}
      <div className="tf-no-print sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-900/90 px-5 py-3 backdrop-blur">
        <span className="text-sm font-medium text-white">Pré-visualização do relatório</span>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gradient-primary text-white" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Fechar
          </Button>
        </div>
      </div>

      {/* Folha do relatório */}
      <div className="tf-report mx-auto my-6 w-[820px] max-w-[94vw] rounded-lg bg-white p-8 text-slate-800 shadow-2xl">
        {/* Cabeçalho */}
        <div className="tf-avoid-break flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-start gap-4">
            {project.imageUrl && (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1">
                <img src={project.imageUrl} alt={project.name} className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Relatório de acompanhamento</p>
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              {project.description && (
                <p className="mt-1 max-w-xl text-sm text-slate-500">{project.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor[project.status === 'completed' ? 'completed' : project.status === 'active' ? 'in_progress' : 'pending'] }} />
                  {projectStatusLabels[project.status]}
                </span>
                {(project.startDate || project.endDate) && (
                  <span>{fmtDate(project.startDate)} → {fmtDate(project.endDate)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-4xl font-bold leading-none text-slate-900">{summary.avgProgress}%</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Progresso geral</div>
          </div>
        </div>

        {/* Resumo em tiles */}
        <div className="tf-avoid-break mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: 'Tarefas', value: summary.total, color: '#334155' },
            { label: 'Concluídas', value: summary.completed, color: statusColor.completed },
            { label: 'Em andamento', value: summary.inProgress, color: statusColor.in_progress },
            { label: 'Pendentes', value: summary.pending, color: statusColor.pending },
            { label: 'Bloqueadas', value: summary.blocked, color: statusColor.blocked },
            { label: 'Marcos', value: milestones.length, color: '#6366f1' },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="text-xl font-bold" style={{ color: tile.color }}>{tile.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{tile.label}</div>
            </div>
          ))}
        </div>

        {/* Cronograma visual */}
        <div className="mt-7">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Cronograma</h2>

          {!range ? (
            <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
              Sem datas suficientes para montar o cronograma.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {/* Cabeçalho de meses */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                <div className="shrink-0" style={{ width: LABEL_W }} />
                <div className="relative h-6 flex-1">
                  {months.map((m, i) => (
                    <span key={i} className="absolute top-1 whitespace-nowrap pl-1 text-[10px] font-medium uppercase text-slate-400" style={{ left: m.left }}>
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Linha de marcos (todos os marcos posicionados por data) */}
              {milestones.length > 0 && (
                <div className="tf-avoid-break flex items-center border-b border-slate-100">
                  <div className="shrink-0 px-3 py-1.5 text-[11px] font-medium text-slate-500" style={{ width: LABEL_W }}>Marcos</div>
                  <div className="relative h-6 flex-1">
                    <GridLines />
                    {milestones.map((m) => (
                      <div key={m.id} className="absolute top-1/2" style={{ left: datePos(m.date), transform: 'translate(-50%, -50%)' }} title={`${m.name} — ${fmtDate(m.date)}`}>
                        <div className="h-2.5 w-2.5 rotate-45 rounded-[2px] border border-white" style={{ backgroundColor: m.color || '#6366f1' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fases + tarefas */}
              {orderedPhases.map((phase) => {
                const p = pos(phase.startDate, phase.endDate);
                const phaseColor = phase.color || '#f59e0b';
                const pTasks = tasksByPhase(phase.id);
                return (
                  <div key={phase.id} className="tf-avoid-break">
                    {/* Barra da fase */}
                    <div className="flex items-center border-b border-slate-100 bg-slate-50/60">
                      <div className="shrink-0 truncate px-3 py-1.5 text-[11px] font-semibold text-slate-700" style={{ width: LABEL_W }} title={phase.name}>
                        {phase.name}
                      </div>
                      <div className="relative h-6 flex-1">
                        <GridLines />
                        {p && (
                          <div className="absolute top-1/2 h-3 rounded" style={{ left: p.left, width: p.width, minWidth: 6, backgroundColor: phaseColor, transform: 'translateY(-50%)' }} />
                        )}
                      </div>
                    </div>
                    {/* Tarefas da fase */}
                    {pTasks.map((task) => {
                      const tp = pos(task.startDate, task.endDate);
                      const prog = calculatePercentage(task);
                      return (
                        <div key={task.id} className="flex items-center border-b border-slate-50">
                          <div className="shrink-0 truncate py-1 pl-6 pr-3 text-[11px] text-slate-600" style={{ width: LABEL_W }} title={task.name}>
                            {task.name}
                          </div>
                          <div className="relative h-5 flex-1">
                            <GridLines />
                            {tp && (
                              <div className="absolute top-1/2 h-2.5 overflow-hidden rounded" style={{ left: tp.left, width: tp.width, minWidth: 5, backgroundColor: barColor(task), transform: 'translateY(-50%)' }}>
                                {prog > 0 && prog < 100 && (
                                  <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${prog}%` }} />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Tarefas sem fase */}
              {tasksNoPhase.length > 0 && (
                <div className="tf-avoid-break">
                  <div className="flex items-center border-b border-slate-100 bg-slate-50/60">
                    <div className="shrink-0 px-3 py-1.5 text-[11px] font-semibold text-slate-500" style={{ width: LABEL_W }}>Sem fase</div>
                    <div className="relative h-6 flex-1"><GridLines /></div>
                  </div>
                  {tasksNoPhase.map((task) => {
                    const tp = pos(task.startDate, task.endDate);
                    const prog = calculatePercentage(task);
                    return (
                      <div key={task.id} className="flex items-center border-b border-slate-50">
                        <div className="shrink-0 truncate py-1 pl-6 pr-3 text-[11px] text-slate-600" style={{ width: LABEL_W }} title={task.name}>
                          {task.name}
                        </div>
                        <div className="relative h-5 flex-1">
                          <GridLines />
                          {tp && (
                            <div className="absolute top-1/2 h-2.5 overflow-hidden rounded" style={{ left: tp.left, width: tp.width, minWidth: 5, backgroundColor: barColor(task), transform: 'translateY(-50%)' }}>
                              {prog > 0 && prog < 100 && (
                                <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${prog}%` }} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Legenda */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
            {(['pending', 'in_progress', 'blocked', 'completed'] as TaskStatus[]).map(s => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: statusColor[s] }} />
                {statusLabels[s]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rotate-45 rounded-[2px]" style={{ backgroundColor: '#6366f1' }} />
              Marco
            </span>
            {todayLeft && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-0.5 bg-rose-400" />
                Hoje
              </span>
            )}
          </div>
        </div>

        {/* Tabela de tarefas por fase */}
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tarefas</h2>
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">Nenhuma tarefa cadastrada.</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="py-1.5 pr-2 font-medium">Tarefa</th>
                  <th className="py-1.5 pr-2 font-medium">Responsável</th>
                  <th className="py-1.5 pr-2 font-medium">Status</th>
                  <th className="py-1.5 pr-2 font-medium">Prioridade</th>
                  <th className="py-1.5 pr-2 font-medium">Início</th>
                  <th className="py-1.5 pr-2 font-medium">Fim</th>
                  <th className="py-1.5 pr-1 text-right font-medium">Progresso</th>
                </tr>
              </thead>
              <tbody>
                {[...orderedPhases.map(p => ({ id: p.id, name: p.name, list: tasksByPhase(p.id) })),
                  ...(tasksNoPhase.length ? [{ id: '__none', name: 'Sem fase', list: tasksNoPhase }] : [])]
                  .filter(g => g.list.length > 0)
                  .map(group => (
                    <Fragment key={group.id}>
                      <tr className="tf-avoid-break bg-slate-50">
                        <td colSpan={7} className="px-1 py-1 text-[11px] font-semibold text-slate-600">{group.name}</td>
                      </tr>
                      {group.list.map(task => (
                        <tr key={task.id} className="tf-avoid-break border-b border-slate-100 align-top">
                          <td className="py-1.5 pr-2 text-slate-800">{task.name}</td>
                          <td className="py-1.5 pr-2 text-slate-600">{responsibleNames(task)}</td>
                          <td className="py-1.5 pr-2">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor[task.status] }} />
                              {statusLabels[task.status]}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2 text-slate-600">{priorityLabels[task.priority]}</td>
                          <td className="py-1.5 pr-2 whitespace-nowrap text-slate-600">{fmtDate(task.startDate)}</td>
                          <td className="py-1.5 pr-2 whitespace-nowrap text-slate-600">{fmtDate(task.endDate)}</td>
                          <td className="py-1.5 pr-1 text-right font-medium text-slate-700">{calculatePercentage(task)}%</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Marcos (lista) */}
        {milestones.length > 0 && (
          <div className="tf-avoid-break mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Marcos</h2>
            <table className="w-full border-collapse text-xs">
              <tbody>
                {[...milestones].sort((a, b) => a.date.localeCompare(b.date)).map(m => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rotate-45 rounded-[2px]" style={{ backgroundColor: m.color || '#6366f1' }} />
                        {m.name}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap text-slate-600">{fmtDate(m.date)}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{m.phaseId ? (phases.find(p => p.id === m.phaseId)?.name || '') : ''}</td>
                    <td className="py-1.5 pr-1 text-right text-slate-500">{m.completed ? 'Concluído' : 'Pendente'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé */}
        <div className="mt-8 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
          Gerado em {generatedAt} · Tarefaa
        </div>
      </div>
    </div>
  );

  return createPortal(report, document.body);
}
