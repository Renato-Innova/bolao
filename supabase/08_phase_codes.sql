-- ============================================================
-- Bolão Copa 2026 — Phase code migration
-- Remaps old phase names → new standard codes and adds R32.
-- Run AFTER 06_schema_v2.sql + 07_trigger_classificacao.sql.
-- ============================================================

-- ── jogos_copa ───────────────────────────────────────────────
UPDATE jogos_copa SET fase = 'GS'  WHERE fase = 'grupos';
UPDATE jogos_copa SET fase = 'R32' WHERE fase = 'oitavas';   -- J73–J88
UPDATE jogos_copa SET fase = 'R16' WHERE fase = 'quartas';   -- J89–J96
UPDATE jogos_copa SET fase = 'QF'  WHERE fase = 'semis' AND numero_jogo BETWEEN 97  AND 100;
UPDATE jogos_copa SET fase = 'SF'  WHERE fase = 'semis' AND numero_jogo BETWEEN 101 AND 102;
UPDATE jogos_copa SET fase = 'TPL' WHERE fase = 'terceiro';  -- J103
UPDATE jogos_copa SET fase = 'F'   WHERE fase = 'final';     -- J104

-- ── configuracoes_pontuacao ───────────────────────────────────
UPDATE configuracoes_pontuacao SET fase = 'GS'  WHERE fase = 'grupos';
UPDATE configuracoes_pontuacao SET fase = 'R32' WHERE fase = 'oitavas';
UPDATE configuracoes_pontuacao SET fase = 'R16' WHERE fase = 'quartas';
UPDATE configuracoes_pontuacao SET fase = 'QF'  WHERE fase = 'semis';
UPDATE configuracoes_pontuacao SET fase = 'F'   WHERE fase = 'final';

-- Add SF scoring (same defaults as QF; admin can adjust)
INSERT INTO configuracoes_pontuacao (fase, tipo_acerto, pontos)
SELECT 'SF', tipo_acerto, pontos FROM configuracoes_pontuacao WHERE fase = 'QF'
ON CONFLICT (fase, tipo_acerto) DO NOTHING;

-- Add TPL scoring (same defaults as SF)
INSERT INTO configuracoes_pontuacao (fase, tipo_acerto, pontos)
SELECT 'TPL', tipo_acerto, pontos FROM configuracoes_pontuacao WHERE fase = 'SF'
ON CONFLICT (fase, tipo_acerto) DO NOTHING;

-- ── Verify counts ─────────────────────────────────────────────
-- Expected: GS=72, R32=16, R16=8, QF=4, SF=2, TPL=1, F=1  → total 104
SELECT fase, COUNT(*) FROM jogos_copa GROUP BY fase ORDER BY MIN(id);

-- Expected: GS=2, R32=2, R16=2, QF=2, SF=2, TPL=2, F=2  → total 14
SELECT fase, COUNT(*) FROM configuracoes_pontuacao GROUP BY fase ORDER BY MIN(id);
