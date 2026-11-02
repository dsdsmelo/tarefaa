import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  ListTodo,
  FolderKanban,
  GanttChart,
  LayoutDashboard,
  Plus,
  ClipboardList,
  Layers,
  StickyNote,
  FileDown
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageBody } from '@/components/layout/PageBody';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useData } from '@/contexts/DataContext';
import { calculatePercentage, isTaskOverdue, isTaskDueSoon } from '@/lib/mockData';
import { projectStatusLabels, type ProjectStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ProjectGanttChart } from '@/components/gantt/ProjectGanttChart';
import { TaskFormModal } from '@/components/modals/TaskFormModal';
import { MilestoneFormModal } from '@/components/modals/MilestoneFormModal';
import { PhaseFormModal } from '@/components/modals/PhaseFormModal';
import { ProjectTasksTable } from '@/components/tasks/ProjectTasksTable';
import { PhaseManagerSheet } from '@/components/phases/PhaseManagerSheet';
import { AnnotationsTab } from '@/components/annotations/AnnotationsTab';
import { ProjectReport } from '@/components/reports/ProjectReport';
import { Phase } from '@/lib/types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusBadgeVariant: Record<ProjectStatus, BadgeProps['variant']> = {
  active: 'success',
  planning: 'default',
  paused: 'warning',
  completed: 'secondary',
  cancelled: 'outline',
};

