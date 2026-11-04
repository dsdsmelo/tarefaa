-- Testes da caixa de entrada (Etapa 2, migration 20261104000500).
-- Atores: U1 dono (caixa de entrada + projetos normais); U2 participante de um
-- projeto normal de U1; service role e cascata de exclusão de conta (admin).
-- Também prova que projetos normais mantêm o comportamento de antes.
-- Rodar com: supabase test db (banco local). Transação com rollback.

begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

-- ---------- Fixture (como superusuário) ----------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'u1@teste.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'u2@teste.local', 'authenticated', 'authenticated');

select public.default_workspace_for_user('11111111-1111-1111-1111-111111111111', 'personal');
select public.default_workspace_for_user('11111111-1111-1111-1111-111111111111', 'corporate');

insert into public.people (id, name, type, color, user_id, auth_user_id) values
  ('b0000000-0000-0000-0000-000000000002', 'U2', 'internal', '#000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Projeto normal de U1 compartilhado com U2 (para provar que U2 não vê a caixa de entrada)
insert into public.projects (id, name, user_id) values
  ('a0000000-0000-0000-0000-000000000002', 'Compartilhado', '11111111-1111-1111-1111-111111111111');
insert into public.project_members (project_id, person_id) values
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002');

-- ids gerados durante o teste
create temp table t_ctx (k text primary key, v uuid);
grant select, insert on t_ctx to authenticated, anon, service_role;

-- ================= U1: criação da caixa de entrada =================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.projects where is_inbox), 0, 'antes: U1 não tem caixa de entrada');
select lives_ok($$insert into t_ctx select 'inbox1', public.ensure_inbox_project()$$, 'ensure_inbox_project cria a caixa de entrada');
select is((select count(*)::int from public.projects where is_inbox and user_id = auth.uid()), 1, 'U1 tem uma caixa de entrada');
select is(public.ensure_inbox_project(), (select v from t_ctx where k = 'inbox1'), 'segunda chamada devolve a mesma caixa de entrada');
select is((select count(*)::int from public.projects where is_inbox), 1, 'continua uma só');
select is((select name || '|' || status from public.projects where is_inbox), 'Caixa de entrada|active', 'nome fixo e status ativo');
select is(
  (select p.workspace_id = w.id from public.projects p
     join public.workspaces w on w.user_id = p.user_id and w.kind = 'personal' and w.is_default
    where p.is_inbox),
  true, 'fica no workspace Pessoal padrão');

-- ================= U1: proteções =================
select throws_ok($$insert into public.projects (name, user_id, is_inbox) values ('Falsa', auth.uid(), true)$$,
  '42501', null, 'app não cria caixa de entrada direto');
select throws_ok($$update public.projects set name = 'Outro nome' where is_inbox$$,
  '42501', null, 'não renomeia a caixa de entrada');
select throws_ok($$update public.projects set workspace_id = (select id from public.workspaces where kind = 'corporate' and user_id = auth.uid()) where is_inbox$$,
  '42501', null, 'não move a caixa de entrada de workspace');
select throws_ok($$update public.projects set status = 'completed' where is_inbox$$,
  '42501', null, 'não muda o status da caixa de entrada');
select throws_ok($$update public.projects set is_inbox = false where is_inbox$$,
  '42501', null, 'não desmarca is_inbox');
select throws_ok($$delete from public.projects where is_inbox$$,
  '42501', null, 'não exclui a caixa de entrada');
