import { useState } from 'react';
import { Pencil, Check, X, CalendarIcon, Hourglass } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatMinutes, parseEstimate } from '@/lib/estimate';
import { Task, TaskStatus, TaskPriority, Person, Phase, TASK_STATUS_ORDER } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

// Status Edit
interface StatusEditCellProps {
  status: TaskStatus;
  onSave: (status: TaskStatus) => void;
  /** Escolher "Aguardando" pede de quem e a data de cobrança (diálogo do chamador) */
  onWaiting?: () => void;
}

export const StatusEditCell = ({ status, onSave, onWaiting }: StatusEditCellProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (value: TaskStatus) => {
    setIsOpen(false);
    if (value === status) return;
    if (value === 'waiting' && onWaiting) { onWaiting(); return; }
    onSave(value);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors">
          <StatusBadge status={status} />
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        <div className="space-y-0.5">
          {TASK_STATUS_ORDER.map((s) => (
            <button
              key={s}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors",
                status === s && "bg-muted"
              )}
              onClick={() => handleSelect(s)}
            >
              <StatusBadge status={s} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Priority Edit
interface PriorityEditCellProps {
  priority: TaskPriority;
  onSave: (priority: TaskPriority) => void;
}

export const PriorityEditCell = ({ priority, onSave }: PriorityEditCellProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (value: TaskPriority) => {
    onSave(value);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors">
          <PriorityBadge priority={priority} />
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        <div className="space-y-0.5">
          {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => (
            <button
              key={p}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors",
                priority === p && "bg-muted"
              )}
              onClick={() => handleSelect(p)}
            >
              <PriorityBadge priority={p} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Responsible Edit (Multi-select)
interface ResponsibleEditCellProps {
  responsibleIds?: string[];
  people: Person[];
  projectMemberIds?: string[]; // Se definido, filtra apenas membros do projeto
  onSave: (responsibleIds: string[] | undefined) => void;
}

export const ResponsibleEditCell = ({ responsibleIds = [], people, projectMemberIds, onSave }: ResponsibleEditCellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedPeople = people.filter(p => responsibleIds.includes(p.id));
  // Se há membros definidos no projeto, filtra apenas eles. Senão, mostra todos os ativos.
  const activePeople = people.filter(p => {
    if (!p.active) return false;
    if (projectMemberIds && projectMemberIds.length > 0) {
      return projectMemberIds.includes(p.id);
    }
    return true;
  });

  const handleToggle = (personId: string) => {
    const newIds = responsibleIds.includes(personId)
      ? responsibleIds.filter(id => id !== personId)
      : [...responsibleIds, personId];
    onSave(newIds.length > 0 ? newIds : undefined);
  };

  const handleClearAll = () => {
    onSave(undefined);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors min-h-[22px]">
          {selectedPeople.length > 0 ? (
            <div className="flex items-center gap-1">
              {/* Mostra até 3 avatares sobrepostos */}
              <div className="flex -space-x-1.5">
                {selectedPeople.slice(0, 3).map((person) => (
                  <AvatarCircle
                    key={person.id}
                    name={person.name}
                    color={person.color}
                    size="xs"
                    avatarUrl={person.avatarUrl}
                    className="ring-1 ring-background"
                  />
                ))}
              </div>
              {/* Se houver mais de 3, mostra +N */}
              {selectedPeople.length > 3 && (
                <span className="text-xs text-muted-foreground ml-1">
                  +{selectedPeople.length - 3}
                </span>
              )}
              {/* Se for só 1 ou 2, mostra o nome */}
              {selectedPeople.length <= 2 && (
                <span className="text-xs truncate max-w-[120px] ml-1">
                  {selectedPeople.map(p => p.name).join(', ')}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="space-y-0.5 max-h-64 overflow-y-auto">
          {selectedPeople.length > 0 && (
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors text-muted-foreground"
              onClick={handleClearAll}
            >
              <X className="w-3 h-3" />
              Limpar seleção
            </button>
          )}
          {activePeople.map((p) => (
            <label
              key={p.id}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors cursor-pointer",
                responsibleIds.includes(p.id) && "bg-muted"
              )}
            >
              <Checkbox
                checked={responsibleIds.includes(p.id)}
                onCheckedChange={() => handleToggle(p.id)}
              />
              <AvatarCircle name={p.name} color={p.color} size="sm" avatarUrl={p.avatarUrl} />
              <span className="truncate">{p.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Phase Edit
interface PhaseEditCellProps {
  phaseId?: string;
  phases: Phase[];
  projectId: string;
  onSave: (phaseId: string | undefined) => void;
}

export const PhaseEditCell = ({ phaseId, phases, projectId, onSave }: PhaseEditCellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const projectPhases = phases.filter(p => p.projectId === projectId);
  const currentPhase = phases.find(p => p.id === phaseId);

  const handleSelect = (value: string) => {
    onSave(value === 'none' ? undefined : value);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors min-h-[22px]">
          <span className="text-xs text-muted-foreground">{currentPhase?.name || '-'}</span>
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          <button
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors",
              !phaseId && "bg-muted"
            )}
            onClick={() => handleSelect('none')}
          >
            <span className="text-muted-foreground">Nenhuma</span>
          </button>
          {projectPhases.map((p) => (
            <button
              key={p.id}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors",
                phaseId === p.id && "bg-muted"
              )}
              onClick={() => handleSelect(p.id)}
            >
              {p.color && (
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
              )}
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Text Edit (for name, observation)
interface TextEditCellProps {
  value: string;
  placeholder?: string;
  onSave: (value: string) => void;
  className?: string;
  isOverdue?: boolean;
}

export const TextEditCell = ({ value, placeholder, onSave, className, isOverdue }: TextEditCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const handleSave = () => {
    onSave(localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 px-2 text-xs min-w-[120px]"
        />
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
    );
  }

  return (
    <div 
      className="group flex items-center gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors min-h-[22px] min-w-0 overflow-hidden"
      onClick={() => {
        setLocalValue(value);
        setIsEditing(true);
      }}
    >
      <span className={cn("text-xs truncate", className, isOverdue && "text-status-blocked")}>
        {value || <span className="text-muted-foreground">{placeholder || '-'}</span>}
      </span>
      <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
};

// Date Edit Cell
interface DateEditCellProps {
  value?: string;
  placeholder?: string;
  onSave: (value: string | undefined) => void;
}

export const DateEditCell = ({ value, placeholder, onSave }: DateEditCellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onSave(format(selectedDate, 'yyyy-MM-dd'));
    } else {
      onSave(undefined);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onSave(undefined);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors min-h-[22px]">
          <CalendarIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className={cn(
            "text-xs tabular-nums",
            !date && "text-muted-foreground"
          )}>
            {date ? format(date, 'dd/MM/yy', { locale: ptBR }) : (placeholder || '-')}
          </span>
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          className="p-3 pointer-events-auto"
          locale={ptBR}
        />
        {date && (
          <div className="px-3 pb-3 pt-0">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleClear}
            >
              <X className="w-3.5 h-3.5" />
              Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

// Estimate Edit ("30m", "1h30", "2h" ou minutos)
interface EstimateEditCellProps {
  value?: number | null;
  placeholder?: string;
  onSave: (minutes: number | null) => void;
  /** Rótulo acessível do botão (ex.: nome da tarefa) */
  label?: string;
  /** Abre já em edição (atalho de teclado) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const EstimateEditCell = ({ value, placeholder, onSave, label, open, onOpenChange }: EstimateEditCellProps) => {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setIsOpen = (next: boolean) => { setInnerOpen(next); onOpenChange?.(next); };
  const [text, setText] = useState('');
  const minutes = text.trim() ? parseEstimate(text) : null;
  const invalid = text.trim() !== '' && minutes === null;

  const save = () => {
    if (invalid) return;
    if ((minutes ?? null) !== (value ?? null)) onSave(minutes);
    setIsOpen(false);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(next) => { if (next) setText(value ? formatMinutes(value) : ''); setIsOpen(next); }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ? `Estimativa: ${label}` : 'Estimativa'}
          className="group flex items-center gap-1 cursor-pointer hover:bg-muted/60 rounded-md px-1 py-0.5 -mx-1 transition-colors min-h-[22px]"
        >
          <Hourglass className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className={cn('text-xs tabular-nums', !value && 'text-muted-foreground')}>
            {value ? formatMinutes(value) : (placeholder || '-')}
          </span>
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2 space-y-1.5" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') { e.preventDefault(); setIsOpen(false); }
          }}
          placeholder="30m, 1h30"
          aria-label="Estimativa em horas e minutos"
          aria-invalid={invalid}
          className="h-8 text-sm"
        />
        <p className={cn('text-[11px]', invalid ? 'text-destructive' : 'text-muted-foreground')}>
          {invalid ? 'De 1 minuto a 24 horas' : minutes ? `Enter: ${formatMinutes(minutes)}` : 'Enter: sem estimativa'}
        </p>
      </PopoverContent>
    </Popover>
  );
};
