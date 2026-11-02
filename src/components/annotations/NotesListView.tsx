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
  Copy,
  ChevronRight,
  Link2,
  ExternalLink,
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
import { EmptyState } from '@/components/ui/empty-state';
import { ActionsMenu } from '@/components/ui/actions-menu';
import { NoteFormModal } from './NoteFormModal';
import { sanitizeHtml, escapeHtml } from '@/lib/sanitize';

interface NotesListViewProps {
  projectId: string;
}

// Helper to strip HTML tags for preview
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

// Get content preview from note (plain text)
const getPreview = (note: MeetingNote): string => {
  return stripHtml(getContentHtml(note));
};

// Get the rich HTML content from note
const getContentHtml = (note: MeetingNote): string => {
  const data = note.templateData as { content?: string } | undefined;
  if (data && typeof data.content === 'string') return data.content;
  return note.content || '';
};

// Extrai os links (<a href>) do conteúdo da anotação
const extractLinks = (note: MeetingNote): { href: string; label: string }[] => {
  const html = getContentHtml(note);
  if (!html || !html.includes('<a')) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const seen = new Set<string>();
  const links: { href: string; label: string }[] = [];
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = (a.getAttribute('href') || '').trim();
    if (!href || href.startsWith('javascript:') || seen.has(href)) return;
    seen.add(href);
    links.push({ href, label: (a.textContent || href).trim() || href });
  });
  return links;
};

// Mostra uma parte do endereço (sem protocolo/www), comprimido
const formatLinkLabel = (href: string): string => {
  const s = href.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return s.length > 26 ? s.slice(0, 26) + '…' : s;
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
    const contentHtml = sanitizeHtml(getContentHtml(note));
    const safeTitle = escapeHtml(note.title);
    const printContent = `
      <!DOCTYPE html>
      <html><head><title>${safeTitle}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; line-height: 1.6; }
        h1 { color: #1a1a1a; margin-bottom: 8px; }
        .meta { background: #f5f5f5; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px; }
        .meta p { margin: 5px 0; color: #666; }
        .meta strong { color: #333; }
        .content { padding: 4px 0; }
        .content img { max-width: 100%; height: auto; border-radius: 6px; }
        .content table { border-collapse: collapse; width: 100%; }
        .content th, .content td { border: 1px solid #e5e5e5; padding: 6px 10px; text-align: left; }
        .content blockquote { border-left: 4px solid #3b82f6; background: #f8fafc; margin: 12px 0; padding: 4px 14px; color: #475569; }
        .content pre { background: #f1f5f9; padding: 12px; border-radius: 8px; overflow: auto; }
        .content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
        .content ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: flex-start; }
        .footer { margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #e5e5e5; padding-top: 15px; }
      </style></head><body>
        <h1>${safeTitle}</h1>
        <div class="meta">
          <p><strong>Data:</strong> ${format(new Date(note.meetingDate), 'dd/MM/yyyy', { locale: ptBR })}</p>
        </div>
        <div class="content">${contentHtml}</div>
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <StickyNote className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Anotações do Projeto</h3>
            <p className="text-xs text-muted-foreground tabular-nums">{projectNotes.length} {projectNotes.length === 1 ? 'anotação' : 'anotações'}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
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
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4" />
            Nova Anotação
          </Button>
        </div>
      </div>

      {/* Notes List */}
      {projectNotes.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed border-border bg-card"
          icon={StickyNote}
          title="Nenhuma anotação ainda"
          description="Registre decisões, ideias, lembretes e tudo que é importante para o projeto"
          action={
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4" />
              Criar primeira anotação
            </Button>
          }
        />
      ) : filteredNotes.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed border-border bg-card"
          icon={Search}
          title="Nenhuma anotação encontrada"
          description="Tente ajustar o termo de busca"
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          }
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
          {filteredNotes.map((note) => {
            const preview = getPreview(note);
            const displayPreview = preview.length > 120 ? preview.slice(0, 120) + '...' : preview;
            const links = extractLinks(note);

            return (
              <div
                key={note.id}
                className="group flex items-start gap-3 px-5 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => handleOpenModal(note)}
              >
                {/* Icon */}
                <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">{note.title}</span>

                    {/* Links à direita do título — clique direto sem abrir a anotação */}
                    {links.length > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {links.length <= 5 ? (
                          links.map((l, i) => (
                            <a
                              key={i}
                              href={l.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={l.href}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10 transition-colors max-w-[140px]"
                            >
                              <Link2 className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{formatLinkLabel(l.href)}</span>
                            </a>
                          ))
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                title="Abrir links desta anotação"
                                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10 transition-colors"
                              >
                                <Link2 className="w-3 h-3" />
                                {links.length} links
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-w-xs">
                              {links.map((l, i) => (
                                <DropdownMenuItem key={i} asChild>
                                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                                    <ExternalLink className="w-4 h-4 mr-2 flex-shrink-0" />
                                    <span className="truncate">{formatLinkLabel(l.href)}</span>
                                  </a>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}
                  </div>
                  {displayPreview && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{displayPreview}</div>
                  )}
                </div>

                {/* Date */}
                <div className="text-xs font-mono text-muted-foreground flex-shrink-0 mt-0.5">
                  {format(new Date(note.meetingDate), 'dd MMM yyyy', { locale: ptBR })}
                </div>

                {/* Ações: menu padrão, sempre visível */}
                <ActionsMenu
                  items={[
                    { label: 'Editar', icon: Pencil, onClick: () => handleOpenModal(note) },
                    { label: 'Copiar texto', icon: Copy, onClick: () => handleCopyToClipboard(note) },
                    { label: 'Exportar PDF', icon: Download, onClick: () => handleExportPDF(note) },
                    { label: 'Enviar por email', icon: Mail, onClick: () => handleShareEmail(note) },
                    { label: 'Excluir', icon: Trash2, onClick: () => handleDeleteClick(note), destructive: true },
                  ]}
                />

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
