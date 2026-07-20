-- Pesquisa de satisfação pós-Copa (uma resposta por usuário) — abre entre a
-- disputa de 3º lugar e a Final, libera o relatório em PDF de cada palpite.
CREATE TABLE IF NOT EXISTS pesquisa_satisfacao (
  id                  serial PRIMARY KEY,
  usuario_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  indicaria           integer NOT NULL CHECK (indicaria BETWEEN 0 AND 5),
  custo_beneficio     integer NOT NULL CHECK (custo_beneficio BETWEEN 0 AND 5),
  facilidade_uso      integer NOT NULL CHECK (facilidade_uso BETWEEN 0 AND 5),
  clareza_pontuacao   integer NOT NULL CHECK (clareza_pontuacao BETWEEN 0 AND 5),
  boletim_diario      integer NOT NULL CHECK (boletim_diario BETWEEN 0 AND 5),
  comentario          text,
  respondido_em       timestamp with time zone DEFAULT now(),
  UNIQUE (usuario_id)
);

ALTER TABLE pesquisa_satisfacao ENABLE ROW LEVEL SECURITY;

-- usuário lê/escreve apenas sua própria resposta
CREATE POLICY "pesquisa_satisfacao_select_own" ON pesquisa_satisfacao
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE POLICY "pesquisa_satisfacao_insert_own" ON pesquisa_satisfacao
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "pesquisa_satisfacao_update_own" ON pesquisa_satisfacao
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid());

-- Admin lê todas as respostas via service role key (bypass RLS automático)
