-- Comunicação da decisão tomada após a enquete de Palpites Especiais
ALTER TABLE enquete_config
  ADD COLUMN IF NOT EXISTS decisao_titulo  text,
  ADD COLUMN IF NOT EXISTS decisao_texto   text,
  ADD COLUMN IF NOT EXISTS decisao_visivel boolean NOT NULL DEFAULT false;
