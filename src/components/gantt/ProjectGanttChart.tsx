import { useState, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isTaskOverdue, calculatePercentage } from '@/lib/mockData';
import { Task, Person, Milestone, Phase, Project } from '@/lib/types';
import { Pencil, Trash2, CheckCircle2, ChevronDown, ChevronRight, Calendar, CalendarDays, CalendarRange, Diamond, Layers, Info, LocateFixed } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AvatarCircle } from '@/components/ui/avatar-circle';

type ZoomLevel = 'day' | 'week' | 'month';

interface ProjectGanttChartProps {
  tasks: Task[];
  people: Person[];
  projectId: string;
  project?: Project;
  phases?: Phase[];
  milestones?: Milestone[];
  onAddPhase?: () => void;
  onEditPhase?: (phase: Phase) => void;
  onDeletePhase?: (phaseId: string) => void;
  onUpdatePhase?: (phaseId: string, data: Partial<Phase>) => void;
  onAddMilestone?: () => void;
  onEditMilestone?: (milestone: Milestone) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
  onUpdateMilestone?: (milestoneId: string, data: Partial<Milestone>) => void;
  onAddTask?: (responsibleId?: string) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
}

export const ProjectGanttChart = ({
  tasks,
  people,
  projectId,
  project,
  phases = [],
  milestones = [],
  onAddPhase,
  onEditPhase,
  onDeletePhase,
  onUpdatePhase,
  onAddMilestone,
  onEditMilestone,
  onDeleteMilestone,
  onUpdateMilestone,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: ProjectGanttChartProps) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [showPhasesSection, setShowPhasesSection] = useState(true);
  const labelsRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const projectPhases = useMemo(() => phases.filter(p => p.projectId === projectId), [phases, projectId]);
  const projectMilestones = useMemo(() => milestones.filter(m => m.projectId === projectId), [milestones, projectId]);

  // Organiza marcos por fase e marcos independentes
  const { phasesWithMilestones, independentMilestones } = useMemo(() => {
    const milestonesMap = new Map<string, Milestone[]>();
    const independent: Milestone[] = [];

    projectMilestones.forEach(m => {
      if (m.phaseId) {
        const existing = milestonesMap.get(m.phaseId) || [];
        existing.push(m);
        milestonesMap.set(m.phaseId, existing);
      } else {
        independent.push(m);
      }
    });

    const phasesWithMs = projectPhases.map(phase => ({
      ...phase,
      linkedMilestones: milestonesMap.get(phase.id) || [],
    }));

    return { phasesWithMilestones: phasesWithMs, independentMilestones: independent };
  }, [projectPhases, projectMilestones]);

  // Helper para normalizar qualquer data ao meio-dia UTC (evita problemas de timezone/meia-noite)
  const normalizeToNoonUTC = (date: Date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
  };

  // Helper para parsear string "YYYY-MM-DD" como UTC meio-dia
  const parseDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  };

  // Helper para obter data atual em São Paulo (normalizada ao meio-dia UTC para alinhar com datas do banco)
  const getTodaySaoPaulo = () => {
    const now = new Date();
    // Obter a data no timezone de São Paulo
    const spFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = spFormatter.format(now); // "YYYY-MM-DD"
    return parseDate(dateStr);
  };

  const dateRange = useMemo(() => {
    const today = getTodaySaoPaulo();
    const dates = tasks.flatMap(t => [t.startDate, t.endDate].filter(Boolean)) as string[];
    const phaseDates = projectPhases.flatMap(p => [p.startDate, p.endDate].filter(Boolean)) as string[];
    const milestoneDates = projectMilestones.map(m => m.date).filter(Boolean) as string[];

    // Include project start and end dates
    const projectDates = [project?.startDate, project?.endDate].filter(Boolean) as string[];

    const allDates = [...dates, ...phaseDates, ...milestoneDates, ...projectDates];

    if (allDates.length === 0) {
      return {
        start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12, 0, 0)),
        end: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 0, 12, 0, 0))
      };
    }

    const parsedDates = allDates.map(d => parseDate(d));
    const minDate = new Date(Math.min(...parsedDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...parsedDates.map(d => d.getTime())));

    // Start from the earliest date (project start) with some padding
    const startDate = new Date(minDate);
    startDate.setUTCDate(startDate.getUTCDate() - 7); // 1 week before earliest date

    // End after the latest date or today, whichever is later
    const endDate = new Date(Math.max(maxDate.getTime(), today.getTime()));
    endDate.setUTCDate(endDate.getUTCDate() + 14); // 2 weeks after latest date

    return { start: normalizeToNoonUTC(startDate), end: normalizeToNoonUTC(endDate) };
  }, [tasks, projectPhases, projectMilestones, project]);

  const columns = useMemo(() => {
    const cols: { date: Date; label: string; subLabel?: string }[] = [];
    const current = new Date(dateRange.start);

    while (current <= dateRange.end) {
      if (zoom === 'day') {
        const d = normalizeToNoonUTC(current);
        cols.push({ date: d, label: d.getUTCDate().toString().padStart(2, '0'), subLabel: d.getUTCDate() === 1 ? d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }) : undefined });
        current.setUTCDate(current.getUTCDate() + 1);
      } else if (zoom === 'week') {
        const d = normalizeToNoonUTC(current);
        cols.push({ date: d, label: `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}` });
        current.setUTCDate(current.getUTCDate() + 7);
      } else {
        const d = normalizeToNoonUTC(current);
        cols.push({ date: d, label: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', ''), subLabel: d.toLocaleDateString('pt-BR', { year: '2-digit', timeZone: 'UTC' }) });
        current.setUTCMonth(current.getUTCMonth() + 1);
        current.setUTCDate(1);
      }
    }
    return cols;
  }, [dateRange, zoom]);

  const groupedTasks = useMemo(() => {
    const groups: { id: string; name: string; color?: string; tasks: Task[] }[] = [];
    // Collect all person IDs that have tasks assigned
    const usedPeople = new Set<string>();
    tasks.forEach(t => {
      if (t.responsibleIds && t.responsibleIds.length > 0) {
        t.responsibleIds.forEach(id => usedPeople.add(id));
      }
    });
    // Group tasks by their first responsible (tasks appear under first responsible)
    people.filter(p => usedPeople.has(p.id)).forEach(person => {
      const personTasks = tasks.filter(t =>
        t.responsibleIds && t.responsibleIds.length > 0 && t.responsibleIds[0] === person.id
      );
      if (personTasks.length > 0) groups.push({ id: person.id, name: person.name, color: person.color, tasks: personTasks });
    });
    const unassigned = tasks.filter(t => !t.responsibleIds || t.responsibleIds.length === 0);
    if (unassigned.length > 0) groups.push({ id: 'unassigned', name: 'Sem Responsável', tasks: unassigned });
    return groups;
  }, [tasks, people]);

  const getPosition = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start) return null;
    const startD = parseDate(start);
    const endD = end ? parseDate(end) : parseDate(start);
    const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const startOffset = (startD.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const duration = Math.max((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24), 1);
    return { left: `${(startOffset / totalDays) * 100}%`, width: `${Math.max((duration / totalDays) * 100, 0.5)}%` };
  };

  const getMilestonePosition = (date: string) => {
    const d = parseDate(date);
    const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const offset = (d.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    return `${(offset / totalDays) * 100}%`;
  };

  const getTodayPosition = () => {
    const today = getTodaySaoPaulo();
    const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const offset = (today.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    return `${(offset / totalDays) * 100}%`;
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const getStatusStyles = (task: Task) => {
    const overdue = isTaskOverdue(task);
    if (overdue) return { bg: 'bg-red-500', dot: 'bg-red-500' };
    if (task.status === 'completed') return { bg: 'bg-emerald-500', dot: 'bg-emerald-500' };
    if (task.status === 'in_progress') return { bg: 'bg-blue-500', dot: 'bg-blue-500' };
    if (task.status === 'blocked') return { bg: 'bg-red-500', dot: 'bg-red-500' };
    return { bg: 'bg-amber-500', dot: 'bg-amber-500' };
  };

  // Sync scroll between labels and chart
  const handleChartScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (labelsRef.current) {
      labelsRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  const handleLabelsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (chartRef.current) {
      chartRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  // Scroll to today position
  const scrollToToday = useCallback(() => {
    const today = getTodaySaoPaulo();
    const columnWidthPx = zoom === 'day' ? 40 : zoom === 'week' ? 100 : 120;

    // Find the column index for today
    const todayIndex = columns.findIndex(col => {
      if (zoom === 'day') {
        return col.date.getUTCFullYear() === today.getUTCFullYear() && col.date.getUTCMonth() === today.getUTCMonth() && col.date.getUTCDate() === today.getUTCDate();
      } else if (zoom === 'week') {
        const weekEnd = new Date(col.date);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        return today >= col.date && today <= weekEnd;
      } else {
        return col.date.getUTCMonth() === today.getUTCMonth() && col.date.getUTCFullYear() === today.getUTCFullYear();
      }
    });

    if (todayIndex !== -1 && chartRef.current && headerScrollRef.current) {
      // Calculate scroll position to center today on screen
      const chartWidth = chartRef.current.clientWidth;
      const scrollPosition = Math.max(0, (todayIndex * columnWidthPx) - (chartWidth / 2) + (columnWidthPx / 2));

      chartRef.current.scrollLeft = scrollPosition;
      headerScrollRef.current.scrollLeft = scrollPosition;
    }
  }, [columns, zoom]);

  const columnWidth = zoom === 'day' ? 'min-w-[40px]' : zoom === 'week' ? 'min-w-[100px]' : 'min-w-[120px]';
  const chartMinWidth = zoom === 'day' ? `${columns.length * 40}px` : zoom === 'week' ? `${columns.length * 100}px` : `${columns.length * 120}px`;
  const labelColumnWidthPx = 320;

  if (tasks.length === 0 && projectPhases.length === 0 && projectMilestones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card">
        <EmptyState
          icon={Calendar}
          title="Nenhum item no cronograma"
          description="Adicione fases, marcos ou tarefas com datas"
          action={
            <div className="flex gap-2 justify-center">
              {onAddPhase && <Button variant="outline" size="sm" onClick={onAddPhase}><Layers className="w-4 h-4" />Nova Fase</Button>}
              {onAddMilestone && <Button variant="outline" size="sm" onClick={onAddMilestone}><Diamond className="w-4 h-4" />Novo Marco</Button>}
            </div>
          }
        />
      </div>
    );
  }

  // Row heights for consistency - compact vertical spacing
  const headerHeight = 'h-[40px]';
  const sectionHeaderHeight = 'h-[22px]';
  const phaseRowHeight = 'h-[20px]';
  const groupHeaderHeight = 'h-[36px]';
  const taskRowHeight = 'h-[24px]';

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {onAddPhase && <Button variant="outline" onClick={onAddPhase}><Layers className="w-4 h-4" />Nova Fase</Button>}
            {onAddMilestone && <Button variant="outline" onClick={onAddMilestone}><Diamond className="w-4 h-4" />Novo Marco</Button>}
          </div>

          <div className="flex items-center gap-2">
            {/* Go to Today Button */}
            <Button variant="outline" size="sm" onClick={scrollToToday}>
              <LocateFixed className="w-4 h-4" />
              Hoje
            </Button>

            {/* Legend Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Info className="w-4 h-4" />
                  Legenda
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-3">
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500" /><span className="text-muted-foreground">Fase</span></div>
                  <div className="flex items-center gap-2"><Diamond className="w-4 h-4 text-blue-500" style={{ fill: '#3b82f6' }} /><span className="text-muted-foreground">Marco</span></div>
                  <div className="border-t my-2" />
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-muted-foreground">Pendente</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-muted-foreground">Em Progresso</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-muted-foreground">Bloqueado/Atrasado</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-muted-foreground">Concluído</span></div>
                  <div className="border-t my-2" />
                  <div className="flex items-center gap-2"><div className="w-0.5 h-4 bg-primary rounded-full" /><span className="text-muted-foreground">Hoje</span></div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Zoom Controls */}
            <Tabs value={zoom} onValueChange={(v) => setZoom(v as ZoomLevel)}>
              <TabsList variant="segmented">
                <TabsTrigger value="day"><CalendarDays className="w-4 h-4" />Dia</TabsTrigger>
                <TabsTrigger value="week"><Calendar className="w-4 h-4" />Semana</TabsTrigger>
                <TabsTrigger value="month"><CalendarRange className="w-4 h-4" />Mês</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Gantt Chart - Two Column Layout */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Fixed Header Row */}
          <div className="flex w-full border-b border-border">
            {/* Label Column Header */}
            <div
              className="flex-shrink-0 border-r border-border bg-muted/40"
              style={{ width: labelColumnWidthPx }}
            >
              <div className={cn(headerHeight, "px-4 font-medium text-sm text-muted-foreground flex items-center gap-2")}>
                <span>Tarefas</span>
              </div>
            </div>
            {/* Chart Header with Timeline - Scrollable horizontally */}
            <div
              ref={headerScrollRef}
              className="flex-1 overflow-x-auto min-w-0"
              style={{ scrollbarWidth: 'none' }}
              onScroll={(e) => {
                if (chartRef.current) {
                  chartRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
            >
              <div className={cn(headerHeight, "flex bg-muted/40 relative")} style={{ minWidth: chartMinWidth }}>
                {/* Today Line in header */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                  style={{ left: getTodayPosition() }}
                >
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-t whitespace-nowrap">
                    Hoje
                  </div>
                </div>
                {columns.map((col, i) => {
                  const today = getTodaySaoPaulo();
                  const isToday = zoom !== 'month' && col.date.getUTCFullYear() === today.getUTCFullYear() && col.date.getUTCMonth() === today.getUTCMonth() && col.date.getUTCDate() === today.getUTCDate();
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 py-2 text-center border-l border-border/30 flex flex-col justify-center",
                        columnWidth,
                        isToday && "bg-primary/10"
                      )}
                    >
                      {col.subLabel && <span className="text-[10px] text-muted-foreground">{col.subLabel}</span>}
                      <span className={cn("font-medium", zoom === 'day' ? "text-xs" : "text-sm", isToday && "text-primary font-semibold")}>{col.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex w-full" style={{ maxHeight: 'calc(100vh - 350px)' }}>
            {/* Left Column - Labels */}
            <div
              ref={labelsRef}
              className="flex-shrink-0 border-r border-border bg-card overflow-y-auto"
              style={{ width: labelColumnWidthPx, scrollbarWidth: 'none' }}
              onScroll={handleLabelsScroll}
            >

              {/* Fases e Marcos Section */}
              {(projectPhases.length > 0 || projectMilestones.length > 0) && (
                <div className="border-b border-border">
                  {/* Section Header */}
                  <div
                    className={cn(sectionHeaderHeight, "flex items-center cursor-pointer hover:bg-muted/30 transition-colors bg-muted/20 px-3")}
                    onClick={() => setShowPhasesSection(!showPhasesSection)}
                  >
                    <button className="p-0.5 rounded hover:bg-muted">
                      {showPhasesSection ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    <Layers className="w-3.5 h-3.5 text-amber-600 ml-2" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400 ml-2">Fases e Marcos</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums ml-1">({projectPhases.length + projectMilestones.length})</span>
                  </div>

                  {showPhasesSection && (
                    <>
                      {/* Phase Labels with linked milestones */}
                      {phasesWithMilestones.map((phase) => {
                        const phaseColor = phase.color || '#f59e0b';
                        return (
                          <div key={phase.id}>
                            {/* Phase row */}
                            <div className={cn(phaseRowHeight, "flex items-center px-3 pl-10 hover:bg-muted/20 transition-colors")}>
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: phaseColor }} />
                              <span className="text-xs truncate flex-1 ml-2">{phase.name}</span>
                              {phase.linkedMilestones.length > 0 && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Diamond className="w-2.5 h-2.5" style={{ fill: '#3b82f6', color: '#3b82f6' }} />
                                  {phase.linkedMilestones.length}
                                </span>
                              )}
                            </div>
                            {/* Linked milestones */}
                            {phase.linkedMilestones.map((milestone) => {
                              const mColor = milestone.color || '#3b82f6';
                              return (
                                <div key={milestone.id} className={cn(phaseRowHeight, "flex items-center px-3 pl-14 hover:bg-muted/20 transition-colors bg-muted/5")}>
                                  <Diamond className="w-3 h-3 flex-shrink-0" style={{ fill: mColor, color: mColor }} />
                                  <span className="text-xs truncate flex-1 ml-2 text-muted-foreground">{milestone.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* Independent Milestones Labels */}
                      {independentMilestones.length > 0 && (
                        <>
                          {independentMilestones.map((milestone) => {
                            const mColor = milestone.color || '#3b82f6';
                            return (
                              <div key={milestone.id} className={cn(phaseRowHeight, "flex items-center px-3 pl-10 hover:bg-muted/20 transition-colors")}>
                                <Diamond className="w-3.5 h-3.5 flex-shrink-0" style={{ fill: mColor, color: mColor }} />
                                <span className="text-xs truncate flex-1 ml-2">{milestone.name}</span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Task Groups */}
              {groupedTasks.length === 0 && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">Nenhuma tarefa</p>
                </div>
              )}

              {groupedTasks.map((group) => {
                const isCollapsed = collapsedGroups.has(group.id);
                const completedCount = group.tasks.filter(t => t.status === 'completed').length;
                const progress = Math.round((completedCount / group.tasks.length) * 100);
                const person = people.find(p => p.id === group.id);

                return (
                  <div key={group.id} className="border-b border-border/50 last:border-b-0">
                    {/* Group Header */}
                    <div
                      className={cn(groupHeaderHeight, "flex items-center cursor-pointer hover:bg-muted/40 transition-colors bg-muted/20 px-2")}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <button className="p-0.5 rounded hover:bg-muted">
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {person ? (
                        <AvatarCircle name={person.name} color={person.color} size="sm" avatarUrl={person.avatarUrl} />
                      ) : (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold bg-muted-foreground ml-1">
                          {group.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 ml-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold truncate">{group.name}</p>
                          <span className="text-[10px] text-muted-foreground tabular-nums">({group.tasks.length})</span>
                          <div className="flex-1 h-1 bg-muted rounded-full max-w-[40px] overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[10px] font-mono font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{progress}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Task Labels */}
                    {!isCollapsed && group.tasks.map((task, taskIndex) => {
                      const styles = getStatusStyles(task);
                      return (
                        <div
                          key={task.id}
                          className={cn(taskRowHeight, "flex items-center hover:bg-muted/30 transition-colors px-4 pl-8", taskIndex % 2 === 1 && "bg-muted/10")}
                        >
                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", styles.dot)} />
                          <span className={cn("text-sm truncate flex-1 ml-2", task.status === 'completed' && "line-through text-muted-foreground")}>
                            {task.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Right Column - Chart (Scrollable horizontally and vertically) */}
            <div
              ref={chartRef}
              className="flex-1 overflow-auto min-w-0"
              onScroll={(e) => {
                handleChartScroll(e);
                // Sync header horizontal scroll
                if (headerScrollRef.current) {
                  headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
            >
              <div style={{ minWidth: chartMinWidth }}>
                {/* Fases e Marcos Section */}
                {(projectPhases.length > 0 || projectMilestones.length > 0) && (
                  <div className="border-b border-border">
                    {/* Section Header Row */}
                    <div className={cn(sectionHeaderHeight, "relative bg-muted/20")}>
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                        style={{ left: getTodayPosition() }}
                      />
                    </div>

                    {showPhasesSection && (
                      <>
                        {/* Phase Bars with linked milestones */}
                        {phasesWithMilestones.map((phase) => {
                          const position = getPosition(phase.startDate, phase.endDate);
                          const phaseColor = phase.color || '#f59e0b';
                          return (
                            <div key={phase.id}>
                              {/* Phase bar row */}
                              <div className={cn(phaseRowHeight, "relative")}>
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                                  style={{ left: getTodayPosition() }}
                                />
                                <div className="absolute inset-0 flex pointer-events-none">
                                  {columns.map((_, i) => <div key={i} className={cn("flex-1 border-l border-border/30", columnWidth)} />)}
                                </div>
                                {position && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <div
                                        className="absolute top-1 h-4 rounded cursor-pointer hover:opacity-90 transition-opacity"
                                        style={{ left: position.left, width: position.width, minWidth: '24px', backgroundColor: phaseColor }}
                                      >
                                        <div className="h-full flex items-center px-1.5 text-[10px] text-white font-medium truncate">
                                          {phase.name}
                                        </div>
                                      </div>
                                    </PopoverTrigger>
                                    <PopoverContent side="top" className="w-64 p-3">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: phaseColor }} />
                                          <p className="font-semibold">{phase.name}</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          {phase.startDate && new Date(phase.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                          {phase.endDate && ` → ${new Date(phase.endDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
                                        </p>
                                        {phase.description && <p className="text-sm text-muted-foreground">{phase.description}</p>}
                                        {phase.linkedMilestones.length > 0 && (
                                          <div className="text-xs text-muted-foreground">
                                            <span className="font-medium">{phase.linkedMilestones.length}</span> marco(s) vinculado(s)
                                          </div>
                                        )}
                                        <div className="flex gap-1 pt-2 border-t">
                                          {onEditPhase && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onEditPhase(phase)}><Pencil className="w-3 h-3" />Editar</Button>}
                                          {onDeletePhase && <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => { if(confirm('Excluir fase?')) onDeletePhase(phase.id); }}><Trash2 className="w-3 h-3" />Excluir</Button>}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              {/* Linked milestones rows */}
                              {phase.linkedMilestones.map(m => {
                                const milestoneColor = m.color || '#3b82f6';
                                const milestonePos = getMilestonePosition(m.date);
                                return (
                                  <div key={m.id} className={cn(phaseRowHeight, "relative bg-muted/5")}>
                                    <div
                                      className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                                      style={{ left: getTodayPosition() }}
                                    />
                                    <div className="absolute inset-0 flex pointer-events-none">
                                      {columns.map((_, i) => <div key={i} className={cn("flex-1 border-l border-border/30", columnWidth)} />)}
                                    </div>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <div
                                          className="absolute top-1/2 cursor-pointer hover:opacity-80 transition-opacity z-10 group"
                                          style={{ left: milestonePos, transform: 'translate(-50%, -50%)' }}
                                        >
                                          <div className="relative flex items-center justify-center w-5 h-5">
                                            <div
                                              className="w-3.5 h-3.5 rotate-45 rounded-sm border border-white/50"
                                              style={{ backgroundColor: milestoneColor }}
                                            />
                                            {m.completed && <CheckCircle2 className="w-2.5 h-2.5 absolute -top-1 -right-1 text-emerald-500 bg-white rounded-full" />}
                                          </div>
                                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 hidden group-hover:block pointer-events-none">
                                            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap bg-background/95 px-1.5 py-0.5 rounded border">
                                              {m.name}
                                            </span>
                                          </div>
                                        </div>
                                      </PopoverTrigger>
                                      <PopoverContent side="top" className="w-64 p-3">
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Diamond className="w-4 h-4" style={{ fill: milestoneColor, color: milestoneColor }} />
                                            <p className="font-semibold">{m.name}</p>
                                          </div>
                                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Layers className="w-3 h-3" style={{ color: phaseColor }} />
                                            Vinculado a: {phase.name}
                                          </p>
                                          <p className="text-sm text-muted-foreground">{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                          {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                                          <div className="flex items-center gap-2 pt-2 border-t">
                                            <Checkbox id={`m-${m.id}`} checked={m.completed} onCheckedChange={(c) => onUpdateMilestone?.(m.id, { completed: !!c })} />
                                            <label htmlFor={`m-${m.id}`} className="text-sm cursor-pointer">Marcar como concluído</label>
                                          </div>
                                          <div className="flex gap-1 pt-2">
                                            {onEditMilestone && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onEditMilestone(m)}><Pencil className="w-3 h-3" />Editar</Button>}
                                            {onDeleteMilestone && <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => { if(confirm('Excluir marco?')) onDeleteMilestone(m.id); }}><Trash2 className="w-3 h-3" />Excluir</Button>}
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}

                        {/* Independent Milestone Rows */}
                        {independentMilestones.map(m => {
                          const milestoneColor = m.color || '#3b82f6';
                          const milestonePos = getMilestonePosition(m.date);
                          return (
                            <div key={m.id} className={cn(phaseRowHeight, "relative")}>
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                                style={{ left: getTodayPosition() }}
                              />
                              <div className="absolute inset-0 flex pointer-events-none">
                                {columns.map((_, i) => <div key={i} className={cn("flex-1 border-l border-border/30", columnWidth)} />)}
                              </div>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div
                                    className="absolute top-1/2 cursor-pointer hover:opacity-80 transition-opacity z-10 group"
                                    style={{ left: milestonePos, transform: 'translate(-50%, -50%)' }}
                                  >
                                    <div className="relative flex items-center justify-center w-5 h-5">
                                      <div
                                        className="w-3.5 h-3.5 rotate-45 rounded-sm border border-white/50"
                                        style={{ backgroundColor: milestoneColor }}
                                      />
                                      {m.completed && <CheckCircle2 className="w-2.5 h-2.5 absolute -top-1 -right-1 text-emerald-500 bg-white rounded-full" />}
                                    </div>
                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 hidden group-hover:block pointer-events-none">
                                      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap bg-background/95 px-1.5 py-0.5 rounded border">
                                        {m.name}
                                      </span>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent side="top" className="w-64 p-3">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Diamond className="w-4 h-4" style={{ fill: milestoneColor, color: milestoneColor }} />
                                      <p className="font-semibold">{m.name}</p>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                    {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                                    <div className="flex items-center gap-2 pt-2 border-t">
                                      <Checkbox id={`m-${m.id}`} checked={m.completed} onCheckedChange={(c) => onUpdateMilestone?.(m.id, { completed: !!c })} />
                                      <label htmlFor={`m-${m.id}`} className="text-sm cursor-pointer">Marcar como concluído</label>
                                    </div>
                                    <div className="flex gap-1 pt-2">
                                      {onEditMilestone && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onEditMilestone(m)}><Pencil className="w-3 h-3" />Editar</Button>}
                                      {onDeleteMilestone && <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => { if(confirm('Excluir marco?')) onDeleteMilestone(m.id); }}><Trash2 className="w-3 h-3" />Excluir</Button>}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}

                {/* Task Groups Chart */}
                {groupedTasks.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.id);

                  return (
                    <div key={group.id} className="border-b border-border/50 last:border-b-0">
                      {/* Group Header Row */}
                      <div className={cn(groupHeaderHeight, "relative bg-muted/20")}>
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                          style={{ left: getTodayPosition() }}
                        />
                      </div>

                      {/* Task Bars */}
                      {!isCollapsed && group.tasks.map((task, taskIndex) => {
                        const position = getPosition(task.startDate, task.endDate);
                        const styles = getStatusStyles(task);
                        const taskProgress = calculatePercentage(task);

                        return (
                          <div key={task.id} className={cn(taskRowHeight, "relative border-b border-border/15", taskIndex % 2 === 1 && "bg-muted/10")}>
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                              style={{ left: getTodayPosition() }}
                            />
                            <div className="absolute inset-0 flex pointer-events-none">
                              {columns.map((_, i) => <div key={i} className={cn("flex-1 border-l border-border/30", columnWidth)} />)}
                            </div>
                            {position && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn("absolute top-[5px] h-[14px] rounded hover:opacity-90 transition-opacity overflow-hidden", styles.bg)}
                                    style={{ left: position.left, width: position.width, minWidth: '12px' }}
                                  >
                                    {taskProgress > 0 && taskProgress < 100 && (
                                      <div
                                        className="absolute inset-y-0 left-0 bg-white/20"
                                        style={{ width: `${taskProgress}%` }}
                                      />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">{task.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {task.startDate && new Date(task.startDate).toLocaleDateString('pt-BR')}
                                    {task.endDate && ` → ${new Date(task.endDate).toLocaleDateString('pt-BR')}`}
                                  </p>
                                  {taskProgress > 0 && <p className="text-xs">Progresso: {taskProgress}%</p>}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
