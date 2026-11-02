import { useState } from 'react';
import { Filter, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { useData } from '@/contexts/DataContext';
import { CustomColumn, Person, TaskStatus, TaskPriority } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CustomFilterValue } from './CustomColumnFilters';

interface ColumnHeaderFilterProps {
  column: CustomColumn;
  filter: CustomFilterValue | undefined;
  onChange: (value: CustomFilterValue | undefined) => void;
}

export const ColumnHeaderFilter = ({ column, filter, onChange }: ColumnHeaderFilterProps) => {
  const { people } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const activePeople = people.filter(p => p.active);

  // Verifica se há filtro ativo
  const hasActiveFilter = filter && (
    filter.text ||
    (filter.selected && filter.selected.length > 0) ||
    filter.min !== undefined ||
    filter.max !== undefined
  );

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-0.5 rounded-sm hover:bg-muted transition-colors",
            hasActiveFilter ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className={cn("w-3 h-3", hasActiveFilter && "fill-primary/20")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="flex h-7 items-center justify-between gap-2 px-1">
            <span className="text-sm font-medium truncate">Filtrar: {column.name}</span>
            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-muted-foreground" onClick={clearFilter}>
                <X className="w-3.5 h-3.5" />
                Limpar
              </Button>
            )}
          </div>

          <FilterContent
            column={column}
            filter={filter || {}}
            onChange={onChange}
            people={activePeople}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface FilterContentProps {
  column: CustomColumn;
  filter: CustomFilterValue;
  onChange: (value: CustomFilterValue | undefined) => void;
  people: Person[];
}

