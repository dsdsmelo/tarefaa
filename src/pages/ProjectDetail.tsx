import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
import { StatCard } from '@/components/ui/stat-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useData } from '@/contexts/DataContext';
import { calculatePercentage, isTaskOverdue, isTaskDueSoon } from '@/lib/mockData';
import { projectStatusLabels } from '@/lib/types';
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

const statusColors = {
  planning: 'bg-purple-500',
  active: 'bg-status-completed',
  paused: 'bg-status-pending',
  completed: 'bg-status-progress',
  cancelled: 'bg-status-cancelled',
};

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects = [], tasks = [], people = [], phases = [], cells = [], customColumns = [], milestones = [], deleteMilestone, updateMilestone, deletePhase, updatePhase, loading, error } = useData();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskDefaultResponsibleIds, setTaskDefaultResponsibleIds] = useState<string[] | undefined>(undefined);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<typeof milestones[0] | undefined>(undefined);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | undefined>(undefined);
  const [phaseManagerOpen, setPhaseManagerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando dados...</p>
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
        <Header title="Projeto não encontrado" subtitle="" />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <FolderKanban className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Projeto não encontrado</h3>
            <p className="text-muted-foreground mb-4">O projeto que você está procurando não existe.</p>
            <Button onClick={() => navigate('/projects')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Projetos
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <TooltipProvider>
    <MainLayout>
      <Header 
        title={project.name} 
        subtitle={project.description || 'Dashboard do projeto'}
      />
      
      <div className="px-6 pt-3 pb-6 space-y-4">
        {/* Back button and project info */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Projetos
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded-full', statusColors[project.status])} />
              <span className="text-sm font-medium">{projectStatusLabels[project.status]}</span>
            </div>
            {project.startDate && project.endDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(project.startDate).toLocaleDateString('pt-BR')} - {new Date(project.endDate).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
{/* Botão Fases removido conforme solicitado */}
            <Button variant="outline" onClick={() => setReportOpen(true)}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar relatório
            </Button>
            {activeTab !== 'gantt' && activeTab !== 'meetings' && (
              <Button className="gradient-primary text-white" onClick={() => setTaskModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Tarefa
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-12 p-1 bg-muted/80 border border-border rounded-xl shadow-sm w-full max-w-2xl">
            <TabsTrigger 
              value="dashboard" 
              className="flex-1 h-full flex items-center justify-center gap-2 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="tasks" 
              className="flex-1 h-full flex items-center justify-center gap-2 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all"
            >
              <ClipboardList className="w-4 h-4" />
              Tarefas
            </TabsTrigger>
            <TabsTrigger 
              value="gantt" 
              className="flex-1 h-full flex items-center justify-center gap-2 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all"
            >
              <GanttChart className="w-4 h-4" />
              Gantt
            </TabsTrigger>
            <TabsTrigger
              value="meetings"
              className="flex-1 h-full flex items-center justify-center gap-2 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all"
            >
              <StickyNote className="w-4 h-4" />
              Anotações
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-5 mt-4">
            {/* Stats Cards - 4 cards iguais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ListTodo className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</span>
                </div>
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground mt-1">tarefas no projeto</p>
              </div>

              <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Em Progresso</span>
                </div>
                <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
                <p className="text-sm text-muted-foreground mt-1">sendo executadas</p>
              </div>

              <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Concluídas</span>
                </div>
                <p className="text-3xl font-bold text-emerald-600">{stats.completed}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% do total
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-500" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progresso</span>
                </div>
                <p className="text-3xl font-bold text-amber-600">{stats.avgProgress}%</p>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${stats.avgProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Charts Row - 2 colunas iguais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution - Pie Chart */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4">Distribuição por Status</h3>
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
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ListTodo className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma tarefa cadastrada</p>
                      <Button variant="link" size="sm" className="mt-2 text-xs" onClick={() => setTaskModalOpen(true)}>
                        Criar tarefa
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {statusDistribution.filter(s => s.value > 0).map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks by Person - Bar Chart */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4">Tarefas por Responsável</h3>
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
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Users className="w-10 h-10 mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma tarefa atribuída</p>
                      <p className="text-xs mt-1">Atribua responsáveis às tarefas</p>
                    </div>
                  )}
                </div>
                {tasksByPerson.length > 0 && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span>{tasksByPerson.length} responsáveis com tarefas</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row - 4 colunas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tarefas mais longas em execução */}
              <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold">Mais tempo em execução</h3>
                </div>
                <div className="space-y-1.5">
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
                      return (
                        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                          <p className="text-xs">Nenhuma tarefa em execução</p>
                        </div>
                      );
                    }

                    return inProgressTasks.map(task => {
                      const person = task.responsibleIds?.[0] ? people.find(p => p.id === task.responsibleIds![0]) : null;
                      return (
                        <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 bg-muted/30 rounded">
                          <span className={cn(
                            "text-[10px] font-bold px-1 py-0.5 rounded shrink-0",
                            task.daysRunning > 14 ? "text-red-600 bg-red-100 dark:bg-red-900/30" :
                            task.daysRunning > 7 ? "text-amber-600 bg-amber-100 dark:bg-amber-900/30" :
                            "text-blue-600 bg-blue-100 dark:bg-blue-900/30"
                          )}>
                            {task.daysRunning}d
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{task.name}</p>
                            {person && <p className="text-[10px] text-muted-foreground truncate">{person.name}</p>}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Tarefas vencidas */}
              <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-semibold">Vencidas</h3>
                  {alerts.overdue.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">{alerts.overdue.length}</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {alerts.overdue.length > 0 ? (
                    alerts.overdue.slice(0, 4).map(task => {
                      const person = task.responsibleIds?.[0] ? people.find(p => p.id === task.responsibleIds![0]) : null;
                      const daysOverdue = task.endDate ? Math.floor((new Date().getTime() - new Date(task.endDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      return (
                        <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 bg-red-500/5 rounded">
                          <span className="text-[10px] font-bold text-red-600 px-1 py-0.5 bg-red-100 dark:bg-red-900/30 rounded shrink-0">
                            +{daysOverdue}d
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{task.name}</p>
                            {person && <p className="text-[10px] text-muted-foreground truncate">{person.name}</p>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <CheckCircle2 className="w-5 h-5 mb-1 text-emerald-500" />
                      <p className="text-xs">Nenhuma vencida</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Próximas a vencer */}
              <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold">Próximas a vencer</h3>
                  {alerts.dueSoon.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">{alerts.dueSoon.length}</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {alerts.dueSoon.length > 0 ? (
                    alerts.dueSoon.slice(0, 4).map(task => {
                      const person = task.responsibleIds?.[0] ? people.find(p => p.id === task.responsibleIds![0]) : null;
                      const daysLeft = task.endDate ? Math.max(0, Math.floor((new Date(task.endDate + 'T12:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;
                      return (
                        <div key={task.id} className="flex items-center gap-2 py-1.5 px-2 bg-amber-500/5 rounded">
                          <span className="text-[10px] font-bold text-amber-600 px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded shrink-0">
                            {daysLeft}d
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{task.name}</p>
                            {person && <p className="text-[10px] text-muted-foreground truncate">{person.name}</p>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <CheckCircle2 className="w-5 h-5 mb-1 text-emerald-500" />
                      <p className="text-xs">Nenhuma próxima</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Marcos do Projeto */}
              <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-semibold">Marcos</h3>
                  <Button variant="ghost" size="sm" className="ml-auto text-[10px] h-5 px-1.5" onClick={() => { setEditingMilestone(undefined); setMilestoneModalOpen(true); }}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {projectMilestones.length > 0 ? (
                    projectMilestones.slice(0, 4).map(milestone => (
                      <div
                        key={milestone.id}
                        className={cn(
                          "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors",
                          milestone.completed ? "bg-emerald-500/5" : "bg-muted/30"
                        )}
                        onClick={() => { setEditingMilestone(milestone); setMilestoneModalOpen(true); }}
                      >
                        {milestone.completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "text-xs font-medium truncate",
                            milestone.completed && "line-through text-muted-foreground"
                          )}>{milestone.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(milestone.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <p className="text-xs">Nenhum marco criado</p>
                      <Button variant="link" size="sm" className="mt-1 text-[10px] h-5" onClick={() => { setEditingMilestone(undefined); setMilestoneModalOpen(true); }}>
                        Criar marco
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4">
            <ProjectTasksTable projectId={projectId || ''} />
          </TabsContent>

          {/* Gantt Tab */}
          <TabsContent value="gantt" className="mt-4">
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
          <TabsContent value="meetings" className="mt-4">
            <AnnotationsTab projectId={projectId || ''} />
          </TabsContent>
        </Tabs>
      </div>

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
