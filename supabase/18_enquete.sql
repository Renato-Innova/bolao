-- Configuração da enquete (single row, id = 1)
CREATE TABLE IF NOT EXISTS enquete_config (
  id                integer PRIMARY KEY DEFAULT 1,
  aberta            boolean NOT NULL DEFAULT false,
  resultado_visivel boolean NOT NULL DEFAULT false,
  atualizado_em     timestamp with time zone DEFAULT now()
);

-- Garante que existe a linha de config
INSERT INTO enquete_config (id, aberta, resultado_visivel)
VALUES (1, false, false)
ON CONFLICT (id) DO NOTHING;

-- Votos (um por usuário)
CREATE TABLE IF NOT EXISTS enquete_votos (
  id          serial PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opcao       text NOT NULL CHECK (opcao IN ('A', 'B', 'C')),
  votado_em   timestamp with time zone DEFAULT now(),
  UNIQUE (usuario_id)
);

-- RLS
ALTER TABLE enquete_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquete_votos  ENABLE ROW LEVEL SECURITY;

-- enquete_config: qualquer autenticado pode ler; só service role escreve (via API)
CREATE POLICY "enquete_config_select" ON enquete_config
  FOR SELECT TO authenticated USING (true);

-- enquete_votos: usuário lê/escreve apenas seu próprio voto
CREATE POLICY "enquete_votos_select_own" ON enquete_votos
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE POLICY "enquete_votos_insert_own" ON enquete_votos
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "enquete_votos_update_own" ON enquete_votos
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid());

-- Admin precisa ler todos os votos (via service role key na API — bypass RLS automático)
