import { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { MeetingNote } from '@/lib/types';
import {
  GeneralTemplateData,
  NoteTemplateData,
  createDefaultGeneralData,
} from '@/lib/spreadsheet-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Pencil,
  NotebookPen,
  Calendar,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { GeneralTemplate } from './templates/GeneralTemplate';

// Keep exports for backward compatibility with any other files that may import them
export const NOTE_CATEGORIES = [
  { id: 'general' as const, label: 'Geral', color: 'bg-slate-500', textColor: 'text-slate-600', bgLight: 'bg-slate-50 dark:bg-slate-500/10', borderColor: 'border-slate-200 dark:border-slate-500/30', icon: Calendar },
] as const;

export const getCategoryInfo = (_category: string) => NOTE_CATEGORIES[0];

export const getNoteCategory = (note: MeetingNote) => {
  if (note.category) return note.category;
  if (note.participants && note.participants.length > 0) {
    const catEntry = note.participants.find(p => p.startsWith('cat:'));
    if (catEntry) return catEntry.replace('cat:', '');
  }
  return 'general';
};

export const getActualParticipants = (participants?: string[]): string[] => {
  if (!participants) return [];
  return participants.filter(p => !p.startsWith('cat:'));
};

interface NoteFormModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingNote?: MeetingNote | null;
  onSuccess?: () => void;
}

export function NoteFormModal({
  projectId,
  open,
  onOpenChange,
  editingNote,
  onSuccess,
}: NoteFormModalProps) {
  const { addMeetingNote, updateMeetingNote } = useData();
  const { user, profile } = useAuth();

  const meta = (user?.user_metadata ?? {}) as { first_name?: string; full_name?: string; name?: string };
  const currentUserName =
    profile?.full_name?.trim() ||
    meta.full_name?.trim() ||
    meta.first_name?.trim() ||
    meta.name?.trim() ||
    user?.email?.split('@')[0] ||
    'Usuário';

  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [templateData, setTemplateData] = useState<GeneralTemplateData>(createDefaultGeneralData());
  const [isSaving, setIsSaving] = useState(false);
  // O editor de anotações abre sempre em tela cheia (sem passo extra de expandir)
  const expanded = true;

  useEffect(() => {
    if (open) {
      if (editingNote) {
        setTitle(editingNote.title);
        setMeetingDate(new Date(editingNote.meetingDate));

        if (editingNote.templateData) {
          setTemplateData(editingNote.templateData as GeneralTemplateData);
        } else {
          setTemplateData({ content: editingNote.content || '' } as GeneralTemplateData);
        }
      } else {
        setTitle('');
        setMeetingDate(new Date());
        setTemplateData(createDefaultGeneralData());
      }
    }
  }, [open, editingNote]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      const content = templateData.content || '';
      const participants: string[] = ['cat:general'];

      // Metadados de edição (guardados no templateData, sem migração)
      const templateWithMeta: GeneralTemplateData = {
        ...templateData,
        content,
        lastEditedByName: currentUserName,
        lastEditedAt: new Date().toISOString(),
      };

      const noteData = {
        title: title.trim(),
        content,
        meetingDate: meetingDate.toISOString().split('T')[0],
        participants,
        category: 'general' as const,
        templateData: templateWithMeta as NoteTemplateData,
      };

      if (editingNote) {
        await updateMeetingNote(editingNote.id, noteData);
        toast.success('Anotação atualizada!');
      } else {
        await addMeetingNote({
          projectId,
          ...noteData,
        });
        toast.success('Anotação criada!');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar anotação');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden',
          expanded
            ? 'max-w-[96vw] w-[96vw] h-[94vh] sm:max-w-[96vw]'
            : 'max-w-2xl max-h-[90vh]'
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingNote ? (
              <>
                <Pencil className="h-5 w-5 text-muted-foreground" />
                Editar Anotação
              </>
            ) : (
              <>
                <NotebookPen className="h-5 w-5 text-muted-foreground" />
                Nova Anotação
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className={cn('flex flex-col min-h-0 py-2', expanded ? 'flex-1 gap-4' : 'gap-5 overflow-y-auto')}>
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">Título</Label>
            <Input
              id="title"
              placeholder="Ex: Definição de escopo, Brainstorm ideias, Lembrar de..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {editingNote && (
              <p className="text-xs text-muted-foreground">
                Criado em {format(new Date(editingNote.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                {templateData.lastEditedByName && templateData.lastEditedAt && (
                  <>
                    {' · '}Última edição por <span className="font-medium">{templateData.lastEditedByName}</span>
                    {' em '}{format(new Date(templateData.lastEditedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </>
                )}
              </p>
            )}
          </div>

          {/* Template Content */}
          <div className={cn('flex flex-col min-h-0', expanded ? 'flex-1' : 'border-t pt-4')}>
            <GeneralTemplate
              data={templateData}
              onChange={(data) => setTemplateData(data as GeneralTemplateData)}
              isExpanded={expanded}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gradient-primary text-white"
          >
            {isSaving ? 'Salvando...' : editingNote ? 'Salvar Anotação' : 'Criar Anotação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NoteFormModal;
