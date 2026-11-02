import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { useData } from '@/contexts/DataContext';
import { CustomColumn, Person } from '@/lib/types';
import { cn } from '@/lib/utils';

// Tipo para os valores de filtro de cada coluna
export interface CustomFilterValue {
  text?: string;           // Para tipo 'text'
  selected?: string[];     // Para tipo 'list' e 'user'
  min?: number | string;   // Para tipos numéricos e data
  max?: number | string;   // Para tipos numéricos e data
}

export type CustomFiltersState = Record<string, CustomFilterValue>;

interface CustomColumnFiltersProps {
  columns: CustomColumn[];
  filters: CustomFiltersState;
  onChange: (filters: CustomFiltersState) => void;
}

export const CustomColumnFilters = ({ columns, filters, onChange }: CustomColumnFiltersProps) => {
  const { people } = useData();
  const activePeople = people.filter(p => p.active);

  // Filtra apenas colunas customizadas (não standardField)
  const customColumns = columns.filter(col => !col.standardField && col.active);

  if (customColumns.length === 0) {
    return null;
  }

  const updateFilter = (columnId: string, value: CustomFilterValue) => {
    onChange({
      ...filters,
      [columnId]: value,
    });
  };

  const clearFilter = (columnId: string) => {
    const newFilters = { ...filters };
    delete newFilters[columnId];
    onChange(newFilters);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <span className="text-sm font-medium text-muted-foreground">Colunas Customizadas</span>
      </div>

      {customColumns.map(column => (
        <div key={column.id} className="space-y-1.5">
          <Label className="text-sm">{column.name}</Label>
          <FilterInput
            column={column}
            value={filters[column.id] || {}}
            onChange={(value) => updateFilter(column.id, value)}
            onClear={() => clearFilter(column.id)}
            people={activePeople}
          />
        </div>
      ))}
    </div>
  );
};

interface FilterInputProps {
  column: CustomColumn;
  value: CustomFilterValue;
  onChange: (value: CustomFilterValue) => void;
  onClear: () => void;
  people: Person[];
}

const FilterInput = ({ column, value, onChange, onClear, people }: FilterInputProps) => {
  switch (column.type) {
    case 'text':
      return (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={value.text || ''}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Buscar..."
            className="pl-8 pr-8"
          />
          {value.text && (
            <button
              onClick={onClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      );

    case 'list':
      return (
        <ListFilter
          options={column.options || []}
          selected={value.selected || []}
          onChange={(selected) => onChange({ selected })}
        />
      );

    case 'user':
      return (
        <UserFilter
          people={people}
          selected={value.selected || []}
          onChange={(selected) => onChange({ selected })}
        />
      );

    case 'date':
      return (
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="date"
              value={value.min as string || ''}
              onChange={(e) => onChange({ ...value, min: e.target.value })}
              placeholder="De"
            />
          </div>
          <div className="flex-1">
            <Input
              type="date"
              value={value.max as string || ''}
              onChange={(e) => onChange({ ...value, max: e.target.value })}
              placeholder="Até"
            />
          </div>
        </div>
      );

    case 'number':
    case 'percentage':
      return (
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="number"
              value={value.min as number ?? ''}
              onChange={(e) => onChange({ ...value, min: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Mín"
            />
          </div>
          <div className="flex-1">
            <Input
              type="number"
              value={value.max as number ?? ''}
              onChange={(e) => onChange({ ...value, max: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Máx"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
};

interface ListFilterProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const ListFilter = ({ options, selected, onChange }: ListFilterProps) => {
  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="space-y-0.5 max-h-[150px] overflow-y-auto border border-border rounded-lg p-1">
      {options.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Nenhuma opção disponível</p>
      ) : (
        options.map(option => (
          <label
            key={option}
            className="flex items-center gap-2 cursor-pointer hover:bg-muted/60 rounded-md px-2 py-1 transition-colors"
          >
            <Checkbox
              checked={selected.includes(option)}
              onCheckedChange={() => toggleOption(option)}
            />
            <span className="text-sm">{option}</span>
          </label>
        ))
      )}
    </div>
  );
};

interface UserFilterProps {
  people: Person[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const UserFilter = ({ people, selected, onChange }: UserFilterProps) => {
  const togglePerson = (personId: string) => {
    if (selected.includes(personId)) {
      onChange(selected.filter(s => s !== personId));
    } else {
      onChange([...selected, personId]);
    }
  };

  return (
    <div className="space-y-0.5 max-h-[150px] overflow-y-auto border border-border rounded-lg p-1">
      {people.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum usuário disponível</p>
      ) : (
        people.map(person => (
          <label
            key={person.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-muted/60 rounded-md px-2 py-1 transition-colors"
          >
            <Checkbox
              checked={selected.includes(person.id)}
              onCheckedChange={() => togglePerson(person.id)}
            />
            <AvatarCircle name={person.name} color={person.color} size="xs" avatarUrl={person.avatarUrl} />
            <span className="text-sm">{person.name}</span>
          </label>
        ))
      )}
    </div>
  );
};

// Função auxiliar para verificar se há filtros customizados ativos
export const countActiveCustomFilters = (filters: CustomFiltersState): number => {
  return Object.values(filters).filter(filter => {
    if (filter.text) return true;
    if (filter.selected && filter.selected.length > 0) return true;
    if (filter.min !== undefined && filter.min !== '') return true;
    if (filter.max !== undefined && filter.max !== '') return true;
    return false;
  }).length;
};

// Função para aplicar filtros customizados a uma tarefa
export const matchesCustomFilters = (
  task: { customValues?: Record<string, string | number> },
  filters: CustomFiltersState,
  columns: CustomColumn[]
): boolean => {
  return Object.entries(filters).every(([colId, filter]) => {
    const column = columns.find(c => c.id === colId);
    if (!column) return true;

    const taskValue = task.customValues?.[colId];

    // Se não há filtro ativo para esta coluna, passa
    const hasActiveFilter =
      filter.text ||
      (filter.selected && filter.selected.length > 0) ||
      filter.min !== undefined ||
      filter.max !== undefined;

    if (!hasActiveFilter) return true;

    switch (column.type) {
      case 'text':
        if (!filter.text) return true;
        return String(taskValue || '').toLowerCase().includes(filter.text.toLowerCase());

      case 'list':
      case 'user':
        if (!filter.selected?.length) return true;
        return filter.selected.includes(String(taskValue || ''));

      case 'number':
      case 'percentage':
        if (taskValue === undefined || taskValue === '') {
          // Se não tem valor e há filtro de range, não passa
          return filter.min === undefined && filter.max === undefined;
        }
        const numValue = Number(taskValue);
        if (filter.min !== undefined && filter.min !== '' && numValue < Number(filter.min)) return false;
        if (filter.max !== undefined && filter.max !== '' && numValue > Number(filter.max)) return false;
        return true;

      case 'date':
        if (!taskValue) {
          return filter.min === undefined && filter.max === undefined;
        }
        const dateValue = String(taskValue);
        if (filter.min && dateValue < String(filter.min)) return false;
        if (filter.max && dateValue > String(filter.max)) return false;
        return true;

      default:
        return true;
    }
  });
};
