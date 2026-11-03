-- Testes de RLS de activity_logs: insert só autenticado e com o próprio user_id.
-- Eventos sem sessão vão pela Edge Function log-auth-event (service role).
-- Rodar com: supabase test db (banco local). Transação com rollback.

begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'dono@teste.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'outro@teste.local', 'authenticated', 'authenticated');

-- autenticado, com o próprio user_id: permitido
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.activity_logs (user_id, action, level) values ('11111111-1111-1111-1111-111111111111', 'task_created', 'success')$$,
  'autenticado grava log com o próprio user_id'
);

-- autenticado, com user_id de outra pessoa: bloqueado
select throws_ok(
  $$insert into public.activity_logs (user_id, action, level) values ('22222222-2222-2222-2222-222222222222', 'task_created', 'success')$$,
  '42501', null,
  'autenticado NÃO grava log em nome de outra pessoa'
);

-- autenticado, sem user_id: bloqueado
select throws_ok(
  $$insert into public.activity_logs (user_id, action, level) values (null, 'login_failed', 'warning')$$,
  '42501', null,
  'autenticado NÃO grava log sem user_id'
);

-- anônimo: bloqueado (com ou sem user_id)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$insert into public.activity_logs (user_id, action, level) values (null, 'login_failed', 'warning')$$,
  '42501', null,
  'anônimo NÃO grava log'
);
select throws_ok(
  $$insert into public.activity_logs (user_id, action, level) values ('11111111-1111-1111-1111-111111111111', 'login', 'success')$$,
  '42501', null,
  'anônimo NÃO grava log em nome de um usuário'
);

reset role;
select * from finish();
rollback;
