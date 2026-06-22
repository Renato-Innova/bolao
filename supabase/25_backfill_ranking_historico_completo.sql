-- Migration 25: Backfill de ranking_historico_completo desde o início da competição
--
-- Reconstrói posição + acertos exatos para todos os dias já existentes em
-- ranking_historico, usando:
--   - total_pontos: reaproveitado de ranking_historico (sem recalcular —
--     zero risco de divergir do que já está consolidado)
--   - acertos_exatos "até aquele dia": conta acertos de placar exato apenas
--     em jogos cuja DATA (jogos_copa.data) seja <= a data do snapshot —
--     aproximação razoável assumindo que resultados são lançados no mesmo
--     dia do jogo (padrão do bolão)
--   - posicao: ROW_NUMBER() por data, mesmo critério de getRanking()
--     (pontos desc, acertos exatos desc, palpite_id asc)
--
-- Somente leitura em ranking_historico — nenhuma tabela existente é alterada.
-- Idempotente (ON CONFLICT DO UPDATE) — seguro rodar mais de uma vez.

INSERT INTO public.ranking_historico_completo (palpite_id, data, posicao, total_pontos, acertos_exatos)
SELECT
  rh.palpite_id,
  rh.data,
  ROW_NUMBER() OVER (
    PARTITION BY rh.data
    ORDER BY rh.total_pontos DESC, COALESCE(ae.acertos_exatos, 0) DESC, rh.palpite_id ASC
  ) AS posicao,
  rh.total_pontos,
  COALESCE(ae.acertos_exatos, 0) AS acertos_exatos
FROM public.ranking_historico rh
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS acertos_exatos
  FROM public.palpites_jogos pj
  JOIN public.resultados r  ON r.jogo_id = pj.jogo_id
  JOIN public.jogos_copa jc ON jc.id     = pj.jogo_id
  WHERE pj.palpite_id = rh.palpite_id
    AND pj.submitted_at IS NOT NULL
    AND pj.placar_palpite_a = r.placar_real_a
    AND pj.placar_palpite_b = r.placar_real_b
    AND jc.data <= rh.data
) ae ON true
ON CONFLICT (palpite_id, data)
DO UPDATE SET
  posicao        = EXCLUDED.posicao,
  total_pontos   = EXCLUDED.total_pontos,
  acertos_exatos = EXCLUDED.acertos_exatos;
