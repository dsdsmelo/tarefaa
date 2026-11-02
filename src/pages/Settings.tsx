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
  KeyRound,
  BriefcaseBusiness,
  UserRound,
  Trash2,
  Plus,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageBody } from '@/components/layout/PageBody';
import { Panel } from '@/components/ui/panel';
import { InfoList, InfoRow } from '@/components/ui/info-list';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/useTheme';
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
  const { projects, tasks, people, cells, phases, customColumns, workspaces, activeWorkspace, workspaceProjectCounts, addWorkspace, deleteWorkspace, setActiveWorkspace } = useData();
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceKind, setWorkspaceKind] = useState<'personal' | 'corporate'>('corporate');
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<typeof workspaces[number] | null>(null);

  // IA / OpenAI key — write-only: o cliente nunca lê o valor da chave
  const [openaiKey, setOpenaiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  // CAPTCHA para trocar senha
  const [changePwCaptcha, setChangePwCaptcha] = useState<string | null>(null);
  const changePwCaptchaRef = useRef<TurnstileHandle>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase.rpc('has_openai_key');
      if (active) setHasKey(!!data);
    })();
    return () => { active = false; };
  }, [user]);

  const handleSaveKey = async () => {
    if (!user) return;
    setIsSavingKey(true);
    try {
      const { error } = await supabase.rpc('set_openai_key', { p_key: openaiKey.trim() });
      if (error) throw error;
      setHasKey(!!openaiKey.trim());
      setOpenaiKey('');
      toast({ title: 'Chave salva', description: 'A chave da OpenAI foi salva com sucesso.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível salvar a chave.', variant: 'destructive' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleCreateWorkspace = async () => {
    const name = workspaceName.trim();
    if (!name) {
      toast({ title: 'Nome obrigatório', description: 'Informe o nome do workspace.', variant: 'destructive' });
      return;
    }
    setIsSavingWorkspace(true);
    try {
      const workspace = await addWorkspace({
        name,
        kind: workspaceKind,
        color: workspaceKind === 'personal' ? '#2563EB' : '#7C3AED',
      });
      setWorkspaceName('');
      await setActiveWorkspace(workspace.id);
      toast({ title: 'Workspace criado', description: `Você está no workspace ${workspace.name}.` });
    } catch (err: any) {
      toast({ title: 'Erro ao criar workspace', description: err.message || 'Não foi possível criar o workspace.', variant: 'destructive' });
    } finally {
      setIsSavingWorkspace(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    try {
      await deleteWorkspace(workspaceToDelete.id);
      toast({ title: 'Workspace excluído', description: 'O workspace vazio foi removido.' });
      setWorkspaceToDelete(null);
    } catch (err: any) {
      toast({
        title: 'Não foi possível excluir',
        description: err.message?.includes('projects_workspace_id_fkey')
          ? 'Mova os projetos deste workspace antes de excluí-lo.'
          : (err.message || 'Não foi possível excluir o workspace.'),
        variant: 'destructive',
      });
    }
  };

  // Sync fullName with profile when it changes
  useState(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  });

  const toggleTheme = () => {
    setTheme(isDarkMode ? 'light' : 'dark');
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
      return <Badge variant="default">Admin</Badge>;
    }
    if (!subscription) {
      return <Badge variant="secondary">Sem assinatura</Badge>;
    }
    if (subscription.cancel_at_period_end) {
      return <Badge variant="warning">Cancela em breve</Badge>;
    }
    switch (subscription.status) {
      case 'active':
        return <Badge variant="success">Ativo</Badge>;
      case 'trialing':
        return <Badge variant="outline">Período de teste</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Pagamento pendente</Badge>;
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';

  return (
    <MainLayout>
      <Header title="Configurações" subtitle="Gerencie sua conta e preferências" />

      <PageBody>
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="subscription">
              <CreditCard className="w-4 h-4" />
              Assinatura
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="w-4 h-4" />
              IA
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="w-4 h-4" />
              Aparência
            </TabsTrigger>
            <TabsTrigger value="data">
              <Database className="w-4 h-4" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="workspaces">
              <BriefcaseBusiness className="w-4 h-4" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="w-4 h-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Profile Info & Avatar */}
              <Panel icon={User} title="Foto e Nome" bodyClassName="p-5">
                <div className="space-y-4">
                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center overflow-hidden border border-border">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-8 h-8 text-primary-foreground" />
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : (
                          <Camera className="w-5 h-5 text-white" />
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
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground">Clique na foto para alterar</p>
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
                  <InfoList>
                    <InfoRow label="Email" value={user?.email} />
                  </InfoList>

                  <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full">
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>
              </Panel>

              {/* Stats */}
              <Panel title="Estatísticas" bodyClassName="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Projetos</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">{projects.length}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Tarefas</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">{tasks.length}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Concluídas</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">{tasks.filter(t => t.status === 'completed').length}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Pessoas</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">{people.length}</p>
                  </div>
                </div>
                <InfoList className="mt-3">
                  <InfoRow
                    label="Membro desde"
                    value={user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}
                  />
                </InfoList>
              </Panel>
            </div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Subscription Info */}
              <Panel icon={CreditCard} title="Detalhes da Assinatura" bodyClassName="p-5">
                <div className="space-y-3">
                  <InfoList>
                    <InfoRow label="Status" value={getStatusBadge()} />
                    {subscription && (
                      <>
                        <InfoRow label="Plano" value="Tarefaa Pro" />
                        <InfoRow
                          label="Período atual"
                          value={`${formatDate(subscription.current_period_start)} - ${formatDate(subscription.current_period_end)}`}
                        />
                      </>
                    )}
                  </InfoList>

                  {subscription?.cancel_at_period_end && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
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
                            className="mt-2"
                            onClick={handleReactivateSubscription}
                            disabled={isReactivating}
                          >
                            {isReactivating ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
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

                  {isAdmin && !subscription && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-sm text-muted-foreground">
                        Você tem acesso administrativo ao sistema.
                      </p>
                    </div>
                  )}

                  {!subscription && !isAdmin && (
                    <div className="rounded-lg bg-muted/40 p-4 text-center">
                      <p className="text-sm text-muted-foreground">Você não possui uma assinatura ativa.</p>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Subscription Actions */}
              <Panel icon={Calendar} title="Gerenciar Assinatura" bodyClassName="p-5">
                <div className="space-y-4">
                  {subscription?.stripe_customer_id && (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">Portal de Pagamentos</p>
                        <p className="text-xs text-muted-foreground">Atualizar cartão, ver faturas</p>
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
                            <ExternalLink className="w-4 h-4" />
                            Abrir Portal
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {subscription && (subscription.status === 'active' || subscription.status === 'trialing') && !subscription.cancel_at_period_end && (
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-destructive">Cancelar Assinatura</p>
                          <p className="text-xs text-muted-foreground">Você poderá usar até o fim do período</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <XCircle className="w-4 h-4" />
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
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={isCancelling}
                              >
                                {isCancelling ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
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
                      <p className="text-sm text-muted-foreground mb-4">
                        Assine o Tarefaa para gerenciar seus projetos e tarefas.
                      </p>
                      <Button asChild>
                        <a href="/">Ver planos</a>
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai">
            <Panel
              icon={Sparkles}
              title="Inteligência Artificial"
              className="max-w-2xl"
              bodyClassName="p-5"
            >
              <p className="text-sm text-muted-foreground mb-4">
                Usada para gerar as atas de reunião a partir das transcrições (aba Anotações → ATA de Reuniões).
              </p>

              <div className="space-y-2">
                <Label htmlFor="openai-key" className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Chave da API OpenAI
                  {hasKey && (
                    <span className={cn(badgeVariants({ variant: 'success' }), 'ml-1')}>
                      <Sparkles className="w-3 h-3" /> configurada
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="openai-key"
                    type={showKey ? 'text' : 'password'}
                    placeholder={hasKey ? '•••••••••••• (deixe em branco para manter)' : 'sk-...'}
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
                  A chave é <strong>write-only</strong>: fica guardada com segurança no servidor e nunca
                  é devolvida ao navegador. Modelo utilizado: <span className="font-medium font-mono">gpt-4o</span>. Crie sua chave em{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">
                    platform.openai.com/api-keys
                  </a>.
                </p>
              </div>

              <Button onClick={handleSaveKey} disabled={isSavingKey} className="mt-4">
                {isSavingKey ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="w-4 h-4" /> Salvar chave</>
                )}
              </Button>
            </Panel>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel icon={isDarkMode ? Moon : Sun} title="Tema" bodyClassName="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Modo Escuro</p>
                    <p className="text-xs text-muted-foreground">Alterne entre o tema claro e escuro</p>
                  </div>
                  <Switch checked={isDarkMode} onCheckedChange={toggleTheme} />
                </div>
              </Panel>
            </div>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel icon={FileSpreadsheet} title="Exportação" bodyClassName="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Exportar para Excel</p>
                    <p className="text-xs text-muted-foreground">Baixe todas as tarefas em formato CSV</p>
                  </div>
                  <Button onClick={handleExportExcel}>
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                </div>
              </Panel>

              <Panel icon={Database} title="Backup" bodyClassName="p-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Fazer Backup</p>
                      <p className="text-xs text-muted-foreground">Baixe todos os dados</p>
                    </div>
                    <Button variant="outline" onClick={handleBackup}>
                      <Download className="w-4 h-4" />
                      Backup
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-sm font-medium">Restaurar Backup</p>
                      <p className="text-xs text-muted-foreground">Restaure de um arquivo</p>
                    </div>
                    <Button variant="outline" onClick={handleRestore}>
                      <Upload className="w-4 h-4" />
                      Restaurar
                    </Button>
                  </div>
                </div>
              </Panel>
            </div>
          </TabsContent>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
              <Panel
                icon={BriefcaseBusiness}
                title="Seus workspaces"
                description="Projetos, tarefas e métricas não são misturados entre workspaces."
                actions={activeWorkspace && <Badge variant="default" className="whitespace-nowrap">Atual: {activeWorkspace.name}</Badge>}
              >
                <div className="divide-y divide-border">
                  {workspaces.map((workspace) => {
                    const projectCount = workspaceProjectCounts[workspace.id] || 0;
                    const isCurrent = workspace.id === activeWorkspace?.id;
                    return (
                      <div key={workspace.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: workspace.color }} />
                        {workspace.kind === 'personal' ? <UserRound className="w-4 h-4 text-muted-foreground" /> : <BriefcaseBusiness className="w-4 h-4 text-muted-foreground" />}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{workspace.name}</p>
                          <p className="text-xs text-muted-foreground">{workspace.kind === 'personal' ? 'Pessoal' : 'Corporativo'} · <span className="tabular-nums">{projectCount}</span> {projectCount === 1 ? 'projeto' : 'projetos'}</p>
                        </div>
                        {!isCurrent && <Button variant="outline" size="sm" onClick={() => void setActiveWorkspace(workspace.id)}>Abrir</Button>}
                        {!workspace.isDefault && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setWorkspaceToDelete(workspace)} title="Excluir workspace vazio">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel
                icon={Plus}
                title="Novo workspace"
                className="h-fit"
                bodyClassName="p-5"
              >
                <p className="text-sm text-muted-foreground mb-4">Crie um workspace por empresa, cliente ou contexto pessoal que precise separar.</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspaceName">Nome</Label>
                    <Input id="workspaceName" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Ex: Acme Ltda." maxLength={80} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspaceKind">Tipo</Label>
                    <select id="workspaceKind" value={workspaceKind} onChange={(event) => setWorkspaceKind(event.target.value as 'personal' | 'corporate')} className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <option value="corporate">Corporativo</option>
                      <option value="personal">Pessoal</option>
                    </select>
                  </div>
                  <Button className="w-full" onClick={handleCreateWorkspace} disabled={isSavingWorkspace}>
                    <Plus className="w-4 h-4" />
                    {isSavingWorkspace ? 'Criando...' : 'Criar workspace'}
                  </Button>
                </div>
              </Panel>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel icon={Lock} title="Alterar Senha" bodyClassName="p-5">
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
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Enviar link de redefinição
                      </>
                    )}
                  </Button>
                </div>
              </Panel>
            </div>
          </TabsContent>
        </Tabs>
      </PageBody>

      <AlertDialog open={!!workspaceToDelete} onOpenChange={(open) => !open && setWorkspaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              O workspace "{workspaceToDelete?.name}" só poderá ser excluído se estiver vazio. Projetos não serão apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkspace} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Settings;
