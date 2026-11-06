import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  FolderInput,
  Hourglass,
  Inbox as InboxIcon,
  Keyboard,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageBody } from '@/components/layout/PageBody';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { TaskFormModal } from '@/components/modals/TaskFormModal';
import { DateTextDialog, type DateField } from '@/components/planning/DateTextDialog';
import { EstimateDialog } from '@/components/planning/EstimateDialog';
import { hasOpenOverlay, isPlainKey } from '@/components/quick-capture/hotkeys';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';
import { friendlyDbError } from '@/lib/dbErrors';
import { priorityLabels, type Project, type Task, type TaskPriority } from '@/lib/types';
import { daysUntilDue, isTaskOpen, todayISO } from '@/lib/taskDates';
import { formatShortDate } from '@/lib/quickCapture/format';
import { formatMinutes } from '@/lib/estimate';
import { commandFilter } from '@/lib/quickCapture/text';

type Picker = 'move' | DateField | 'estimate' | 'responsible' | 'help' | null;

const PRIORITY_BY_KEY: Record<string, TaskPriority> = { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'low' };

const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

const SHORTCUTS: [string, string][] = [
  ['↑ ↓ ou j k', 'Navegar'],
  ['m', 'Mover para um projeto'],
  ['d', 'Planejado para ("sexta", "15/11", vazio para tirar)'],
  ['D (Shift+d)', 'Prazo'],
  ['e', 'Estimativa ("30m", "1h30")'],
  ['1 2 3 4', 'Prioridade: urgente, alta, média, baixa'],
  ['r', 'Responsável (liga/desliga)'],
  ['Enter', 'Abrir o formulário completo'],
  ['x', 'Concluir'],
  ['Del', 'Excluir'],
  ['q ou Ctrl/Cmd+K', 'Captura rápida'],
  ['?', 'Mostrar os atalhos'],
];


