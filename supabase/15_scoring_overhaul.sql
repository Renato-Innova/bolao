-- ============================================================
-- Bolão Copa 2026 — Scoring Overhaul (Regulation v1.0)
-- Run in Supabase SQL Editor AFTER all previous migrations.
--
-- Changes:
--   1. Expands configuracoes_pontuacao.tipo_acerto CHECK to
--      include the 3 new types: empate, gols_equipe, penalti
--   2. Replaces all scoring rows with the official regulation
--      values (7 phases × 5 types = 35 rows)
--   3. Adds pontos_especiais column to palpites
--   4. Creates resultados_especiais (single-row table for the
--      official champion, runner-up and award winners)
-- ============================================================

-- ── 1. Update CHECK constraint ────────────────────────────────
ALTER TABLE public.configuracoes_pontuacao
  DROP CONSTRAINT IF EXISTS configuracoes_pontuacao_tipo_acerto_check;

ALTER TABLE public.configuracoes_pontuacao
  ADD CONSTRAINT configuracoes_pontuacao_tipo_acerto_check
  CHECK (tipo_acerto IN (
    'placar_exato',
    'empate',
    'vencedor',
    'gols_equipe',
    'penalti'
  ));

-- ── 2. Re-seed scoring values per official regulation ─────────
-- Delete old rows first (phase codes may vary between installs)
DELETE FROM public.configuracoes_pontuacao;

INSERT INTO public.configuracoes_pontuacao (fase, tipo_acerto, pontos) VALUES
  -- Fase de Grupos
  ('GS',  'placar_exato', 20),
  ('GS',  'empate',       15),
  ('GS',  'vencedor',     10),
  ('GS',  'gols_equipe',   5),
  ('GS',  'penalti',       5),   -- listed in table; never triggers (GS has no penalties)

  -- 16 Avos de Final (R32)
  ('R32', 'placar_exato', 30),
  ('R32', 'empate',       22),
  ('R32', 'vencedor',     15),
  ('R32', 'gols_equipe',   8),
  ('R32', 'penalti',       8),

  -- Oitavas de Final (R16)
  ('R16', 'placar_exato', 40),
  ('R16', 'empate',       30),
  ('R16', 'vencedor',     20),
  ('R16', 'gols_equipe',  10),
  ('R16', 'penalti',      10),

  -- Quartas de Final (QF)
  ('QF',  'placar_exato', 60),
  ('QF',  'empate',       40),
  ('QF',  'vencedor',     30),
  ('QF',  'gols_equipe',  15),
  ('QF',  'penalti',      15),

  -- Semifinais (SF)
  ('SF',  'placar_exato', 80),
  ('SF',  'empate',       60),
  ('SF',  'vencedor',     40),
  ('SF',  'gols_equipe',  20),
  ('SF',  'penalti',      20),

  -- 3º Lugar (TPL)
  ('TPL', 'placar_exato', 100),
  ('TPL', 'empate',        75),
  ('TPL', 'vencedor',      50),
  ('TPL', 'gols_equipe',   25),
  ('TPL', 'penalti',       25),

  -- Final (F)
  ('F',   'placar_exato', 120),
  ('F',   'empate',        75),
  ('F',   'vencedor',      60),
  ('F',   'gols_equipe',   30),
  ('F',   'penalti',       30);

-- ── 3. Add pontos_especiais to palpites ───────────────────────
ALTER TABLE public.palpites
  ADD COLUMN IF NOT EXISTS pontos_especiais INTEGER NOT NULL DEFAULT 0;

-- ── 4. Create resultados_especiais (single-row config table) ──
CREATE TABLE IF NOT EXISTS public.resultados_especiais (
  id             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforces single row
  campeao        TEXT,
  vice_campeao   TEXT,
  artilheiro     TEXT,
  melhor_jogador TEXT,
  melhor_goleiro TEXT,
  atualizado_em  TIMESTAMPTZ DEFAULT now()
);

-- Seed the single row so it always exists (upsert-safe)
INSERT INTO public.resultados_especiais (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.resultados_especiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "especiais_select_all" ON public.resultados_especiais
  FOR SELECT USING (true);

CREATE POLICY "especiais_admin_write" ON public.resultados_especiais
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- ── Verify ────────────────────────────────────────────────────
-- Expected: 35 rows (7 phases × 5 types)
SELECT fase, tipo_acerto, pontos
  FROM public.configuracoes_pontuacao
 ORDER BY
   ARRAY_POSITION(ARRAY['GS','R32','R16','QF','SF','TPL','F'], fase),
   ARRAY_POSITION(ARRAY['placar_exato','empate','vencedor','gols_equipe','penalti'], tipo_acerto);
