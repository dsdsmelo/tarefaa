-- Testes de RLS das tabelas filhas de projeto (tasks, phases, milestones,
-- custom_columns, meeting_notes): o acesso depende só de can_access_project.
-- Cenários: dono, participante e ex-participante (removido do projeto).
-- Gerado para as 5 tabelas com os mesmos cenários. Rodar com: supabase test db
-- (banco local). Tudo em transação com rollback: não deixa dados.

begin;
create extension if not exists pgtap with schema extensions;

select plan(95);

-- ---------- dados de teste (como superusuário, sem RLS) ----------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'participante@teste.local', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'estranho@teste.local', 'authenticated', 'authenticated');

insert into public.projects (id, name, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Projeto compartilhado', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Outro projeto do dono', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Projeto do estranho', '33333333-3333-3333-3333-333333333333');

insert into public.people (id, name, type, color, user_id, auth_user_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Participante', 'internal', '#3B82F6', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

insert into public.project_members (project_id, person_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');

-- ==================== tasks ====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$insert into public.tasks (project_id, user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tarefa')$$, 'tasks: dono cria no próprio projeto');
select lives_ok($$update public.tasks set name = 'owner-tasks' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111'$$, 'tasks: dono edita');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.tasks where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'tasks: participante vê o item do dono');
select lives_ok($$insert into public.tasks (project_id, user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Tarefa')$$, 'tasks: participante cria no projeto compartilhado');
select results_eq($$with u as (update public.tasks set name = 'part-tasks' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (1)$$, 'tasks: participante edita o próprio item');
select results_eq($$with u as (update public.tasks set name = name where name like 'owner-%' returning 1) select count(*)::int from u$$, $$values (1)$$, 'tasks: participante edita item do dono');
select throws_ok($$update public.tasks set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where user_id = '22222222-2222-2222-2222-222222222222'$$, '42501', null, 'tasks: participante NÃO move item para projeto alheio');
select throws_ok($$insert into public.tasks (project_id, user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Tarefa')$$, '42501', null, 'tasks: participante NÃO cria em projeto alheio (mesmo com o próprio user_id)');
select is((select count(*)::int from public.tasks where project_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0, 'tasks: participante NÃO vê projeto alheio');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.tasks where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2, 'tasks: dono vê itens do participante');
select lives_ok($$update public.tasks set project_id = 'aaaaaaaa-0000-0000-0000-000000000003' where name like 'owner-%'$$, 'tasks: dono move item entre os próprios projetos');
select throws_ok($$update public.tasks set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where name like 'owner-%'$$, '42501', null, 'tasks: dono NÃO move item para projeto alheio');
select lives_ok($$update public.tasks set project_id = 'aaaaaaaa-0000-0000-0000-000000000001' where name like 'owner-%'$$, 'tasks: dono devolve o item ao projeto compartilhado');

-- ==================== phases ====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$insert into public.phases (project_id, user_id, name, "order") values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Fase', 1)$$, 'phases: dono cria no próprio projeto');
select lives_ok($$update public.phases set name = 'owner-phases' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111'$$, 'phases: dono edita');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.phases where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'phases: participante vê o item do dono');
select lives_ok($$insert into public.phases (project_id, user_id, name, "order") values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Fase', 1)$$, 'phases: participante cria no projeto compartilhado');
select results_eq($$with u as (update public.phases set name = 'part-phases' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (1)$$, 'phases: participante edita o próprio item');
select results_eq($$with u as (update public.phases set name = name where name like 'owner-%' returning 1) select count(*)::int from u$$, $$values (1)$$, 'phases: participante edita item do dono');
select throws_ok($$update public.phases set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where user_id = '22222222-2222-2222-2222-222222222222'$$, '42501', null, 'phases: participante NÃO move item para projeto alheio');
select throws_ok($$insert into public.phases (project_id, user_id, name, "order") values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Fase', 1)$$, '42501', null, 'phases: participante NÃO cria em projeto alheio (mesmo com o próprio user_id)');
select is((select count(*)::int from public.phases where project_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0, 'phases: participante NÃO vê projeto alheio');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.phases where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2, 'phases: dono vê itens do participante');
select lives_ok($$update public.phases set project_id = 'aaaaaaaa-0000-0000-0000-000000000003' where name like 'owner-%'$$, 'phases: dono move item entre os próprios projetos');
select throws_ok($$update public.phases set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where name like 'owner-%'$$, '42501', null, 'phases: dono NÃO move item para projeto alheio');
select lives_ok($$update public.phases set project_id = 'aaaaaaaa-0000-0000-0000-000000000001' where name like 'owner-%'$$, 'phases: dono devolve o item ao projeto compartilhado');

-- ==================== milestones ====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$insert into public.milestones (project_id, user_id, name, date) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Marco', current_date)$$, 'milestones: dono cria no próprio projeto');
select lives_ok($$update public.milestones set name = 'owner-milestones' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111'$$, 'milestones: dono edita');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.milestones where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'milestones: participante vê o item do dono');
select lives_ok($$insert into public.milestones (project_id, user_id, name, date) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Marco', current_date)$$, 'milestones: participante cria no projeto compartilhado');
select results_eq($$with u as (update public.milestones set name = 'part-milestones' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (1)$$, 'milestones: participante edita o próprio item');
select results_eq($$with u as (update public.milestones set name = name where name like 'owner-%' returning 1) select count(*)::int from u$$, $$values (1)$$, 'milestones: participante edita item do dono');
select throws_ok($$update public.milestones set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where user_id = '22222222-2222-2222-2222-222222222222'$$, '42501', null, 'milestones: participante NÃO move item para projeto alheio');
select throws_ok($$insert into public.milestones (project_id, user_id, name, date) values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Marco', current_date)$$, '42501', null, 'milestones: participante NÃO cria em projeto alheio (mesmo com o próprio user_id)');
select is((select count(*)::int from public.milestones where project_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0, 'milestones: participante NÃO vê projeto alheio');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.milestones where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2, 'milestones: dono vê itens do participante');
select lives_ok($$update public.milestones set project_id = 'aaaaaaaa-0000-0000-0000-000000000003' where name like 'owner-%'$$, 'milestones: dono move item entre os próprios projetos');
select throws_ok($$update public.milestones set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where name like 'owner-%'$$, '42501', null, 'milestones: dono NÃO move item para projeto alheio');
select lives_ok($$update public.milestones set project_id = 'aaaaaaaa-0000-0000-0000-000000000001' where name like 'owner-%'$$, 'milestones: dono devolve o item ao projeto compartilhado');

-- ==================== custom_columns ====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$insert into public.custom_columns (project_id, user_id, name, type, "order") values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Coluna', 'text', 1)$$, 'custom_columns: dono cria no próprio projeto');
select lives_ok($$update public.custom_columns set name = 'owner-custom_columns' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111'$$, 'custom_columns: dono edita');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.custom_columns where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'custom_columns: participante vê o item do dono');
select lives_ok($$insert into public.custom_columns (project_id, user_id, name, type, "order") values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Coluna', 'text', 1)$$, 'custom_columns: participante cria no projeto compartilhado');
select results_eq($$with u as (update public.custom_columns set name = 'part-custom_columns' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (1)$$, 'custom_columns: participante edita o próprio item');
select results_eq($$with u as (update public.custom_columns set name = name where name like 'owner-%' returning 1) select count(*)::int from u$$, $$values (1)$$, 'custom_columns: participante edita item do dono');
select throws_ok($$update public.custom_columns set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where user_id = '22222222-2222-2222-2222-222222222222'$$, '42501', null, 'custom_columns: participante NÃO move item para projeto alheio');
select throws_ok($$insert into public.custom_columns (project_id, user_id, name, type, "order") values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Coluna', 'text', 1)$$, '42501', null, 'custom_columns: participante NÃO cria em projeto alheio (mesmo com o próprio user_id)');
select is((select count(*)::int from public.custom_columns where project_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0, 'custom_columns: participante NÃO vê projeto alheio');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.custom_columns where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2, 'custom_columns: dono vê itens do participante');
select lives_ok($$update public.custom_columns set project_id = 'aaaaaaaa-0000-0000-0000-000000000003' where name like 'owner-%'$$, 'custom_columns: dono move item entre os próprios projetos');
select throws_ok($$update public.custom_columns set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where name like 'owner-%'$$, '42501', null, 'custom_columns: dono NÃO move item para projeto alheio');
select lives_ok($$update public.custom_columns set project_id = 'aaaaaaaa-0000-0000-0000-000000000001' where name like 'owner-%'$$, 'custom_columns: dono devolve o item ao projeto compartilhado');

-- ==================== meeting_notes ====================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$insert into public.meeting_notes (project_id, user_id, title, meeting_date) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Nota', current_date)$$, 'meeting_notes: dono cria no próprio projeto');
select lives_ok($$update public.meeting_notes set title = 'owner-meeting_notes' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111'$$, 'meeting_notes: dono edita');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.meeting_notes where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 1, 'meeting_notes: participante vê o item do dono');
select lives_ok($$insert into public.meeting_notes (project_id, user_id, title, meeting_date) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Nota', current_date)$$, 'meeting_notes: participante cria no projeto compartilhado');
select results_eq($$with u as (update public.meeting_notes set title = 'part-meeting_notes' where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (1)$$, 'meeting_notes: participante edita o próprio item');
select results_eq($$with u as (update public.meeting_notes set title = title where title like 'owner-%' returning 1) select count(*)::int from u$$, $$values (1)$$, 'meeting_notes: participante edita item do dono');
select throws_ok($$update public.meeting_notes set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where user_id = '22222222-2222-2222-2222-222222222222'$$, '42501', null, 'meeting_notes: participante NÃO move item para projeto alheio');
select throws_ok($$insert into public.meeting_notes (project_id, user_id, title, meeting_date) values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Nota', current_date)$$, '42501', null, 'meeting_notes: participante NÃO cria em projeto alheio (mesmo com o próprio user_id)');
select is((select count(*)::int from public.meeting_notes where project_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 0, 'meeting_notes: participante NÃO vê projeto alheio');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.meeting_notes where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2, 'meeting_notes: dono vê itens do participante');
select lives_ok($$update public.meeting_notes set project_id = 'aaaaaaaa-0000-0000-0000-000000000003' where title like 'owner-%'$$, 'meeting_notes: dono move item entre os próprios projetos');
select throws_ok($$update public.meeting_notes set project_id = 'aaaaaaaa-0000-0000-0000-000000000002' where title like 'owner-%'$$, '42501', null, 'meeting_notes: dono NÃO move item para projeto alheio');
select lives_ok($$update public.meeting_notes set project_id = 'aaaaaaaa-0000-0000-0000-000000000001' where title like 'owner-%'$$, 'meeting_notes: dono devolve o item ao projeto compartilhado');

-- ==================== participante removido do projeto ====================
reset role;
delete from public.project_members where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and person_id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.tasks where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'tasks: ex-participante NÃO vê nada, nem o que criou');
select results_eq($$with u as (update public.tasks set name = 'hack' where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (0)$$, 'tasks: ex-participante NÃO edita o que criou');
select results_eq($$with d as (delete from public.tasks where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from d$$, $$values (0)$$, 'tasks: ex-participante NÃO exclui o que criou');
select throws_ok($$insert into public.tasks (project_id, user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Tarefa')$$, '42501', null, 'tasks: ex-participante NÃO cria no projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.tasks where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222'), 1, 'tasks: dono continua vendo o item criado pelo ex-participante');
select results_eq($$with d as (delete from public.tasks where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1) select count(*)::int from d$$, $$values (2)$$, 'tasks: dono exclui itens do projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.phases where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'phases: ex-participante NÃO vê nada, nem o que criou');
select results_eq($$with u as (update public.phases set name = 'hack' where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (0)$$, 'phases: ex-participante NÃO edita o que criou');
select results_eq($$with d as (delete from public.phases where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from d$$, $$values (0)$$, 'phases: ex-participante NÃO exclui o que criou');
select throws_ok($$insert into public.phases (project_id, user_id, name, "order") values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Fase', 1)$$, '42501', null, 'phases: ex-participante NÃO cria no projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.phases where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222'), 1, 'phases: dono continua vendo o item criado pelo ex-participante');
select results_eq($$with d as (delete from public.phases where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1) select count(*)::int from d$$, $$values (2)$$, 'phases: dono exclui itens do projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.milestones where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'milestones: ex-participante NÃO vê nada, nem o que criou');
select results_eq($$with u as (update public.milestones set name = 'hack' where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (0)$$, 'milestones: ex-participante NÃO edita o que criou');
select results_eq($$with d as (delete from public.milestones where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from d$$, $$values (0)$$, 'milestones: ex-participante NÃO exclui o que criou');
select throws_ok($$insert into public.milestones (project_id, user_id, name, date) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Marco', current_date)$$, '42501', null, 'milestones: ex-participante NÃO cria no projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.milestones where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222'), 1, 'milestones: dono continua vendo o item criado pelo ex-participante');
select results_eq($$with d as (delete from public.milestones where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1) select count(*)::int from d$$, $$values (2)$$, 'milestones: dono exclui itens do projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.custom_columns where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'custom_columns: ex-participante NÃO vê nada, nem o que criou');
select results_eq($$with u as (update public.custom_columns set name = 'hack' where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (0)$$, 'custom_columns: ex-participante NÃO edita o que criou');
select results_eq($$with d as (delete from public.custom_columns where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from d$$, $$values (0)$$, 'custom_columns: ex-participante NÃO exclui o que criou');
select throws_ok($$insert into public.custom_columns (project_id, user_id, name, type, "order") values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Coluna', 'text', 1)$$, '42501', null, 'custom_columns: ex-participante NÃO cria no projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.custom_columns where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222'), 1, 'custom_columns: dono continua vendo o item criado pelo ex-participante');
select results_eq($$with d as (delete from public.custom_columns where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1) select count(*)::int from d$$, $$values (2)$$, 'custom_columns: dono exclui itens do projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.meeting_notes where project_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'meeting_notes: ex-participante NÃO vê nada, nem o que criou');
select results_eq($$with u as (update public.meeting_notes set title = 'hack' where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from u$$, $$values (0)$$, 'meeting_notes: ex-participante NÃO edita o que criou');
select results_eq($$with d as (delete from public.meeting_notes where user_id = '22222222-2222-2222-2222-222222222222' returning 1) select count(*)::int from d$$, $$values (0)$$, 'meeting_notes: ex-participante NÃO exclui o que criou');
select throws_ok($$insert into public.meeting_notes (project_id, user_id, title, meeting_date) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Nota', current_date)$$, '42501', null, 'meeting_notes: ex-participante NÃO cria no projeto');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.meeting_notes where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222'), 1, 'meeting_notes: dono continua vendo o item criado pelo ex-participante');
select results_eq($$with d as (delete from public.meeting_notes where project_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1) select count(*)::int from d$$, $$values (2)$$, 'meeting_notes: dono exclui itens do projeto');

reset role;
select * from finish();
rollback;
