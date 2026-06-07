-- Migration 18: tabela de configurações do sistema (prazos e limites)
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  id                     integer PRIMARY KEY DEFAULT 1,
  especiais_deadline     timestamptz,          -- prazo para editar palpites especiais
  novo_palpite_deadline  timestamptz,          -- prazo para criar novo palpite
  minutos_lock_jogo      integer DEFAULT 60,   -- minutos antes do jogo para travar edição
  atualizado_em          timestamptz DEFAULT now()
);

-- Garante que sempre existe exatamente 1 linha
INSERT INTO configuracoes_sistema (id, minutos_lock_jogo)
VALUES (1, 60)
ON CONFLICT (id) DO NOTHING;

-- RLS: apenas admins lêem/escrevem via service role (API routes server-side)
ALTER TABLE configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- Leitura pública (frontend pode checar prazos)
CREATE POLICY "leitura_publica_config_sistema"
  ON configuracoes_sistema FOR SELECT
  USING (true);
