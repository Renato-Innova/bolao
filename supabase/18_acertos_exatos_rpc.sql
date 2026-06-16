-- RPC: retorna contagem de acertos de placar exato por palpite
-- Chamada em ranking.ts para preencher acertos_exatos no RankingEntry
CREATE OR REPLACE FUNCTION get_acertos_exatos_por_palpite(p_ids int[])
RETURNS TABLE(palpite_id int, acertos_exatos bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    pj.palpite_id,
    COUNT(*) AS acertos_exatos
  FROM palpites_jogos pj
  JOIN resultados r ON r.jogo_id = pj.jogo_id
  WHERE pj.palpite_id = ANY(p_ids)
    AND pj.submitted_at IS NOT NULL
    AND pj.placar_palpite_a = r.placar_real_a
    AND pj.placar_palpite_b = r.placar_real_b
  GROUP BY pj.palpite_id;
$$;
