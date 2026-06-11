-- Boletim diário da Copa 2026 (gerado por IA)
-- Dois boletins por dia: 'manha' (07h BRT) e 'tarde' (19h BRT)

CREATE TABLE IF NOT EXISTS boletim_copa (
  id         serial PRIMARY KEY,
  tipo       text        NOT NULL CHECK (tipo IN ('manha', 'tarde')),
  titulo     text        NOT NULL,
  conteudo   text        NOT NULL,
  gerado_em  timestamptz NOT NULL DEFAULT now()
);

-- Índice para buscar rapidamente o boletim mais recente de cada tipo
CREATE INDEX IF NOT EXISTS idx_boletim_tipo_gerado ON boletim_copa (tipo, gerado_em DESC);

-- RLS: leitura pública, escrita apenas via service role (API)
ALTER TABLE boletim_copa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boletim_read_public"
  ON boletim_copa FOR SELECT
  USING (true);

-- Nenhuma policy de INSERT/UPDATE/DELETE para anon/authenticated
-- O service role bypassa RLS automaticamente
