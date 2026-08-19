import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
const MAX_TRANSCRIPT_CHARS = 120_000

const SYSTEM_PROMPT = `Você redige atas de reunião corporativas em português do Brasil, a partir de transcrições/legendas.

Regras obrigatórias:
- Linguagem formal e corporativa. NUNCA use emojis.
- Não invente informações que não estejam na transcrição. Quando não houver dado para uma seção, escreva "Não identificado na transcrição".
- Seja objetivo e organizado. Não copie a transcrição literalmente; sintetize.
- Identifique participantes, decisões, responsáveis e prazos somente se aparecerem na transcrição.

Estruture a ata exatamente nesta ordem, usando os títulos indicados:
- Um parágrafo inicial com "Data e horário" e "Participantes".
- "1. Objetivo / Pauta"
- "2. Resumo da discussão" (organizado por tópicos)
- "3. Decisões tomadas"
- "4. Ações e responsáveis" (inclua prazos quando houver)
- "5. Pendências / Próximos passos"
- "6. Observações"

Formato de saída: APENAS o HTML do corpo da ata, usando somente as tags <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>. Não use markdown, não use blocos de código, não inclua <html>, <head> ou <body>, não repita o título principal (ele já é exibido à parte).`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Autenticação do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
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

    const { transcript, title, meetingDate, projectId } = await req.json()

    // Resolve a chave da OpenAI do DONO do projeto (informada em Configurações).
    // O acesso ao projeto é validado pelo RLS: se o requester não puder ver o
    // projeto, o select retorna vazio. Fallback: secret OPENAI_API_KEY do ambiente.
    let apiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
    if (projectId) {
      const { data: proj } = await supabaseClient
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .maybeSingle()
      if (!proj) {
        return new Response(JSON.stringify({ error: 'Sem acesso ao projeto' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )
      const { data: aiSettings } = await supabaseAdmin
        .from('user_ai_settings')
        .select('openai_key')
        .eq('user_id', proj.user_id)
        .maybeSingle()
      if (aiSettings?.openai_key) apiKey = aiSettings.openai_key
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Nenhuma chave da OpenAI configurada. Adicione em Configurações → IA.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 20) {
      return new Response(JSON.stringify({ error: 'Transcrição muito curta ou ausente' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let text = transcript.trim()
    let truncated = false
    if (text.length > MAX_TRANSCRIPT_CHARS) {
      text = text.slice(0, MAX_TRANSCRIPT_CHARS)
      truncated = true
    }

    const userContent = [
      title ? `Título da reunião: ${title}` : 'Título da reunião: (não informado)',
      meetingDate ? `Data informada: ${meetingDate}` : '',
      truncated ? '(Observação: a transcrição foi truncada por tamanho; gere a ata com o que foi fornecido.)' : '',
      '',
      'Transcrição:',
      text,
    ].filter(Boolean).join('\n')

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text()
      console.error('[generate-meeting-minutes] OpenAI erro:', openaiRes.status, errBody)
      return new Response(JSON.stringify({ error: `Falha na IA (${openaiRes.status})` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const data = await openaiRes.json()
    let html: string = data?.choices?.[0]?.message?.content ?? ''
    // Remove eventuais cercas de código markdown que o modelo possa incluir
    html = html.replace(/^```(?:html)?/i, '').replace(/```$/i, '').trim()

    if (!html) {
      return new Response(JSON.stringify({ error: 'A IA não retornou conteúdo' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ html, truncated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[generate-meeting-minutes] Erro:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
