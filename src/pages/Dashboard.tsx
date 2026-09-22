import { useMemo } from 'react';
import {
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowRight,
  TrendingUp,
  Users,
  Clock,
  ListTodo
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { useData } from '@/contexts/DataContext';
import { isTaskOverdue, isTaskDueSoon } from '@/lib/mockData';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const Dashboard = () => {
  const { projects = [], tasks = [], people = [], loading, error, activeWorkspace } = useData();

  // Ensure arrays are always defined
  const safeProjects = projects || [];
  const safeTasks = tasks || [];
  const safePeople = people || [];

  // KPIs
  const stats = useMemo(() => {
    const totalTasks = safeTasks.length;
    const overdueTasks = safeTasks.filter(isTaskOverdue).length;
    const inProgressTasks = safeTasks.filter(t => t.status === 'in_progress').length;
    const completedTasks = safeTasks.filter(t => t.status === 'completed').length;
    const pendingTasks = safeTasks.filter(t => t.status === 'pending').length;
    const blockedTasks = safeTasks.filter(t => t.status === 'blocked').length;
    const activeProjects = safeProjects.filter(p => p.status === 'active').length;
    const totalPeople = safePeople.length;

    return { totalTasks, overdueTasks, inProgressTasks, completedTasks, pendingTasks, blockedTasks, activeProjects, totalPeople };
  }, [safeProjects, safeTasks, safePeople]);

  // Dados para gráfico de pizza - Distribuição de status
  const taskStatusData = useMemo(() => {
    return [
      { name: 'Concluídas', value: stats.completedTasks, color: '#10b981' },
      { name: 'Em Progresso', value: stats.inProgressTasks, color: '#3b82f6' },
      { name: 'Pendentes', value: stats.pendingTasks, color: '#f59e0b' },
      { name: 'Bloqueadas', value: stats.blockedTasks, color: '#ef4444' },
    ].filter(item => item.value > 0);
  }, [stats]);

  // Dados para gráfico de barras - Tarefas por projeto
  const projectTasksData = useMemo(() => {
    return safeProjects
      .slice(0, 5)
      .map(project => {
        const projectTasks = safeTasks.filter(t => t.projectId === project.id);
        const completed = projectTasks.filter(t => t.status === 'completed').length;
        const inProgress = projectTasks.filter(t => t.status === 'in_progress').length;
        const pending = projectTasks.filter(t => t.status === 'pending' || t.status === 'blocked').length;
        return {
          name: project.name.length > 12 ? project.name.slice(0, 12) + '...' : project.name,
          concluídas: completed,
          emProgresso: inProgress,
          pendentes: pending,
        };
      });
  }, [safeProjects, safeTasks]);

  // Projetos ativos com progresso
  const activeProjectsList = useMemo(() => {
    return safeProjects
      .filter(p => p.status === 'active')
      .map(project => {
        const projectTasks = safeTasks.filter(t => t.projectId === project.id);
        const completed = projectTasks.filter(t => t.status === 'completed').length;
        const total = projectTasks.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { ...project, progress, taskCount: total, completedCount: completed };
      })
      .slice(0, 5);
  }, [safeProjects, safeTasks]);

  // Alertas (atrasadas e próximas do prazo)
  const alerts = useMemo(() => {
    const overdue = safeTasks.filter(isTaskOverdue).slice(0, 3);
    const dueSoon = safeTasks.filter(isTaskDueSoon).slice(0, 3);
    return { overdue, dueSoon };
  }, [safeTasks]);

  // Atividades recentes
  const recentActivity = useMemo(() => {
    return [...safeTasks]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(task => {
        const project = safeProjects.find(p => p.id === task.projectId);
        const person = task.responsibleIds?.[0] ? safePeople.find(p => p.id === task.responsibleIds![0]) : null;
        return { ...task, projectName: project?.name || '-', person };
      });
  }, [safeTasks, safeProjects, safePeople]);

  const getProjectName = (projectId: string) => {
    return safeProjects.find(p => p.id === projectId)?.name || '-';
  };

  // Only show skeleton on very first load when no data exists yet
  const hasData = safeTasks.length > 0 || safeProjects.length > 0 || safePeople.length > 0;
  if (loading && !hasData) {
    return (
      <MainLayout>
        <Header title="Dashboard" subtitle={activeWorkspace ? `Visão geral: ${activeWorkspace.name}` : 'Visão geral do workspace'} />
        <div className="p-6 space-y-6">
          {/* KPI Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          {/* Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          </div>
          {/* Lists Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl border border-border p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-1" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-1" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <Header title="Dashboard" subtitle={activeWorkspace ? `Visão geral: ${activeWorkspace.name}` : 'Visão geral do workspace'} />
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
      <Header title="Dashboard" subtitle={activeWorkspace ? `Visão geral: ${activeWorkspace.name}` : 'Visão geral do workspace'} />
      
      <div className="p-6 space-y-6">
        {/* KPIs - 4 cards iguais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ListTodo className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</span>
            </div>
            <p className="text-3xl font-bold">{stats.totalTasks}</p>
            <p className="text-sm text-muted-foreground mt-1">tarefas cadastradas</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Concluídas</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{stats.completedTasks}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% do total
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Atrasadas</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.overdueTasks}</p>
            <p className="text-sm text-muted-foreground mt-1">precisam de atenção</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projetos</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.activeProjects}</p>
            <p className="text-sm text-muted-foreground mt-1">projetos ativos</p>
          </div>
        </div>

        {/* Gráficos - 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Pizza - Distribuição de Status */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
            <h3 className="text-lg font-semibold mb-4">Distribuição de Tarefas</h3>
            <div className="h-64">
              {taskStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma tarefa cadastrada</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {taskStatusData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico de Barras - Tarefas por Projeto */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
            <h3 className="text-lg font-semibold mb-4">Tarefas por Projeto</h3>
            <div className="h-64">
              {projectTasksData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectTasksData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="concluídas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="emProgresso" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pendentes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FolderKanban className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum projeto cadastrado</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-4 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Concluídas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-muted-foreground">Em Progresso</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">Pendentes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Projetos + Alertas + Atividades - 3 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projetos Ativos */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Projetos Ativos</h3>
              <Link to="/projects">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Ver <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {activeProjectsList.length > 0 ? (
                activeProjectsList.map(project => (
                  <Link 
                    key={project.id} 
                    to={`/projects/${project.id}`}
                    className="block p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm truncate flex-1 mr-2">{project.name}</p>
                      <span className="text-xs font-semibold text-primary">{project.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{project.completedCount}/{project.taskCount} tarefas</p>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <FolderKanban className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum projeto ativo</p>
                  <Link to="/projects">
                    <Button variant="link" size="sm" className="mt-2 text-xs">
                      Criar projeto
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Alertas */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
            <h3 className="text-lg font-semibold mb-4">Alertas</h3>
            <div className="space-y-3">
              {alerts.overdue.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium text-xs">Atrasadas ({alerts.overdue.length})</span>
                  </div>
                  {alerts.overdue.map(task => (
                    <Link 
                      key={task.id} 
                      to={`/projects/${task.projectId}`}
                      className="block p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <p className="font-medium text-sm truncate">{task.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{getProjectName(task.projectId)}</p>
                    </Link>
                  ))}
                </div>
              )}

              {alerts.dueSoon.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-500">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium text-xs">Próximas ({alerts.dueSoon.length})</span>
                  </div>
                  {alerts.dueSoon.map(task => (
                    <Link 
                      key={task.id} 
                      to={`/projects/${task.projectId}`}
                      className="block p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      <p className="font-medium text-sm truncate">{task.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{getProjectName(task.projectId)}</p>
                    </Link>
                  ))}
                </div>
              )}

              {alerts.overdue.length === 0 && alerts.dueSoon.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-500" />
                  <p className="text-sm font-medium">Tudo em dia!</p>
                  <p className="text-xs">Nenhuma tarefa atrasada</p>
                </div>
              )}
            </div>
          </div>

          {/* Atividades Recentes */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Atividade Recente</h3>
              <Link to="/tasks">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  Ver <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {recentActivity.length > 0 ? (
                recentActivity.map(task => (
                  <Link 
                    key={task.id} 
                    to={`/projects/${task.projectId}`}
                    className="flex items-center gap-3 p-2.5 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <div 
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        task.status === 'completed' ? "bg-emerald-500" :
                        task.status === 'in_progress' ? "bg-blue-500" :
                        task.status === 'blocked' ? "bg-red-500" : "bg-amber-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{task.projectName}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(task.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma atividade</p>
                  <Link to="/tasks">
                    <Button variant="link" size="sm" className="mt-2 text-xs">
                      Criar tarefa
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
