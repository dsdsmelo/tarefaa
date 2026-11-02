import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  X,
  Table2,
  Pencil,
  Trash2,
  Calendar,
  ArrowLeft,
  Loader2,
  Copy,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useData } from '@/contexts/DataContext';
import { Spreadsheet } from '@/lib/types';
import { SpreadsheetEditor } from './SpreadsheetEditor';

interface SpreadsheetTabProps {
  projectId: string;
}

export function SpreadsheetTab({ projectId }: SpreadsheetTabProps) {
  const {
    spreadsheets: allSpreadsheets,
    addSpreadsheet,
    updateSpreadsheet,
    deleteSpreadsheet,
    duplicateSpreadsheet,
  } = useData();

  // Filter spreadsheets for current project
  const spreadsheets = useMemo(() =>
    allSpreadsheets.filter(s => s.projectId === projectId),
    [allSpreadsheets, projectId]
  );

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpreadsheet, setEditingSpreadsheet] = useState<Spreadsheet | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spreadsheetToDelete, setSpreadsheetToDelete] = useState<Spreadsheet | null>(null);
  const [activeSpreadsheet, setActiveSpreadsheet] = useState<Spreadsheet | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Filtered spreadsheets
  const filteredSpreadsheets = useMemo(() => {
    if (!search.trim()) return spreadsheets;
    const searchLower = search.toLowerCase();
    return spreadsheets.filter(
      s => s.name.toLowerCase().includes(searchLower) ||
           s.description?.toLowerCase().includes(searchLower)
    );
  }, [spreadsheets, search]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setEditingSpreadsheet(null);
  };

  const handleOpenModal = (spreadsheet?: Spreadsheet) => {
    if (spreadsheet) {
      setEditingSpreadsheet(spreadsheet);
      setName(spreadsheet.name);
      setDescription(spreadsheet.description || '');
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      if (editingSpreadsheet) {
        await updateSpreadsheet(editingSpreadsheet.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast.success('Tabela atualizada!');
      } else {
        await addSpreadsheet({
          projectId,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast.success('Tabela criada!');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar tabela');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (spreadsheet: Spreadsheet) => {
    setSpreadsheetToDelete(spreadsheet);
    setDeleteDialogOpen(true);
  };

  const handleDuplicateSpreadsheet = async (spreadsheet: Spreadsheet) => {
    setDuplicatingId(spreadsheet.id);
    try {
      await duplicateSpreadsheet(spreadsheet);
      toast.success(`"${spreadsheet.name}" duplicada com sucesso!`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao duplicar tabela');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!spreadsheetToDelete) return;

    try {
      await deleteSpreadsheet(spreadsheetToDelete.id);
      toast.success('Tabela excluída!');
      setDeleteDialogOpen(false);
      setSpreadsheetToDelete(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir tabela');
    }
  };

  const handleOpenSpreadsheet = (spreadsheet: Spreadsheet) => {
    setActiveSpreadsheet(spreadsheet);
  };

  const handleBackToList = () => {
    setActiveSpreadsheet(null);
  };

  // Show spreadsheet editor if one is active
  if (activeSpreadsheet) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div>
            <h3 className="font-semibold">{activeSpreadsheet.name}</h3>
            {activeSpreadsheet.description && (
              <p className="text-xs text-muted-foreground">{activeSpreadsheet.description}</p>
            )}
          </div>
        </div>
        <SpreadsheetEditor spreadsheet={activeSpreadsheet} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Table2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Tabelas do Projeto</h3>
            <p className="text-xs text-muted-foreground tabular-nums">
              {spreadsheets.length} {spreadsheets.length === 1 ? 'tabela' : 'tabelas'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tabelas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4" />
            Nova Tabela
          </Button>
        </div>
      </div>

      {/* Spreadsheets Grid */}
      {spreadsheets.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed border-border bg-card"
          icon={Table2}
          title="Nenhuma tabela ainda"
          description="Crie tabelas estilo Excel para organizar dados, fazer cálculos e muito mais"
          action={
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4" />
              Criar primeira tabela
            </Button>
          }
        />
      ) : filteredSpreadsheets.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed border-border bg-card"
          icon={Search}
          title="Nenhuma tabela encontrada"
          description="Tente ajustar o termo de busca"
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredSpreadsheets.map((spreadsheet) => (
            <div
              key={spreadsheet.id}
              className="group bg-card rounded-xl border border-border overflow-hidden hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => handleOpenSpreadsheet(spreadsheet)}
            >
              {/* Card Content */}
              <div className="p-4 space-y-3">
                {/* Icon + Title */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Table2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{spreadsheet.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        Tabela
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {spreadsheet.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {spreadsheet.description}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs font-mono">
                      {format(new Date(spreadsheet.updatedAt), 'dd MMM yyyy', { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleOpenModal(spreadsheet); }}
                      title="Editar tabela"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                      onClick={(e) => { e.stopPropagation(); handleDuplicateSpreadsheet(spreadsheet); }}
                      disabled={duplicatingId === spreadsheet.id}
                      title="Duplicar tabela"
                    >
                      {duplicatingId === spreadsheet.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Copy className="w-3.5 h-3.5" />
                      }
                    </button>
                    <button
                      className="p-1 rounded hover:bg-muted text-destructive/70 hover:text-destructive transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleDeleteClick(spreadsheet); }}
                      title="Excluir tabela"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-primary" />
              {editingSpreadsheet ? 'Editar Tabela' : 'Nova Tabela'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Ex: Orçamento, Cronograma, Inventário..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Descreva o propósito desta tabela..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingSpreadsheet ? 'Salvar' : 'Criar Tabela'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tabela</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{spreadsheetToDelete?.name}"?
              Todos os dados serão perdidos. Esta ação não pode ser desfeita.
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
    </div>
  );
}

export default SpreadsheetTab;
