import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  // Cor do ícone (padrão: primary); use para sinal semântico, ex. 'text-red-500'
  iconClassName?: string;
  // Botões/links à direita do título
  actions?: React.ReactNode;
  // Classes do corpo (ex.: 'p-5'); listas usam o corpo sem padding
  bodyClassName?: string;
}

// Card padrão com título: superfície branca, borda fina, cabeçalho com divisória.
// O corpo estica até a altura do card, para cards lado a lado ficarem alinhados.
export const Panel = React.forwardRef<HTMLElement, PanelProps>(
  ({ title, description, icon: Icon, iconClassName, actions, bodyClassName, className, children, ...props }, ref) => (
    <section ref={ref} className={cn('flex flex-col rounded-xl border border-border bg-card', className)} {...props}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon className={cn('h-4 w-4 shrink-0 text-primary', iconClassName)} />}
            <div className="min-w-0">
              {title && <h3 className="truncate font-semibold">{title}</h3>}
              {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  ),
);
Panel.displayName = 'Panel';
