-- ============================================================
-- Bolão Copa 2026 — Table definitions
-- Run in Supabase SQL Editor
-- ============================================================

-- Users (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text UNIQUE NOT NULL,
  nome         text NOT NULL,
  telefone     text,
  is_admin     boolean DEFAULT false,
  criado_em    timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- World Cup matches
CREATE TABLE IF NOT EXISTS public.jogos_copa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase          text NOT NULL CHECK (fase IN ('grupos','oitavas','quartas','semis','final')),
  grupo         text,
  rodada        integer NOT NULL,
  data          date NOT NULL,
  horario       time NOT NULL,
  time_a        text NOT NULL,
  time_b        text NOT NULL,
  codigo_pais_a text NOT NULL,
  codigo_pais_b text NOT NULL,
  estadio       text NOT NULL,
  cidade        text NOT NULL,
  criado_em     timestamptz DEFAULT now()
);

-- Match results
CREATE TABLE IF NOT EXISTS public.resultados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id         uuid UNIQUE NOT NULL REFERENCES public.jogos_copa(id) ON DELETE CASCADE,
  placar_real_a   integer NOT NULL,
  placar_real_b   integer NOT NULL,
  artilheiro_copa text,
  inserido_em     timestamptz DEFAULT now(),
  atualizado_em   timestamptz DEFAULT now()
);

-- Prediction entries
CREATE TABLE IF NOT EXISTS public.palpites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  status        text NOT NULL DEFAULT 'inativo' CHECK (status IN ('ativo','inativo')),
  campeao       text DEFAULT '',
  vice_campeao  text DEFAULT '',
  artilheiro    text DEFAULT '',
  json_backup   jsonb,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- Prediction scores per game
CREATE TABLE IF NOT EXISTS public.palpites_jogos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palpite_id       uuid NOT NULL REFERENCES public.palpites(id) ON DELETE CASCADE,
  jogo_id          uuid NOT NULL REFERENCES public.jogos_copa(id) ON DELETE CASCADE,
  placar_palpite_a integer,
  placar_palpite_b integer,
  pontos           integer DEFAULT 0,
  criado_em        timestamptz DEFAULT now(),
  atualizado_em    timestamptz DEFAULT now(),
  UNIQUE (palpite_id, jogo_id)
);

-- Scoring configuration
CREATE TABLE IF NOT EXISTS public.configuracoes_pontuacao (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase         text NOT NULL,
  tipo_acerto  text NOT NULL CHECK (tipo_acerto IN ('placar_exato','vencedor')),
  pontos       integer NOT NULL,
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE (fase, tipo_acerto)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogos_copa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palpites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palpites_jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_pontuacao ENABLE ROW LEVEL SECURITY;

-- users: anyone can read, owner can update
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- jogos_copa: public read
CREATE POLICY "jogos_select_all" ON public.jogos_copa FOR SELECT USING (true);
CREATE POLICY "jogos_admin_write" ON public.jogos_copa FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- resultados: public read, admin write
CREATE POLICY "resultados_select_all" ON public.resultados FOR SELECT USING (true);
CREATE POLICY "resultados_admin_write" ON public.resultados FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- palpites: owner and admin
CREATE POLICY "palpites_select_own" ON public.palpites FOR SELECT USING (
  auth.uid() = usuario_id OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "palpites_select_ativo" ON public.palpites FOR SELECT USING (status = 'ativo');
CREATE POLICY "palpites_insert_own" ON public.palpites FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "palpites_update_own" ON public.palpites FOR UPDATE USING (
  auth.uid() = usuario_id OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- palpites_jogos: owner and admin
CREATE POLICY "palpites_jogos_select" ON public.palpites_jogos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.palpites p WHERE p.id = palpite_id AND (p.usuario_id = auth.uid() OR p.status = 'ativo'))
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "palpites_jogos_write" ON public.palpites_jogos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.palpites p WHERE p.id = palpite_id AND p.usuario_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- configuracoes_pontuacao: public read, admin write
CREATE POLICY "config_select_all" ON public.configuracoes_pontuacao FOR SELECT USING (true);
CREATE POLICY "config_admin_write" ON public.configuracoes_pontuacao FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
