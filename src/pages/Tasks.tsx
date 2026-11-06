import { WaitingDialog } from '@/components/planning/WaitingDialog';
import { peopleForWorkspace } from '@/lib/people';
import { waitingUpdates } from '@/lib/waiting';
import { todayISO } from '@/lib/taskDates';
import { withCustomValue } from '@/lib/dbMappers';
import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Columns3,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineEditCell } from '@/components/custom-columns/InlineEditCell';
import { TaskProgressEditCell } from '@/components/custom-columns/TaskProgressEditCell';
import {
  StatusEditCell,
  PriorityEditCell,
  ResponsibleEditCell,
  PhaseEditCell,
  TextEditCell
} from '@/components/tasks/InlineTaskFieldEdit';
import { ColumnManagerSheet } from '@/components/custom-columns/ColumnManagerSheet';
import {
  CustomFiltersState,
  countActiveCustomFilters,
  matchesCustomFilters,
} from '@/components/tasks/CustomColumnFilters';
import {
  ColumnHeaderFilter,
  ActiveFiltersBar,
  StandardColumnFilter,
  StandardFiltersState,
  StandardFiltersBar,
  countActiveStandardFilters,
} from '@/components/tasks/ColumnHeaderFilter';
import { TaskFormModal } from '@/components/modals/TaskFormModal';
import { useData } from '@/contexts/DataContext';
import { calculatePercentage, isTaskOverdue } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Task } from '@/lib/types';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Tasks = () => {
  const { tasks = [], addTask, updateTask, deleteTask, projects = [], phases = [], people = [], customColumns = [], loading, error, getProjectMemberIds } = useData();
  const [search, setSearch] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  // Aguardando: tarefa que vai receber o status (pede de quem e data de cobrança)
  const [waitingTask, setWaitingTask] = useState<Task | null>(null);
  const [projectFilter, setProjectFilter] = useState('all');
  // Filtros padrão agora usam arrays para seleção múltipla
  const [standardFilters, setStandardFilters] = useState<StandardFiltersState>({
    status: [],
    priority: [],
    responsible: [],
  });
  // Filtros para colunas customizadas
  const [customFilters, setCustomFilters] = useState<CustomFiltersState>({});
  // Toggle to show/hide completed tasks (hidden by default)
  const [showCompleted, setShowCompleted] = useState(false);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Ensure arrays are always defined
  const safeTasks = tasks || [];
  const safeProjects = projects || [];
  const safePhases = phases || [];
  const safePeople = people || [];
  const safeCustomColumns = customColumns || [];

  const completedCount = useMemo(() => safeTasks.filter(t => t.status === 'completed').length, [safeTasks]);

  const filteredTasks = useMemo(() => {
    return safeTasks.filter(task => {
      // Hide completed tasks unless toggle is on or status filter explicitly includes "completed"
      if (!showCompleted && task.status === 'completed' && !standardFilters.status.includes('completed')) return false;
      const matchesSearch = task.name.toLowerCase().includes(search.toLowerCase());
      const matchesProject = projectFilter === 'all' || task.projectId === projectFilter;
      // Filtros padrão agora usam arrays - se vazio, aceita todos
      const matchesStatus = standardFilters.status.length === 0 || standardFilters.status.includes(task.status);
      const matchesPriority = standardFilters.priority.length === 0 || standardFilters.priority.includes(task.priority);
      const matchesResponsible = standardFilters.responsible.length === 0 ||
        (task.responsibleIds && task.responsibleIds.some(id => standardFilters.responsible.includes(id)));

      // Filtros customizados (só aplicar se um projeto estiver selecionado)
      const matchesCustom = projectFilter === 'all' || matchesCustomFilters(task, customFilters, displayedCustomColumns);

      return matchesSearch && matchesProject && matchesStatus && matchesPriority && matchesResponsible && matchesCustom;
    });
  }, [safeTasks, search, projectFilter, standardFilters, showCompleted, customFilters, displayedCustomColumns]);

  // Get custom columns for the selected project (or all if no project selected)
  // Columns are automatically displayed based on project selection
  const displayedCustomColumns = useMemo(() => {
    if (projectFilter !== 'all') {
      return safeCustomColumns
        .filter(col => col.projectId === projectFilter && col.active)
        .sort((a, b) => a.order - b.order);
    }
    // When viewing all projects, don't show custom columns (they are project-specific)
    return [];
  }, [safeCustomColumns, projectFilter]);

  const getProjectName = (projectId: string) => {
    return safeProjects.find(p => p.id === projectId)?.name || '-';
  };

  const getPhaseName = (phaseId?: string) => {
    if (!phaseId) return '-';
    return safePhases.find(p => p.id === phaseId)?.name || '-';
  };

  const getPerson = (personId?: string) => {
    if (!personId) return null;
    return safePeople.find(p => p.id === personId);
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleAllTasks = () => {
    if (selectedTasks.length === filteredTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(filteredTasks.map(t => t.id));
    }
  };

  const activeFiltersCount = (projectFilter !== 'all' ? 1 : 0) + countActiveStandardFilters(standardFilters) + countActiveCustomFilters(customFilters);

  // Handler to update custom column value
  const handleCustomValueChange = useCallback(async (taskId: string, columnId: string, value: string | number) => {
    const task = safeTasks.find(t => t.id === taskId);
    if (!task) return;
    
    try {
      await updateTask(taskId, {
        // Vazio remove a chave (em vez de gravar "")
        customValues: withCustomValue(task.customValues, columnId, value),
      });
    } catch (err) {
      console.error('Error updating custom value:', err);
    }
  }, [safeTasks, updateTask]);

  // Handler to update task progress (as percentage)
  const handleProgressUpdate = useCallback(async (taskId: string, progress: number) => {
    try {
      // Convert percentage to quantity/collected (use 100 as base quantity)
      await updateTask(taskId, { quantity: 100, collected: progress });
      toast.success('Progresso atualizado!');
    } catch (err) {
      console.error('Error updating progress:', err);
      toast.error('Erro ao atualizar progresso');
    }
  }, [updateTask]);

  // Handler to update any task field
  const handleTaskFieldUpdate = useCallback(async (taskId: string, field: Partial<Task>) => {
    try {
      await updateTask(taskId, field);
    } catch (err) {
      console.error('Error updating task field:', err);
      toast.error('Erro ao atualizar tarefa');
    }
  }, [updateTask]);

  const handleOpenNewTask = () => {
    setEditingTask(undefined);
    setTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const handleDeleteClick = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask(taskToDelete);
      toast.success('Tarefa excluída com sucesso!');
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error('Erro ao excluir tarefa');
    } finally {
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleDuplicateTask = async (task: Task) => {
    try {
      const { id, updatedAt, ...taskData } = task;
      await addTask({
        ...taskData,
        name: `${task.name} (cópia)`,
        status: 'pending',
        collected: 0,
      });
      toast.success('Tarefa duplicada com sucesso!');
    } catch (err) {
      console.error('Error duplicating task:', err);
      toast.error('Erro ao duplicar tarefa');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Tarefas" subtitle="Gerencie e acompanhe todas as tarefas" />
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
        <Header title="Tarefas" subtitle="Gerencie e acompanhe todas as tarefas" />
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
      <Header title="Tarefas" subtitle="Gerencie e acompanhe todas as tarefas" />
      
      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex gap-3 flex-1 w-full lg:w-auto flex-wrap">
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tarefas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={projectFilter} onValueChange={(v) => {
              setProjectFilter(v);
              // Limpar filtros customizados ao mudar de projeto (colunas são específicas por projeto)
              setCustomFilters({});
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Projetos</SelectItem>
                {safeProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={showCompleted ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              className="relative"
              title={showCompleted ? "Ocultar concluídas" : "Mostrar concluídas"}
            >
              {showCompleted ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
              Concluídas
              {completedCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                  {completedCount}
                </span>
              )}
            </Button>

            {/* Clear Filters Button */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProjectFilter('all');
                  setStandardFilters({ status: [], priority: [], responsible: [] });
                  setCustomFilters({});
                }}
                className="text-muted-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar filtros ({activeFiltersCount})
              </Button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Column Manager - Only show when a project is selected */}
            {projectFilter !== 'all' && (
              <ColumnManagerSheet
                projectId={projectFilter}
                trigger={
                  <Button variant="outline" className="relative">
                    <Columns3 className="w-4 h-4 mr-2" />
                    Colunas
                    {displayedCustomColumns.length > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                        {displayedCustomColumns.length}
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {selectedTasks.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Ações em Lote ({selectedTasks.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Alterar Status</DropdownMenuItem>
                  <DropdownMenuItem>Alterar Responsável</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">Excluir Selecionados</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Barra de filtros ativos */}
        <div className="flex flex-wrap gap-2">
          {/* Filtros padrão ativos */}
          <StandardFiltersBar
            filters={standardFilters}
            people={safePeople}
            onClearStatus={() => setStandardFilters(prev => ({ ...prev, status: [] }))}
            onClearPriority={() => setStandardFilters(prev => ({ ...prev, priority: [] }))}
            onClearResponsible={() => setStandardFilters(prev => ({ ...prev, responsible: [] }))}
          />
          {/* Filtros customizados ativos */}
          {projectFilter !== 'all' && (
            <ActiveFiltersBar
              filters={customFilters}
              columns={displayedCustomColumns.filter(c => !c.standardField)}
              onClear={(columnId) => {
                setCustomFilters(prev => {
                  const updated = { ...prev };
                  delete updated[columnId];
                  return updated;
                });
              }}
              onClearAll={() => setCustomFilters({})}
            />
          )}
        </div>

        {/* Tasks Table */}
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-4 px-4 w-12">
                    <Checkbox
                      checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                      onCheckedChange={toggleAllTasks}
                    />
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Tarefa</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Projeto</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Fase</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Responsável</span>
                      <StandardColumnFilter
                        type="responsible"
                        selected={standardFilters.responsible}
                        onChange={(values) => setStandardFilters(prev => ({ ...prev, responsible: values }))}
                        people={safePeople}
                      />
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <StandardColumnFilter
                        type="status"
                        selected={standardFilters.status}
                        onChange={(values) => setStandardFilters(prev => ({ ...prev, status: values }))}
                      />
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Prioridade</span>
                      <StandardColumnFilter
                        type="priority"
                        selected={standardFilters.priority}
                        onChange={(values) => setStandardFilters(prev => ({ ...prev, priority: values }))}
                      />
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground w-40">Progresso</th>
                  {/* Custom Columns Headers */}
                  {displayedCustomColumns.filter(c => !c.standardField).map(col => (
                    <th key={col.id} className="text-left py-4 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span>{col.name}</span>
                        <ColumnHeaderFilter
                          column={col}
                          filter={customFilters[col.id]}
                          onChange={(value) => {
                            if (value) {
                              setCustomFilters(prev => ({ ...prev, [col.id]: value }));
                            } else {
                              setCustomFilters(prev => {
                                const updated = { ...prev };
                                delete updated[col.id];
                                return updated;
                              });
                            }
                          }}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const person = task.responsibleIds?.[0] ? getPerson(task.responsibleIds[0]) : undefined;
                  const progress = calculatePercentage(task);
                  const overdue = isTaskOverdue(task);

                  return (
                    <tr 
                      key={task.id} 
                      className={cn(
                        "border-t border-border hover:bg-muted/30 transition-colors",
                        overdue && "bg-status-blocked/5",
                        selectedTasks.includes(task.id) && "bg-primary/5"
                      )}
                    >
                      <td className="py-4 px-4">
                        <Checkbox
                          checked={selectedTasks.includes(task.id)}
                          onCheckedChange={() => toggleTaskSelection(task.id)}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <TextEditCell
                          value={task.name}
                          isOverdue={overdue}
                          onSave={(value) => handleTaskFieldUpdate(task.id, { name: value })}
                        />
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {getProjectName(task.projectId)}
                      </td>
                      <td className="py-4 px-4">
                        <PhaseEditCell
                          phaseId={task.phaseId}
                          phases={phases}
                          projectId={task.projectId}
                          onSave={(value) => handleTaskFieldUpdate(task.id, { phaseId: value })}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <ResponsibleEditCell
                          responsibleIds={task.responsibleIds}
                          people={peopleForWorkspace(people, projects.find(p => p.id === task.projectId)?.workspaceId,
                            [...getProjectMemberIds(task.projectId), ...(task.responsibleIds ?? [])])}
                          projectMemberIds={getProjectMemberIds(task.projectId)}
                          onSave={(value) => handleTaskFieldUpdate(task.id, { responsibleIds: value })}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <StatusEditCell
                          status={task.status}
                          onSave={(value) => handleTaskFieldUpdate(task.id, { status: value })}
                          onWaiting={() => setWaitingTask(task)}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <PriorityEditCell
                          priority={task.priority}
                          onSave={(value) => handleTaskFieldUpdate(task.id, { priority: value })}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <TaskProgressEditCell
                          progress={progress}
                          onSave={(value) => handleProgressUpdate(task.id, value)}
                        />
                      </td>
                      {/* Custom Columns Values - Inline Editable */}
                      {displayedCustomColumns.filter(c => !c.standardField).map(col => {
                        const shouldWrap = col.type === 'text' && col.wrapText;
                        return (
                          <td
                            key={col.id}
                            className={cn(
                              "py-3 px-4",
                              shouldWrap && "min-w-[150px] max-w-[300px]"
                            )}
                          >
                            <InlineEditCell
                              column={col}
                              value={task.customValues?.[col.id]}
                              onSave={(value) => handleCustomValueChange(task.id, col.id, value)}
                            />
                          </td>
                        );
                      })}
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditTask(task)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateTask(task)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(task.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma tarefa encontrada</h3>
              <p className="text-muted-foreground mb-4">Tente ajustar os filtros ou criar uma nova tarefa.</p>
              <Button className="gradient-primary text-white" onClick={handleOpenNewTask}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Tarefa
              </Button>
            </div>
          )}
        </div>

        {/* Footer with count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {filteredTasks.length} de {safeTasks.length} tarefas
          </span>
        </div>
      </div>

      {/* Task Form Modal */}
      <TaskFormModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        task={editingTask}
        defaultProjectId={projectFilter !== 'all' ? projectFilter : undefined}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WaitingDialog
        open={!!waitingTask}
        today={todayISO()}
        subject={waitingTask?.name}
        people={waitingTask
          ? peopleForWorkspace(people, projects.find(p => p.id === waitingTask.projectId)?.workspaceId, getProjectMemberIds(waitingTask.projectId))
          : []}
        onOpenChange={(open) => !open && setWaitingTask(null)}
        onSubmit={(input) => {
          const task = waitingTask;
          setWaitingTask(null);
          if (task) void handleTaskFieldUpdate(task.id, waitingUpdates(input));
        }}
      />
    </MainLayout>
  );
};

export default Tasks;
