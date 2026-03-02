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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4 mr-2" />
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
            <Table2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Tabelas do Projeto</h3>
            <p className="text-xs text-muted-foreground">
              {spreadsheets.length} {spreadsheets.length === 1 ? 'tabela' : 'tabelas'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
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
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nova Tabela
          </Button>
        </div>
      </div>

      {/* Spreadsheets Grid */}
      {spreadsheets.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border-2 border-dashed border-border">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-600/10 flex items-center justify-center mx-auto mb-4">
            <Table2 className="w-8 h-8 text-emerald-600 opacity-60" />
          </div>
          <p className="text-base font-medium mb-1">Nenhuma tabela ainda</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            Crie tabelas estilo Excel para organizar dados, fazer cálculos e muito mais
          </p>
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira tabela
          </Button>
        </div>
      ) : filteredSpreadsheets.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
          <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground font-medium">Nenhuma tabela encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Tente ajustar o termo de busca</p>
          <Button variant="outline" className="mt-4" onClick={() => setSearch('')}>
            Limpar busca
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSpreadsheets.map((spreadsheet) => (
            <div
              key={spreadsheet.id}
              className="group bg-card rounded-xl border border-border overflow-hidden shadow-soft hover:shadow-md transition-all cursor-pointer"
              onClick={() => handleOpenSpreadsheet(spreadsheet)}
            >
              {/* Header Strip */}
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />

              {/* Card Content */}
              <div className="p-4 space-y-3">
                {/* Icon + Title */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Table2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{spreadsheet.name}</h4>
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
                    <span className="text-[11px]">
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
              <Table2 className="h-5 w-5 text-emerald-600" />
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
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
