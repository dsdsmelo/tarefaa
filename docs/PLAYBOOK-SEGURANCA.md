# Playbook de Hardening de Segurança

Procedimento reutilizável para elevar a segurança de qualquer sistema web.
Cada item traz **o risco**, **o que fazer** e as **variantes** por stack:

- **Supabase** (auth/RLS gerenciados)
- **Self-hosted** (API própria em Node/PHP/etc. + **Postgres no servidor**)
- **Infra comum**: **Docker Swarm + Traefik** (proxy compartilhado) e containers nginx

> Como usar: percorra as seções na ordem. Ao final há um **checklist** para
> marcar por sistema. Aplique mudanças sensíveis (CSP, 2FA obrigatório) sempre
> **testando antes de “enforce”** e com **backup/rollback** à mão.

---

## 0. Princípios (valem para tudo)

1. **Autorização é sempre no servidor.** O cliente pode ser adulterado; nunca
   confie em checagens só de front (ex.: `sessionStorage`, `isAdmin` no React).
2. **Segredos nunca no frontend.** Só chaves públicas (ex.: site key do captcha,
   anon key do Supabase) podem ir ao navegador. Chaves privadas ficam no servidor.
3. **Defesa em camadas.** Sanitização **e** CSP; RLS **e** validação na app; etc.
4. **Fail-closed.** Na dúvida, negue (ex.: cron sem segredo → 401).
5. **Rollout seguro.** Report-Only antes de enforce; testar com a própria conta
   antes de obrigar todos; backup antes de editar infra.

---

## 1. Autenticação e 2FA

**Risco:** conta invadida por senha vazada/força bruta; 2FA "de mentira".

### 1.1 2FA/MFA obrigatório (TOTP)
- **Supabase:** MFA nativo — `supabase.auth.mfa.enroll/challenge/verify` +
  `getAuthenticatorAssuranceLevel()`. Bloquear o app até **AAL2** (enroll se não
  tem fator, challenge se tem). Habilitar TOTP no painel (Authentication → MFA).
- **Self-hosted:** usar lib TOTP (`otplib`, `speakeasy`) **mas validar o código
  no SERVIDOR** (nunca no cliente). Guardar o segredo TOTP **cifrado** no banco,
  em coluna que o cliente **não** consegue ler. Elevar a sessão só após verificar.
  Alternativa robusta: adotar um provedor/lib de auth (Keycloak, Auth.js/NextAuth,
  Lucia, Ory) que já traz MFA testado.
- **Anti-padrão a eliminar:** enviar o segredo TOTP ao browser e validar o código
  no cliente — isso **não protege nada**.

### 1.2 Política de senha
- Mínimo **8** caracteres + maiúscula/minúscula/número; validar no cliente **e**
  no servidor.
- **Bloquear senhas vazadas** (HaveIBeenPwned). Supabase: “Leaked password
  protection”. Self-hosted: checar o hash k-anonymity da API do HIBP no cadastro.

