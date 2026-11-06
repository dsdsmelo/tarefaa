import { Link } from 'react-router-dom';
import { AlertTriangle, Gauge, Hourglass, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/estimate';
import { capacityLevel } from '@/lib/planning';

interface CapacityBarProps {
  plannedMinutes: number;
  capacityMinutes: number;
  missingEstimate: number;
  onEstimateMissing: () => void;
}

const BAR: Record<string, string> = {
  ok: 'bg-foreground/50',
  warning: 'bg-amber-500',
  over: 'bg-red-500',
  none: 'bg-muted-foreground/40',
};

/** Soma das estimativas de "Planejadas para hoje" contra a capacidade do dia da semana */
export function CapacityBar({ plannedMinutes, capacityMinutes, missingEstimate, onEstimateMissing }: CapacityBarProps) {
  const level = capacityLevel(plannedMinutes, capacityMinutes);
  const ratio = capacityMinutes > 0 ? plannedMinutes / capacityMinutes : 0;
  const width = `${Math.min(1, ratio) * 100}%`;

  return (
    <section
      aria-label="Capacidade do dia"
      data-level={level}
      className={cn(
        'rounded-xl border bg-card px-5 py-4 space-y-2.5',
        level === 'over' ? 'border-red-500/40' : level === 'warning' ? 'border-amber-500/40' : 'border-border'
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4 text-primary" />
          {level === 'none' ? (
            <span>{formatMinutes(plannedMinutes)} planejadas</span>
          ) : (
            <span className="tabular-nums">{formatMinutes(plannedMinutes)} de {formatMinutes(capacityMinutes)}</span>
          )}
        </span>
        {missingEstimate > 0 && (
          <button
            type="button"
            onClick={onEstimateMissing}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Estimar a primeira sem estimativa (e)"
          >
            <Hourglass className="h-3.5 w-3.5" />
            {missingEstimate} sem estimativa · <span className="underline underline-offset-2">estimar</span>
          </button>
        )}
        <Link
          to="/settings?tab=planning"
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" /> Capacidade
        </Link>
      </div>

      {level !== 'none' && (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={capacityMinutes}
          aria-valuenow={plannedMinutes}
          aria-label="Planejado em relação à capacidade"
        >
          <div className={cn('h-full rounded-full transition-all', BAR[level])} style={{ width }} />
        </div>
      )}

      {level === 'over' && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Você planejou mais do que cabe no dia
          <span className="font-normal text-muted-foreground">({formatMinutes(plannedMinutes - capacityMinutes)} a mais)</span>
        </p>
      )}
      {level === 'none' && (
        <p className="text-xs text-muted-foreground">
          Dia sem capacidade configurada.{' '}
          <Link to="/settings?tab=planning" className="font-medium text-primary underline underline-offset-2">Configurar a capacidade</Link>
        </p>
      )}
    </section>
  );
}
