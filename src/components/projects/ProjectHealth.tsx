import { AlertTriangle, ArrowRightCircle, Flag, Hand, PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HealthColor } from '@/lib/types';
import { HEALTH_LABELS, healthTooltip, type ProjectHealth } from '@/lib/projectHealth';
import { formatShortDate } from '@/lib/quickCapture/format';

const DOT: Record<HealthColor, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

/** Bolinha + rótulo; "manual" e "revise o status manual" quando é ajuste */
export function HealthBadge({ health, className }: { health: ProjectHealth; className?: string }) {
  if (!health.color) return null;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)}
      title={healthTooltip(health)}
      aria-label={`Saúde: ${HEALTH_LABELS[health.color]}${health.manual ? ' (manual)' : ''}`}
      data-health={health.color}
    >
      <span className={cn('h-2.5 w-2.5 rounded-full', DOT[health.color])} aria-hidden />
      {HEALTH_LABELS[health.color]}
      {health.manual && (
        <span className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 text-[10px] font-normal text-muted-foreground">
          <Hand className="h-2.5 w-2.5" />
          manual{health.manualDays !== null ? ` há ${health.manualDays} ${health.manualDays === 1 ? 'dia' : 'dias'}` : ''}
        </span>
      )}
    </span>
  );
}

/** Linhas extras do card: aviso do manual, próxima ação, próximo marco, parado */
export function HealthDetails({ health, today }: { health: ProjectHealth; today: string }) {
  const lines: { key: string; icon: typeof Flag; text: string; tone?: string; title?: string }[] = [];
  if (health.reviewManual && health.calculated) {
    lines.push({ key: 'review', icon: AlertTriangle, text: 'Revise o status manual', tone: 'text-amber-600 dark:text-amber-400', title: `Calculado agora: ${HEALTH_LABELS[health.calculated]}${health.reasons.length ? ` (${health.reasons.join('; ')})` : ''}` });
  }
  if (health.nextAction) {
    lines.push({ key: 'next', icon: ArrowRightCircle, text: `Próxima ação: ${health.nextAction.name}` });
  } else if (health.nextActionDone) {
    lines.push({ key: 'next', icon: ArrowRightCircle, text: 'Defina a próxima ação', tone: 'text-muted-foreground' });
  }
  if (health.nextMilestone) {
    const late = health.nextMilestone.date < today;
    lines.push({ key: 'ms', icon: Flag, text: `Próximo marco: ${health.nextMilestone.name} · ${formatShortDate(health.nextMilestone.date, today)}${late ? ' (vencido)' : ''}`, tone: late ? 'text-red-600 dark:text-red-400' : undefined });
  }
  if (health.staleDays !== null) {
    lines.push({ key: 'stale', icon: PauseCircle, text: `Parado há ${health.staleDays} dias`, tone: 'text-amber-600 dark:text-amber-400' });
  }
  if (lines.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {lines.map(({ key, icon: Icon, text, tone, title }) => (
        <li key={key} className={cn('flex min-w-0 items-center gap-1.5 text-xs', tone ?? 'text-muted-foreground')} title={title ?? text}>
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{text}</span>
        </li>
      ))}
    </ul>
  );
}
