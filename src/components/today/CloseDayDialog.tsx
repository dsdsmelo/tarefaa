import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TodayItem } from '@/lib/today';
import { addDaysISO } from '@/lib/taskDates';
import { parseDateText } from '@/lib/quickCapture/dates';
import { formatShortDate } from '@/lib/quickCapture/format';
import { CLEAR_PLAN_DISABLED_REASON } from './TodayTaskRow';

export type CloseDayChoice = 'tomorrow' | 'date' | 'remove';

export interface CloseDayDecision {
  taskId: string;
  choice: CloseDayChoice;
  /** Data planejada nova ('tomorrow' e 'date'); null em 'remove' */
  plannedDate: string | null;
}

interface CloseDayDialogProps {
  open: boolean;
  today: string;
  done: TodayItem[];
  /** Pendentes de "Planejadas para hoje" e "Atrasadas" */
  pending: TodayItem[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (decisions: CloseDayDecision[]) => void;
}

const CHOICES: { value: CloseDayChoice; label: string }[] = [
  { value: 'tomorrow', label: 'Amanhã' },
  { value: 'date', label: 'Escolher data' },
  { value: 'remove', label: 'Tirar do dia' },
];

export function CloseDayDialog({ open, today, done, pending, saving, onOpenChange, onConfirm }: CloseDayDialogProps) {
  const [choices, setChoices] = useState<Record<string, CloseDayChoice>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const tomorrow = addDaysISO(today, 1);

  // Ao abrir: todas para amanhã
  useEffect(() => {
    if (!open) return;
    setChoices(Object.fromEntries(pending.map(item => [item.task.id, 'tomorrow' as CloseDayChoice])));
    setDates({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolved = useMemo(() => pending.map(item => {
    const id = item.task.id;
    const choice = choices[id] ?? 'tomorrow';
    if (choice === 'tomorrow') return { item, choice, plannedDate: tomorrow, error: null as string | null };
    if (choice === 'remove') return { item, choice, plannedDate: null, error: null };
    const text = dates[id] ?? '';
    const parsed = text.trim() ? parseDateText(text, today) : null;
    const error = !text.trim() ? 'escreva a data' : !parsed ? 'data não reconhecida' : parsed.iso <= today ? 'escolha um dia depois de hoje' : null;
    return { item, choice, plannedDate: parsed?.iso ?? null, error };
  }), [pending, choices, dates, today, tomorrow]);

  const invalid = resolved.some(r => r.error);
  const setAll = (choice: CloseDayChoice) =>
    setChoices(Object.fromEntries(pending.map(item => [
      item.task.id,
      choice === 'remove' && !item.canClearPlan ? (choices[item.task.id] ?? 'tomorrow') : choice,
    ])));
  const blockedFromRemoving = pending.filter(item => !item.canClearPlan).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechar o dia</DialogTitle>
          <DialogDescription>Revise o que ficou pendente e decida para quando vai cada tarefa.</DialogDescription>
        </DialogHeader>

        <section className="space-y-1.5">
          <h4 className="text-sm font-semibold">Concluídas hoje ({done.length})</h4>
          {done.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tarefa concluída hoje.</p>
          ) : (
            <ul className="space-y-1">
              {done.map(({ task }) => (
                <li key={task.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate line-through">{task.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Pendentes ({pending.length})</h4>
            {pending.length > 0 && (
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAll('tomorrow')}>Mover todas para amanhã</Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAll('remove')}
                  title={blockedFromRemoving > 0 ? `${blockedFromRemoving} com prazo vencido continuam com a escolha atual` : undefined}
                >
                  Tirar todas do dia
                </Button>
              </div>
            )}
          </div>
          {pending.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada pendente. Bom trabalho!</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {resolved.map(({ item, choice, error, plannedDate }) => (
                <li key={item.task.id} className="space-y-1.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.task.name}</span>
                    {item.dueOverdue && item.task.endDate && (
                      <span className="text-xs text-red-600 dark:text-red-400">prazo vencido · {formatShortDate(item.task.endDate, today)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={`Destino de ${item.task.name}`}>
                    {CHOICES.map(option => {
                      const disabled = option.value === 'remove' && !item.canClearPlan;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={choice === option.value}
                          disabled={disabled}
                          title={disabled ? CLEAR_PLAN_DISABLED_REASON : undefined}
                          onClick={() => setChoices(prev => ({ ...prev, [item.task.id]: option.value }))}
                          className={cn(
                            'rounded-md border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                            choice === option.value ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border hover:bg-muted'
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                    {choice === 'date' && (
                      <input
                        autoFocus
                        value={dates[item.task.id] ?? ''}
                        onChange={(e) => setDates(prev => ({ ...prev, [item.task.id]: e.target.value }))}
                        placeholder="segunda, 15/11"
                        aria-label={`Nova data de ${item.task.name}`}
                        className="h-7 w-36 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    )}
                    <span className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
                      {error ?? (choice === 'remove'
                        ? 'fica no projeto, sem data planejada'
                        : plannedDate ? formatShortDate(plannedDate, today) : '')}
                    </span>
                    {!item.canClearPlan && (
                      <span className="w-full text-[11px] text-muted-foreground">Tirar do dia indisponível: {CLEAR_PLAN_DISABLED_REASON}.</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button
            onClick={() => onConfirm(resolved.map(r => ({ taskId: r.item.task.id, choice: r.choice, plannedDate: r.plannedDate })))}
            disabled={invalid || saving}
          >
            {saving ? 'Fechando...' : 'Fechar o dia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
