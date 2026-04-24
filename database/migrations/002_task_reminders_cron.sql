-- =========================================================
-- Migration 002: Agendamento de lembretes de tarefas via email
-- =========================================================
-- Agenda a Edge Function `send-task-reminders` para rodar
-- 1x por dia às 11:00 UTC (8:00 BRT) enviando emails para
-- responsáveis de tarefas que vencem hoje ou amanhã.
--
-- INSTRUÇÕES:
-- 1) Garanta que as extensões pg_cron e pg_net estão habilitadas
--    no Supabase Dashboard: Database → Extensions → pg_cron, pg_net
-- 2) SUBSTITUA `<PROJECT_REF>` pelo ref do seu projeto Supabase
--    (ex: abcdefghijklmno — está na URL do dashboard)
-- 3) SUBSTITUA `<CRON_SECRET>` pelo mesmo valor que você configurou
--    como secret `CRON_SECRET` na Edge Function (pode gerar com
--    `openssl rand -hex 32` localmente)
-- 4) Rode este script no SQL Editor do Supabase
-- =========================================================

-- Remove agendamento anterior se existir (idempotente)
SELECT cron.unschedule('send-task-reminders-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-task-reminders-daily');

-- Agenda nova execução diária às 11:00 UTC (8:00 BRT)
SELECT cron.schedule(
  'send-task-reminders-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Verificar agendamentos ativos:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'send-task-reminders-daily';

-- Ver histórico de execuções:
-- SELECT * FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'send-task-reminders-daily') ORDER BY start_time DESC LIMIT 10;
