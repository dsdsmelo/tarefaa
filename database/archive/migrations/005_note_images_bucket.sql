-- =========================================================
-- Migration 005: Bucket de imagens para o editor de anotações
-- =========================================================
-- Cria o bucket `note-images` (público, 5MB, imagens) para o
-- editor rico das anotações, no mesmo padrão de `project-images`.
--
-- INSTRUÇÕES: rode no SQL Editor do Supabase (idempotente).
-- =========================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('note-images', 'note-images', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Note images are publicly accessible" ON storage.objects;
CREATE POLICY "Note images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'note-images');

DROP POLICY IF EXISTS "Authenticated users can upload note images" ON storage.objects;
CREATE POLICY "Authenticated users can upload note images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'note-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update note images" ON storage.objects;
CREATE POLICY "Authenticated users can update note images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'note-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete note images" ON storage.objects;
CREATE POLICY "Authenticated users can delete note images" ON storage.objects
  FOR DELETE USING (bucket_id = 'note-images' AND auth.role() = 'authenticated');
