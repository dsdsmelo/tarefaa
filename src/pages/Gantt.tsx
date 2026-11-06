import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, LocateFixed } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageBody } from '@/components/layout/PageBody';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useData } from '@/contexts/DataContext';
import { isTaskOverdue, calculatePercentage } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AvatarCircle } from '@/components/ui/avatar-circle';

type ZoomLevel = 'day' | 'week' | 'month';
type GroupBy = 'project' | 'responsible';

// UTC helpers (same as ProjectGanttChart)
const normalizeToNoonUTC = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
};

const parseDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const getTodaySaoPaulo = () => {
  const now = new Date();
  const spFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = spFormatter.format(now);
  return parseDate(dateStr);
};

const Gantt = () => {
  const { tasks = [], projects = [], people = [] } = useData();
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const labelsRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // Projetos em Ideia (geladeira) ficam fora do Gantt, com as tarefas deles
  const ideaProjectIds = new Set((projects || []).filter(p => p.status === 'idea').map(p => p.id));
  const safeTasks = (tasks || []).filter(t => !ideaProjectIds.has(t.projectId));
  const safeProjects = (projects || []).filter(p => p.status !== 'idea');
  const safePeople = people || [];

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Calculate date range
  const dateRange = useMemo(() => {
    const today = getTodaySaoPaulo();
    const dates = safeTasks.flatMap(t => [t.startDate, t.endDate].filter(Boolean)) as string[];

    if (dates.length === 0) {
      return {
        start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12, 0, 0)),
        end: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 0, 12, 0, 0))
      };
    }

    const parsedDates = dates.map(d => parseDate(d));
    const minDate = new Date(Math.min(...parsedDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...parsedDates.map(d => d.getTime())));

    const startDate = new Date(minDate);
    startDate.setUTCDate(startDate.getUTCDate() - 7);

    const endDate = new Date(Math.max(maxDate.getTime(), today.getTime()));
    endDate.setUTCDate(endDate.getUTCDate() + 14);

    return { start: normalizeToNoonUTC(startDate), end: normalizeToNoonUTC(endDate) };
  }, [safeTasks]);

  // Generate columns
  const columns = useMemo(() => {
    const cols: { date: Date; label: string; subLabel?: string }[] = [];
    const current = new Date(dateRange.start);

    while (current <= dateRange.end) {
      if (zoom === 'day') {
        const d = normalizeToNoonUTC(current);
        cols.push({
          date: d,
          label: d.getUTCDate().toString().padStart(2, '0'),
          subLabel: d.getUTCDate() === 1 ? d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }) : undefined
        });
        current.setUTCDate(current.getUTCDate() + 1);
      } else if (zoom === 'week') {
        const d = normalizeToNoonUTC(current);
        cols.push({
          date: d,
          label: `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`
        });
        current.setUTCDate(current.getUTCDate() + 7);
      } else {
        const d = normalizeToNoonUTC(current);
        cols.push({
          date: d,
          label: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
          subLabel: d.toLocaleDateString('pt-BR', { year: '2-digit', timeZone: 'UTC' })
        });
        current.setUTCMonth(current.getUTCMonth() + 1);
        current.setUTCDate(1);
      }
    }
    return cols;
  }, [dateRange, zoom]);

  // Column widths
  const columnWidth = zoom === 'day' ? 'min-w-[40px]' : zoom === 'week' ? 'min-w-[100px]' : 'min-w-[120px]';

  // Group tasks
  const groupedTasks = useMemo(() => {
    const groups: { id: string; name: string; color?: string; avatarUrl?: string; tasks: typeof safeTasks }[] = [];

    if (groupBy === 'project') {
      safeProjects.forEach(project => {
        const projectTasks = safeTasks.filter(t => t.projectId === project.id);
        if (projectTasks.length > 0) {
          groups.push({ id: project.id, name: project.name, tasks: projectTasks });
        }
      });
      const orphanTasks = safeTasks.filter(t => !t.projectId || !safeProjects.find(p => p.id === t.projectId));
      if (orphanTasks.length > 0) {
        groups.push({ id: 'no-project', name: 'Sem Projeto', tasks: orphanTasks });
      }
    } else {
      safePeople.forEach(person => {
        const personTasks = safeTasks.filter(t => t.responsibleIds && t.responsibleIds.length > 0 && t.responsibleIds[0] === person.id);
        if (personTasks.length > 0) {
          groups.push({ id: person.id, name: person.name, color: person.color, avatarUrl: person.avatarUrl, tasks: personTasks });
        }
      });
      const unassigned = safeTasks.filter(t => !t.responsibleIds || t.responsibleIds.length === 0);
      if (unassigned.length > 0) {
        groups.push({ id: 'unassigned', name: 'Sem Responsável', tasks: unassigned });
      }
    }

    return groups;
  }, [safeTasks, safeProjects, safePeople, groupBy]);

  // Position helpers
  const getPosition = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start) return null;
    const startD = parseDate(start);
    const endD = end ? parseDate(end) : parseDate(start);
    const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const startOffset = (startD.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const duration = Math.max((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24), 1);
    return { left: `${(startOffset / totalDays) * 100}%`, width: `${Math.max((duration / totalDays) * 100, 0.5)}%` };
  };

  const getTodayPosition = () => {
    const today = getTodaySaoPaulo();
    const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const offset = (today.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    return `${(offset / totalDays) * 100}%`;
  };

  // Status colors
  const getStatusStyles = (task: typeof safeTasks[0]) => {
    const overdue = isTaskOverdue(task);
    if (overdue) return { bg: 'bg-red-500', dot: 'bg-red-500' };
    switch (task.status) {
      case 'completed': return { bg: 'bg-emerald-500', dot: 'bg-emerald-500' };
      case 'in_progress': return { bg: 'bg-blue-500', dot: 'bg-blue-500' };
      case 'waiting': return { bg: 'bg-violet-500', dot: 'bg-violet-500' };
      case 'blocked': return { bg: 'bg-red-500', dot: 'bg-red-500' };
      default: return { bg: 'bg-amber-500', dot: 'bg-amber-500' };
    }
  };

  // Scroll sync
  const handleChartScroll = useCallback(() => {
    if (chartRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = chartRef.current.scrollLeft;
    }
  }, []);

  const handleLabelsScroll = useCallback(() => {
    if (labelsRef.current && chartRef.current) {
      chartRef.current.scrollTop = labelsRef.current.scrollTop;
    }
  }, []);

  const handleChartVerticalScroll = useCallback(() => {
    if (chartRef.current && labelsRef.current) {
      labelsRef.current.scrollTop = chartRef.current.scrollTop;
    }
  }, []);

  // Scroll to today
  const scrollToToday = useCallback(() => {
    const today = getTodaySaoPaulo();
    const columnWidthPx = zoom === 'day' ? 40 : zoom === 'week' ? 100 : 120;

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
      const chartWidth = chartRef.current.clientWidth;
      const scrollPosition = Math.max(0, (todayIndex * columnWidthPx) - (chartWidth / 2) + (columnWidthPx / 2));
      chartRef.current.scrollLeft = scrollPosition;
      headerScrollRef.current.scrollLeft = scrollPosition;
    }
  }, [columns, zoom]);

  useEffect(() => {
    scrollToToday();
  }, [scrollToToday]);

  // Row heights
  const groupHeaderHeight = 'h-9';
  const taskRowHeight = 'h-8';

  // Total task count
  const totalTasks = safeTasks.length;
  const completedTasks = safeTasks.filter(t => t.status === 'completed').length;

  return (
    <MainLayout>
      <Header title="Gráfico Gantt" subtitle="Visualização temporal das tarefas" />

      <PageBody className="space-y-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Agrupar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Projeto</SelectItem>
                <SelectItem value="responsible">Responsável</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{completedTasks}/{totalTasks}</span> concluídas
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={scrollToToday}>
                  <LocateFixed className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ir para Hoje</TooltipContent>
            </Tooltip>

            <Tabs value={zoom} onValueChange={(v) => setZoom(v as ZoomLevel)}>
              <TabsList variant="segmented">
                <TabsTrigger value="day">Dia</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="month">Mês</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Gantt Chart */}
        <TooltipProvider>
          <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
            {/* Header Row */}
            <div className="flex border-b border-border flex-shrink-0">
              {/* Labels header */}
              <div className="w-56 flex-shrink-0 px-3 py-2 bg-muted/50 font-medium text-xs text-muted-foreground flex items-center border-r border-border">
                {groupBy === 'project' ? 'Projeto' : 'Responsável'}
              </div>
              {/* Columns header */}
              <div ref={headerScrollRef} className="flex-1 overflow-hidden">
                <div className="flex relative">
                  {/* Today marker on header */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                    style={{ left: getTodayPosition() }}
                  >
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] font-semibold rounded-t whitespace-nowrap">
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
                          "flex-1 py-1.5 text-center border-l border-border/30 flex flex-col justify-center",
                          columnWidth,
                          isToday && "bg-primary/10"
                        )}
                      >
                        {col.subLabel && <span className="text-[9px] text-muted-foreground">{col.subLabel}</span>}
                        <span className="text-[11px] font-medium text-foreground/80">{col.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Labels column */}
              <div
                ref={labelsRef}
                className="w-56 flex-shrink-0 overflow-y-auto overflow-x-hidden border-r border-border scrollbar-hide"
                onScroll={handleLabelsScroll}
              >
                {groupedTasks.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.id);

                  return (
                    <div key={group.id}>
                      {/* Group header */}
                      <div
                        className={cn(groupHeaderHeight, "flex items-center px-2 bg-muted/30 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors")}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                          {groupBy === 'responsible' && group.id !== 'unassigned' && (
                            <AvatarCircle name={group.name} color={group.color} size="sm" avatarUrl={group.avatarUrl} />
                          )}
                          <span className="text-xs font-medium truncate">{group.name}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">({group.tasks.length})</span>
                        </div>
                      </div>

                      {/* Task labels */}
                      {!isCollapsed && group.tasks.map((task, taskIndex) => {
                        const styles = getStatusStyles(task);
                        const person = groupBy === 'project' && task.responsibleIds?.[0] ? safePeople.find(p => p.id === task.responsibleIds![0]) : undefined;
                        return (
                          <div
                            key={task.id}
                            className={cn(
                              taskRowHeight,
                              "flex items-center px-3 pl-7 border-b border-border/20 hover:bg-muted/30 transition-colors",
                              taskIndex % 2 === 1 && "bg-muted/10"
                            )}
                          >
                            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", styles.dot)} />
                            {person && (
                              <div className="ml-1.5 flex-shrink-0">
                                <AvatarCircle name={person.name} color={person.color} size="xs" avatarUrl={person.avatarUrl} />
                              </div>
                            )}
                            <span className={cn(
                              "text-xs truncate flex-1 ml-1.5",
                              task.status === 'completed' && "line-through text-muted-foreground"
                            )}>
                              {task.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Chart area */}
              <div
                ref={chartRef}
                className="flex-1 overflow-auto"
                onScroll={(e) => {
                  handleChartScroll();
                  handleChartVerticalScroll();
                }}
              >
                <div className="relative" style={{ minWidth: `${columns.length * (zoom === 'day' ? 40 : zoom === 'week' ? 100 : 120)}px` }}>
                  {groupedTasks.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.id);

                    return (
                      <div key={group.id}>
                        {/* Group header row in chart */}
                        <div className={cn(groupHeaderHeight, "relative bg-muted/20 border-b border-border/50")}>
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                            style={{ left: getTodayPosition() }}
                          />
                          {/* Group progress bar */}
                          {(() => {
                            const groupCompleted = group.tasks.filter(t => t.status === 'completed').length;
                            const groupProgress = group.tasks.length > 0 ? Math.round((groupCompleted / group.tasks.length) * 100) : 0;
                            const position = getPosition(
                              group.tasks.reduce((min, t) => !min || (t.startDate && t.startDate < min) ? t.startDate || min : min, '' as string),
                              group.tasks.reduce((max, t) => !max || (t.endDate && t.endDate > max) ? t.endDate || max : max, '' as string)
                            );
                            if (!position) return null;
                            return (
                              <div
                                className="absolute top-1.5 h-[22px] rounded bg-muted/60 border border-border/40 overflow-hidden"
                                style={{ left: position.left, width: position.width, minWidth: '30px' }}
                              >
                                <div
                                  className="h-full bg-primary/20 transition-all"
                                  style={{ width: `${groupProgress}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                                  {groupProgress}%
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Task bars */}
                        {!isCollapsed && group.tasks.map((task, taskIndex) => {
                          const position = getPosition(task.startDate, task.endDate);
                          const styles = getStatusStyles(task);
                          const taskProgress = calculatePercentage(task);
                          const person = task.responsibleIds?.[0] ? safePeople.find(p => p.id === task.responsibleIds![0]) : undefined;
                          const project = safeProjects.find(p => p.id === task.projectId);

                          return (
                            <div
                              key={task.id}
                              className={cn(
                                taskRowHeight,
                                "relative border-b border-border/15",
                                taskIndex % 2 === 1 && "bg-muted/10"
                              )}
                            >
                              {/* Today line */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                                style={{ left: getTodayPosition() }}
                              />
                              {/* Grid lines */}
                              <div className="absolute inset-0 flex pointer-events-none">
                                {columns.map((_, i) => <div key={i} className={cn("flex-1 border-l border-border/30", columnWidth)} />)}
                              </div>
                              {/* Task bar */}
                              {position && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn("absolute top-[5px] h-[14px] rounded hover:opacity-90 transition-opacity overflow-hidden cursor-pointer", styles.bg)}
                                      style={{ left: position.left, width: position.width, minWidth: '12px' }}
                                    >
                                      {taskProgress > 0 && taskProgress < 100 && (
                                        <div className="absolute inset-0 bg-black/20" style={{ width: `${100 - taskProgress}%`, right: 0, left: 'auto' }} />
                                      )}
                                      <span className="absolute inset-0 flex items-center px-1 text-[9px] text-white font-medium truncate">
                                        {zoom !== 'day' && task.name}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="space-y-1">
                                      <p className="font-medium text-sm">{task.name}</p>
                                      {project && groupBy === 'responsible' && (
                                        <p className="text-xs text-muted-foreground">Projeto: {project.name}</p>
                                      )}
                                      {person && groupBy === 'project' && (
                                        <p className="text-xs text-muted-foreground">Responsável: {person.name}</p>
                                      )}
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{task.startDate?.split('-').reverse().join('/')}</span>
                                        <span>→</span>
                                        <span>{task.endDate?.split('-').reverse().join('/')}</span>
                                      </div>
                                      {taskProgress > 0 && (
                                        <p className="text-xs">Progresso: {taskProgress}%</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {/* Sprint marker */}
                              {task.sprintDate && (() => {
                                const sprintD = parseDate(task.sprintDate);
                                const totalDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
                                const offset = (sprintD.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
                                const pos = `${(offset / totalDays) * 100}%`;
                                return (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-purple-500 transform rotate-45 z-10 cursor-pointer"
                                        style={{ left: pos }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent>Sprint: {task.sprintDate.split('-').reverse().join('/')}</TooltipContent>
                                  </Tooltip>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-t border-border bg-muted/30 flex-shrink-0 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span>Pendente</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>Em Progresso</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>Bloqueado/Atrasado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-500" />
                <span>Concluído</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-purple-500 transform rotate-45" />
                <span>Sprint</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-0.5 h-3 bg-primary rounded" />
                <span>Hoje</span>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </PageBody>
    </MainLayout>
  );
};

export default Gantt;
