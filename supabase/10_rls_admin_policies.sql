-- ============================================================
-- RLS policies so authenticated admin users can manage
-- resultados and palpites_jogos (score recalculation).
-- Run in Supabase SQL Editor.
-- ============================================================

-- resultados: admins can insert, update, delete
DROP POLICY IF EXISTS "admin_manage_resultados" ON resultados;
CREATE POLICY "admin_manage_resultados" ON resultados
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- palpites_jogos: admins can update points after result entry
DROP POLICY IF EXISTS "admin_update_palpites_jogos" ON palpites_jogos;
CREATE POLICY "admin_update_palpites_jogos" ON palpites_jogos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
