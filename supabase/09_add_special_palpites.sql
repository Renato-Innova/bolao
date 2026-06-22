-- ============================================================
-- Add melhor_jogador and melhor_goleiro to palpites table
-- Run in Supabase SQL Editor after 07_trigger_classificacao.sql
-- ============================================================

ALTER TABLE palpites
  ADD COLUMN IF NOT EXISTS melhor_jogador TEXT,
  ADD COLUMN IF NOT EXISTS melhor_goleiro TEXT;
