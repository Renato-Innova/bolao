-- ============================================================
-- Fix: remove overly permissive palpites RLS policy
-- The old "palpites_select_ativo" policy allowed ANY authenticated
-- user to read active palpites from all other users.
-- The ranking page now uses the service_role key, so this is not needed.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Drop the permissive policy
DROP POLICY IF EXISTS "palpites_select_ativo" ON public.palpites;

-- Drop old policies and recreate clean ones
DROP POLICY IF EXISTS "palpites_select_own" ON public.palpites;
DROP POLICY IF EXISTS "palpites_insert_own" ON public.palpites;
DROP POLICY IF EXISTS "palpites_update_own" ON public.palpites;

-- Users can only read their own palpites (admin can read all)
CREATE POLICY "palpites_select_own" ON public.palpites
  FOR SELECT USING (
    auth.uid() = usuario_id
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Users can only insert their own palpites
CREATE POLICY "palpites_insert_own" ON public.palpites
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Users can only update their own palpites (admin can update all)
CREATE POLICY "palpites_update_own" ON public.palpites
  FOR UPDATE USING (
    auth.uid() = usuario_id
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Also fix palpites_jogos: only owner or admin
DROP POLICY IF EXISTS "palpites_jogos_select" ON public.palpites_jogos;
DROP POLICY IF EXISTS "palpites_jogos_write"  ON public.palpites_jogos;

CREATE POLICY "palpites_jogos_select" ON public.palpites_jogos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.palpites p
      WHERE p.id = palpite_id AND p.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "palpites_jogos_write" ON public.palpites_jogos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.palpites p
      WHERE p.id = palpite_id AND p.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
    )
  );
