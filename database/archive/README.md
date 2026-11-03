# SQL arquivado — NÃO EXECUTAR

Estes arquivos são histórico. **Não os execute** em nenhum banco, nem em produção nem em ambiente novo:

- `schema.sql` e `supabase-schema.sql` estão desatualizados. Não têm, por exemplo, `user_id` nas tabelas de projeto, workspaces nem as policies atuais, e o `supabase-schema.sql` abre todas as tabelas (`USING (true)`).
- `migrations/001` a `009` e `20260922120000_workspaces.sql` foram aplicados manualmente em produção, junto com mudanças feitas direto no painel do Supabase que não estão em nenhum arquivo.

## Fonte de verdade

A partir de 2026-11-03, a **única** fonte de migrations é `supabase/migrations/`:

1. `20261103000000_baseline_prod.sql`: snapshot do schema de produção, gerado por `scripts/dump-baseline.sh` (somente leitura). Serve para bancos vazios e **não deve ser executado em produção**, onde esse estado já existe.
2. Migrations seguintes: mudanças novas, idempotentes, aplicadas em produção pelo SQL Editor (ou pela CLI, ver `docs/DEPLOYMENT.md`).
