-- ============================================================
-- Palpites v2 — Database migration
-- Run in Supabase SQL Editor
-- ============================================================

-- Remove champion and runner-up columns (no longer used)
ALTER TABLE public.palpites DROP COLUMN IF EXISTS campeao;
ALTER TABLE public.palpites DROP COLUMN IF EXISTS vice_campeao;

-- Add submitted_at to track when each match score was submitted
ALTER TABLE public.palpites_jogos ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
