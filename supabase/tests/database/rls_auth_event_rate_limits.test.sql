-- Testes do rate limit da log-auth-event (migration 20261104000400):
-- tabela não exposta, função só para service role, contagem atômica por janela.
-- Rodar com: supabase test db (banco local). Transação com rollback.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------- Não exposto para anon/authenticated ----------
set local role anon;
select throws_ok($$select count(*) from public.auth_event_rate_limits$$, '42501', null,
  'anônimo NÃO lê a tabela de rate limit');
select throws_ok($$insert into public.auth_event_rate_limits (bucket, window_start) values ('x', now())$$, '42501', null,
  'anônimo NÃO grava na tabela de rate limit');
select throws_ok($$select public.hit_rate_limit('ip:teste', 20, 600)$$, '42501', null,
  'anônimo NÃO executa hit_rate_limit()');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$select count(*) from public.auth_event_rate_limits$$, '42501', null,
  'autenticado NÃO lê a tabela de rate limit');
select throws_ok($$delete from public.auth_event_rate_limits$$, '42501', null,
  'autenticado NÃO apaga contadores');
select throws_ok($$select public.hit_rate_limit('ip:teste', 20, 600)$$, '42501', null,
  'autenticado NÃO executa hit_rate_limit()');

-- ---------- Service role: contagem ----------
reset role;
set local role service_role;

-- 20 primeiras chamadas do mesmo IP passam; a 21ª não
select is(
  (select bool_and(public.hit_rate_limit('ip:198.51.100.1', 20, 600)) from generate_series(1, 20)),
  true, '20 eventos do mesmo IP na janela: todos permitidos');
select is(public.hit_rate_limit('ip:198.51.100.1', 20, 600), false,
  '21º evento do mesmo IP na janela: bloqueado');

-- outro IP tem contador próprio
select is(public.hit_rate_limit('ip:198.51.100.2', 20, 600), true,
  'outro IP não é afetado pelo limite do primeiro');

-- limite global (300)
select is(
  (select bool_and(public.hit_rate_limit('global', 300, 600)) from generate_series(1, 300)),
  true, '300 eventos globais na janela: todos permitidos');
select is(public.hit_rate_limit('global', 300, 600), false,
  '301º evento global na janela: bloqueado');

-- parâmetros inválidos nunca liberam
select is(public.hit_rate_limit(null, 20, 600), false,
  'bucket nulo: bloqueado');

reset role;
select * from finish();
rollback;
