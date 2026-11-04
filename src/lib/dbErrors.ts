// Mensagens claras (pt-BR) para erros do banco, em vez do texto técnico do Postgres.

type DbErrorLike = { code?: string; message?: string } | null | undefined;

/** Código do Postgres para "violou row-level security" / sem permissão */
export const PERMISSION_DENIED = '42501';

/** true quando o banco recusou a ação por falta de permissão (RLS) */
export function isPermissionError(error: unknown): boolean {
  const e = error as DbErrorLike;
  if (!e) return false;
  return e.code === PERMISSION_DENIED || /row-level security|permission denied/i.test(e.message ?? '');
}

/** Erro de permissão com o mesmo formato do PostgREST, para casos detectados no cliente */
export function permissionError(message = 'Sem permissão para esta ação'): Error & { code: string } {
  return Object.assign(new Error(message), { code: PERMISSION_DENIED });
}

/**
 * Converte o erro em mensagem para o usuário.
 * @param permissionMessage texto quando o banco recusou por permissão
 * @param fallback texto para qualquer outro erro
 */
export function friendlyDbError(error: unknown, permissionMessage: string, fallback: string): string {
  if (isPermissionError(error)) return permissionMessage;
  return fallback;
}