const FilterContent = ({ column, filter, onChange, people }: FilterContentProps) => {
  switch (column.type) {
    case 'text':
      return (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={filter.text || ''}
            onChange={(e) => onChange({ ...filter, text: e.target.value || undefined })}
            placeholder="Buscar..."
            className="pl-8 h-8 text-sm"
            autoFocus
          />
        </div>
      );

    case 'list':
      return (
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {(column.options || []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhuma opção</p>
          ) : (
            column.options?.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted/60 rounded-md px-2 py-1.5 transition-colors"
              >
                <Checkbox
                  checked={(filter.selected || []).includes(option)}
                  onCheckedChange={(checked) => {
                    const current = filter.selected || [];
                    const updated = checked
                      ? [...current, option]
                      : current.filter(s => s !== option);
                    onChange({ ...filter, selected: updated.length ? updated : undefined });
                  }}
                />
                <span className="text-sm">{option}</span>
              </label>
            ))
          )}
        </div>
      );

    case 'user':
      return (
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {people.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum usuário</p>
          ) : (
            people.map(person => (
              <label
                key={person.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted/60 rounded-md px-2 py-1.5 transition-colors"
              >
                <Checkbox
                  checked={(filter.selected || []).includes(person.id)}
                  onCheckedChange={(checked) => {
                    const current = filter.selected || [];
                    const updated = checked
                      ? [...current, person.id]
                      : current.filter(s => s !== person.id);
                    onChange({ ...filter, selected: updated.length ? updated : undefined });
                  }}
                />
                <AvatarCircle name={person.name} color={person.color} size="xs" avatarUrl={person.avatarUrl} />
                <span className="text-sm">{person.name}</span>
              </label>
            ))
          )}
        </div>
      );

    case 'date':
      return (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">De</label>
            <Input
              type="date"
              value={(filter.min as string) || ''}
              onChange={(e) => onChange({ ...filter, min: e.target.value || undefined })}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Até</label>
            <Input
              type="date"
              value={(filter.max as string) || ''}
              onChange={(e) => onChange({ ...filter, max: e.target.value || undefined })}
              className="h-8 text-sm"
            />
          </div>
        </div>
      );

    case 'number':
    case 'percentage':
      return (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mínimo</label>
            <Input
              type="number"
              value={filter.min ?? ''}
              onChange={(e) => onChange({ ...filter, min: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-sm"
              placeholder="Min"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Máximo</label>
            <Input
              type="number"
              value={filter.max ?? ''}
              onChange={(e) => onChange({ ...filter, max: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-sm"
              placeholder="Max"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
};

// Componente para mostrar filtros ativos como badges
interface ActiveFiltersBarProps {
  filters: Record<string, CustomFilterValue>;
  columns: CustomColumn[];
  onClear: (columnId: string) => void;
  onClearAll: () => void;
}

// ============================================
// Filtros para Colunas Padrão (Status, Prioridade, Responsável)
// ============================================

export type StandardFilterType = 'status' | 'priority' | 'responsible';

export interface StandardFiltersState {
  status: string[];
  priority: string[];
  responsible: string[];
}

interface StandardColumnFilterProps {
  type: StandardFilterType;
  selected: string[];
  onChange: (selected: string[]) => void;
  people?: Person[];
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em Progresso' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export const StandardColumnFilter = ({ type, selected, onChange, people = [] }: StandardColumnFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilter = selected.length > 0;

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const getTitle = () => {
    switch (type) {
      case 'status': return 'Status';
      case 'priority': return 'Prioridade';
      case 'responsible': return 'Responsável';
    }
  };

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(s => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-0.5 rounded-sm hover:bg-muted transition-colors",
            hasActiveFilter ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className={cn("w-3 h-3", hasActiveFilter && "fill-primary/20")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="flex h-7 items-center justify-between gap-2 px-1">
            <span className="text-sm font-medium truncate">Filtrar: {getTitle()}</span>
            {hasActiveFilter && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-muted-foreground" onClick={clearFilter}>
                <X className="w-3.5 h-3.5" />
                Limpar
              </Button>
            )}
          </div>

          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {type === 'status' && STATUS_OPTIONS.map(option => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted/60 rounded-md px-2 py-1.5 transition-colors"
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => toggleOption(option.value)}
                />
                <StatusBadge status={option.value as TaskStatus} />
              </label>
            ))}

            {type === 'priority' && PRIORITY_OPTIONS.map(option => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted/60 rounded-md px-2 py-1.5 transition-colors"
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => toggleOption(option.value)}
                />
                <PriorityBadge priority={option.value as TaskPriority} />
              </label>
            ))}

            {type === 'responsible' && (
              people.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum usuário</p>
              ) : (
                people.filter(p => p.active).map(person => (
                  <label
                    key={person.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/60 rounded-md px-2 py-1.5 transition-colors"
                  >
                    <Checkbox
                      checked={selected.includes(person.id)}
                      onCheckedChange={() => toggleOption(person.id)}
                    />
                    <AvatarCircle name={person.name} color={person.color} size="xs" avatarUrl={person.avatarUrl} />
                    <span className="text-sm">{person.name}</span>
                  </label>
                ))
              )
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Helper functions for standard filter labels
export const getStatusLabel = (value: string): string => {
  return STATUS_OPTIONS.find(o => o.value === value)?.label || value;
};

export const getPriorityLabel = (value: string): string => {
  return PRIORITY_OPTIONS.find(o => o.value === value)?.label || value;
};

// Função para verificar se há filtros padrão ativos
export const hasActiveStandardFilters = (filters: StandardFiltersState): boolean => {
  return filters.status.length > 0 || filters.priority.length > 0 || filters.responsible.length > 0;
};

// Função para contar filtros padrão ativos
export const countActiveStandardFilters = (filters: StandardFiltersState): number => {
  let count = 0;
  if (filters.status.length > 0) count++;
  if (filters.priority.length > 0) count++;
  if (filters.responsible.length > 0) count++;
  return count;
};

// Barra de filtros padrão ativos
interface StandardFiltersBarProps {
  filters: StandardFiltersState;
  people: Person[];
  onClearStatus: () => void;
  onClearPriority: () => void;
  onClearResponsible: () => void;
}

export const StandardFiltersBar = ({ filters, people, onClearStatus, onClearPriority, onClearResponsible }: StandardFiltersBarProps) => {
  const hasFilters = hasActiveStandardFilters(filters);
  if (!hasFilters) return null;

  const getResponsibleNames = (ids: string[]) => {
    const names = ids.map(id => people.find(p => p.id === id)?.name || id);
    return names.length > 2 ? `${names.length} selecionados` : names.join(', ');
  };

  const getSelectedLabels = (selected: string[], options: { value: string; label: string }[]) => {
    if (selected.length > 2) return `${selected.length} selecionados`;
    return selected.map(v => options.find(o => o.value === v)?.label || v).join(', ');
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.status.length > 0 && (
        <Badge variant="secondary" className="gap-1 text-xs">
          <span className="font-medium">Status:</span>
          <span className="font-normal">{getSelectedLabels(filters.status, STATUS_OPTIONS)}</span>
          <button onClick={onClearStatus} className="ml-0.5 rounded-sm text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
      {filters.priority.length > 0 && (
        <Badge variant="secondary" className="gap-1 text-xs">
          <span className="font-medium">Prioridade:</span>
          <span className="font-normal">{getSelectedLabels(filters.priority, PRIORITY_OPTIONS)}</span>
          <button onClick={onClearPriority} className="ml-0.5 rounded-sm text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
      {filters.responsible.length > 0 && (
        <Badge variant="secondary" className="gap-1 text-xs">
          <span className="font-medium">Responsável:</span>
          <span className="font-normal">{getResponsibleNames(filters.responsible)}</span>
          <button onClick={onClearResponsible} className="ml-0.5 rounded-sm text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
    </div>
  );
};

export const ActiveFiltersBar = ({ filters, columns, onClear, onClearAll }: ActiveFiltersBarProps) => {
  const { people } = useData();

  const activeFilters = Object.entries(filters).filter(([_, filter]) => {
    return filter.text || (filter.selected && filter.selected.length > 0) || filter.min !== undefined || filter.max !== undefined;
  });

  if (activeFilters.length === 0) return null;

  const getFilterLabel = (columnId: string, filter: CustomFilterValue): string => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return '';

    if (filter.text) return `"${filter.text}"`;
    if (filter.selected && filter.selected.length > 0) {
      if (column.type === 'user') {
        const names = filter.selected.map(id => people.find(p => p.id === id)?.name || id);
        return names.length > 2 ? `${names.length} selecionados` : names.join(', ');
      }
      return filter.selected.length > 2 ? `${filter.selected.length} selecionados` : filter.selected.join(', ');
    }
    if (filter.min !== undefined || filter.max !== undefined) {
      if (filter.min !== undefined && filter.max !== undefined) {
        return `${filter.min} - ${filter.max}`;
      }
      if (filter.min !== undefined) return `≥ ${filter.min}`;
      if (filter.max !== undefined) return `≤ ${filter.max}`;
    }
    return '';
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Filtros:</span>
      {activeFilters.map(([columnId, filter]) => {
        const column = columns.find(c => c.id === columnId);
        if (!column) return null;

        return (
          <Badge key={columnId} variant="secondary" className="gap-1 text-xs">
            <span className="font-medium">{column.name}:</span>
            <span className="font-normal">{getFilterLabel(columnId, filter)}</span>
            <button onClick={() => onClear(columnId)} className="ml-0.5 rounded-sm text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        );
      })}
      {activeFilters.length > 1 && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground" onClick={onClearAll}>
          Limpar todos
        </Button>
      )}
    </div>
  );
};
