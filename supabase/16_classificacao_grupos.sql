-- ============================================================
-- Bolão Copa 2026 — Group Classification Bonus
-- Run in Supabase SQL Editor AFTER 15_scoring_overhaul.sql.
--
-- Adds pontos_classificacao to palpites:
--   • 20 pts per team correctly predicted to qualify from the
--     group stage (top 2 per group + 8 best 3rd-place teams).
--   • Calculated by admin once, after all group stage results
--     are official and confirmed.
-- ============================================================

ALTER TABLE public.palpites
  ADD COLUMN IF NOT EXISTS pontos_classificacao INTEGER NOT NULL DEFAULT 0;
