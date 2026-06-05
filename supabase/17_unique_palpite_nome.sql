-- ============================================================
-- Bolão Copa 2026 — Global unique constraint on palpite name
-- Run in Supabase SQL Editor AFTER all previous migrations.
--
-- No two palpites in the entire bolão can share the same name.
-- The name is what appears in the ranking, so it must be unique
-- to avoid ambiguity.
-- ============================================================

ALTER TABLE public.palpites
  ADD CONSTRAINT palpites_nome_unique UNIQUE (nome);
