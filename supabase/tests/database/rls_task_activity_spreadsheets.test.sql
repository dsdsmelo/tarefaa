-- Testes de RLS do item 1.6: task_activity (acesso pelo projeto da tarefa) e
-- project_spreadsheets (dono da planilha E dono do projeto).
-- Atores: U1 dono do projeto P1; U2 participante de P1; U3 ex-participante de P1
-- (dono do próprio projeto P3).
-- Rodar com: supabase test db (banco local). Transação com rollback.

begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------- Fixture (como superusuário) ----------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'participante@teste.local', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'ex@teste.local', 'authenticated', 'authenticated');

insert into public.projects (id, name, user_id) values
  ('a0000000-0000-0000-0000-000000000001', 'P1 do dono', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000003', 'P3 do ex', '33333333-3333-3333-3333-333333333333');

insert into public.people (id, name, type, color, user_id, auth_user_id) values
  ('b0000000-0000-0000-0000-000000000002', 'Participante', 'internal', '#000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('b0000000-0000-0000-0000-000000000003', 'Ex', 'internal', '#000', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

insert into public.project_members (project_id, person_id) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003');

insert into public.tasks (id, name, project_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', 'Tarefa de P1', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000003', 'Tarefa de P3', 'a0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333');

-- atividades geradas pelos três enquanto todos tinham acesso a P1
insert into public.task_activity (task_id, user_id, action) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'created'),
  ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'updated'),
  ('c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'updated');

-- U3 sai de P1: vira ex-participante
delete from public.project_members where person_id = 'b0000000-0000-0000-0000-000000000003';

insert into public.project_spreadsheets (id, project_id, user_id, name) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Planilha do dono'),
  -- legado: criada pelo participante no projeto do dono antes da correção
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Planilha legada');

-- ================= task_activity =================

-- Dono
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select results_eq(
  $$select count(*)::int from public.task_activity where task_id = 'c0000000-0000-0000-0000-000000000001'$$,
  $$select 3$$,
  'dono vê todas as atividades das tarefas do projeto');
select lives_ok(
  $$insert into public.task_activity (task_id, user_id, action) values ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'commented')$$,
  'dono grava atividade em tarefa do próprio projeto');

-- Participante
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select results_eq(
  $$select count(*)::int from public.task_activity where task_id = 'c0000000-0000-0000-0000-000000000001'$$,
  $$select 4$$,
  'participante vê todas as atividades das tarefas do projeto (inclusive de outros)');
select lives_ok(
  $$insert into public.task_activity (task_id, user_id, action) values ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'commented')$$,
  'participante grava atividade com o próprio user_id');
select throws_ok(
  $$insert into public.task_activity (task_id, user_id, action) values ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'commented')$$,
  '42501', null,
  'participante NÃO grava atividade em nome de outra pessoa');
select throws_ok(
  $$insert into public.task_activity (task_id, user_id, action) values ('c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'commented')$$,
  '42501', null,
  'participante NÃO grava atividade em tarefa de projeto sem acesso');

-- Ex-participante
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select results_eq(
  $$select count(*)::int from public.task_activity where task_id = 'c0000000-0000-0000-0000-000000000001'$$,
  $$select 0$$,
  'ex-participante NÃO vê atividades do projeto, nem as que ele mesmo gerou');
select throws_ok(
  $$insert into public.task_activity (task_id, user_id, action) values ('c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'commented')$$,
  '42501', null,
  'ex-participante NÃO grava atividade em tarefa do projeto antigo');
select lives_ok(
  $$insert into public.task_activity (task_id, user_id, action) values ('c0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'created')$$,
  'ex-participante continua gravando atividade no próprio projeto');

-- Anônimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select results_eq(
  $$select count(*)::int from public.task_activity$$,
  $$select 0$$,
  'anônimo NÃO vê atividades');

-- ================= project_spreadsheets =================
reset role;
set local role authenticated;

-- Dono do projeto
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.project_spreadsheets (project_id, user_id, name) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Nova')$$,
  'dono cria planilha no próprio projeto');
select lives_ok(
  $$update public.project_spreadsheets set name = 'Renomeada' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  'dono renomeia a própria planilha');
select throws_ok(
  $$update public.project_spreadsheets set project_id = 'a0000000-0000-0000-0000-000000000003' where id = 'd0000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'dono NÃO move planilha para projeto de outra pessoa');
select throws_ok(
  $$insert into public.project_spreadsheets (project_id, user_id, name) values ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Intrusa')$$,
  '42501', null,
  'dono NÃO cria planilha em projeto de outra pessoa');
select results_eq(
  $$select count(*)::int from public.project_spreadsheets where id = 'd0000000-0000-0000-0000-000000000002'$$,
  $$select 0$$,
  'dono do projeto NÃO vê planilha criada por outra pessoa (modelo de dono mantido)');

-- Participante
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.project_spreadsheets (project_id, user_id, name) values ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Do participante')$$,
  '42501', null,
  'participante NÃO cria planilha no projeto do dono');
select results_eq(
  $$select count(*)::int from public.project_spreadsheets where id = 'd0000000-0000-0000-0000-000000000001'$$,
  $$select 0$$,
  'participante NÃO vê planilha do dono');
select results_eq(
  $$select count(*)::int from public.project_spreadsheets where id = 'd0000000-0000-0000-0000-000000000002'$$,
  $$select 1$$,
  'planilha legada continua visível para quem a criou');
select throws_ok(
  $$update public.project_spreadsheets set name = 'Legada renomeada' where id = 'd0000000-0000-0000-0000-000000000002'$$,
  '42501', null,
  'planilha legada em projeto alheio NÃO pode ser alterada');

-- Tabelas filhas herdam o dono da planilha
select throws_ok(
  $$insert into public.spreadsheet_columns (spreadsheet_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Intrusa')$$,
  '42501', null,
  'participante NÃO cria coluna em planilha do dono');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.spreadsheet_columns (spreadsheet_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Coluna A')$$,
  'dono cria coluna na própria planilha');

-- Ex-participante
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.project_spreadsheets (project_id, user_id, name) values ('a0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Do ex')$$,
  '42501', null,
  'ex-participante NÃO cria planilha no projeto antigo');

reset role;
select * from finish();
rollback;
