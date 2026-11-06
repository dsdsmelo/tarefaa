import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatMinutes, parseEstimate } from '@/lib/estimate';

interface EstimateDialogProps {
  open: boolean;
  taskName?: string;
  current?: number | null;
  onOpenChange: (open: boolean) => void;
  /** minutes = null limpa a estimativa */
  onSubmit: (minutes: number | null) => void;
}

export function EstimateDialog({ open, taskName, current, onOpenChange, onSubmit }: EstimateDialogProps) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(current ? formatMinutes(current) : ''); }, [open, current]);
  const minutes = text.trim() ? parseEstimate(text) : null;

  const submit = () => {
    if (text.trim() && minutes === null) return;
    onSubmit(minutes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm gap-3">
        <DialogHeader>
          <DialogTitle className="text-base">Estimativa</DialogTitle>
          <DialogDescription className="text-xs">
            {taskName ? <>"{taskName}". </> : null}"30m", "1h30", "2h" ou só os minutos. Vazio tira a estimativa.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          aria-label="Estimativa da tarefa"
          placeholder="30m"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          {!text.trim() ? 'Enter: sem estimativa' : minutes !== null ? `Enter: ${formatMinutes(minutes)}` : 'Use de 1 minuto a 24 horas, ex.: 45m ou 1h30'}
        </p>
      </DialogContent>
    </Dialog>
  );
}
