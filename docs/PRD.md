# PRD - Product Requirements Document
## Tarefaa - Sistema de Gerenciamento de Projetos

**Versão:** 1.0  
**Data:** Janeiro 2026  
**Status:** Em Produção

---

## 1. Visão Geral do Produto

### 1.1 Descrição
O **Tarefaa** é um sistema SaaS de gerenciamento de projetos desenvolvido para substituir planilhas Excel no acompanhamento de projetos de infraestrutura de TI. O sistema oferece visualizações em Gantt, histórico de alterações, dashboards consolidados e gestão de equipes internas e parceiros externos.

### 1.2 Objetivo
Fornecer uma plataforma intuitiva e eficiente para gestão de projetos, tarefas, pessoas e cronogramas, com foco em:
- Visualização clara do progresso dos projetos
- Rastreamento de responsabilidades
- Acompanhamento de prazos e marcos
- Colaboração entre equipes internas e parceiros

### 1.3 Público-Alvo
- Gerentes de projetos de TI
- Coordenadores de infraestrutura
- Equipes técnicas internas
- Parceiros e fornecedores externos

---

## 2. Modelo de Negócio

### 2.1 Precificação
- **Plano Único:** R$ 49,00/mês
- **Sem plano gratuito**
- **Ambiente isolado por usuário**
- **Pagamento via Stripe**

### 2.2 Fluxo de Conversão
1. Landing Page minimalista (`/`)
2. Cadastro/Login (`/login`, `/auth`)
3. Checkout via Stripe
4. Acesso ao Dashboard

---

## 3. Arquitetura Técnica

### 3.1 Stack Tecnológica

#### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Estilização:** Tailwind CSS + shadcn/ui
- **Roteamento:** React Router DOM v6
- **Estado:** React Context + TanStack Query
- **Animações:** Framer Motion
- **Gráficos:** Recharts

#### Backend
- **Plataforma:** Supabase
- **Banco de Dados:** PostgreSQL
- **Autenticação:** Supabase Auth
- **Storage:** Supabase Storage
- **Serverless Functions:** Supabase Edge Functions (Deno)

#### Integrações
- **Pagamentos:** Stripe (Checkout, Portal, Webhooks)
- **2FA:** OTPAuth + QR Code

### 3.2 Estrutura de Diretórios

```
├── src/
│   ├── assets/              # Imagens e recursos estáticos
│   ├── components/
│   │   ├── admin/           # Componentes do painel admin
│   │   ├── custom-columns/  # Colunas customizáveis
│   │   ├── gantt/           # Gráfico Gantt
│   │   ├── layout/          # Header, Sidebar, MainLayout
│   │   ├── meetings/        # Notas de reunião
│   │   ├── modals/          # Modais de formulários
│   │   ├── phases/          # Gerenciador de fases
│   │   ├── tasks/           # Componentes de tarefas
│   │   └── ui/              # Componentes base (shadcn)
│   ├── contexts/
│   │   ├── AuthContext.tsx  # Estado de autenticação
│   │   └── DataContext.tsx  # Estado global de dados
│   ├── hooks/
│   │   └── useSupabaseData.ts # CRUD operations
│   ├── lib/
│   │   ├── types.ts         # Tipos TypeScript
│   │   ├── utils.ts         # Utilitários
│   │   └── supabase.ts      # Cliente Supabase
│   ├── pages/               # Páginas da aplicação
│   └── integrations/
│       └── supabase/        # Tipos e cliente gerados
├── supabase/
│   ├── config.toml          # Configuração do projeto
│   └── functions/           # Edge Functions
│       ├── create-checkout/
│       ├── create-portal-session/
│       ├── get-stripe-price/
│       ├── get-subscription/
│       ├── stripe-webhook/
│       └── admin-reset-password/
└── docs/                    # Documentação
```

---

## 4. Funcionalidades

### 4.1 Módulo de Autenticação
| Feature | Descrição | Status |
|---------|-----------|--------|
| Login por email/senha | Autenticação padrão | ✅ |
| Cadastro de usuários | Registro com confirmação | ✅ |
| Recuperação de senha | Fluxo de reset por email | ✅ |
| Proteção de rotas | Redirect para login | ✅ |
| Verificação de assinatura | Acesso condicionado ao pagamento | ✅ |

### 4.2 Módulo de Dashboard
| Feature | Descrição | Status |
|---------|-----------|--------|
| Estatísticas gerais | Cards com métricas | ✅ |
| Tarefas recentes | Lista das últimas tarefas | ✅ |
| Progresso por projeto | Gráficos de progresso | ✅ |
| Tarefas por responsável | Distribuição de trabalho | ✅ |

