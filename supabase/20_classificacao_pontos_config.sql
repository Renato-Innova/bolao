-- ============================================================
-- Bolão Copa 2026 — Bônus de classificação configurável + view de resumo
--
-- Changes:
--   1. Permite o tipo_acerto 'classificacao' em configuracoes_pontuacao,
--      para que o admin possa editar os pontos do bônus de classificação
--      de grupos (hoje fixo em 20 pts por seleção, em scoring.ts).
--   2. Insere a linha (fase='GS', tipo_acerto='classificacao', pontos=20).
--   3. Cria a view pontuacao_resumo, que centraliza o cálculo do total
--      máximo de pontos por fase (qtd_jogos × placar_exato) + o bônus
--      de classificação (32 vagas × pontos configurados), sempre
--      refletindo o valor atual de configuracoes_pontuacao e jogos_copa.
-- ============================================================

ALTER TABLE public.configuracoes_pontuacao
  DROP CONSTRAINT IF EXISTS configuracoes_pontuacao_tipo_acerto_check;

ALTER TABLE public.configuracoes_pontuacao
  ADD CONSTRAINT configuracoes_pontuacao_tipo_acerto_check
  CHECK (tipo_acerto IN (
    'placar_exato',
    'empate',
    'vencedor',
    'gols_equipe',
    'penalti',
    'classificacao'
  ));

INSERT INTO public.configuracoes_pontuacao (fase, tipo_acerto, pontos)
VALUES ('GS', 'classificacao', 20)
ON CONFLICT (fase, tipo_acerto) DO NOTHING;

CREATE OR REPLACE VIEW public.pontuacao_resumo AS
SELECT
  cp.fase,
  CASE cp.fase
    WHEN 'GS'  THEN 'Fase de Grupos'
    WHEN 'R32' THEN '16 Avos de Final'
    WHEN 'R16' THEN 'Oitavas de Final'
    WHEN 'QF'  THEN 'Quartas de Final'
    WHEN 'SF'  THEN 'Semifinal'
    WHEN 'TPL' THEN 'Decisão do 3º Lugar'
    WHEN 'F'   THEN 'Final'
    ELSE cp.fase
  END AS fase_label,
  'jogos'::text AS tipo,
  (SELECT count(*) FROM public.jogos_copa jc WHERE jc.fase = cp.fase) AS quantidade,
  cp.pontos AS pontos_unitario,
  (SELECT count(*) FROM public.jogos_copa jc WHERE jc.fase = cp.fase) * cp.pontos AS pontos_max
FROM public.configuracoes_pontuacao cp
WHERE cp.tipo_acerto = 'placar_exato'

UNION ALL

SELECT
  'GS' AS fase,
  'Bônus de Classificação' AS fase_label,
  'classificacao'::text AS tipo,
  32 AS quantidade,
  cp.pontos AS pontos_unitario,
  32 * cp.pontos AS pontos_max
FROM public.configuracoes_pontuacao cp
WHERE cp.fase = 'GS' AND cp.tipo_acerto = 'classificacao';
