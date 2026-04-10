import { useState, useMemo, useCallback } from 'react';
import { useData } from '@/contexts/DataContext';
import { MeetingNote } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  X,
  StickyNote,
  Download,
  Mail,
  Share2,
  Copy,
  ChevronRight,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NoteFormModal } from './NoteFormModal';

interface NotesListViewProps {
  projectId: string;
}

// Helper to strip HTML tags for preview
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

// Get content preview from note
const getPreview = (note: MeetingNote): string => {
  if (note.templateData) {
    const data = note.templateData as any;
    return data.content ? stripHtml(data.content) : '';
  }
  return note.content || '';
};

export function NotesListView({ projectId }: NotesListViewProps) {
  const { meetingNotes, deleteMeetingNote } = useData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<MeetingNote | null>(null);
  const [search, setSearch] = useState('');

  const projectNotes = useMemo(() => {
    return meetingNotes
      .filter(n => n.projectId === projectId)
      .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
  }, [meetingNotes, projectId]);

  const filteredNotes = useMemo(() => {
    if (!search.trim()) return projectNotes;
    const searchLower = search.toLowerCase();
    return projectNotes.filter(note => {
      const preview = getPreview(note);
      return (
        note.title.toLowerCase().includes(searchLower) ||
        preview.toLowerCase().includes(searchLower)
      );
    });
  }, [projectNotes, search]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleOpenModal = (note?: MeetingNote) => {
    setEditingNote(note || null);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (note: MeetingNote) => {
    setNoteToDelete(note);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      await deleteMeetingNote(noteToDelete.id);
      toast.success('Anotação excluída!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir anotação');
    } finally {
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    }
  };

  const handleCopyToClipboard = async (note: MeetingNote) => {
    const preview = getPreview(note);
    const text = `${note.title}\nData: ${format(new Date(note.meetingDate), 'dd/MM/yyyy', { locale: ptBR })}\n\n${preview}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado para a área de transferência');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleExportPDF = (note: MeetingNote) => {
    const preview = getPreview(note);
    const printContent = `
      <!DOCTYPE html>
      <html><head><title>${note.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; line-height: 1.6; }
        h1 { color: #1a1a1a; margin-bottom: 8px; }
        .meta { background: #f5f5f5; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px; }
        .meta p { margin: 5px 0; color: #666; }
        .meta strong { color: #333; }
        .content { white-space: pre-wrap; background: #fafafa; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #e5e5e5; padding-top: 15px; }
      </style></head><body>
        <h1>${note.title}</h1>
        <div class="meta">
          <p><strong>Data:</strong> ${format(new Date(note.meetingDate), 'dd/MM/yyyy', { locale: ptBR })}</p>
        </div>
        <div class="content">${preview}</div>
        <div class="footer">Criado em: ${format(new Date(note.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
      </body></html>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  };

  const handleShareEmail = (note: MeetingNote) => {
    const preview = getPreview(note);
    const subject = encodeURIComponent(note.title);
    const body = encodeURIComponent(`${note.title}\nData: ${format(new Date(note.meetingDate), 'dd/MM/yyyy', { locale: ptBR })}\n\n${preview}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[hsl(207,90%,45%)] to-[hsl(130,70%,40%)]">
            <StickyNote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Anotações do Projeto</h3>
            <p className="text-xs text-muted-foreground">{projectNotes.length} {projectNotes.length === 1 ? 'anotação' : 'anotações'}</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar anotações..."
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
          <Button onClick={() => handleOpenModal()} className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nova Anotação
          </Button>
        </div>
      </div>

      {/* Notes List */}
      {projectNotes.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border-2 border-dashed border-border">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(207,90%,45%)]/10 to-[hsl(130,70%,40%)]/10 flex items-center justify-center mx-auto mb-4">
            <StickyNote className="w-8 h-8 text-primary opacity-60" />
          </div>
          <p className="text-base font-medium mb-1">Nenhuma anotação ainda</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            Registre decisões, ideias, lembretes e tudo que é importante para o projeto
          </p>
          <Button onClick={() => handleOpenModal()} className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira anotação
          </Button>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
          <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground font-medium">Nenhuma anotação encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Tente ajustar o termo de busca</p>
          <Button variant="outline" className="mt-4" onClick={() => setSearch('')}>
            Limpar busca
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {filteredNotes.map((note) => {
            const preview = getPreview(note);
            const displayPreview = preview.length > 120 ? preview.slice(0, 120) + '...' : preview;

            return (
              <div
                key={note.id}
                className="group flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleOpenModal(note)}
              >
                {/* Icon */}
                <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{note.title}</div>
                  {displayPreview && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{displayPreview}</div>
                  )}
                </div>

                {/* Date */}
                <div className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                  {format(new Date(note.meetingDate), 'dd MMM yyyy', { locale: ptBR })}
                </div>

                {/* Actions — visible on hover */}
                <div
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCopyToClipboard(note)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar texto
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportPDF(note)}>
                        <Download className="w-4 h-4 mr-2" />
                        Exportar PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShareEmail(note)}>
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar por email
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => handleOpenModal(note)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-muted text-destructive/70 hover:text-destructive transition-colors"
                    onClick={() => handleDeleteClick(note)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Chevron */}
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <NoteFormModal
        projectId={projectId}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingNote={editingNote}
        onSuccess={() => setEditingNote(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Anotação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{noteToDelete?.title}"?
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
    </div>
  );
}

export default NotesListView;
