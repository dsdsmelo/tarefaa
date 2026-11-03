-- =========================================================
-- Migration 20261103000100: RLS das tabelas filhas de projeto
-- =========================================================
-- Problema: em tasks, phases, milestones, custom_columns e meeting_notes
-- existem policies por dono da LINHA ("Users can ... own <tabela>",
-- user_id = auth.uid()) somadas por OR às policies por acesso ao projeto
-- (can_access_project). Consequências:
--   - ex-participante continua vendo/editando o que criou em projeto alheio;
--   - insert só conferia user_id: dava para criar linha em projeto de outro;
--   - update não conferia o project_id de destino: dava para mover a linha
--     para qualquer projeto.
--
-- Correção: o acesso passa a depender SOMENTE de can_access_project(project_id),
-- no USING e no WITH CHECK (no UPDATE, o WITH CHECK valida o projeto de destino).
-- Dono e participantes atuais mantêm exatamente o acesso de hoje, porque
-- can_access_project = dono do projeto OU membro via project_members.
--
-- Idempotente. Roda numa transação: se a verificação final falhar, nada muda.
-- projects e project_members NÃO são alteradas (as policies de dono delas estão corretas).
-- =========================================================

begin;

do $$
declare
  t text;
  pol record;
begin
  if to_regprocedure('public.can_access_project(uuid)') is null then
    raise exception 'public.can_access_project(uuid) não existe; interrompendo';
  end if;

  foreach t in array array['tasks', 'phases', 'milestones', 'custom_columns', 'meeting_notes'] loop
    -- 1) Remove as policies por dono da linha ("Users can <ação> own <tabela>")
    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname ilike 'Users can % own %'
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
      raise notice 'removida: % em %', pol.policyname, t;
    end loop;

    -- 2) Recria as 4 policies canônicas (mesmos nomes da migration 004)
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', 'Project access select ' || t, t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_project(project_id))',
      'Project access select ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'Project access insert ' || t, t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_access_project(project_id))',
      'Project access insert ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'Project access update ' || t, t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_access_project(project_id)) with check (public.can_access_project(project_id))',
      'Project access update ' || t, t);

    execute format('drop policy if exists %I on public.%I', 'Project access delete ' || t, t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_access_project(project_id))',
      'Project access delete ' || t, t);
  end loop;
end;
$$;

-- 3) Verificação: falha se sobrar qualquer policy fora das 4 canônicas.
--    Uma policy permissiva extra seria somada por OR e reabriria o acesso.
do $$
declare
  leftovers text;
begin
  select string_agg(format('%s: "%s"', tablename, policyname), ', ' order by tablename, policyname)
    into leftovers
  from pg_policies
  where schemaname = 'public'
    and tablename in ('tasks', 'phases', 'milestones', 'custom_columns', 'meeting_notes')
    and policyname not in (
      'Project access select ' || tablename,
      'Project access insert ' || tablename,
      'Project access update ' || tablename,
      'Project access delete ' || tablename
    );

  if leftovers is not null then
    raise exception 'Policies fora do padrão canônico (revise antes de aplicar): %', leftovers;
  end if;
end;
$$;

commit;
