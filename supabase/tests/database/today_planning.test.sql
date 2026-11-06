-- Testes do planejamento do dia (Etapa 3, migration 20261106000600).
-- Atores: U1 dono dos projetos; U2 participante de um projeto de U1;
-- U3 sem acesso a nada de U1.
-- Prova: configurações de capacidade só do próprio usuário; campos novos de
-- tasks seguem as policies atuais; completed_at mantido pelo trigger;
-- colunas padrão novas aceitas em custom_columns.
-- Rodar com: supabase test db (banco local). Transação com rollback.

begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- ---------- Fixture (como superusuário) ----------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'u1@teste.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'u2@teste.local', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'u3@teste.local', 'authenticated', 'authenticated');

select public.default_workspace_for_user('11111111-1111-1111-1111-111111111111', 'personal');

insert into public.people (id, name, type, color, user_id, auth_user_id) values
  ('b0000000-0000-0000-0000-000000000002', 'U2', 'internal', '#000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into public.projects (id, name, user_id) values
  ('a0000000-0000-0000-0000-000000000001', 'Privado de U1', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000002', 'Compartilhado', '11111111-1111-1111-1111-111111111111');
insert into public.project_members (project_id, person_id) values
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002');

insert into public.tasks (id, name, project_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', 'Privada', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000002', 'Compartilhada', 'a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111');

-- Executa um comando com a role atual (RLS vale) e devolve linhas afetadas / o valor retornado
create function pg_temp.affected(q text) returns int language plpgsql as $f$
declare n int; begin execute q; get diagnostics n = row_count; return n; end $f$;
create function pg_temp.ret(q text) returns text language plpgsql as $f$
declare v text; begin execute q into v; return v; end $f$;

-- ================= user_planning_settings =================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok($$insert into public.user_planning_settings (user_id) values (auth.uid())$$, 'U1 cria a própria configuração');
select is((select mon_minutes from public.user_planning_settings where user_id = auth.uid()), 360, 'padrão de segunda: 360 minutos');
select is((select fri_minutes from public.user_planning_settings where user_id = auth.uid()), 360, 'padrão de sexta: 360 minutos');
select is((select sat_minutes + sun_minutes from public.user_planning_settings where user_id = auth.uid()), 0, 'padrão de sábado e domingo: 0');
select is(pg_temp.affected($q$update public.user_planning_settings set mon_minutes = 480 where user_id = auth.uid()$q$), 1, 'U1 altera a própria configuração');
select throws_ok($$update public.user_planning_settings set tue_minutes = 1441 where user_id = auth.uid()$$, '23514', null, 'capacidade acima de 1440 é recusada');
select throws_ok($$update public.user_planning_settings set tue_minutes = -1 where user_id = auth.uid()$$, '23514', null, 'capacidade negativa é recusada');
select throws_ok($$insert into public.user_planning_settings (user_id) values ('22222222-2222-2222-2222-222222222222')$$, '42501', null, 'U1 não cria configuração em nome de U2');
select throws_ok($$delete from public.user_planning_settings where user_id = auth.uid()$$, '42501', null, 'nem o próprio usuário exclui (sem permissão de delete)');

-- U2: não lê nem altera a de U1
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.user_planning_settings), 0, 'U2 não lê a configuração de U1');
select is(pg_temp.affected($q$update public.user_planning_settings set mon_minutes = 0 where user_id = '11111111-1111-1111-1111-111111111111'$q$), 0, 'U2 não altera a configuração de U1');
select is(pg_temp.affected($q$update public.user_planning_settings set user_id = auth.uid() where user_id = '11111111-1111-1111-1111-111111111111'$q$), 0, 'U2 não toma a configuração de U1 para si');
select throws_ok($$insert into public.user_planning_settings (user_id) values ('11111111-1111-1111-1111-111111111111') on conflict (user_id) do update set mon_minutes = 0$$, '42501', null, 'U2 não sobrescreve a de U1 por upsert');
select lives_ok($$insert into public.user_planning_settings (user_id, sat_minutes) values (auth.uid(), 120)$$, 'U2 cria a própria configuração');
select is((select count(*)::int from public.user_planning_settings), 1, 'U2 vê só a própria');

-- U1 confere que nada mudou na dele
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select mon_minutes from public.user_planning_settings where user_id = auth.uid()), 480, 'configuração de U1 intacta depois das tentativas de U2');
select is((select count(*)::int from public.user_planning_settings), 1, 'U1 vê só a própria');

-- anon: nada
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.user_planning_settings$$, '42501', null, 'anon não lê configurações');
select throws_ok($$insert into public.user_planning_settings (user_id) values ('33333333-3333-3333-3333-333333333333')$$, '42501', null, 'anon não cria configurações');
reset role;

