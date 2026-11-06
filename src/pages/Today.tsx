import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Keyboard,
  MoonStar,
  Plus,
  Sun,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageBody } from '@/components/layout/PageBody';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskFormModal } from '@/components/modals/TaskFormModal';
import { DateTextDialog } from '@/components/planning/DateTextDialog';
import { EstimateDialog } from '@/components/planning/EstimateDialog';
import { hasOpenOverlay, isPlainKey, isTypingTarget } from '@/components/quick-capture/hotkeys';
import { CapacityBar } from '@/components/today/CapacityBar';
import { TodayTaskRow } from '@/components/today/TodayTaskRow';
import { AddToDayDialog, type AddToDayCandidate } from '@/components/today/AddToDayDialog';
import { CloseDayDialog, type CloseDayDecision } from '@/components/today/CloseDayDialog';
import { WaitingDialog } from '@/components/planning/WaitingDialog';
import { peopleForWorkspace } from '@/lib/people';
import { defaultFollowUpDate, waitingOnLabel, waitingUpdates, type WaitingInput } from '@/lib/waiting';
import { useData } from '@/contexts/DataContext';
import { useTodayView } from '@/hooks/useToday';
import { usePlanningSettings } from '@/hooks/usePlanningSettings';
import { cn } from '@/lib/utils';
import { friendlyDbError } from '@/lib/dbErrors';
import { logAuditEvent } from '@/lib/auditLog';
import { formatMinutes } from '@/lib/estimate';
import { capacityFor } from '@/lib/planning';
import { formatShortDate } from '@/lib/quickCapture/format';
import { addDaysISO, isTaskOpen } from '@/lib/taskDates';
import { isRelevantForToday, orderAtEnd, planReorder, type TodayItem, type TodaySectionKey } from '@/lib/today';
import type { Task } from '@/lib/types';

const SECTIONS: { key: TodaySectionKey; title: string; icon: typeof Sun; iconClassName?: string; empty: string }[] = [
  { key: 'overdue', title: 'Atrasadas', icon: AlertTriangle, iconClassName: 'text-red-500', empty: '' },
  { key: 'planned', title: 'Planejadas para hoje', icon: CalendarCheck, empty: 'Arraste tarefas para cá, use h numa tarefa ou "Adicionar ao dia".' },
  { key: 'dueToday', title: 'Vencem hoje', icon: CalendarClock, iconClassName: 'text-amber-500', empty: '' },
  // Tarefas Aguardando com cobrança vencida ou hoje (some quando vazia)
  { key: 'waiting', title: 'Aguardando cobrança hoje', icon: BellRing, iconClassName: 'text-status-waiting', empty: '' },
];

const SHORTCUTS: [string, string][] = [
  ['↑ ↓ ou j k', 'Navegar'],
  ['x', 'Concluir'],
  ['Enter', 'Abrir o formulário'],
  ['e', 'Estimativa'],
  ['h', 'Fazer hoje (planejar para hoje)'],
  ['t', 'Mover para amanhã'],
  ['d', 'Escolher a data planejada'],
  ['w', 'Aguardando (ou cobrar de novo)'],
  ['v', 'Voltou: Aguardando volta para Pendente'],
  ['Alt+↑ Alt+↓', 'Reordenar em "Planejadas para hoje"'],
  ['a', 'Adicionar ao dia'],
  ['q ou Ctrl/Cmd+K', 'Captura rápida'],
  ['?', 'Mostrar os atalhos'],
];

const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

type Picker = 'date' | 'estimate' | 'add' | 'close' | 'help' | null;

