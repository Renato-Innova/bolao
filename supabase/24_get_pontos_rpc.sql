-- RPC para somar pontos por palpite sem depender de paginação REST
-- Resolve o limite de 1000 linhas do PostgREST (max_rows Supabase)
-- Retorna 1 linha por palpite com a soma total de pontos

CREATE OR REPLACE FUNCTION get_pontos_por_palpite(p_ids integer[])
RETURNS TABLE(palpite_id integer, total_pontos bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT pj.palpite_id, COALESCE(SUM(pj.pontos), 0) AS total_pontos
  FROM palpites_jogos pj
  WHERE pj.palpite_id = ANY(p_ids)
  GROUP BY pj.palpite_id
$$;
