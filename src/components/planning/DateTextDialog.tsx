import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseDateText } from '@/lib/quickCapture/dates';
import { formatShortDate } from '@/lib/quickCapture/format';

export type DateField = 'planned' | 'due';

const COPY: Record<DateField, { title: string; label: string; empty: string }> = {
  planned: { title: 'Planejado para', label: 'Data planejada da tarefa', empty: 'Enter: tirar a data planejada' },
  due: { title: 'Prazo', label: 'Prazo da tarefa', empty: 'Enter: sem prazo' },
};

interface DateTextDialogProps {
  open: boolean;
  field: DateField;
  today: string;
  /** Nome da tarefa, mostrado no subtítulo */
  taskName?: string;
  onOpenChange: (open: boolean) => void;
  /** iso = null limpa a data */
  onSubmit: (iso: string | null) => void;
}

/** Data digitada em português, como na captura ("amanhã", "sexta", "15/11"); vazio limpa */
export function DateTextDialog({ open, field, today, taskName, onOpenChange, onSubmit }: DateTextDialogProps) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  const copy = COPY[field];
  const preview = text.trim() ? parseDateText(text, today) : null;

  const submit = () => {
    const value = text.trim();
    if (value && !preview) return;
    onSubmit(preview?.iso ?? null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm gap-3">
        <DialogHeader>
          <DialogTitle className="text-base">{copy.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {taskName ? <>"{taskName}". </> : null}"amanhã", "sexta", "dia 10", "15/11". Vazio tira a data.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          aria-label={copy.label}
          placeholder="sexta"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          {!text.trim() ? copy.empty : preview ? `Enter: ${formatShortDate(preview.iso, today)}` : 'Data não reconhecida'}
        </p>
      </DialogContent>
    </Dialog>
  );
}
