import { useState, useEffect, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';
import { Person } from '@/lib/types';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Camera, X, Loader2, UserPlus, Pencil, Send } from 'lucide-react';
import { AvatarCircle } from '@/components/ui/avatar-circle';

const personSchema = z.object({
  firstName: z.string().min(1, 'Primeiro nome é obrigatório'),
  lastName: z.string().optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  type: z.enum(['internal', 'partner']),
  color: z.string().min(1, 'Cor é obrigatória'),
});

type PersonFormData = z.infer<typeof personSchema>;

interface PersonFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person;
}

const colorOptions = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#F59E0B', label: 'Amarelo' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#06B6D4', label: 'Ciano' },
  { value: '#F97316', label: 'Laranja' },
];

export function PersonFormModal({ open, onOpenChange, person }: PersonFormModalProps) {
  const { addPerson, updatePerson } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      type: 'internal',
      color: '#3B82F6',
    },
  });

  useEffect(() => {
    if (person) {
      form.reset({
        firstName: person.firstName || person.name?.split(' ')[0] || '',
        lastName: person.lastName || person.name?.split(' ').slice(1).join(' ') || '',
        email: person.email || '',
        type: person.type,
        color: person.color,
      });
      setAvatarUrl(person.avatarUrl);
    } else {
      form.reset({
        firstName: '',
        lastName: '',
        email: '',
        type: 'internal',
        color: '#3B82F6',
      });
      setAvatarUrl(undefined);
    }
  }, [person, form, open]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('person-avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('person-avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(urlData.publicUrl);
      toast.success('Foto enviada com sucesso!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Erro ao enviar foto');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (avatarUrl) {
      // Extract file path from URL
      const urlParts = avatarUrl.split('/person-avatars/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        try {
          await supabase.storage.from('person-avatars').remove([filePath]);
        } catch (error) {
          console.error('Error removing avatar from storage:', error);
        }
      }
    }
    setAvatarUrl(undefined);
  };

  const onSubmit = async (data: PersonFormData) => {
    // Validação extra: email obrigatório para internos
    if (data.type === 'internal' && !data.email) {
      form.setError('email', { message: 'Email é obrigatório para participantes internos' });
      return;
    }

    setIsSubmitting(true);
    try {
      const displayName = `${data.firstName} ${data.lastName || ''}`.trim();

      const personData = {
        name: displayName,
        firstName: data.firstName,
        lastName: data.lastName || '',
        email: data.email || undefined,
        type: data.type,
        color: data.color,
        active: person?.active ?? true,
        avatarUrl: avatarUrl,
      };

      if (person) {
        await updatePerson(person.id, personData);
        toast.success('Pessoa atualizada com sucesso!');
      } else {
        const savedPerson = await addPerson(personData);

        // Se tem email e é interno, enviar convite
        if (data.email && data.type === 'internal') {
          try {
            const { error: inviteError } = await supabase.functions.invoke('invite-participant', {
              body: {
                personId: savedPerson.id,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName || '',
              }
            });

            if (inviteError) {
              console.error('Erro ao enviar convite:', inviteError);
              toast.success('Pessoa criada! Convite não pôde ser enviado.');
            } else {
              toast.success('Pessoa cadastrada e convite enviado!');
            }
          } catch (inviteErr) {
            console.error('Erro ao enviar convite:', inviteErr);
            toast.success('Pessoa criada! Erro ao enviar convite.');
          }
        } else {
          toast.success('Pessoa criada com sucesso!');
        }
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving person:', error);
      toast.error('Erro ao salvar pessoa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedFirstName = form.watch('firstName') || '';
  const watchedLastName = form.watch('lastName') || '';
  const watchedName = `${watchedFirstName} ${watchedLastName}`.trim() || 'Nome';
  const watchedColor = form.watch('color');
  const watchedType = form.watch('type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 text-pink-600 dark:text-pink-400">
              {person ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg">{person ? 'Editar Pessoa' : 'Nova Pessoa'}</DialogTitle>
              <DialogDescription>
                {person ? 'Atualize as informações da pessoa' : 'Preencha os dados para adicionar uma nova pessoa'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <AvatarCircle
                name={watchedName}
                color={watchedColor}
                size="xl"
                avatarUrl={avatarUrl}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              {avatarUrl && !isUploadingAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-white hover:bg-destructive/80 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Clique para adicionar uma foto
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Primeiro nome *</Label>
              <Input
                id="firstName"
                {...form.register('firstName')}
                placeholder="João"
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                {...form.register('lastName')}
                placeholder="Silva"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email {watchedType === 'internal' && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="email"
              type="email"
              {...form.register('email')}
              placeholder="email@exemplo.com"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
            {watchedType === 'internal' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Send className="w-3 h-3" />
                Um convite de acesso será enviado por email
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select
              value={form.watch('type')}
              onValueChange={(value: PersonFormData['type']) => form.setValue('type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Interno</SelectItem>
                <SelectItem value="partner">Parceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => form.setValue('color', color.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    form.watch('color') === color.value
                      ? 'border-foreground scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploadingAvatar} className="gradient-primary text-white">
              {isSubmitting ? 'Salvando...' : person ? 'Atualizar' : 'Criar Pessoa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
