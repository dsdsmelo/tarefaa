-- Testes da Etapa 4 (migration 20261106000700): Aguardando, Ideia, saúde do
-- projeto/próxima ação e pessoas por workspace.
-- Atores: U1 dono; U2 participante de um projeto de U1; U3 sem acesso.
-- Rodar com: supabase test db (banco local). Transação com rollback.

begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- Executa um comando com a role atual (RLS vale) e devolve linhas afetadas / o valor retornado
create function pg_temp.affected(q text) returns int language plpgsql as $f$
declare n int; begin execute q; get diagnostics n = row_count; return n; end $f$;
create function pg_temp.ret(q text) returns text language plpgsql as $f$
declare v text; begin execute q into v; return v; end $f$;

-- ---------- Fixture (como superusuário) ----------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'u1@teste.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'u2@teste.local', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'u3@teste.local', 'authenticated', 'authenticated');

select public.default_workspace_for_user('11111111-1111-1111-1111-111111111111', 'personal');
select public.default_workspace_for_user('11111111-1111-1111-1111-111111111111', 'corporate');
select public.default_workspace_for_user('33333333-3333-3333-3333-333333333333', 'personal');

insert into public.people (id, name, type, color, user_id, auth_user_id) values
  ('b0000000-0000-0000-0000-000000000002', 'U2', 'internal', '#000', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('b0000000-0000-0000-0000-00000000000a', 'Contato X', 'partner', '#000', '11111111-1111-1111-1111-111111111111', null),
  ('b0000000-0000-0000-0000-000000000003', 'Pessoa de U3', 'partner', '#000', '33333333-3333-3333-3333-333333333333', null);

insert into public.projects (id, name, user_id) values
  ('a0000000-0000-0000-0000-000000000001', 'Privado de U1', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000002', 'Compartilhado', '11111111-1111-1111-1111-111111111111');
insert into public.project_members (project_id, person_id) values
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002');

insert into public.tasks (id, name, project_id, user_id) values
  ('c0000000-0000-0000-0000-000000000001', 'Privada', 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000002', 'Compartilhada', 'a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111');

create temp table t_ctx (k text primary key, v uuid);
grant select, insert on t_ctx to authenticated, anon, service_role;

-- ================= 1. Aguardando =================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok($$update public.tasks set status = 'waiting' where id = 'c0000000-0000-0000-0000-000000000001'$$, '23514', null, 'Aguardando sem data de cobrança é recusado');
select is(pg_temp.affected($$update public.tasks set status = 'waiting', follow_up_date = '2026-11-10', waiting_on_person_id = 'b0000000-0000-0000-0000-00000000000a' where id = 'c0000000-0000-0000-0000-000000000001'$$), 1, 'Aguardando com pessoa e data de cobrança');
select throws_ok($$update public.tasks set waiting_on_text = 'cliente' where id = 'c0000000-0000-0000-0000-000000000001'$$, '23514', null, 'pessoa e texto livre juntos são recusados');
select throws_ok($$update public.tasks set waiting_on_person_id = null, waiting_on_text = repeat('x', 121) where id = 'c0000000-0000-0000-0000-000000000001'$$, '23514', null, 'texto livre acima de 120 caracteres é recusado');
select is(pg_temp.ret($$update public.tasks set waiting_on_person_id = null, waiting_on_text = '   ' where id = 'c0000000-0000-0000-0000-000000000001' returning (waiting_on_text is null)::text$$)::boolean, true, 'texto livre só com espaços vira null');
select is(pg_temp.ret($$update public.tasks set waiting_on_text = repeat('y', 120) where id = 'c0000000-0000-0000-0000-000000000001' returning char_length(waiting_on_text)::text$$)::int, 120, '120 caracteres são aceitos');
select is(pg_temp.ret($$update public.tasks set status = 'pending' where id = 'c0000000-0000-0000-0000-000000000001' returning (waiting_on_person_id is null and waiting_on_text is null and follow_up_date is null)::text$$)::boolean, true, 'sair de Aguardando limpa os três campos');
select is(pg_temp.ret($$update public.tasks set follow_up_date = '2026-11-10', waiting_on_text = 'x' where id = 'c0000000-0000-0000-0000-000000000001' returning (waiting_on_text is null and follow_up_date is null)::text$$)::boolean, true, 'fora de Aguardando os campos não são gravados');
select throws_ok($$update public.tasks set status = 'waiting', follow_up_date = '2026-11-10', waiting_on_person_id = 'b0000000-0000-0000-0000-000000000003' where id = 'c0000000-0000-0000-0000-000000000001'$$, '42501', null, 'não aponta para pessoa que não pode ver (de outro usuário)');
select is(pg_temp.ret($$insert into public.tasks (name, project_id, user_id, status, follow_up_date, waiting_on_text) values ('Nova aguardando', 'a0000000-0000-0000-0000-000000000001', auth.uid(), 'waiting', '2026-11-12', 'fornecedor') returning follow_up_date::text$$), '2026-11-12', 'insert já em Aguardando');
select throws_ok($$update public.tasks set status = 'esperando' where id = 'c0000000-0000-0000-0000-000000000001'$$, '23514', null, 'status desconhecido continua recusado');

-- U2 participante: só aponta para quem vê
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(pg_temp.affected($$update public.tasks set status = 'waiting', follow_up_date = '2026-11-10', waiting_on_person_id = 'b0000000-0000-0000-0000-000000000002' where id = 'c0000000-0000-0000-0000-000000000002'$$), 1, 'participante marca Aguardando com pessoa que vê');
select throws_ok($$update public.tasks set waiting_on_person_id = 'b0000000-0000-0000-0000-00000000000a' where id = 'c0000000-0000-0000-0000-000000000002'$$, '42501', null, 'participante não aponta para pessoa que não vê');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(pg_temp.affected($$update public.tasks set status = 'pending'$$), 0, 'U3 não altera tarefas de U1');
reset role;
delete from public.people where id = 'b0000000-0000-0000-0000-000000000002';
select is((select waiting_on_person_id is null and status = 'waiting' from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'), true, 'excluir a pessoa limpa waiting_on_person_id (a tarefa segue aguardando)');

-- ================= 2. Ideia =================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(pg_temp.affected($$update public.projects set status = 'idea' where id = 'a0000000-0000-0000-0000-000000000001'$$), 1, 'projeto vira Ideia');
select is(pg_temp.affected($$insert into public.tasks (name, project_id, user_id) values ('Tarefa na ideia', 'a0000000-0000-0000-0000-000000000001', auth.uid())$$), 1, 'projeto em Ideia recebe tarefas');
select throws_ok($$update public.projects set status = 'rascunho' where id = 'a0000000-0000-0000-0000-000000000001'$$, '23514', null, 'status de projeto desconhecido continua recusado');
select lives_ok($$insert into t_ctx select 'inbox', public.ensure_inbox_project()$$, 'caixa de entrada criada');
select throws_ok($$update public.projects set status = 'idea' where is_inbox$$, '42501', null, 'a Caixa de entrada não vira Ideia');

-- ================= 3. Saúde e próxima ação =================
select throws_ok($$update public.projects set health_override = 'purple' where id = 'a0000000-0000-0000-0000-000000000002'$$, '23514', null, 'health_override só aceita green/yellow/red');
select is(pg_temp.ret($$update public.projects set health_override = 'red' where id = 'a0000000-0000-0000-0000-000000000002' returning (health_override_at = now())::text$$)::boolean, true, 'ajuste manual grava health_override_at');
reset role;
alter table public.projects disable trigger project_health_fields;
update public.projects set health_override_at = '2026-10-01 10:00+00' where id = 'a0000000-0000-0000-0000-000000000002';
alter table public.projects enable trigger project_health_fields;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(pg_temp.ret($$update public.projects set description = 'x' where id = 'a0000000-0000-0000-0000-000000000002' returning health_override_at::text$$)::timestamptz, '2026-10-01 10:00+00'::timestamptz, 'editar outro campo mantém a data do ajuste');
select is(pg_temp.ret($$update public.projects set health_override_at = '2030-01-01' where id = 'a0000000-0000-0000-0000-000000000002' returning health_override_at::text$$)::timestamptz, '2026-10-01 10:00+00'::timestamptz, 'app não reescreve health_override_at');
select is(pg_temp.ret($$update public.projects set health_override = 'yellow' where id = 'a0000000-0000-0000-0000-000000000002' returning (health_override_at = now())::text$$)::boolean, true, 'mudar a cor manual renova a data');
select is(pg_temp.ret($$update public.projects set health_override = null where id = 'a0000000-0000-0000-0000-000000000002' returning (health_override_at is null)::text$$)::boolean, true, 'voltar ao calculado limpa a data');
select is(pg_temp.affected($$update public.projects set next_action_task_id = 'c0000000-0000-0000-0000-000000000002' where id = 'a0000000-0000-0000-0000-000000000002'$$), 1, 'próxima ação: tarefa do próprio projeto');
select throws_ok($$update public.projects set next_action_task_id = 'c0000000-0000-0000-0000-000000000001' where id = 'a0000000-0000-0000-0000-000000000002'$$, '23514', null, 'próxima ação de outro projeto é recusada');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(pg_temp.affected($$update public.projects set next_action_task_id = null, health_override = 'green' where id = 'a0000000-0000-0000-0000-000000000002'$$), 0, 'participante não muda próxima ação nem ajuste manual');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(pg_temp.affected($$delete from public.tasks where id = 'c0000000-0000-0000-0000-000000000002'$$), 1, 'excluir a tarefa da próxima ação');
select is((select next_action_task_id is null from public.projects where id = 'a0000000-0000-0000-0000-000000000002'), true, 'próxima ação excluída vira null');

-- ================= 4. Pessoas por workspace =================
select is(pg_temp.affected($$update public.people set workspace_id = (select id from public.workspaces where user_id = auth.uid() and kind = 'corporate') where id = 'b0000000-0000-0000-0000-00000000000a'$$), 1, 'pessoa ganha workspace do próprio dono');
select throws_ok($$update public.people set workspace_id = (select public.default_workspace_for_user('33333333-3333-3333-3333-333333333333', 'personal')) where id = 'b0000000-0000-0000-0000-00000000000a'$$, '42501', null, 'workspace de outro usuário é recusado');
select throws_ok($$insert into public.people (name, type, color, user_id, workspace_id) values ('Nova', 'partner', '#000', auth.uid(), (select public.default_workspace_for_user('33333333-3333-3333-3333-333333333333', 'personal')))$$, '42501', null, 'insert com workspace de outro usuário é recusado');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.people), 1, 'U3 continua vendo só a própria pessoa (workspace não amplia acesso)');
reset role;
-- Excluir o workspace solta a pessoa (volta a "todos os workspaces")
insert into public.workspaces (id, user_id, name, kind) values ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Extra', 'corporate');
update public.people set workspace_id = 'd0000000-0000-0000-0000-000000000001' where id = 'b0000000-0000-0000-0000-00000000000a';
delete from public.workspaces where id = 'd0000000-0000-0000-0000-000000000001';
select is((select workspace_id is null from public.people where id = 'b0000000-0000-0000-0000-00000000000a'), true, 'excluir o workspace deixa a pessoa em todos os workspaces');

select * from finish();
rollback;
