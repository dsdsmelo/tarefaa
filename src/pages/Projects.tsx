import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Trash2,
  Eye
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageBody } from '@/components/layout/PageBody';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ProjectFormModal } from '@/components/modals/ProjectFormModal';
import { ProjectAvatar, ProjectStatusBadge } from '@/components/projects/ProjectIdentity';
import { useData } from '@/contexts/DataContext';
import { calculatePercentage } from '@/lib/mockData';
import { Project } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Link, useNavigate } from 'react-router-dom';

// "2026-09-03" -> "03 set"
const formatShortDate = (iso: string) =>
  new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

const Projects = () => {
  const navigate = useNavigate();
  const { projects = [], tasks = [], phases = [], deleteProject, loading, error } = useData();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // Ensure arrays are always defined
  const safeProjects = projects || [];
  const safeTasks = tasks || [];
  const safePhases = phases || [];

  const filteredProjects = useMemo(() => {
    return safeProjects.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [safeProjects, search, statusFilter]);

  const getProjectProgress = (projectId: string) => {
    const projectTasks = safeTasks.filter(t => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    return Math.round(
      projectTasks.reduce((acc, t) => acc + calculatePercentage(t), 0) / projectTasks.length
    );
  };

  const getProjectTaskCount = (projectId: string) => {
    return safeTasks.filter(t => t.projectId === projectId).length;
  };

  const getProjectPhaseCount = (projectId: string) => {
    return safePhases.filter(p => p.projectId === projectId).length;
  };

  const handleOpenNew = () => {
    setEditingProject(undefined);
    setModalOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setModalOpen(true);
  };

  const handleDeleteClick = (projectId: string) => {
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete);
      toast.success('Projeto excluído com sucesso!');
    } catch (err) {
      console.error('Error deleting project:', err);
      toast.error('Erro ao excluir projeto');
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  // Mesmo cabeçalho nos três estados (carregando/erro/conteúdo); a ação só fica ativa com os dados prontos
  const pageHeader = (
    <Header
      title="Projetos"
      subtitle="Gerencie seus projetos e acompanhe o progresso"
      actions={
        <Button onClick={handleOpenNew} disabled={loading || !!error}>
          <Plus className="w-4 h-4" />
          Novo Projeto
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <MainLayout>
        {pageHeader}
        <PageBody>
          <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-[84px] rounded-xl" />
            ))}
          </div>
        </PageBody>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        {pageHeader}
        <div className="flex items-center justify-center h-96">
          <div className="text-center text-destructive">
            <p className="font-medium mb-2">Erro ao carregar dados</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {pageHeader}

      <PageBody>
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar projetos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="planning">Planejamento</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alternância cards/lista: mesmo desenho do TabsList segmentado (36px) */}
          <div className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7 rounded-md', view === 'cards' ? 'bg-card text-foreground shadow-soft hover:bg-card' : 'text-muted-foreground')}
              onClick={() => setView('cards')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7 rounded-md', view === 'table' ? 'bg-card text-foreground shadow-soft hover:bg-card' : 'text-muted-foreground')}
              onClick={() => setView('table')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Projects Grid/Table */}
        {view === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
            {filteredProjects.map(project => {
              const progress = getProjectProgress(project.id);
              const taskCount = getProjectTaskCount(project.id);
              const phaseCount = getProjectPhaseCount(project.id);
              const meta = [
                `${taskCount} ${taskCount === 1 ? 'tarefa' : 'tarefas'}`,
                phaseCount > 0 && `${phaseCount} ${phaseCount === 1 ? 'fase' : 'fases'}`,
                project.startDate && `início ${formatShortDate(project.startDate)}`,
              ].filter(Boolean).join(' · ');

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors cursor-pointer"
                >
                  {/* Mesma estrutura em todos os cards: ícone, nome, status, uma linha de info */}
                  <div className="flex items-start gap-3">
                    <ProjectAvatar project={project} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors" title={project.name}>
                        {project.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate tabular-nums mt-0.5">{meta}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <ProjectStatusBadge status={project.status} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Ações">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(project)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(project.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Progresso sempre na largura total, colado no rodapé */}
                  <div className="mt-auto flex items-center gap-2">
                    <ProgressBar value={progress} size="sm" color="hsl(var(--primary))" className="flex-1" />
                    <span className="text-xs font-mono text-muted-foreground w-9 text-right">{progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Projeto</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Período</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Tarefas</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Progresso</th>
                  <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(project => {
                  const progress = getProjectProgress(project.id);
                  const taskCount = getProjectTaskCount(project.id);

                  return (
                    <tr 
                      key={project.id} 
                      className="border-t border-border hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <ProjectAvatar project={project} size="sm" />
                          <div className="min-w-0">
                            <Link to={`/projects/${project.id}`} className="text-sm font-medium hover:text-primary">{project.name}</Link>
                            {project.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-2.5">
                        <ProjectStatusBadge status={project.status} />
                      </td>
                      <td className="px-5 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {project.startDate && project.endDate ? (
                          <>
                            {new Date(project.startDate).toLocaleDateString('pt-BR')} - {new Date(project.endDate).toLocaleDateString('pt-BR')}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-sm tabular-nums">{taskCount}</td>
                      <td className="px-5 py-2.5 w-48">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={progress} size="sm" color="hsl(var(--primary))" className="flex-1" />
                          <span className="text-xs font-mono text-muted-foreground w-9 text-right">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/projects/${project.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(project)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(project.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredProjects.length === 0 && (
          <EmptyState
            icon={Search}
            title="Nenhum projeto encontrado"
            description="Tente ajustar os filtros ou criar um novo projeto."
            action={
              <Button onClick={handleOpenNew}>
                <Plus className="w-4 h-4" />
                Novo Projeto
              </Button>
            }
          />
        )}
      </PageBody>

      {/* Project Form Modal */}
      <ProjectFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        project={editingProject}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este projeto? Todas as tarefas e fases associadas também serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Projects;
