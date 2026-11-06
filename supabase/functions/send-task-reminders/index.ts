import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { fetchAllRows, fetchAllRowsByIds } from '../_shared/fetchAllRows.ts'
import { buildDigests, emailSubject, renderEmailHtml, renderEmailText, type PersonRow, type TaskRow } from './digest.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.tarefaa.com.br'

function formatDateSaoPaulo(d: Date): string {
  // America/Sao_Paulo is UTC-3 (no DST since 2019)
  const sp = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const y = sp.getUTCFullYear()
  const m = String(sp.getUTCMonth() + 1).padStart(2, '0')
  const day = String(sp.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Proteção (fail-closed): exige SEMPRE o segredo de cron correto.
    // Sem CRON_SECRET configurado, ou com segredo ausente/errado, rejeita.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const smtpHost = Deno.env.get('SMTP_HOST') ?? 'smtp.zoho.com'
    const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '465')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')
    const smtpFrom = Deno.env.get('SMTP_FROM') ?? smtpUser

    if (!smtpUser || !smtpPassword) {
      return new Response(JSON.stringify({ error: 'SMTP não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const now = new Date()
    const today = formatDateSaoPaulo(now)
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const tomorrow = formatDateSaoPaulo(tomorrowDate)

    // 1) Tarefas abertas que vencem hoje ou amanhã (fora as Aguardando) e as
    //    cobranças do dia (Aguardando com follow_up_date <= hoje). Todos os
    //    usuários, paginado. Projetos em Ideia saem em buildDigests.
    const select = 'id, name, priority, status, end_date, follow_up_date, waiting_on_person_id, waiting_on_text, responsible_ids, project_id, projects(name, status)'
    let dueTasks: TaskRow[]
    let followUpTasks: TaskRow[]
    try {
      dueTasks = await fetchAllRows<TaskRow>(() =>
        supabase
          .from('tasks')
          .select(select, { count: 'exact' })
          .in('end_date', [today, tomorrow])
          .not('status', 'in', '(completed,cancelled,waiting)')
          .not('responsible_ids', 'is', null)
          .order('id')
      )
      followUpTasks = await fetchAllRows<TaskRow>(() =>
        supabase
          .from('tasks')
          .select(select, { count: 'exact' })
          .eq('status', 'waiting')
          .lte('follow_up_date', today)
          .not('responsible_ids', 'is', null)
          .order('id')
      )
    } catch (tasksError) {
      console.error('[send-task-reminders] erro ao buscar tasks:', tasksError)
      throw tasksError
    }

    const withResponsible = (t: TaskRow) => Array.isArray(t.responsible_ids) && t.responsible_ids.length > 0
    dueTasks = dueTasks.filter(withResponsible)
    followUpTasks = followUpTasks.filter(withResponsible)

    if (dueTasks.length === 0 && followUpTasks.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'Nenhuma tarefa com prazo hoje/amanhã nem cobrança hoje' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2) Responsáveis (destinatários) e pessoas de quem se espera (só o nome)
    const personIds = [...new Set([
      ...[...dueTasks, ...followUpTasks].flatMap((t) => t.responsible_ids ?? []),
      ...followUpTasks.map((t) => t.waiting_on_person_id).filter((id): id is string => !!id),
    ])]

    let people: PersonRow[]
    try {
      people = await fetchAllRowsByIds<PersonRow>(personIds, (chunk) =>
        supabase.from('people').select('id, name, email, active', { count: 'exact' }).in('id', chunk).order('id')
      )
    } catch (peopleError) {
      console.error('[send-task-reminders] erro ao buscar people:', peopleError)
      throw peopleError
    }
    const waitingOnNames = new Map(people.map((p) => [p.id, p.name]))

    // 3) Agrupa por responsável (ativo e com e-mail)
    const digests = buildDigests({ dueTasks, followUpTasks, people, today })

    if (digests.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'Nenhum responsável com email para notificar' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4) Envia emails via SMTP
    const smtpClient = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUser, password: smtpPassword },
      },
    })

    let sent = 0
    const errors: { personId: string; error: string }[] = []

    for (const digest of digests) {
      const { person } = digest
      try {
        const totalCount = digest.today.length + digest.tomorrow.length + digest.followUps.length
        await smtpClient.send({
          from: `Tarefaa <${smtpFrom}>`,
          to: person.email!,
          subject: emailSubject(digest),
          content: renderEmailText(digest, today, waitingOnNames, APP_URL),
          html: renderEmailHtml(digest, today, waitingOnNames, APP_URL),
        })
        sent++
        console.log(`[send-task-reminders] enviado para ${person.email} (${totalCount} itens)`)
      } catch (err) {
        console.error(`[send-task-reminders] erro ao enviar para ${person.email}:`, err)
        errors.push({ personId: person.id, error: (err as Error).message })
      }
    }

    await smtpClient.close()

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed: errors.length,
      today,
      tomorrow,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[send-task-reminders] erro:', error)
    return new Response(JSON.stringify({ error: (error as Error).message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
