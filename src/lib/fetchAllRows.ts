// A API do Supabase devolve no máximo 1000 linhas por requisição (max_rows).
// Sem paginação, o excedente some da tela sem erro.
export const PAGE_SIZE = 1000;

// .in() com muitos ids estoura o tamanho da URL da requisição: divide em lotes
export const IN_CHUNK_SIZE = 150;

interface PageResponse {
  // O tipo das linhas vem do chamador (fetchAllRows<T>): o cliente do app não é tipado
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

interface RangeableQuery {
  range(from: number, to: number): PromiseLike<PageResponse>;
}

/**
 * Busca todas as linhas de uma consulta, página por página.
 * `query` deve criar a consulta do zero a cada chamada, com ordenação estável
 * (termine com .order('id')) — sem isso, linhas com o mesmo valor de ordenação
 * podem duplicar ou sumir entre páginas. Use select(..., { count: 'exact' }) para
 * a paginação não depender do limite configurado no servidor.
 * Qualquer erro em qualquer página é lançado (nunca devolve dados parciais).
 */
export async function fetchAllRows<T>(query: () => RangeableQuery, pageSize = PAGE_SIZE): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error, count } = await query().range(from, from + pageSize - 1);
    if (error) throw error;

    const page = (Array.isArray(data) ? data : []) as T[];
    rows.push(...page);

    if (page.length === 0) break;
    if (typeof count === 'number') {
      if (rows.length >= count) break;
    } else if (page.length < pageSize) {
      break;
    }
    from += page.length;
  }

  return rows;
}

/** Como fetchAllRows, para consultas filtradas por uma lista grande de ids (.in). */
export async function fetchAllRowsByIds<T>(
  ids: string[],
  query: (chunk: string[]) => RangeableQuery,
  chunkSize = IN_CHUNK_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    rows.push(...(await fetchAllRows<T>(() => query(chunk))));
  }
  return rows;
}
