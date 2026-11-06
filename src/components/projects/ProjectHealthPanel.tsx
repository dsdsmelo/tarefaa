import { toast } from 'sonner';
import { HeartPulse } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Label } from '@/components/ui/label';
import type { HealthColor, Milestone, Project, Task } from '@/lib/types';
import { computeProjectHealth, HEALTH_LABELS } from '@/lib/projectHealth';
import { isTaskOpen } from '@/lib/taskDates';
import { friendlyDbError } from '@/lib/dbErrors';
import { HealthBadge, HealthDetails } from './ProjectHealth';

interface ProjectHealthPanelProps {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  today: string;
  /** Só o dono do projeto muda o ajuste manual e a próxima ação */
  canEdit: boolean;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
}

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

export function ProjectHealthPanel({ project, tasks, milestones, today, canEdit, onUpdate }: ProjectHealthPanelProps) {
  const health = computeProjectHealth(project, tasks, milestones, today);
  const openTasks = tasks.filter(t => t.projectId === project.id && isTaskOpen(t)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const showsHealth = health.color !== null;

  const save = async (updates: Partial<Project>, message: string) => {
    try {
      await onUpdate(updates);
      toast.success(message);
    } catch (err) {
      console.error('Erro ao salvar saúde do projeto:', err);
      toast.error(friendlyDbError(err, 'Só o dono do projeto pode mudar isto.', 'Não foi possível salvar.'));
    }
  };

  return (
    <Panel icon={HeartPulse} title="Saúde do projeto" bodyClassName="p-5 space-y-4">
      <div className="space-y-1.5">
        {showsHealth ? <HealthBadge health={health} className="text-sm" /> : (
          <p className="text-sm text-muted-foreground">Projetos em Ideia, Concluídos e Cancelados não têm semáforo.</p>
        )}
        {showsHealth && health.reasons.length > 0 && (
          <p className="text-xs text-muted-foreground">Calculado: {HEALTH_LABELS[health.calculated!]} ({health.reasons.join('; ')})</p>
        )}
        <HealthDetails health={health} today={today} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {showsHealth && (
          <div className="space-y-1.5">
            <Label htmlFor="health-override">Semáforo</Label>
            <select
              id="health-override"
              className={selectClass}
              disabled={!canEdit}
              value={project.healthOverride ?? ''}
              onChange={(e) => {
                const value = (e.target.value || null) as HealthColor | null;
                void save({ healthOverride: value }, value ? `Semáforo manual: ${HEALTH_LABELS[value]}` : 'Semáforo volta a ser calculado');
              }}
            >
              <option value="">Calculado ({HEALTH_LABELS[health.calculated!]})</option>
              <option value="green">Manual: {HEALTH_LABELS.green}</option>
              <option value="yellow">Manual: {HEALTH_LABELS.yellow}</option>
              <option value="red">Manual: {HEALTH_LABELS.red}</option>
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="next-action">Próxima ação</Label>
          <select
            id="next-action"
            className={selectClass}
            disabled={!canEdit}
            value={health.nextAction?.id ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              const name = openTasks.find(t => t.id === id)?.name;
              void save({ nextActionTaskId: id }, id ? `Próxima ação: ${name}` : 'Próxima ação removida');
            }}
          >
            <option value="">{health.nextActionDone ? 'Defina a próxima ação' : 'Nenhuma'}</option>
            {openTasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      {!canEdit && <p className="text-xs text-muted-foreground">Só o dono do projeto muda o semáforo e a próxima ação.</p>}
    </Panel>
  );
}
