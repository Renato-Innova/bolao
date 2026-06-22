-- ============================================================
-- Bolão Copa 2026 — FRESH INSTALL (schema completo)
-- Cole este arquivo inteiro no Supabase SQL Editor e execute.
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT em todo lugar.
-- ============================================================

-- ── 0. Extensões ─────────────────────────────────────────────
-- pg_cron precisa estar habilitado em Dashboard → Database → Extensions
-- (não falha se já estiver ativo)

-- ═══════════════════════════════════════════════════════════════
-- TABELAS
-- ═══════════════════════════════════════════════════════════════

-- ── users (estende auth.users) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text UNIQUE NOT NULL,
  nome          text NOT NULL,
  telefone      text,
  is_admin      boolean NOT NULL DEFAULT false,
  is_operador   boolean NOT NULL DEFAULT false,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- ── jogos_copa ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jogos_copa (
  id            SERIAL PRIMARY KEY,
  numero_jogo   integer,
  fase          text NOT NULL,  -- GS | R32 | R16 | QF | SF | TPL | F
  grupo         text,           -- A–L; null para mata-mata
  rodada        integer,        -- 1-3 para grupos; null para mata-mata
  data          date NOT NULL,
  horario       time NOT NULL,  -- BRT (UTC-3)
  time_a        text NOT NULL,
  time_b        text NOT NULL,
  codigo_pais_a text,
  codigo_pais_b text,
  estadio       text,
  cidade        text,
  pais_sede     text,           -- USA | MEX | CAN
  criado_em     timestamptz DEFAULT now()
);

-- ── classificacao_grupos ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classificacao_grupos (
  id                 SERIAL PRIMARY KEY,
  grupo              text NOT NULL,
  pais_nome          text NOT NULL,
  pais_codigo        text NOT NULL,
  j                  integer DEFAULT 0,
  c                  integer DEFAULT 0,
  e                  integer DEFAULT 0,
  d                  integer DEFAULT 0,
  m                  integer DEFAULT 0,
  s                  integer DEFAULT 0,
  dg                 integer DEFAULT 0,
  pts                integer DEFAULT 0,
  ultimos_resultados text DEFAULT '',
  atualizado_em      timestamptz DEFAULT now()
);

-- ── resultados ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resultados (
  id               SERIAL PRIMARY KEY,
  jogo_id          integer UNIQUE NOT NULL REFERENCES public.jogos_copa(id) ON DELETE CASCADE,
  placar_real_a    integer,
  placar_real_b    integer,
  placar_penalti_a integer DEFAULT NULL,  -- pênaltis: null = não houve
  placar_penalti_b integer DEFAULT NULL,
  inserido_em      timestamptz DEFAULT now(),
  atualizado_em    timestamptz DEFAULT now()
);

-- ── palpites ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.palpites (
  id                   SERIAL PRIMARY KEY,
  usuario_id           uuid REFERENCES public.users(id) ON DELETE CASCADE,
  nome                 text NOT NULL,
  status               text DEFAULT 'inativo',   -- ativo | inativo
  campeao              text,
  vice_campeao         text,
  artilheiro           text,
  melhor_jogador       text,
  melhor_goleiro       text,
  pontos_especiais     integer NOT NULL DEFAULT 0,
  pontos_classificacao integer NOT NULL DEFAULT 0,
  avatar_type          text DEFAULT 'initials',   -- emoji | camisa | initials
  avatar_value         text DEFAULT NULL,
  json_backup          jsonb,
  criado_em            timestamptz DEFAULT now(),
  atualizado_em        timestamptz DEFAULT now(),
  CONSTRAINT palpites_nome_unique UNIQUE (nome)
);

-- ── palpites_jogos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.palpites_jogos (
  id               SERIAL PRIMARY KEY,
  palpite_id       integer REFERENCES public.palpites(id)   ON DELETE CASCADE,
  jogo_id          integer REFERENCES public.jogos_copa(id) ON DELETE CASCADE,
  placar_palpite_a integer,
  placar_palpite_b integer,
  placar_penalti_a integer DEFAULT NULL,
  placar_penalti_b integer DEFAULT NULL,
  pontos           integer DEFAULT 0,
  submitted_at     timestamptz,
  criado_em        timestamptz DEFAULT now(),
  atualizado_em    timestamptz DEFAULT now(),
  UNIQUE (palpite_id, jogo_id)
);

-- ── configuracoes_pontuacao ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.configuracoes_pontuacao (
  id            SERIAL PRIMARY KEY,
  fase          text NOT NULL,
  tipo_acerto   text NOT NULL CHECK (tipo_acerto IN (
                  'placar_exato','empate','vencedor','gols_equipe','penalti'
                )),
  pontos        integer NOT NULL,
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE (fase, tipo_acerto)
);

-- ── resultados_especiais (linha única) ───────────────────────
CREATE TABLE IF NOT EXISTS public.resultados_especiais (
  id             integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  campeao        text,
  vice_campeao   text,
  artilheiro     text,
  melhor_jogador text,
  melhor_goleiro text,
  atualizado_em  timestamptz DEFAULT now()
);

