-- Migration 38: custo real de IA por boletim
--
-- A página de balanço estimava o custo do boletim com uma fórmula fixa
-- (~650 input + ~450 output tokens, preços de Opus) — nem o modelo nem a
-- contagem de tokens batiam com a realidade (o prompt cresceu bastante desde
-- então: artilharia, retrospecto de times, boletins recentes, etc.).
--
-- Agora capturamos os tokens reais de cada chamada (message.usage da API da
-- Anthropic) e calculamos o custo em USD com os preços reais por modelo no
-- momento da geração — sem depender de estimativa.

ALTER TABLE public.boletim_copa
  ADD COLUMN IF NOT EXISTS tokens_input_sonnet  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output_sonnet integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_input_haiku   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output_haiku  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_usd            numeric(10,6) NOT NULL DEFAULT 0;
