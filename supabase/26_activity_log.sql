-- Migration 18: Activity log for palpite edits
-- Tracks every time a user submits/edits a match prediction or special predictions.
-- Rows are never updated — append-only audit trail.

CREATE TABLE IF NOT EXISTS palpites_activity_log (
  id          bigserial    PRIMARY KEY,
  usuario_id  uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  palpite_id  integer      REFERENCES palpites(id)   ON DELETE SET NULL,
  jogo_id     integer      REFERENCES jogos_copa(id)  ON DELETE SET NULL,
  action      text         NOT NULL,
  criado_em   timestamptz  DEFAULT now()
);

-- Index for admin queries: most recent first, filtered by palpite or user
CREATE INDEX IF NOT EXISTS idx_activity_log_criado_em  ON palpites_activity_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_palpite_id ON palpites_activity_log (palpite_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_usuario_id ON palpites_activity_log (usuario_id);

-- RLS: users cannot read or write directly — all access via service role (server routes)
ALTER TABLE palpites_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can read everything via service role (bypasses RLS)
-- No client-side policies needed since inserts/reads go through API routes with service key
