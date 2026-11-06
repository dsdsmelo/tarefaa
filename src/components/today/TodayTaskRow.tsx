import type { DragEvent } from 'react';
import { ArrowRight, BellRing, CalendarCheck, CalendarMinus, CalendarPlus, Check, CornerDownLeft, GripVertical, Hourglass, SquarePen, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { priorityLabels, type Project, type Workspace } from '@/lib/types';
import type { TodayItem } from '@/lib/today';
import { formatShortDate } from '@/lib/quickCapture/format';
import { daysUntil } from '@/lib/taskDates';
import { EstimateEditCell } from '@/components/tasks/InlineTaskFieldEdit';

const PRIORITY_DOT = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
} as const;

export const CLEAR_PLAN_DISABLED_REASON = 'o prazo já passou; mude o prazo';

interface TodayTaskRowProps {
  item: TodayItem;
  project?: Project;
  workspace?: Workspace;
  today: string;
  selected: boolean;
  responsibleNames: string[];
  /** Arrastável (todas menos as concluídas) */
  draggable: boolean;
  dragging: boolean;
  /** Linha de inserção acima/abaixo (arrastando para "Planejadas para hoje") */
  dropIndicator: 'before' | 'after' | null;
  onSelect: () => void;
  onOpen: () => void;
  onComplete: () => void;
  onTomorrow: () => void;
  onPickDate: () => void;
  onClearPlan: () => void;
  onPullToToday: () => void;
  onEstimate: (minutes: number | null) => void;
  /** Aguardando: de quem se espera (já resolvido para texto) */
  waitingOn?: string | null;
  /** Aguardando: cobrar de novo (nova data) */
  onFollowUpAgain?: () => void;
  /** Aguardando: voltou (retorna para Pendente) */
  onBack?: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver?: (e: DragEvent<HTMLLIElement>) => void;
  onDrop?: (e: DragEvent<HTMLLIElement>) => void;
}

export function TodayTaskRow(props: TodayTaskRowProps) {
  const { item, project, workspace, today, selected, responsibleNames } = props;
  const { task, section, dueOverdue, canClearPlan } = item;
  const done = section === 'done';
  const waiting = section === 'waiting';
  const plannedPast = !!task.plannedDate && task.plannedDate.slice(0, 10) < today;
  const followUpLate = waiting ? -(daysUntil(task.followUpDate) ?? 0) : 0;

  return (
    <li
      data-task-id={task.id}
      draggable={props.draggable}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onClick={props.onSelect}
      onDoubleClick={props.onOpen}
      className={cn(
        'group relative flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 transition-colors',
        selected ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/40',
        props.dragging && 'opacity-40',
        props.draggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      {props.dropIndicator && (
        <span className={cn('pointer-events-none absolute inset-x-3 h-0.5 rounded bg-primary', props.dropIndicator === 'before' ? 'top-0' : 'bottom-0')} />
      )}
      {props.draggable && <GripVertical className="-ml-3 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" aria-hidden />}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `${task.name}: concluída` : `Concluir ${task.name}`}
        disabled={done}
        onClick={(e) => { e.stopPropagation(); props.onComplete(); }}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/50 hover:border-primary hover:bg-primary/10'
        )}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority])} title={priorityLabels[task.priority]} />

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', done && 'text-muted-foreground line-through')}>{task.name}</p>
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: workspace?.color ?? '#94a3b8' }} aria-hidden />
          <span className="truncate">
            {workspace?.name ?? 'Workspace'} · {project?.isInbox ? 'Caixa de entrada' : project?.name ?? 'Projeto'}
            {responsibleNames.length > 0 && <> · {responsibleNames.join(', ')}</>}
          </span>
        </p>
      </div>

      {/* Selos de data */}
      <span className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
        {waiting && (
          <span className="rounded-full bg-status-waiting/10 px-2 py-0.5 font-medium text-status-waiting">
            <Hourglass className="mr-0.5 inline h-3 w-3" />
            {props.waitingOn ? `Aguardando ${props.waitingOn}` : 'Aguardando'}
            {' · '}{followUpLate > 0 ? `cobrança atrasada há ${followUpLate} ${followUpLate === 1 ? 'dia' : 'dias'}` : 'cobrar hoje'}
          </span>
        )}
        {dueOverdue && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-600 dark:text-red-400" title={`Prazo: ${formatShortDate(task.endDate!, today)}`}>
            prazo vencido · {formatShortDate(task.endDate!, today)}
          </span>
        )}
        {!dueOverdue && task.endDate && section !== 'done' && (
          <span className={cn('tabular-nums', section === 'dueToday' ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
            Prazo {formatShortDate(task.endDate, today)}
          </span>
        )}
        {section === 'overdue' && plannedPast && (
          <span className="text-muted-foreground" title="Data planejada que já passou">
            <CalendarCheck className="mr-0.5 inline h-3 w-3" />{formatShortDate(task.plannedDate!, today)}
          </span>
        )}
        {section === 'dueToday' && task.plannedDate && (
          <span className="text-muted-foreground" title="Planejado para">
            <CalendarCheck className="mr-0.5 inline h-3 w-3" />{formatShortDate(task.plannedDate, today)}
          </span>
        )}
      </span>

      {!done && (
        <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <EstimateEditCell value={task.estimateMinutes} placeholder="Estimar" label={task.name} onSave={props.onEstimate} />
        </span>
      )}

      {waiting && (
        <span className={cn('flex shrink-0 items-center gap-0.5', selected ? 'flex' : 'hidden group-hover:flex group-focus-within:flex')}>
          <RowAction title="Cobrar de novo (w)" icon={BellRing} onClick={() => props.onFollowUpAgain?.()} />
          <RowAction title="Voltou (v)" icon={CornerDownLeft} onClick={() => props.onBack?.()} />
          <RowAction title="Abrir (Enter)" icon={SquarePen} onClick={props.onOpen} />
        </span>
      )}

      {!done && !waiting && (
        <span className={cn('flex shrink-0 items-center gap-0.5', selected ? 'flex' : 'hidden group-hover:flex group-focus-within:flex')}>
          {section !== 'planned' && <RowAction title="Fazer hoje (h)" icon={Sun} onClick={props.onPullToToday} />}
          <RowAction title="Amanhã (t)" icon={ArrowRight} onClick={props.onTomorrow} />
          <RowAction title="Escolher data (d)" icon={CalendarPlus} onClick={props.onPickDate} />
          <RowAction title="Aguardando (w)" icon={Hourglass} onClick={() => props.onFollowUpAgain?.()} />
          {(section === 'planned' || section === 'overdue') && (
            <RowAction
              title={canClearPlan ? 'Tirar do dia' : `Tirar do dia: ${CLEAR_PLAN_DISABLED_REASON}`}
              icon={CalendarMinus}
              onClick={props.onClearPlan}
              disabled={!canClearPlan}
            />
          )}
          <RowAction title="Abrir (Enter)" icon={SquarePen} onClick={props.onOpen} />
        </span>
      )}
    </li>
  );
}

function RowAction({ title, icon: Icon, onClick, disabled }: { title: string; icon: typeof Check; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
