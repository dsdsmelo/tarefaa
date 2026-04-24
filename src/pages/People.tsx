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
import { Button } from '@/components/ui/button';
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

  if (loading) {
    return (
      <MainLayout>
        <Header title="Pessoas" subtitle="Gerencie os membros da equipe e parceiros" />
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
        <Header title="Pessoas" subtitle="Gerencie os membros da equipe e parceiros" />
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
      <Header title="Pessoas" subtitle="Gerencie os membros da equipe e parceiros" />
      
      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pessoas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button className="gradient-primary text-white" onClick={handleOpenNew}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Pessoa
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              Todos
              <Badge variant="secondary" className="ml-2">{safePeople.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="internal">
              Internos
              <Badge variant="secondary" className="ml-2">{safePeople.filter(p => p.type === 'internal').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="partner">
              Parceiros
              <Badge variant="secondary" className="ml-2">{safePeople.filter(p => p.type === 'partner').length}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* People Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPeople.map(person => {
            const activeTasks = getTaskCount(person.id);
            const completedTasks = getCompletedTaskCount(person.id);

            return (
              <div
                key={person.id}
                className={cn(
                  "bg-card rounded-xl border border-border p-6 shadow-soft hover:shadow-medium transition-all duration-200 animate-fade-in",
                  !person.active && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <AvatarCircle name={person.name} color={person.color} size="lg" avatarUrl={person.avatarUrl} />
                  <Badge variant={person.type === 'internal' ? 'default' : 'secondary'}>
                    {personTypeLabels[person.type]}
                  </Badge>
                </div>

                <h3 className="text-lg font-semibold mb-1">{person.name}</h3>
                {person.email && (
                  <p className="text-sm text-muted-foreground mb-4">{person.email}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <CheckSquare className="w-4 h-4" />
                    <span>{activeTasks} ativas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{completedTasks} concluídas</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(person)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(person)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredPeople.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhuma pessoa encontrada</h3>
            <p className="text-muted-foreground mb-4">Tente ajustar a busca ou adicione uma nova pessoa.</p>
            <Button className="gradient-primary text-white" onClick={handleOpenNew}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Pessoa
            </Button>
          </div>
        )}
      </div>

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
