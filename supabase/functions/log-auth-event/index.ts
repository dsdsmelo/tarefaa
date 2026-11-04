import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleAuthEvent, type AuthEventDb } from './handler.ts'

// Servidor da log-auth-event. A lógica e as regras estão em handler.ts.

serve((req) =>
  handleAuthEvent(req, (): AuthEventDb => {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    return {
      async hitRateLimit(bucket, max, windowSeconds) {
        const { data, error } = await supabase.rpc('hit_rate_limit', {
          p_bucket: bucket,
          p_max: max,
          p_window_seconds: windowSeconds,
        })
        if (error) throw new Error(error.message)
        return data === true
      },
      async insertLog(row) {
        const { error } = await supabase.from('activity_logs').insert(row)
        if (error) throw new Error(error.message)
      },
    }
  })
)