const Today = () => {
  const { allTasks, workspaces, people, loading, updateTask } = useData();
  const { today, scope, setScope, sections, summary, projectsById, ctx } = useTodayView();
  const { settings } = usePlanningSettings();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [formTask, setFormTask] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ index: number } | null>(null);
  // Aguardando: marcar (set) ou cobrar de novo (again)
  const [waitingFor, setWaitingFor] = useState<{ task: Task; mode: 'set' | 'again' } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const tomorrow = addDaysISO(today, 1);
  const capacity = capacityFor(settings, today);
  const plannedTasks = useMemo(() => sections.planned.map(i => i.task), [sections.planned]);

  // Ordem visual das tarefas abertas (navegação pelo teclado)
  const flat = useMemo(
    () => [...sections.overdue, ...sections.planned, ...sections.dueToday, ...sections.waiting],
    [sections.overdue, sections.planned, sections.dueToday, sections.waiting]
  );
  const selectedIndex = flat.findIndex(i => i.task.id === selectedId);
  const selected: TodayItem | null = flat[selectedIndex] ?? null;

  useEffect(() => {
    if (flat.length === 0) { if (selectedId) setSelectedId(null); return; }
    if (!selectedId || selectedIndex === -1) setSelectedId(flat[0].task.id);
  }, [flat, selectedId, selectedIndex]);

  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector(`[data-task-id="${selected.task.id}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);

  const workspaceOf = (projectId: string) => {
    const project = projectsById.get(projectId);
    return project ? workspaces.find(w => w.id === project.workspaceId) : undefined;
  };
  // Pessoas para "Aguardando de quem": as do workspace do projeto da tarefa
  const waitingPeopleFor = (task: Task) => {
    const project = projectsById.get(task.projectId);
    const workspaceId = project && !project.isInbox ? project.workspaceId : null;
    return peopleForWorkspace(people, workspaceId, task.waitingOnPersonId ? [task.waitingOnPersonId] : []);
  };
  const responsibleNames = (task: Task) =>
    (task.responsibleIds ?? []).map(id => people.find(p => p.id === id)?.name?.split(' ')[0]).filter(Boolean) as string[];

  const fail = (err: unknown, fallback: string) => {
    console.error(fallback, err);
    toast.error(friendlyDbError(err, 'Você não tem permissão para alterar esta tarefa.', fallback));
  };

  // ---------- Ações ----------
  const complete = useCallback(async (task: Task) => {
    try {
      await updateTask(task.id, { status: 'completed' });
      toast.success(`"${task.name}" concluída`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, { status: task.status }); } },
      });
    } catch (err) { fail(err, 'Não foi possível concluir a tarefa.'); }
  }, [updateTask]);

  /** Muda a data planejada; hoje entra no fim do dia, outro dia (ou nenhum) limpa a ordem */
  const plan = useCallback(async (task: Task, iso: string | null, message?: string) => {
    const previous: Partial<Task> = { plannedDate: task.plannedDate ?? null, todayOrder: task.todayOrder ?? null };
    const todayOrder = iso === today ? orderAtEnd(plannedTasks.filter(t => t.id !== task.id)) : null;
    try {
      await updateTask(task.id, { plannedDate: iso, todayOrder });
      const text = message ?? (iso ? `Planejada para ${formatShortDate(iso, today)}` : 'Tirada do dia');
      toast.success(`"${task.name}": ${text.charAt(0).toLowerCase()}${text.slice(1)}`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, previous); } },
      });
    } catch (err) { fail(err, 'Não foi possível mudar a data planejada.'); }
  }, [updateTask, today, plannedTasks]);

  const setEstimate = useCallback(async (task: Task, minutes: number | null) => {
    try {
      await updateTask(task.id, { estimateMinutes: minutes });
    } catch (err) { fail(err, 'Não foi possível mudar a estimativa.'); }
  }, [updateTask]);

  /** Grava a ordem nova; se a tarefa vem de outra seção, planeja para hoje */
  const placeInPlanned = useCallback(async (task: Task, targetIndex: number) => {
    const updates = planReorder(plannedTasks, task, targetIndex);
    const comingIn = task.plannedDate?.slice(0, 10) !== today;
    try {
      await Promise.all(updates.map(u =>
        updateTask(u.id, u.id === task.id && comingIn ? { plannedDate: today, todayOrder: u.todayOrder } : { todayOrder: u.todayOrder })
      ));
      if (comingIn && !updates.some(u => u.id === task.id)) await updateTask(task.id, { plannedDate: today });
      if (comingIn) toast.success(`"${task.name}" planejada para hoje`);
    } catch (err) { fail(err, 'Não foi possível reordenar.'); }
  }, [plannedTasks, today, updateTask]);

  const markWaiting = async (task: Task, input: WaitingInput, again: boolean) => {
    const previous: Partial<Task> = {
      status: task.status, waitingOnPersonId: task.waitingOnPersonId ?? null,
      waitingOnText: task.waitingOnText ?? null, followUpDate: task.followUpDate ?? null,
    };
    try {
      await updateTask(task.id, waitingUpdates(input));
      toast.success(`"${task.name}": ${again ? 'cobrar de novo' : 'aguardando'} em ${formatShortDate(input.followUpDate, today)}`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, previous); } },
      });
    } catch (err) { fail(err, 'Não foi possível marcar como Aguardando.'); }
  };

  /** Voltou: sai de Aguardando (o banco limpa de quem e a data de cobrança) */
  const backFromWaiting = async (task: Task) => {
    const previous: Partial<Task> = {
      status: task.status, waitingOnPersonId: task.waitingOnPersonId ?? null,
      waitingOnText: task.waitingOnText ?? null, followUpDate: task.followUpDate ?? null,
    };
    try {
      await updateTask(task.id, { status: 'pending' });
      toast.success(`"${task.name}" voltou para Pendente`, {
        action: { label: 'Desfazer', onClick: () => { void updateTask(task.id, previous); } },
      });
    } catch (err) { fail(err, 'Não foi possível mudar o status.'); }
  };

  const openWaiting = (task: Task) => setWaitingFor({ task, mode: task.status === 'waiting' ? 'again' : 'set' });

  const clearPlan = (item: TodayItem) => {
    if (!item.canClearPlan) { toast.info('O prazo já passou; mude o prazo.'); return; }
    void plan(item.task, null);
  };

  const pullToToday = (task: Task) => void plan(task, today, 'Planejada para hoje');

  // ---------- Arrastar (nativo) ----------
  const onDragStart = (task: Task) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setDragId(task.id);
  };
  const onDragEnd = () => { setDragId(null); setDrop(null); };

  const plannedRowDragOver = (index: number) => (e: DragEvent<HTMLLIElement>) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const next = index + (after ? 1 : 0);
    if (drop?.index !== next) setDrop({ index: next });
  };

  const dropOnPlanned = (e: DragEvent) => {
    e.preventDefault();
    // A linha e a seção escutam o drop: trata uma vez só
    e.stopPropagation();
    const id = dragId ?? e.dataTransfer.getData('text/plain');
    const task = allTasks.find(t => t.id === id);
    const visualIndex = drop?.index ?? plannedTasks.length;
    setDragId(null);
    setDrop(null);
    if (!task || !isTaskOpen(task)) return;
    // Índice na lista sem a tarefa arrastada
    const from = plannedTasks.findIndex(t => t.id === task.id);
    const target = from !== -1 && from < visualIndex ? visualIndex - 1 : visualIndex;
    if (from !== -1 && from === target) return;
    void placeInPlanned(task, target);
  };

  const moveSelected = (delta: -1 | 1) => {
    if (!selected || selected.section !== 'planned') return;
    const from = plannedTasks.findIndex(t => t.id === selected.task.id);
    const target = from + delta;
    if (target < 0 || target >= plannedTasks.length) return;
    void placeInPlanned(selected.task, target);
  };

  // ---------- Teclado (ignorado em campos de texto e com diálogos abertos) ----------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || hasOpenOverlay() || isTypingTarget(e.target)) return;
      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        moveSelected(e.key === 'ArrowUp' ? -1 : 1);
        return;
      }
      if (!isPlainKey(e)) return;
      if (e.key === '?') { e.preventDefault(); setPicker('help'); return; }
      if (e.key === 'a') { e.preventDefault(); setPicker('add'); return; }
      if (!selected) return;
      const step = (delta: number) => {
        const next = flat[Math.min(flat.length - 1, Math.max(0, selectedIndex + delta))];
        if (next) setSelectedId(next.task.id);
      };
      const isWaiting = selected.section === 'waiting';
      // Datas do dia não valem para Aguardando (ela fica na seção de cobranças)
      if (isWaiting && ['t', 'd', 'h'].includes(e.key)) return;
      switch (e.key) {
        case 'ArrowDown': case 'j': e.preventDefault(); step(1); break;
        case 'ArrowUp': case 'k': e.preventDefault(); step(-1); break;
        case 'x': e.preventDefault(); void complete(selected.task); break;
        case 'Enter': e.preventDefault(); setFormTask(selected.task); break;
        case 'e': e.preventDefault(); setPicker('estimate'); break;
        case 'd': e.preventDefault(); setPicker('date'); break;
        case 't': e.preventDefault(); void plan(selected.task, tomorrow); break;
        case 'h': e.preventDefault(); if (selected.section !== 'planned') pullToToday(selected.task); break;
        case 'w': e.preventDefault(); openWaiting(selected.task); break;
        case 'v': e.preventDefault(); if (isWaiting) void backFromWaiting(selected.task); break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // ---------- Adicionar ao dia ----------
  const candidates = useMemo<AddToDayCandidate[]>(() => {
    const list: AddToDayCandidate[] = [];
    for (const task of allTasks) {
      if (!isTaskOpen(task) || task.plannedDate?.slice(0, 10) === today) continue;
      const project = projectsById.get(task.projectId);
      if (!project || !isRelevantForToday(task, project, ctx)) continue;
      list.push({ task, project, workspace: workspaces.find(w => w.id === project.workspaceId) });
    }
    return list;
  }, [allTasks, today, projectsById, ctx, workspaces]);

  // ---------- Fechar o dia ----------
  const closeDay = async (decisions: CloseDayDecision[]) => {
    setClosing(true);
    try {
      await Promise.all(decisions.map(d => updateTask(d.taskId, { plannedDate: d.plannedDate, todayOrder: null })));
      const postponed = decisions.filter(d => d.choice !== 'remove').length;
      const removed = decisions.length - postponed;
      const completed = sections.done.length;
      logAuditEvent({
        action: 'day_closed', entity_type: 'day', entity_name: today, level: 'info',
        details: `Dia ${today} fechado: ${completed} concluída(s), ${postponed} adiada(s), ${removed} tirada(s) do dia`,
        metadata: { date: today, completed, postponed, removed },
      });
      setPicker(null);
      toast.success(`Dia fechado: ${completed} concluída(s), ${postponed} adiada(s), ${removed} tirada(s) do dia`);
    } catch (err) {
      fail(err, 'Não foi possível fechar o dia. Algumas tarefas podem ter ficado como estavam.');
    } finally {
      setClosing(false);
    }
  };

  const estimateFirstMissing = () => {
    const first = sections.planned.find(i => !i.task.estimateMinutes);
    if (!first) return;
    setSelectedId(first.task.id);
    setPicker('estimate');
  };

  // ---------- Render ----------
  const openCount = flat.length;
  const subtitle = `${longDate(today)} · ${summary.count} para hoje · todos os workspaces`;

  if (loading && allTasks.length === 0) {
    return (
      <MainLayout>
        <Header title="Hoje" />
        <PageBody><Skeleton className="h-96 rounded-xl" /></PageBody>
      </MainLayout>
    );
  }

  const renderRows = (key: TodaySectionKey, items: TodayItem[]) => (
    <ul role="list" className="divide-y divide-border">
      {items.map((item, index) => (
        <TodayTaskRow
          key={item.task.id}
          item={item}
          project={projectsById.get(item.task.projectId)}
          workspace={workspaceOf(item.task.projectId)}
          today={today}
          selected={item.task.id === selected?.task.id}
          responsibleNames={responsibleNames(item.task)}
          draggable={key !== 'done' && key !== 'waiting'}
          dragging={dragId === item.task.id}
          dropIndicator={key === 'planned' && drop
            ? (drop.index === index ? 'before' : drop.index === items.length && index === items.length - 1 ? 'after' : null)
            : null}
          onSelect={() => setSelectedId(item.task.id)}
          onOpen={() => setFormTask(item.task)}
          onComplete={() => void complete(item.task)}
          onTomorrow={() => void plan(item.task, tomorrow)}
          onPickDate={() => { setSelectedId(item.task.id); setPicker('date'); }}
          onClearPlan={() => clearPlan(item)}
          onPullToToday={() => pullToToday(item.task)}
          onEstimate={(minutes) => void setEstimate(item.task, minutes)}
          waitingOn={key === 'waiting' ? waitingOnLabel(item.task, people) : null}
          onFollowUpAgain={() => openWaiting(item.task)}
          onBack={() => void backFromWaiting(item.task)}
          onDragStart={onDragStart(item.task)}
          onDragEnd={onDragEnd}
          onDragOver={key === 'planned' ? plannedRowDragOver(index) : undefined}
          onDrop={key === 'planned' ? dropOnPlanned : undefined}
        />
      ))}
    </ul>
  );

  return (
    <MainLayout>
      <Header
        title="Hoje"
        subtitle={subtitle}
        actions={
          <>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={scope}
              onValueChange={(value) => value && setScope(value as 'all' | 'mine')}
              aria-label="Quais tarefas mostrar"
            >
              <ToggleGroupItem value="all" className="h-8 px-2.5 text-xs" title="Todas as tarefas dos seus projetos">Todas</ToggleGroupItem>
              <ToggleGroupItem value="mine" className="h-8 px-2.5 text-xs" title="Nos seus projetos, só as sem responsável ou em que você é responsável">Só as minhas</ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" size="sm" onClick={() => setPicker('help')}>
              <Keyboard className="w-4 h-4 mr-1.5" /> Atalhos <kbd className="ml-1.5 text-[10px] opacity-70">?</kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPicker('add')}>
              <Plus className="w-4 h-4 mr-1.5" /> Adicionar ao dia <kbd className="ml-1.5 text-[10px] opacity-70">a</kbd>
            </Button>
            <Button size="sm" onClick={() => setPicker('close')}>
              <MoonStar className="w-4 h-4 mr-1.5" /> Fechar o dia
            </Button>
          </>
        }
      />
      <PageBody>
        <CapacityBar
          plannedMinutes={summary.plannedMinutes}
          capacityMinutes={capacity}
          missingEstimate={summary.missingEstimate}
          onEstimateMissing={estimateFirstMissing}
        />

        <div ref={listRef} className="space-y-4">
          {openCount === 0 && (
            <Panel>
              <EmptyState
                icon={Sun}
                title="Nada para hoje"
                description="Puxe tarefas de qualquer projeto com &quot;Adicionar ao dia&quot; (a) ou capture com Q."
              />
            </Panel>
          )}

          {SECTIONS.map(section => {
            const items = sections[section.key];
            const isPlanned = section.key === 'planned';
            // Seções vazias somem, menos "Planejadas" (é onde se solta o arraste) quando há algo na página
            if (items.length === 0 && !(isPlanned && openCount > 0)) return null;
            const minutes = items.reduce((sum, i) => sum + (i.task.estimateMinutes ?? 0), 0);
            return (
              <Panel
                key={section.key}
                icon={section.icon}
                iconClassName={section.iconClassName}
                title={<>{section.title} <span className="font-normal text-muted-foreground tabular-nums">({items.length})</span></>}
                actions={minutes > 0 ? <span className="text-xs text-muted-foreground tabular-nums">{formatMinutes(minutes)}</span> : undefined}
                data-section={section.key}
                onDragOver={isPlanned ? (e) => { if (dragId) e.preventDefault(); } : undefined}
                onDrop={isPlanned ? dropOnPlanned : undefined}
                className={cn(isPlanned && dragId && 'ring-2 ring-primary/30')}
              >
                {items.length === 0 ? (
                  <p
                    className="px-5 py-6 text-center text-sm text-muted-foreground"
                    onDragOver={(e) => { if (dragId) { e.preventDefault(); if (drop?.index !== 0) setDrop({ index: 0 }); } }}
                  >
                    {section.empty}
                  </p>
                ) : renderRows(section.key, items)}
              </Panel>
            );
          })}

          {sections.done.length > 0 && (
            <Panel
              icon={CheckCircle2}
              iconClassName="text-emerald-500"
              title={
                <button type="button" onClick={() => setShowDone(v => !v)} className="flex items-center gap-1" aria-expanded={showDone}>
                  {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Concluídas hoje <span className="font-normal text-muted-foreground tabular-nums">({sections.done.length})</span>
                </button>
              }
            >
              {showDone && renderRows('done', sections.done)}
            </Panel>
          )}
        </div>
      </PageBody>

      <DateTextDialog
        open={picker === 'date'}
        field="planned"
        today={today}
        taskName={selected?.task.name}
        onOpenChange={(o) => !o && setPicker(null)}
        onSubmit={(iso) => { setPicker(null); if (selected) void plan(selected.task, iso); }}
      />
      <EstimateDialog
        open={picker === 'estimate'}
        taskName={selected?.task.name}
        current={selected?.task.estimateMinutes}
        onOpenChange={(o) => !o && setPicker(null)}
        onSubmit={(minutes) => { setPicker(null); if (selected) void setEstimate(selected.task, minutes); }}
      />
      <WaitingDialog
        open={!!waitingFor}
        today={today}
        subject={waitingFor?.task.name}
        people={waitingFor ? waitingPeopleFor(waitingFor.task) : []}
        initial={waitingFor?.mode === 'again'
          ? {
              waitingOnPersonId: waitingFor.task.waitingOnPersonId ?? null,
              waitingOnText: waitingFor.task.waitingOnText ?? null,
              followUpDate: defaultFollowUpDate(today),
            }
          : undefined}
        confirmLabel={waitingFor?.mode === 'again' ? 'Cobrar de novo' : undefined}
        onOpenChange={(o) => !o && setWaitingFor(null)}
        onSubmit={(input) => {
          const target = waitingFor;
          setWaitingFor(null);
          if (target) void markWaiting(target.task, input, target.mode === 'again');
        }}
      />
      <AddToDayDialog
        open={picker === 'add'}
        today={today}
        candidates={candidates}
        onOpenChange={(o) => !o && setPicker(null)}
        onAdd={(task) => pullToToday(task)}
      />
      <CloseDayDialog
        open={picker === 'close'}
        today={today}
        done={sections.done}
        pending={[...sections.planned, ...sections.overdue]}
        saving={closing}
        onOpenChange={(o) => !o && !closing && setPicker(null)}
        onConfirm={(decisions) => void closeDay(decisions)}
      />

      <Dialog open={picker === 'help'} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Atalhos do dia</DialogTitle>
            <DialogDescription className="text-xs">Funcionam fora de campos de texto. Arraste para reordenar ou para trazer tarefas para "Planejadas para hoje".</DialogDescription>
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

export default Today;
