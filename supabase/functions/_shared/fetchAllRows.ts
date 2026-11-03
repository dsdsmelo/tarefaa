// Paginação para as Edge Functions: a API devolve no máximo 1000 linhas por
// requisição (max_rows). Mesma lógica de src/lib/fetchAllRows.ts.

export const PAGE_SIZE = 1000
export const IN_CHUNK_SIZE = 150

interface PageResponse {
  data: unknown
  error: { message: string } | null
  count?: number | null
}

interface RangeableQuery {
  range(from: number, to: number): PromiseLike<PageResponse>
}

// `query` cria a consulta do zero a cada página, com ordenação estável (termine
// com .order('id')) e select(..., { count: 'exact' }). Erros são lançados.
export async function fetchAllRows<T>(query: () => RangeableQuery, pageSize = PAGE_SIZE): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  for (;;) {
    const { data, error, count } = await query().range(from, from + pageSize - 1)
    if (error) throw error
    const page = (Array.isArray(data) ? data : []) as T[]
    rows.push(...page)
    if (page.length === 0) break
    if (typeof count === 'number') {
      if (rows.length >= count) break
    } else if (page.length < pageSize) {
      break
    }
    from += page.length
  }
  return rows
}

// Para filtros .in() com muitos ids (evita URL longa demais)
export async function fetchAllRowsByIds<T>(
  ids: string[],
  query: (chunk: string[]) => RangeableQuery,
  chunkSize = IN_CHUNK_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    rows.push(...(await fetchAllRows<T>(() => query(chunk))))
  }
  return rows
}
