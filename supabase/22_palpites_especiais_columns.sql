-- Migration 19: adiciona colunas de palpites especiais à tabela palpites
-- Executar no Supabase SQL Editor
-- IF NOT EXISTS evita erro se a coluna já existir

ALTER TABLE palpites ADD COLUMN IF NOT EXISTS campeao        text;
ALTER TABLE palpites ADD COLUMN IF NOT EXISTS vice_campeao   text;
ALTER TABLE palpites ADD COLUMN IF NOT EXISTS artilheiro     text;
ALTER TABLE palpites ADD COLUMN IF NOT EXISTS melhor_jogador text;
ALTER TABLE palpites ADD COLUMN IF NOT EXISTS melhor_goleiro text;

-- Garante que pontos_especiais também existe (migration 15 pode não ter rodado)
ALTER TABLE palpites ADD COLUMN IF NOT EXISTS pontos_especiais    integer DEFAULT 0;
ALTER TABLE palpites ADD COLUMN IF NOT EXISTS pontos_classificacao integer DEFAULT 0;
