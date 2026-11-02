import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/contexts/DataContext';
import { Phase } from '@/lib/types';
import { toast } from 'sonner';
import { Calendar, Layers, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const phaseSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  color: z.string().optional(),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  endDate: z.string().min(1, 'Data de término é obrigatória'),
});

type PhaseFormData = z.infer<typeof phaseSchema>;

interface PhaseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phase?: Phase;
  nextOrder?: number;
}

const colorOptions = [
  { value: '#EAB308', label: 'Amarelo' },
  { value: '#22C55E', label: 'Verde' },
  { value: '#3B82F6', label: 'Azul' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#F97316', label: 'Laranja' },
  { value: '#06B6D4', label: 'Ciano' },
  { value: '#EC4899', label: 'Rosa' },
];

export const PhaseFormModal = ({
  open,
  onOpenChange,
  projectId,
  phase,
  nextOrder = 0,
}: PhaseFormModalProps) => {
  const { addPhase, updatePhase } = useData();
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const form = useForm<PhaseFormData>({
    resolver: zodResolver(phaseSchema),
    defaultValues: {
      name: '',
      description: '',
      color: '#EAB308',
      startDate: '',
      endDate: '',
    },
  });

  useEffect(() => {
    if (phase) {
      form.reset({
        name: phase.name,
        description: phase.description || '',
        color: phase.color || '#EAB308',
        startDate: phase.startDate || '',
        endDate: phase.endDate || '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        color: '#EAB308',
        startDate: '',
        endDate: '',
      });
    }
  }, [phase, open, form]);

  const onSubmit = async (data: PhaseFormData) => {
    try {
      if (phase) {
        await updatePhase(phase.id, {
          name: data.name,
          description: data.description,
          color: data.color,
          startDate: data.startDate,
          endDate: data.endDate,
        });
        toast.success('Fase atualizada com sucesso!');
      } else {
        await addPhase({
          name: data.name,
          projectId,
          description: data.description,
          color: data.color,
          startDate: data.startDate,
          endDate: data.endDate,
          order: nextOrder,
        });
        toast.success('Fase criada com sucesso!');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao salvar fase');
      console.error(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle>
                {phase ? 'Editar Fase' : 'Nova Fase'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Fases são períodos do projeto com início e fim
              </p>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Fase</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Sprint 1, Planejamento, Execução..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Início</FormLabel>
                    <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(new Date(field.value), 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              <span>Início</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => { field.onChange(date?.toISOString().split('T')[0]); setStartDateOpen(false); }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Término</FormLabel>
                    <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(new Date(field.value), 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              <span>Término</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => { field.onChange(date?.toISOString().split('T')[0]); setEndDateOpen(false); }}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <div className="flex flex-wrap gap-2 items-center">
                    {[...colorOptions.map(c => c.value), ...customColors].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => field.onChange(color)}
                        className={cn(
                          "w-7 h-7 rounded-full transition-colors border-2",
                          field.value === color
                            ? "border-foreground ring-2 ring-foreground/20 ring-offset-1 ring-offset-background"
                            : "border-transparent hover:border-foreground/30"
                        )}
                        style={{ backgroundColor: color }}
                        title={colorOptions.find(c => c.value === color)?.label || color}
                      />
                    ))}
                    <label
                      className="w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                      title="Adicionar cor personalizada"
                    >
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="color"
                        className="sr-only"
                        onInput={(e) => {
                          field.onChange((e.target as HTMLInputElement).value);
                        }}
                        onBlur={(e) => {
                          const newColor = e.target.value;
                          if (!colorOptions.some(c => c.value === newColor) && !customColors.includes(newColor)) {
                            setCustomColors(prev => [...prev, newColor]);
                          }
                          field.onChange(newColor);
                        }}
                      />
                    </label>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição ou objetivos desta fase..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {phase ? 'Salvar' : 'Criar Fase'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
