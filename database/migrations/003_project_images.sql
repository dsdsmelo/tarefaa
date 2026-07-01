-- =========================================================
-- Migration 003: Imagem do projeto/cliente nos cards
-- =========================================================
-- Adiciona a coluna `image_url` à tabela `projects` e cria o
-- bucket de storage `project-images` (público, 5MB, imagens),
-- reutilizando o mesmo padrão do bucket `person-avatars`.
--
-- INSTRUÇÕES:
-- 1) Rode este script no SQL Editor do Supabase (é idempotente)
-- =========================================================

-- 1) Coluna para a URL pública da imagem do projeto
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2) Bucket dedicado às imagens de projeto/cliente
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-images', 'project-images', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- 3) Políticas de acesso (leitura pública, escrita autenticada)
DROP POLICY IF EXISTS "Project images are publicly accessible" ON storage.objects;
CREATE POLICY "Project images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Authenticated users can upload project images" ON storage.objects;
CREATE POLICY "Authenticated users can upload project images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update project images" ON storage.objects;
CREATE POLICY "Authenticated users can update project images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'project-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete project images" ON storage.objects;
CREATE POLICY "Authenticated users can delete project images" ON storage.objects
  FOR DELETE USING (bucket_id = 'project-images' AND auth.role() = 'authenticated');
