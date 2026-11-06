import { useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { commandFilter } from '@/lib/quickCapture/text';
import { formatShortDate } from '@/lib/quickCapture/format';
import type { Project, Task, Workspace } from '@/lib/types';

export interface AddToDayCandidate {
  task: Task;
  project: Project;
  workspace?: Workspace;
}

interface AddToDayDialogProps {
  open: boolean;
  today: string;
  candidates: AddToDayCandidate[];
  onOpenChange: (open: boolean) => void;
  onAdd: (task: Task) => void;
}


/** Puxa para hoje tarefas abertas de qualquer projeto (fica aberto para escolher várias) */
export function AddToDayDialog({ open, today, candidates, onOpenChange, onAdd }: AddToDayDialogProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; color?: string; items: AddToDayCandidate[] }>();
    for (const c of candidates) {
      const label = `${c.workspace?.name ?? 'Workspace'} · ${c.project.isInbox ? 'Caixa de entrada' : c.project.name}`;
      const group = map.get(c.project.id) ?? { label, color: c.workspace?.color, items: [] };
      group.items.push(c);
      map.set(c.project.id, group);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [candidates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Adicionar ao dia</DialogTitle>
          <DialogDescription>Escolha tarefas para fazer hoje</DialogDescription>
        </DialogHeader>
        <Command filter={commandFilter}>
          <CommandInput placeholder="Adicionar ao dia: buscar tarefa, projeto ou workspace..." />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>Nenhuma tarefa aberta encontrada.</CommandEmpty>
            {groups.map(group => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map(({ task }) => (
                  <CommandItem
                    key={task.id}
                    value={`${task.name} ${group.label} ${task.id}`}
                    onSelect={() => onAdd(task)}
                    className="flex items-center gap-2"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: group.color ?? '#94a3b8' }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{task.name}</span>
                    {task.plannedDate && <span className="text-xs text-muted-foreground">planejada {formatShortDate(task.plannedDate, today)}</span>}
                    {task.endDate && <span className="text-xs text-muted-foreground">prazo {formatShortDate(task.endDate, today)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Enter adiciona e mantém a busca aberta. Esc fecha.</p>
      </DialogContent>
    </Dialog>
  );
}
