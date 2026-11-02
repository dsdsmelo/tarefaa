import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  GanttChart,
  Users,
  Vault,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  BriefcaseBusiness,
  UserRound,
  ChevronsUpDown,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useTheme } from '@/hooks/useTheme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

// Logo imports
import logoIcon from '@/assets/logo-tarefaa-icone.webp';

const navGroups = [
  {
    label: 'Gestão',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: FolderKanban, label: 'Projetos', path: '/projects' },
      { icon: GanttChart, label: 'Gantt', path: '/gantt' },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { icon: Users, label: 'Pessoas', path: '/people' },
      { icon: Vault, label: 'Cofre', path: '/vault' },
    ],
  },
  {
    label: 'Configuração',
    items: [
      { icon: Settings, label: 'Configurações', path: '/settings' },
    ],
  },
];

export const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useData();
  const { theme, setTheme } = useTheme();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  // Mantém o item ativo também nas subrotas (ex.: /projects/:id)
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  // Nome na ordem de melhor fonte disponível:
  // perfil -> metadados do convite/cadastro -> (último recurso) prefixo do e-mail
  const meta = (user?.user_metadata ?? {}) as { first_name?: string; full_name?: string; name?: string };
  const displayName =
    profile?.full_name?.trim() ||
    meta.full_name?.trim() ||
    meta.first_name?.trim() ||
    meta.name?.trim() ||
    user?.email?.split('@')[0] ||
    'Usuário';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const handleWorkspaceChange = async (workspaceId: string) => {
    try {
      await setActiveWorkspace(workspaceId);
    } catch (error) {
      console.error('Erro ao trocar workspace:', error);
    }
  };

  const avatar = (
    <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center overflow-hidden shrink-0 text-xs font-semibold text-primary-foreground">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
      ) : (
        initials || <UserRound className="w-4 h-4" />
      )}
    </div>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn(
          "flex items-center py-2.5",
          isCollapsed ? "flex-col gap-2 px-0" : "justify-between px-2"
        )}>
          <div className="flex items-center gap-2.5">
            <img src={logoIcon} alt="Tarefaa" className="w-8 h-8 object-contain" />
            {!isCollapsed && (
              <span className="font-bold text-lg tracking-tight text-foreground">Tarefaa</span>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
            title={isCollapsed ? 'Expandir menu (Cmd+B)' : 'Recolher menu (Cmd+B)'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {!isCollapsed && activeWorkspace && (
          <div className="px-1 pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 rounded-lg border border-sidebar-border bg-card px-2.5 py-1.5 text-left hover:border-primary/40 transition-colors">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeWorkspace.color }}
                  />
                  {activeWorkspace.kind === 'personal' ? (
                    <UserRound className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <BriefcaseBusiness className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{activeWorkspace.name}</span>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces.map((workspace) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    onClick={() => handleWorkspaceChange(workspace.id)}
                    className={cn(workspace.id === activeWorkspace.id && 'bg-accent')}
                  >
                    <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: workspace.color }} />
                    {workspace.kind === 'personal' ? <UserRound className="w-4 h-4 mr-2" /> : <BriefcaseBusiness className="w-4 h-4 mr-2" />}
                    <span className="truncate">{workspace.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Gerenciar workspaces
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="py-1">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            {!isCollapsed && (
              <SidebarGroupLabel className="h-7 px-2 text-xs font-semibold text-sidebar-foreground/55">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.path)}
                      tooltip={item.label}
                      className={cn(
                        "h-9 rounded-lg transition-colors",
                        isActive(item.path)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <NavLink to={item.path}>
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer: usuário + tema */}
      <SidebarFooter className="border-t border-sidebar-border p-2 gap-2">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            {avatar}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
              title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={signOut}
              className="p-2 rounded-md text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 px-1 py-1">
              {avatar}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={signOut}
                className="p-1.5 rounded-md text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-sidebar-accent/40 p-1">
              {([
                { value: 'light', label: 'Claro', icon: Sun },
                { value: 'dark', label: 'Escuro', icon: Moon },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors",
                    theme === option.value
                      ? "bg-card text-foreground font-medium shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <option.icon className="w-3.5 h-3.5" />
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};
