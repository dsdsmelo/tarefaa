import { Fragment } from 'react';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface ActionItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

// Menu "⋮" padrão de cada item (card ou linha): sempre visível, ações destrutivas
// por último e separadas. O clique não propaga para o card/linha.
export const ActionsMenu = ({ items, className }: { items: ActionItem[]; className?: string }) => (
  <div className={cn('shrink-0', className)} onClick={(e) => e.stopPropagation()}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Ações" aria-label="Ações">
          <MoreVertical className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {item.destructive && index > 0 && !items[index - 1].destructive && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={item.disabled}
              onClick={item.onClick}
              className={cn(item.destructive && 'text-destructive focus:text-destructive')}
            >
              <item.icon className="w-4 h-4 mr-2" />
              {item.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
