# Guia de Implantação - Tarefaa

Este documento descreve os procedimentos completos para implantação do sistema Tarefaa em uma VPS com Supabase externo.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Configuração do Supabase](#2-configuração-do-supabase)
3. [Configuração do Stripe](#3-configuração-do-stripe)
4. [Configuração da VPS](#4-configuração-da-vps)
5. [Deploy da Aplicação](#5-deploy-da-aplicação)
6. [Configuração de Edge Functions](#6-configuração-de-edge-functions)
7. [Configuração de DNS e SSL](#7-configuração-de-dns-e-ssl)
8. [Verificações Pós-Deploy](#8-verificações-pós-deploy)
9. [Manutenção](#9-manutenção)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Pré-requisitos

### 1.1 Contas Necessárias
- **Supabase:** Conta em [supabase.com](https://supabase.com)
- **Stripe:** Conta em [stripe.com](https://stripe.com)
- **Provedor VPS:** DigitalOcean, AWS, Vultr, etc.
- **Domínio:** Registrado e com acesso ao DNS

### 1.2 Ferramentas Locais
```bash
# Node.js 18+
node --version  # >= 18.0.0

# npm ou bun
npm --version   # >= 9.0.0

# Supabase CLI
npm install -g supabase

# Git
git --version
```

### 1.3 Especificações Mínimas da VPS
- **CPU:** 1 vCPU
- **RAM:** 2GB
- **Disco:** 20GB SSD
- **OS:** Ubuntu 22.04 LTS

---

## 2. Configuração do Supabase

### 2.1 Criar Projeto
1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique em "New Project"
3. Configure:
   - **Name:** tarefaa-production
   - **Database Password:** (anote em local seguro)
   - **Region:** Escolha a mais próxima dos usuários
4. Aguarde a criação do projeto

### 2.2 Obter Credenciais
No dashboard do projeto, vá em **Settings > API** e anote:
- **Project URL:** `https://xxxxx.supabase.co`
- **Project ID:** `xxxxx`
- **anon/public key:** (chave pública)
- **service_role key:** (chave secreta - NÃO exponha no frontend)

### 2.3 Executar Schema do Banco
1. Vá em **SQL Editor**
2. Execute o conteúdo do arquivo `database/schema.sql` (fornecido abaixo)
3. Verifique se todas as tabelas foram criadas em **Table Editor**

### 2.4 Configurar Autenticação
1. Vá em **Authentication > Providers**
2. Configure **Email**:
   - Enable Email Signup: ✅
   - Confirm email: ❌ (para testes) ou ✅ (produção)
   - Minimum password length: 6

3. Vá em **Authentication > URL Configuration**:
   - Site URL: `https://seu-dominio.com`
   - Redirect URLs: 
     - `https://seu-dominio.com/dashboard`
     - `https://seu-dominio.com/reset-password`

### 2.5 Configurar Storage
1. Vá em **Storage**
2. Crie o bucket `person-avatars`:
   - Public: ✅
   - File size limit: 5MB
   - Allowed MIME types: `image/jpeg, image/png, image/webp, image/gif`

### 2.6 Configurar RLS
Execute o arquivo `database/rls-policies.sql` no SQL Editor.

---

## 3. Configuração do Stripe

### 3.1 Configurar Produto
1. Acesse [dashboard.stripe.com](https://dashboard.stripe.com)
2. Vá em **Products > Add product**
3. Configure:
   - **Name:** Tarefaa - Plano Mensal
   - **Price:** R$ 49,00 / mês
   - **Billing period:** Monthly
4. Anote o **Price ID** (ex: `price_xxxxx`)

### 3.2 Obter API Keys
Em **Developers > API keys**:
- **Publishable key:** `pk_live_xxxxx` (ou `pk_test_xxxxx` para testes)
- **Secret key:** `sk_live_xxxxx` (ou `sk_test_xxxxx` para testes)

### 3.3 Configurar Webhook
1. Vá em **Developers > Webhooks**
2. Clique em **Add endpoint**
3. Configure:
   - **URL:** `https://xxxxx.supabase.co/functions/v1/stripe-webhook`
   - **Events:**
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. Anote o **Signing secret** (`whsec_xxxxx`)

---

## 4. Configuração da VPS

### 4.1 Acesso Inicial
```bash
# Conectar via SSH
ssh root@seu-ip-da-vps

# Atualizar sistema
apt update && apt upgrade -y

# Criar usuário (não usar root)
adduser tarefaa
usermod -aG sudo tarefaa

# Configurar SSH para o novo usuário
su - tarefaa
```

### 4.2 Instalar Dependências
```bash
# Node.js 20 via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# PM2 para gerenciar processos
npm install -g pm2

# Nginx
sudo apt install nginx -y

# Certbot para SSL
sudo apt install certbot python3-certbot-nginx -y
```

### 4.3 Configurar Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 5. Deploy da Aplicação

### 5.1 Clonar Repositório
```bash
cd /home/tarefaa
git clone https://seu-repositorio.git app
cd app
```

### 5.2 Configurar Variáveis de Ambiente
```bash
# Criar arquivo .env
cat > .env << EOF
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJxxxxxx
VITE_SUPABASE_PROJECT_ID=xxxxx
EOF
```

### 5.3 Build da Aplicação
```bash
# Instalar dependências
npm install

# Build de produção
npm run build
```

### 5.4 Configurar Nginx
```bash
sudo nano /etc/nginx/sites-available/tarefaa
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    
    root /home/tarefaa/app/dist;
    index index.html;
    
    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Cache de assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # SPA routing - redirecionar todas as rotas para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Headers de segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Ativar site:
```bash
sudo ln -s /etc/nginx/sites-available/tarefaa /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Configuração de Edge Functions

### 6.1 Instalar Supabase CLI
```bash
npm install -g supabase
```

### 6.2 Login e Link
```bash
supabase login
supabase link --project-ref xxxxx
```

### 6.3 Configurar Secrets
```bash
# Stripe
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# As seguintes já são configuradas automaticamente:
# SUPABASE_URL
# SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

### 6.4 Deploy das Functions
```bash
cd /home/tarefaa/app

# Deploy individual
supabase functions deploy create-checkout
supabase functions deploy create-portal-session
supabase functions deploy get-subscription
supabase functions deploy get-stripe-price
supabase functions deploy stripe-webhook
supabase functions deploy admin-reset-password

# Ou deploy de todas
supabase functions deploy
```

### 6.5 Configurar JWT (IMPORTANTE!)
No Supabase Dashboard, vá em **Edge Functions** e para cada função:
1. Clique na função
2. Em **Settings**, desabilite:
   - ❌ Verify JWT
   - ❌ Verify JWT with legacy secret

Isso é necessário porque as funções fazem validação interna do token.

---

## 7. Configuração de DNS e SSL

### 7.1 Configurar DNS
No painel do seu registrador de domínio:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | @ | IP-DA-VPS | 300 |
| A | www | IP-DA-VPS | 300 |
| CNAME | api | xxxxx.supabase.co | 300 |

### 7.2 Instalar Certificado SSL
```bash
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

Siga as instruções e escolha redirecionar HTTP para HTTPS.

### 7.3 Auto-renovação
```bash
# Testar renovação
sudo certbot renew --dry-run

# Adicionar cron para renovação automática
sudo crontab -e
# Adicionar linha:
0 3 * * * certbot renew --quiet
```

---

## 8. Verificações Pós-Deploy

### 8.1 Checklist de Verificação

- [ ] Site acessível via HTTPS
- [ ] Login funcionando
- [ ] Cadastro funcionando
- [ ] Checkout do Stripe funcionando
- [ ] Webhook do Stripe recebendo eventos
- [ ] Upload de avatar funcionando
- [ ] CRUD de projetos funcionando
- [ ] CRUD de tarefas funcionando
- [ ] Gantt renderizando corretamente
- [ ] Painel admin acessível

### 8.2 Testar Edge Functions
```bash
# Testar get-subscription (requer token)
curl -X POST https://xxxxx.supabase.co/functions/v1/get-subscription \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json"

# Testar stripe webhook (requer assinatura válida)
# Use o Stripe CLI para testes locais
stripe listen --forward-to https://xxxxx.supabase.co/functions/v1/stripe-webhook
```

### 8.3 Verificar Logs
```bash
# Logs do Nginx
sudo tail -f /var/log/nginx/error.log

# Logs das Edge Functions (no Supabase Dashboard)
# Dashboard > Edge Functions > Logs
```

---

## 9. Manutenção

### 9.1 Atualizar Aplicação
```bash
cd /home/tarefaa/app
git pull origin main
npm install
npm run build
# Não precisa reiniciar - são arquivos estáticos
```

### 9.2 Backup do Banco de Dados
```bash
# Via Supabase Dashboard: Settings > Database > Backups

# Ou via pg_dump (requer conexão direta)
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d).sql
```

### 9.3 Monitoramento
- **Uptime:** Use UptimeRobot ou similar
- **Erros:** Configure alertas no Supabase
- **Métricas:** Use o dashboard do Supabase

### 9.4 Rotação de Secrets
Periodicamente (a cada 90 dias):
1. Gere novas API keys no Stripe
2. Atualize no Supabase Secrets
3. Atualize o webhook secret

---

## 10. Troubleshooting

### 10.1 Erro 502 Bad Gateway
```bash
# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx

# Verificar se os arquivos existem
ls -la /home/tarefaa/app/dist/
```

### 10.2 Erro de CORS
- Verifique se as Edge Functions têm os headers CORS corretos
- Verifique se a URL do site está nas Redirect URLs do Supabase

### 10.3 Login não funciona
- Verifique as variáveis de ambiente (.env)
- Verifique se o Site URL está configurado no Supabase Auth
- Verifique os logs do console do navegador

### 10.4 Stripe webhook falha
- Verifique se o STRIPE_WEBHOOK_SECRET está correto
- Verifique se a URL do webhook está acessível
- Use `stripe listen` para debug local

### 10.5 Upload de avatar falha
- Verifique se o bucket `person-avatars` existe
- Verifique se as políticas RLS do storage estão corretas
- Verifique o tamanho do arquivo (max 5MB)

---

## Arquivos de Configuração

### Nginx (Produção Completa)
```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com www.seu-dominio.com;
    
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    root /home/tarefaa/app/dist;
    index index.html;
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;
}
```

---

**Documento atualizado em:** Janeiro 2026