select throws_ok($$insert into public.project_members (project_id, person_id) values ((select v from t_ctx where k = 'inbox1'), 'b0000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'caixa de entrada não aceita participantes');
select lives_ok($$update public.projects set description = 'minhas capturas' where is_inbox$$,
  'outros campos da caixa de entrada continuam editáveis');
select lives_ok($$insert into public.tasks (id, name, project_id, user_id) values ('c0000000-0000-0000-0000-000000000001', 'Capturada', (select v from t_ctx where k = 'inbox1'), auth.uid())$$,
  'cria tarefa na caixa de entrada');

-- ================= U1: projetos normais como antes =================
select lives_ok($$insert into public.projects (id, name, user_id) values ('a0000000-0000-0000-0000-000000000001', 'Normal', auth.uid())$$,
  'cria projeto normal');
select is((select is_inbox from public.projects where id = 'a0000000-0000-0000-0000-000000000001'), false, 'projeto normal nasce com is_inbox = false');
select throws_ok($$update public.projects set is_inbox = true where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'não transforma projeto normal em caixa de entrada');
select lives_ok($$update public.projects set name = 'Normal renomeado' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  'renomeia projeto normal');
select lives_ok($$update public.projects set workspace_id = (select id from public.workspaces where kind = 'corporate' and user_id = auth.uid()) where id = 'a0000000-0000-0000-0000-000000000001'$$,
  'move projeto normal de workspace');
select is(
  (select w.kind from public.projects p join public.workspaces w on w.id = p.workspace_id where p.id = 'a0000000-0000-0000-0000-000000000001'),
  'corporate', 'projeto normal ficou no Corporativo');
select lives_ok($$update public.projects set status = 'completed' where id = 'a0000000-0000-0000-0000-000000000001'$$,
  'muda o status de projeto normal');
select lives_ok($$insert into public.project_members (project_id, person_id) values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002')$$,
  'adiciona participante a projeto normal');
select lives_ok($$delete from public.project_members where project_id = 'a0000000-0000-0000-0000-000000000001'$$,
  'remove participante de projeto normal');
select lives_ok($$update public.tasks set project_id = 'a0000000-0000-0000-0000-000000000001' where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'move tarefa da caixa de entrada para projeto normal (triagem)');
select lives_ok($$delete from public.projects where id = 'a0000000-0000-0000-0000-000000000001'$$,
  'exclui projeto normal');
select is((select count(*)::int from public.projects where id = 'a0000000-0000-0000-0000-000000000001'), 0, 'projeto normal excluído');

-- ================= U2: isolamento =================
reset role;
insert into public.tasks (id, name, project_id, user_id)
  select 'c0000000-0000-0000-0000-000000000002', 'Outra capturada', v, '11111111-1111-1111-1111-111111111111' from t_ctx where k = 'inbox1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.projects where id = 'a0000000-0000-0000-0000-000000000002'), 1, 'U2 vê o projeto compartilhado');
select is((select count(*)::int from public.projects where is_inbox), 0, 'U2 não vê a caixa de entrada de U1');
select is((select count(*)::int from public.tasks where project_id = (select v from t_ctx where k = 'inbox1')), 0, 'U2 não vê tarefas da caixa de entrada de U1');
select throws_ok($$insert into public.tasks (name, project_id, user_id) values ('Intrusa', (select v from t_ctx where k = 'inbox1'), auth.uid())$$,
  '42501', null, 'U2 não cria tarefa na caixa de entrada de U1');
select results_eq(
  $$with u as (update public.projects set name = 'Tomado' where id = 'a0000000-0000-0000-0000-000000000002' returning 1) select count(*)::int from u$$,
  $$select 0$$, 'participante continua sem poder renomear projeto do dono');
select lives_ok($$insert into t_ctx select 'inbox2', public.ensure_inbox_project()$$, 'U2 ganha a própria caixa de entrada');
select is((select v from t_ctx where k = 'inbox2') <> (select v from t_ctx where k = 'inbox1'), true, 'caixas de entrada diferentes');

-- ================= Sem sessão =================
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.ensure_inbox_project()$$, '42501', null, 'authenticated sem usuário não cria caixa de entrada');
reset role;
set local role anon;
select throws_ok($$select public.ensure_inbox_project()$$, '42501', null, 'anon não executa ensure_inbox_project');
reset role;

-- ================= Banco / admin =================
select throws_ok($$insert into public.project_members (project_id, person_id) select v, 'b0000000-0000-0000-0000-000000000002' from t_ctx where k = 'inbox1'$$,
  '42501', null, 'nem o superusuário adiciona participante à caixa de entrada');
select throws_ok($$insert into public.projects (name, user_id, is_inbox, status) values ('Segunda', '11111111-1111-1111-1111-111111111111', true, 'active')$$,
  '23505', null, 'índice único impede segunda caixa de entrada');

set local role service_role;
select lives_ok($$delete from public.projects where id = (select v from t_ctx where k = 'inbox2')$$, 'service role (admin) exclui caixa de entrada');
reset role;

-- Exclusão de conta: a cascata de auth.users roda como dono da tabela projects
create role tst_auth_admin nologin;
grant usage on schema auth, extensions to tst_auth_admin;
grant select, delete on auth.users to tst_auth_admin;
set local role tst_auth_admin;
select lives_ok($$delete from auth.users where id = '11111111-1111-1111-1111-111111111111'$$, 'exclusão da conta apaga a caixa de entrada em cascata');
reset role;
select is((select count(*)::int from public.projects where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'nenhum projeto de U1 sobrou');

select * from finish();
rollback;