### 4.3 Módulo de Projetos
| Feature | Descrição | Status |
|---------|-----------|--------|
| CRUD de projetos | Criar, editar, excluir | ✅ |
| Status do projeto | Planning, Active, Paused, Completed, Cancelled | ✅ |
| Datas de início/fim | Período do projeto | ✅ |
| Detalhes do projeto | Página com visão completa | ✅ |

### 4.4 Módulo de Tarefas
| Feature | Descrição | Status |
|---------|-----------|--------|
| CRUD de tarefas | Criar, editar, excluir | ✅ |
| Status | Pending, In Progress, Blocked, Completed, Cancelled | ✅ |
| Prioridade | Low, Medium, High, Urgent | ✅ |
| Responsável | Atribuição a pessoas | ✅ |
| Datas | Início, fim, sprint | ✅ |
| Edição inline | Edição direta na tabela | ✅ |
| Colunas customizáveis | Campos personalizados por projeto | ✅ |
| Progresso | Percentual de conclusão | ✅ |

### 4.5 Módulo de Pessoas
| Feature | Descrição | Status |
|---------|-----------|--------|
| CRUD de pessoas | Criar, editar, ativar/desativar | ✅ |
| Tipos | Interno, Parceiro | ✅ |
| Avatar com foto | Upload de imagem | ✅ |
| Cor identificadora | Cor para visualização | ✅ |
| Contagem de tarefas | Ativas e concluídas | ✅ |

### 4.6 Módulo Gantt
| Feature | Descrição | Status |
|---------|-----------|--------|
| Visualização por projeto | Gantt específico | ✅ |
| Visualização global | Todos os projetos | ✅ |
| Agrupamento | Por projeto ou responsável | ✅ |
| Zoom | Dia, Semana, Mês | ✅ |
| Fases | Barras de período | ✅ |
| Marcos | Diamantes com datas | ✅ |
| Linha de hoje | Indicador visual | ✅ |

### 4.7 Módulo de Fases e Marcos
| Feature | Descrição | Status |
|---------|-----------|--------|
| CRUD de fases | Períodos do projeto | ✅ |
| CRUD de marcos | Datas importantes | ✅ |
| Cores personalizadas | Identificação visual | ✅ |
| Status de conclusão | Marcar como concluído | ✅ |

### 4.8 Módulo de Células
| Feature | Descrição | Status |
|---------|-----------|--------|
| CRUD de células | Áreas organizacionais | ✅ |
| Associação a tarefas | Categorização | ✅ |

### 4.9 Módulo de Colunas Customizáveis
| Feature | Descrição | Status |
|---------|-----------|--------|
| Tipos de coluna | Text, Number, Date, List, Percentage, User | ✅ |
| Campos padrão | Name, Description, Responsible, Status, Priority, Dates, Progress | ✅ |
| Reordenação | Drag and drop | ✅ |
| Valores personalizados | Por tarefa | ✅ |

### 4.10 Módulo Admin
| Feature | Descrição | Status |
|---------|-----------|--------|
| Login separado | `/admin/login` | ✅ |
| Dashboard admin | Métricas do sistema | ✅ |
| Gestão de usuários | Lista e ações | ✅ |
| Logs de auditoria | Histórico de ações | ✅ |
| Infraestrutura | Status das Edge Functions | ✅ |
| 2FA | Autenticação em dois fatores | ✅ |
| Reset de senha | Por email | ✅ |

### 4.11 Módulo de Pagamentos (Stripe)
| Feature | Descrição | Status |
|---------|-----------|--------|
| Checkout | Criação de sessão | ✅ |
| Portal do cliente | Gerenciar assinatura | ✅ |
| Webhooks | Eventos do Stripe | ✅ |
| Verificação de assinatura | Status ativo/inativo | ✅ |

---

## 5. Entidades e Relacionamentos

