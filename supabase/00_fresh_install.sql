-- ============================================================
-- Bolão Copa 2026 — FRESH INSTALL (schema completo)
-- GERADO AUTOMATICAMENTE por introspecção do banco de produção
-- (scripts/infra/generate-fresh-install.mjs) — não editar manualmente
-- sem regenerar; reflete o estado real do banco em 2026-06-22.
--
-- Cole este arquivo inteiro no Supabase SQL Editor e execute.
-- Idempotente: usa IF NOT EXISTS / OR REPLACE / DROP+CREATE em todo lugar.
-- pg_cron precisa estar habilitado em Dashboard → Database → Extensions.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- SEQUENCES (precisam existir antes das tabelas que as usam como default)
-- ═══════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS public."boletim_copa_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."jogos_copa_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."classificacao_grupos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."resultados_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."palpites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."palpites_jogos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."configuracoes_pontuacao_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."ranking_historico_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."palpites_activity_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."ranking_historico_completo_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public."enquete_votos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;

-- ═══════════════════════════════════════════════════════════════
-- TABELAS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public."artilheiros_copa" (
  "id" integer NOT NULL,
  "jogador" text NOT NULL,
  "seleção" text NOT NULL,
  "escudo_url" text,
  "gols" integer DEFAULT 0 NOT NULL,
  "assistencias" integer DEFAULT 0 NOT NULL,
  "penaltis" integer DEFAULT 0 NOT NULL,
  "jogos" integer DEFAULT 0 NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."boletim_copa" (
  "id" integer DEFAULT nextval('boletim_copa_id_seq'::regclass) NOT NULL,
  "tipo" text NOT NULL,
  "titulo" text NOT NULL,
  "conteudo" text NOT NULL,
  "gerado_em" timestamp with time zone DEFAULT now() NOT NULL,
  "prompt_texto" text,
  "auditoria" text,
  "conteudo_original" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."classificacao_grupos" (
  "id" integer DEFAULT nextval('classificacao_grupos_id_seq'::regclass) NOT NULL,
  "grupo" text NOT NULL,
  "pais_nome" text NOT NULL,
  "pais_codigo" text NOT NULL,
  "j" integer DEFAULT 0,
  "c" integer DEFAULT 0,
  "e" integer DEFAULT 0,
  "d" integer DEFAULT 0,
  "m" integer DEFAULT 0,
  "s" integer DEFAULT 0,
  "dg" integer DEFAULT 0,
  "pts" integer DEFAULT 0,
  "ultimos_resultados" text DEFAULT ''::text,
  "atualizado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."configuracoes_pontuacao" (
  "id" integer DEFAULT nextval('configuracoes_pontuacao_id_seq'::regclass) NOT NULL,
  "fase" text NOT NULL,
  "tipo_acerto" text NOT NULL,
  "pontos" integer NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "configuracoes_pontuacao_fase_tipo_acerto_key" UNIQUE ("fase", "tipo_acerto")
);

CREATE TABLE IF NOT EXISTS public."configuracoes_sistema" (
  "id" integer DEFAULT 1 NOT NULL,
  "especiais_deadline" timestamp with time zone,
  "novo_palpite_deadline" timestamp with time zone,
  "minutos_lock_jogo" integer DEFAULT 60,
  "atualizado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."enquete_config" (
  "id" integer DEFAULT 1 NOT NULL,
  "aberta" boolean DEFAULT false NOT NULL,
  "resultado_visivel" boolean DEFAULT false NOT NULL,
  "atualizado_em" timestamp with time zone DEFAULT now(),
  "decisao_titulo" text,
  "decisao_texto" text,
  "decisao_visivel" boolean DEFAULT false NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."enquete_votos" (
  "id" integer DEFAULT nextval('enquete_votos_id_seq'::regclass) NOT NULL,
  "usuario_id" uuid NOT NULL,
  "opcao" text NOT NULL,
  "votado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "enquete_votos_usuario_id_key" UNIQUE ("usuario_id")
);

CREATE TABLE IF NOT EXISTS public."palpites_activity_log" (
  "id" bigint DEFAULT nextval('palpites_activity_log_id_seq'::regclass) NOT NULL,
  "usuario_id" uuid,
  "palpite_id" integer,
  "jogo_id" integer,
  "action" text NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."palpites_jogos" (
  "id" integer DEFAULT nextval('palpites_jogos_id_seq'::regclass) NOT NULL,
  "palpite_id" integer,
  "jogo_id" integer,
  "placar_palpite_a" integer,
  "placar_palpite_b" integer,
  "pontos" integer DEFAULT 0,
  "submitted_at" timestamp with time zone,
  "criado_em" timestamp with time zone DEFAULT now(),
  "atualizado_em" timestamp with time zone DEFAULT now(),
  "placar_penalti_a" integer,
  "placar_penalti_b" integer,
  PRIMARY KEY ("id"),
  CONSTRAINT "palpites_jogos_palpite_id_jogo_id_key" UNIQUE ("palpite_id", "jogo_id")
);

CREATE TABLE IF NOT EXISTS public."ranking_historico" (
  "id" integer DEFAULT nextval('ranking_historico_id_seq'::regclass) NOT NULL,
  "palpite_id" integer NOT NULL,
  "data" date NOT NULL,
  "total_pontos" integer DEFAULT 0 NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "ranking_historico_palpite_id_data_key" UNIQUE ("palpite_id", "data")
);

CREATE TABLE IF NOT EXISTS public."ranking_historico_completo" (
  "id" integer DEFAULT nextval('ranking_historico_completo_id_seq'::regclass) NOT NULL,
  "palpite_id" integer NOT NULL,
  "data" date NOT NULL,
  "posicao" integer NOT NULL,
  "total_pontos" integer DEFAULT 0 NOT NULL,
  "acertos_exatos" integer DEFAULT 0 NOT NULL,
  "criado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "ranking_historico_completo_palpite_id_data_key" UNIQUE ("palpite_id", "data")
);

CREATE TABLE IF NOT EXISTS public."resultados" (
  "id" integer DEFAULT nextval('resultados_id_seq'::regclass) NOT NULL,
  "jogo_id" integer,
  "placar_real_a" integer,
  "placar_real_b" integer,
  "artilheiro_copa" text,
  "inserido_em" timestamp with time zone DEFAULT now(),
  "atualizado_em" timestamp with time zone DEFAULT now(),
  "placar_penalti_a" integer,
  "placar_penalti_b" integer,
  PRIMARY KEY ("id"),
  CONSTRAINT "resultados_jogo_id_key" UNIQUE ("jogo_id")
);

CREATE TABLE IF NOT EXISTS public."resultados_especiais" (
  "id" integer DEFAULT 1 NOT NULL,
  "campeao" text,
  "vice_campeao" text,
  "artilheiro" text,
  "melhor_jogador" text,
  "melhor_goleiro" text,
  "atualizado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."palpites" (
  "id" integer DEFAULT nextval('palpites_id_seq'::regclass) NOT NULL,
  "usuario_id" uuid,
  "nome" text NOT NULL,
  "status" text DEFAULT 'inativo'::text,
  "artilheiro" text,
  "json_backup" jsonb,
  "criado_em" timestamp with time zone DEFAULT now(),
  "atualizado_em" timestamp with time zone DEFAULT now(),
  "pontos_especiais" integer DEFAULT 0 NOT NULL,
  "pontos_classificacao" integer DEFAULT 0 NOT NULL,
  "campeao" text,
  "vice_campeao" text,
  "melhor_jogador" text,
  "melhor_goleiro" text,
  "avatar_type" text DEFAULT 'initials'::text,
  "avatar_value" text,
  PRIMARY KEY ("id"),
  CONSTRAINT "palpites_nome_unique" UNIQUE ("nome")
);

CREATE TABLE IF NOT EXISTS public."jogos_copa" (
  "id" integer DEFAULT nextval('jogos_copa_id_seq'::regclass) NOT NULL,
  "numero_jogo" integer,
  "fase" text NOT NULL,
  "grupo" text,
  "rodada" integer,
  "data" date NOT NULL,
  "horario" time without time zone NOT NULL,
  "time_a" text NOT NULL,
  "time_b" text NOT NULL,
  "codigo_pais_a" text,
  "codigo_pais_b" text,
  "estadio" text,
  "cidade" text,
  "pais_sede" text,
  "criado_em" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."users" (
  "id" uuid NOT NULL,
  "email" text NOT NULL,
  "nome" text NOT NULL,
  "telefone" text,
  "is_admin" boolean DEFAULT false,
  "criado_em" timestamp with time zone DEFAULT now(),
  "atualizado_em" timestamp with time zone DEFAULT now(),
  "is_operador" boolean DEFAULT false NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "users_email_key" UNIQUE ("email")
);

-- ═══════════════════════════════════════════════════════════════
-- FOREIGN KEYS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public."enquete_votos" ADD CONSTRAINT "enquete_votos_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."palpites" ADD CONSTRAINT "palpites_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public."palpites_activity_log" ADD CONSTRAINT "palpites_activity_log_jogo_id_fkey" FOREIGN KEY (jogo_id) REFERENCES jogos_copa(id) ON DELETE SET NULL;
ALTER TABLE public."palpites_activity_log" ADD CONSTRAINT "palpites_activity_log_palpite_id_fkey" FOREIGN KEY (palpite_id) REFERENCES palpites(id) ON DELETE SET NULL;
ALTER TABLE public."palpites_activity_log" ADD CONSTRAINT "palpites_activity_log_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."palpites_jogos" ADD CONSTRAINT "palpites_jogos_jogo_id_fkey" FOREIGN KEY (jogo_id) REFERENCES jogos_copa(id) ON DELETE CASCADE;
ALTER TABLE public."palpites_jogos" ADD CONSTRAINT "palpites_jogos_palpite_id_fkey" FOREIGN KEY (palpite_id) REFERENCES palpites(id) ON DELETE CASCADE;
ALTER TABLE public."ranking_historico" ADD CONSTRAINT "ranking_historico_palpite_id_fkey" FOREIGN KEY (palpite_id) REFERENCES palpites(id) ON DELETE CASCADE;
ALTER TABLE public."ranking_historico_completo" ADD CONSTRAINT "ranking_historico_completo_palpite_id_fkey" FOREIGN KEY (palpite_id) REFERENCES palpites(id) ON DELETE CASCADE;
ALTER TABLE public."resultados" ADD CONSTRAINT "resultados_jogo_id_fkey" FOREIGN KEY (jogo_id) REFERENCES jogos_copa(id) ON DELETE CASCADE;
ALTER TABLE public."users" ADD CONSTRAINT "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════
-- ÍNDICES
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_boletim_tipo_gerado ON public.boletim_copa USING btree (tipo, gerado_em DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_criado_em ON public.palpites_activity_log USING btree (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_palpite_id ON public.palpites_activity_log USING btree (palpite_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_usuario_id ON public.palpites_activity_log USING btree (usuario_id);
CREATE INDEX IF NOT EXISTS idx_ranking_historico_data ON public.ranking_historico USING btree (data);
CREATE INDEX IF NOT EXISTS idx_ranking_historico_completo_data ON public.ranking_historico_completo USING btree (data);

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_update_classificacao_grupos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT fase, grupo INTO v_jogo FROM jogos_copa WHERE id = v_jogo_id;

  -- Only process group-stage games (fase = 'GS')
  IF v_jogo.fase IS DISTINCT FROM 'GS' OR v_jogo.grupo IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_grupo := v_jogo.grupo;

  -- Reset all four teams in this group to zero
  UPDATE classificacao_grupos
  SET j=0, c=0, e=0, d=0, m=0, s=0, dg=0, pts=0,
      ultimos_resultados='', atualizado_em=NOW()
  WHERE grupo = v_grupo;

  -- Replay every result for this group in chronological order
  FOR v_result IN
    SELECT jc.time_a, jc.time_b, r.placar_real_a, r.placar_real_b
    FROM   jogos_copa jc
    JOIN   resultados r ON r.jogo_id = jc.id
    WHERE  jc.fase = 'GS' AND jc.grupo = v_grupo
    ORDER  BY jc.data ASC, jc.horario ASC
  LOOP
    IF    v_result.placar_real_a > v_result.placar_real_b THEN v_res_a := 'V'; v_res_b := 'D';
    ELSIF v_result.placar_real_a < v_result.placar_real_b THEN v_res_a := 'D'; v_res_b := 'V';
    ELSE                                                        v_res_a := 'E'; v_res_b := 'E';
    END IF;

    -- Update team A
    SELECT ultimos_resultados INTO v_ult
    FROM   classificacao_grupos WHERE grupo = v_grupo AND pais_nome = v_result.time_a;
    v_arr := CASE WHEN TRIM(COALESCE(v_ult,'')) = '' THEN '{}'::TEXT[]
                  ELSE string_to_array(TRIM(v_ult), ' ') END;
    v_arr     := v_arr || ARRAY[v_res_a::TEXT];
    v_arr_len := array_length(v_arr, 1);
    IF v_arr_len > 3 THEN v_arr := v_arr[v_arr_len-2 : v_arr_len]; END IF;
    UPDATE classificacao_grupos SET
      j   = j + 1,
      m   = m + v_result.placar_real_a,
      s   = s + v_result.placar_real_b,
      dg  = dg + (v_result.placar_real_a - v_result.placar_real_b),
      c   = c + CASE WHEN v_res_a = 'V' THEN 1 ELSE 0 END,
      e   = e + CASE WHEN v_res_a = 'E' THEN 1 ELSE 0 END,
      d   = d + CASE WHEN v_res_a = 'D' THEN 1 ELSE 0 END,
      pts = pts + CASE v_res_a WHEN 'V' THEN 3 WHEN 'E' THEN 1 ELSE 0 END,
      ultimos_resultados = array_to_string(v_arr, ' '),
      atualizado_em = NOW()
    WHERE grupo = v_grupo AND pais_nome = v_result.time_a;

    -- Update team B
    SELECT ultimos_resultados INTO v_ult
    FROM   classificacao_grupos WHERE grupo = v_grupo AND pais_nome = v_result.time_b;
    v_arr := CASE WHEN TRIM(COALESCE(v_ult,'')) = '' THEN '{}'::TEXT[]
                  ELSE string_to_array(TRIM(v_ult), ' ') END;
    v_arr     := v_arr || ARRAY[v_res_b::TEXT];
    v_arr_len := array_length(v_arr, 1);
    IF v_arr_len > 3 THEN v_arr := v_arr[v_arr_len-2 : v_arr_len]; END IF;
    UPDATE classificacao_grupos SET
      j   = j + 1,
      m   = m + v_result.placar_real_b,
      s   = s + v_result.placar_real_a,
      dg  = dg + (v_result.placar_real_b - v_result.placar_real_a),
      c   = c + CASE WHEN v_res_b = 'V' THEN 1 ELSE 0 END,
      e   = e + CASE WHEN v_res_b = 'E' THEN 1 ELSE 0 END,
      d   = d + CASE WHEN v_res_b = 'D' THEN 1 ELSE 0 END,
      pts = pts + CASE v_res_b WHEN 'V' THEN 3 WHEN 'E' THEN 1 ELSE 0 END,
      ultimos_resultados = array_to_string(v_arr, ' '),
      atualizado_em = NOW()
    WHERE grupo = v_grupo AND pais_nome = v_result.time_b;

  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_acertos_exatos_por_palpite(p_ids integer[])
 RETURNS TABLE(palpite_id integer, acertos_exatos bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    pj.palpite_id,
    COUNT(*) AS acertos_exatos
  FROM palpites_jogos pj
  JOIN resultados r ON r.jogo_id = pj.jogo_id
  WHERE pj.palpite_id = ANY(p_ids)
    AND pj.submitted_at IS NOT NULL
    AND pj.placar_palpite_a = r.placar_real_a
    AND pj.placar_palpite_b = r.placar_real_b
  GROUP BY pj.palpite_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_pontos_por_palpite(p_ids integer[])
 RETURNS TABLE(palpite_id integer, total_pontos bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT pj.palpite_id, COALESCE(SUM(pj.pontos), 0) AS total_pontos
  FROM palpites_jogos pj
  WHERE pj.palpite_id = ANY(p_ids)
  GROUP BY pj.palpite_id
$function$;

CREATE OR REPLACE FUNCTION public.snapshot_ranking_completo_diario()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  hoje date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  INSERT INTO public.ranking_historico_completo (palpite_id, data, posicao, total_pontos, acertos_exatos)
  SELECT
    base.palpite_id,
    hoje,
    ROW_NUMBER() OVER (ORDER BY base.total_pontos DESC, base.acertos_exatos DESC, base.palpite_id ASC) AS posicao,
    base.total_pontos,
    base.acertos_exatos
  FROM (
    SELECT
      p.id AS palpite_id,
      COALESCE(SUM(pj.pontos), 0)
        + COALESCE(p.pontos_especiais, 0)
        + COALESCE(p.pontos_classificacao, 0) AS total_pontos,
      COALESCE((
        SELECT COUNT(*)
        FROM public.palpites_jogos pj2
        JOIN public.resultados r ON r.jogo_id = pj2.jogo_id
        WHERE pj2.palpite_id = p.id
          AND pj2.submitted_at IS NOT NULL
          AND pj2.placar_palpite_a = r.placar_real_a
          AND pj2.placar_palpite_b = r.placar_real_b
      ), 0) AS acertos_exatos
    FROM public.palpites p
    LEFT JOIN public.palpites_jogos pj ON pj.palpite_id = p.id
    WHERE p.status = 'ativo'
    GROUP BY p.id
  ) base
  ON CONFLICT (palpite_id, data)
  DO UPDATE SET
    posicao        = EXCLUDED.posicao,
    total_pontos   = EXCLUDED.total_pontos,
    acertos_exatos = EXCLUDED.acertos_exatos;
END;
$function$;

CREATE OR REPLACE FUNCTION public.snapshot_ranking_diario()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
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
$function$;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS "trg_update_classificacao_grupos" ON public.resultados;
CREATE TRIGGER trg_update_classificacao_grupos AFTER INSERT OR DELETE OR UPDATE ON public.resultados FOR EACH ROW EXECUTE FUNCTION fn_update_classificacao_grupos();

-- ═══════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public."pontuacao_resumo" AS
SELECT cp.fase,
        CASE cp.fase
            WHEN 'GS'::text THEN 'Fase de Grupos'::text
            WHEN 'R32'::text THEN '16 Avos de Final'::text
            WHEN 'R16'::text THEN 'Oitavas de Final'::text
            WHEN 'QF'::text THEN 'Quartas de Final'::text
            WHEN 'SF'::text THEN 'Semifinal'::text
            WHEN 'TPL'::text THEN 'Decisão do 3º Lugar'::text
            WHEN 'F'::text THEN 'Final'::text
            ELSE cp.fase
        END AS fase_label,
    'jogos'::text AS tipo,
    ( SELECT count(*) AS count
           FROM jogos_copa jc
          WHERE (jc.fase = cp.fase)) AS quantidade,
    cp.pontos AS pontos_unitario,
    (( SELECT count(*) AS count
           FROM jogos_copa jc
          WHERE (jc.fase = cp.fase)) * cp.pontos) AS pontos_max
   FROM configuracoes_pontuacao cp
  WHERE (cp.tipo_acerto = 'placar_exato'::text)
UNION ALL
 SELECT 'GS'::text AS fase,
    'Bônus de Classificação'::text AS fase_label,
    'classificacao'::text AS tipo,
    32 AS quantidade,
    cp.pontos AS pontos_unitario,
    (32 * cp.pontos) AS pontos_max
   FROM configuracoes_pontuacao cp
  WHERE ((cp.fase = 'GS'::text) AND (cp.tipo_acerto = 'classificacao'::text))
UNION ALL
 SELECT 'ESP'::text AS fase,
    'Palpites Especiais'::text AS fase_label,
    'especiais'::text AS tipo,
    ( SELECT count(*) AS count
           FROM configuracoes_pontuacao
          WHERE (configuracoes_pontuacao.fase = 'ESP'::text)) AS quantidade,
    0 AS pontos_unitario,
    ( SELECT COALESCE(sum(configuracoes_pontuacao.pontos), (0)::bigint) AS "coalesce"
           FROM configuracoes_pontuacao
          WHERE (configuracoes_pontuacao.fase = 'ESP'::text)) AS pontos_max;

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public."artilheiros_copa" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."boletim_copa" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."classificacao_grupos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."configuracoes_pontuacao" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."configuracoes_sistema" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."enquete_config" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."enquete_votos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."palpites_activity_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."palpites_jogos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."ranking_historico" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."ranking_historico_completo" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."resultados" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."resultados_especiais" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."palpites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."jogos_copa" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_all" ON public."users";
CREATE POLICY "users_select_all" ON public."users" AS PERMISSIVE FOR SELECT TO public USING (true) ;

DROP POLICY IF EXISTS "users_insert_own" ON public."users";
CREATE POLICY "users_insert_own" ON public."users" AS PERMISSIVE FOR INSERT TO public  WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "users_update_own" ON public."users";
CREATE POLICY "users_update_own" ON public."users" AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id)) ;

DROP POLICY IF EXISTS "Service role full access" ON public."ranking_historico";
CREATE POLICY "Service role full access" ON public."ranking_historico" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "enquete_config_select" ON public."enquete_config";
CREATE POLICY "enquete_config_select" ON public."enquete_config" AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

DROP POLICY IF EXISTS "enquete_votos_select_own" ON public."enquete_votos";
CREATE POLICY "enquete_votos_select_own" ON public."enquete_votos" AS PERMISSIVE FOR SELECT TO authenticated USING ((usuario_id = auth.uid())) ;

DROP POLICY IF EXISTS "enquete_votos_insert_own" ON public."enquete_votos";
CREATE POLICY "enquete_votos_insert_own" ON public."enquete_votos" AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK ((usuario_id = auth.uid()));

DROP POLICY IF EXISTS "enquete_votos_update_own" ON public."enquete_votos";
CREATE POLICY "enquete_votos_update_own" ON public."enquete_votos" AS PERMISSIVE FOR UPDATE TO authenticated USING ((usuario_id = auth.uid())) ;

DROP POLICY IF EXISTS "jogos_select_all" ON public."jogos_copa";
CREATE POLICY "jogos_select_all" ON public."jogos_copa" AS PERMISSIVE FOR SELECT TO public USING (true) ;

DROP POLICY IF EXISTS "class_select_all" ON public."classificacao_grupos";
CREATE POLICY "class_select_all" ON public."classificacao_grupos" AS PERMISSIVE FOR SELECT TO public USING (true) ;

DROP POLICY IF EXISTS "resultados_select_all" ON public."resultados";
CREATE POLICY "resultados_select_all" ON public."resultados" AS PERMISSIVE FOR SELECT TO public USING (true) ;

DROP POLICY IF EXISTS "boletim_read_public" ON public."boletim_copa";
CREATE POLICY "boletim_read_public" ON public."boletim_copa" AS PERMISSIVE FOR SELECT TO public USING (true) ;

DROP POLICY IF EXISTS "Service role full access" ON public."ranking_historico_completo";
CREATE POLICY "Service role full access" ON public."ranking_historico_completo" AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "palpites_select" ON public."palpites";
CREATE POLICY "palpites_select" ON public."palpites" AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = usuario_id) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))))) ;

DROP POLICY IF EXISTS "palpites_insert" ON public."palpites";
CREATE POLICY "palpites_insert" ON public."palpites" AS PERMISSIVE FOR INSERT TO public  WITH CHECK ((auth.uid() = usuario_id));

DROP POLICY IF EXISTS "palpites_update" ON public."palpites";
CREATE POLICY "palpites_update" ON public."palpites" AS PERMISSIVE FOR UPDATE TO public USING (((auth.uid() = usuario_id) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))))) ;

