import { useState, useCallback } from 'react';
import { Plus, Edit, Trash2, GripVertical, X, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useData } from '@/contexts/DataContext';
import { CustomColumn } from '@/lib/types';
import { cn } from '@/lib/utils';
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

interface CustomColumnManagerProps {
  projectId: string;
}

const typeLabels: Record<CustomColumn['type'], string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  list: 'Lista',
  percentage: 'Porcentagem',
  user: 'Usuário',
};

export const CustomColumnManager = ({ projectId }: CustomColumnManagerProps) => {
  const { customColumns, setCustomColumns } = useData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CustomColumn | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'text' as CustomColumn['type'],
    options: [] as string[],
    newOption: '',
  });

  const projectColumns = customColumns
    .filter(col => col.projectId === projectId && col.active)
    .sort((a, b) => a.order - b.order);

  const resetForm = () => {
    setFormData({ name: '', type: 'text', options: [], newOption: '' });
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

  const handleSave = () => {
    if (!formData.name.trim()) return;

    if (editingColumn) {
      setCustomColumns(prev => prev.map(col => 
        col.id === editingColumn.id 
          ? { ...col, name: formData.name, type: formData.type, options: formData.options }
          : col
      ));
    } else {
      const newColumn: CustomColumn = {
        id: `cc-${Date.now()}`,
        name: formData.name,
        type: formData.type,
        projectId,
        order: projectColumns.length + 1,
        options: formData.type === 'list' ? formData.options : undefined,
        active: true,
      };
      setCustomColumns(prev => [...prev, newColumn]);
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (columnId: string) => {
    setCustomColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, active: false } : col
    ));
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

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const draggedIndex = projectColumns.findIndex(col => col.id === draggedId);
    const targetIndex = projectColumns.findIndex(col => col.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder columns
    const newColumns = [...projectColumns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    // Update order values
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

    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, projectColumns, setCustomColumns]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Colunas Customizadas</h3>
          <p className="text-sm text-muted-foreground">
            Adicione campos extras às tarefas deste projeto. Arraste para reordenar.
          </p>
        </div>
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="w-4 h-4" />
          Nova Coluna
        </Button>
      </div>

      {projectColumns.length === 0 ? (
        <EmptyState
          icon={Columns3}
          title="Nenhuma coluna customizada criada"
          description='Clique em "Nova Coluna" para adicionar'
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
                <span className="text-sm font-medium">{column.name}</span>
                <Badge variant="secondary" className="ml-2 font-normal">
                  {typeLabels[column.type]}
                </Badge>
                {column.type === 'list' && column.options && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({column.options.length} opções)
                  </span>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEditDialog(column)} className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground">
                <Edit className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(column.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingColumn ? 'Editar Coluna' : 'Nova Coluna Customizada'}
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
            </div>

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
    </div>
  );
};
