// Parte pura do e-mail de lembretes: agrupa por pessoa e monta o HTML/texto.
// Sem Deno nem rede, para testar no vitest (src/test/sendTaskReminders.test.ts).
//
// Regras (Etapa 4, decisões D1 a D3):
// - quem recebe: os RESPONSÁVEIS da tarefa (pessoa ativa com e-mail). A pessoa
//   de quem se espera (waiting_on) nunca recebe e-mail;
// - "Vencem hoje/amanhã": tarefas abertas que não estão Aguardando;
// - "Cobranças de hoje": Aguardando com follow_up_date <= hoje, com "atrasada há
//   N dias"; o e-mail se repete todo dia até a tarefa sair de Aguardando;
// - tarefas de projetos em Ideia ficam fora.

export interface TaskRow {
  id: string
  name: string
  priority: string | null
  status?: string | null
  end_date: string | null
  follow_up_date?: string | null
  waiting_on_person_id?: string | null
  waiting_on_text?: string | null
  responsible_ids: string[] | null
  project_id: string
  projects?: { name: string; status?: string | null } | null
}

export interface PersonRow {
  id: string
  name: string
  email: string | null
  active: boolean
}

export interface Digest {
  person: PersonRow
  today: TaskRow[]
  tomorrow: TaskRow[]
  followUps: TaskRow[]
}

const isIdea = (t: TaskRow) => t.projects?.status === 'idea'

/** Agrupa as tarefas por responsável que pode receber e-mail */
export function buildDigests(input: {
  dueTasks: TaskRow[]
  followUpTasks: TaskRow[]
  people: PersonRow[]
  today: string
}): Digest[] {
  const peopleById = new Map(input.people.map((p) => [p.id, p]))
  const byPerson = new Map<string, Digest>()
  const add = (task: TaskRow, bucket: 'today' | 'tomorrow' | 'followUps') => {
    for (const pid of task.responsible_ids ?? []) {
      const person = peopleById.get(pid)
      if (!person || !person.email || !person.active) continue
      let entry = byPerson.get(pid)
      if (!entry) {
        entry = { person, today: [], tomorrow: [], followUps: [] }
        byPerson.set(pid, entry)
      }
      if (!entry[bucket].some((t) => t.id === task.id)) entry[bucket].push(task)
    }
  }
  for (const task of input.dueTasks) {
    if (isIdea(task) || task.status === 'waiting') continue
    add(task, task.end_date === input.today ? 'today' : 'tomorrow')
  }
  for (const task of input.followUpTasks) {
    if (isIdea(task) || task.status !== 'waiting' || !task.follow_up_date || task.follow_up_date > input.today) continue
    add(task, 'followUps')
  }
  for (const entry of byPerson.values()) {
    entry.followUps.sort((a, b) => (a.follow_up_date ?? '').localeCompare(b.follow_up_date ?? ''))
  }
  return [...byPerson.values()]
}

