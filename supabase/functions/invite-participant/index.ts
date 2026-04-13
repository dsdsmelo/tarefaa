import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Verificar se o usuário está autenticado
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

    // Se já tem auth_user_id, já aceitou o convite
    if (person.auth_user_id) {
      return new Response(JSON.stringify({ error: 'Participante já possui acesso' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Enviar convite via Supabase Auth
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: 'https://app.tarefaa.com.br/reset-password',
        data: {
          full_name: `${firstName} ${lastName || ''}`.trim(),
          first_name: firstName,
          last_name: lastName || '',
          is_participant: true,
          invited_by: user.id,
        }
      }
    )

    if (inviteError) {
      console.error('Erro ao enviar convite:', inviteError)
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Atualizar people com email, first_name, last_name e invite_status
    const { error: updateError } = await supabaseAdmin
      .from('people')
      .update({
        email,
        first_name: firstName,
        last_name: lastName || '',
        invite_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', personId)

    if (updateError) {
      console.error('Erro ao atualizar pessoa:', updateError)
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
