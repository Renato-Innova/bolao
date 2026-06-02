-- ============================================================
-- Bolão Copa 2026 — Schema v2
-- Drops and recreates all tables except users.
-- Run in Supabase SQL Editor in one shot.
-- ============================================================

-- STEP 1 — Drop existing tables
DROP TABLE IF EXISTS palpites_jogos           CASCADE;
DROP TABLE IF EXISTS palpites                 CASCADE;
DROP TABLE IF EXISTS resultados               CASCADE;
DROP TABLE IF EXISTS classificacao_grupos     CASCADE;
DROP TABLE IF EXISTS jogos_copa               CASCADE;
DROP TABLE IF EXISTS configuracoes_pontuacao  CASCADE;

-- ============================================================
-- STEP 2 — jogos_copa
-- ============================================================
CREATE TABLE jogos_copa (
  id           SERIAL PRIMARY KEY,
  numero_jogo  INTEGER,
  fase         TEXT NOT NULL, -- 'grupos' | 'oitavas' | 'quartas' | 'semis' | 'terceiro' | 'final'
  grupo        TEXT,          -- A-L; null for knockout
  rodada       INTEGER,       -- 1-3 for groups; null for knockout
  data         DATE NOT NULL,
  horario      TIME NOT NULL, -- BRT (UTC-3)
  time_a       TEXT NOT NULL,
  time_b       TEXT NOT NULL,
  codigo_pais_a TEXT,
  codigo_pais_b TEXT,
  estadio      TEXT,
  cidade       TEXT,
  pais_sede    TEXT,          -- 'USA' | 'MEX' | 'CAN'
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 3 — classificacao_grupos
-- ============================================================
CREATE TABLE classificacao_grupos (
  id               SERIAL PRIMARY KEY,
  grupo            TEXT NOT NULL,
  pais_nome        TEXT NOT NULL,
  pais_codigo      TEXT NOT NULL,
  j                INTEGER DEFAULT 0,
  c                INTEGER DEFAULT 0,
  e                INTEGER DEFAULT 0,
  d                INTEGER DEFAULT 0,
  m                INTEGER DEFAULT 0,
  s                INTEGER DEFAULT 0,
  dg               INTEGER DEFAULT 0,
  pts              INTEGER DEFAULT 0,
  ultimos_resultados TEXT DEFAULT '',
  atualizado_em    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 4 — resultados
-- ============================================================
CREATE TABLE resultados (
  id              SERIAL PRIMARY KEY,
  jogo_id         INTEGER UNIQUE REFERENCES jogos_copa(id) ON DELETE CASCADE,
  placar_real_a   INTEGER,
  placar_real_b   INTEGER,
  artilheiro_copa TEXT,
  inserido_em     TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 5 — palpites
-- ============================================================
CREATE TABLE palpites (
  id           SERIAL PRIMARY KEY,
  usuario_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  status       TEXT DEFAULT 'inativo',
  artilheiro   TEXT,
  json_backup  JSONB,
  criado_em    TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 6 — palpites_jogos
-- ============================================================
CREATE TABLE palpites_jogos (
  id                SERIAL PRIMARY KEY,
  palpite_id        INTEGER REFERENCES palpites(id) ON DELETE CASCADE,
  jogo_id           INTEGER REFERENCES jogos_copa(id) ON DELETE CASCADE,
  placar_palpite_a  INTEGER,
  placar_palpite_b  INTEGER,
  pontos            INTEGER DEFAULT 0,
  submitted_at      TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (palpite_id, jogo_id)
);

-- ============================================================
-- STEP 7 — configuracoes_pontuacao
-- ============================================================
CREATE TABLE configuracoes_pontuacao (
  id            SERIAL PRIMARY KEY,
  fase          TEXT NOT NULL,
  tipo_acerto   TEXT NOT NULL,
  pontos        INTEGER NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fase, tipo_acerto)
);

INSERT INTO configuracoes_pontuacao (fase, tipo_acerto, pontos) VALUES
('grupos',  'placar_exato',  10),
('grupos',  'vencedor',       5),
('oitavas', 'placar_exato',  20),
('oitavas', 'vencedor',      10),
('quartas', 'placar_exato',  40),
('quartas', 'vencedor',      20),
('semis',   'placar_exato',  60),
('semis',   'vencedor',      30),
('final',   'placar_exato', 100),
('final',   'vencedor',      50);

-- ============================================================
-- STEP 8 — RLS
-- ============================================================
ALTER TABLE jogos_copa              ENABLE ROW LEVEL SECURITY;
ALTER TABLE classificacao_grupos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados              ENABLE ROW LEVEL SECURITY;
ALTER TABLE palpites                ENABLE ROW LEVEL SECURITY;
ALTER TABLE palpites_jogos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_pontuacao ENABLE ROW LEVEL SECURITY;

-- jogos_copa: public read
CREATE POLICY "jogos_select_all" ON jogos_copa FOR SELECT USING (true);

-- classificacao_grupos: public read
CREATE POLICY "class_select_all" ON classificacao_grupos FOR SELECT USING (true);

-- resultados: public read
CREATE POLICY "resultados_select_all" ON resultados FOR SELECT USING (true);

-- palpites: owner read/write, admin all
CREATE POLICY "palpites_select" ON palpites FOR SELECT USING (
  auth.uid() = usuario_id OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "palpites_insert" ON palpites FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "palpites_update" ON palpites FOR UPDATE USING (
  auth.uid() = usuario_id OR
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- palpites_jogos: owner read/write (via palpite), admin all
CREATE POLICY "palpites_jogos_select" ON palpites_jogos FOR SELECT USING (
  EXISTS (SELECT 1 FROM palpites p WHERE p.id = palpite_id AND p.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "palpites_jogos_write" ON palpites_jogos FOR ALL USING (
  EXISTS (SELECT 1 FROM palpites p WHERE p.id = palpite_id AND p.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- configuracoes_pontuacao: public read
CREATE POLICY "config_select_all" ON configuracoes_pontuacao FOR SELECT USING (true);

-- ============================================================
-- STEP 9 — Seed classificacao_grupos (48 teams, zeroed)
-- ============================================================
INSERT INTO classificacao_grupos (grupo, pais_nome, pais_codigo) VALUES
-- GROUP A
('A','México','mx'),('A','África do Sul','za'),('A','Coreia do Sul','kr'),('A','Tchéquia','cz'),
-- GROUP B
('B','Canadá','ca'),('B','Bósnia e Herzegovina','ba'),('B','Suíça','ch'),('B','Catar','qa'),
-- GROUP C
('C','Brasil','br'),('C','Marrocos','ma'),('C','Haiti','ht'),('C','Escócia','gb-sct'),
-- GROUP D
('D','EUA','us'),('D','Paraguai','py'),('D','Austrália','au'),('D','Turquia','tr'),
-- GROUP E
('E','Alemanha','de'),('E','Curaçao','cw'),('E','Costa do Marfim','ci'),('E','Equador','ec'),
-- GROUP F
('F','Holanda','nl'),('F','Japão','jp'),('F','Suécia','se'),('F','Tunísia','tn'),
-- GROUP G
('G','Bélgica','be'),('G','Egito','eg'),('G','Irã','ir'),('G','Nova Zelândia','nz'),
-- GROUP H
('H','Espanha','es'),('H','Cabo Verde','cv'),('H','Arábia Saudita','sa'),('H','Uruguai','uy'),
-- GROUP I
('I','França','fr'),('I','Senegal','sn'),('I','Iraque','iq'),('I','Noruega','no'),
-- GROUP J
('J','Argentina','ar'),('J','Argélia','dz'),('J','Áustria','at'),('J','Jordânia','jo'),
-- GROUP K
('K','Portugal','pt'),('K','Rep. Dem. do Congo','cd'),('K','Uzbequistão','uz'),('K','Colômbia','co'),
-- GROUP L
('L','Inglaterra','gb-eng'),('L','Croácia','hr'),('L','Gana','gh'),('L','Panamá','pa');

-- ============================================================
-- STEP 10 — Seed jogos_copa (104 games)
-- All times are BRT (UTC-3).
-- ============================================================

-- ── June 11 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(1,'grupos','A',1,'2026-06-11','16:00','México','África do Sul','mx','za','Estadio Azteca','Cidade do México','MEX'),
(2,'grupos','A',1,'2026-06-11','23:00','Coreia do Sul','Tchéquia','kr','cz','Estadio Akron','Zapopan','MEX');

-- ── June 12 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(3,'grupos','B',1,'2026-06-12','16:00','Canadá','Bósnia e Herzegovina','ca','ba','BMO Field','Toronto','CAN'),
(4,'grupos','D',1,'2026-06-12','22:00','EUA','Paraguai','us','py','SoFi Stadium','Los Angeles','USA');

-- ── June 13 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(5,'grupos','B',1,'2026-06-13','16:00','Catar','Suíça','qa','ch','Levi''s Stadium','Santa Clara','USA'),
(6,'grupos','C',1,'2026-06-13','19:00','Brasil','Marrocos','br','ma','MetLife Stadium','Nova Jersey','USA'),
(7,'grupos','C',1,'2026-06-13','22:00','Haiti','Escócia','ht','gb-sct','Gillette Stadium','Foxborough','USA');

-- ── June 14 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(8,'grupos','D',1,'2026-06-14','01:00','Austrália','Turquia','au','tr','BC Place','Vancouver','CAN'),
(9,'grupos','E',1,'2026-06-14','14:00','Alemanha','Curaçao','de','cw','NRG Stadium','Houston','USA'),
(10,'grupos','F',1,'2026-06-14','17:00','Holanda','Japão','nl','jp','AT&T Stadium','Arlington','USA'),
(11,'grupos','E',1,'2026-06-14','20:00','Costa do Marfim','Equador','ci','ec','Lincoln Financial Field','Filadélfia','USA'),
(12,'grupos','F',1,'2026-06-14','23:00','Suécia','Tunísia','se','tn','Estadio BBVA','Monterrey','MEX');

-- ── June 15 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(13,'grupos','H',1,'2026-06-15','13:00','Espanha','Cabo Verde','es','cv','Mercedes-Benz Stadium','Atlanta','USA'),
(14,'grupos','G',1,'2026-06-15','16:00','Bélgica','Egito','be','eg','Lumen Field','Seattle','USA'),
(15,'grupos','H',1,'2026-06-15','19:00','Arábia Saudita','Uruguai','sa','uy','Hard Rock Stadium','Miami Gardens','USA'),
(16,'grupos','G',1,'2026-06-15','22:00','Irã','Nova Zelândia','ir','nz','SoFi Stadium','Los Angeles','USA');

-- ── June 16 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(17,'grupos','I',1,'2026-06-16','16:00','França','Senegal','fr','sn','MetLife Stadium','Nova Jersey','USA'),
(18,'grupos','I',1,'2026-06-16','19:00','Iraque','Noruega','iq','no','Gillette Stadium','Foxborough','USA'),
(19,'grupos','J',1,'2026-06-16','22:00','Argentina','Argélia','ar','dz','Arrowhead Stadium','Kansas City','USA');

-- ── June 17 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(20,'grupos','J',1,'2026-06-17','01:00','Áustria','Jordânia','at','jo','Levi''s Stadium','Santa Clara','USA'),
(21,'grupos','K',1,'2026-06-17','14:00','Portugal','Rep. Dem. do Congo','pt','cd','NRG Stadium','Houston','USA'),
(22,'grupos','L',1,'2026-06-17','17:00','Inglaterra','Croácia','gb-eng','hr','AT&T Stadium','Arlington','USA'),
(23,'grupos','L',1,'2026-06-17','20:00','Gana','Panamá','gh','pa','BMO Field','Toronto','CAN'),
(24,'grupos','K',1,'2026-06-17','23:00','Uzbequistão','Colômbia','uz','co','Estadio Azteca','Cidade do México','MEX');

-- ── June 18 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(25,'grupos','A',2,'2026-06-18','13:00','Tchéquia','África do Sul','cz','za','Mercedes-Benz Stadium','Atlanta','USA'),
(26,'grupos','B',2,'2026-06-18','16:00','Suíça','Bósnia e Herzegovina','ch','ba','SoFi Stadium','Los Angeles','USA'),
(27,'grupos','B',2,'2026-06-18','19:00','Canadá','Catar','ca','qa','BC Place','Vancouver','CAN'),
(28,'grupos','A',2,'2026-06-18','22:00','México','Coreia do Sul','mx','kr','Estadio Akron','Zapopan','MEX');

-- ── June 19 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(29,'grupos','D',2,'2026-06-19','16:00','EUA','Austrália','us','au','Lumen Field','Seattle','USA'),
(30,'grupos','C',2,'2026-06-19','19:00','Escócia','Marrocos','gb-sct','ma','Gillette Stadium','Foxborough','USA'),
(31,'grupos','C',2,'2026-06-19','21:30','Brasil','Haiti','br','ht','Lincoln Financial Field','Filadélfia','USA');

-- ── June 20 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(32,'grupos','D',2,'2026-06-20','00:00','Turquia','Paraguai','tr','py','Levi''s Stadium','Santa Clara','USA'),
(33,'grupos','F',2,'2026-06-20','14:00','Holanda','Suécia','nl','se','NRG Stadium','Houston','USA'),
(34,'grupos','E',2,'2026-06-20','17:00','Alemanha','Costa do Marfim','de','ci','BMO Field','Toronto','CAN'),
(35,'grupos','E',2,'2026-06-20','21:00','Equador','Curaçao','ec','cw','Arrowhead Stadium','Kansas City','USA');

-- ── June 21 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(36,'grupos','F',2,'2026-06-21','01:00','Tunísia','Japão','tn','jp','Estadio BBVA','Monterrey','MEX'),
(37,'grupos','H',2,'2026-06-21','13:00','Espanha','Arábia Saudita','es','sa','Mercedes-Benz Stadium','Atlanta','USA'),
(38,'grupos','G',2,'2026-06-21','16:00','Bélgica','Irã','be','ir','SoFi Stadium','Los Angeles','USA'),
(39,'grupos','H',2,'2026-06-21','19:00','Uruguai','Cabo Verde','uy','cv','Hard Rock Stadium','Miami Gardens','USA'),
(40,'grupos','G',2,'2026-06-21','22:00','Nova Zelândia','Egito','nz','eg','BC Place','Vancouver','CAN');

-- ── June 22 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(41,'grupos','J',2,'2026-06-22','14:00','Argentina','Áustria','ar','at','AT&T Stadium','Arlington','USA'),
(42,'grupos','I',2,'2026-06-22','18:00','França','Iraque','fr','iq','Lincoln Financial Field','Filadélfia','USA'),
(43,'grupos','I',2,'2026-06-22','21:00','Noruega','Senegal','no','sn','MetLife Stadium','Nova Jersey','USA'),
(44,'grupos','J',2,'2026-06-22','00:00','Jordânia','Argélia','jo','dz','Levi''s Stadium','Santa Clara','USA');

-- ── June 23 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(45,'grupos','K',2,'2026-06-23','14:00','Portugal','Uzbequistão','pt','uz','NRG Stadium','Houston','USA'),
(46,'grupos','L',2,'2026-06-23','17:00','Inglaterra','Gana','gb-eng','gh','Gillette Stadium','Foxborough','USA'),
(47,'grupos','L',2,'2026-06-23','20:00','Panamá','Croácia','pa','hr','BMO Field','Toronto','CAN'),
(48,'grupos','K',2,'2026-06-23','23:00','Colômbia','Rep. Dem. do Congo','co','cd','Estadio Akron','Zapopan','MEX');

-- ── June 24 (Round 3 — simultaneous per group) ───────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(49,'grupos','B',3,'2026-06-24','16:00','Suíça','Canadá','ch','ca','BC Place','Vancouver','CAN'),
(50,'grupos','B',3,'2026-06-24','16:00','Bósnia e Herzegovina','Catar','ba','qa','Lumen Field','Seattle','USA'),
(51,'grupos','C',3,'2026-06-24','19:00','Escócia','Brasil','gb-sct','br','Hard Rock Stadium','Miami Gardens','USA'),
(52,'grupos','C',3,'2026-06-24','19:00','Marrocos','Haiti','ma','ht','Mercedes-Benz Stadium','Atlanta','USA'),
(53,'grupos','A',3,'2026-06-24','22:00','Tchéquia','México','cz','mx','Estadio Azteca','Cidade do México','MEX'),
(54,'grupos','A',3,'2026-06-24','22:00','África do Sul','Coreia do Sul','za','kr','Estadio BBVA','Monterrey','MEX');

-- ── June 25 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(55,'grupos','E',3,'2026-06-25','17:00','Curaçao','Costa do Marfim','cw','ci','Lincoln Financial Field','Filadélfia','USA'),
(56,'grupos','E',3,'2026-06-25','17:00','Equador','Alemanha','ec','de','MetLife Stadium','Nova Jersey','USA'),
(57,'grupos','F',3,'2026-06-25','20:00','Japão','Suécia','jp','se','AT&T Stadium','Arlington','USA'),
(58,'grupos','F',3,'2026-06-25','20:00','Tunísia','Holanda','tn','nl','Arrowhead Stadium','Kansas City','USA'),
(59,'grupos','D',3,'2026-06-25','23:00','Turquia','EUA','tr','us','SoFi Stadium','Los Angeles','USA'),
(60,'grupos','D',3,'2026-06-25','23:00','Paraguai','Austrália','py','au','Levi''s Stadium','Santa Clara','USA');

-- ── June 26 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(61,'grupos','I',3,'2026-06-26','16:00','Noruega','França','no','fr','Gillette Stadium','Foxborough','USA'),
(62,'grupos','I',3,'2026-06-26','16:00','Senegal','Iraque','sn','iq','BMO Field','Toronto','CAN'),
(63,'grupos','H',3,'2026-06-26','21:00','Cabo Verde','Arábia Saudita','cv','sa','NRG Stadium','Houston','USA'),
(64,'grupos','H',3,'2026-06-26','21:00','Uruguai','Espanha','uy','es','Estadio Akron','Zapopan','MEX'),
(65,'grupos','G',3,'2026-06-26','00:00','Egito','Irã','eg','ir','Lumen Field','Seattle','USA'),
(66,'grupos','G',3,'2026-06-26','00:00','Nova Zelândia','Bélgica','nz','be','BC Place','Vancouver','CAN');

-- ── June 27 ──────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(67,'grupos','L',3,'2026-06-27','18:00','Panamá','Inglaterra','pa','gb-eng','MetLife Stadium','Nova Jersey','USA'),
(68,'grupos','L',3,'2026-06-27','18:00','Croácia','Gana','hr','gh','Lincoln Financial Field','Filadélfia','USA'),
(69,'grupos','K',3,'2026-06-27','20:30','Colômbia','Portugal','co','pt','Hard Rock Stadium','Miami Gardens','USA'),
(70,'grupos','K',3,'2026-06-27','20:30','Rep. Dem. do Congo','Uzbequistão','cd','uz','Mercedes-Benz Stadium','Atlanta','USA'),
(71,'grupos','J',3,'2026-06-27','23:00','Argélia','Áustria','dz','at','Arrowhead Stadium','Kansas City','USA'),
(72,'grupos','J',3,'2026-06-27','23:00','Jordânia','Argentina','jo','ar','AT&T Stadium','Arlington','USA');

-- ── Round of 32 (oitavas) ─────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,rodada,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(73,'oitavas',NULL,'2026-06-28','16:00','2º Grupo A','2º Grupo B','SoFi Stadium','Los Angeles','USA'),
(74,'oitavas',NULL,'2026-06-29','17:30','1º Grupo E','Melhor 3º (A/B/C/D/F)','Gillette Stadium','Foxborough','USA'),
(75,'oitavas',NULL,'2026-06-29','22:00','1º Grupo F','2º Grupo C','Estadio BBVA','Monterrey','MEX'),
(76,'oitavas',NULL,'2026-06-29','14:00','1º Grupo C','2º Grupo F','NRG Stadium','Houston','USA'),
(77,'oitavas',NULL,'2026-06-30','18:00','1º Grupo I','Melhor 3º (C/D/F/G/H)','MetLife Stadium','Nova Jersey','USA'),
(78,'oitavas',NULL,'2026-06-30','14:00','2º Grupo E','2º Grupo I','AT&T Stadium','Arlington','USA'),
(79,'oitavas',NULL,'2026-06-30','22:00','1º Grupo A','Melhor 3º (C/E/F/H/I)','Estadio Azteca','Cidade do México','MEX'),
(80,'oitavas',NULL,'2026-07-01','13:00','1º Grupo L','Melhor 3º (E/H/I/J/K)','Mercedes-Benz Stadium','Atlanta','USA'),
(81,'oitavas',NULL,'2026-07-01','21:00','1º Grupo D','Melhor 3º (B/E/F/I/J)','Levi''s Stadium','Santa Clara','USA'),
(82,'oitavas',NULL,'2026-07-01','17:00','1º Grupo G','Melhor 3º (A/E/H/I/J)','Lumen Field','Seattle','USA'),
(83,'oitavas',NULL,'2026-07-02','20:00','2º Grupo K','2º Grupo L','BMO Field','Toronto','CAN'),
(84,'oitavas',NULL,'2026-07-02','16:00','1º Grupo H','2º Grupo J','SoFi Stadium','Los Angeles','USA'),
(85,'oitavas',NULL,'2026-07-02','00:00','1º Grupo B','Melhor 3º (E/F/G/I/J)','BC Place','Vancouver','CAN'),
(86,'oitavas',NULL,'2026-07-03','19:00','1º Grupo J','2º Grupo H','Hard Rock Stadium','Miami Gardens','USA'),
(87,'oitavas',NULL,'2026-07-03','22:30','1º Grupo K','Melhor 3º (D/E/I/J/L)','Arrowhead Stadium','Kansas City','USA'),
(88,'oitavas',NULL,'2026-07-03','15:00','2º Grupo D','2º Grupo G','AT&T Stadium','Arlington','USA');

-- ── Round of 16 (quartas) ─────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,rodada,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(89,'quartas',NULL,'2026-07-04','18:00','Vencedor Jogo 74','Vencedor Jogo 77','Lincoln Financial Field','Filadélfia','USA'),
(90,'quartas',NULL,'2026-07-04','14:00','Vencedor Jogo 73','Vencedor Jogo 75','NRG Stadium','Houston','USA'),
(91,'quartas',NULL,'2026-07-05','17:00','Vencedor Jogo 76','Vencedor Jogo 78','MetLife Stadium','Nova Jersey','USA'),
(92,'quartas',NULL,'2026-07-05','21:00','Vencedor Jogo 79','Vencedor Jogo 80','Estadio Azteca','Cidade do México','MEX'),
(93,'quartas',NULL,'2026-07-06','16:00','Vencedor Jogo 83','Vencedor Jogo 84','AT&T Stadium','Arlington','USA'),
(94,'quartas',NULL,'2026-07-06','21:00','Vencedor Jogo 81','Vencedor Jogo 82','Lumen Field','Seattle','USA'),
(95,'quartas',NULL,'2026-07-07','13:00','Vencedor Jogo 86','Vencedor Jogo 88','Mercedes-Benz Stadium','Atlanta','USA'),
(96,'quartas',NULL,'2026-07-07','17:00','Vencedor Jogo 85','Vencedor Jogo 87','BC Place','Vancouver','CAN');

-- ── Quarterfinals (semis) ─────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,rodada,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(97,'semis',NULL,'2026-07-09','17:00','Vencedor Jogo 89','Vencedor Jogo 90','Gillette Stadium','Foxborough','USA'),
(98,'semis',NULL,'2026-07-10','16:00','Vencedor Jogo 93','Vencedor Jogo 94','SoFi Stadium','Los Angeles','USA'),
(99,'semis',NULL,'2026-07-11','18:00','Vencedor Jogo 91','Vencedor Jogo 92','Hard Rock Stadium','Miami Gardens','USA'),
(100,'semis',NULL,'2026-07-11','22:00','Vencedor Jogo 95','Vencedor Jogo 96','Arrowhead Stadium','Kansas City','USA');

-- ── Semifinals ────────────────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,rodada,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(101,'semis',NULL,'2026-07-14','16:00','Vencedor Jogo 97','Vencedor Jogo 98','AT&T Stadium','Arlington','USA'),
(102,'semis',NULL,'2026-07-15','16:00','Vencedor Jogo 99','Vencedor Jogo 100','Mercedes-Benz Stadium','Atlanta','USA');

-- ── Third place + Final ───────────────────────────────────────
INSERT INTO jogos_copa (numero_jogo,fase,rodada,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(103,'terceiro',NULL,'2026-07-18','18:00','Perdedor Jogo 101','Perdedor Jogo 102','Hard Rock Stadium','Miami Gardens','USA'),
(104,'final',NULL,'2026-07-19','16:00','Vencedor Jogo 101','Vencedor Jogo 102','MetLife Stadium','Nova Jersey','USA');
