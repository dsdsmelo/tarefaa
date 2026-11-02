import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/contexts/DataContext';
import { Milestone } from '@/lib/types';
import { toast } from 'sonner';
import { Calendar, Diamond, Plus, Layers } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const milestoneSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  color: z.string().optional(),
  date: z.string().min(1, 'Data é obrigatória'),
  phaseId: z.string().optional(),
});

type MilestoneFormData = z.infer<typeof milestoneSchema>;

interface MilestoneFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  milestone?: Milestone;
}

const colorOptions = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#22C55E', label: 'Verde' },
  { value: '#EAB308', label: 'Amarelo' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#F97316', label: 'Laranja' },
];

export const MilestoneFormModal = ({
  open,
  onOpenChange,
  projectId,
  milestone,
}: MilestoneFormModalProps) => {
  const { addMilestone, updateMilestone, phases } = useData();
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [dateOpen, setDateOpen] = useState(false);

  // Filtrar fases do projeto atual
  const projectPhases = useMemo(
    () => phases.filter(p => p.projectId === projectId).sort((a, b) => a.order - b.order),
    [phases, projectId]
  );

  const form = useForm<MilestoneFormData>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      name: '',
      description: '',
      color: '#3B82F6',
      date: '',
      phaseId: '',
    },
  });

  useEffect(() => {
    if (milestone) {
      form.reset({
        name: milestone.name,
        description: milestone.description || '',
        color: milestone.color || '#3B82F6',
        date: milestone.date || '',
        phaseId: milestone.phaseId || '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
        color: '#3B82F6',
        date: '',
        phaseId: '',
      });
    }
  }, [milestone, open, form]);

  const onSubmit = async (data: MilestoneFormData) => {
    try {
      if (milestone) {
        await updateMilestone(milestone.id, {
          name: data.name,
          description: data.description,
          color: data.color,
          date: data.date,
          phaseId: data.phaseId || undefined,
        });
        toast.success('Marco atualizado com sucesso!');
      } else {
        await addMilestone({
          name: data.name,
          projectId,
          description: data.description,
          color: data.color,
          date: data.date,
          phaseId: data.phaseId || undefined,
        });
        toast.success('Marco criado com sucesso!');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao salvar marco');
      console.error(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Diamond className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle>
                {milestone ? 'Editar Marco' : 'Novo Marco'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Marcos são pontos importantes no cronograma
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
                  <FormLabel>Nome do Marco</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Go-Live, Entrega MVP, Aprovação..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data</FormLabel>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
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
                            format(new Date(field.value), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione a data do marco</span>
                          )}
                          <Calendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => { field.onChange(date?.toISOString().split('T')[0]); setDateOpen(false); }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Seleção de Fase (opcional) */}
            {projectPhases.length > 0 && (
              <FormField
                control={form.control}
                name="phaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      Vincular a uma Fase (opcional)
                    </FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma fase..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">Nenhuma fase</span>
                        </SelectItem>
                        {projectPhases.map((phase) => (
                          <SelectItem key={phase.id} value={phase.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: phase.color || '#f59e0b' }}
                              />
                              {phase.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O marco será exibido junto à fase no Gantt
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                      placeholder="Descrição ou observações sobre este marco..."
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
                {milestone ? 'Salvar' : 'Criar Marco'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
