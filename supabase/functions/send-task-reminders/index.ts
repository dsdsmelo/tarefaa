import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.tarefaa.com.br'

type ReminderBucket = 'today' | 'tomorrow'

interface TaskRow {
  id: string
  name: string
  priority: string | null
  end_date: string
  responsible_ids: string[] | null
  project_id: string
  projects?: { name: string } | null
}

interface PersonRow {
  id: string
  name: string
  email: string | null
  active: boolean
}

function formatDateSaoPaulo(d: Date): string {
  // America/Sao_Paulo is UTC-3 (no DST since 2019)
  const sp = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const y = sp.getUTCFullYear()
  const m = String(sp.getUTCMonth() + 1).padStart(2, '0')
  const day = String(sp.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

const priorityColors: Record<string, string> = {
  low: '#6b7280',
  medium: '#2563eb',
  high: '#d97706',
  urgent: '#dc2626',
}

function renderEmailHtml(
  personName: string,
  tasksToday: TaskRow[],
  tasksTomorrow: TaskRow[]
): string {
  const renderTaskList = (tasks: TaskRow[]) => tasks.map((t) => {
    const projectName = t.projects?.name ? escapeHtml(t.projects.name) : 'Sem projeto'
    const pKey = (t.priority ?? 'medium').toLowerCase()
    const pLabel = priorityLabels[pKey] ?? 'Média'
    const pColor = priorityColors[pKey] ?? '#2563eb'
    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:15px;font-weight:600;color:#111827;margin-bottom:4px;">${escapeHtml(t.name)}</div>
          <div style="font-size:13px;color:#6b7280;">${projectName}</div>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">
          <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;color:#ffffff;background:${pColor};">${pLabel}</span>
        </td>
      </tr>`
  }).join('')

  const sectionToday = tasksToday.length > 0 ? `
    <h2 style="font-size:16px;color:#dc2626;margin:24px 0 8px 0;">⚠️ Vencem hoje (${tasksToday.length})</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${renderTaskList(tasksToday)}
    </table>` : ''

  const sectionTomorrow = tasksTomorrow.length > 0 ? `
    <h2 style="font-size:16px;color:#d97706;margin:24px 0 8px 0;">🔔 Vencem amanhã (${tasksTomorrow.length})</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${renderTaskList(tasksTomorrow)}
    </table>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Lembrete de tarefas</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px 32px 16px 32px;">
          <div style="font-size:22px;font-weight:700;color:#1e40af;margin-bottom:4px;">Tarefaa</div>
          <div style="font-size:13px;color:#6b7280;">Lembrete de tarefas</div>
        </td></tr>
        <tr><td style="padding:0 32px 8px 32px;">
          <h1 style="font-size:20px;color:#111827;margin:8px 0;">Olá, ${escapeHtml(personName)}!</h1>
          <p style="font-size:15px;color:#374151;line-height:1.5;margin:0 0 8px 0;">
            Aqui está o resumo das suas tarefas com prazo próximo:
          </p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          ${sectionToday}
          ${sectionTomorrow}
        </td></tr>
        <tr><td style="padding:32px;text-align:center;">
          <a href="${APP_URL}" style="display:inline-block;padding:12px 32px;background:#1e40af;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
            Abrir Tarefaa
          </a>
        </td></tr>
        <tr><td style="padding:16px 32px 32px 32px;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.5;">
            Você recebeu este email porque está como responsável em tarefas no Tarefaa.<br>
            © ${new Date().getFullYear()} Tarefaa. Todos os direitos reservados.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function renderEmailText(personName: string, tasksToday: TaskRow[], tasksTomorrow: TaskRow[]): string {
  const lines: string[] = [`Olá, ${personName}!`, '', 'Resumo de tarefas com prazo próximo:', '']
  if (tasksToday.length > 0) {
    lines.push(`VENCEM HOJE (${tasksToday.length}):`)
    tasksToday.forEach((t) => lines.push(`  - ${t.name}${t.projects?.name ? ` (${t.projects.name})` : ''}`))
    lines.push('')
  }
  if (tasksTomorrow.length > 0) {
    lines.push(`VENCEM AMANHÃ (${tasksTomorrow.length}):`)
    tasksTomorrow.forEach((t) => lines.push(`  - ${t.name}${t.projects?.name ? ` (${t.projects.name})` : ''}`))
    lines.push('')
  }
  lines.push(`Abra o Tarefaa: ${APP_URL}`)
  return lines.join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Proteção: exige header x-cron-secret OU chamada autenticada
    const cronSecret = Deno.env.get('CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')
    const authHeader = req.headers.get('Authorization')
    if (cronSecret && providedSecret !== cronSecret && !authHeader) {
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

    // 1) Busca todas as tarefas que vencem hoje ou amanhã
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, name, priority, end_date, responsible_ids, project_id, status, projects(name)')
      .in('end_date', [today, tomorrow])
      .not('status', 'in', '(completed,cancelled)')
      .not('responsible_ids', 'is', null)

    if (tasksError) {
      console.error('[send-task-reminders] erro ao buscar tasks:', tasksError)
      throw tasksError
    }

    const activeTasks = (tasks ?? []).filter((t: any) =>
      Array.isArray(t.responsible_ids) && t.responsible_ids.length > 0
    ) as TaskRow[]

    if (activeTasks.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'Nenhuma tarefa com prazo hoje ou amanhã' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2) Junta todos os personIds únicos
    const personIds = [...new Set(activeTasks.flatMap((t) => t.responsible_ids ?? []))]

    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, name, email, active')
      .in('id', personIds)

    if (peopleError) {
      console.error('[send-task-reminders] erro ao buscar people:', peopleError)
      throw peopleError
    }

    const peopleById = new Map<string, PersonRow>()
    for (const p of (people ?? []) as PersonRow[]) peopleById.set(p.id, p)

    // 3) Agrupa tarefas por pessoa (com email válido e ativa)
    const tasksByPerson = new Map<string, { person: PersonRow; today: TaskRow[]; tomorrow: TaskRow[] }>()
    for (const task of activeTasks) {
      const bucket: ReminderBucket = task.end_date === today ? 'today' : 'tomorrow'
      for (const pid of task.responsible_ids ?? []) {
        const person = peopleById.get(pid)
        if (!person || !person.email || !person.active) continue
        let entry = tasksByPerson.get(pid)
        if (!entry) {
          entry = { person, today: [], tomorrow: [] }
          tasksByPerson.set(pid, entry)
        }
        if (bucket === 'today') entry.today.push(task)
        else entry.tomorrow.push(task)
      }
    }

    if (tasksByPerson.size === 0) {
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

    for (const [pid, { person, today: tt, tomorrow: tm }] of tasksByPerson) {
      try {
        const html = renderEmailHtml(person.name, tt, tm)
        const text = renderEmailText(person.name, tt, tm)
        const totalCount = tt.length + tm.length
        const subject = tt.length > 0
          ? `⚠️ ${tt.length} ${tt.length === 1 ? 'tarefa vence' : 'tarefas vencem'} hoje`
          : `🔔 ${tm.length} ${tm.length === 1 ? 'tarefa vence' : 'tarefas vencem'} amanhã`

        await smtpClient.send({
          from: `Tarefaa <${smtpFrom}>`,
          to: person.email!,
          subject,
          content: text,
          html,
        })
        sent++
        console.log(`[send-task-reminders] enviado para ${person.email} (${totalCount} tarefas)`)
      } catch (err) {
        console.error(`[send-task-reminders] erro ao enviar para ${person.email}:`, err)
        errors.push({ personId: pid, error: (err as Error).message })
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