-- ── bracket_slots ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bracket_slots (
  id         SERIAL PRIMARY KEY,
  palpite_id integer NOT NULL REFERENCES public.palpites(id)   ON DELETE CASCADE,
  jogo_id    integer NOT NULL REFERENCES public.jogos_copa(id) ON DELETE CASCADE,
  time_a     text,
  time_b     text,
  codigo_a   text,
  codigo_b   text,
  is_valid   boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (palpite_id, jogo_id)
);

CREATE INDEX IF NOT EXISTS idx_bracket_slots_palpite ON public.bracket_slots(palpite_id);
CREATE INDEX IF NOT EXISTS idx_bracket_slots_jogo    ON public.bracket_slots(jogo_id);

-- ── configuracoes_sistema ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  id                    integer PRIMARY KEY DEFAULT 1,
  especiais_deadline    timestamptz,
  novo_palpite_deadline timestamptz,
  minutos_lock_jogo     integer DEFAULT 60,
  atualizado_em         timestamptz DEFAULT now()
);

-- ── ranking_historico ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranking_historico (
  id           serial PRIMARY KEY,
  palpite_id   integer NOT NULL REFERENCES public.palpites(id) ON DELETE CASCADE,
  data         date    NOT NULL,
  total_pontos integer NOT NULL DEFAULT 0,
  criado_em    timestamptz DEFAULT now(),
  UNIQUE(palpite_id, data)
);

CREATE INDEX IF NOT EXISTS idx_ranking_historico_data ON public.ranking_historico(data);


-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogos_copa             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificacao_grupos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palpites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palpites_jogos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_pontuacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_especiais   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_slots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_sistema  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_historico      ENABLE ROW LEVEL SECURITY;

-- ── users ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_all"  ON public.users;
DROP POLICY IF EXISTS "users_insert_own"  ON public.users;
DROP POLICY IF EXISTS "users_update_own"  ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- ── jogos_copa ───────────────────────────────────────────────
DROP POLICY IF EXISTS "jogos_select_all"      ON public.jogos_copa;
DROP POLICY IF EXISTS "admin_update_jogos_copa" ON public.jogos_copa;
CREATE POLICY "jogos_select_all" ON public.jogos_copa FOR SELECT USING (true);
CREATE POLICY "admin_update_jogos_copa" ON public.jogos_copa
  FOR UPDATE TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── classificacao_grupos ─────────────────────────────────────
DROP POLICY IF EXISTS "class_select_all" ON public.classificacao_grupos;
CREATE POLICY "class_select_all" ON public.classificacao_grupos FOR SELECT USING (true);

