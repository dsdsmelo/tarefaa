-- ============================================
-- MIGRAÇÃO: ANOTAÇÕES APRIMORADAS E PLANILHAS
-- VERSÃO SEGURA PARA PRODUÇÃO
-- ============================================
--
-- IMPORTANTE: Execute cada seção separadamente para identificar
-- problemas mais facilmente. Aguarde cada seção completar antes
-- de executar a próxima.
--
-- ============================================

-- ============================================
-- PARTE 1: ADICIONAR COLUNAS NA MEETING_NOTES
-- (Seguro - apenas adiciona, não modifica dados)
-- ============================================

-- Adicionar coluna category (com DEFAULT para não quebrar dados existentes)
ALTER TABLE public.meeting_notes
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Adicionar coluna template_data para dados estruturados
ALTER TABLE public.meeting_notes
ADD COLUMN IF NOT EXISTS template_data JSONB DEFAULT NULL;

-- ============================================
-- PARTE 2: CRIAR ÍNDICES PARA MEETING_NOTES
-- (Seguro - apenas melhora performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_meeting_notes_category
ON public.meeting_notes(category);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_project_category
ON public.meeting_notes(project_id, category);

-- ============================================
-- PARTE 3: MIGRAR CATEGORIAS EXISTENTES
-- (Atualiza dados - execute com cuidado)
--
-- Nota: Isso extrai a categoria do array participants
-- onde está salvo como 'cat:meeting', 'cat:decision', etc.
-- ============================================

UPDATE public.meeting_notes
SET category =
  CASE
    WHEN array_to_string(participants, ',') LIKE '%cat:meeting%' THEN 'meeting'
    WHEN array_to_string(participants, ',') LIKE '%cat:decision%' THEN 'decision'
    WHEN array_to_string(participants, ',') LIKE '%cat:idea%' THEN 'idea'
    WHEN array_to_string(participants, ',') LIKE '%cat:reminder%' THEN 'reminder'
    ELSE 'general'
  END
WHERE category = 'general' OR category IS NULL;

-- ============================================
-- PARTE 4: CRIAR TABELAS DE PLANILHAS
-- (Seguro - cria novas tabelas)
-- ============================================

-- Tabela principal de planilhas
CREATE TABLE IF NOT EXISTS public.project_spreadsheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colunas das planilhas
CREATE TABLE IF NOT EXISTS public.spreadsheet_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spreadsheet_id UUID NOT NULL REFERENCES public.project_spreadsheets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'number', 'date', 'currency', 'percentage', 'formula')),
  width INTEGER DEFAULT 150,
  order_index INTEGER NOT NULL DEFAULT 0,
  formula TEXT,
  format JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Linhas das planilhas
CREATE TABLE IF NOT EXISTS public.spreadsheet_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spreadsheet_id UUID NOT NULL REFERENCES public.project_spreadsheets(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Células das planilhas
CREATE TABLE IF NOT EXISTS public.spreadsheet_cells (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  row_id UUID NOT NULL REFERENCES public.spreadsheet_rows(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.spreadsheet_columns(id) ON DELETE CASCADE,
  value TEXT,
  computed_value TEXT,
  UNIQUE(row_id, column_id)
);

-- Células mescladas
CREATE TABLE IF NOT EXISTS public.spreadsheet_merges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spreadsheet_id UUID NOT NULL REFERENCES public.project_spreadsheets(id) ON DELETE CASCADE,
  start_row INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  end_row INTEGER NOT NULL,
  end_col INTEGER NOT NULL
);

-- ============================================
-- PARTE 5: CRIAR ÍNDICES PARA PLANILHAS
-- (Seguro - apenas melhora performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_spreadsheets_project
ON public.project_spreadsheets(project_id);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_columns_spreadsheet
ON public.spreadsheet_columns(spreadsheet_id);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_columns_order
ON public.spreadsheet_columns(spreadsheet_id, order_index);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_rows_spreadsheet
ON public.spreadsheet_rows(spreadsheet_id);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_rows_order
ON public.spreadsheet_rows(spreadsheet_id, order_index);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_cells_row
ON public.spreadsheet_cells(row_id);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_cells_column
ON public.spreadsheet_cells(column_id);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_merges_spreadsheet
ON public.spreadsheet_merges(spreadsheet_id);

-- ============================================
-- PARTE 6: TRIGGER PARA UPDATED_AT
-- (Seguro - usa função existente)
-- ============================================

DROP TRIGGER IF EXISTS update_spreadsheets_updated_at ON public.project_spreadsheets;
CREATE TRIGGER update_spreadsheets_updated_at
  BEFORE UPDATE ON public.project_spreadsheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PARTE 7: HABILITAR RLS
-- (Seguro - habilita segurança)
-- ============================================

ALTER TABLE public.project_spreadsheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spreadsheet_merges ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 8: POLÍTICAS RLS
-- (Seguro - define permissões)
-- ============================================

-- Project Spreadsheets
DROP POLICY IF EXISTS "Users can view spreadsheets" ON public.project_spreadsheets;
CREATE POLICY "Users can view spreadsheets" ON public.project_spreadsheets
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage own spreadsheets" ON public.project_spreadsheets;
CREATE POLICY "Users can manage own spreadsheets" ON public.project_spreadsheets
  FOR ALL USING (auth.role() = 'authenticated');

-- Spreadsheet Columns
DROP POLICY IF EXISTS "Users can view spreadsheet_columns" ON public.spreadsheet_columns;
CREATE POLICY "Users can view spreadsheet_columns" ON public.spreadsheet_columns
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage spreadsheet_columns" ON public.spreadsheet_columns;
CREATE POLICY "Users can manage spreadsheet_columns" ON public.spreadsheet_columns
  FOR ALL USING (auth.role() = 'authenticated');

-- Spreadsheet Rows
DROP POLICY IF EXISTS "Users can view spreadsheet_rows" ON public.spreadsheet_rows;
CREATE POLICY "Users can view spreadsheet_rows" ON public.spreadsheet_rows
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage spreadsheet_rows" ON public.spreadsheet_rows;
CREATE POLICY "Users can manage spreadsheet_rows" ON public.spreadsheet_rows
  FOR ALL USING (auth.role() = 'authenticated');

-- Spreadsheet Cells
DROP POLICY IF EXISTS "Users can view spreadsheet_cells" ON public.spreadsheet_cells;
CREATE POLICY "Users can view spreadsheet_cells" ON public.spreadsheet_cells
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage spreadsheet_cells" ON public.spreadsheet_cells;
CREATE POLICY "Users can manage spreadsheet_cells" ON public.spreadsheet_cells
  FOR ALL USING (auth.role() = 'authenticated');

-- Spreadsheet Merges
DROP POLICY IF EXISTS "Users can view spreadsheet_merges" ON public.spreadsheet_merges;
CREATE POLICY "Users can view spreadsheet_merges" ON public.spreadsheet_merges
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage spreadsheet_merges" ON public.spreadsheet_merges;
CREATE POLICY "Users can manage spreadsheet_merges" ON public.spreadsheet_merges
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
