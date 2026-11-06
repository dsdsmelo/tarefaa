import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Person } from '@/lib/types';
import { formatShortDate } from '@/lib/quickCapture/format';
import { defaultFollowUpDate, validateWaiting, WAITING_TEXT_MAX, type WaitingInput } from '@/lib/waiting';

interface WaitingDialogProps {
  open: boolean;
  today: string;
  /** Nome da tarefa, ou "3 tarefas" na mudança em lote */
  subject?: string;
  /** Pessoas que podem ser escolhidas (já filtradas pelo workspace do projeto) */
  people: Pick<Person, 'id' | 'name'>[];
  initial?: Partial<WaitingInput>;
  /** Texto do botão (ex.: "Cobrar de novo") */
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: WaitingInput) => void;
}

/** Marca como Aguardando: de quem (pessoa ou texto livre) e data de cobrança, obrigatórios */
export function WaitingDialog({ open, today, subject, people, initial, confirmLabel, onOpenChange, onSubmit }: WaitingDialogProps) {
  const [personId, setPersonId] = useState('');
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPersonId(initial?.waitingOnPersonId ?? '');
    setText(initial?.waitingOnText ?? '');
    setDate(initial?.followUpDate ?? defaultFollowUpDate(today));
    setTouched(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const error = validateWaiting({ personId: personId || null, text, followUpDate: date });

  const submit = () => {
    setTouched(true);
    if (error) return;
    onSubmit({ waitingOnPersonId: personId || null, waitingOnText: personId ? null : text.trim(), followUpDate: date });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aguardando</DialogTitle>
          <DialogDescription>{subject ? <>"{subject}". </> : null}De quem você está esperando e quando cobrar.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="waiting-person">De quem</Label>
            <select
              id="waiting-person"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Outra (escrever abaixo)</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!personId && (
              <Input
                autoFocus
                aria-label="De quem (texto livre)"
                placeholder="ex.: cliente, financeiro, fornecedor"
                maxLength={WAITING_TEXT_MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="waiting-date">Cobrar em</Label>
            <Input id="waiting-date" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {date ? formatShortDate(date, today) : ''} · padrão: daqui a 3 dias úteis
            </p>
          </div>
          {touched && error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{confirmLabel ?? 'Marcar como Aguardando'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
