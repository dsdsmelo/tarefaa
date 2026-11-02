import { SidebarTrigger } from '@/components/ui/sidebar';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header = ({ title, subtitle }: HeaderProps) => {
  return (
    <header className="flex items-start gap-3 px-6 pt-6 pb-2">
      {/* No celular a sidebar vira gaveta: este botão é a única forma de abri-la */}
      <SidebarTrigger className="md:hidden -ml-1 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
    </header>
  );
};
