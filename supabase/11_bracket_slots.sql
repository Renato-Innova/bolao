-- ============================================================
-- Bolão Copa 2026 — bracket_slots table
-- Stores the inferred bracket for each palpite: which teams the
-- system calculated would face each other in each knockout match,
-- derived from the user's predicted group-stage scores.
--
-- Run AFTER 08_phase_codes.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS bracket_slots (
  id          SERIAL PRIMARY KEY,
  palpite_id  INTEGER NOT NULL REFERENCES palpites(id)   ON DELETE CASCADE,
  jogo_id     INTEGER NOT NULL REFERENCES jogos_copa(id) ON DELETE CASCADE,
  time_a      TEXT,        -- predicted home team name (NULL = "A definir")
  time_b      TEXT,        -- predicted away team name
  codigo_a    TEXT,        -- flagcdn.com code for home
  codigo_b    TEXT,        -- flagcdn.com code for away
  is_valid    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (palpite_id, jogo_id)
);

CREATE INDEX IF NOT EXISTS idx_bracket_slots_palpite ON bracket_slots(palpite_id);
CREATE INDEX IF NOT EXISTS idx_bracket_slots_jogo    ON bracket_slots(jogo_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE bracket_slots ENABLE ROW LEVEL SECURITY;

-- Owner (via palpite) + admin can read
CREATE POLICY "bracket_slots_select" ON bracket_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM palpites p
      WHERE p.id = palpite_id AND p.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Owner + admin can write
CREATE POLICY "bracket_slots_write" ON bracket_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM palpites p
      WHERE p.id = palpite_id AND p.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
    )
  );