-- ── resultados ───────────────────────────────────────────────
DROP POLICY IF EXISTS "resultados_select_all"    ON public.resultados;
DROP POLICY IF EXISTS "admin_manage_resultados"  ON public.resultados;
CREATE POLICY "resultados_select_all" ON public.resultados FOR SELECT USING (true);
CREATE POLICY "admin_manage_resultados" ON public.resultados
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ── palpites ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "palpites_select_own"    ON public.palpites;
DROP POLICY IF EXISTS "palpites_select_ativo"  ON public.palpites;
DROP POLICY IF EXISTS "palpites_insert_own"    ON public.palpites;
DROP POLICY IF EXISTS "palpites_update_own"    ON public.palpites;
DROP POLICY IF EXISTS "user_delete_own_palpite" ON public.palpites;
CREATE POLICY "palpites_select_own" ON public.palpites FOR SELECT USING (
  auth.uid() = usuario_id
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "palpites_insert_own" ON public.palpites
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "palpites_update_own" ON public.palpites FOR UPDATE USING (
  auth.uid() = usuario_id
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "user_delete_own_palpite" ON public.palpites
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() AND status = 'inativo');

-- ── palpites_jogos ───────────────────────────────────────────
DROP POLICY IF EXISTS "palpites_jogos_select"       ON public.palpites_jogos;
DROP POLICY IF EXISTS "palpites_jogos_write"        ON public.palpites_jogos;
DROP POLICY IF EXISTS "admin_update_palpites_jogos" ON public.palpites_jogos;
CREATE POLICY "palpites_jogos_select" ON public.palpites_jogos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.palpites p WHERE p.id = palpite_id AND p.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "palpites_jogos_write" ON public.palpites_jogos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.palpites p WHERE p.id = palpite_id AND p.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- ── configuracoes_pontuacao ──────────────────────────────────
DROP POLICY IF EXISTS "config_select_all"   ON public.configuracoes_pontuacao;
DROP POLICY IF EXISTS "config_admin_write"  ON public.configuracoes_pontuacao;
CREATE POLICY "config_select_all"  ON public.configuracoes_pontuacao FOR SELECT USING (true);
CREATE POLICY "config_admin_write" ON public.configuracoes_pontuacao FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- ── resultados_especiais ─────────────────────────────────────
DROP POLICY IF EXISTS "especiais_select_all"  ON public.resultados_especiais;
DROP POLICY IF EXISTS "especiais_admin_write" ON public.resultados_especiais;
CREATE POLICY "especiais_select_all"  ON public.resultados_especiais FOR SELECT USING (true);
CREATE POLICY "especiais_admin_write" ON public.resultados_especiais FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- ── bracket_slots ────────────────────────────────────────────
DROP POLICY IF EXISTS "bracket_slots_select" ON public.bracket_slots;
DROP POLICY IF EXISTS "bracket_slots_write"  ON public.bracket_slots;
CREATE POLICY "bracket_slots_select" ON public.bracket_slots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.palpites p WHERE p.id = palpite_id AND p.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "bracket_slots_write" ON public.bracket_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM public.palpites p WHERE p.id = palpite_id AND p.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- ── configuracoes_sistema ────────────────────────────────────
DROP POLICY IF EXISTS "leitura_publica_config_sistema" ON public.configuracoes_sistema;
CREATE POLICY "leitura_publica_config_sistema" ON public.configuracoes_sistema
  FOR SELECT USING (true);

-- ── ranking_historico ────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access" ON public.ranking_historico;
CREATE POLICY "Service role full access" ON public.ranking_historico
  USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: atualiza classificacao_grupos ao inserir resultado
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_update_classificacao_grupos()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_jogo_id   INTEGER;
  v_jogo      RECORD;
  v_grupo     TEXT;
  v_result    RECORD;
  v_res_a     CHAR(1);
  v_res_b     CHAR(1);
  v_ult       TEXT;
  v_arr       TEXT[];
  v_arr_len   INTEGER;
BEGIN
  v_jogo_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.jogo_id ELSE NEW.jogo_id END;
  SELECT fase, grupo INTO v_jogo FROM public.jogos_copa WHERE id = v_jogo_id;

  IF v_jogo.fase IS DISTINCT FROM 'GS' OR v_jogo.grupo IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_grupo := v_jogo.grupo;

  UPDATE public.classificacao_grupos
  SET j=0, c=0, e=0, d=0, m=0, s=0, dg=0, pts=0, ultimos_resultados='', atualizado_em=NOW()
  WHERE grupo = v_grupo;

  FOR v_result IN
    SELECT jc.time_a, jc.time_b, r.placar_real_a, r.placar_real_b
    FROM   public.jogos_copa jc
    JOIN   public.resultados r ON r.jogo_id = jc.id
    WHERE  jc.fase = 'GS' AND jc.grupo = v_grupo
    ORDER  BY jc.data ASC, jc.horario ASC
  LOOP
    IF    v_result.placar_real_a > v_result.placar_real_b THEN v_res_a := 'V'; v_res_b := 'D';
    ELSIF v_result.placar_real_a < v_result.placar_real_b THEN v_res_a := 'D'; v_res_b := 'V';
    ELSE                                                        v_res_a := 'E'; v_res_b := 'E';
    END IF;

    -- Time A
    SELECT ultimos_resultados INTO v_ult FROM public.classificacao_grupos WHERE grupo = v_grupo AND pais_nome = v_result.time_a;
    v_arr := CASE WHEN TRIM(COALESCE(v_ult,'')) = '' THEN '{}'::TEXT[] ELSE string_to_array(TRIM(v_ult), ' ') END;
    v_arr := v_arr || ARRAY[v_res_a::TEXT];
    v_arr_len := array_length(v_arr, 1);
    IF v_arr_len > 3 THEN v_arr := v_arr[v_arr_len-2 : v_arr_len]; END IF;
    UPDATE public.classificacao_grupos SET
      j=j+1, m=m+v_result.placar_real_a, s=s+v_result.placar_real_b,
      dg=dg+(v_result.placar_real_a-v_result.placar_real_b),
      c=c+CASE WHEN v_res_a='V' THEN 1 ELSE 0 END,
      e=e+CASE WHEN v_res_a='E' THEN 1 ELSE 0 END,
      d=d+CASE WHEN v_res_a='D' THEN 1 ELSE 0 END,
      pts=pts+CASE v_res_a WHEN 'V' THEN 3 WHEN 'E' THEN 1 ELSE 0 END,
      ultimos_resultados=array_to_string(v_arr,' '), atualizado_em=NOW()
    WHERE grupo=v_grupo AND pais_nome=v_result.time_a;

    -- Time B
    SELECT ultimos_resultados INTO v_ult FROM public.classificacao_grupos WHERE grupo = v_grupo AND pais_nome = v_result.time_b;
    v_arr := CASE WHEN TRIM(COALESCE(v_ult,'')) = '' THEN '{}'::TEXT[] ELSE string_to_array(TRIM(v_ult), ' ') END;
    v_arr := v_arr || ARRAY[v_res_b::TEXT];
    v_arr_len := array_length(v_arr, 1);
    IF v_arr_len > 3 THEN v_arr := v_arr[v_arr_len-2 : v_arr_len]; END IF;
    UPDATE public.classificacao_grupos SET
      j=j+1, m=m+v_result.placar_real_b, s=s+v_result.placar_real_a,
      dg=dg+(v_result.placar_real_b-v_result.placar_real_a),
      c=c+CASE WHEN v_res_b='V' THEN 1 ELSE 0 END,
      e=e+CASE WHEN v_res_b='E' THEN 1 ELSE 0 END,
      d=d+CASE WHEN v_res_b='D' THEN 1 ELSE 0 END,
      pts=pts+CASE v_res_b WHEN 'V' THEN 3 WHEN 'E' THEN 1 ELSE 0 END,
      ultimos_resultados=array_to_string(v_arr,' '), atualizado_em=NOW()
    WHERE grupo=v_grupo AND pais_nome=v_result.time_b;
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_classificacao_grupos ON public.resultados;
CREATE TRIGGER trg_update_classificacao_grupos
  AFTER INSERT OR UPDATE OR DELETE ON public.resultados
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_classificacao_grupos();


-- ═══════════════════════════════════════════════════════════════
-- FUNÇÃO: snapshot diário do ranking
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.snapshot_ranking_diario()
RETURNS void
LANGUAGE sql
SECURITY DEFINER AS $$
  INSERT INTO public.ranking_historico (palpite_id, data, total_pontos)
  SELECT
    p.id,
    (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
    COALESCE(SUM(pj.pontos), 0)
      + COALESCE(p.pontos_especiais, 0)
      + COALESCE(p.pontos_classificacao, 0)
  FROM public.palpites p
  LEFT JOIN public.palpites_jogos pj ON pj.palpite_id = p.id
  WHERE p.status = 'ativo'
  GROUP BY p.id
  ON CONFLICT (palpite_id, data)
  DO UPDATE SET total_pontos = EXCLUDED.total_pontos;
$$;

-- pg_cron: snapshot diário às 00:05 BRT (03:05 UTC)
-- Requer extensão pg_cron habilitada no Supabase
SELECT cron.schedule(
  'snapshot-ranking-diario',
  '5 3 * * *',
  'SELECT public.snapshot_ranking_diario()'
) WHERE EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
);


-- ═══════════════════════════════════════════════════════════════
-- STORAGE: bucket para avatares
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 307200,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can upload avatars"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars"                      ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can update their avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');


-- ═══════════════════════════════════════════════════════════════
-- SEEDS
-- ═══════════════════════════════════════════════════════════════

-- ── configuracoes_pontuacao (35 linhas — regulamento oficial) ─
DELETE FROM public.configuracoes_pontuacao;
INSERT INTO public.configuracoes_pontuacao (fase, tipo_acerto, pontos) VALUES
  ('GS',  'placar_exato', 20), ('GS',  'empate',       15), ('GS',  'vencedor',     10), ('GS',  'gols_equipe',   5), ('GS',  'penalti',       5),
  ('R32', 'placar_exato', 30), ('R32', 'empate',       22), ('R32', 'vencedor',     15), ('R32', 'gols_equipe',   8), ('R32', 'penalti',       8),
  ('R16', 'placar_exato', 40), ('R16', 'empate',       30), ('R16', 'vencedor',     20), ('R16', 'gols_equipe',  10), ('R16', 'penalti',      10),
  ('QF',  'placar_exato', 60), ('QF',  'empate',       40), ('QF',  'vencedor',     30), ('QF',  'gols_equipe',  15), ('QF',  'penalti',      15),
  ('SF',  'placar_exato', 80), ('SF',  'empate',       60), ('SF',  'vencedor',     40), ('SF',  'gols_equipe',  20), ('SF',  'penalti',      20),
  ('TPL', 'placar_exato',100), ('TPL', 'empate',       75), ('TPL', 'vencedor',     50), ('TPL', 'gols_equipe',  25), ('TPL', 'penalti',      25),
  ('F',   'placar_exato',120), ('F',   'empate',       75), ('F',   'vencedor',     60), ('F',   'gols_equipe',  30), ('F',   'penalti',      30);

-- ── resultados_especiais (linha única) ───────────────────────
INSERT INTO public.resultados_especiais (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── configuracoes_sistema ────────────────────────────────────
INSERT INTO public.configuracoes_sistema (id, minutos_lock_jogo) VALUES (1, 60) ON CONFLICT (id) DO NOTHING;

-- ── classificacao_grupos (48 seleções, zeradas) ──────────────
INSERT INTO public.classificacao_grupos (grupo, pais_nome, pais_codigo) VALUES
  ('A','México','mx'),       ('A','África do Sul','za'),     ('A','Coreia do Sul','kr'),  ('A','Tchéquia','cz'),
  ('B','Canadá','ca'),       ('B','Bósnia e Herzegovina','ba'),('B','Suíça','ch'),         ('B','Catar','qa'),
  ('C','Brasil','br'),       ('C','Marrocos','ma'),           ('C','Haiti','ht'),          ('C','Escócia','gb-sct'),
  ('D','EUA','us'),          ('D','Paraguai','py'),           ('D','Austrália','au'),      ('D','Turquia','tr'),
  ('E','Alemanha','de'),     ('E','Curaçao','cw'),            ('E','Costa do Marfim','ci'),('E','Equador','ec'),
  ('F','Holanda','nl'),      ('F','Japão','jp'),              ('F','Suécia','se'),         ('F','Tunísia','tn'),
  ('G','Bélgica','be'),      ('G','Egito','eg'),              ('G','Irã','ir'),            ('G','Nova Zelândia','nz'),
  ('H','Espanha','es'),      ('H','Cabo Verde','cv'),         ('H','Arábia Saudita','sa'), ('H','Uruguai','uy'),
  ('I','França','fr'),       ('I','Senegal','sn'),            ('I','Iraque','iq'),         ('I','Noruega','no'),
  ('J','Argentina','ar'),    ('J','Argélia','dz'),            ('J','Áustria','at'),        ('J','Jordânia','jo'),
  ('K','Portugal','pt'),     ('K','Rep. Dem. do Congo','cd'), ('K','Uzbequistão','uz'),    ('K','Colômbia','co'),
  ('L','Inglaterra','gb-eng'),('L','Croácia','hr'),           ('L','Gana','gh'),           ('L','Panamá','pa')
ON CONFLICT DO NOTHING;

-- ── jogos_copa (104 jogos) ───────────────────────────────────

-- Fase de Grupos (GS) ─────────────────────────────────────────
INSERT INTO public.jogos_copa (numero_jogo,fase,grupo,rodada,data,horario,time_a,time_b,codigo_pais_a,codigo_pais_b,estadio,cidade,pais_sede) VALUES
(1,'GS','A',1,'2026-06-11','16:00','México','África do Sul','mx','za','Estadio Azteca','Cidade do México','MEX'),
(2,'GS','A',1,'2026-06-11','23:00','Coreia do Sul','Tchéquia','kr','cz','Estadio Akron','Zapopan','MEX'),
(3,'GS','B',1,'2026-06-12','16:00','Canadá','Bósnia e Herzegovina','ca','ba','BMO Field','Toronto','CAN'),
(4,'GS','D',1,'2026-06-12','22:00','EUA','Paraguai','us','py','SoFi Stadium','Los Angeles','USA'),
(5,'GS','B',1,'2026-06-13','16:00','Catar','Suíça','qa','ch','Levi''s Stadium','Santa Clara','USA'),
(6,'GS','C',1,'2026-06-13','19:00','Brasil','Marrocos','br','ma','MetLife Stadium','Nova Jersey','USA'),
(7,'GS','C',1,'2026-06-13','22:00','Haiti','Escócia','ht','gb-sct','Gillette Stadium','Foxborough','USA'),
(8,'GS','D',1,'2026-06-14','01:00','Austrália','Turquia','au','tr','BC Place','Vancouver','CAN'),
(9,'GS','E',1,'2026-06-14','14:00','Alemanha','Curaçao','de','cw','NRG Stadium','Houston','USA'),
(10,'GS','F',1,'2026-06-14','17:00','Holanda','Japão','nl','jp','AT&T Stadium','Arlington','USA'),
(11,'GS','E',1,'2026-06-14','20:00','Costa do Marfim','Equador','ci','ec','Lincoln Financial Field','Filadélfia','USA'),
(12,'GS','F',1,'2026-06-14','23:00','Suécia','Tunísia','se','tn','Estadio BBVA','Monterrey','MEX'),
(13,'GS','H',1,'2026-06-15','13:00','Espanha','Cabo Verde','es','cv','Mercedes-Benz Stadium','Atlanta','USA'),
(14,'GS','G',1,'2026-06-15','16:00','Bélgica','Egito','be','eg','Lumen Field','Seattle','USA'),
(15,'GS','H',1,'2026-06-15','19:00','Arábia Saudita','Uruguai','sa','uy','Hard Rock Stadium','Miami Gardens','USA'),
(16,'GS','G',1,'2026-06-15','22:00','Irã','Nova Zelândia','ir','nz','SoFi Stadium','Los Angeles','USA'),
(17,'GS','I',1,'2026-06-16','16:00','França','Senegal','fr','sn','MetLife Stadium','Nova Jersey','USA'),
(18,'GS','I',1,'2026-06-16','19:00','Iraque','Noruega','iq','no','Gillette Stadium','Foxborough','USA'),
(19,'GS','J',1,'2026-06-16','22:00','Argentina','Argélia','ar','dz','Arrowhead Stadium','Kansas City','USA'),
(20,'GS','J',1,'2026-06-17','01:00','Áustria','Jordânia','at','jo','Levi''s Stadium','Santa Clara','USA'),
(21,'GS','K',1,'2026-06-17','14:00','Portugal','Rep. Dem. do Congo','pt','cd','NRG Stadium','Houston','USA'),
(22,'GS','L',1,'2026-06-17','17:00','Inglaterra','Croácia','gb-eng','hr','AT&T Stadium','Arlington','USA'),
(23,'GS','L',1,'2026-06-17','20:00','Gana','Panamá','gh','pa','BMO Field','Toronto','CAN'),
(24,'GS','K',1,'2026-06-17','23:00','Uzbequistão','Colômbia','uz','co','Estadio Azteca','Cidade do México','MEX'),
(25,'GS','A',2,'2026-06-18','13:00','Tchéquia','África do Sul','cz','za','Mercedes-Benz Stadium','Atlanta','USA'),
(26,'GS','B',2,'2026-06-18','16:00','Suíça','Bósnia e Herzegovina','ch','ba','SoFi Stadium','Los Angeles','USA'),
(27,'GS','B',2,'2026-06-18','19:00','Canadá','Catar','ca','qa','BC Place','Vancouver','CAN'),
(28,'GS','A',2,'2026-06-18','22:00','México','Coreia do Sul','mx','kr','Estadio Akron','Zapopan','MEX'),
(29,'GS','D',2,'2026-06-19','16:00','EUA','Austrália','us','au','Lumen Field','Seattle','USA'),
(30,'GS','C',2,'2026-06-19','19:00','Escócia','Marrocos','gb-sct','ma','Gillette Stadium','Foxborough','USA'),
(31,'GS','C',2,'2026-06-19','21:30','Brasil','Haiti','br','ht','Lincoln Financial Field','Filadélfia','USA'),
(32,'GS','D',2,'2026-06-20','00:00','Turquia','Paraguai','tr','py','Levi''s Stadium','Santa Clara','USA'),
(33,'GS','F',2,'2026-06-20','14:00','Holanda','Suécia','nl','se','NRG Stadium','Houston','USA'),
(34,'GS','E',2,'2026-06-20','17:00','Alemanha','Costa do Marfim','de','ci','BMO Field','Toronto','CAN'),
(35,'GS','E',2,'2026-06-20','21:00','Equador','Curaçao','ec','cw','Arrowhead Stadium','Kansas City','USA'),
(36,'GS','F',2,'2026-06-21','01:00','Tunísia','Japão','tn','jp','Estadio BBVA','Monterrey','MEX'),
(37,'GS','H',2,'2026-06-21','13:00','Espanha','Arábia Saudita','es','sa','Mercedes-Benz Stadium','Atlanta','USA'),
(38,'GS','G',2,'2026-06-21','16:00','Bélgica','Irã','be','ir','SoFi Stadium','Los Angeles','USA'),
(39,'GS','H',2,'2026-06-21','19:00','Uruguai','Cabo Verde','uy','cv','Hard Rock Stadium','Miami Gardens','USA'),
(40,'GS','G',2,'2026-06-21','22:00','Nova Zelândia','Egito','nz','eg','BC Place','Vancouver','CAN'),
(41,'GS','J',2,'2026-06-22','14:00','Argentina','Áustria','ar','at','AT&T Stadium','Arlington','USA'),
(42,'GS','I',2,'2026-06-22','18:00','França','Iraque','fr','iq','Lincoln Financial Field','Filadélfia','USA'),
(43,'GS','I',2,'2026-06-22','21:00','Noruega','Senegal','no','sn','MetLife Stadium','Nova Jersey','USA'),
(44,'GS','J',2,'2026-06-22','00:00','Jordânia','Argélia','jo','dz','Levi''s Stadium','Santa Clara','USA'),
(45,'GS','K',2,'2026-06-23','14:00','Portugal','Uzbequistão','pt','uz','NRG Stadium','Houston','USA'),
(46,'GS','L',2,'2026-06-23','17:00','Inglaterra','Gana','gb-eng','gh','Gillette Stadium','Foxborough','USA'),
(47,'GS','L',2,'2026-06-23','20:00','Panamá','Croácia','pa','hr','BMO Field','Toronto','CAN'),
(48,'GS','K',2,'2026-06-23','23:00','Colômbia','Rep. Dem. do Congo','co','cd','Estadio Akron','Zapopan','MEX'),
(49,'GS','B',3,'2026-06-24','16:00','Suíça','Canadá','ch','ca','BC Place','Vancouver','CAN'),
(50,'GS','B',3,'2026-06-24','16:00','Bósnia e Herzegovina','Catar','ba','qa','Lumen Field','Seattle','USA'),
(51,'GS','C',3,'2026-06-24','19:00','Escócia','Brasil','gb-sct','br','Hard Rock Stadium','Miami Gardens','USA'),
(52,'GS','C',3,'2026-06-24','19:00','Marrocos','Haiti','ma','ht','Mercedes-Benz Stadium','Atlanta','USA'),
(53,'GS','A',3,'2026-06-24','22:00','Tchéquia','México','cz','mx','Estadio Azteca','Cidade do México','MEX'),
(54,'GS','A',3,'2026-06-24','22:00','África do Sul','Coreia do Sul','za','kr','Estadio BBVA','Monterrey','MEX'),
(55,'GS','E',3,'2026-06-25','17:00','Curaçao','Costa do Marfim','cw','ci','Lincoln Financial Field','Filadélfia','USA'),
(56,'GS','E',3,'2026-06-25','17:00','Equador','Alemanha','ec','de','MetLife Stadium','Nova Jersey','USA'),
(57,'GS','F',3,'2026-06-25','20:00','Japão','Suécia','jp','se','AT&T Stadium','Arlington','USA'),
(58,'GS','F',3,'2026-06-25','20:00','Tunísia','Holanda','tn','nl','Arrowhead Stadium','Kansas City','USA'),
(59,'GS','D',3,'2026-06-25','23:00','Turquia','EUA','tr','us','SoFi Stadium','Los Angeles','USA'),
(60,'GS','D',3,'2026-06-25','23:00','Paraguai','Austrália','py','au','Levi''s Stadium','Santa Clara','USA'),
(61,'GS','I',3,'2026-06-26','16:00','Noruega','França','no','fr','Gillette Stadium','Foxborough','USA'),
(62,'GS','I',3,'2026-06-26','16:00','Senegal','Iraque','sn','iq','BMO Field','Toronto','CAN'),
(63,'GS','H',3,'2026-06-26','21:00','Cabo Verde','Arábia Saudita','cv','sa','NRG Stadium','Houston','USA'),
(64,'GS','H',3,'2026-06-26','21:00','Uruguai','Espanha','uy','es','Estadio Akron','Zapopan','MEX'),
(65,'GS','G',3,'2026-06-26','00:00','Egito','Irã','eg','ir','Lumen Field','Seattle','USA'),
(66,'GS','G',3,'2026-06-26','00:00','Nova Zelândia','Bélgica','nz','be','BC Place','Vancouver','CAN'),
(67,'GS','L',3,'2026-06-27','18:00','Panamá','Inglaterra','pa','gb-eng','MetLife Stadium','Nova Jersey','USA'),
(68,'GS','L',3,'2026-06-27','18:00','Croácia','Gana','hr','gh','Lincoln Financial Field','Filadélfia','USA'),
(69,'GS','K',3,'2026-06-27','20:30','Colômbia','Portugal','co','pt','Hard Rock Stadium','Miami Gardens','USA'),
(70,'GS','K',3,'2026-06-27','20:30','Rep. Dem. do Congo','Uzbequistão','cd','uz','Mercedes-Benz Stadium','Atlanta','USA'),
(71,'GS','J',3,'2026-06-27','23:00','Argélia','Áustria','dz','at','Arrowhead Stadium','Kansas City','USA'),
(72,'GS','J',3,'2026-06-27','23:00','Jordânia','Argentina','jo','ar','AT&T Stadium','Arlington','USA')
ON CONFLICT DO NOTHING;

-- R32 ─────────────────────────────────────────────────────────
INSERT INTO public.jogos_copa (numero_jogo,fase,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(73,'R32','2026-06-28','16:00','2º Grupo A','2º Grupo B','SoFi Stadium','Los Angeles','USA'),
(74,'R32','2026-06-29','17:30','1º Grupo E','Melhor 3º (A/B/C/D/F)','Gillette Stadium','Foxborough','USA'),
(75,'R32','2026-06-29','22:00','1º Grupo F','2º Grupo C','Estadio BBVA','Monterrey','MEX'),
(76,'R32','2026-06-29','14:00','1º Grupo C','2º Grupo F','NRG Stadium','Houston','USA'),
(77,'R32','2026-06-30','18:00','1º Grupo I','Melhor 3º (C/D/F/G/H)','MetLife Stadium','Nova Jersey','USA'),
(78,'R32','2026-06-30','14:00','2º Grupo E','2º Grupo I','AT&T Stadium','Arlington','USA'),
(79,'R32','2026-06-30','22:00','1º Grupo A','Melhor 3º (C/E/F/H/I)','Estadio Azteca','Cidade do México','MEX'),
(80,'R32','2026-07-01','13:00','1º Grupo L','Melhor 3º (E/H/I/J/K)','Mercedes-Benz Stadium','Atlanta','USA'),
(81,'R32','2026-07-01','21:00','1º Grupo D','Melhor 3º (B/E/F/I/J)','Levi''s Stadium','Santa Clara','USA'),
(82,'R32','2026-07-01','17:00','1º Grupo G','Melhor 3º (A/E/H/I/J)','Lumen Field','Seattle','USA'),
(83,'R32','2026-07-02','20:00','2º Grupo K','2º Grupo L','BMO Field','Toronto','CAN'),
(84,'R32','2026-07-02','16:00','1º Grupo H','2º Grupo J','SoFi Stadium','Los Angeles','USA'),
(85,'R32','2026-07-02','00:00','1º Grupo B','Melhor 3º (E/F/G/I/J)','BC Place','Vancouver','CAN'),
(86,'R32','2026-07-03','19:00','1º Grupo J','2º Grupo H','Hard Rock Stadium','Miami Gardens','USA'),
(87,'R32','2026-07-03','22:30','1º Grupo K','Melhor 3º (D/E/I/J/L)','Arrowhead Stadium','Kansas City','USA'),
(88,'R32','2026-07-03','15:00','2º Grupo D','2º Grupo G','AT&T Stadium','Arlington','USA')
ON CONFLICT DO NOTHING;

-- R16 ─────────────────────────────────────────────────────────
INSERT INTO public.jogos_copa (numero_jogo,fase,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(89,'R16','2026-07-04','18:00','Vencedor Jogo 74','Vencedor Jogo 77','Lincoln Financial Field','Filadélfia','USA'),
(90,'R16','2026-07-04','14:00','Vencedor Jogo 73','Vencedor Jogo 75','NRG Stadium','Houston','USA'),
(91,'R16','2026-07-05','17:00','Vencedor Jogo 76','Vencedor Jogo 78','MetLife Stadium','Nova Jersey','USA'),
(92,'R16','2026-07-05','21:00','Vencedor Jogo 79','Vencedor Jogo 80','Estadio Azteca','Cidade do México','MEX'),
(93,'R16','2026-07-06','16:00','Vencedor Jogo 83','Vencedor Jogo 84','AT&T Stadium','Arlington','USA'),
(94,'R16','2026-07-06','21:00','Vencedor Jogo 81','Vencedor Jogo 82','Lumen Field','Seattle','USA'),
(95,'R16','2026-07-07','13:00','Vencedor Jogo 86','Vencedor Jogo 88','Mercedes-Benz Stadium','Atlanta','USA'),
(96,'R16','2026-07-07','17:00','Vencedor Jogo 85','Vencedor Jogo 87','BC Place','Vancouver','CAN')
ON CONFLICT DO NOTHING;

-- QF ──────────────────────────────────────────────────────────
INSERT INTO public.jogos_copa (numero_jogo,fase,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(97,'QF','2026-07-09','17:00','Vencedor Jogo 89','Vencedor Jogo 90','Gillette Stadium','Foxborough','USA'),
(98,'QF','2026-07-10','16:00','Vencedor Jogo 93','Vencedor Jogo 94','SoFi Stadium','Los Angeles','USA'),
(99,'QF','2026-07-11','18:00','Vencedor Jogo 91','Vencedor Jogo 92','Hard Rock Stadium','Miami Gardens','USA'),
(100,'QF','2026-07-11','22:00','Vencedor Jogo 95','Vencedor Jogo 96','Arrowhead Stadium','Kansas City','USA')
ON CONFLICT DO NOTHING;

-- SF ──────────────────────────────────────────────────────────
INSERT INTO public.jogos_copa (numero_jogo,fase,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(101,'SF','2026-07-14','16:00','Vencedor Jogo 97','Vencedor Jogo 98','AT&T Stadium','Arlington','USA'),
(102,'SF','2026-07-15','16:00','Vencedor Jogo 99','Vencedor Jogo 100','Mercedes-Benz Stadium','Atlanta','USA')
ON CONFLICT DO NOTHING;

-- TPL + F ─────────────────────────────────────────────────────
INSERT INTO public.jogos_copa (numero_jogo,fase,data,horario,time_a,time_b,estadio,cidade,pais_sede) VALUES
(103,'TPL','2026-07-18','18:00','Perdedor Jogo 101','Perdedor Jogo 102','Hard Rock Stadium','Miami Gardens','USA'),
(104,'F',  '2026-07-19','16:00','Vencedor Jogo 101','Vencedor Jogo 102','MetLife Stadium','Nova Jersey','USA')
ON CONFLICT DO NOTHING;


-- ── palpites_activity_log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.palpites_activity_log (
  id         bigserial   PRIMARY KEY,
  usuario_id uuid        REFERENCES auth.users(id)       ON DELETE SET NULL,
  palpite_id integer     REFERENCES public.palpites(id)   ON DELETE SET NULL,
  jogo_id    integer     REFERENCES public.jogos_copa(id) ON DELETE SET NULL,
  action     text        NOT NULL,
  criado_em  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_criado_em  ON public.palpites_activity_log (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_palpite_id ON public.palpites_activity_log (palpite_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_usuario_id ON public.palpites_activity_log (usuario_id);

-- Acesso apenas via service role (API routes) — sem políticas client-side
ALTER TABLE public.palpites_activity_log ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════
-- Esperado: GS=72, R32=16, R16=8, QF=4, SF=2, TPL=1, F=1 → total 104
SELECT fase, COUNT(*) as jogos FROM public.jogos_copa GROUP BY fase
ORDER BY ARRAY_POSITION(ARRAY['GS','R32','R16','QF','SF','TPL','F'], fase);

-- Esperado: 35 linhas (7 fases × 5 tipos)
SELECT COUNT(*) as config_pontuacao FROM public.configuracoes_pontuacao;

-- Esperado: 48 seleções
SELECT COUNT(*) as sele_oes FROM public.classificacao_grupos;
