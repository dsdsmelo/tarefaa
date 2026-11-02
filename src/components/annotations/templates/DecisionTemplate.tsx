import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '../RichTextEditor';
import { useData } from '@/contexts/DataContext';
import { DecisionTemplateData } from '@/lib/spreadsheet-types';
import { X, Plus, User, CalendarIcon } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DecisionTemplateProps {
  data: DecisionTemplateData;
  onChange: (data: DecisionTemplateData) => void;
}

export function DecisionTemplate({ data, onChange }: DecisionTemplateProps) {
  const { people } = useData();
  const [newOption, setNewOption] = useState('');
  const [deadlineOpen, setDeadlineOpen] = useState(false);

  const activePeople = people?.filter(p => p.active) || [];

  const handleAddOption = () => {
    if (newOption.trim()) {
      onChange({
        ...data,
        optionsConsidered: [...data.optionsConsidered, newOption.trim()],
      });
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    onChange({
      ...data,
      optionsConsidered: data.optionsConsidered.filter((_, i) => i !== index),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
  };

  return (
    <div className="space-y-4">
      {/* Contexto */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Contexto
        </Label>
        <RichTextEditor
          content={data.context}
          onChange={(html) => onChange({ ...data, context: html })}
          placeholder="Descreva o contexto e por que essa decisão é necessária..."
          minHeight="100px"
        />
      </div>

      {/* Opções Consideradas */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Opções Consideradas
        </Label>
        <div className="space-y-2">
          {data.optionsConsidered.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                {index + 1}. {option}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveOption(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Adicionar opção..."
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={handleAddOption}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Decisão Final */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Decisão Final
        </Label>
        <RichTextEditor
          content={data.finalDecision}
          onChange={(html) => onChange({ ...data, finalDecision: html })}
          placeholder="Registre a decisão tomada e a justificativa..."
          minHeight="100px"
        />
      </div>

      {/* Responsável e Data Limite */}
      <div className="grid grid-cols-2 gap-4">
        {/* Responsável */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Responsável
          </Label>
          <Select
            value={data.responsibleId || ''}
            onValueChange={(value) => onChange({ ...data, responsibleId: value || undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar responsável..." />
            </SelectTrigger>
            <SelectContent>
              {activePeople.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: person.color }}
                    />
                    {person.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data Limite */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Data Limite
          </Label>
          <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !data.deadline && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {data.deadline
                  ? format(new Date(data.deadline), 'PPP', { locale: ptBR })
                  : 'Selecionar data...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={data.deadline ? new Date(data.deadline) : undefined}
                onSelect={(date) => {
                  onChange({ ...data, deadline: date?.toISOString() });
                  setDeadlineOpen(false);
                }}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

export default DecisionTemplate;
