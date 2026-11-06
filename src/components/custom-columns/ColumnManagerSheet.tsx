import { useState, useCallback } from 'react';
import { Plus, Edit, Trash2, GripVertical, X, Settings2, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Switch } from '@/components/ui/switch';
import { useData } from '@/contexts/DataContext';
import { CustomColumn } from '@/lib/types';
import { cn } from '@/lib/utils';
import { STANDARD_COLUMNS, STANDARD_FIELD_LABELS, missingStandardColumns } from '@/lib/standardColumns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface ColumnManagerSheetProps {
  projectId: string;
  trigger?: React.ReactNode;
}

const typeLabels: Record<CustomColumn['type'], string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  list: 'Lista',
  percentage: 'Porcentagem',
  user: 'Usuário',
};

const standardFieldLabels: Record<string, string> = STANDARD_FIELD_LABELS;

// Protected standard fields that cannot be deleted
const PROTECTED_FIELDS: CustomColumn['standardField'][] = STANDARD_COLUMNS.map(c => c.standardField);

export const ColumnManagerSheet = ({ 
  projectId, 
  trigger,
}: ColumnManagerSheetProps) => {
  const { customColumns, setCustomColumns, addCustomColumn, updateCustomColumn, projects } = useData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CustomColumn | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [isRestoringDefaults, setIsRestoringDefaults] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'text' as CustomColumn['type'],
    options: [] as string[],
    newOption: '',
    isMilestone: false,
    wrapText: false,
  });

  const project = projects.find(p => p.id === projectId);

  const projectColumns = customColumns
    .filter(col => col.projectId === projectId && col.active)
    .sort((a, b) => a.order - b.order);

  const resetForm = () => {
    setFormData({ name: '', type: 'text', options: [], newOption: '', isMilestone: false, wrapText: false });
    setEditingColumn(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (column: CustomColumn) => {
    setEditingColumn(column);
    setFormData({
      name: column.name,
      type: column.type,
      options: column.options || [],
      newOption: '',
      isMilestone: column.isMilestone || false,
      wrapText: column.wrapText || false,
    });
    setIsDialogOpen(true);
  };

  const handleAddOption = () => {
    if (formData.newOption.trim()) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, prev.newOption.trim()],
        newOption: '',
      }));
    }
  };

  const handleRemoveOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    try {
      if (editingColumn) {
        await updateCustomColumn(editingColumn.id, {
          name: formData.name,
          type: formData.type,
          options: formData.options,
          isMilestone: formData.isMilestone,
          wrapText: formData.type === 'text' ? formData.wrapText : false,
        });
      } else {
        await addCustomColumn({
          name: formData.name,
          type: formData.type,
          projectId,
          order: projectColumns.length + 1,
          options: formData.type === 'list' ? formData.options : undefined,
          isMilestone: formData.isMilestone,
          wrapText: formData.type === 'text' ? formData.wrapText : false,
          active: true,
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error saving custom column:', err);
    }
  };

  const handleDelete = async (columnId: string) => {
    try {
      await updateCustomColumn(columnId, { active: false });
    } catch (err) {
      console.error('Error deleting custom column:', err);
    }
  };

  const handleToggleVisibility = async (column: CustomColumn) => {
    try {
      await updateCustomColumn(column.id, { hidden: !column.hidden });
    } catch (err) {
      console.error('Error toggling column visibility:', err);
    }
  };

  const isProtectedColumn = (column: CustomColumn) => {
    return column.standardField && PROTECTED_FIELDS.includes(column.standardField);
  };

  // Restore default columns for existing projects
  const handleRestoreDefaults = async () => {
    setIsRestoringDefaults(true);
    try {
      // Só acrescenta as colunas padrão que faltam; as existentes não mudam
      const missingDefaults = missingStandardColumns(projectColumns);

      if (missingDefaults.length === 0) {
        toast.info('Todas as colunas padrão já estão configuradas');
        return;
      }

      // Calculate starting order (after existing columns)
      const startOrder = projectColumns.length + 1;

      // Create missing default columns
      await Promise.all(
        missingDefaults.map((col, index) =>
          addCustomColumn({
            name: col.name,
            type: col.type,
            projectId,
            order: startOrder + index,
            standardField: col.standardField,
            isMilestone: false,
            active: true,
            ...(col.hidden ? { hidden: true } : {}),
          })
        )
      );

      const hiddenCount = missingDefaults.filter(col => col.hidden).length;
      toast.success(
        `${missingDefaults.length} coluna(s) padrão restaurada(s)!` +
        (hiddenCount > 0 ? ` ${hiddenCount} entrou oculta: use o ícone de olho para mostrar.` : '')
      );
    } catch (err) {
      console.error('Error restoring default columns:', err);
      toast.error('Erro ao restaurar colunas padrão');
    } finally {
      setIsRestoringDefaults(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (columnId !== draggedId) {
      setDragOverId(columnId);
    }
  }, [draggedId]);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const draggedIndex = projectColumns.findIndex(col => col.id === draggedId);
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
    }

    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, projectColumns, setCustomColumns, updateCustomColumn]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const startEditingInline = (columnId: string, name: string) => {
    setEditingColumnId(columnId);
    setEditingColumnName(name);
  };

  const saveInlineName = async () => {
    if (editingColumnId && editingColumnName.trim()) {
      try {
        await updateCustomColumn(editingColumnId, { name: editingColumnName.trim() });
      } catch (err) {
        console.error('Error updating column name:', err);
      }
    }
    setEditingColumnId(null);
    setEditingColumnName('');
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <Settings2 className="w-4 h-4" />
              Gerenciar Colunas
            </Button>
          )}
        </SheetTrigger>
        <SheetContent className="w-full sm:w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Gerenciar Colunas</SheetTitle>
            <SheetDescription>
              {project ? `Projeto: ${project.name}` : 'Selecione um projeto para gerenciar colunas'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Arraste para reordenar, clique para renomear</p>
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={handleRestoreDefaults} 
                  size="sm" 
                  variant="outline"
                  disabled={isRestoringDefaults}
                  className="flex-1 sm:flex-none"
                >
                  <RotateCcw className={cn("w-4 h-4", isRestoringDefaults && "animate-spin")} />
                  Restaurar Padrão
                </Button>
                <Button onClick={openCreateDialog} size="sm" className="flex-1 sm:flex-none">
                  <Plus className="w-4 h-4" />
                  Nova Coluna
                </Button>
              </div>
            </div>

            {projectColumns.length === 0 ? (
              <EmptyState
                icon={Settings2}
                title="Nenhuma coluna configurada"
                description="Adicione colunas para este projeto"
                className="py-8 rounded-xl border border-dashed border-border"
              />
            ) : (
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {projectColumns.map((column, index) => (
                  <div 
                    key={column.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, column.id)}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 bg-card hover:bg-muted/40 transition-colors",
                      draggedId === column.id && "opacity-50",
                      dragOverId === column.id && "bg-primary/5 ring-1 ring-inset ring-primary"
                    )}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums w-5 flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingColumnId === column.id ? (
                        <Input
                          value={editingColumnName}
                          onChange={(e) => setEditingColumnName(e.target.value)}
                          onBlur={saveInlineName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveInlineName();
                            } else if (e.key === 'Escape') {
                              setEditingColumnId(null);
                              setEditingColumnName('');
                            }
                          }}
                          className="h-7 text-sm"
                          autoFocus
                        />
                      ) : (
                        <span 
                          className="text-sm font-medium truncate block cursor-text hover:text-primary transition-colors"
                          onClick={() => startEditingInline(column.id, column.name)}
                        >
                          {column.name}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {column.standardField ? (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            {standardFieldLabels[column.standardField] || column.standardField}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-normal">
                            {typeLabels[column.type]}
                          </Badge>
                        )}
                        {column.isMilestone && (
                          <Badge variant="warning">
                            Marco
                          </Badge>
                        )}
                        {column.type === 'list' && column.options && !column.standardField && (
                          <span className="text-xs text-muted-foreground">
                            {column.options.length} opções
                          </span>
                        )}
                      </div>
                    </div>
                    {!column.standardField && (
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(column)} className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground">
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {isProtectedColumn(column) ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8 flex-shrink-0", column.hidden ? "text-muted-foreground" : "text-foreground")}
                        onClick={() => handleToggleVisibility(column)}
                        title={column.hidden ? "Mostrar na tabela de tarefas" : "Ocultar da tabela de tarefas"}
                      >
                        {column.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        onClick={() => handleDelete(column.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingColumn ? 'Editar Coluna' : 'Nova Coluna'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Coluna</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Custo Estimado"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select 
                value={formData.type} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as CustomColumn['type'] }))}
                disabled={!!editingColumn}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="list">Lista de Opções</SelectItem>
                  <SelectItem value="percentage">Porcentagem</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                </SelectContent>
              </Select>
              {editingColumn && (
                <p className="text-xs text-muted-foreground">O tipo não pode ser alterado após a criação</p>
              )}
            </div>

            {formData.type === 'text' && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="wrapText" className="text-sm font-medium">Quebra de linhas</Label>
                  <p className="text-xs text-muted-foreground">
                    Textos longos ocupam mais linhas (coluna mais larga)
                  </p>
                </div>
                <Switch
                  id="wrapText"
                  checked={formData.wrapText}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, wrapText: checked }))}
                />
              </div>
            )}

            {formData.type === 'list' && (
              <div className="space-y-2">
                <Label>Opções da Lista</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.newOption}
                    onChange={(e) => setFormData(prev => ({ ...prev, newOption: e.target.value }))}
                    placeholder="Adicionar opção..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                  />
                  <Button type="button" onClick={handleAddOption} size="icon" variant="outline" className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.options.map((option, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {option}
                        <button onClick={() => handleRemoveOption(index)} className="ml-0.5 rounded-sm text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              {editingColumn ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
