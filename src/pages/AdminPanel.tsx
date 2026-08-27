import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminStatsCards } from '@/components/admin/AdminStatsCards';
import { AdminUsersTab, UserWithSubscription } from '@/components/admin/AdminUsersTab';
import { AdminLogsTab } from '@/components/admin/AdminLogsTab';
import { AdminInfraTab } from '@/components/admin/AdminInfraTab';
import { PasswordChangeCard } from '@/components/admin/PasswordChangeCard';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck } from 'lucide-react';

const AdminPanel = () => {
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [adminEmail, setAdminEmail] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    trialUsers: 0,
    canceledUsers: 0,
    revenue: 0,
    newUsersThisMonth: 0,
    churnRate: 0,
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, aalCurrent, mfaChecked, subscriptionChecked, isLoading: authLoading } = useAuth();

  // Gate real: sessão válida + papel admin + 2FA (AAL2). Sem sessionStorage.
  useEffect(() => {
    if (authLoading || !mfaChecked || !subscriptionChecked) return; // aguarda checagens
    if (!isAuthenticated || !isAdmin || aalCurrent !== 'aal2') {
      navigate('/admin/login');
      return;
    }
    setAdminEmail(user?.email ?? '');
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, mfaChecked, subscriptionChecked, isAuthenticated, isAdmin, aalCurrent]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: 'Logout realizado',
      description: 'Você saiu do painel administrativo.',
    });
    navigate('/admin/login');
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Use edge function to bypass RLS and fetch all users
      const { data, error } = await supabase.functions.invoke('admin-get-users');

      if (error) throw error;

      const usersWithSubs: UserWithSubscription[] = data.users || [];
      setUsers(usersWithSubs);

      // Calculate stats
      const activeCount = usersWithSubs.filter(u => u.subscription?.status === 'active').length;
      const trialCount = usersWithSubs.filter(u => u.subscription?.status === 'trialing').length;
      const canceledCount = usersWithSubs.filter(u => u.subscription?.status === 'canceled').length;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const newThisMonth = usersWithSubs.filter(u => new Date(u.created_at) >= startOfMonth).length;

      const churnRate = activeCount + canceledCount > 0
        ? (canceledCount / (activeCount + canceledCount)) * 100
        : 0;

      setStats({
        totalUsers: usersWithSubs.length,
        activeSubscriptions: activeCount,
        trialUsers: trialCount,
        canceledUsers: canceledCount,
        revenue: activeCount * 69,
        newUsersThisMonth: newThisMonth,
        churnRate,
      });

    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados do admin.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <AdminStatsCards stats={stats} />
            <AdminUsersTab users={users} isLoading={isLoading} onRefresh={fetchUsers} />
          </div>
        );
      case 'users':
        return <AdminUsersTab users={users} isLoading={isLoading} onRefresh={fetchUsers} />;
      case 'logs':
        return <AdminLogsTab />;
      case 'infra':
        return <AdminInfraTab />;
      case 'security':
        return (
          <div className="space-y-6">
            <PasswordChangeCard userEmail={adminEmail} />
            <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Autenticação em duas etapas (2FA)
              </h3>
              <p className="text-sm text-muted-foreground">
                O 2FA é <strong>nativo e obrigatório</strong>: todo acesso ao painel exige a verificação
                em duas etapas (você já a completou para entrar aqui). Para redefinir o 2FA de um usuário
                que perdeu o autenticador, remova o fator MFA dele no Supabase → Authentication → Users.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onRefresh={fetchUsers}
          onLogout={handleLogout}
          isLoading={isLoading}
        />
        
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header with trigger */}
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4 px-4 py-3">
              <SidebarTrigger />
              <div>
                <h2 className="font-semibold">
                  {activeTab === 'overview' && 'Visão Geral'}
                  {activeTab === 'users' && 'Clientes'}
                  {activeTab === 'logs' && 'Logs de Auditoria'}
                  {activeTab === 'infra' && 'Infraestrutura'}
                  {activeTab === 'security' && 'Segurança'}
                </h2>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-6 overflow-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminPanel;
