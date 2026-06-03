-- ============================================================
-- Allow authenticated admin users to update jogos_copa.
-- Needed so the "Preencher Mata-Mata" feature can write
-- team names and flag codes into KO game slots.
-- Run in Supabase SQL Editor.
-- ============================================================

DROP POLICY IF EXISTS "admin_update_jogos_copa" ON jogos_copa;
CREATE POLICY "admin_update_jogos_copa" ON jogos_copa
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
