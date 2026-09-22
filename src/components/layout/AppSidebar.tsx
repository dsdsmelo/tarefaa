import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  GanttChart,
  Users,
  Vault,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  BriefcaseBusiness,
  UserRound,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
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
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

// Logo imports
import logoIcon from '@/assets/logo-tarefaa-icone.webp';

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: FolderKanban, label: 'Projetos', path: '/projects' },
  { icon: GanttChart, label: 'Gantt', path: '/gantt' },
  { icon: Users, label: 'Pessoas', path: '/people' },
  { icon: Vault, label: 'Cofre', path: '/vault' },
];

const settingsNavItems = [
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

export const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useData();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => location.pathname === path;

  const handleWorkspaceChange = async (workspaceId: string) => {
    try {
      await setActiveWorkspace(workspaceId);
    } catch (error) {
      console.error('Erro ao trocar workspace:', error);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn(
          "flex items-center py-3 transition-all duration-200",
          isCollapsed ? "justify-center px-1" : "justify-between px-3"
        )}>
          <div className="flex items-center gap-3">
            {/* Logo */}
            <img
              src={logoIcon}
              alt="Tarefaa"
              className={cn(
                "object-contain transition-all duration-300",
                isCollapsed ? "w-8 h-8" : "w-10 h-10"
              )}
            />
            {/* Brand Name - visible when expanded */}
            {!isCollapsed && (
              <span className="font-bold text-xl text-gradient animate-fade-in">
                Tarefaa
              </span>
            )}
          </div>
          {/* Collapse Toggle Button - only when expanded */}
          {!isCollapsed && (
            <button
              onClick={toggleSidebar}
              className={cn(
                "p-1.5 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent hover:scale-105",
                "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
              title="Recolher sidebar (Cmd+B)"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Expand button when collapsed - centered below logo */}
        {isCollapsed && (
          <div className="flex justify-center pb-2">
            <button
              onClick={toggleSidebar}
              className={cn(
                "p-1 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent hover:scale-105",
                "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
              title="Expandir sidebar (Cmd+B)"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isCollapsed && activeWorkspace && (
          <div className="px-2 pb-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 text-left hover:bg-sidebar-accent transition-colors">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeWorkspace.color }}
                  />
                  {activeWorkspace.kind === 'personal' ? (
                    <UserRound className="w-3.5 h-3.5 text-sidebar-foreground/70" />
                  ) : (
                    <BriefcaseBusiness className="w-3.5 h-3.5 text-sidebar-foreground/70" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{activeWorkspace.name}</span>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-sidebar-foreground/60" />
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

      {/* Main Navigation */}
      <SidebarContent className="py-2">
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-1">
              Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                    className={cn(
                      "group relative transition-all duration-200",
                      isActive(item.path) && [
                        "bg-sidebar-primary/15",
                        "text-sidebar-primary",
                        "font-medium",
                        "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                        "before:w-1 before:h-6 before:rounded-r-full before:bg-sidebar-primary",
                        "shadow-soft"
                      ],
                      !isActive(item.path) && [
                        "text-sidebar-foreground/70",
                        "hover:bg-sidebar-accent",
                        "hover:text-sidebar-foreground",
                        "hover:scale-[1.02]",
                        "hover:shadow-soft"
                      ]
                    )}
                  >
                    <NavLink to={item.path}>
                      <item.icon className={cn(
                        "w-5 h-5 transition-all duration-200",
                        isActive(item.path) && "text-sidebar-primary"
                      )} />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-3" />

        {/* Settings Group */}
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-1">
              Sistema
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                    className={cn(
                      "group relative transition-all duration-200",
                      isActive(item.path) && [
                        "bg-sidebar-primary/15",
                        "text-sidebar-primary",
                        "font-medium",
                        "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                        "before:w-1 before:h-6 before:rounded-r-full before:bg-sidebar-primary",
                        "shadow-soft"
                      ],
                      !isActive(item.path) && [
                        "text-sidebar-foreground/70",
                        "hover:bg-sidebar-accent",
                        "hover:text-sidebar-foreground",
                        "hover:scale-[1.02]",
                        "hover:shadow-soft"
                      ]
                    )}
                  >
                    <NavLink to={item.path}>
                      <item.icon className={cn(
                        "w-5 h-5 transition-all duration-200",
                        isActive(item.path) && "text-sidebar-primary"
                      )} />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Logout only */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              onClick={signOut}
              className={cn(
                "w-full transition-all duration-200",
                "text-sidebar-foreground/70",
                "hover:bg-destructive/15 hover:text-destructive",
                "hover:scale-[1.02]"
              )}
            >
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
