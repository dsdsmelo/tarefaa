// IP do cliente para Edge Functions do Supabase, só de headers da plataforma.
//
// Teste prático em produção (2026-11-04):
//   - cf-connecting-ip: escrito pela Cloudflare; valor forjado é recusado (error 1000);
//   - sb-forwarded-for: escrito pelo Supabase, mesmo valor do cf-connecting-ip;
//   - x-forwarded-for: o valor do cliente é descartado, mas NÃO é usado aqui;
//   - x-real-ip: não chega na função.
// Ordem: cf-connecting-ip → sb-forwarded-for → nenhum (null).
// Valor inválido conta como header ausente. x-forwarded-for e x-real-ip nunca são lidos.
//
// Sem dependências do Deno: testado com vitest (src/test/clientIp.test.ts).

export interface ClientIp {
  /** IP normalizado, para gravar no log */
  ip: string
  /** Chave do rate limit: IPv4 exato ou prefixo /64 do IPv6 */
  bucket: string
}

interface HeaderReader {
  get(name: string): string | null
}

const TRUSTED_HEADERS = ['cf-connecting-ip', 'sb-forwarded-for'] as const
const MAX_IP_LENGTH = 45

// 0–255 sem zero à esquerda
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`)
const HEX_GROUP = /^[0-9a-f]{1,4}$/i

function parseIPv4(value: string): number[] | null {
  if (!IPV4.test(value)) return null
  return value.split('.').map(Number)
}

/** IPv6 → 8 grupos de 16 bits, ou null se inválido */
function parseIPv6(value: string): number[] | null {
  if (!value.includes(':')) return null

  // IPv4 embutido no fim (ex.: ::ffff:203.0.113.7) vira 2 grupos
  let tail: number[] = []
  let text = value
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':')
    const v4 = parseIPv4(value.slice(lastColon + 1))
    if (!v4) return null
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]]
    text = value.slice(0, lastColon + 1)
    // "::ffff:" termina com ':' simples; "::" final continua sendo compressão
    if (text.endsWith(':') && !text.endsWith('::')) text = text.slice(0, -1)
  }

  const halves = text.split('::')
  if (halves.length > 2) return null

  const parseGroups = (part: string): number[] | null => {
    if (part === '') return []
    const groups = part.split(':')
    if (!groups.every((g) => HEX_GROUP.test(g))) return null
    return groups.map((g) => parseInt(g, 16))
  }

  const head = parseGroups(halves[0])
  const rest = halves.length === 2 ? parseGroups(halves[1]) : []
  if (!head || !rest) return null

  const explicit = head.length + rest.length + tail.length
  if (halves.length === 2) {
    if (explicit > 7) return null
    return [...head, ...new Array(8 - explicit).fill(0), ...rest, ...tail]
  }
  return explicit === 8 ? [...head, ...tail] : null
}

/** Forma canônica (RFC 5952): minúsculas, sem zeros à esquerda, maior sequência de zeros comprimida */
function formatIPv6(groups: number[]): string {
  let bestStart = -1
  let bestLength = 0
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) { i++; continue }
    let j = i
    while (j < 8 && groups[j] === 0) j++
    if (j - i > bestLength && j - i >= 2) { bestStart = i; bestLength = j - i }
    i = j
  }
  const hex = groups.map((g) => g.toString(16))
  if (bestStart === -1) return hex.join(':')
  const left = hex.slice(0, bestStart).join(':')
  const right = hex.slice(bestStart + bestLength).join(':')
  return `${left}::${right}`
}

/** Valida e normaliza um IP; devolve null se inválido */
export function normalizeIp(raw: string | null | undefined): ClientIp | null {
  const value = raw?.trim() ?? ''
  if (!value || value.length > MAX_IP_LENGTH) return null

  const v4 = parseIPv4(value)
  if (v4) return { ip: value, bucket: `ip4:${value}` }

  const v6 = parseIPv6(value)
  if (!v6) return null

  // IPv4 representado em IPv6 (::ffff:a.b.c.d): mesmo bucket do IPv4
  if (v6.slice(0, 5).every((g) => g === 0) && v6[5] === 0xffff) {
    const ip = [v6[6] >> 8, v6[6] & 0xff, v6[7] >> 8, v6[7] & 0xff].join('.')
    return { ip, bucket: `ip4:${ip}` }
  }

  const prefix = v6.slice(0, 4).map((g) => g.toString(16)).join(':')
  return { ip: formatIPv6(v6), bucket: `ip6:${prefix}/64` }
}

/** IP do cliente pelos headers confiáveis, na ordem; null = nenhum válido */
export function resolveClientIp(headers: HeaderReader): ClientIp | null {
  for (const name of TRUSTED_HEADERS) {
    const resolved = normalizeIp(headers.get(name))
    if (resolved) return resolved
  }
  return null
}
