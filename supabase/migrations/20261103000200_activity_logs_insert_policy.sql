-- =========================================================
-- Migration 20261103000200: insert em activity_logs só autenticado
-- =========================================================
-- Problema: "Anyone can insert logs" tinha WITH CHECK (true): qualquer
-- pessoa, mesmo sem login, gravava log com qualquer user_id.
--
-- Correção: só usuário autenticado insere, e somente com o próprio user_id.
-- Eventos de autenticação sem sessão (login_failed, signup, signup_failed,
-- login_blocked) passam a ser gravados pela Edge Function log-auth-event
-- (service role, rate limit por IP).
--
-- Idempotente. Policies de leitura/limpeza do admin não são alteradas.
-- =========================================================

begin;

drop policy if exists "Anyone can insert logs" on public.activity_logs;

drop policy if exists "Authenticated users insert own logs" on public.activity_logs;
create policy "Authenticated users insert own logs" on public.activity_logs
  for insert to authenticated
  with check (user_id = auth.uid());

-- Índice para o rate limit por IP da função log-auth-event
create index if not exists idx_activity_logs_ip_created
  on public.activity_logs (ip_address, created_at desc);

-- Verificação: nenhuma outra policy pode permitir INSERT (insert ou all),
-- exceto as restritas a admin (is_admin/has_role), que não abrem acesso público
do $$
declare
  leftovers text;
begin
  select string_agg(format('"%s" (%s)', policyname, cmd), ', ')
    into leftovers
  from pg_policies
  where schemaname = 'public'
    and tablename = 'activity_logs'
    and cmd in ('INSERT', 'ALL')
    and policyname <> 'Authenticated users insert own logs'
    and coalesce(with_check, qual, '') !~* '(is_admin|has_role)';

  if leftovers is not null then
    raise exception 'Outras policies ainda permitem INSERT em activity_logs: %', leftovers;
  end if;
end;
$$;

commit;
