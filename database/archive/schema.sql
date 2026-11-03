-- ============================================
-- TAREFAA - SCHEMA COMPLETO DO BANCO DE DADOS
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TABELA: PROFILES (Dados extras do usuário)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Perfis de usuários com dados adicionais';

-- ============================================
-- 2. TABELA: SUBSCRIPTIONS (Assinaturas Stripe)
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE public.subscriptions IS 'Assinaturas dos usuários via Stripe';

-- ============================================
-- 3. TABELA: USER_ROLES (Papéis/Permissões)
-- ============================================
-- Criar enum para roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

COMMENT ON TABLE public.user_roles IS 'Papéis e permissões dos usuários';

-- ============================================
-- 4. TABELA: ADMIN_2FA (Autenticação 2 fatores)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_2fa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE public.admin_2fa IS 'Configuração 2FA para administradores';

-- ============================================
-- 5. TABELA: PEOPLE (Pessoas/Responsáveis)
-- ============================================
CREATE TABLE IF NOT EXISTS public.people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  type TEXT NOT NULL CHECK (type IN ('internal', 'partner')),
  color TEXT NOT NULL DEFAULT '#3B82F6',
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.people IS 'Pessoas da equipe interna e parceiros';

-- ============================================
-- 6. TABELA: CELLS (Células/Áreas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cells (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cells IS 'Células organizacionais';

-- ============================================
-- 7. TABELA: PROJECTS (Projetos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'cancelled')),
  visible_fields TEXT[] DEFAULT ARRAY['description', 'phase', 'responsible', 'startDate', 'endDate', 'priority'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.projects IS 'Projetos gerenciados';

-- ============================================
-- 8. TABELA: PHASES (Fases dos Projetos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.phases IS 'Fases dentro de cada projeto';

-- ============================================
-- 9. TABELA: MILESTONES (Marcos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.milestones IS 'Marcos importantes dos projetos';

-- ============================================
-- 10. TABELA: TASKS (Tarefas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.phases(id) ON DELETE SET NULL,
  cell_id UUID REFERENCES public.cells(id) ON DELETE SET NULL,
  device_id TEXT,
  responsible_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  quantity INTEGER,
  collected INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  sprint_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  observation TEXT,
  custom_values JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tasks IS 'Tarefas dos projetos';

-- ============================================
-- 11. TABELA: CUSTOM_COLUMNS (Colunas Personalizadas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'date', 'list', 'percentage', 'user')),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 0,
  options TEXT[],
  is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  standard_field TEXT CHECK (standard_field IN ('name', 'description', 'responsible', 'status', 'priority', 'startDate', 'endDate', 'progress')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.custom_columns IS 'Colunas personalizáveis por projeto';

-- ============================================
-- 12. TABELA: MEETING_NOTES (Notas de Reunião)
-- ============================================
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  meeting_date DATE NOT NULL,
  participants UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.meeting_notes IS 'Notas e atas de reuniões';

-- ============================================
-- 13. TABELA: ACTIVITY_LOGS (Logs de Auditoria)
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.activity_logs IS 'Logs de auditoria do sistema';

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_phases_project_id ON public.phases(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON public.milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_phase_id ON public.tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_responsible_id ON public.tasks(responsible_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_custom_columns_project_id ON public.custom_columns(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_project_id ON public.meeting_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ============================================
-- FUNÇÃO: UPDATE_UPDATED_AT_COLUMN
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_2fa_updated_at ON public.admin_2fa;
CREATE TRIGGER update_admin_2fa_updated_at
  BEFORE UPDATE ON public.admin_2fa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_people_updated_at ON public.people;
CREATE TRIGGER update_people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_cells_updated_at ON public.cells;
CREATE TRIGGER update_cells_updated_at
  BEFORE UPDATE ON public.cells
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_phases_updated_at ON public.phases;
CREATE TRIGGER update_phases_updated_at
  BEFORE UPDATE ON public.phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_milestones_updated_at ON public.milestones;
CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_columns_updated_at ON public.custom_columns;
CREATE TRIGGER update_custom_columns_updated_at
  BEFORE UPDATE ON public.custom_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_notes_updated_at ON public.meeting_notes;
CREATE TRIGGER update_meeting_notes_updated_at
  BEFORE UPDATE ON public.meeting_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FUNÇÃO: HANDLE_NEW_USER (Criar perfil)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  
  -- Criar assinatura inativa
  INSERT INTO public.subscriptions (user_id, status)
  VALUES (NEW.id, 'inactive')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Atribuir role padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil ao registrar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNÇÃO: HAS_ROLE (Verificar papel)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ============================================
-- FUNÇÃO: IS_ADMIN (Verificar se é admin)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- ============================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS: PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- POLÍTICAS RLS: SUBSCRIPTIONS
-- ============================================
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- POLÍTICAS RLS: USER_ROLES
-- ============================================
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.is_admin());

-- ============================================
-- POLÍTICAS RLS: ADMIN_2FA
-- ============================================
DROP POLICY IF EXISTS "Users can view own 2fa" ON public.admin_2fa;
CREATE POLICY "Users can view own 2fa" ON public.admin_2fa
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own 2fa" ON public.admin_2fa;
CREATE POLICY "Users can manage own 2fa" ON public.admin_2fa
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- POLÍTICAS RLS: TABELAS DE DADOS (Acesso Autenticado)
-- Para um sistema multi-tenant real, adicione user_id às tabelas
-- Por enquanto, usuários autenticados têm acesso total
-- ============================================

-- PEOPLE
DROP POLICY IF EXISTS "Authenticated users can view people" ON public.people;
CREATE POLICY "Authenticated users can view people" ON public.people
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage people" ON public.people;
CREATE POLICY "Authenticated users can manage people" ON public.people
  FOR ALL USING (auth.role() = 'authenticated');

-- CELLS
DROP POLICY IF EXISTS "Authenticated users can view cells" ON public.cells;
CREATE POLICY "Authenticated users can view cells" ON public.cells
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage cells" ON public.cells;
CREATE POLICY "Authenticated users can manage cells" ON public.cells
  FOR ALL USING (auth.role() = 'authenticated');

-- PROJECTS
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
CREATE POLICY "Authenticated users can view projects" ON public.projects
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage projects" ON public.projects;
CREATE POLICY "Authenticated users can manage projects" ON public.projects
  FOR ALL USING (auth.role() = 'authenticated');

-- PHASES
DROP POLICY IF EXISTS "Authenticated users can view phases" ON public.phases;
CREATE POLICY "Authenticated users can view phases" ON public.phases
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage phases" ON public.phases;
CREATE POLICY "Authenticated users can manage phases" ON public.phases
  FOR ALL USING (auth.role() = 'authenticated');

-- MILESTONES
DROP POLICY IF EXISTS "Authenticated users can view milestones" ON public.milestones;
CREATE POLICY "Authenticated users can view milestones" ON public.milestones
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage milestones" ON public.milestones;
CREATE POLICY "Authenticated users can manage milestones" ON public.milestones
  FOR ALL USING (auth.role() = 'authenticated');

-- TASKS
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
CREATE POLICY "Authenticated users can view tasks" ON public.tasks
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage tasks" ON public.tasks;
CREATE POLICY "Authenticated users can manage tasks" ON public.tasks
  FOR ALL USING (auth.role() = 'authenticated');

-- CUSTOM_COLUMNS
DROP POLICY IF EXISTS "Authenticated users can view custom_columns" ON public.custom_columns;
CREATE POLICY "Authenticated users can view custom_columns" ON public.custom_columns
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage custom_columns" ON public.custom_columns;
CREATE POLICY "Authenticated users can manage custom_columns" ON public.custom_columns
  FOR ALL USING (auth.role() = 'authenticated');

-- MEETING_NOTES
DROP POLICY IF EXISTS "Authenticated users can view meeting_notes" ON public.meeting_notes;
CREATE POLICY "Authenticated users can view meeting_notes" ON public.meeting_notes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage meeting_notes" ON public.meeting_notes;
CREATE POLICY "Authenticated users can manage meeting_notes" ON public.meeting_notes
  FOR ALL USING (auth.role() = 'authenticated');

-- ACTIVITY_LOGS
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
CREATE POLICY "Admins can view all logs" ON public.activity_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;
CREATE POLICY "System can insert logs" ON public.activity_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- STORAGE: BUCKET PARA AVATARES
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('person-avatars', 'person-avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
DROP POLICY IF EXISTS "Person avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Person avatars are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'person-avatars');

DROP POLICY IF EXISTS "Authenticated users can upload person avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload person avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'person-avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update person avatars" ON storage.objects;
CREATE POLICY "Authenticated users can update person avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'person-avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete person avatars" ON storage.objects;
CREATE POLICY "Authenticated users can delete person avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'person-avatars' AND auth.role() = 'authenticated');

-- ============================================
-- DADOS INICIAIS (OPCIONAL)
-- ============================================

-- Inserir pessoas de exemplo
-- INSERT INTO public.people (name, email, type, color, active) VALUES
--   ('Daniel Melo', 'daniel@company.com', 'internal', '#3B82F6', true),
--   ('Bruno Brito', 'bruno@company.com', 'internal', '#10B981', true),
--   ('William', 'william@company.com', 'internal', '#8B5CF6', true)
-- ON CONFLICT DO NOTHING;

-- ============================================
-- FIM DO SCHEMA
-- ============================================