-- ================= Campos novos de tasks =================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(pg_temp.affected($q$update public.tasks set planned_date = '2026-11-06', estimate_minutes = 30, today_order = 1000 where id = 'c0000000-0000-0000-0000-000000000001'$q$), 1, 'U1 planeja a própria tarefa (data, estimativa, ordem)');
select throws_ok($$update public.tasks set estimate_minutes = 0 where id = 'c0000000-0000-0000-0000-000000000001'$$, '23514', null, 'estimativa 0 é recusada');
select throws_ok($$update public.tasks set estimate_minutes = 1441 where id = 'c0000000-0000-0000-0000-000000000001'$$, '23514', null, 'estimativa acima de 1440 é recusada');
select is(pg_temp.affected($q$update public.tasks set estimate_minutes = null where id = 'c0000000-0000-0000-0000-000000000001'$q$), 1, 'estimativa pode ser limpa');

-- U2 participante: altera os campos novos só no projeto compartilhado
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(pg_temp.affected($q$update public.tasks set planned_date = '2026-11-07', estimate_minutes = 45 where id = 'c0000000-0000-0000-0000-000000000002'$q$), 1, 'participante planeja tarefa do projeto compartilhado');
select is(pg_temp.affected($q$update public.tasks set planned_date = '2026-11-07' where id = 'c0000000-0000-0000-0000-000000000001'$q$), 0, 'participante não planeja tarefa de projeto em que não está');
select is((select count(*)::int from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), 0, 'participante não lê planned_date de projeto em que não está');

-- U3 sem acesso
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.tasks), 0, 'U3 não vê nenhuma tarefa de U1');
select is(pg_temp.affected($q$update public.tasks set planned_date = '2026-11-08', today_order = 1$q$), 0, 'U3 não altera planned_date/today_order de ninguém');

-- ================= completed_at =================
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select completed_at is null from public.tasks where id = 'c0000000-0000-0000-0000-000000000001'), true, 'tarefa aberta: completed_at vazio');
select is(pg_temp.ret($q$update public.tasks set completed_at = now() where id = 'c0000000-0000-0000-0000-000000000001' returning (completed_at is null)::text$q$)::boolean, true, 'tarefa aberta: app não grava completed_at por conta própria');
select is(pg_temp.ret($q$update public.tasks set status = 'completed' where id = 'c0000000-0000-0000-0000-000000000001' returning (completed_at = now())::text$q$)::boolean, true, 'passar para concluída grava completed_at = now()');
reset role;
-- Data fixa de conclusão (trigger desligado só para preparar o caso)
alter table public.tasks disable trigger set_task_completed_at;
update public.tasks set completed_at = '2026-01-01 10:00+00' where id = 'c0000000-0000-0000-0000-000000000001';
alter table public.tasks enable trigger set_task_completed_at;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(pg_temp.ret($q$update public.tasks set name = 'Privada (editada)' where id = 'c0000000-0000-0000-0000-000000000001' returning completed_at::text$q$)::timestamptz, '2026-01-01 10:00+00'::timestamptz, 'continuar concluída mantém a data original');
select is(pg_temp.ret($q$update public.tasks set completed_at = '2030-01-01' where id = 'c0000000-0000-0000-0000-000000000001' returning completed_at::text$q$)::timestamptz, '2026-01-01 10:00+00'::timestamptz, 'app não reescreve completed_at de tarefa concluída');
select is(pg_temp.ret($q$update public.tasks set status = 'pending' where id = 'c0000000-0000-0000-0000-000000000001' returning (completed_at is null)::text$q$)::boolean, true, 'reabrir limpa completed_at');
select is(pg_temp.ret($q$insert into public.tasks (name, project_id, user_id, status) values ('Já concluída', 'a0000000-0000-0000-0000-000000000001', auth.uid(), 'completed') returning (completed_at = now())::text$q$)::boolean, true, 'insert já concluída grava completed_at');
select is(pg_temp.ret($q$insert into public.tasks (name, project_id, user_id, completed_at) values ('Nova aberta', 'a0000000-0000-0000-0000-000000000001', auth.uid(), now()) returning (completed_at is null)::text$q$)::boolean, true, 'insert aberta ignora completed_at enviado');
select is(pg_temp.affected($q$update public.tasks set status = 'completed' where id = 'c0000000-0000-0000-0000-000000000002'$q$), 1, 'concluir tarefa compartilhada');
select is(pg_temp.ret($q$update public.tasks set status = 'cancelled' where id = 'c0000000-0000-0000-0000-000000000002' returning (completed_at is null)::text$q$)::boolean, true, 'concluída -> cancelada limpa completed_at');

-- ================= Colunas padrão novas =================
select lives_ok($$insert into public.custom_columns (name, type, project_id, user_id, standard_field, hidden) values ('Planejado para', 'date', 'a0000000-0000-0000-0000-000000000001', auth.uid(), 'plannedDate', true), ('Estimativa', 'number', 'a0000000-0000-0000-0000-000000000001', auth.uid(), 'estimate', true)$$, 'colunas padrão plannedDate e estimate são aceitas');
select throws_ok($$insert into public.custom_columns (name, type, project_id, user_id, standard_field) values ('X', 'text', 'a0000000-0000-0000-0000-000000000001', auth.uid(), 'outroCampo')$$, '23514', null, 'campo padrão desconhecido continua recusado');
reset role;

-- ================= Exclusão de conta =================
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.user_planning_settings where user_id = '22222222-2222-2222-2222-222222222222'), 0, 'excluir a conta apaga a configuração em cascata');

select * from finish();
rollback;
