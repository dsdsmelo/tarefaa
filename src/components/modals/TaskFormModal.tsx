import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList, Pencil, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AvatarCircle } from '@/components/ui/avatar-circle';
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
import { useData } from '@/contexts/DataContext';
import { Task } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const taskSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome deve ter no máximo 200 caracteres'),
  description: z.string().max(2000, 'Descrição deve ter no máximo 2000 caracteres').optional(),
  projectId: z.string().min(1, 'Projeto é obrigatório'),
  responsibleIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  defaultProjectId?: string;
  defaultResponsibleIds?: string[];
}

export function TaskFormModal({ open, onOpenChange, task, defaultProjectId, defaultResponsibleIds }: TaskFormModalProps) {
  const { projects, people, addTask, updateTask, getProjectMemberIds } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responsiblePopoverOpen, setResponsiblePopoverOpen] = useState(false);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      description: '',
      projectId: defaultProjectId || '',
      responsibleIds: defaultResponsibleIds || [],
      startDate: '',
      endDate: '',
      priority: 'medium',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const projectMemberIds = selectedProjectId ? getProjectMemberIds(selectedProjectId) : [];

  const selectedResponsibleIds = form.watch('responsibleIds') || [];
  const selectedPeople = people.filter(p => selectedResponsibleIds.includes(p.id));
  // Filtrar pessoas ativas pelos membros do projeto (se houver membros definidos)
  const activePeople = people.filter(p => {
    if (!p.active) return false;
    if (projectMemberIds && projectMemberIds.length > 0) {
      return projectMemberIds.includes(p.id);
    }
    return true;
  });
  // Quando o projeto só tem um responsável possível, ele vira o padrão
  const soleResponsibleId = activePeople.length === 1 ? activePeople[0].id : null;

  const toggleResponsible = (personId: string) => {
    const current = form.getValues('responsibleIds') || [];
    if (current.includes(personId)) {
      form.setValue('responsibleIds', current.filter(id => id !== personId));
    } else {
      form.setValue('responsibleIds', [...current, personId]);
    }
  };

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        description: task.description || '',
        projectId: task.projectId,
        responsibleIds: task.responsibleIds || [],
        startDate: task.startDate || '',
        endDate: task.endDate || '',
        priority: task.priority,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        projectId: defaultProjectId || '',
        responsibleIds: defaultResponsibleIds || [],
        startDate: '',
        endDate: '',
        priority: 'medium',
      });
    }
  }, [task, defaultProjectId, defaultResponsibleIds, form, open]);

  // Ao criar tarefa: se o projeto tem apenas um responsável possível, já o define
  // como padrão, sem o usuário precisar escolher. Não sobrescreve edição nem uma
  // seleção já existente (incluindo defaultResponsibleIds).
  useEffect(() => {
    if (task) return;
    if (!selectedProjectId || !soleResponsibleId) return;
    const current = form.getValues('responsibleIds') || [];
    if (current.length > 0) return;
    form.setValue('responsibleIds', [soleResponsibleId]);
  }, [task, selectedProjectId, soleResponsibleId, open, form]);

  const onSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    try {
      const taskData = {
        name: data.name,
        description: data.description || undefined,
        projectId: data.projectId,
        responsibleIds: data.responsibleIds && data.responsibleIds.length > 0 ? data.responsibleIds : undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        status: task?.status || 'pending' as const, // Keep existing status or default to pending
        priority: data.priority,
        observation: task?.observation, // Keep existing observation
        customValues: task?.customValues || {}, // Keep existing custom values
      };

      if (task) {
        await updateTask(task.id, taskData);
        toast.success('Tarefa atualizada com sucesso!');
      } else {
        await addTask(taskData);
        toast.success('Tarefa criada com sucesso!');
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Erro ao salvar tarefa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400">
              {task ? <Pencil className="w-5 h-5" /> : <ClipboardList className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
              <DialogDescription>
                {task ? 'Atualize as informações da tarefa' : 'Preencha os dados básicos para criar uma nova tarefa'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Nome da tarefa"
              maxLength={200}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Descrição detalhada da tarefa"
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* Project - Fixed when defaultProjectId is provided */}
          {!defaultProjectId && (
            <div className="space-y-2">
              <Label htmlFor="projectId">Projeto *</Label>
              <Select
                value={form.watch('projectId')}
                onValueChange={(value) => form.setValue('projectId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.projectId && (
                <p className="text-sm text-destructive">{form.formState.errors.projectId.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Responsible - Multi-select */}
            <div className="space-y-2">
              <Label>Responsáveis</Label>
              <Popover open={responsiblePopoverOpen} onOpenChange={setResponsiblePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      selectedPeople.length === 0 && "text-muted-foreground"
                    )}
                  >
                    {selectedPeople.length === 0 ? (
                      <span>Selecione...</span>
                    ) : selectedPeople.length === 1 ? (
                      <div className="flex items-center gap-2">
                        <AvatarCircle name={selectedPeople[0].name} color={selectedPeople[0].color} size="xs" avatarUrl={selectedPeople[0].avatarUrl} />
                        <span className="truncate">{selectedPeople[0].name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1">
                          {selectedPeople.slice(0, 3).map(p => (
                            <AvatarCircle key={p.id} name={p.name} color={p.color} size="xs" avatarUrl={p.avatarUrl} className="ring-1 ring-background" />
                          ))}
                        </div>
                        <span className="text-sm">{selectedPeople.length} selecionados</span>
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selectedPeople.length > 0 && (
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-muted-foreground"
                        onClick={() => form.setValue('responsibleIds', [])}
                      >
                        <X className="w-3 h-3" />
                        Limpar seleção
                      </button>
                    )}
                    {activePeople.map((person) => (
                      <label
                        key={person.id}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors cursor-pointer",
                          selectedResponsibleIds.includes(person.id) && "bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={selectedResponsibleIds.includes(person.id)}
                          onCheckedChange={() => toggleResponsible(person.id)}
                        />
                        <AvatarCircle name={person.name} color={person.color} size="sm" avatarUrl={person.avatarUrl} />
                        <span className="truncate">{person.name}</span>
                      </label>
                    ))}
                    {activePeople.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhuma pessoa cadastrada
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(value: TaskFormData['priority']) => form.setValue('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                {...form.register('startDate')}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                {...form.register('endDate')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gradient-primary text-white">
              {isSubmitting ? 'Salvando...' : task ? 'Atualizar' : 'Criar Tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
