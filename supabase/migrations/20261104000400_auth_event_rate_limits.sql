-- =========================================================
-- Migration 20261104000400: contador de rate limit da log-auth-event
-- =========================================================
-- Antes: a função contava linhas de activity_logs por IP. Problemas:
--   - contar e gravar eram passos separados (rajada paralela passava do limite);
--   - limpar activity_logs zerava o contador.
--
-- Agora: tabela própria com um contador por (bucket, janela) e a função
-- hit_rate_limit(), que incrementa e devolve o total numa única instrução
-- (insert ... on conflict ... returning), portanto atômica.
--   - Buckets usados pela Edge Function: 'ip:<ip>' (20/10 min) e 'global' (300/10 min).
--   - Janela fixa (ex.: 10:00–10:10). Linhas com mais de 1 dia são apagadas
--     pela própria função, em ~1% das chamadas (sem agendador).
--
-- A tabela NÃO é exposta: RLS ligado, nenhuma policy, sem privilégios para
-- anon/authenticated. A função é SECURITY DEFINER e só a service role executa.
-- Idempotente. Aborta (rollback) se algo ficar exposto.
-- =========================================================

begin;

create table if not exists public.auth_event_rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, window_start)
);

comment on table public.auth_event_rate_limits is
  'Contadores de rate limit da Edge Function log-auth-event. Acesso só via hit_rate_limit() (service role).';

-- Para a limpeza das janelas antigas
create index if not exists idx_auth_event_rate_limits_window
  on public.auth_event_rate_limits (window_start);

alter table public.auth_event_rate_limits enable row level security;
revoke all on table public.auth_event_rate_limits from public, anon, authenticated;

create or replace function public.hit_rate_limit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns boolean -- true = dentro do limite (pode gravar)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_bucket is null or length(p_bucket) = 0 or p_max is null or p_max <= 0
     or p_window_seconds is null or p_window_seconds <= 0 then
    return false;
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into auth_event_rate_limits as r (bucket, window_start, hits)
  values (left(p_bucket, 128), v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if random() < 0.01 then
    delete from auth_event_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- ---------- Verificação: nada exposto ----------
do $$
declare
  problems text[] := '{}';
  r text;
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'auth_event_rate_limits') then
    problems := array_append(problems, 'auth_event_rate_limits tem policy (deve ter nenhuma)');
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.auth_event_rate_limits'::regclass) then
    problems := array_append(problems, 'RLS desligado em auth_event_rate_limits');
  end if;

  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      if has_table_privilege(r, 'public.auth_event_rate_limits', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        problems := array_append(problems, format('%s tem privilégio na tabela auth_event_rate_limits', r));
      end if;
      if has_function_privilege(r, 'public.hit_rate_limit(text, integer, integer)', 'EXECUTE') then
        problems := array_append(problems, format('%s pode executar hit_rate_limit()', r));
      end if;
    end if;
  end loop;

  if array_length(problems, 1) > 0 then
    raise exception 'Rate limit exposto (revise antes de aplicar): %', array_to_string(problems, '; ');
  end if;
end;
$$;

commit;
