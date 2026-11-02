import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  CheckSquare
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageBody } from '@/components/layout/PageBody';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionsMenu } from '@/components/ui/actions-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { AvatarCircle } from '@/components/ui/avatar-circle';
import { PersonFormModal } from '@/components/modals/PersonFormModal';
import { useData } from '@/contexts/DataContext';
import { personTypeLabels, Person } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const People = () => {
  const { people = [], tasks = [], deletePerson, loading, error } = useData();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | undefined>();
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Ensure arrays are always defined
  const safePeople = people || [];
  const safeTasks = tasks || [];

  const filteredPeople = useMemo(() => {
    return safePeople.filter(person => {
      const matchesSearch = person.name.toLowerCase().includes(search.toLowerCase());
      const matchesTab = 
        activeTab === 'all' || 
        (activeTab === 'internal' && person.type === 'internal') ||
        (activeTab === 'partner' && person.type === 'partner');
      return matchesSearch && matchesTab;
    });
  }, [safePeople, search, activeTab]);

  const getTaskCount = (personId: string) => {
    return safeTasks.filter(t => t.responsibleIds?.includes(personId) && t.status !== 'completed' && t.status !== 'cancelled').length;
  };

  const getCompletedTaskCount = (personId: string) => {
    return safeTasks.filter(t => t.responsibleIds?.includes(personId) && t.status === 'completed').length;
  };

  const handleDeleteClick = (person: Person) => {
    setPersonToDelete(person);
  };

  const handleConfirmDelete = async () => {
    if (!personToDelete) return;
    setIsDeleting(true);
    try {
      await deletePerson(personToDelete.id);
      toast.success(`"${personToDelete.name}" excluído(a) com sucesso!`);
      setPersonToDelete(null);
    } catch (err) {
      console.error('Error deleting person:', err);
      toast.error('Erro ao excluir pessoa');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenNew = () => {
    setEditingPerson(undefined);
    setModalOpen(true);
  };

  const handleEdit = (person: Person) => {
    setEditingPerson(person);
    setModalOpen(true);
  };

  // Mesmo cabeçalho nos três estados (carregando/erro/conteúdo); a ação só fica ativa com os dados prontos
  const pageHeader = (
    <Header
      title="Pessoas"
      subtitle="Gerencie os membros da equipe e parceiros"
      actions={
        <Button onClick={handleOpenNew} disabled={loading || !!error}>
          <Plus className="w-4 h-4" />
          Nova Pessoa
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
        {/* Toolbar: busca + filtro por tipo */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pessoas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="segmented">
              <TabsTrigger value="all">
                Todos
                <span className="text-xs tabular-nums text-muted-foreground">{safePeople.length}</span>
              </TabsTrigger>
              <TabsTrigger value="internal">
                Internos
                <span className="text-xs tabular-nums text-muted-foreground">{safePeople.filter(p => p.type === 'internal').length}</span>
              </TabsTrigger>
              <TabsTrigger value="partner">
                Parceiros
                <span className="text-xs tabular-nums text-muted-foreground">{safePeople.filter(p => p.type === 'partner').length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* People Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
          {filteredPeople.map(person => {
            const activeTasks = getTaskCount(person.id);
            const completedTasks = getCompletedTaskCount(person.id);

            return (
              <div
                key={person.id}
                className={cn(
                  "flex flex-col gap-3 bg-card rounded-xl border border-border p-4 hover:border-primary/40 transition-colors",
                  !person.active && "opacity-60"
                )}
              >
                {/* Mesma estrutura do card de Projetos: identidade, nome, selo e ações */}
                <div className="flex items-start gap-3">
                  <AvatarCircle name={person.name} color={person.color} size="md" avatarUrl={person.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate" title={person.name}>{person.name}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5" title={person.email || undefined}>
                      {person.email || 'Sem e-mail'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Badge variant={person.type === 'internal' ? 'default' : 'secondary'}>
                      {personTypeLabels[person.type]}
                    </Badge>
                    <ActionsMenu
                      items={[
                        { label: 'Editar', icon: Edit, onClick: () => handleEdit(person) },
                        { label: 'Excluir', icon: Trash2, onClick: () => handleDeleteClick(person), destructive: true },
                      ]}
                    />
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {activeTasks} {activeTasks === 1 ? 'ativa' : 'ativas'} · {completedTasks} {completedTasks === 1 ? 'concluída' : 'concluídas'}
                </div>
              </div>
            );
          })}
        </div>

        {filteredPeople.length === 0 && (
          <EmptyState
            icon={Search}
            title="Nenhuma pessoa encontrada"
            description="Tente ajustar a busca ou adicione uma nova pessoa."
            action={
              <Button onClick={handleOpenNew}>
                <Plus className="w-4 h-4" />
                Nova Pessoa
              </Button>
            }
          />
        )}
      </PageBody>

      {/* Person Form Modal */}
      <PersonFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        person={editingPerson}
      />

      {/* Delete Person Confirmation Dialog */}
      <AlertDialog open={!!personToDelete} onOpenChange={(open) => !open && setPersonToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pessoa</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Tem certeza que deseja excluir <strong>{personToDelete?.name}</strong>? Esta ação não pode ser desfeita.
                </p>
                {personToDelete && (() => {
                  const affectedTasks = safeTasks.filter(t => t.responsibleIds?.includes(personToDelete.id)).length;
                  if (affectedTasks > 0) {
                    return (
                      <p className="text-sm">
                        <strong>{affectedTasks}</strong> {affectedTasks === 1 ? 'tarefa terá' : 'tarefas terão'} esta pessoa removida da lista de responsáveis.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default People;
