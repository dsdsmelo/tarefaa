import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REDIRECT_TO = 'https://app.tarefaa.com.br/reset-password'

function renderInviteHtml(firstName: string, inviterName: string, actionLink: string) {
  const hi = firstName ? `Olá, ${firstName}!` : 'Olá!'
  return `<!DOCTYPE html>
<div style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
        <tr><td style="background:#0f172a;padding:28px 40px;text-align:center">
          <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">Tarefaa</span>
        </td></tr>
        <tr><td style="padding:40px 40px 0">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3">Você foi convidado para colaborar</h1>
          <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6">${hi} <strong style="color:#0f172a">${inviterName}</strong> convidou você para colaborar no Tarefaa. Clique no botão abaixo para definir sua senha e acessar o projeto.</p>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <a href="${actionLink}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600">Definir minha senha e acessar</a>
        </td></tr>
        <tr><td style="padding:0 40px 40px">
          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6">Este link é válido por 24 horas. Se você não esperava este convite, pode ignorar este e-mail com segurança.</p>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #f1f5f9;text-align:center">
          <p style="margin:0;font-size:12px;color:#94a3b8">© 2026 Tarefaa · <a href="https://tarefaa.com.br" style="color:#94a3b8">tarefaa.com.br</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`
}

function renderInviteText(firstName: string, inviterName: string, actionLink: string) {
  const hi = firstName ? `Olá, ${firstName}!` : 'Olá!'
  return `${hi}

${inviterName} convidou você para colaborar no Tarefaa.

Defina sua senha e acesse: ${actionLink}

Este link é válido por 24 horas. Se você não esperava este convite, ignore este e-mail.

Tarefaa · tarefaa.com.br`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticação do gestor
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { personId, email, firstName, lastName } = await req.json()

    if (!personId || !email || !firstName) {
      return new Response(JSON.stringify({ error: 'personId, email e firstName são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verificar se a pessoa pertence ao gestor
    const { data: person, error: personError } = await supabaseAdmin
      .from('people')
      .select('id, name, email, invite_status, auth_user_id')
      .eq('id', personId)
      .eq('user_id', user.id)
      .single()

    if (personError || !person) {
      return new Response(JSON.stringify({ error: 'Pessoa não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Se já tem auth_user_id, já aceitou/possui o convite
    if (person.auth_user_id) {
      return new Response(JSON.stringify({ error: 'Participante já possui acesso' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Config SMTP (reutiliza o mesmo Zoho dos lembretes)
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

    // Nome de quem convida (para personalizar o e-mail)
    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    const inviterName = inviterProfile?.full_name?.trim() || 'A equipe do Tarefaa'

    // Gera o link de convite (cria o usuário e retorna o link) SEM enviar
    // o e-mail padrão do Supabase — assim não usamos o template de cobrança.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: {
          full_name: `${firstName} ${lastName || ''}`.trim(),
          first_name: firstName,
          last_name: lastName || '',
          is_participant: true,
          invited_by: user.id,
        },
        redirectTo: REDIRECT_TO,
      },
    })

    const actionLink = linkData?.properties?.action_link
    const invitedAuthUserId = linkData?.user?.id
    if (linkError || !actionLink || !invitedAuthUserId) {
      console.error('Erro ao gerar link de convite:', linkError)
      return new Response(JSON.stringify({ error: linkError?.message ?? 'Não foi possível gerar o convite' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Vincula auth_user_id imediatamente (elo do RLS) + dados do convite
    const { error: updateError } = await supabaseAdmin
      .from('people')
      .update({
        email,
        first_name: firstName,
        last_name: lastName || '',
        invite_status: 'pending',
        auth_user_id: invitedAuthUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', personId)
    if (updateError) {
      console.error('Erro ao atualizar pessoa:', updateError)
    }

    // Envia o e-mail de convite (visual de colaborador) pelo SMTP Zoho
    try {
      const smtpClient = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port: smtpPort,
          tls: true,
          auth: { username: smtpUser, password: smtpPassword },
        },
      })
      await smtpClient.send({
        from: `Tarefaa <${smtpFrom}>`,
        to: email,
        subject: 'Você foi convidado para colaborar no Tarefaa',
        content: renderInviteText(firstName, inviterName, actionLink),
        html: renderInviteHtml(firstName, inviterName, actionLink),
      })
      await smtpClient.close()
    } catch (mailErr) {
      console.error('Erro ao enviar e-mail de convite:', mailErr)
      return new Response(JSON.stringify({
        error: 'Convite criado, mas o e-mail não pôde ser enviado. Verifique o SMTP.',
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[INVITE-PARTICIPANT] Convite enviado para ${email} (person: ${personId})`)

    return new Response(JSON.stringify({ success: true, message: 'Convite enviado com sucesso' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[INVITE-PARTICIPANT] Erro:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
