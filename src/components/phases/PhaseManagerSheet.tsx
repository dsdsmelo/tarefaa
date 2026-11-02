import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Phase } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Check, 
  X, 
  GripVertical,
  Layers,
  Flag
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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

interface PhaseManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const colorOptions = [
  '#3B82F6', // blue
  '#22C55E', // green
  '#EAB308', // yellow
  '#F97316', // orange
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
];

export const PhaseManagerSheet = ({
  open,
  onOpenChange,
  projectId,
}: PhaseManagerSheetProps) => {
  const { phases, milestones, addPhase, updatePhase, deletePhase } = useData();
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseColor, setNewPhaseColor] = useState(colorOptions[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [phaseToDelete, setPhaseToDelete] = useState<Phase | null>(null);

  const projectPhases = phases
    .filter(p => p.projectId === projectId)
    .sort((a, b) => a.order - b.order);

  const projectMilestones = milestones.filter(m => m.projectId === projectId);

  const getMilestoneCount = (phaseId: string) => {
    // Milestones no longer have phaseId, return 0
    return 0;
  };

  const handleAddPhase = async () => {
    if (!newPhaseName.trim()) {
      toast.error('Nome da fase é obrigatório');
      return;
    }

    try {
      await addPhase({
        name: newPhaseName.trim(),
        projectId,
        order: projectPhases.length,
        color: newPhaseColor,
      });
      setNewPhaseName('');
      setNewPhaseColor(colorOptions[0]);
      setIsAdding(false);
      toast.success('Fase criada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar fase');
    }
  };

  const handleStartEdit = (phase: Phase) => {
    setEditingId(phase.id);
    setEditingName(phase.name);
    setEditingColor(phase.color || colorOptions[0]);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      await updatePhase(editingId, {
        name: editingName.trim(),
        color: editingColor,
      });
      setEditingId(null);
      toast.success('Fase atualizada!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar fase');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingColor('');
  };

  const handleDeleteClick = (phase: Phase) => {
    const milestoneCount = getMilestoneCount(phase.id);
    if (milestoneCount > 0) {
      toast.error(`Não é possível excluir: ${milestoneCount} marco(s) vinculado(s)`);
      return;
    }
    setPhaseToDelete(phase);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!phaseToDelete) return;

    try {
      await deletePhase(phaseToDelete.id);
      toast.success('Fase excluída!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir fase');
    } finally {
      setDeleteDialogOpen(false);
      setPhaseToDelete(null);
    }
  };

  const handleMovePhase = async (phase: Phase, direction: 'up' | 'down') => {
    const currentIndex = projectPhases.findIndex(p => p.id === phase.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= projectPhases.length) return;

    const otherPhase = projectPhases[newIndex];
    
    try {
      await updatePhase(phase.id, { order: newIndex });
      await updatePhase(otherPhase.id, { order: currentIndex });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao reordenar fases');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Gerenciar Fases/Sprints
            </SheetTitle>
            <SheetDescription>
              Organize as fases do projeto para vincular marcos e acompanhar o progresso.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            {/* Phase list */}
            <div className="space-y-2">
              {projectPhases.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="Nenhuma fase cadastrada"
                  description="Crie fases para organizar seu projeto"
                  className="py-8"
                />
              ) : (
                projectPhases.map((phase, index) => {
                  const isEditing = editingId === phase.id;
                  const milestoneCount = getMilestoneCount(phase.id);

                  return (
                    <div
                      key={phase.id}
                      className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border hover:bg-muted/40 transition-colors group"
                    >
                      {/* Drag handle / order buttons */}
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleMovePhase(phase, 'up')}
                          disabled={index === 0}
                        >
                          <span className="text-xs">▲</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleMovePhase(phase, 'down')}
                          disabled={index === projectPhases.length - 1}
                        >
                          <span className="text-xs">▼</span>
                        </Button>
                      </div>

                      {isEditing ? (
                        <>
                          {/* Color picker */}
                          <div className="flex gap-1">
                            {colorOptions.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`w-5 h-5 rounded-full ${
                                  editingColor === color ? 'ring-2 ring-primary ring-offset-2' : ''
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setEditingColor(color)}
                              />
                            ))}
                          </div>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 h-8"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                            onClick={handleSaveEdit}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleCancelEdit}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: phase.color || colorOptions[0] }}
                          />
                          <span className="flex-1 text-sm font-medium truncate">{phase.name}</span>
                          {milestoneCount > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
                              <Flag className="w-3 h-3" />
                              {milestoneCount}
                            </span>
                          )}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleStartEdit(phase)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(phase)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add new phase */}
            {isAdding ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex gap-1 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-5 h-5 rounded-full ${
                        newPhaseColor === color ? 'ring-2 ring-primary ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewPhaseColor(color)}
                    />
                  ))}
                </div>
                <Input
                  value={newPhaseName}
                  onChange={(e) => setNewPhaseName(e.target.value)}
                  placeholder="Nome da fase..."
                  className="flex-1 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddPhase();
                    if (e.key === 'Escape') {
                      setIsAdding(false);
                      setNewPhaseName('');
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                  onClick={handleAddPhase}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setIsAdding(false);
                    setNewPhaseName('');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="w-4 h-4" />
                Nova Fase/Sprint
              </Button>
            )}

            {/* Info */}
            <p className="text-xs text-muted-foreground text-center pt-2">
              Fases com marcos vinculados não podem ser excluídas.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fase</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a fase "{phaseToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
