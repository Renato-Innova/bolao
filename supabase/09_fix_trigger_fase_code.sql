-- ============================================================
-- Fix: trigger was checking fase = 'grupos' but the actual
-- code used throughout the app is 'GS'.
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_classificacao_grupos()
RETURNS TRIGGER AS $$
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

  -- Only process group stage games (fase = 'GS')
  IF v_jogo.fase IS DISTINCT FROM 'GS' OR v_jogo.grupo IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_grupo := v_jogo.grupo;

  UPDATE classificacao_grupos
  SET j=0, c=0, e=0, d=0, m=0, s=0, dg=0, pts=0, ultimos_resultados='', atualizado_em=NOW()
  WHERE grupo = v_grupo;

  FOR v_result IN
    SELECT jc.time_a, jc.time_b, r.placar_real_a, r.placar_real_b
    FROM jogos_copa jc
    JOIN resultados r ON r.jogo_id = jc.id
    WHERE jc.fase = 'GS' AND jc.grupo = v_grupo
    ORDER BY jc.data ASC, jc.horario ASC
  LOOP
    IF v_result.placar_real_a > v_result.placar_real_b THEN
      v_res_a := 'V'; v_res_b := 'D';
    ELSIF v_result.placar_real_a < v_result.placar_real_b THEN
      v_res_a := 'D'; v_res_b := 'V';
    ELSE
      v_res_a := 'E'; v_res_b := 'E';
    END IF;

    SELECT ultimos_resultados INTO v_ult
    FROM classificacao_grupos WHERE grupo = v_grupo AND pais_nome = v_result.time_a;
    v_arr := CASE WHEN TRIM(COALESCE(v_ult,'')) = '' THEN '{}'::TEXT[]
                  ELSE string_to_array(TRIM(v_ult), ' ') END;
    v_arr := v_arr || ARRAY[v_res_a::TEXT];
    v_arr_len := array_length(v_arr, 1);
    IF v_arr_len > 3 THEN v_arr := v_arr[v_arr_len-2 : v_arr_len]; END IF;
    UPDATE classificacao_grupos SET
      j=j+1, m=m+v_result.placar_real_a, s=s+v_result.placar_real_b,
      dg=dg+(v_result.placar_real_a-v_result.placar_real_b),
      c=c+CASE WHEN v_res_a='V' THEN 1 ELSE 0 END,
      e=e+CASE WHEN v_res_a='E' THEN 1 ELSE 0 END,
      d=d+CASE WHEN v_res_a='D' THEN 1 ELSE 0 END,
      pts=pts+CASE v_res_a WHEN 'V' THEN 3 WHEN 'E' THEN 1 ELSE 0 END,
      ultimos_resultados=array_to_string(v_arr,' '), atualizado_em=NOW()
    WHERE grupo=v_grupo AND pais_nome=v_result.time_a;

    SELECT ultimos_resultados INTO v_ult
    FROM classificacao_grupos WHERE grupo = v_grupo AND pais_nome = v_result.time_b;
    v_arr := CASE WHEN TRIM(COALESCE(v_ult,'')) = '' THEN '{}'::TEXT[]
                  ELSE string_to_array(TRIM(v_ult), ' ') END;
    v_arr := v_arr || ARRAY[v_res_b::TEXT];
    v_arr_len := array_length(v_arr, 1);
    IF v_arr_len > 3 THEN v_arr := v_arr[v_arr_len-2 : v_arr_len]; END IF;
    UPDATE classificacao_grupos SET
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
$$ LANGUAGE plpgsql;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_update_classificacao_grupos ON resultados;
CREATE TRIGGER trg_update_classificacao_grupos
  AFTER INSERT OR UPDATE OR DELETE ON resultados
  FOR EACH ROW EXECUTE FUNCTION fn_update_classificacao_grupos();
