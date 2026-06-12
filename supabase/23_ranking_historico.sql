-- Migration 23: ranking_historico
-- Stores daily point snapshots for all active palpites.
-- Used to calculate daily variation in the ranking.

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranking_historico (
  id           serial PRIMARY KEY,
  palpite_id   integer NOT NULL REFERENCES public.palpites(id) ON DELETE CASCADE,
  data         date    NOT NULL,
  total_pontos integer NOT NULL DEFAULT 0,
  criado_em    timestamptz DEFAULT now(),
  UNIQUE(palpite_id, data)
);

-- Index for fast lookups by date
CREATE INDEX IF NOT EXISTS idx_ranking_historico_data ON public.ranking_historico(data);

-- RLS: only service role can write; authenticated users can read their own
ALTER TABLE public.ranking_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.ranking_historico
  USING (true)
  WITH CHECK (true);

-- ── Snapshot function ────────────────────────────────────────────────────────
-- Captures current total points for all active palpites.
-- Safe to call multiple times per day (UPSERT).
CREATE OR REPLACE FUNCTION public.snapshot_ranking_diario()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.ranking_historico (palpite_id, data, total_pontos)
  SELECT
    p.id,
    (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
    COALESCE(SUM(pj.pontos), 0)
      + COALESCE(p.pontos_especiais, 0)
      + COALESCE(p.pontos_classificacao, 0)
  FROM public.palpites p
  LEFT JOIN public.palpites_jogos pj ON pj.palpite_id = p.id
  WHERE p.status = 'ativo'
  GROUP BY p.id
  ON CONFLICT (palpite_id, data)
  DO UPDATE SET total_pontos = EXCLUDED.total_pontos;
$$;

-- ── pg_cron job: run every day at 23:55 BRT (02:55 UTC next day) ────────────
-- Requires pg_cron extension enabled in Supabase (Dashboard → Database → Extensions)
SELECT cron.schedule(
  'snapshot-ranking-diario',
  '55 2 * * *',
  'SELECT public.snapshot_ranking_diario()'
);
