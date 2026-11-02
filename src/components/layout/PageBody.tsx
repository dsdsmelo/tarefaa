import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Área de conteúdo padrão abaixo do <Header />
export const PageBody = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('px-6 pb-6 pt-3 space-y-4', className)}>{children}</div>
);
