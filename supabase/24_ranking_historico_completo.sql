-- Migration 24: ranking_historico_completo
--
-- Tabela ADITIVA — não altera nem substitui ranking_historico (migration 23).
-- Guarda, por dia, a posição oficial + acertos exatos de cada palpite, usando o
-- MESMO critério de desempate de getRanking() (pontos → acertos exatos → palpite_id),
-- para permitir reconstruir o ranking histórico corretamente desempatado
-- (hoje ranking_historico só guarda total_pontos, sem acertos exatos).
--
-- Risco zero para os dados atuais: tabela nova, função nova, cron novo e
-- separado. Nada do que já existe (tabela/cron/função ranking_historico) é
-- tocado por esta migration.

CREATE TABLE IF NOT EXISTS public.ranking_historico_completo (
  id             serial PRIMARY KEY,
  palpite_id     integer NOT NULL REFERENCES public.palpites(id) ON DELETE CASCADE,
  data           date    NOT NULL,
  posicao        integer NOT NULL,
  total_pontos   integer NOT NULL DEFAULT 0,
  acertos_exatos integer NOT NULL DEFAULT 0,
  criado_em      timestamptz DEFAULT now(),
  UNIQUE(palpite_id, data)
);

CREATE INDEX IF NOT EXISTS idx_ranking_historico_completo_data ON public.ranking_historico_completo(data);

ALTER TABLE public.ranking_historico_completo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.ranking_historico_completo
  USING (true)
  WITH CHECK (true);

-- ── Snapshot function — mesmo critério de desempate de getRanking() ────────
-- Calcula pontos, acertos exatos e posição (1..N, sem empates) para todos os
-- palpites ativos, e grava o snapshot do dia. Idempotente (UPSERT).
CREATE OR REPLACE FUNCTION public.snapshot_ranking_completo_diario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  hoje date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  INSERT INTO public.ranking_historico_completo (palpite_id, data, posicao, total_pontos, acertos_exatos)
  SELECT
    base.palpite_id,
    hoje,
    ROW_NUMBER() OVER (ORDER BY base.total_pontos DESC, base.acertos_exatos DESC, base.palpite_id ASC) AS posicao,
    base.total_pontos,
    base.acertos_exatos
  FROM (
    SELECT
      p.id AS palpite_id,
      COALESCE(SUM(pj.pontos), 0)
        + COALESCE(p.pontos_especiais, 0)
        + COALESCE(p.pontos_classificacao, 0) AS total_pontos,
      COALESCE((
        SELECT COUNT(*)
        FROM public.palpites_jogos pj2
        JOIN public.resultados r ON r.jogo_id = pj2.jogo_id
        WHERE pj2.palpite_id = p.id
          AND pj2.submitted_at IS NOT NULL
          AND pj2.placar_palpite_a = r.placar_real_a
          AND pj2.placar_palpite_b = r.placar_real_b
      ), 0) AS acertos_exatos
    FROM public.palpites p
    LEFT JOIN public.palpites_jogos pj ON pj.palpite_id = p.id
    WHERE p.status = 'ativo'
    GROUP BY p.id
  ) base
  ON CONFLICT (palpite_id, data)
  DO UPDATE SET
    posicao        = EXCLUDED.posicao,
    total_pontos   = EXCLUDED.total_pontos,
    acertos_exatos = EXCLUDED.acertos_exatos;
END;
$$;

-- ── pg_cron job — separado do existente (snapshot-ranking-diario) ──────────
-- Roda 1 min depois do snapshot original, mesma janela diária (23:56 BRT).
SELECT cron.schedule(
  'snapshot-ranking-completo-diario',
  '56 2 * * *',
  'SELECT public.snapshot_ranking_completo_diario()'
);
