import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useData } from '@/contexts/DataContext';
import { Project, CustomColumn } from '@/lib/types';
import { toast } from 'sonner';
import { Columns3, Plus, Edit, Trash2, GripVertical, X, FolderKanban, Pencil, Palette, Eye, EyeOff, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const projectSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  startDate: z.string().min(1, 'Data início é obrigatória'),
  endDate: z.string().optional(),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'cancelled']),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}

const typeLabels: Record<CustomColumn['type'], string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  list: 'Lista',
  percentage: 'Porcentagem',
  user: 'Usuário',
};

// Cover gradient options - exported for use in Projects page
export const COVER_GRADIENTS = [
  { id: 'blue', name: 'Azul', class: 'from-blue-500 to-cyan-400' },
  { id: 'purple', name: 'Roxo', class: 'from-purple-500 to-pink-500' },
  { id: 'green', name: 'Verde', class: 'from-green-500 to-emerald-400' },
  { id: 'orange', name: 'Laranja', class: 'from-orange-500 to-amber-400' },
  { id: 'red', name: 'Vermelho', class: 'from-red-500 to-rose-400' },
  { id: 'indigo', name: 'Indigo', class: 'from-indigo-500 to-violet-500' },
  { id: 'teal', name: 'Teal', class: 'from-teal-500 to-cyan-500' },
  { id: 'pink', name: 'Rosa', class: 'from-pink-500 to-fuchsia-500' },
];

// Helper function to check if a color value is a hex color
export const isHexColor = (value: string) => value?.startsWith('#');

// Protected standard fields that cannot be deleted
const PROTECTED_FIELDS: CustomColumn['standardField'][] = [
  'name', 'description', 'responsible', 'status', 'priority', 'startDate', 'endDate', 'progress',
];