### 5.1 Diagrama ER

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   profiles  │     │   projects  │────<│   phases    │
│─────────────│     │─────────────│     │─────────────│
│ id (PK)     │     │ id (PK)     │     │ id (PK)     │
│ user_id     │     │ name        │     │ project_id  │
│ full_name   │     │ description │     │ name        │
│ avatar_url  │     │ start_date  │     │ start_date  │
└─────────────┘     │ end_date    │     │ end_date    │
                    │ status      │     │ color       │
                    └─────────────┘     └─────────────┘
                          │                   
                          │                   
                    ┌─────▼─────┐     ┌─────────────┐
                    │   tasks   │────<│custom_columns│
                    │───────────│     │─────────────│
                    │ id (PK)   │     │ id (PK)     │
                    │ project_id│     │ project_id  │
                    │ phase_id  │     │ name        │
                    │ cell_id   │     │ type        │
                    │ responsible│    │ options     │
                    │ status    │     └─────────────┘
                    │ priority  │           
                    └───────────┘           
                          │                 
    ┌─────────────┐       │       ┌─────────────┐
    │   people    │───────┘       │ milestones  │
    │─────────────│               │─────────────│
    │ id (PK)     │               │ id (PK)     │
    │ name        │               │ project_id  │
    │ email       │               │ name        │
    │ type        │               │ date        │
    │ color       │               │ completed   │
    │ avatar_url  │               └─────────────┘
    └─────────────┘                     
          │                       ┌─────────────┐
          │                       │    cells    │
    ┌─────▼─────┐                │─────────────│
    │subscriptions│               │ id (PK)     │
    │─────────────│               │ name        │
    │ id (PK)     │               │ description │
    │ user_id     │               │ active      │
    │ stripe_*    │               └─────────────┘
    │ status      │                     
    └─────────────┘               ┌─────────────┐
                                  │ user_roles  │
    ┌─────────────┐               │─────────────│
    │activity_logs│               │ id (PK)     │
    │─────────────│               │ user_id     │
    │ id (PK)     │               │ role        │
    │ user_id     │               └─────────────┘
    │ action      │                     
    │ details     │               ┌─────────────┐
    └─────────────┘               │  admin_2fa  │
                                  │─────────────│
    ┌─────────────┐               │ id (PK)     │
    │meeting_notes│               │ user_id     │
    │─────────────│               │ secret      │
    │ id (PK)     │               │ enabled     │
    │ project_id  │               └─────────────┘
    │ title       │
    │ content     │
    └─────────────┘
```

---

## 6. Fluxos de Usuário

### 6.1 Fluxo de Onboarding
```
Landing Page → Clique "Entrar" → Login/Cadastro → Checkout Stripe → Dashboard
```

### 6.2 Fluxo de Gestão de Projeto
```
Dashboard → Projetos → Novo Projeto → Adicionar Fases → Adicionar Tarefas → Atribuir Responsáveis
```

### 6.3 Fluxo de Acompanhamento
```
Dashboard → Gantt (ou Projeto específico) → Visualizar Cronograma → Editar Tarefas inline
```

### 6.4 Fluxo Admin
```
/admin/login → Autenticação → 2FA (se habilitado) → Painel Admin → Gestão
```

---

## 7. Requisitos Não-Funcionais

### 7.1 Performance
- Tempo de carregamento inicial < 3s
- Tempo de resposta das APIs < 500ms
- Suporte a 100+ tarefas por projeto sem degradação

### 7.2 Segurança
- HTTPS obrigatório
- Row Level Security (RLS) em todas as tabelas
- Tokens JWT com expiração
- Validação de entrada com Zod
- 2FA para administradores
- Secrets armazenados de forma segura

### 7.3 Escalabilidade
- Arquitetura serverless (Edge Functions)
- Banco de dados gerenciado (Supabase/PostgreSQL)
- CDN para assets estáticos (via Vite/deploy)

### 7.4 Disponibilidade
- SLA de 99.9% (dependente do Supabase)
- Backup automático do banco de dados

---

## 8. Roadmap Futuro

### 8.1 Fase 2 (Próximo Trimestre)
- [ ] Notificações por email
- [ ] Comentários em tarefas
- [ ] Anexos de arquivos em tarefas
- [ ] Relatórios exportáveis (PDF/Excel)
- [ ] Filtros avançados

### 8.2 Fase 3 (Futuro)
- [ ] App mobile (React Native ou PWA)
- [ ] Integração com calendários (Google Calendar)
- [ ] Templates de projetos
- [ ] Automações (regras de workflow)
- [ ] API pública

---

## 9. Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| Taxa de conversão (trial → pago) | > 30% |
| Churn mensal | < 5% |
| NPS | > 50 |
| Tempo médio de uso diário | > 15 min |
| Tarefas criadas por usuário/mês | > 50 |

---

## 10. Contatos

- **Produto:** [email]
- **Desenvolvimento:** [email]
- **Suporte:** [email]

---

**Documento atualizado em:** Janeiro 2026
