import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useData } from '@/contexts/DataContext';
import { CustomColumn } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CustomColumnValueProps {
  column: CustomColumn;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  readOnly?: boolean;
}

export const CustomColumnValue = ({ column, value, onChange, readOnly = false }: CustomColumnValueProps) => {
  const { people } = useData();
  const activePeople = people.filter(p => p.active);

  if (readOnly) {
    return <CustomColumnDisplay column={column} value={value} />;
  }

  switch (column.type) {
    case 'text':
      return (
        <Input
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={value as number || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-sm w-24"
        />
      );

    case 'date':
      return (
        <Input
          type="date"
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm"
        />
      );

    case 'list':
      return (
        <Select value={value as string || ''} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            {column.options?.map(option => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'percentage':
      return (
        <Input
          type="number"
          min={0}
          max={100}
          value={value as number || ''}
          onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value))))}
          className="h-8 text-sm w-20"
        />
      );

    case 'user':
      return (
        <Select value={value as string || ''} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            {activePeople.map(person => (
              <SelectItem key={person.id} value={person.id}>
                <div className="flex items-center gap-2">
                  <AvatarCircle name={person.name} color={person.color} size="xs" avatarUrl={person.avatarUrl} />
                  {person.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    default:
      return <span className="text-muted-foreground">-</span>;
  }
};

interface CustomColumnDisplayProps {
  column: CustomColumn;
  value: string | number | undefined;
}

export const CustomColumnDisplay = ({ column, value }: CustomColumnDisplayProps) => {
  const { people } = useData();

  if (value === undefined || value === '') {
    return <span className="text-muted-foreground">-</span>;
  }

  switch (column.type) {
    case 'text':
      return (
        <span className={cn(
          "text-sm",
          column.wrapText && "whitespace-pre-wrap break-words"
        )}>
          {value as string}
        </span>
      );

    case 'number':
      return <span className="text-sm font-mono">{value}</span>;

    case 'date':
      return (
        <span className="text-sm tabular-nums">
          {new Date(value as string).toLocaleDateString('pt-BR')}
        </span>
      );

    case 'list':
      return <span className="text-sm">{value as string}</span>;

    case 'percentage':
      return <ProgressBar value={value as number} showLabel size="sm" />;

    case 'user':
      const person = people.find(p => p.id === value);
      if (!person) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex items-center gap-2">
          <AvatarCircle name={person.name} color={person.color} size="sm" avatarUrl={person.avatarUrl} />
          <span className="text-sm">{person.name}</span>
        </div>
      );

    default:
      return <span className="text-muted-foreground">-</span>;
  }
};