const PROJECT_TABS = ['dashboard', 'tasks', 'gantt', 'meetings'];

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects = [], tasks = [], people = [], phases = [], cells = [], customColumns = [], milestones = [], deleteMilestone, updateMilestone, deletePhase, updatePhase, loading, error, activateWorkspaceForProject } = useData();
  // Aba e tarefa em foco vêm da URL (?tab=tasks&tarefa=<id>) para que links
  // do Dashboard levem direto ao ponto que precisa de ação.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam && PROJECT_TABS.includes(tabParam) ? tabParam : 'dashboard';
  const focusTaskId = activeTab === 'tasks' ? searchParams.get('tarefa') : null;
  const setActiveTab = (tab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'dashboard') next.delete('tab');
      else next.set('tab', tab);
      next.delete('tarefa');
      return next;
    }, { replace: true });
  };
  const clearFocusTask = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('tarefa');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskDefaultResponsibleIds, setTaskDefaultResponsibleIds] = useState<string[] | undefined>(undefined);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<typeof milestones[0] | undefined>(undefined);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | undefined>(undefined);
  const [phaseManagerOpen, setPhaseManagerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const attemptedProjectWorkspaceRef = useRef<string | null>(null);

  // Ensure arrays are always defined
  const safeProjects = projects || [];
  const safeTasks = tasks || [];
  const safePeople = people || [];
  const safePhases = phases || [];
  const safeCells = cells || [];
  const safeCustomColumns = customColumns || [];
  const safeMilestones = milestones || [];

  const project = useMemo(() => {
    return safeProjects.find(p => p.id === projectId);
  }, [safeProjects, projectId]);

  // Links diretos continuam funcionando mesmo quando o último workspace
  // selecionado era outro. A troca só ocorre após a validação de acesso no
  // banco, feita por activateWorkspaceForProject.
  useEffect(() => {
    if (!loading && !project && projectId && attemptedProjectWorkspaceRef.current !== projectId) {
      attemptedProjectWorkspaceRef.current = projectId;
      void activateWorkspaceForProject(projectId);
    }
  }, [loading, project, projectId, activateWorkspaceForProject]);

  const projectTasks = useMemo(() => {
    return safeTasks.filter(t => t.projectId === projectId);
  }, [safeTasks, projectId]);

  const projectPhases = useMemo(() => {
    return safePhases.filter(p => p.projectId === projectId).sort((a, b) => a.order - b.order);
  }, [safePhases, projectId]);

  const stats = useMemo(() => {
    const pending = projectTasks.filter(t => t.status === 'pending').length;
    const inProgress = projectTasks.filter(t => t.status === 'in_progress').length;
    const completed = projectTasks.filter(t => t.status === 'completed').length;
    const blocked = projectTasks.filter(t => t.status === 'blocked').length;
    const total = projectTasks.length;
    const avgProgress = total > 0 
      ? Math.round(projectTasks.reduce((acc, t) => acc + calculatePercentage(t), 0) / total)
      : 0;

    return { pending, inProgress, completed, blocked, total, avgProgress };
  }, [projectTasks]);

  const statusDistribution = useMemo(() => {
    return [
      { name: 'Pendente', value: stats.pending, color: '#EAB308' },
      { name: 'Em Progresso', value: stats.inProgress, color: '#3B82F6' },
      { name: 'Bloqueado', value: stats.blocked, color: '#EF4444' },
      { name: 'Concluído', value: stats.completed, color: '#22C55E' },
    ];
  }, [stats]);

  // Project milestones
  const projectMilestones = useMemo(() => {
    return safeMilestones.filter(m => m.projectId === projectId);
  }, [safeMilestones, projectId]);

  const tasksByPerson = useMemo(() => {
    const personMap = new Map<string, { name: string; color: string; tasks: number }>();

    projectTasks.forEach(task => {
      if (task.responsibleIds && task.responsibleIds.length > 0) {
        // Count task for each responsible person
        task.responsibleIds.forEach(responsibleId => {
          const person = safePeople.find(p => p.id === responsibleId);
          if (person) {
            const existing = personMap.get(person.id);
            if (existing) {
              existing.tasks++;
            } else {
              personMap.set(person.id, {
                name: person.name.split(' ')[0],
                color: person.color,
                tasks: 1,
              });
            }
          }
        });
      }
    });

    return Array.from(personMap.values()).sort((a, b) => b.tasks - a.tasks);
  }, [projectTasks, safePeople]);

  const alerts = useMemo(() => {
    const overdue = projectTasks.filter(isTaskOverdue);
    const dueSoon = projectTasks.filter(isTaskDueSoon);
    const unassigned = projectTasks.filter(t => (!t.responsibleIds || t.responsibleIds.length === 0) && t.status !== 'completed' && t.status !== 'cancelled');
    return { overdue, dueSoon, unassigned };
  }, [projectTasks]);


  const getPersonName = (personId?: string) => {
    if (!personId) return null;
    return safePeople.find(p => p.id === personId);
  };

  const getPhaseName = (phaseId?: string) => {
    if (!phaseId) return '-';
    return safePhases.find(p => p.id === phaseId)?.name || '-';
  };

  const getCellName = (cellId?: string) => {
    if (!cellId) return '-';
    return safeCells.find(c => c.id === cellId)?.name || '-';
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Carregando..." subtitle="" />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <Header title="Erro" subtitle="" />
        <div className="flex items-center justify-center h-96">
          <div className="text-center text-destructive">
            <p className="font-medium mb-2">Erro ao carregar dados</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!project) {
    return (
      <MainLayout>
        <Header title="Projeto não encontrado" subtitle="" backTo="/projects" />
        <PageBody>
          <EmptyState
            icon={FolderKanban}
            title="Projeto não encontrado"
            description="O projeto que você está procurando não existe."
            className="py-24"
            action={
              <Button onClick={() => navigate('/projects')}>
                <ArrowLeft className="w-4 h-4" />
                Voltar para Projetos
              </Button>
            }
          />
        </PageBody>
      </MainLayout>
    );
  }

  const projectInitials = project.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  return (
    <TooltipProvider>
    <MainLayout>
      <Header
        title={project.name}
        backTo="/projects"
        leading={
          project.imageUrl ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-border bg-white p-1 flex items-center justify-center">
              <img src={project.imageUrl} alt={project.name} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-semibold">
              {projectInitials}
            </div>
          )
        }
        subtitle={
          <>
            {project.startDate && project.endDate && (
              <>
                <span className="font-mono text-xs">
                  {new Date(project.startDate).toLocaleDateString('pt-BR')} - {new Date(project.endDate).toLocaleDateString('pt-BR')}
                </span>
                {' · '}
              </>
            )}
            {project.description || 'Dashboard do projeto'}
          </>
        }
        badge={<Badge variant={statusBadgeVariant[project.status]}>{projectStatusLabels[project.status]}</Badge>}
        actions={
          <>
            <Button variant="outline" onClick={() => setReportOpen(true)}>
              <FileDown className="w-4 h-4" />
              Exportar relatório
            </Button>
            {activeTab !== 'gantt' && activeTab !== 'meetings' && (
              <Button onClick={() => setTaskModalOpen(true)}>
                <Plus className="w-4 h-4" />
                Nova Tarefa
              </Button>
            )}
          </>
        }
      />

      <PageBody>
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <ClipboardList className="w-4 h-4" />
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="gantt">
              <GanttChart className="w-4 h-4" />
              Gantt
            </TabsTrigger>
            <TabsTrigger value="meetings">
              <StickyNote className="w-4 h-4" />
              Anotações
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            {/* Indicadores */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Total</span>
                  <span className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <ListTodo className="w-3.5 h-3.5 text-primary" />
                  </span>
                </div>
                <p className="text-2xl font-semibold mt-1 tabular-nums">{stats.total}</p>
                <p className="text-xs text-muted-foreground">tarefas no projeto</p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Em Progresso</span>
                  <span className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </span>
                </div>
                <p className="text-2xl font-semibold mt-1 tabular-nums text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">sendo executadas</p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Concluídas</span>
                  <span className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                </div>
                <p className="text-2xl font-semibold mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% do total
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Progresso</span>
                  <span className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </span>
                </div>
                <p className="text-2xl font-semibold mt-1 tabular-nums text-amber-600 dark:text-amber-400">{stats.avgProgress}%</p>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${stats.avgProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Status Distribution - Pie Chart */}
              <Panel title="Distribuição por Status" bodyClassName="p-5">
                <div className="h-64">
                  {stats.total > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution.filter(s => s.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {statusDistribution.filter(s => s.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      icon={ListTodo}
                      title="Nenhuma tarefa cadastrada"
                      className="h-full py-0"
                      action={
                        <Button variant="link" size="sm" className="text-xs" onClick={() => setTaskModalOpen(true)}>
                          Criar tarefa
                        </Button>
                      }
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-3 justify-center">
                  {statusDistribution.filter(s => s.value > 0).map((item, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.name}: <span className="font-mono tabular-nums">{item.value}</span></span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Tasks by Person - Bar Chart */}
              <Panel title="Tarefas por Responsável" bodyClassName="p-5">
                <div className="h-64">
                  {tasksByPerson.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tasksByPerson} layout="vertical" margin={{ left: 0, right: 20 }}>
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          tickLine={false} 
                          axisLine={false} 
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          width={70}
                        />
                        <RechartsTooltip
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="tasks" radius={[0, 4, 4, 0]}>
                          {tasksByPerson.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="Nenhuma tarefa atribuída"
                      description="Atribua responsáveis às tarefas"
                      className="h-full py-0"
                    />
                  )}
                </div>
                {tasksByPerson.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span><span className="tabular-nums">{tasksByPerson.length}</span> responsáveis com tarefas</span>
                  </div>
                )}
              </Panel>
            </div>

            {/* Listas rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {/* Tarefas mais longas em execução */}
              <Panel icon={Clock} title="Mais tempo em execução">
                {(() => {
                  const now = new Date();
                  const inProgressTasks = projectTasks
                    .filter(t => t.status === 'in_progress' && t.startDate)
                    .map(t => {
                      const start = new Date(t.startDate! + 'T12:00:00');
                      const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      return { ...t, daysRunning: Math.max(days, 0) };
                    })
                    .sort((a, b) => b.daysRunning - a.daysRunning)
                    .slice(0, 4);

                  if (inProgressTasks.length === 0) {
                    return <p className="px-5 py-6 text-center text-xs text-muted-foreground">Nenhuma tarefa em execução</p>;
                  }

                  return (
                    <ul className="divide-y divide-border">
                      {inProgressTasks.map(task => {
                        const person = task.responsibleIds?.[0] ? people.find(p => p.id === task.responsibleIds![0]) : null;
                        return (
                          <li key={task.id} className="flex items-center gap-2.5 px-5 py-2.5">
                            <span className={cn(
                              "text-[11px] font-mono font-medium px-1.5 py-0.5 rounded shrink-0 tabular-nums",
                              task.daysRunning > 14 ? "text-red-600 bg-red-500/10 dark:text-red-400" :
                              task.daysRunning > 7 ? "text-amber-600 bg-amber-500/10 dark:text-amber-400" :
                              "text-blue-600 bg-blue-500/10 dark:text-blue-400"
                            )}>
                              {task.daysRunning}d
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{task.name}</p>
                              {person && <p className="text-xs text-muted-foreground truncate">{person.name}</p>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </Panel>

              {/* Tarefas vencidas */}
              <Panel
                icon={AlertTriangle}
                iconClassName="text-red-500"
                title="Vencidas"
                actions={alerts.overdue.length > 0 && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-red-600 dark:text-red-400">{alerts.overdue.length}</span>
                )}
              >
                {alerts.overdue.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {alerts.overdue.slice(0, 4).map(task => {
                      const person = task.responsibleIds?.[0] ? people.find(p => p.id === task.responsibleIds![0]) : null;
                      const daysOverdue = task.endDate ? Math.floor((new Date().getTime() - new Date(task.endDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      return (
                        <li key={task.id} className="flex items-center gap-2.5 px-5 py-2.5">
                          <span className="text-[11px] font-mono font-medium tabular-nums text-red-600 dark:text-red-400 px-1.5 py-0.5 bg-red-500/10 rounded shrink-0">
                            +{daysOverdue}d
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{task.name}</p>
                            {person && <p className="text-xs text-muted-foreground truncate">{person.name}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center px-5 py-6 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 mb-1 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs">Nenhuma vencida</p>
                  </div>
                )}
              </Panel>

              {/* Próximas a vencer */}
              <Panel
                icon={Calendar}
                iconClassName="text-amber-500"
                title="Próximas a vencer"
                actions={alerts.dueSoon.length > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-400">{alerts.dueSoon.length}</span>
                )}
              >
                {alerts.dueSoon.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {alerts.dueSoon.slice(0, 4).map(task => {
                      const person = task.responsibleIds?.[0] ? people.find(p => p.id === task.responsibleIds![0]) : null;
                      const daysLeft = task.endDate ? Math.max(0, Math.floor((new Date(task.endDate + 'T12:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
                      return (
                        <li key={task.id} className="flex items-center gap-2.5 px-5 py-2.5">
                          <span className="text-[11px] font-mono font-medium tabular-nums text-amber-600 dark:text-amber-400 px-1.5 py-0.5 bg-amber-500/10 rounded shrink-0">
                            {daysLeft}d
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{task.name}</p>
                            {person && <p className="text-xs text-muted-foreground truncate">{person.name}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center px-5 py-6 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 mb-1 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs">Nenhuma próxima</p>
                  </div>
                )}
              </Panel>

              {/* Marcos do Projeto */}
              <Panel
                icon={Layers}
                title="Marcos"
                actions={
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Novo marco" onClick={() => { setEditingMilestone(undefined); setMilestoneModalOpen(true); }}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                }
              >
                {projectMilestones.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {projectMilestones.slice(0, 4).map(milestone => (
                      <li
                        key={milestone.id}
                        className="flex items-center gap-2.5 px-5 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => { setEditingMilestone(milestone); setMilestoneModalOpen(true); }}
                      >
                        {milestone.completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            milestone.completed && "line-through text-muted-foreground"
                          )}>{milestone.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">
                            {new Date(milestone.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center px-5 py-6 text-muted-foreground">
                    <p className="text-xs">Nenhum marco criado</p>
                    <Button variant="link" size="sm" className="mt-1 text-xs h-6" onClick={() => { setEditingMilestone(undefined); setMilestoneModalOpen(true); }}>
                      Criar marco
                    </Button>
                  </div>
                )}
              </Panel>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <ProjectTasksTable projectId={projectId || ''} focusTaskId={focusTaskId} onFocusTaskHandled={clearFocusTask} />
          </TabsContent>

          {/* Gantt Tab */}
          <TabsContent value="gantt">
            <ProjectGanttChart
              tasks={projectTasks}
              people={people}
              projectId={projectId || ''}
              project={project}
              phases={phases}
              milestones={milestones}
              onAddPhase={() => {
                setEditingPhase(undefined);
                setPhaseModalOpen(true);
              }}
              onEditPhase={(phase) => {
                setEditingPhase(phase);
                setPhaseModalOpen(true);
              }}
              onDeletePhase={async (phaseId) => {
                try {
                  await deletePhase(phaseId);
                } catch (err) {
                  console.error('Error deleting phase:', err);
                }
              }}
              onUpdatePhase={async (phaseId, data) => {
                try {
                  await updatePhase(phaseId, data);
                } catch (err) {
                  console.error('Error updating phase:', err);
                }
              }}
              onAddMilestone={() => {
                setEditingMilestone(undefined);
                setMilestoneModalOpen(true);
              }}
              onEditMilestone={(milestone) => {
                setEditingMilestone(milestone);
                setMilestoneModalOpen(true);
              }}
              onDeleteMilestone={async (milestoneId) => {
                try {
                  await deleteMilestone(milestoneId);
                } catch (err) {
                  console.error('Error deleting milestone:', err);
                }
              }}
              onUpdateMilestone={async (milestoneId, data) => {
                try {
                  await updateMilestone(milestoneId, data);
                } catch (err) {
                  console.error('Error updating milestone:', err);
                }
              }}
              onAddTask={(responsibleId) => {
                setTaskDefaultResponsibleIds(responsibleId ? [responsibleId] : undefined);
                setTaskModalOpen(true);
              }}
            />
          </TabsContent>

          {/* Annotations Tab */}
          <TabsContent value="meetings">
            <AnnotationsTab projectId={projectId || ''} />
          </TabsContent>
        </Tabs>
      </PageBody>

      {/* Task Modal */}
      <TaskFormModal
        open={taskModalOpen}
        onOpenChange={(open) => {
          setTaskModalOpen(open);
          if (!open) setTaskDefaultResponsibleIds(undefined);
        }}
        defaultProjectId={projectId}
        defaultResponsibleIds={taskDefaultResponsibleIds}
      />

      {/* Milestone Modal */}
      <MilestoneFormModal
        open={milestoneModalOpen}
        onOpenChange={(open) => {
          setMilestoneModalOpen(open);
          if (!open) setEditingMilestone(undefined);
        }}
        projectId={projectId || ''}
        milestone={editingMilestone}
      />

      {/* Phase Modal */}
      <PhaseFormModal
        open={phaseModalOpen}
        onOpenChange={(open) => {
          setPhaseModalOpen(open);
          if (!open) setEditingPhase(undefined);
        }}
        projectId={projectId || ''}
        phase={editingPhase}
        nextOrder={projectPhases.length}
      />

      {/* Phase Manager */}
      <PhaseManagerSheet
        open={phaseManagerOpen}
        onOpenChange={setPhaseManagerOpen}
        projectId={projectId || ''}
      />

      {reportOpen && (
        <ProjectReport
          project={project}
          tasks={projectTasks}
          phases={projectPhases}
          milestones={safeMilestones.filter(m => m.projectId === projectId)}
          people={safePeople}
          onClose={() => setReportOpen(false)}
        />
      )}
    </MainLayout>
    </TooltipProvider>
  );
};

export default ProjectDetail;
