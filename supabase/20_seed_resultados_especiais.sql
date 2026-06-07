-- Migration 20: garante que a linha inicial de resultados_especiais existe
-- Esta linha única (id=1) deve existir antes de qualquer upsert do admin.
-- O ON CONFLICT DO NOTHING é seguro — não altera dados já existentes.

INSERT INTO public.resultados_especiais (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
