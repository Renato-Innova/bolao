-- ============================================================
-- Bolão Copa 2026 — Pontos de Palpites Especiais configuráveis
--
-- Changes:
--   1. Permite os tipo_acerto 'campeao', 'vice_campeao', 'artilheiro',
--      'melhor_jogador', 'melhor_goleiro' em configuracoes_pontuacao,
--      usando fase='ESP' (não é uma fase de jogo, é um agrupamento lógico
--      para os 5 critérios de palpites especiais).
--   2. Insere os 5 valores oficiais atuais (100/70/50/50/50).
--   3. Atualiza a view pontuacao_resumo com uma linha extra somando o
--      total máximo de palpites especiais, para refletir no total geral.
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
    'classificacao',
    'campeao',
    'vice_campeao',
    'artilheiro',
    'melhor_jogador',
    'melhor_goleiro'
  ));

INSERT INTO public.configuracoes_pontuacao (fase, tipo_acerto, pontos) VALUES
  ('ESP', 'campeao',        100),
  ('ESP', 'vice_campeao',    70),
  ('ESP', 'artilheiro',      50),
  ('ESP', 'melhor_jogador',  50),
  ('ESP', 'melhor_goleiro',  50)
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
WHERE cp.fase = 'GS' AND cp.tipo_acerto = 'classificacao'

UNION ALL

SELECT
  'ESP' AS fase,
  'Palpites Especiais' AS fase_label,
  'especiais'::text AS tipo,
  (SELECT count(*) FROM public.configuracoes_pontuacao WHERE fase = 'ESP') AS quantidade,
  0 AS pontos_unitario,
  (SELECT COALESCE(SUM(pontos), 0) FROM public.configuracoes_pontuacao WHERE fase = 'ESP') AS pontos_max;
