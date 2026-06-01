-- ============================================================
-- Seed: default scoring configuration
-- ============================================================

INSERT INTO public.configuracoes_pontuacao (fase, tipo_acerto, pontos) VALUES
  ('grupos',  'placar_exato', 3),
  ('grupos',  'vencedor',     1),
  ('oitavas', 'placar_exato', 5),
  ('oitavas', 'vencedor',     2),
  ('quartas', 'placar_exato', 7),
  ('quartas', 'vencedor',     3),
  ('semis',   'placar_exato', 10),
  ('semis',   'vencedor',     4),
  ('final',   'placar_exato', 15),
  ('final',   'vencedor',     7)
ON CONFLICT (fase, tipo_acerto) DO NOTHING;