/** Dias entre duas datas "YYYY-MM-DD" (b - a) */
export function daysBetween(a: string, b: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const priorityLabels: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' }
const priorityColors: Record<string, string> = { low: '#6b7280', medium: '#2563eb', high: '#d97706', urgent: '#dc2626' }

/** "Aguardando Maria · atrasada há 2 dias · prazo 10/11" */
export function followUpLine(t: TaskRow, today: string, waitingOnNames: Map<string, string>): string {
  const who = t.waiting_on_person_id ? waitingOnNames.get(t.waiting_on_person_id) : t.waiting_on_text
  const late = t.follow_up_date ? daysBetween(t.follow_up_date, today) : 0
  const parts = [who ? `Aguardando ${who}` : 'Aguardando']
  parts.push(late > 0 ? `atrasada há ${late} ${late === 1 ? 'dia' : 'dias'}` : 'cobrar hoje')
  if (t.end_date) parts.push(`prazo ${t.end_date.slice(8, 10)}/${t.end_date.slice(5, 7)}`)
  return parts.join(' · ')
}

function renderTaskRow(t: TaskRow, subline?: string): string {
  const projectName = t.projects?.name ? escapeHtml(t.projects.name) : 'Sem projeto'
  const pKey = (t.priority ?? 'medium').toLowerCase()
  const pLabel = priorityLabels[pKey] ?? 'Média'
  const pColor = priorityColors[pKey] ?? '#2563eb'
  return [
    '<tr>',
    '<td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top;">',
    `<div style="font-size:15px;font-weight:600;color:#111827;margin-bottom:2px;">${escapeHtml(t.name)}</div>`,
    `<div style="font-size:13px;color:#6b7280;">${projectName}</div>`,
    subline ? `<div style="font-size:13px;color:#7c3aed;margin-top:2px;">${escapeHtml(subline)}</div>` : '',
    '</td>',
    '<td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;vertical-align:top;">',
    `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;color:#ffffff;background:${pColor};">${pLabel}</span>`,
    '</td>',
    '</tr>',
  ].join('')
}

function renderSection(title: string, color: string, rows: string[]): string {
  if (rows.length === 0) return ''
  return [
    `<h2 style="font-size:16px;color:${color};margin:24px 0 10px 0;font-weight:600;">${title} (${rows.length})</h2>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">',
    '<tbody>',
    rows.join(''),
    '</tbody>',
    '</table>',
  ].join('')
}

export function renderEmailHtml(d: Digest, today: string, waitingOnNames: Map<string, string>, appUrl: string): string {
  const sections = [
    renderSection('⚠️ Vencem hoje', '#dc2626', d.today.map((t) => renderTaskRow(t))),
    renderSection('📌 Cobranças de hoje', '#7c3aed', d.followUps.map((t) => renderTaskRow(t, followUpLine(t, today, waitingOnNames)))),
    renderSection('🔔 Vencem amanhã', '#d97706', d.tomorrow.map((t) => renderTaskRow(t))),
  ].filter(Boolean).join('')

  const year = new Date().getFullYear()
  const firstName = escapeHtml(d.person.name.split(' ')[0] || d.person.name)

  return [
    '<!DOCTYPE html>',
    '<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lembrete de tarefas</title></head>',
    '<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">',
    '<tr><td style="padding:32px 32px 8px 32px;">',
    '<div style="font-size:22px;font-weight:700;color:#1e40af;line-height:1;">Tarefaa</div>',
    '<div style="font-size:13px;color:#6b7280;margin-top:4px;">Lembrete de tarefas</div>',
    '</td></tr>',
    '<tr><td style="padding:16px 32px 0 32px;">',
    `<h1 style="font-size:20px;color:#111827;margin:0 0 8px 0;font-weight:700;">Olá, ${firstName}!</h1>`,
    '<p style="font-size:15px;color:#374151;line-height:1.5;margin:0;">Aqui está o resumo das suas tarefas com prazo próximo e das cobranças do dia:</p>',
    '</td></tr>',
    '<tr><td style="padding:0 32px;">',
    sections,
    '</td></tr>',
    '<tr><td style="padding:32px;text-align:center;">',
    `<a href="${appUrl}/today" style="display:inline-block;padding:12px 32px;background:#1e40af;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Abrir o dia no Tarefaa</a>`,
    '</td></tr>',
    '<tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #e5e7eb;">',
    '<p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.5;">',
    'Você recebeu este email porque está como responsável em tarefas no Tarefaa.<br>',
    `© ${year} Tarefaa. Todos os direitos reservados.`,
    '</p>',
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body></html>',
  ].join('')
}

export function renderEmailText(d: Digest, today: string, waitingOnNames: Map<string, string>, appUrl: string): string {
  const lines: string[] = [`Olá, ${d.person.name}!`, '', 'Resumo das suas tarefas com prazo próximo e das cobranças do dia:', '']
  const project = (t: TaskRow) => (t.projects?.name ? ` (${t.projects.name})` : '')
  if (d.today.length > 0) {
    lines.push(`VENCEM HOJE (${d.today.length}):`)
    d.today.forEach((t) => lines.push(`  - ${t.name}${project(t)}`))
    lines.push('')
  }
  if (d.followUps.length > 0) {
    lines.push(`COBRANÇAS DE HOJE (${d.followUps.length}):`)
    d.followUps.forEach((t) => lines.push(`  - ${t.name}${project(t)}: ${followUpLine(t, today, waitingOnNames)}`))
    lines.push('')
  }
  if (d.tomorrow.length > 0) {
    lines.push(`VENCEM AMANHÃ (${d.tomorrow.length}):`)
    d.tomorrow.forEach((t) => lines.push(`  - ${t.name}${project(t)}`))
    lines.push('')
  }
  lines.push(`Abra o Tarefaa: ${appUrl}/today`)
  return lines.join('\n')
}

/** Assunto: o mais urgente primeiro */
export function emailSubject(d: Digest): string {
  const parts: string[] = []
  if (d.today.length > 0) parts.push(`⚠️ ${d.today.length} ${d.today.length === 1 ? 'tarefa vence' : 'tarefas vencem'} hoje`)
  if (d.followUps.length > 0) parts.push(`📌 ${d.followUps.length} ${d.followUps.length === 1 ? 'cobrança' : 'cobranças'} hoje`)
  if (d.tomorrow.length > 0 && parts.length === 0) parts.push(`🔔 ${d.tomorrow.length} ${d.tomorrow.length === 1 ? 'tarefa vence' : 'tarefas vencem'} amanhã`)
  return parts.join(' · ')
}
