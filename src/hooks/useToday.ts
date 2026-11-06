import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { todayISO } from '@/lib/taskDates';
import { buildTodaySections, summarize, type TodayContext } from '@/lib/today';
import { useTodayScope } from '@/lib/todayScope';
import type { Project } from '@/lib/types';

/** Data local de hoje, atualizada na virada do dia (a cada minuto e ao voltar para a aba) */
export function useLocalToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const refresh = () => setToday(prev => (prev === todayISO() ? prev : todayISO()));
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}

/** Seções e resumo da página Hoje, com o filtro do usuário (barra lateral, Dashboard e página) */
export function useTodayView() {
  const { user } = useAuth();
  const { allTasks, allProjects, inboxProject, people } = useData();
  const today = useLocalToday();
  const [scope, setScope] = useTodayScope(user?.id);

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>(allProjects.map(p => [p.id, p]));
    if (inboxProject) map.set(inboxProject.id, inboxProject);
    return map;
  }, [allProjects, inboxProject]);

  const myPersonIds = useMemo(
    () => new Set(people.filter(p => !!user?.id && p.authUserId === user.id).map(p => p.id)),
    [people, user?.id]
  );

  const ctx: TodayContext = useMemo(
    () => ({ today, userId: user?.id, myPersonIds, scope }),
    [today, user?.id, myPersonIds, scope]
  );

  const sections = useMemo(() => buildTodaySections(allTasks, projectsById, ctx), [allTasks, projectsById, ctx]);
  const summary = useMemo(() => summarize(sections), [sections]);

  return { today, scope, setScope, sections, summary, projectsById, ctx };
}
