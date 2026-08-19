import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { RichTextEditor } from './RichTextEditor';
import {
  ScrollText, Plus, Upload, Sparkles, Loader2, Copy, Download, Mail,
  Pencil, Trash2, MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MeetingMinute {
  id: string;
  project_id: string;
  title: string;
  meeting_date: string;
  transcript: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

const todayStr = () => new Date().toLocaleDateString('sv-SE');

const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return doc.body.textContent || '';
};

// Limpa legendas .vtt/.srt (remove timestamps e numeração de cues)
const cleanTranscript = (fileName: string, text: string): string => {
  const isVtt = fileName.toLowerCase().endsWith('.vtt') || text.startsWith('WEBVTT');
  const isSrt = fileName.toLowerCase().endsWith('.srt');
  if (!isVtt && !isSrt) return text;
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      if (l === 'WEBVTT') return false;
      if (l.includes('-->')) return false;
      if (/^\d+$/.test(l)) return false;
      return true;
    })
    .join('\n');
};

interface MeetingMinutesTabProps {
  projectId: string;
}

export function MeetingMinutesTab({ projectId }: MeetingMinutesTabProps) {
  const { user } = useAuth();
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingMinute | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MeetingMinute | null>(null);

  const fetchMinutes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('meeting_minutes')
      .select('*')
      .eq('project_id', projectId)
      .order('meeting_date', { ascending: false });
    if (error) {
      console.error('Erro ao carregar atas:', error);
      toast.error('Erro ao carregar atas');
    } else {
      setMinutes((data ?? []) as MeetingMinute[]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchMinutes();
  }, [fetchMinutes]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('meeting_minutes').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir ata');
    } else {
      toast.success('Ata excluída');
      setMinutes((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const handleCopy = async (m: MeetingMinute) => {
    const text = `${m.title}\nData: ${format(new Date(m.meeting_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}\n\n${stripHtml(m.content || '')}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Ata copiada');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleExportPDF = (m: MeetingMinute) => {
    const printContent = `<!DOCTYPE html><html><head><title>${m.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; line-height: 1.6; }
        h1 { color: #1a1a1a; margin-bottom: 4px; }
        .meta { color: #666; margin-bottom: 24px; font-size: 14px; }
        .content h2 { font-size: 18px; margin: 18px 0 6px; }
        .content h3 { font-size: 15px; margin: 14px 0 4px; }
        .content ul, .content ol { padding-left: 22px; }
      </style></head><body>
      <h1>${m.title}</h1>
      <div class="meta">Data da reunião: ${format(new Date(m.meeting_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</div>
      <div class="content">${m.content || ''}</div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(printContent);
      w.document.close();
      w.onload = () => w.print();
    }
  };

  const handleEmail = (m: MeetingMinute) => {
    const subject = encodeURIComponent(`Ata de Reunião — ${m.title}`);
    const body = encodeURIComponent(`${m.title}\nData: ${format(new Date(m.meeting_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}\n\n${stripHtml(m.content || '')}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Atas de Reunião</h3>
            <p className="text-xs text-muted-foreground">
              Gere atas padronizadas a partir das transcrições das reuniões
            </p>
          </div>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gradient-primary text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nova Ata
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : minutes.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl border-2 border-dashed border-border">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <ScrollText className="w-8 h-8 text-muted-foreground opacity-60" />
          </div>
          <p className="text-base font-medium mb-1">Nenhuma ata ainda</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            Suba a transcrição de uma reunião (Meet, Teams…) e gere uma ata padronizada para enviar ao cliente
          </p>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira ata
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {minutes.map((m) => {
            const preview = stripHtml(m.content || '');
            return (
              <div
                key={m.id}
                className="group flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => { setEditing(m); setModalOpen(true); }}
              >
                <ScrollText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{m.title}</div>
                  {preview && <div className="text-xs text-muted-foreground truncate mt-0.5">{preview.slice(0, 120)}</div>}
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                  {format(new Date(m.meeting_date + 'T12:00:00'), 'dd MMM yyyy', { locale: ptBR })}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(m); setModalOpen(true); }}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopy(m)}>
                        <Copy className="w-4 h-4 mr-2" /> Copiar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportPDF(m)}>
                        <Download className="w-4 h-4 mr-2" /> Exportar PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEmail(m)}>
                        <Mail className="w-4 h-4 mr-2" /> Enviar por e-mail
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(m)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MinuteFormModal
        projectId={projectId}
        userId={user?.id}
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        onSaved={fetchMinutes}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ata?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A ata "{deleteTarget?.title}" será excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface MinuteFormModalProps {
  projectId: string;
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: MeetingMinute | null;
  onSaved: () => void;
}

function MinuteFormModal({ projectId, userId, open, onOpenChange, editing, onSaved }: MinuteFormModalProps) {
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(todayStr());
  const [transcript, setTranscript] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setMeetingDate(editing.meeting_date);
        setTranscript(editing.transcript || '');
        setContent(editing.content || '');
      } else {
        setTitle('');
        setMeetingDate(todayStr());
        setTranscript('');
        setContent('');
      }
    }
  }, [open, editing]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setTranscript(cleanTranscript(file.name, text));
      toast.success('Transcrição carregada');
    } catch {
      toast.error('Não foi possível ler o arquivo');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (transcript.trim().length < 20) {
      toast.error('Cole ou suba uma transcrição válida');
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-meeting-minutes', {
        body: { transcript, title: title.trim() || undefined, meetingDate, projectId },
      });
      if (error) {
        let detail = error.message || 'erro desconhecido';
        try {
          const body = await (error as { context?: Response }).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* mantém mensagem padrão */ }
        toast.error(`Falha ao gerar ata: ${detail}`);
        return;
      }
      if (data?.html) {
        setContent(data.html);
        if (data.truncated) toast.warning('A transcrição era longa e foi truncada para gerar a ata.');
        toast.success('Ata gerada! Revise antes de salvar.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar ata');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Título é obrigatório'); return; }
    if (!content.trim()) { toast.error('Gere ou escreva o conteúdo da ata antes de salvar'); return; }
    setIsSaving(true);
    try {
      const payload = {
        project_id: projectId,
        user_id: userId,
        title: title.trim(),
        meeting_date: meetingDate,
        transcript: transcript || null,
        content,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('meeting_minutes').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Ata atualizada');
      } else {
        const { error } = await supabase.from('meeting_minutes').insert(payload);
        if (error) throw error;
        toast.success('Ata salva');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar ata');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[94vh] sm:max-w-[96vw] flex flex-col gap-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            {editing ? 'Editar Ata' : 'Nova Ata de Reunião'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col min-h-0 flex-1 gap-4 py-2">
          {/* Título + Data */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ata-title" className="text-sm font-medium">Título</Label>
              <Input id="ata-title" placeholder="Ex: Reunião de kickoff — Cliente X" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ata-date" className="text-sm font-medium">Data da reunião</Label>
              <Input id="ata-date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
          </div>

          {/* Transcrição */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Transcrição da reunião</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Subir arquivo (.txt, .vtt, .srt)
                </Button>
                <Button type="button" size="sm" onClick={handleGenerate} disabled={isGenerating} className="gradient-primary text-white">
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {isGenerating ? 'Gerando...' : 'Gerar Ata'}
                </Button>
              </div>
            </div>
            <Textarea
              placeholder="Cole aqui a transcrição/legenda da reunião (ou suba o arquivo). A IA vai gerar a ata organizada."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="h-28 resize-none font-mono text-xs"
            />
            <input ref={fileInputRef} type="file" accept=".txt,.vtt,.srt,text/plain" onChange={handleFile} className="hidden" />
          </div>

          {/* Ata gerada */}
          <div className="flex flex-col min-h-0 flex-1">
            <Label className="text-sm font-medium mb-2">Ata {content ? '(revise antes de salvar)' : ''}</Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="A ata gerada aparecerá aqui. Você também pode escrever/editar manualmente."
              minHeight="100%"
              className={cn('flex-1 min-h-0')}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-primary text-white">
            {isSaving ? 'Salvando...' : editing ? 'Salvar Ata' : 'Salvar Ata'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MeetingMinutesTab;