DROP POLICY IF EXISTS "palpites_jogos_select" ON public."palpites_jogos";
CREATE POLICY "palpites_jogos_select" ON public."palpites_jogos" AS PERMISSIVE FOR SELECT TO public USING (((EXISTS ( SELECT 1
   FROM palpites p
  WHERE ((p.id = palpites_jogos.palpite_id) AND (p.usuario_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))))) ;

DROP POLICY IF EXISTS "palpites_jogos_write" ON public."palpites_jogos";
CREATE POLICY "palpites_jogos_write" ON public."palpites_jogos" AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM palpites p
  WHERE ((p.id = palpites_jogos.palpite_id) AND (p.usuario_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))))) ;

DROP POLICY IF EXISTS "config_select_all" ON public."configuracoes_pontuacao";
CREATE POLICY "config_select_all" ON public."configuracoes_pontuacao" AS PERMISSIVE FOR SELECT TO public USING (true) ;

DROP POLICY IF EXISTS "artilheiros_select_public" ON public."artilheiros_copa";
CREATE POLICY "artilheiros_select_public" ON public."artilheiros_copa" AS PERMISSIVE FOR SELECT TO public USING (true) ;

DROP POLICY IF EXISTS "admin_manage_resultados" ON public."resultados";
CREATE POLICY "admin_manage_resultados" ON public."resultados" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

