import { Badge, type BadgeProps } from '@/components/ui/badge';
import { COVER_GRADIENTS, isHexColor } from '@/components/modals/ProjectFormModal';
import { projectStatusLabels, type Project, type ProjectStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_BADGE_VARIANT: Record<ProjectStatus, BadgeProps['variant']> = {
  active: 'success',
  planning: 'default',
  paused: 'warning',
  completed: 'secondary',
  cancelled: 'outline',
};

export const ProjectStatusBadge = ({ status, className }: { status: ProjectStatus; className?: string }) => (
  <Badge variant={STATUS_BADGE_VARIANT[status]} className={className}>
    {projectStatusLabels[status]}
  </Badge>
);

// Cor escolhida na capa do projeto (gradiente pré-definido ou hex); null = padrão
const getProjectColor = (project: Pick<Project, 'coverColor'>): string | null => {
  if (!project.coverColor) return null;
  if (isHexColor(project.coverColor)) return project.coverColor;
  return COVER_GRADIENTS.find(g => g.id === project.coverColor)?.color ?? null;
};

// "Projeto Albert Einstein" -> "AE": ignora palavras genéricas para as iniciais dizerem algo
const IGNORED_WORDS = new Set(['projeto', 'de', 'da', 'do', 'das', 'dos', 'e']);
const getInitials = (name: string) => {
  const words = name.split(/\s+/).filter(Boolean);
  const meaningful = words.filter(w => !IGNORED_WORDS.has(w.toLowerCase()));
  return (meaningful.length ? meaningful : words)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');
};

const SIZES = {
  sm: 'w-8 h-8 rounded-md text-xs',
  md: 'w-10 h-10 rounded-lg text-sm',
  lg: 'w-12 h-12 rounded-xl text-base',
};

// Identidade visual do projeto: logo (inteira, sobre branco) ou iniciais na cor do projeto
export const ProjectAvatar = ({
  project,
  size = 'md',
  className,
}: {
  project: Pick<Project, 'name' | 'imageUrl' | 'coverColor'>;
  size?: keyof typeof SIZES;
  className?: string;
}) => {
  if (project.imageUrl) {
    return (
      <div className={cn('shrink-0 overflow-hidden border border-border bg-white p-1 flex items-center justify-center', SIZES[size], className)}>
        <img src={project.imageUrl} alt={project.name} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }
  const color = getProjectColor(project);
  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center font-semibold text-white',
        !color && 'gradient-primary',
        SIZES[size],
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {getInitials(project.name)}
    </div>
  );
};
