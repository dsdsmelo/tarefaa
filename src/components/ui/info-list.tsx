import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Linhas "rótulo à esquerda, valor à direita" para dados cadastrais
export const InfoList = ({ children, className }: { children: ReactNode; className?: string }) => (
  <dl className={cn('divide-y divide-border/60', className)}>{children}</dl>
);

interface InfoRowProps {
  label: ReactNode;
  value?: ReactNode;
  // Fonte monoespaçada para códigos, datas e números
  mono?: boolean;
}

export const InfoRow = ({ label, value, mono }: InfoRowProps) => (
  <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className={cn('min-w-0 truncate text-right font-medium', mono && 'font-mono')}>
      {value === undefined || value === null || value === '' ? '---' : value}
    </dd>
  </div>
);
