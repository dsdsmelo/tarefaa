import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Ban,
  CircleDashed,
  Check,
  Clock,
  Bell,
  FolderKanban,
  ArrowRight,
  CheckCircle2,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageBody } from '@/components/layout/PageBody';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { priorityLabels, type Task, type TaskPriority } from '@/lib/types';
import type { ReminderTemplateData } from '@/lib/spreadsheet-types';
import { addDaysISO, daysUntil, daysUntilDue, formatDueLabel, isTaskOpen, todayISO } from '@/lib/taskDates';

type AttentionKey = 'atrasadas' | 'hoje' | 'semana' | 'bloqueadas' | 'sem-prazo';

const ATTENTION_VIEWS: { key: AttentionKey; label: string; hint: string; icon: LucideIcon; tone: string; iconBg: string }[] = [
  { key: 'atrasadas', label: 'Atrasadas', hint: 'prazo já passou', icon: AlertTriangle, tone: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-500/10' },
  { key: 'hoje', label: 'Vencem hoje', hint: 'prazo é hoje', icon: CalendarClock, tone: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-500/10' },
  { key: 'semana', label: 'Próximos 7 dias', hint: 'para planejar', icon: CalendarDays, tone: 'text-primary', iconBg: 'bg-primary/10' },
  { key: 'bloqueadas', label: 'Bloqueadas', hint: 'aguardando algo', icon: Ban, tone: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-500/10' },
  { key: 'sem-prazo', label: 'Sem prazo', hint: 'defina uma data', icon: CircleDashed, tone: 'text-muted-foreground', iconBg: 'bg-muted' },
];

const EMPTY_MESSAGES: Record<AttentionKey, string> = {
  atrasadas: 'Nenhuma tarefa atrasada.',
  hoje: 'Nada vence hoje.',
  semana: 'Nada vence nos próximos 7 dias.',
  bloqueadas: 'Nenhuma tarefa bloqueada.',
  'sem-prazo': 'Todas as tarefas abertas têm prazo.',
};

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

const POSTPONE_OPTIONS = [
  { label: 'Hoje', days: 0 },
  { label: 'Amanhã', days: 1 },
  { label: 'Em 3 dias', days: 3 },
  { label: 'Em 1 semana', days: 7 },
];

const MAX_ROWS = 30;

const taskLink = (task: Task) => `/projects/${task.projectId}?tab=tasks&tarefa=${task.id}`;

const byDueThenPriority = (a: Task, b: Task) =>
  (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999') ||
  PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];

const Dashboard = () => {
  const {
    projects = [],
    tasks = [],
    people = [],
    meetingNotes = [],
    loading,
    error,
    activeWorkspace,
    updateTask,
    inboxTasks = [],
  } = useData();
  // Caixa de entrada vale para todos os workspaces
  const toTriage = inboxTasks.filter(isTaskOpen).length;
  const [searchParams, setSearchParams] = useSearchParams();

  const projectName = (projectId: string) => projects.find(p => p.id === projectId)?.name || '-';
  const responsibleNames = (task: Task) =>
    (task.responsibleIds ?? [])
      .map(id => people.find(p => p.id === id)?.name.split(' ')[0])
      .filter(Boolean)
      .join(', ');

  // Classificação das tarefas abertas pelo que pedem de ação.
  // "Bloqueadas" é transversal: a tarefa também aparece no grupo do seu prazo.
  const groups = useMemo(() => {
    const result: Record<AttentionKey, Task[]> = {
      atrasadas: [], hoje: [], semana: [], bloqueadas: [], 'sem-prazo': [],
    };
    for (const task of tasks) {
      if (!isTaskOpen(task)) continue;
      const days = daysUntilDue(task);
      if (task.status === 'blocked') result.bloqueadas.push(task);
      if (days === null) result['sem-prazo'].push(task);
      else if (days < 0) result.atrasadas.push(task);
      else if (days === 0) result.hoje.push(task);
      else if (days <= 7) result.semana.push(task);
    }
    (Object.keys(result) as AttentionKey[]).forEach(key => result[key].sort(byDueThenPriority));
    return result;
  }, [tasks]);

  // A visão escolhida fica na URL (?ver=atrasadas): dá para favoritar e voltar
  const viewParam = searchParams.get('ver') as AttentionKey | null;
  const activeView: AttentionKey =
    viewParam && ATTENTION_VIEWS.some(v => v.key === viewParam)
      ? viewParam
      : (['atrasadas', 'hoje', 'semana'] as AttentionKey[]).find(key => groups[key].length > 0) ?? 'semana';
  const activeViewMeta = ATTENTION_VIEWS.find(v => v.key === activeView)!;
  const activeTasks = groups[activeView];

  const selectView = (key: AttentionKey) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('ver', key);
      return next;
    }, { replace: true });
  };

  // Lembretes das anotações (categoria "Lembrete") ainda não concluídos
  const reminders = useMemo(() => {
    return meetingNotes
      .filter(note => note.category === 'reminder')
      .map(note => {
        const data = note.templateData as ReminderTemplateData | undefined;
        return { note, data, days: daysUntil(data?.deadline) };
      })
      .filter(r => r.data?.status !== 'completed')
      .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity))
      .slice(0, 5);
  }, [meetingNotes]);

  // Projetos em andamento, priorizando os que têm atraso
  const projectHealth = useMemo(() => {
    return projects
      .filter(p => p.status === 'active' || p.status === 'planning')
      .map(project => {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const completed = projectTasks.filter(t => t.status === 'completed').length;
        const overdue = projectTasks.filter(t => isTaskOpen(t) && (daysUntilDue(t) ?? 0) < 0).length;
        const total = projectTasks.length;
        return { project, completed, overdue, total, progress: total > 0 ? Math.round((completed / total) * 100) : 0 };
      })
      .sort((a, b) => b.overdue - a.overdue || a.project.name.localeCompare(b.project.name))
      .slice(0, 6);
  }, [projects, tasks]);

  const statusSummary = useMemo(() => {
    const count = (status: Task['status']) => tasks.filter(t => t.status === status).length;
    return [
      { label: 'Pendentes', value: count('pending'), color: 'bg-status-pending' },
      { label: 'Em progresso', value: count('in_progress'), color: 'bg-status-progress' },
      { label: 'Bloqueadas', value: count('blocked'), color: 'bg-status-blocked' },
      { label: 'Concluídas', value: count('completed'), color: 'bg-status-completed' },
    ];
  }, [tasks]);
  const statusTotal = statusSummary.reduce((acc, s) => acc + s.value, 0);

  const handleComplete = async (task: Task) => {
    const previousStatus = task.status;
    try {
      await updateTask(task.id, { status: 'completed' });
      toast.success(`"${task.name}" concluída`, {
        action: {
          label: 'Desfazer',
          onClick: () => { void updateTask(task.id, { status: previousStatus }); },
        },
      });
    } catch (err) {
      console.error('Erro ao concluir tarefa:', err);
      toast.error('Não foi possível concluir a tarefa');
    }
  };

  const handlePostpone = async (task: Task, days: number) => {
    const newEnd = addDaysISO(todayISO(), days);
    const updates: Partial<Task> = { endDate: newEnd };
    // Evita início depois do prazo (quebraria o Gantt)
    if (task.startDate && task.startDate.slice(0, 10) > newEnd) updates.startDate = newEnd;
    const previous: Partial<Task> = { endDate: task.endDate, startDate: task.startDate };
    try {
      await updateTask(task.id, updates);
      toast.success(`Prazo de "${task.name}" movido para ${formatDueLabel(days).toLowerCase()}`, {
        action: {
          label: 'Desfazer',
          onClick: () => { void updateTask(task.id, previous); },
        },
      });
    } catch (err) {
      console.error('Erro ao mudar prazo:', err);
      toast.error('Não foi possível mudar o prazo');
    }
  };

  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const subtitle = `${todayLabel.charAt(0).toUpperCase()}${todayLabel.slice(1)}${activeWorkspace ? ` · ${activeWorkspace.name}` : ''}`;

  // Only show skeleton on very first load when no data exists yet
  const hasData = tasks.length > 0 || projects.length > 0 || people.length > 0;
  if (loading && !hasData) {
    return (
      <MainLayout>
        <Header title="Dashboard" subtitle={subtitle} />
        <PageBody>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[92px] rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-96 rounded-xl lg:col-span-2" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </PageBody>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <Header title="Dashboard" subtitle={subtitle} />
        <div className="flex items-center justify-center h-96">
          <div className="text-center text-destructive">
            <p className="font-medium mb-2">Erro ao carregar dados</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Dashboard" subtitle={subtitle} />

      <PageBody>
        {/* Indicadores de atenção: cada card filtra a lista abaixo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            to="/inbox"
            className={cn(
              'text-left bg-card rounded-xl border p-4 transition-colors hover:border-primary/40',
              toTriage > 0 ? 'border-primary/30' : 'border-border'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Para triar</span>
              <span className="w-7 h-7 rounded-md flex items-center justify-center bg-primary/10">
                <Inbox className="w-3.5 h-3.5 text-primary" />
              </span>
            </div>
            <p className={cn('text-2xl font-semibold mt-1 tabular-nums', toTriage > 0 ? 'text-primary' : 'text-foreground')}>{toTriage}</p>
            <p className="text-xs text-muted-foreground">na caixa de entrada</p>
          </Link>
          {ATTENTION_VIEWS.map(view => {
            const count = groups[view.key].length;
            const selected = view.key === activeView;
            return (
              <button
                key={view.key}
                onClick={() => selectView(view.key)}
                className={cn(
                  'text-left bg-card rounded-xl border p-4 transition-colors',
                  selected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{view.label}</span>
                  <span className={cn('w-7 h-7 rounded-md flex items-center justify-center', view.iconBg)}>
                    <view.icon className={cn('w-3.5 h-3.5', view.tone)} />
                  </span>
                </div>
                <p className={cn('text-2xl font-semibold mt-1 tabular-nums', count > 0 ? view.tone : 'text-foreground')}>{count}</p>
                <p className="text-xs text-muted-foreground">{view.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista do que precisa de atenção: no desktop acompanha a altura da
              coluna da direita e rola por dentro, para as colunas alinharem */}
          <div className="lg:col-span-2 lg:relative lg:min-h-[420px]">
          <Panel
            className="lg:absolute lg:inset-0"
            bodyClassName="overflow-y-auto"
            icon={activeViewMeta.icon}
            title={<>{activeViewMeta.label} <span className="font-normal text-muted-foreground tabular-nums">({activeTasks.length})</span></>}
          >
            {activeTasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Tudo em dia" description={EMPTY_MESSAGES[activeView]} />
            ) : (
              <ul className="divide-y divide-border">
                {activeTasks.slice(0, MAX_ROWS).map(task => {
                  const days = daysUntilDue(task);
                  const names = responsibleNames(task);
                  return (
                    <li key={task.id} className="group flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors">
                      <span
                        className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[task.priority])}
                        title={`Prioridade ${priorityLabels[task.priority].toLowerCase()}`}
                      />
                      <Link to={taskLink(task)} className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{task.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {projectName(task.projectId)}
                          {names && <> · {names}</>}
                          {task.status === 'blocked' && activeView !== 'bloqueadas' && (
                            <span className="text-orange-600 dark:text-orange-400"> · Bloqueada</span>
                          )}
                        </p>
                      </Link>
                      <span
                        className={cn(
                          'text-xs font-mono whitespace-nowrap',
                          days !== null && days < 0 ? 'text-red-600 dark:text-red-400'
                            : days === 0 ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground'
                        )}
                      >
                        {formatDueLabel(days)}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title={days === null ? 'Definir prazo' : 'Mudar prazo'}>
                              <Clock className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                              {days === null ? 'Definir prazo para' : 'Mover prazo para'}
                            </DropdownMenuLabel>
                            {POSTPONE_OPTIONS.map(option => (
                              <DropdownMenuItem key={option.days} onClick={() => handlePostpone(task, option.days)}>
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:text-emerald-600 hover:bg-emerald-500/10"
                          title="Concluir"
                          onClick={() => handleComplete(task)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
                {activeTasks.length > MAX_ROWS && (
                  <li className="px-5 py-2.5 text-xs text-muted-foreground">
                    Mostrando {MAX_ROWS} de {activeTasks.length}. As demais estão nos projetos.
                  </li>
                )}
              </ul>
            )}
          </Panel>
          </div>

          <div className="flex flex-col gap-4">
            {/* Lembretes das anotações */}
            <Panel icon={Bell} title="Lembretes">
              {reminders.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground text-center">
                  Nenhum lembrete pendente. Crie um em Anotações, categoria Lembrete.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {reminders.map(({ note, days }) => (
                    <li key={note.id}>
                      <Link
                        to={`/projects/${note.projectId}?tab=meetings`}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{note.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{projectName(note.projectId)}</p>
                        </div>
                        <span
                          className={cn(
                            'text-xs font-mono whitespace-nowrap',
                            days !== null && days < 0 ? 'text-red-600 dark:text-red-400'
                              : days === 0 ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                          )}
                        >
                          {formatDueLabel(days)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Projetos em andamento */}
            <Panel
              className="flex-1"
              icon={FolderKanban}
              title="Projetos"
              actions={
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <Link to="/projects">Ver todos <ArrowRight className="w-3 h-3" /></Link>
                </Button>
              }
            >
              {projectHealth.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum projeto em andamento.</p>
                  <Link to="/projects">
                    <Button variant="link" size="sm" className="text-xs">Criar projeto</Button>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {projectHealth.map(({ project, completed, overdue, total, progress }) => (
                    <li key={project.id}>
                      <Link
                        to={`/projects/${project.id}?tab=tasks`}
                        className="block px-5 py-2.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{project.name}</p>
                          {overdue > 0 ? (
                            <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                              {overdue} atrasada{overdue > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs font-mono text-muted-foreground">{progress}%</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{completed}/{total}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* Resumo por status */}
            <Panel title="Resumo das tarefas" bodyClassName="px-5 py-4">
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                {statusTotal > 0 && statusSummary.map(s => (
                  s.value > 0 && <div key={s.label} className={s.color} style={{ width: `${(s.value / statusTotal) * 100}%` }} />
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                {statusSummary.map(s => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <span className={cn('w-2 h-2 rounded-full', s.color)} />
                      {s.label}
                    </dt>
                    <dd className="font-mono tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      </PageBody>
    </MainLayout>
  );
};

export default Dashboard;
