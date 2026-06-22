-- ============================================================
-- Add penalty shootout columns to resultados and palpites_jogos.
-- KO games can be drawn at 90 min and decided by penalties.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Official results: penalty scores (null = no penalty shootout)
ALTER TABLE resultados
  ADD COLUMN IF NOT EXISTS placar_penalti_a INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS placar_penalti_b INTEGER DEFAULT NULL;

-- User predictions: penalty prediction (null = user didn't predict a draw)
ALTER TABLE palpites_jogos
  ADD COLUMN IF NOT EXISTS placar_penalti_a INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS placar_penalti_b INTEGER DEFAULT NULL;
