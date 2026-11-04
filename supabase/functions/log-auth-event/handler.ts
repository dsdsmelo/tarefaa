// Lógica da log-auth-event, separada do servidor para ser testada (vitest:
// src/test/logAuthEvent.test.ts). Sem dependências do Deno.
//
// Grava eventos de autenticação que acontecem SEM sessão (login com falha,
// cadastro). O RLS de activity_logs só aceita insert autenticado com o próprio
// user_id, então estes eventos chegam aqui e são gravados com a service role.
//
// Regras: só os tipos abaixo; user_id do cliente é ignorado; IP e user-agent
// vêm dos headers da plataforma (ver _shared/clientIp.ts); payload até 2 KB;
// e-mail até 254 caracteres, sanitizado; rate limit por bucket de IP e global
// (contador atômico no banco, função hit_rate_limit).
// Resposta: SEMPRE 204 sem corpo, em qualquer caminho (gravou, limite estourado,
// erro, IP ausente ou inválido), para não revelar nada ao cliente.

import { resolveClientIp } from '../_shared/clientIp.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_ACTIONS: Record<string, { level: string; defaultDetails: string }> = {
  login_failed: { level: 'warning', defaultDetails: 'Falha na autenticação' },
  signup: { level: 'success', defaultDetails: 'Nova conta criada' },
  signup_failed: { level: 'warning', defaultDetails: 'Falha no cadastro' },
  login_blocked: { level: 'error', defaultDetails: 'Login bloqueado' },
}

const MAX_PAYLOAD_BYTES = 2048
const MAX_EMAIL_LENGTH = 254
const MAX_DETAILS_LENGTH = 300
const MAX_USER_AGENT_LENGTH = 512

// Janela fixa de 10 min: 20 eventos por bucket de IP e 300 no total.
// O global é a rede de segurança para IP ausente/inválido ou troca de IP.
export const RATE_LIMIT_WINDOW_SECONDS = 600
export const RATE_LIMIT_PER_IP = 20
export const RATE_LIMIT_GLOBAL = 300

export interface AuthEventLogRow {
  user_id: null
  user_email: string | null
  action: string
  details: string
  level: string
  metadata: { source: 'log-auth-event' }
  ip_address: string | null
  user_agent: string | null
}

/** Acesso ao banco (service role). Erros devem ser lançados. */
export interface AuthEventDb {
  /** true = dentro do limite */
  hitRateLimit(bucket: string, max: number, windowSeconds: number): Promise<boolean>
  insertLog(row: AuthEventLogRow): Promise<void>
}

const noContent = () => new Response(null, { status: 204, headers: corsHeaders })

// Remove caracteres de controle e de marcação; colapsa espaços
function sanitize(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const clean = value
    // eslint-disable-next-line no-control-regex -- remover caracteres de controle é o objetivo
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
  return clean || null
}

// Erro no contador conta como bloqueado (falha fechada)
async function withinLimit(db: AuthEventDb, bucket: string, max: number): Promise<boolean> {
  try {
    return (await db.hitRateLimit(bucket, max, RATE_LIMIT_WINDOW_SECONDS)) === true
  } catch (err) {
    console.error('[log-auth-event] erro no rate limit:', (err as Error).message)
    return false
  }
}

export async function handleAuthEvent(req: Request, getDb: () => AuthEventDb): Promise<Response> {
  if (req.method !== 'POST') return noContent()

  try {
    const declaredLength = Number(req.headers.get('content-length') ?? '0')
    if (declaredLength > MAX_PAYLOAD_BYTES) return noContent()

    const raw = await req.text()
    if (new TextEncoder().encode(raw).length > MAX_PAYLOAD_BYTES) return noContent()

    let body: Record<string, unknown>
    try {
      body = JSON.parse(raw)
    } catch {
      return noContent()
    }
    if (!body || typeof body !== 'object') return noContent()

    const action = typeof body.action === 'string' ? body.action : ''
    const config = ALLOWED_ACTIONS[action]
    if (!config) return noContent()

    const email = sanitize(body.email, MAX_EMAIL_LENGTH)?.toLowerCase() ?? null
    const details = sanitize(body.details, MAX_DETAILS_LENGTH) ?? config.defaultDetails
    const client = resolveClientIp(req.headers)
    const userAgent = req.headers.get('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH) ?? null

    const db = getDb()

    // Primeiro o bucket do IP (quem estoura não consome o global), depois o global
    if (client && !(await withinLimit(db, client.bucket, RATE_LIMIT_PER_IP))) return noContent()
    if (!(await withinLimit(db, 'global', RATE_LIMIT_GLOBAL))) return noContent()

    await db.insertLog({
      user_id: null,
      user_email: email,
      action,
      details,
      level: config.level,
      metadata: { source: 'log-auth-event' },
      ip_address: client?.ip ?? null,
      user_agent: userAgent,
    })
  } catch (err) {
    console.error('[log-auth-event] erro:', (err as Error).message)
  }

  return noContent()
}
