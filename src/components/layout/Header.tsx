import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: ReactNode;
  // Rota para a seta de voltar (ex.: '/projects')
  backTo?: string;
  // Ícone ou avatar à esquerda do título
  leading?: ReactNode;
  // Selo de status, exibido à direita
  badge?: ReactNode;
  // Botões de ação da página, à direita
  actions?: ReactNode;
}

export const Header = ({ title, subtitle, backTo, leading, badge, actions }: HeaderProps) => {
  return (
    <header className="flex flex-wrap items-start gap-x-3 gap-y-3 px-6 pt-6 pb-2">
      {/* No celular a sidebar vira gaveta: este botão é a única forma de abri-la */}
      <SidebarTrigger className="md:hidden -ml-1 mt-0.5 shrink-0" />
      {backTo && (
        <Link
          to={backTo}
          className="-ml-1 mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
      )}
      {leading && <div className="shrink-0">{leading}</div>}
      <div className={cn('min-w-0 flex-1', leading && 'self-center')}>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
        {subtitle && <div className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</div>}
      </div>
      {(badge || actions) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {badge}
          {actions}
        </div>
      )}
    </header>
  );
};
