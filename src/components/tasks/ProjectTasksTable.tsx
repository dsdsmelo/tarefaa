import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Columns3,
  GripVertical,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { InlineEditCell } from '@/components/custom-columns/InlineEditCell';
import { TaskProgressEditCell } from '@/components/custom-columns/TaskProgressEditCell';
import {
  StatusEditCell,
  PriorityEditCell,
  ResponsibleEditCell,
  TextEditCell,
  DateEditCell
} from '@/components/tasks/InlineTaskFieldEdit';
import { ColumnManagerSheet } from '@/components/custom-columns/ColumnManagerSheet';
import { TaskFormModal } from '@/components/modals/TaskFormModal';
import { TablePagination } from '@/components/ui/table-pagination';
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
import { useData } from '@/contexts/DataContext';
import { calculatePercentage, isTaskOverdue } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Task, CustomColumn, TaskStatus, statusLabels } from '@/lib/types';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/status-badge';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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

interface ProjectTasksTableProps {
  projectId: string;
}

export const ProjectTasksTable = ({ projectId }: ProjectTasksTableProps) => {
  const { tasks, addTask, updateTask, deleteTask, people, customColumns, updateCustomColumn, setCustomColumns, getProjectMemberIds } = useData();
  const projectMemberIds = getProjectMemberIds(projectId);

  const [search, setSearch] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  // Filtros padrão agora usam arrays para seleção múltipla
  const [standardFilters, setStandardFilters] = useState<StandardFiltersState>({
    status: [],
    priority: [],
    responsible: [],
  });

  // Filtros para colunas customizadas
  const [customFilters, setCustomFilters] = useState<CustomFiltersState>({});

  // Toggle to show/hide completed tasks (hidden by default to reduce visual clutter)
  const [showCompleted, setShowCompleted] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkResponsibleDialogOpen, setBulkResponsibleDialogOpen] = useState(false);
  const [bulkResponsibleIds, setBulkResponsibleIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Column editing and drag state
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const columnInputRef = useRef<HTMLInputElement>(null);

  // Column resize state
  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
    name: 220,
    description: 280,
    responsible: 150,
    status: 130,
    priority: 110,
    startDate: 110,
    endDate: 110,
    progress: 100,
  };

  const getDefaultWidth = (col: CustomColumn): number => {
    if (col.standardField && DEFAULT_COLUMN_WIDTHS[col.standardField]) {
      return DEFAULT_COLUMN_WIDTHS[col.standardField];
    }
    if (col.type === 'number' || col.type === 'percentage') return 100;
    return 180;
  };

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;
    resizingRef.current = {
      colId,
      startX: e.clientX,
      startWidth: th.getBoundingClientRect().width,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { colId, startX, startWidth } = resizingRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [colId]: newWidth }));
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Filter tasks for this project
  const projectTasks = useMemo(() => {
    return tasks.filter(t => t.projectId === projectId);
  }, [tasks, projectId]);

  // Get all columns for this project (unified - no distinction)
  const projectColumns = useMemo(() => {
    return customColumns
      .filter(col => col.projectId === projectId && col.active && !col.hidden)
      .sort((a, b) => a.order - b.order);
  }, [customColumns, projectId]);

  // Count completed tasks for display
  const completedTasksCount = useMemo(() => {
    return projectTasks.filter(t => t.status === 'completed').length;
  }, [projectTasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return projectTasks.filter(task => {
      // Hide completed tasks if toggle is off
      if (!showCompleted && task.status === 'completed') return false;

      const matchesSearch = task.name.toLowerCase().includes(search.toLowerCase());
      // Filtros padrão agora usam arrays - se vazio, aceita todos
      const matchesStatus = standardFilters.status.length === 0 || standardFilters.status.includes(task.status);
      const matchesPriority = standardFilters.priority.length === 0 || standardFilters.priority.includes(task.priority);
      const matchesResponsible = standardFilters.responsible.length === 0 ||
        (task.responsibleIds && task.responsibleIds.some(id => standardFilters.responsible.includes(id)));

      // Filtros customizados
      const matchesCustom = matchesCustomFilters(task, customFilters, customColumns);

      return matchesSearch && matchesStatus && matchesPriority && matchesResponsible && matchesCustom;
    });
  }, [projectTasks, search, standardFilters, showCompleted, customFilters, customColumns]);

  // Paginated tasks
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredTasks.slice(start, end);
  }, [filteredTasks, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize);

  // Reset to page 1 when standard filters change
  const handleStandardFilterChange = useCallback((type: keyof StandardFiltersState, values: string[]) => {
    setStandardFilters(prev => ({ ...prev, [type]: values }));
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleShowCompletedToggle = useCallback(() => {
    setShowCompleted(prev => !prev);
    setCurrentPage(1);
  }, []);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleAllTasks = () => {
    if (selectedTasks.length === paginatedTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(paginatedTasks.map(t => t.id));
    }
  };

  const activeFiltersCount = countActiveStandardFilters(standardFilters) + (showCompleted ? 0 : 1) + countActiveCustomFilters(customFilters);

  // Handler to update custom column value
  const handleCustomValueChange = useCallback(async (taskId: string, columnId: string, value: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await updateTask(taskId, {
        customValues: {
          ...task.customValues,
          [columnId]: value,
        },
      });
    } catch (err) {
      console.error('Error updating custom value:', err);
    }
  }, [tasks, updateTask]);

  // Handler to update task progress
  const handleProgressUpdate = useCallback(async (taskId: string, progress: number) => {
    try {
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

  const handleBulkUpdateStatus = async (status: TaskStatus) => {
    if (selectedTasks.length === 0) return;
    setIsBulkUpdating(true);
    const results = await Promise.allSettled(
      selectedTasks.map((id) => updateTask(id, { status }))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const succeeded = results.length - failed;
    if (succeeded > 0) {
      toast.success(`Status alterado para "${statusLabels[status]}" em ${succeeded} ${succeeded === 1 ? 'tarefa' : 'tarefas'}!`);
    }
    if (failed > 0) {
      console.error('Error updating status:', results.filter((r) => r.status === 'rejected'));
      toast.error(`Erro ao alterar status em ${failed} ${failed === 1 ? 'tarefa' : 'tarefas'}`);
    }
    setSelectedTasks([]);
    setIsBulkUpdating(false);
  };

  const openBulkResponsibleDialog = () => {
    setBulkResponsibleIds([]);
    setBulkResponsibleDialogOpen(true);
  };

  const toggleBulkResponsible = (personId: string) => {
    setBulkResponsibleIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  const handleConfirmBulkUpdateResponsible = async () => {
    if (selectedTasks.length === 0) return;
    setIsBulkUpdating(true);
    const responsibleIds = bulkResponsibleIds.length > 0 ? bulkResponsibleIds : undefined;
    const results = await Promise.allSettled(
      selectedTasks.map((id) => updateTask(id, { responsibleIds }))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const succeeded = results.length - failed;
    if (succeeded > 0) {
      toast.success(`Responsáveis atualizados em ${succeeded} ${succeeded === 1 ? 'tarefa' : 'tarefas'}!`);
    }
    if (failed > 0) {
      console.error('Error updating responsible:', results.filter((r) => r.status === 'rejected'));
      toast.error(`Erro ao atualizar responsáveis em ${failed} ${failed === 1 ? 'tarefa' : 'tarefas'}`);
    }
    setSelectedTasks([]);
    setBulkResponsibleDialogOpen(false);
    setIsBulkUpdating(false);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedTasks.length === 0) return;
    setIsBulkDeleting(true);
    const results = await Promise.allSettled(selectedTasks.map((id) => deleteTask(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    const succeeded = results.length - failed;
    if (succeeded > 0) {
      toast.success(`${succeeded} ${succeeded === 1 ? 'tarefa excluída' : 'tarefas excluídas'} com sucesso!`);
    }
    if (failed > 0) {
      console.error('Error deleting tasks:', results.filter((r) => r.status === 'rejected'));
      toast.error(`Erro ao excluir ${failed} ${failed === 1 ? 'tarefa' : 'tarefas'}`);
    }
    setSelectedTasks([]);
    setBulkDeleteDialogOpen(false);
    setIsBulkDeleting(false);
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

  const clearFilters = () => {
    setStandardFilters({ status: [], priority: [], responsible: [] });
    setCustomFilters({});
    setSearch('');
    setShowCompleted(true);
    setCurrentPage(1);
  };

  // Column inline editing handlers
  const startEditingColumn = useCallback((columnId: string, currentName: string) => {
    setEditingColumnId(columnId);
    setEditingColumnName(currentName);
    setTimeout(() => columnInputRef.current?.focus(), 0);
  }, []);

  const saveColumnName = useCallback(async () => {
    if (!editingColumnId || !editingColumnName.trim()) {
      setEditingColumnId(null);
      setEditingColumnName('');
      return;
    }

    try {
      await updateCustomColumn(editingColumnId, { name: editingColumnName.trim() });
    } catch (err) {
      console.error('Error updating column name:', err);
      toast.error('Erro ao atualizar nome da coluna');
    } finally {
      setEditingColumnId(null);
      setEditingColumnName('');
    }
  }, [editingColumnId, editingColumnName, updateCustomColumn]);

  const cancelEditingColumn = useCallback(() => {
    setEditingColumnId(null);
    setEditingColumnName('');
  }, []);

  // Column drag-and-drop handlers
  const handleColumnDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (columnId !== draggedColumnId) {
      setDragOverColumnId(columnId);
    }
  }, [draggedColumnId]);

  const handleColumnDragLeave = useCallback(() => {
    setDragOverColumnId(null);
  }, []);

  const handleColumnDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();

    if (!draggedColumnId || draggedColumnId === targetId) {
      setDraggedColumnId(null);
      setDragOverColumnId(null);
      return;
    }

    const draggedIndex = projectColumns.findIndex(col => col.id === draggedColumnId);
    const targetIndex = projectColumns.findIndex(col => col.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newColumns = [...projectColumns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    // Update local state immediately for responsiveness
    setCustomColumns(prev => {
      const updated = [...prev];
      newColumns.forEach((col, index) => {
        const idx = updated.findIndex(c => c.id === col.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], order: index + 1 };
        }
      });
      return updated;
    });

    // Persist to database
    try {
      await Promise.all(
        newColumns.map((col, index) => updateCustomColumn(col.id, { order: index + 1 }))
      );
    } catch (err) {
      console.error('Error updating column order:', err);
      toast.error('Erro ao reordenar colunas');
    }

    setDraggedColumnId(null);
    setDragOverColumnId(null);
  }, [draggedColumnId, projectColumns, setCustomColumns, updateCustomColumn]);

  const handleColumnDragEnd = useCallback(() => {
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  }, []);

  // Render cell content based on column type
  const renderCellContent = (task: Task, column: CustomColumn) => {
    const progress = calculatePercentage(task);
    const overdue = isTaskOverdue(task);

    // Standard field columns
    if (column.standardField) {
      switch (column.standardField) {
        case 'name':
          return (
            <TextEditCell
              value={task.name}
              isOverdue={overdue}
              onSave={(value) => handleTaskFieldUpdate(task.id, { name: value })}
            />
          );
        case 'description':
          return (
            <TextEditCell
              value={task.description || ''}
              placeholder="Adicionar descrição..."
              onSave={(value) => handleTaskFieldUpdate(task.id, { description: value || undefined })}
              className="text-muted-foreground"
            />
          );
        case 'responsible':
          return (
            <ResponsibleEditCell
              responsibleIds={task.responsibleIds}
              people={people}
              projectMemberIds={projectMemberIds}
              onSave={(value) => handleTaskFieldUpdate(task.id, { responsibleIds: value })}
            />
          );
        case 'status':
          return (
            <StatusEditCell
              status={task.status}
              onSave={(value) => handleTaskFieldUpdate(task.id, { status: value })}
            />
          );
        case 'priority':
          return (
            <PriorityEditCell
              priority={task.priority}
              onSave={(value) => handleTaskFieldUpdate(task.id, { priority: value })}
            />
          );
        case 'startDate':
          return (
            <DateEditCell
              value={task.startDate}
              placeholder="Definir"
              onSave={(value) => handleTaskFieldUpdate(task.id, { startDate: value })}
            />
          );
        case 'endDate':
          return (
            <DateEditCell
              value={task.endDate}
              placeholder="Definir"
              onSave={(value) => handleTaskFieldUpdate(task.id, { endDate: value })}
            />
          );
        case 'progress':
          return (
            <TaskProgressEditCell
              progress={progress}
              onSave={(value) => handleProgressUpdate(task.id, value)}
            />
          );
        default:
          return null;
      }
    }

    // Custom column
    return (
      <InlineEditCell
        column={column}
        value={task.customValues?.[column.id]}
        onSave={(value) => handleCustomValueChange(task.id, column.id, value)}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex gap-3 flex-1 w-full lg:w-auto flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle Completed Tasks */}
          <Button
            variant={showCompleted ? "outline" : "secondary"}
            onClick={handleShowCompletedToggle}
            className="gap-2"
            title={showCompleted ? "Ocultar tarefas concluídas" : "Mostrar tarefas concluídas"}
          >
            {showCompleted ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Concluídas</span>
            {completedTasksCount > 0 && (
              <Badge variant={showCompleted ? "secondary" : "default"} className="ml-1 h-5 min-w-5 p-0 flex items-center justify-center text-xs">
                {completedTasksCount}
              </Badge>
            )}
          </Button>

          {/* Clear Filters Button */}
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Limpar filtros ({activeFiltersCount})
            </Button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <ColumnManagerSheet
            projectId={projectId}
            trigger={
              <Button variant="outline">
                <Columns3 className="w-4 h-4 mr-2" />
                Colunas
              </Button>
            }
          />

          {selectedTasks.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Ações em Lote ({selectedTasks.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Alterar Status</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'] as TaskStatus[]).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        disabled={isBulkUpdating}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleBulkUpdateStatus(s);
                        }}
                      >
                        <StatusBadge status={s} />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    openBulkResponsibleDialog();
                  }}
                >
                  Alterar Responsável
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setBulkDeleteDialogOpen(true);
                  }}
                >
                  Excluir Selecionados
                </DropdownMenuItem>
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
          people={people}
          onClearStatus={() => handleStandardFilterChange('status', [])}
          onClearPriority={() => handleStandardFilterChange('priority', [])}
          onClearResponsible={() => handleStandardFilterChange('responsible', [])}
        />
        {/* Filtros customizados ativos */}
        <ActiveFiltersBar
          filters={customFilters}
          columns={projectColumns.filter(c => !c.standardField)}
          onClear={(columnId) => {
            setCustomFilters(prev => {
              const updated = { ...prev };
              delete updated[columnId];
              return updated;
            });
          }}
          onClearAll={() => setCustomFilters({})}
        />
      </div>

      {/* Tasks Table */}
      <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{
            tableLayout: 'fixed',
            width: `${40 + projectColumns.reduce((sum, col) => sum + (columnWidths[col.id] ?? getDefaultWidth(col)), 0) + 48}px`,
            minWidth: '100%',
          }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              {projectColumns.map(col => (
                <col key={col.id} style={{ width: `${columnWidths[col.id] ?? getDefaultWidth(col)}px` }} />
              ))}
              <col style={{ width: '48px' }} />
            </colgroup>
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-1.5 px-2 bg-muted border-r border-border/60" style={{ width: '40px' }}>
                  <Checkbox
                    checked={selectedTasks.length === paginatedTasks.length && paginatedTasks.length > 0}
                    onCheckedChange={toggleAllTasks}
                  />
                </th>
                {/* All columns - unified */}
                {projectColumns.map((col, colIndex) => {
                  const isNameCol = colIndex === 0;
                  const isCompactCol = ['status', 'priority', 'startDate', 'endDate', 'progress'].includes(col.standardField || '') || ['number', 'percentage'].includes(col.type);
                  // Colunas de texto com wrapText habilitado têm largura controlada
                  const shouldWrapHeader = col.type === 'text' && !col.standardField && col.wrapText;
                  return (
                  <th
                    key={col.id}
                    style={{ width: `${columnWidths[col.id] ?? getDefaultWidth(col)}px`, position: 'relative' }}
                    className={cn(
                      "text-left py-1.5 px-2 text-xs font-medium text-muted-foreground whitespace-nowrap border-r border-border/60 overflow-hidden text-ellipsis",
                      draggedColumnId === col.id && "opacity-50",
                      dragOverColumnId === col.id && "bg-primary/10 border-l-2 border-primary"
                    )}
                    draggable
                    onDragStart={(e) => handleColumnDragStart(e, col.id)}
                    onDragOver={(e) => handleColumnDragOver(e, col.id)}
                    onDragLeave={handleColumnDragLeave}
                    onDrop={(e) => handleColumnDrop(e, col.id)}
                    onDragEnd={handleColumnDragEnd}
                  >
                    <div className="flex items-center gap-1 group">
                      <GripVertical className="w-3 h-3 text-muted-foreground/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      {editingColumnId === col.id ? (
                        <input
                          ref={columnInputRef}
                          type="text"
                          value={editingColumnName}
                          onChange={(e) => setEditingColumnName(e.target.value)}
                          onBlur={saveColumnName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveColumnName();
                            } else if (e.key === 'Escape') {
                              cancelEditingColumn();
                            }
                          }}
                          className="bg-background border border-primary rounded px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[70px]"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-text hover:text-foreground transition-colors"
                          onClick={() => startEditingColumn(col.id, col.name)}
                          title="Clique para editar o nome da coluna"
                        >
                          {col.name}
                        </span>
                      )}
                      {/* Filtro no cabeçalho - colunas padrão */}
                      {col.standardField === 'status' && (
                        <StandardColumnFilter
                          type="status"
                          selected={standardFilters.status}
                          onChange={(values) => handleStandardFilterChange('status', values)}
                        />
                      )}
                      {col.standardField === 'priority' && (
                        <StandardColumnFilter
                          type="priority"
                          selected={standardFilters.priority}
                          onChange={(values) => handleStandardFilterChange('priority', values)}
                        />
                      )}
                      {col.standardField === 'responsible' && (
                        <StandardColumnFilter
                          type="responsible"
                          selected={standardFilters.responsible}
                          onChange={(values) => handleStandardFilterChange('responsible', values)}
                          people={people}
                        />
                      )}
                      {/* Filtro no cabeçalho - colunas customizadas */}
                      {!col.standardField && (
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
                      )}
                    </div>
                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-30 -mr-1"
                      onMouseDown={(e) => handleResizeMouseDown(e, col.id)}
                    />
                  </th>
                  );
                })}
                <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground w-8"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.map(task => {
                const overdue = isTaskOverdue(task);

                return (
                  <tr
                    key={task.id}
                    className={cn(
                      "group/row border-t border-border hover:bg-muted/30 transition-colors",
                      overdue && "bg-status-blocked/5",
                      selectedTasks.includes(task.id) && "bg-primary/5"
                    )}
                  >
                    <td className="py-1 px-2 bg-card border-r border-border/60">
                      <Checkbox
                        checked={selectedTasks.includes(task.id)}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                      />
                    </td>
                    {/* All columns - unified */}
                    {projectColumns.map((col, colIndex) => {
                      const isNameCol = colIndex === 0;
                      const isCompactCol = ['status', 'priority', 'startDate', 'endDate', 'progress'].includes(col.standardField || '') || ['number', 'percentage'].includes(col.type);
                      // Colunas de texto com wrapText habilitado têm quebra automática
                      const shouldWrap = col.type === 'text' && !col.standardField && col.wrapText;
                      return (
                      <td
                        key={col.id}
                        style={{ width: `${columnWidths[col.id] ?? getDefaultWidth(col)}px` }}
                        className={cn(
                          "py-1 px-2 text-xs border-r border-border/60 overflow-hidden text-ellipsis",
                          !shouldWrap && "whitespace-nowrap",
                          isNameCol && "font-medium"
                        )}
                      >
                        {renderCellContent(task, col)}
                      </td>
                      );
                    })}
                    <td className="py-1 px-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditTask(task)}>
                            <Edit className="w-3.5 h-3.5 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateTask(task)}>
                            <Copy className="w-3.5 h-3.5 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(task.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
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
            {activeFiltersCount > 0 && (
              <Button variant="outline" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            )}
          </div>
        )}

        {/* Pagination */}
        {filteredTasks.length > 0 && (
          <div className="border-t border-border">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredTasks.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </div>

      {/* Task Form Modal for editing */}
      <TaskFormModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        task={editingTask}
        defaultProjectId={projectId}
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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão em lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedTasks.length} {selectedTasks.length === 1 ? 'tarefa selecionada' : 'tarefas selecionadas'}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmBulkDelete();
              }}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Update Responsible Dialog */}
      <AlertDialog open={bulkResponsibleDialogOpen} onOpenChange={setBulkResponsibleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar Responsável</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione os responsáveis que serão atribuídos às {selectedTasks.length} {selectedTasks.length === 1 ? 'tarefa selecionada' : 'tarefas selecionadas'}. Isto irá substituir os responsáveis atuais. Se nenhum for marcado, os responsáveis serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-2">
            {(() => {
              const activePeople = people.filter((p) => {
                if (!p.active) return false;
                if (projectMemberIds && projectMemberIds.length > 0) {
                  return projectMemberIds.includes(p.id);
                }
                return true;
              });
              if (activePeople.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro disponível neste projeto.</p>;
              }
              return activePeople.map((person) => (
                <label
                  key={person.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={bulkResponsibleIds.includes(person.id)}
                    onCheckedChange={() => toggleBulkResponsible(person.id)}
                  />
                  <AvatarCircle name={person.name} color={person.color} size="sm" avatarUrl={person.avatarUrl} />
                  <span className="text-sm">{person.name}</span>
                </label>
              ));
            })()}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkUpdating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmBulkUpdateResponsible();
              }}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? 'Aplicando...' : 'Aplicar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
