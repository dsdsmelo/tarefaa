import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  Eye
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ProjectFormModal, COVER_GRADIENTS, isHexColor } from '@/components/modals/ProjectFormModal';
import { useData } from '@/contexts/DataContext';
import { calculatePercentage } from '@/lib/mockData';
import { projectStatusLabels, Project } from '@/lib/types';
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

const statusColors = {
  planning: 'bg-purple-500',
  active: 'bg-status-completed',
  paused: 'bg-status-pending',
  completed: 'bg-status-progress',
  cancelled: 'bg-status-cancelled',
};

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

  if (loading) {
    return (
      <MainLayout>
        <Header title="Projetos" subtitle="Gerencie seus projetos e acompanhe o progresso" />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando dados...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <Header title="Projetos" subtitle="Gerencie seus projetos e acompanhe o progresso" />
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
      <Header title="Projetos" subtitle="Gerencie seus projetos e acompanhe o progresso" />
      
      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 w-full sm:w-auto">
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

          <div className="flex gap-2">
            <div className="flex border border-border rounded-lg p-1">
              <Button
                variant={view === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('cards')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={view === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('table')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <Button className="gradient-primary text-white" onClick={handleOpenNew}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Projeto
            </Button>
          </div>
        </div>

        {/* Projects Grid/Table */}
        {view === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProjects.map(project => {
              const progress = getProjectProgress(project.id);
              const taskCount = getProjectTaskCount(project.id);
              const phaseCount = getProjectPhaseCount(project.id);
              const coverGradient = project.coverColor
                ? COVER_GRADIENTS.find(g => g.id === project.coverColor)
                : null;
              const coverSolid = project.coverColor && isHexColor(project.coverColor)
                ? project.coverColor
                : null;
              const hasImage = !!project.imageUrl;

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="bg-card rounded-lg border border-border hover:border-primary/40 shadow-soft hover:shadow-medium transition-all duration-200 animate-fade-in overflow-hidden group relative cursor-pointer"
                >
                  {/* Subtle full-card gradient derived from the cover color */}
                  {coverGradient && (
                    <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-[0.07]", coverGradient.class)} />
                  )}
                  {coverSolid && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ background: `linear-gradient(135deg, ${coverSolid}1f 0%, transparent 60%)` }}
                    />
                  )}

                  {/* Color strip */}
                  {coverGradient && (
                    <div className={cn("relative h-2 w-full bg-gradient-to-r", coverGradient.class)} />
                  )}
                  {coverSolid && (
                    <div className="relative h-2 w-full" style={{ backgroundColor: coverSolid }} />
                  )}

                  {/* Project / client image - absolutely positioned so it never changes card size */}
                  {hasImage && (
                    <div className="pointer-events-none absolute top-3 right-3 z-10 w-16 h-16 rounded-full overflow-hidden ring-2 ring-background shadow-medium border border-border/60 bg-muted">
                      <img
                        src={project.imageUrl!}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Actions (hover) - top-right corner, above the image */}
                  <div
                    className="absolute top-1.5 right-1.5 z-20 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-card/70 backdrop-blur-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEdit(project)}
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
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

                  {/* Content Section */}
                  <div className="relative p-4">
                    {/* Header: Status */}
                    <div className={cn("flex items-center min-h-7 mb-2", hasImage && "pr-20")}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', statusColors[project.status])} />
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          {projectStatusLabels[project.status]}
                        </span>
                      </div>
                    </div>

                    {/* Project name */}
                    <h3 className={cn("text-sm font-semibold truncate group-hover:text-primary transition-colors", hasImage && "pr-20")}>
                      {project.name}
                    </h3>

                    {/* Meta info inline */}
                    <div className={cn("flex items-center gap-3 mt-2 text-xs text-muted-foreground", hasImage && "pr-20")}>
                      <span>{phaseCount} fases</span>
                      <span className="text-border">•</span>
                      <span>{taskCount} tarefas</span>
                      {project.startDate && (
                        <>
                          <span className="text-border">•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(project.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Progress bar inline */}
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1">
                        <ProgressBar
                          value={progress}
                          size="sm"
                          color={coverSolid || undefined}
                          gradientClass={coverGradient?.class}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground min-w-[32px] text-right">
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Projeto</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Período</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Tarefas</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Progresso</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(project => {
                  const progress = getProjectProgress(project.id);
                  const taskCount = getProjectTaskCount(project.id);

                  return (
                    <tr 
                      key={project.id} 
                      className="border-t border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <td className="py-4 px-6">
                        <div>
                          <Link to={`/projects/${project.id}`} className="font-medium hover:text-primary">{project.name}</Link>
                          {project.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{project.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', statusColors[project.status])} />
                          <span className="text-sm">{projectStatusLabels[project.status]}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-muted-foreground">
                        {project.startDate && project.endDate ? (
                          <>
                            {new Date(project.startDate).toLocaleDateString('pt-BR')} - {new Date(project.endDate).toLocaleDateString('pt-BR')}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm">{taskCount}</td>
                      <td className="py-4 px-6 w-48">
                        <ProgressBar value={progress} showLabel size="sm" />
                      </td>
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum projeto encontrado</h3>
            <p className="text-muted-foreground mb-4">Tente ajustar os filtros ou criar um novo projeto.</p>
            <Button className="gradient-primary text-white" onClick={handleOpenNew}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Projeto
            </Button>
          </div>
        )}
      </div>

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
