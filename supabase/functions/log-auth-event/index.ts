import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Grava eventos de autenticação que acontecem SEM sessão (login com falha,
// cadastro). O RLS de activity_logs só aceita insert autenticado com o próprio
// user_id, então estes eventos chegam aqui e são gravados com a service role.
//
// Regras: só os tipos abaixo; user_id do cliente é ignorado; IP e user-agent
// vêm dos headers no servidor; payload até 2 KB; e-mail até 254 caracteres,
// sanitizado; rate limit por IP; resposta sempre 204 (não revela se gravou).

const corsHeaders = {
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

// Rate limit: no máximo RATE_LIMIT_MAX eventos por IP a cada RATE_LIMIT_WINDOW_MIN
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MIN = 10

const noContent = () => new Response(null, { status: 204, headers: corsHeaders })

// Remove caracteres de controle e de marcação; colapsa espaços
function sanitize(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const clean = value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
  return clean || null
}

function clientIp(req: Request): string | null {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim().slice(0, 64)
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 64)
  return req.headers.get('x-real-ip')?.trim().slice(0, 64) ?? null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return noContent()
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
    const ip = clientIp(req)
    const userAgent = req.headers.get('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH) ?? null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Sem IP não há como limitar: descarta em vez de abrir brecha
    if (!ip) return noContent()

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString()
    const { count, error: countError } = await supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gte('created_at', since)
    if (countError || (count ?? 0) >= RATE_LIMIT_MAX) return noContent()

    const { error } = await supabase.from('activity_logs').insert({
      user_id: null,
      user_email: email,
      action,
      details,
      level: config.level,
      metadata: { source: 'log-auth-event' },
      ip_address: ip,
      user_agent: userAgent,
    })
    if (error) console.error('[log-auth-event] erro ao gravar:', error.message)
  } catch (err) {
    console.error('[log-auth-event] erro:', (err as Error).message)
  }

  return noContent()
})