### 1.3 Anti-enumeração de contas
- Login e "esqueci a senha" devem responder **genérico** ("se o e-mail existir,
  enviaremos…"), sem revelar se o e-mail/usuário existe ou é admin.

### 1.4 Rate limit / lockout **no servidor**
- Bloqueio por tentativas deve ser **server-side** (não `localStorage`, que o
  atacante limpa). Supabase já limita; self-hosted: rate limit por IP/usuário
  (Redis, middleware).

---

## 2. CAPTCHA (anti-bot)

**Risco:** força bruta e abuso de formulários públicos (cadastro, checkout).

- Widget **Cloudflare Turnstile** nas telas: login, cadastro, recuperação de
  senha e **qualquer formulário público** (ex.: checkout de convidado).
- **Verificação server-side (`siteverify`) é obrigatória** — o token do widget
  só vale se validado no servidor:
  - **Supabase Auth:** habilitar CAPTCHA no painel (o próprio Supabase faz o
    `siteverify`). Basta enviar `options.captchaToken` nas chamadas de auth.
  - **Endpoints próprios (não-auth):** o **seu backend** chama
    `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` com
    `secret` + `response` (token) + `remoteip`, e só prossegue se
    `success === true` (e, idealmente, `hostname` na allowlist).
- **Secret key** só no servidor. **Site key** pode ir no front.
- Conferir os **hostnames** liberados no widget (todos os subdomínios usados).

---

## 3. Autorização e isolamento de dados (multi-tenant)

**Risco:** um usuário acessar dados de outro (vazamento entre contas/tenants).

- **Supabase (RLS):**
  - Toda tabela de negócio com `user_id`/`org_id` e **RLS por dono**
    (`user_id = auth.uid()`), nunca `auth.role() = 'authenticated'` (que deixa
    qualquer logado ver tudo).
  - Acesso compartilhado (ex.: membros de projeto) via função `SECURITY DEFINER`
    (`can_access_project(...)`) para evitar recursão de política.
  - Conferir com `select * from pg_policies` — não pode haver tabela aberta.
- **Postgres self-hosted:** duas opções (podem combinar):
  1. **RLS no Postgres:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, definir o
     usuário/tenant por request (`SET LOCAL app.user_id = ...`) e políticas
     `USING (user_id = current_setting('app.user_id')::uuid)`.
  2. **Autorização na aplicação:** middleware que injeta o `user_id/tenant_id` do
     token em **todas** as queries; **checar ownership em cada endpoint** antes de
     ler/gravar. Nunca filtrar só no front.
- **Chaves de API do usuário (ex.: OpenAI):** **write-only** — o cliente grava,
  mas **nunca lê** o valor de volta. Guardar server-side; expor só um status
  ("configurada: sim/não"). O backend usa a chave; o navegador não a recebe.

---

## 4. XSS e conteúdo do usuário

**Risco:** script malicioso injetado via conteúdo (anotações, comentários) que
executa no navegador de outros usuários.

- **Sanitizar HTML** de usuário antes de renderizar/imprimir/exportar
  (ex.: **DOMPurify**). **Escapar** interpolações de texto simples em HTML.
- Preferir frameworks que **escapam por padrão** (React `{}`); tratar com muito
  cuidado `dangerouslySetInnerHTML` / `v-html` / `innerHTML` / `document.write`.
- **CSP** (seção 7) como segunda camada.

---

## 5. Segredos

**Risco:** vazamento de chaves/credenciais.

- **Nunca** commitar `.env` (adicionar ao `.gitignore`; se já foi versionado,
  `git rm --cached` e **rotacionar** o que era secreto).
- **Nunca** embutir chave privada no bundle do front. Só chaves públicas.
- Guardar segredos em: **Supabase secrets** / **Docker secrets** / cofre (Vault)
  / variáveis de ambiente do servidor — **não** no código.
- **Não logar** senhas, tokens ou segredos.
- Se um segredo apareceu em chat/print/log → **rotacionar**.

---

## 6. API / Edge Functions / Webhooks

**Risco:** endpoints sensíveis chamados por terceiros; CSRF; abuso de jobs.

- **Validar sessão/JWT e o papel** (admin, etc.) **no servidor** em toda rota
  sensível — não confiar em flag do cliente.
- **Webhooks:** validar **assinatura** (ex.: `Stripe-Signature` com o webhook
  secret). Rejeitar o que não for assinado.
- **CORS:** restringir `Access-Control-Allow-Origin` aos **domínios do sistema**
  (não `*`) em endpoints autenticados.
- **Cron/tarefas internas:** exigir um **segredo** no header (fail-closed: sem o
  segredo correto, 401). Não liberar "se tiver qualquer Authorization".
- **Autorização de recurso:** confirmar que o recurso pertence a quem chama
  (ex.: `where user_id = :caller`).

---

## 7. Cabeçalhos de segurança (nginx / Traefik)

**Risco:** clickjacking, downgrade para HTTP, MIME sniffing, XSS sem 2ª camada.

Cabeçalhos recomendados:

| Cabeçalho | Valor | Para quê |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | força HTTPS |
| `X-Frame-Options` | `SAMEORIGIN` (ou `DENY`) | anti-clickjacking |
| `X-Content-Type-Options` | `nosniff` | evita MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | menos vazamento |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | desliga APIs não usadas |
| `Content-Security-Policy` | allowlist de origens | 2ª camada anti-XSS |

**Onde aplicar depende da infra:**

### 7.1 Container nginx próprio (escopo do serviço)
`add_header ... always;` no `server { }` da config do container (arquivo
montado). Afeta só aquele serviço. A CSP não é herdada por `location` que tenha
seu próprio `add_header` — repita onde necessário. **Comece a CSP em
`Content-Security-Policy-Report-Only`**, valide o console do navegador (sem
violações do seu app), e só então troque para `Content-Security-Policy`.

### 7.2 Traefik compartilhado (recomendado para vários sistemas)
Aplicar um **middleware de headers por labels, preso ao roteador daquele
serviço** — assim **não afeta os outros sistemas**. Exemplo (Docker Swarm,
`deploy.labels`):

```yaml
deploy:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.MEUAPP.rule=Host(`meuapp.com.br`)"
    - "traefik.http.routers.MEUAPP.entrypoints=websecure"
    - "traefik.http.routers.MEUAPP.tls.certresolver=letsencryptresolver"
    # Middleware de segurança (escopo só deste serviço)
    - "traefik.http.middlewares.MEUAPP-sec.headers.stsSeconds=31536000"
    - "traefik.http.middlewares.MEUAPP-sec.headers.stsIncludeSubdomains=true"
    - "traefik.http.middlewares.MEUAPP-sec.headers.frameDeny=true"
    - "traefik.http.middlewares.MEUAPP-sec.headers.contentTypeNosniff=true"
    - "traefik.http.middlewares.MEUAPP-sec.headers.referrerPolicy=strict-origin-when-cross-origin"
    - "traefik.http.middlewares.MEUAPP-sec.headers.permissionsPolicy=camera=(), microphone=(), geolocation=()"
    - "traefik.http.middlewares.MEUAPP-sec.headers.contentSecurityPolicy=default-src 'self'; object-src 'none'; frame-ancestors 'self'"
    # Amarra o middleware ao roteador deste serviço
    - "traefik.http.routers.MEUAPP.middlewares=MEUAPP-sec"
```

> ⚠️ Nunca coloque headers na config **global** do Traefik se ele serve vários
> sistemas — use middleware **por roteador**. A CSP em labels não tem modo
> "report-only" separado; se preferir testar, aplique a CSP primeiro só no
> container nginx (7.1) em Report-Only e depois migre.

### 7.3 Exemplo de CSP (ajuste as origens)
```
default-src 'self';
script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' data: https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' https://SEU-BACKEND wss://SEU-BACKEND https://challenges.cloudflare.com https://cloudflareinsights.com;
frame-src https://challenges.cloudflare.com;
base-uri 'self'; form-action 'self'; object-src 'none'
```
Origens comuns que costumam faltar: **fontes** (Google Fonts), **imagens**
externas, **analytics** do Cloudflare (`static.cloudflareinsights.com` /
`cloudflareinsights.com`), **websocket** do backend, iframe do **Turnstile**.

---

## 8. Dependências

**Risco:** vulnerabilidades conhecidas em libs.

- Node: `npm audit` → `npm audit fix` (**sem** `--force`), depois **buildar/testar**.
  Evitar `--force` (traz breaking changes) a menos que revisado.
- Bibliotecas sem correção upstream (ex.: `xlsx`): avaliar substituição
  (`exceljs`). O risco de `xlsx` é maior se o sistema **importa/parseia** arquivos
  de terceiros; se só **gera** (exporta), o risco é menor.
- Outras stacks: `pip-audit` (Python), `composer audit` (PHP), `govulncheck` (Go),
  `cargo audit` (Rust). Manter versões atualizadas periodicamente.

---

## 9. Transporte e Postgres self-hosted

**Risco:** banco exposto, tráfego sem TLS.

- **HTTPS obrigatório** (Let's Encrypt via Traefik); redirect http→https.
- **Postgres no servidor:**
  - **Não** expor a porta 5432 na internet (bind em rede interna do Docker/Swarm;
    firewall). Acesso só pela rede dos containers.
  - Senhas fortes; usuários com **least privilege** (app não usa superuser).
  - Conexões com **TLS** quando cruzam a rede; backups automáticos e testados.
  - RLS (seção 3) se o multi-tenant for no próprio Postgres.

---

## 10. Checklist final (por sistema)

Autenticação
- [ ] 2FA/TOTP **obrigatório**, verificado **no servidor**
- [ ] Política de senha forte + bloqueio de senha vazada (HIBP)
- [ ] Anti-enumeração em login/reset
- [ ] Rate limit/lockout **server-side**

Anti-bot
- [ ] CAPTCHA (Turnstile) nos formulários públicos
- [ ] **siteverify server-side** (ou CAPTCHA do provedor de auth)
- [ ] Hostnames corretos no widget; secret só no servidor

Autorização / dados
- [ ] Autorização **no servidor** em toda rota sensível
- [ ] Isolamento por tenant (RLS ou checagem de ownership em todas as queries)
- [ ] Nenhuma tabela/endpoint aberto por engano
- [ ] Chaves de API do usuário **write-only** (cliente não lê)

Conteúdo / XSS
- [ ] Sanitização de HTML de usuário (DOMPurify) + escaping
- [ ] CSP configurada

Segredos
- [ ] `.env` fora do git; nenhuma chave privada no front
- [ ] Segredos em cofre/secrets; nada logado
- [ ] Segredos expostos foram rotacionados

API / Webhooks
- [ ] Webhooks com assinatura validada
- [ ] CORS restrito ao domínio
- [ ] Cron/jobs internos com segredo (fail-closed)

Infra
- [ ] Cabeçalhos de segurança (HSTS, X-Frame, nosniff, Referrer, Permissions, CSP)
      — **escopo por serviço** no Traefik
- [ ] HTTPS forçado
- [ ] Postgres não exposto; least privilege; backups
- [ ] `npm audit` (ou equivalente) sem vulnerabilidades críticas/altas evitáveis

---

### Ordem sugerida de execução
1. Segredos + `.env` (rápido, alto impacto)
2. Autorização/isolamento (o mais crítico)
3. XSS/sanitização
4. 2FA + política de senha + anti-enumeração
5. CAPTCHA + siteverify
6. API/CORS/webhooks/cron
7. Cabeçalhos + CSP (Report-Only → enforce)
8. Dependências
9. Transporte/Postgres

> Dica: para cada mudança de infra, tenha **backup e rollback** prontos, teste
> num container/staging descartável quando possível, e valide **antes** de
> tornar obrigatório.
