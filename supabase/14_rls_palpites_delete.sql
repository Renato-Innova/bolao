-- ============================================================
-- Allow users to delete their own inactive palpites.
-- Run in Supabase SQL Editor.
-- ============================================================

DROP POLICY IF EXISTS "user_delete_own_palpite" ON palpites;
CREATE POLICY "user_delete_own_palpite" ON palpites
  FOR DELETE
  TO authenticated
  USING (
    usuario_id = auth.uid() AND status = 'inativo'
  );
