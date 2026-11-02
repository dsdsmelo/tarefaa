import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('flex h-full flex-col items-center justify-center px-6 py-12 text-center', className)}>
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
    <p className="font-medium">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