DROP POLICY IF EXISTS "admin_update_palpites_jogos" ON public."palpites_jogos";
CREATE POLICY "admin_update_palpites_jogos" ON public."palpites_jogos" AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

DROP POLICY IF EXISTS "admin_update_jogos_copa" ON public."jogos_copa";
CREATE POLICY "admin_update_jogos_copa" ON public."jogos_copa" AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true)))));

DROP POLICY IF EXISTS "user_delete_own_palpite" ON public."palpites";
CREATE POLICY "user_delete_own_palpite" ON public."palpites" AS PERMISSIVE FOR DELETE TO authenticated USING (((usuario_id = auth.uid()) AND (status = 'inativo'::text))) ;

DROP POLICY IF EXISTS "especiais_select_all" ON public."resultados_especiais";
CREATE POLICY "especiais_select_all" ON public."resultados_especiais" AS PERMISSIVE FOR SELECT TO public USING (true) ;

DROP POLICY IF EXISTS "especiais_admin_write" ON public."resultados_especiais";
CREATE POLICY "especiais_admin_write" ON public."resultados_especiais" AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_admin = true))))) ;

DROP POLICY IF EXISTS "leitura_publica_config_sistema" ON public."configuracoes_sistema";
CREATE POLICY "leitura_publica_config_sistema" ON public."configuracoes_sistema" AS PERMISSIVE FOR SELECT TO public USING (true) ;

-- ═══════════════════════════════════════════════════════════════
-- GRANTS (anon + authenticated — RLS é a camada real de restrição)
-- ═══════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- CRON JOBS
-- ═══════════════════════════════════════════════════════════════
SELECT cron.unschedule('snapshot-ranking-diario') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-ranking-diario');
SELECT cron.schedule('snapshot-ranking-diario', '55 2 * * *', 'SELECT public.snapshot_ranking_diario()');

SELECT cron.unschedule('snapshot-ranking-completo-diario') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-ranking-completo-diario');
SELECT cron.schedule('snapshot-ranking-completo-diario', '56 2 * * *', 'SELECT public.snapshot_ranking_completo_diario()');
