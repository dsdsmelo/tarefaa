// Pessoas por workspace (Etapa 4, item 4).
// Regra: pessoas do workspace do contexto + as marcadas "Todos os workspaces"
// (workspace_id nulo). Sem workspace no contexto (Caixa de entrada, captura sem
// #projeto), todas. Quem já está selecionado ou é membro do projeto continua na
// lista, para nada sumir de um seletor.
import type { Person } from './types';

export function peopleForWorkspace<T extends Pick<Person, 'id' | 'active' | 'workspaceId'>>(
  people: T[],
  workspaceId: string | null | undefined,
  keepIds: Iterable<string> = [],
): T[] {
  const keep = new Set(keepIds);
  return people.filter(p => {
    if (keep.has(p.id)) return true;
    if (p.active === false) return false;
    if (!workspaceId) return true;
    return !p.workspaceId || p.workspaceId === workspaceId;
  });
}