export function ProjectFormModal({ open, onOpenChange, project }: ProjectFormModalProps) {
  const { addProject, updateProject, customColumns, addCustomColumn, updateCustomColumn, setCustomColumns, people, getProjectMemberIds, updateProjectMembers } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cover state
  const [coverColor, setCoverColor] = useState<string | null>(null);
  const [customColors, setCustomColors] = useState<string[]>([]);

  // Members state
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [membersPopoverOpen, setMembersPopoverOpen] = useState(false);
  const activePeople = people.filter(p => p.active);
  const selectedMembers = people.filter(p => selectedMemberIds.includes(p.id));
  
  // Custom columns state
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CustomColumn | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pendingColumns, setPendingColumns] = useState<Array<{
    id: string;
    name: string;
    type: CustomColumn['type'];
    options?: string[];
    isMilestone: boolean;
    order: number;
  }>>([]);
  const [columnFormData, setColumnFormData] = useState({
    name: '',
    type: 'text' as CustomColumn['type'],
    options: [] as string[],
    newOption: '',
    isMilestone: false,
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      status: 'planning',
    },
  });

  // For editing existing project - get real columns
  const existingProjectColumns = project 
    ? customColumns.filter(col => col.projectId === project.id && col.active).sort((a, b) => a.order - b.order)
    : [];

  // Reset when modal opens/closes or project changes
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || '',
        startDate: project.startDate || '',
        endDate: project.endDate || '',
        status: project.status,
      });
      setCoverColor(project.coverColor || null);
      // If project has a custom hex color, add it to customColors
      if (project.coverColor && isHexColor(project.coverColor) && !customColors.includes(project.coverColor)) {
        setCustomColors(prev => [...prev, project.coverColor!]);
      }
      setPendingColumns([]);
      // Carregar membros do projeto
      setSelectedMemberIds(getProjectMemberIds(project.id));
    } else {
      form.reset({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        status: 'planning',
      });
      setCoverColor(null);
      setPendingColumns([]);
      setSelectedMemberIds([]);
    }
  }, [project, form, open, getProjectMemberIds]);

  const toggleMember = (personId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(personId)
        ? prev.filter(id => id !== personId)
        : [...prev, personId]
    );
  };

  // Column management functions
  const resetColumnForm = () => {
    setColumnFormData({ name: '', type: 'text', options: [], newOption: '', isMilestone: false });
    setEditingColumn(null);
  };

  const openCreateColumnDialog = () => {
    resetColumnForm();
    setIsColumnDialogOpen(true);
  };

  const openEditColumnDialog = (column: CustomColumn) => {
    setEditingColumn(column);
    setColumnFormData({
      name: column.name,
      type: column.type,
      options: column.options || [],
      newOption: '',
      isMilestone: column.isMilestone || false,
    });
    setIsColumnDialogOpen(true);
  };

  const openEditPendingColumnDialog = (col: typeof pendingColumns[0]) => {
    setEditingColumn({ 
      id: col.id, 
      name: col.name, 
      type: col.type, 
      options: col.options,
      isMilestone: col.isMilestone,
      order: col.order,
      projectId: '',
      active: true,
    });
    setColumnFormData({
      name: col.name,
      type: col.type,
      options: col.options || [],
      newOption: '',
      isMilestone: col.isMilestone,
    });
    setIsColumnDialogOpen(true);
  };

  const handleAddOption = () => {
    if (columnFormData.newOption.trim()) {
      setColumnFormData(prev => ({
        ...prev,
        options: [...prev.options, prev.newOption.trim()],
        newOption: '',
      }));
    }
  };

  const handleRemoveOption = (index: number) => {
    setColumnFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const handleSaveColumn = async () => {
    if (!columnFormData.name.trim()) return;

    // For new project creation - save to pending columns
    if (!project) {
      if (editingColumn) {
        setPendingColumns(prev => prev.map(col => 
          col.id === editingColumn.id 
            ? {
                ...col,
                name: columnFormData.name,
                type: columnFormData.type,
                options: columnFormData.type === 'list' ? columnFormData.options : undefined,
                isMilestone: columnFormData.isMilestone,
              }
            : col
        ));
        toast.success('Coluna atualizada!');
      } else {
        const newColumn = {
          id: `temp-${Date.now()}`,
          name: columnFormData.name,
          type: columnFormData.type,
          options: columnFormData.type === 'list' ? columnFormData.options : undefined,
          isMilestone: columnFormData.isMilestone,
          order: pendingColumns.length + 1,
        };
        setPendingColumns(prev => [...prev, newColumn]);
        toast.success('Coluna adicionada!');
      }
      setIsColumnDialogOpen(false);
      resetColumnForm();
      return;
    }

    // For editing existing project - save to database
    try {
      if (editingColumn && !editingColumn.id.startsWith('temp-')) {
        await updateCustomColumn(editingColumn.id, {
          name: columnFormData.name,
          type: columnFormData.type,
          options: columnFormData.options,
          isMilestone: columnFormData.isMilestone,
        });
        toast.success('Coluna atualizada!');
      } else {
        await addCustomColumn({
          name: columnFormData.name,
          type: columnFormData.type,
          projectId: project.id,
          order: existingProjectColumns.length + 1,
          options: columnFormData.type === 'list' ? columnFormData.options : undefined,
          isMilestone: columnFormData.isMilestone,
          active: true,
        });
        toast.success('Coluna criada!');
      }

      setIsColumnDialogOpen(false);
      resetColumnForm();
    } catch (err) {
      console.error('Error saving custom column:', err);
      toast.error('Erro ao salvar coluna');
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (columnId.startsWith('temp-')) {
      setPendingColumns(prev => prev.filter(col => col.id !== columnId));
      toast.success('Coluna removida!');
      return;
    }

    try {
      await updateCustomColumn(columnId, { active: false });
      toast.success('Coluna removida!');
    } catch (err) {
      console.error('Error deleting custom column:', err);
      toast.error('Erro ao remover coluna');
    }
  };

  const handleToggleColumnVisibility = async (column: CustomColumn) => {
    try {
      await updateCustomColumn(column.id, { hidden: !column.hidden });
    } catch (err) {
      console.error('Error toggling column visibility:', err);
    }
  };

  const isProtectedColumn = (column: CustomColumn | typeof pendingColumns[0]) => {
    return 'standardField' in column && column.standardField && PROTECTED_FIELDS.includes(column.standardField);
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

    if (draggedId.startsWith('temp-')) {
      const draggedIndex = pendingColumns.findIndex(col => col.id === draggedId);
      const targetIndex = pendingColumns.findIndex(col => col.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const newColumns = [...pendingColumns];
      const [removed] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(targetIndex, 0, removed);

      setPendingColumns(newColumns.map((col, index) => ({ ...col, order: index + 1 })));
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const draggedIndex = existingProjectColumns.findIndex(col => col.id === draggedId);
    const targetIndex = existingProjectColumns.findIndex(col => col.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newColumns = [...existingProjectColumns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

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

    try {
      await Promise.all(
        newColumns.map((col, index) => updateCustomColumn(col.id, { order: index + 1 }))
      );
    } catch (err) {
      console.error('Error updating column order:', err);
    }

    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, existingProjectColumns, pendingColumns, setCustomColumns, updateCustomColumn]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleSelectGradient = (gradientId: string) => {
    setCoverColor(coverColor === gradientId ? null : gradientId);
  };

  // Default columns that are created for every new project
  const DEFAULT_COLUMNS: Array<{
    name: string;
    type: CustomColumn['type'];
    standardField: CustomColumn['standardField'];
    order: number;
  }> = [
    { name: 'Tarefa', type: 'text', standardField: 'name', order: 1 },
    { name: 'Descrição', type: 'text', standardField: 'description', order: 2 },
    { name: 'Responsável', type: 'user', standardField: 'responsible', order: 3 },
    { name: 'Status', type: 'list', standardField: 'status', order: 4 },
    { name: 'Prioridade', type: 'list', standardField: 'priority', order: 5 },
    { name: 'Data Início', type: 'date', standardField: 'startDate', order: 6 },
    { name: 'Data Fim', type: 'date', standardField: 'endDate', order: 7 },
    { name: 'Progresso', type: 'percentage', standardField: 'progress', order: 8 },
  ];

  const handleCreateProject = async (data: ProjectFormData) => {
    if (selectedMemberIds.length === 0) {
      toast.error('Selecione pelo menos um membro para a equipe do projeto');
      return;
    }
    setIsSubmitting(true);
    try {
      const projectData = {
        name: data.name,
        description: data.description || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        status: data.status,
        coverColor: coverColor || undefined,
      };

      const newProject = await addProject(projectData);
      
      // Always create default columns first
      const defaultColumnsToCreate = DEFAULT_COLUMNS.map(col => 
        addCustomColumn({
          name: col.name,
          type: col.type,
          projectId: newProject.id,
          order: col.order,
          standardField: col.standardField,
          isMilestone: false,
          active: true,
        })
      );
      
      await Promise.all(defaultColumnsToCreate);
      
      // Create user-added pending columns (after default columns)
      if (pendingColumns.length > 0) {
        await Promise.all(
          pendingColumns.map((col, index) =>
            addCustomColumn({
              name: col.name,
              type: col.type,
              projectId: newProject.id,
              order: DEFAULT_COLUMNS.length + index + 1,
              options: col.options,
              isMilestone: col.isMilestone,
              active: true,
            })
          )
        );
      }

      // Salvar membros do projeto
      if (selectedMemberIds.length > 0) {
        await updateProjectMembers(newProject.id, selectedMemberIds);
      }

      toast.success('Projeto criado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Erro ao salvar projeto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProject = async (data: ProjectFormData) => {
    if (!project) return;
    if (selectedMemberIds.length === 0) {
      toast.error('Selecione pelo menos um membro para a equipe do projeto');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateProject(project.id, {
        name: data.name,
        description: data.description || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        status: data.status,
        coverColor: coverColor || null,
      });

      // Atualizar membros do projeto
      await updateProjectMembers(project.id, selectedMemberIds);

      toast.success('Projeto atualizado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Erro ao atualizar projeto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPendingColumns([]);
    setCoverColor(null);
    setSelectedMemberIds([]);
    onOpenChange(false);
  };

  // Cover color selection component
  const CoverSection = () => (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Palette className="w-4 h-4" />
        Cor do Projeto
      </Label>
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground">Gradientes</span>
        <div className="flex flex-wrap gap-2 items-center">
          {COVER_GRADIENTS.map((gradient) => (
            <button
              key={gradient.id}
              type="button"
              onClick={() => handleSelectGradient(gradient.id)}
              className={cn(
                "w-8 h-8 rounded-md bg-gradient-to-br transition-all",
                gradient.class,
                coverColor === gradient.id
                  ? "ring-2 ring-primary ring-offset-2 scale-110"
                  : "hover:scale-105 hover:ring-1 hover:ring-border"
              )}
              title={gradient.name}
            />
          ))}
          {/* Custom colors */}
          {customColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setCoverColor(coverColor === color ? null : color)}
              className={cn(
                "w-8 h-8 rounded-md transition-all",
                coverColor === color
                  ? "ring-2 ring-primary ring-offset-2 scale-110"
                  : "hover:scale-105 hover:ring-1 hover:ring-border"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          {/* Custom color picker button */}
          <label
            className="w-8 h-8 rounded-md border-2 border-dashed border-muted-foreground/50 flex items-center justify-center cursor-pointer hover:border-primary hover:scale-105 transition-all"
            title="Adicionar cor personalizada"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
            <input
              type="color"
              className="sr-only"
              onChange={(e) => {
                const newColor = e.target.value;
                if (!customColors.includes(newColor)) {
                  setCustomColors(prev => [...prev, newColor]);
                }
                setCoverColor(newColor);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );

  // Members selection component
  const MembersSection = () => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Users className="w-4 h-4" />
        Equipe do Projeto *
      </Label>
      <Popover open={membersPopoverOpen} onOpenChange={setMembersPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className={cn(
              "w-full justify-start text-left font-normal h-auto min-h-10 py-2",
              selectedMembers.length === 0 && "text-muted-foreground"
            )}
          >
            {selectedMembers.length === 0 ? (
              <span>Selecione os membros da equipe...</span>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex -space-x-1">
                  {selectedMembers.slice(0, 5).map(p => (
                    <AvatarCircle
                      key={p.id}
                      name={p.name}
                      color={p.color}
                      size="xs"
                      avatarUrl={p.avatarUrl}
                      className="ring-1 ring-background"
                    />
                  ))}
                </div>
                <span className="text-sm">
                  {selectedMembers.length} {selectedMembers.length === 1 ? 'membro' : 'membros'}
                </span>
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {selectedMembers.length > 0 && (
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-muted-foreground"
                onClick={() => setSelectedMemberIds([])}
              >
                <X className="w-3 h-3" />
                Limpar seleção
              </button>
            )}
            {activePeople.length === 0 ? (
              <p className="text-sm text-destructive text-center py-4">
                Nenhuma pessoa cadastrada.<br />
                <span className="text-xs">Cadastre pessoas em Configurações → Pessoas antes de criar um projeto.</span>
              </p>
            ) : (
              activePeople.map((person) => (
                <label
                  key={person.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors cursor-pointer",
                    selectedMemberIds.includes(person.id) && "bg-muted"
                  )}
                >
                  <Checkbox
                    checked={selectedMemberIds.includes(person.id)}
                    onCheckedChange={() => toggleMember(person.id)}
                  />
                  <AvatarCircle name={person.name} color={person.color} size="sm" avatarUrl={person.avatarUrl} />
                  <span className="truncate">{person.name}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedMembers.map(member => (
            <Badge key={member.id} variant="secondary" className="gap-1 pr-1">
              <AvatarCircle name={member.name} color={member.color} size="xs" avatarUrl={member.avatarUrl} />
              <span className="text-xs">{member.name}</span>
              <button
                type="button"
                onClick={() => toggleMember(member.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  const renderColumnList = (columns: typeof pendingColumns | CustomColumn[], isPending: boolean) => (
    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
      {columns.map((column, index) => (
        <div 
          key={column.id}
          draggable
          onDragStart={(e) => handleDragStart(e, column.id)}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
          onDragEnd={handleDragEnd}
          className={cn(
            "flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border transition-all duration-200",
            draggedId === column.id && "opacity-50 scale-[0.98]",
            dragOverId === column.id && "border-primary border-2 bg-primary/5"
          )}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono w-5 flex-shrink-0">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium truncate block">{column.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">
                {typeLabels[column.type]}
              </Badge>
              {column.isMilestone && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                  Marco
                </Badge>
              )}
              {column.type === 'list' && column.options && (
                <span className="text-xs text-muted-foreground">
                  {column.options.length} opções
                </span>
              )}
            </div>
          </div>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            onClick={() => isPending ? openEditPendingColumnDialog(column as typeof pendingColumns[0]) : openEditColumnDialog(column as CustomColumn)} 
            className="flex-shrink-0"
          >
            <Edit className="w-4 h-4" />
          </Button>
          {isProtectedColumn(column) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("flex-shrink-0", (column as CustomColumn).hidden ? "text-muted-foreground" : "text-foreground")}
              onClick={() => handleToggleColumnVisibility(column as CustomColumn)}
              title={(column as CustomColumn).hidden ? "Mostrar na tabela de tarefas" : "Ocultar da tabela de tarefas"}
            >
              {(column as CustomColumn).hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive flex-shrink-0"
              onClick={() => handleDeleteColumn(column.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400">
                {project ? <Pencil className="w-5 h-5" /> : <FolderKanban className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {project ? 'Editar Projeto' : 'Novo Projeto'}
                </DialogTitle>
                <DialogDescription>
                  {project
                    ? 'Atualize as informações do projeto'
                    : 'Preencha os dados do projeto'
                  }
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* EDIT MODE */}
          {project ? (
            <form onSubmit={form.handleSubmit(handleUpdateProject)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" {...form.register('name')} placeholder="Nome do projeto" />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" {...form.register('description')} placeholder="Descrição do projeto" rows={3} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={form.watch('status')} onValueChange={(value: ProjectFormData['status']) => form.setValue('status', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planejamento</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="paused">Pausado</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data Início *</Label>
                    <Input id="startDate" type="date" {...form.register('startDate')} />
                    {form.formState.errors.startDate && (
                      <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Data Fim</Label>
                    <Input id="endDate" type="date" {...form.register('endDate')} />
                  </div>
                </div>

                <CoverSection />

                <MembersSection />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Colunas</h3>
                  <Button type="button" onClick={openCreateColumnDialog} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Coluna
                  </Button>
                </div>

                {existingProjectColumns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    <Columns3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma coluna configurada</p>
                  </div>
                ) : (
                  renderColumnList(existingProjectColumns, false)
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || activePeople.length === 0} className="gradient-primary text-white">
                  {isSubmitting ? 'Salvando...' : 'Atualizar'}
                </Button>
              </div>
            </form>
          ) : (
            /* CREATE MODE - Single Step */
            <form onSubmit={form.handleSubmit(handleCreateProject)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" {...form.register('name')} placeholder="Nome do projeto" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" {...form.register('description')} placeholder="Descrição do projeto" rows={3} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.watch('status')} onValueChange={(value: ProjectFormData['status']) => form.setValue('status', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planejamento</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Início *</Label>
                  <Input id="startDate" type="date" {...form.register('startDate')} />
                  {form.formState.errors.startDate && (
                    <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Fim</Label>
                  <Input id="endDate" type="date" {...form.register('endDate')} />
                </div>
              </div>

              <CoverSection />

              <MembersSection />

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || activePeople.length === 0} className="gradient-primary text-white">
                  {isSubmitting ? 'Criando...' : 'Criar Projeto'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Column Dialog */}
      <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-500/20 to-gray-500/20 text-slate-600 dark:text-slate-400">
                {editingColumn ? <Edit className="w-5 h-5" /> : <Columns3 className="w-5 h-5" />}
              </div>
              <DialogTitle className="text-lg">{editingColumn ? 'Editar Coluna' : 'Nova Coluna'}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="columnName">Nome da Coluna</Label>
              <Input
                id="columnName"
                value={columnFormData.name}
                onChange={(e) => setColumnFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Custo Estimado"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select 
                value={columnFormData.type} 
                onValueChange={(v) => setColumnFormData(prev => ({ ...prev, type: v as CustomColumn['type'] }))}
                disabled={!!editingColumn && !editingColumn.id.startsWith('temp-')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
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

            {columnFormData.type === 'list' && (
              <div className="space-y-2">
                <Label>Opções da Lista</Label>
                <div className="flex gap-2">
                  <Input
                    value={columnFormData.newOption}
                    onChange={(e) => setColumnFormData(prev => ({ ...prev, newOption: e.target.value }))}
                    placeholder="Adicionar opção..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                  />
                  <Button type="button" onClick={handleAddOption} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {columnFormData.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {columnFormData.options.map((option, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {option}
                        <button type="button" onClick={() => handleRemoveOption(index)} className="ml-1 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsColumnDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleSaveColumn} disabled={!columnFormData.name.trim()}>
              {editingColumn ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