const Inbox = () => {
  const {
    inboxProject, inboxTasks, allProjects, workspaces, people, loading,
    updateTask, deleteTask, addTask,
  } = useData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [formTask, setFormTask] = useState<Task | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const today = todayISO();

  // Abertas, das mais novas para as mais antigas
  const items = useMemo(
    () => inboxTasks
      .filter(isTaskOpen)
      .sort((a, b) => (b.createdAt ?? b.updatedAt).localeCompare(a.createdAt ?? a.updatedAt)),
    [inboxTasks]
  );

  const selectedIndex = Math.max(0, items.findIndex(t => t.id === selectedId));
  const selected = items[selectedIndex] ?? null;

  // Mantém uma seleção válida quando a lista muda (item triado sai da lista)
  useEffect(() => {
    if (items.length === 0) { setSelectedId(null); return; }
    if (!selectedId || !items.some(t => t.id === selectedId)) {
      setSelectedId(items[Math.min(selectedIndex, items.length - 1)].id);
    }
  }, [items, selectedId, selectedIndex]);

  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector(`[data-task-id="${selected.id}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);

  const workspaceName = (id: string) => workspaces.find(w => w.id === id)?.name ?? '';
  const personName = (id: string) => people.find(p => p.id === id)?.name ?? '';

  const projectsByWorkspace = useMemo(() => {
    const open = allProjects.filter(p => p.status !== 'completed' && p.status !== 'cancelled');
    return workspaces
      .map(w => ({ workspace: w, projects: open.filter(p => p.workspaceId === w.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }))
      .filter(g => g.projects.length > 0);
  }, [allProjects, workspaces]);

  const fail = (err: unknown, fallback: string) => {
    console.error(fallback, err);
    toast.error(friendlyDbError(err, 'Você não tem permissão para esta alteração.', fallback));
  };

  const move = async (task: Task, project: Project) => {
    setPicker(null);
    try {
      await updateTask(task.id, { projectId: project.id });
      toast.success(`"${task.name}" movida para ${project.name} (${workspaceName(project.workspaceId)})`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, { projectId: task.projectId }); } },
      });
    } catch (err) { fail(err, 'Não foi possível mover a tarefa.'); }
  };

  // d: data planejada; D: prazo. null limpa a data no banco (undefined seria ignorado)
  const setDate = async (task: Task, field: DateField, iso: string | null) => {
    setPicker(null);
    const label = field === 'planned' ? 'Planejado para' : 'Prazo';
    const updates: Partial<Task> = field === 'planned'
      ? { plannedDate: iso }
      : { endDate: iso as unknown as string };
    const previous: Partial<Task> = field === 'planned'
      ? { plannedDate: task.plannedDate ?? null }
      : { endDate: (task.endDate ?? null) as unknown as string };
    try {
      await updateTask(task.id, updates);
      toast.success(iso ? `${label}: ${formatShortDate(iso, today)}` : `${label}: removido`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, previous); } },
      });
    } catch (err) { fail(err, field === 'planned' ? 'Não foi possível mudar a data planejada.' : 'Não foi possível mudar o prazo.'); }
  };

  const setEstimate = async (task: Task, minutes: number | null) => {
    setPicker(null);
    try {
      await updateTask(task.id, { estimateMinutes: minutes });
      toast.success(minutes ? `Estimativa: ${formatMinutes(minutes)}` : 'Estimativa removida', {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, { estimateMinutes: task.estimateMinutes ?? null }); } },
      });
    } catch (err) { fail(err, 'Não foi possível mudar a estimativa.'); }
  };

  const setPriority = useCallback(async (task: Task, priority: TaskPriority) => {
    if (task.priority === priority) return;
    try {
      await updateTask(task.id, { priority });
      toast.success(`Prioridade: ${priorityLabels[priority]}`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, { priority: task.priority }); } },
      });
    } catch (err) { fail(err, 'Não foi possível mudar a prioridade.'); }
  }, [updateTask]);

  const toggleResponsible = async (task: Task, personId: string) => {
    setPicker(null);
    const current = task.responsibleIds ?? [];
    const next = current.includes(personId) ? current.filter(id => id !== personId) : [...current, personId];
    try {
      await updateTask(task.id, { responsibleIds: (next.length > 0 ? next : null) as unknown as string[] });
      toast.success(current.includes(personId) ? `${personName(personId)} removido` : `${personName(personId)} é responsável`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, { responsibleIds: (current.length > 0 ? current : null) as unknown as string[] }); } },
      });
    } catch (err) { fail(err, 'Não foi possível mudar o responsável.'); }
  };

  const complete = useCallback(async (task: Task) => {
    try {
      await updateTask(task.id, { status: 'completed' });
      toast.success(`"${task.name}" concluída`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, { status: task.status }); } },
      });
    } catch (err) { fail(err, 'Não foi possível concluir a tarefa.'); }
  }, [updateTask]);

  const remove = useCallback(async (task: Task) => {
    try {
      await deleteTask(task.id);
      toast.success(`"${task.name}" excluída`, {
        action: {
          label: 'Desfazer',
          onClick: () => {
            // Recria com os mesmos dados (nova id)
            void addTask({
              name: task.name, description: task.description, projectId: task.projectId,
              phaseId: task.phaseId, responsibleIds: task.responsibleIds, startDate: task.startDate,
              endDate: task.endDate, status: task.status, priority: task.priority,
              observation: task.observation, customValues: task.customValues,
            });
          },
        },
      });
    } catch (err) { fail(err, 'Não foi possível excluir a tarefa.'); }
  }, [deleteTask, addTask]);

  const openPicker = (kind: Picker) => setPicker(kind);

  // Triagem pelo teclado (desligada com diálogo aberto ou digitando)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isPlainKey(e) || hasOpenOverlay()) return;
      if (e.key === '?') { e.preventDefault(); setPicker('help'); return; }
      if (!selected) return;
      const step = (delta: number) => {
        const next = items[Math.min(items.length - 1, Math.max(0, selectedIndex + delta))];
        if (next) setSelectedId(next.id);
      };
      switch (e.key) {
        case 'ArrowDown': case 'j': e.preventDefault(); step(1); break;
        case 'ArrowUp': case 'k': e.preventDefault(); step(-1); break;
        case 'm': e.preventDefault(); setPicker('move'); break;
        case 'd': e.preventDefault(); setPicker('planned'); break;
        case 'D': e.preventDefault(); setPicker('due'); break;
        case 'e': e.preventDefault(); setPicker('estimate'); break;
        case 'r': e.preventDefault(); setPicker('responsible'); break;
        case 'Enter': e.preventDefault(); setFormTask(selected); break;
        case 'x': e.preventDefault(); void complete(selected); break;
        case 'Delete': case 'Backspace': e.preventDefault(); void remove(selected); break;
        default:
          if (PRIORITY_BY_KEY[e.key]) { e.preventDefault(); void setPriority(selected, PRIORITY_BY_KEY[e.key]); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items, selected, selectedIndex, complete, remove, setPriority]);

  const subtitle = `${items.length} para triar · todos os workspaces`;

  if (loading && !inboxProject) {
    return (
      <MainLayout>
        <Header title="Caixa de entrada" />
        <PageBody><Skeleton className="h-96 rounded-xl" /></PageBody>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header
        title="Caixa de entrada"
        subtitle={subtitle}
        actions={
          <Button variant="outline" size="sm" onClick={() => setPicker('help')}>
            <Keyboard className="w-4 h-4 mr-1.5" /> Atalhos <kbd className="ml-1.5 text-[10px] opacity-70">?</kbd>
          </Button>
        }
      />
      <PageBody>
        <Panel icon={InboxIcon} title="Para triar" description="Mova cada item para um projeto, planeje o dia, defina prazo, estimativa e prioridade, ou conclua.">
          {!inboxProject ? (
            <EmptyState icon={InboxIcon} title="Caixa de entrada indisponível" description="Recarregue a página. Se continuar, avise o suporte." />
          ) : items.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Caixa de entrada vazia"
              description="Capture com Q ou Ctrl/Cmd+K. Sem #projeto, a tarefa chega aqui para você triar depois."
            />
          ) : (
            <ul ref={listRef} className="divide-y divide-border" role="list">
              {items.map(task => {
                const isSelected = task.id === selected?.id;
                const days = daysUntilDue(task);
                const names = (task.responsibleIds ?? []).map(personName).filter(Boolean);
                return (
                  <li
                    key={task.id}
                    data-task-id={task.id}
                    onClick={() => setSelectedId(task.id)}
                    onDoubleClick={() => setFormTask(task)}
                    className={cn(
                      'group flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/40'
                    )}
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority])} title={priorityLabels[task.priority]} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.name}</span>
                    {task.estimateMinutes ? (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Estimativa">~{formatMinutes(task.estimateMinutes)}</span>
                    ) : null}
                    {task.plannedDate && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Planejado para">
                        <CalendarCheck className="mr-0.5 inline h-3 w-3" />{formatShortDate(task.plannedDate, today)}
                      </span>
                    )}
                    {task.endDate && (
                      <span className={cn('shrink-0 text-xs tabular-nums', days !== null && days < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')} title="Prazo">
                        Prazo {formatShortDate(task.endDate, today)}
                      </span>
                    )}
                    {names.length > 0 && (
                      <span className="max-w-[10rem] shrink-0 truncate text-xs text-muted-foreground">{names.map(n => n.split(' ')[0]).join(', ')}</span>
                    )}
                    <span className={cn('flex shrink-0 items-center gap-0.5', isSelected ? 'flex' : 'hidden group-hover:flex')}>
                      <RowAction title="Mover (m)" icon={FolderInput} onClick={() => { setSelectedId(task.id); openPicker('move'); }} />
                      <RowAction title="Planejado para (d)" icon={CalendarCheck} onClick={() => { setSelectedId(task.id); openPicker('planned'); }} />
                      <RowAction title="Prazo (D)" icon={CalendarDays} onClick={() => { setSelectedId(task.id); openPicker('due'); }} />
                      <RowAction title="Estimativa (e)" icon={Hourglass} onClick={() => { setSelectedId(task.id); openPicker('estimate'); }} />
                      <RowAction title="Responsável (r)" icon={UserRound} onClick={() => { setSelectedId(task.id); openPicker('responsible'); }} />
                      <RowAction title="Concluir (x)" icon={Check} onClick={() => void complete(task)} />
                      <RowAction title="Excluir (Del)" icon={Trash2} onClick={() => void remove(task)} destructive />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </PageBody>

      {/* m: mover para projeto */}
      <Dialog open={picker === 'move'} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Mover para projeto</DialogTitle>
            <DialogDescription>Escolha o projeto de destino</DialogDescription>
          </DialogHeader>
          <Command filter={commandFilter}>
            <CommandInput placeholder={`Mover "${selected?.name ?? ''}" para...`} />
            <CommandList>
              <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
              {projectsByWorkspace.map(group => (
                <CommandGroup key={group.workspace.id} heading={group.workspace.name}>
                  {group.projects.map(project => (
                    <CommandItem
                      key={project.id}
                      value={`${project.name} ${group.workspace.name} ${project.id}`}
                      onSelect={() => selected && void move(selected, project)}
                    >
                      {project.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* r: responsável */}
      <Dialog open={picker === 'responsible'} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>Responsável</DialogTitle>
            <DialogDescription>Escolha quem é responsável</DialogDescription>
          </DialogHeader>
          <Command filter={commandFilter}>
            <CommandInput placeholder="Responsável..." />
            <CommandList>
              <CommandEmpty>Ninguém encontrado.</CommandEmpty>
              <CommandGroup heading="Pessoas">
                {people.filter(p => p.active !== false).map(person => (
                  <CommandItem key={person.id} value={`${person.name} ${person.id}`} onSelect={() => selected && void toggleResponsible(selected, person.id)}>
                    <Check className={cn('mr-2 h-4 w-4', selected?.responsibleIds?.includes(person.id) ? 'opacity-100' : 'opacity-0')} />
                    {person.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* d / D: data planejada ou prazo, digitados como na captura; e: estimativa */}
      <DateTextDialog
        open={picker === 'planned' || picker === 'due'}
        field={picker === 'due' ? 'due' : 'planned'}
        today={today}
        taskName={selected?.name}
        onOpenChange={(o) => !o && setPicker(null)}
        onSubmit={(iso) => selected && void setDate(selected, picker === 'due' ? 'due' : 'planned', iso)}
      />
      <EstimateDialog
        open={picker === 'estimate'}
        taskName={selected?.name}
        current={selected?.estimateMinutes}
        onOpenChange={(o) => !o && setPicker(null)}
        onSubmit={(minutes) => selected && void setEstimate(selected, minutes)}
      />

      {/* ?: atalhos */}
      <Dialog open={picker === 'help'} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Atalhos da triagem</DialogTitle>
            <DialogDescription className="text-xs">Funcionam com a lista em foco (fora de campos de texto).</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={keys} className="contents">
                <dt><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">{keys}</kbd></dt>
                <dd className="text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>

      {formTask && (
        <TaskFormModal open={!!formTask} onOpenChange={(o) => !o && setFormTask(null)} task={formTask} />
      )}
    </MainLayout>
  );
};

function RowAction({ title, icon: Icon, onClick, destructive }: { title: string; icon: typeof Check; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'rounded-md p-1.5 text-muted-foreground transition-colors',
        destructive ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export default Inbox;
