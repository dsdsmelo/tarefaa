import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o'
const MAX_TRANSCRIPT_CHARS = 120_000

const SYSTEM_PROMPT = `Você redige ATAS DE REUNIÃO corporativas em português do Brasil, a partir de transcrições/legendas. Produza uma ata DETALHADA, completa e bem organizada, capturando todos os temas discutidos com profundidade.

Regras obrigatórias:
- Saída em MARKDOWN. NUNCA use emojis. Linguagem formal e corporativa.
- Não invente informações. Use apenas o que consta na transcrição. Quando um dado não existir, escreva "Não identificado na transcrição".
- Seja minucioso: para cada tema relevante, registre os pontos discutidos, as definições/decisões e os próximos passos. Não resuma em excesso; preserve detalhes técnicos, nomes de pessoas, sistemas, equipamentos, prazos e responsáveis mencionados.
- Identifique participantes, responsáveis e prazos somente se aparecerem na transcrição.

Estrutura obrigatória (siga exatamente este formato markdown):

# ATA DE REUNIÃO

**{Título da reunião}**
**Data:** {data}
**Participantes:** {nomes identificados; se muitos, liste os principais e finalize com "entre outros"}
**Duração aproximada:** {se identificável; senão "Não identificado na transcrição"}
**Objetivo:** {objetivo geral da reunião}

Depois, uma seção "## N. {Tema}" para CADA tema relevante discutido (quantas forem necessárias), e dentro de cada uma, nesta ordem:

**Tópicos abordados**
- {pontos discutidos, em detalhe}

**Definições**
- {decisões e definições tomadas}

**Próximos Passos**
- {ações, com responsável e prazo quando houver}

Ao final, uma seção:

## Resumo Executivo
- {principais conclusões da reunião, em tópicos}

Não use blocos de código nem escreva nada fora da ata. Comece diretamente pelo título "# ATA DE REUNIÃO".`

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
    let markdown: string = data?.choices?.[0]?.message?.content ?? ''
    // Remove eventuais cercas de código que o modelo possa incluir
    markdown = markdown.replace(/^```(?:markdown|md)?/i, '').replace(/```$/i, '').trim()

    if (!markdown) {
      return new Response(JSON.stringify({ error: 'A IA não retornou conteúdo' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ markdown, truncated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[generate-meeting-minutes] Erro:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
