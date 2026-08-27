import { useState, useRef, useEffect } from 'react';
import { logAuditEvent } from '@/lib/auditLog';
import {
  Sun,
  Moon,
  Download,
  Upload,
  Database,
  Lock,
  Save,
  FileSpreadsheet,
  Loader2,
  User,
  Mail,
  Palette,
  Camera,
  CreditCard,
  AlertTriangle,
  Calendar,
  ExternalLink,
  XCircle,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Turnstile, type TurnstileHandle } from '@/components/auth/Turnstile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const Settings = () => {
  const { toast } = useToast();
  const { user, profile, updateProfile, refreshProfile, subscription, refreshSubscription, isAdmin } = useAuth();
  const { projects, tasks, people, cells, phases, customColumns } = useData();
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // IA / OpenAI key
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  // CAPTCHA para trocar senha
  const [changePwCaptcha, setChangePwCaptcha] = useState<string | null>(null);
  const changePwCaptchaRef = useRef<TurnstileHandle>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('user_ai_settings')
        .select('openai_key')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active && data?.openai_key) setOpenaiKey(data.openai_key);
    })();
    return () => { active = false; };
  }, [user]);

  const handleSaveKey = async () => {
    if (!user) return;
    setIsSavingKey(true);
    try {
      const { error } = await supabase
        .from('user_ai_settings')
        .upsert({ user_id: user.id, openai_key: openaiKey.trim() || null, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast({ title: 'Chave salva', description: 'A chave da OpenAI foi salva com sucesso.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível salvar a chave.', variant: 'destructive' });
    } finally {
      setIsSavingKey(false);
    }
  };

  // Sync fullName with profile when it changes
  useState(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  });

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
    toast({
      title: 'Tema alterado',
      description: `Modo ${!isDarkMode ? 'escuro' : 'claro'} ativado.`,
    });
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const { error } = await updateProfile({ full_name: fullName });
      if (error) throw error;
      
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar o perfil.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione uma imagem válida.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: profileError } = await updateProfile({ avatar_url: `${publicUrl}?t=${Date.now()}` });
      if (profileError) throw profileError;

      toast({
        title: 'Foto atualizada',
        description: 'Sua foto de perfil foi alterada com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar foto',
        description: error.message || 'Não foi possível enviar a foto.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleExportExcel = () => {
    const activeCustomColumns = customColumns.filter(c => c.active);
    const baseHeaders = ['Nome', 'Projeto', 'Fase', 'Responsável', 'Status', 'Prioridade', 'Progresso'];
    const customHeaders = activeCustomColumns.map(c => c.name);
    const headers = [...baseHeaders, ...customHeaders];
    
    const rows = tasks.map(task => {
      const project = projects.find(p => p.id === task.projectId);
      const phase = phases.find(p => p.id === task.phaseId);
      const responsibleNames = task.responsibleIds?.map(id => people.find(p => p.id === id)?.name).filter(Boolean).join(', ') || '';
      const progress = task.quantity ? Math.round((task.collected || 0) / task.quantity * 100) : 0;
      
      const baseValues = [
        `"${task.name}"`,
        `"${project?.name || ''}"`,
        `"${phase?.name || ''}"`,
        `"${responsibleNames}"`,
        task.status,
        task.priority,
        `${progress}%`
      ];
      
      const customValues = activeCustomColumns.map(col => {
        const value = task.customValues?.[col.id];
        if (value === undefined || value === '') return '';
        if (col.type === 'user') {
          const user = people.find(p => p.id === value);
          return `"${user?.name || ''}"`;
        }
        if (col.type === 'date') {
          return new Date(value as string).toLocaleDateString('pt-BR');
        }
        return typeof value === 'string' ? `"${value}"` : value;
      });
      
      return [...baseValues, ...customValues].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarefas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    toast({
      title: 'Exportação concluída',
      description: 'Os dados foram exportados com sucesso.',
    });
  };

  const handleBackup = () => {
    const data = {
      projects,
      tasks,
      people,
      cells,
      phases,
      customColumns,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    toast({
      title: 'Backup realizado',
      description: 'O backup foi baixado com sucesso.',
    });
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string);
            toast({
              title: 'Restauração concluída',
              description: 'Os dados foram restaurados com sucesso.',
            });
          } catch (error) {
            toast({
              title: 'Erro na restauração',
              description: 'O arquivo de backup é inválido.',
              variant: 'destructive',
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken: changePwCaptcha ?? undefined,
      });

      if (error) throw error;

      changePwCaptchaRef.current?.reset();
      setChangePwCaptcha(null);

      await logAuditEvent({
        action: 'password_reset_request',
        level: 'info',
        details: 'Solicitação de redefinição de senha enviada',
      });

      toast({
        title: 'Email enviado',
        description: 'Verifique seu email para redefinir sua senha.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar email',
        description: error.message || 'Não foi possível enviar o email de recuperação.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');

      if (error) throw error;

      await logAuditEvent({
        action: 'subscription_canceled',
        entity_type: 'subscription',
        level: 'warning',
        details: data.message || 'Assinatura cancelada pelo usuário',
      });

      toast({
        title: 'Assinatura cancelada',
        description: data.message,
      });

      // Refresh subscription data
      await refreshSubscription();
    } catch (error: any) {
      toast({
        title: 'Erro ao cancelar',
        description: error.message || 'Não foi possível cancelar a assinatura.',
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setIsReactivating(true);
    try {
      const { data, error } = await supabase.functions.invoke('reactivate-subscription');

      if (error) throw error;

      await logAuditEvent({
        action: 'subscription_updated',
        entity_type: 'subscription',
        level: 'success',
        details: 'Assinatura reativada pelo usuário',
      });

      toast({
        title: 'Assinatura reativada',
        description: data.message,
      });

      await refreshSubscription();
    } catch (error: any) {
      toast({
        title: 'Erro ao reativar',
        description: error.message || 'Não foi possível reativar a assinatura.',
        variant: 'destructive',
      });
    } finally {
      setIsReactivating(false);
    }
  };

  const handleOpenPortal = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao abrir portal',
        description: error.message || 'Não foi possível abrir o portal de pagamentos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusBadge = () => {
    if (isAdmin) {
      return <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Admin</span>;
    }
    if (!subscription) {
      return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Sem assinatura</span>;
    }
    if (subscription.cancel_at_period_end) {
      return <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Cancela em breve</span>;
    }
    switch (subscription.status) {
      case 'active':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Ativo</span>;
      case 'trialing':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Período de teste</span>;
      case 'canceled':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Cancelado</span>;
      case 'past_due':
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Pagamento pendente</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Inativo</span>;
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';

  return (
    <MainLayout>
      <Header title="Configurações" subtitle="Gerencie sua conta e preferências" />
      
      <div className="p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Assinatura
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="w-4 h-4" />
              IA
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="w-4 h-4" />
              Aparência
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <Database className="w-4 h-4" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Lock className="w-4 h-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profile Info & Avatar */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Foto e Nome
                </h3>
                <div className="space-y-6">
                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center overflow-hidden border-4 border-background shadow-lg">
                        {profile?.avatar_url ? (
                          <img 
                            src={profile.avatar_url} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-10 h-10 text-primary-foreground" />
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <Camera className="w-6 h-6 text-white" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{displayName}</p>
                      <p className="text-sm text-muted-foreground">Clique na foto para alterar</p>
                    </div>
                  </div>

                  {/* Name Edit */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>

                  {/* Email (readonly) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{user?.email}</span>
                    </div>
                  </div>

                  <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full">
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4">Estatísticas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">{projects.length}</p>
                    <p className="text-sm text-muted-foreground">Projetos</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-500">{tasks.length}</p>
                    <p className="text-sm text-muted-foreground">Tarefas</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-500">{tasks.filter(t => t.status === 'completed').length}</p>
                    <p className="text-sm text-muted-foreground">Concluídas</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-500">{people.length}</p>
                    <p className="text-sm text-muted-foreground">Pessoas</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Membro desde: {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Subscription Info */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Detalhes da Assinatura
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    {getStatusBadge()}
                  </div>

                  {subscription && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Plano</span>
                        <span className="font-medium">Tarefaa Pro</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Período atual</span>
                        <span className="text-sm">
                          {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                        </span>
                      </div>
                      {subscription.cancel_at_period_end && (
                        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                              <p className="font-medium text-amber-800 dark:text-amber-200">
                                Cancelamento agendado
                              </p>
                              <p className="text-amber-700 dark:text-amber-300">
                                Sua assinatura será cancelada em {formatDate(subscription.current_period_end)}.
                                Você pode continuar usando até essa data.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
                                onClick={handleReactivateSubscription}
                                disabled={isReactivating}
                              >
                                {isReactivating ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Reativando...
                                  </>
                                ) : (
                                  'Manter assinatura'
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {isAdmin && !subscription && (
                    <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        Você tem acesso administrativo ao sistema.
                      </p>
                    </div>
                  )}

                  {!subscription && !isAdmin && (
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-muted-foreground">Você não possui uma assinatura ativa.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Subscription Actions */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Gerenciar Assinatura
                </h3>
                <div className="space-y-4">
                  {subscription?.stripe_customer_id && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Portal de Pagamentos</p>
                        <p className="text-sm text-muted-foreground">Atualizar cartão, ver faturas</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleOpenPortal}
                        disabled={isLoadingPortal}
                      >
                        {isLoadingPortal ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Abrir Portal
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {subscription && (subscription.status === 'active' || subscription.status === 'trialing') && !subscription.cancel_at_period_end && (
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-red-600 dark:text-red-400">Cancelar Assinatura</p>
                          <p className="text-sm text-muted-foreground">Você poderá usar até o fim do período</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancelar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sua assinatura será cancelada ao final do período atual
                                ({formatDate(subscription.current_period_end)}).
                                Você poderá continuar usando o Tarefaa até essa data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleCancelSubscription}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={isCancelling}
                              >
                                {isCancelling ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Cancelando...
                                  </>
                                ) : (
                                  'Sim, cancelar'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}

                  {!subscription && !isAdmin && (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-4">
                        Assine o Tarefaa para gerenciar seus projetos e tarefas.
                      </p>
                      <Button asChild>
                        <a href="/">Ver planos</a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-soft max-w-2xl">
              <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Inteligência Artificial
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Usada para gerar as atas de reunião a partir das transcrições (aba Anotações → ATA de Reuniões).
              </p>

              <div className="space-y-2">
                <Label htmlFor="openai-key" className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Chave da API OpenAI
                </Label>
                <div className="relative">
                  <Input
                    id="openai-key"
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="pr-10 font-mono text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showKey ? 'Ocultar' : 'Mostrar'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  A chave fica guardada com segurança e nunca é exposta no navegador de outros usuários.
                  Modelo utilizado: <span className="font-medium">gpt-4o</span>. Crie sua chave em{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">
                    platform.openai.com/api-keys
                  </a>.
                </p>
              </div>

              <Button onClick={handleSaveKey} disabled={isSavingKey} className="mt-4">
                {isSavingKey ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Salvar chave</>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  Tema
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Modo Escuro</p>
                    <p className="text-sm text-muted-foreground">Alterne entre o tema claro e escuro</p>
                  </div>
                  <Switch checked={isDarkMode} onCheckedChange={toggleTheme} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Exportação
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Exportar para Excel</p>
                    <p className="text-sm text-muted-foreground">Baixe todas as tarefas em formato CSV</p>
                  </div>
                  <Button onClick={handleExportExcel}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Backup
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Fazer Backup</p>
                      <p className="text-sm text-muted-foreground">Baixe todos os dados</p>
                    </div>
                    <Button variant="outline" onClick={handleBackup}>
                      <Download className="w-4 h-4 mr-2" />
                      Backup
                    </Button>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <p className="font-medium">Restaurar Backup</p>
                      <p className="text-sm text-muted-foreground">Restaure de um arquivo</p>
                    </div>
                    <Button variant="outline" onClick={handleRestore}>
                      <Upload className="w-4 h-4 mr-2" />
                      Restaurar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Alterar Senha
                </h3>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Para alterar sua senha, enviaremos um link de verificação para o seu email <span className="font-medium text-foreground">{user?.email}</span>.
                  </p>
                  <Turnstile
                    ref={changePwCaptchaRef}
                    action="change_password"
                    onVerify={setChangePwCaptcha}
                    onExpire={() => setChangePwCaptcha(null)}
                  />
                  <Button onClick={handleChangePassword} className="w-full" disabled={isChangingPassword}>
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar link de redefinição
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Settings;