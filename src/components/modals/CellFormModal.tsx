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
import { Grid3X3, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useData } from '@/contexts/DataContext';
import { Cell } from '@/lib/types';
import { toast } from 'sonner';

const cellSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
});

type CellFormData = z.infer<typeof cellSchema>;

interface CellFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cell?: Cell;
}

export function CellFormModal({ open, onOpenChange, cell }: CellFormModalProps) {
  const { addCell, updateCell } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CellFormData>({
    resolver: zodResolver(cellSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (cell) {
      form.reset({
        name: cell.name,
        description: cell.description || '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
      });
    }
  }, [cell, form, open]);

  const onSubmit = async (data: CellFormData) => {
    setIsSubmitting(true);
    try {
      const cellData = {
        name: data.name,
        description: data.description || undefined,
        active: cell?.active ?? true,
      };

      if (cell) {
        await updateCell(cell.id, cellData);
        toast.success('Célula atualizada com sucesso!');
      } else {
        await addCell(cellData);
        toast.success('Célula criada com sucesso!');
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving cell:', error);
      toast.error('Erro ao salvar célula');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {cell ? <Pencil className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
            </div>
            <div>
              <DialogTitle>{cell ? 'Editar Célula' : 'Nova Célula'}</DialogTitle>
              <DialogDescription>
                {cell ? 'Atualize as informações da célula' : 'Preencha os dados para criar uma nova célula'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Nome da célula"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Descrição da célula"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : cell ? 'Atualizar' : 'Criar Célula'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
