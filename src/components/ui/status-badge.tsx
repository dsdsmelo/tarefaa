import { cn } from '@/lib/utils';
import { TaskStatus, TaskPriority, statusLabels, priorityLabels } from '@/lib/types';

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const statusStyles: Record<TaskStatus, string> = {
  pending: 'bg-status-pending/10 text-status-pending border-status-pending/20',
  in_progress: 'bg-status-progress/10 text-status-progress border-status-progress/20',
  waiting: 'bg-status-waiting/10 text-status-waiting border-status-waiting/20',
  blocked: 'bg-status-blocked/10 text-status-blocked border-status-blocked/20',
  completed: 'bg-status-completed/10 text-status-completed border-status-completed/20',
  cancelled: 'bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20',
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium border',
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

const priorityStyles: Record<TaskPriority, string> = {
  low: 'bg-priority-low/10 text-priority-low border-priority-low/20',
  medium: 'bg-priority-medium/10 text-priority-medium border-priority-medium/20',
  high: 'bg-priority-high/10 text-priority-high border-priority-high/20',
  urgent: 'bg-priority-urgent/10 text-priority-urgent border-priority-urgent/20',
};

export const PriorityBadge = ({ priority, className }: PriorityBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium border',
        priorityStyles[priority],
        className
      )}
    >
      {priorityLabels[priority]}
    </span>
  );
};
