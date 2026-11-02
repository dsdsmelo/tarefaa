import { useState, useRef, useEffect } from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Slider } from '@/components/ui/slider';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface InlineEditCellProps {
  column: CustomColumn;
  value: string | number | undefined;
  onSave: (value: string | number) => void;
}

export const InlineEditCell = ({ column, value, onSave }: InlineEditCellProps) => {
  const { people } = useData();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string | number>(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const activePeople = people.filter(p => p.active);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditValue(value ?? '');
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value ?? '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // For percentage, use popover with slider
  if (column.type === 'percentage') {
    return (
      <PercentageEditCell 
        value={value as number | undefined} 
        onSave={onSave} 
      />
    );
  }

  // Display mode for other types
  if (!isEditing) {
    return (
      <div
        className="group flex items-start gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors min-h-[24px]"
        onClick={handleStartEdit}
      >
        <DisplayValue column={column} value={value} people={people} />
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
      </div>
    );
  }

  // Edit mode
  return (
    <div className={cn("flex gap-1", column.type === 'text' ? "items-start" : "items-center")}>
      {column.type === 'text' && (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue as string}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel();
            // Enter com Shift quebra linha, Enter sozinho salva
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
          }}
          onBlur={handleSave}
          className="text-xs min-w-[120px] min-h-[60px] max-h-[150px] px-2 py-1.5 rounded-md border border-input bg-card resize-y placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Digite aqui... (Shift+Enter para nova linha)"
        />
      )}

      {column.type === 'number' && (
        <Input
          ref={inputRef}
          type="number"
          value={editValue as number}
          onChange={(e) => setEditValue(Number(e.target.value))}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 px-2 text-xs w-16"
        />
      )}

      {column.type === 'date' && (
        <Input
          ref={inputRef}
          type="date"
          value={editValue as string}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 px-2 text-xs"
        />
      )}

      {/* Percentage is handled separately with PercentageEditCell */}

      {column.type === 'list' && (
        <Select
          value={editValue as string}
          onValueChange={(v) => {
            setEditValue(v);
            onSave(v);
            setIsEditing(false);
          }}
        >
          <SelectTrigger className="h-7 px-2 text-xs min-w-[80px]">
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
      )}

      {column.type === 'user' && (
        <Select
          value={editValue as string}
          onValueChange={(v) => {
            setEditValue(v);
            onSave(v);
            setIsEditing(false);
          }}
        >
          <SelectTrigger className="h-7 px-2 text-xs min-w-[100px]">
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
      )}

      {(column.type === 'text' || column.type === 'number' || column.type === 'date') && (
        <div className={cn("flex gap-0.5", column.type === 'text' && "flex-col")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:text-emerald-300"
            onClick={handleSave}
          >
            <Check className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleCancel}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

// Percentage Edit Cell with Popover and Slider
interface PercentageEditCellProps {
  value: number | undefined;
  onSave: (value: number) => void;
}

const PercentageEditCell = ({ value, onSave }: PercentageEditCellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? 0);

  useEffect(() => {
    setLocalValue(value ?? 0);
  }, [value]);

  const handleSave = () => {
    onSave(localValue);
    setIsOpen(false);
  };

  const quickValues = [0, 25, 50, 75, 100];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors min-h-[24px]">
          <ProgressBar value={value ?? 0} showLabel size="sm" className="min-w-[70px]" />
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Porcentagem</span>
            <span className="text-sm font-semibold tabular-nums text-primary">{localValue}%</span>
          </div>
          
          <Slider
            value={[localValue]}
            onValueChange={([v]) => setLocalValue(v)}
            max={100}
            step={1}
            className="w-full"
          />

          <div className="flex gap-1 flex-wrap">
            {quickValues.map((qv) => (
              <Button
                key={qv}
                variant={localValue === qv ? "default" : "outline"}
                size="sm"
                className="h-7 flex-1 min-w-[40px] px-0 tabular-nums"
                onClick={() => setLocalValue(qv)}
              >
                {qv}%
              </Button>
            ))}
          </div>

          <div className="flex gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface DisplayValueProps {
  column: CustomColumn;
  value: string | number | undefined;
  people: { id: string; name: string; color: string; avatarUrl?: string }[];
}

const DisplayValue = ({ column, value, people }: DisplayValueProps) => {
  if (value === undefined || value === '') {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  switch (column.type) {
    case 'text':
      // Quebra de linha apenas quando wrapText está habilitado
      return (
        <span className={cn(
          "text-xs",
          column.wrapText ? "whitespace-pre-wrap break-words" : "truncate block max-w-[200px]"
        )}>
          {value as string}
        </span>
      );

    case 'number':
      return <span className="text-xs font-mono">{value}</span>;

    case 'date':
      return (
        <span className="text-xs tabular-nums">
          {new Date(value as string).toLocaleDateString('pt-BR')}
        </span>
      );

    case 'list':
      return <span className="text-xs">{value as string}</span>;

    case 'percentage':
      return <ProgressBar value={value as number} showLabel size="sm" className="min-w-[80px]" />;

    case 'user':
      const person = people.find(p => p.id === value);
      if (!person) return <span className="text-muted-foreground text-xs">-</span>;
      return (
        <div className="flex items-center gap-1.5">
          <AvatarCircle name={person.name} color={person.color} size="xs" avatarUrl={person.avatarUrl} />
          <span className="text-xs">{person.name}</span>
        </div>
      );

    default:
      return <span className="text-muted-foreground text-xs">-</span>;
  }
};
