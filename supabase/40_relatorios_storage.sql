-- Bucket privado para os relatórios finais em PDF (um por palpite), pré-gerados
-- em lote após o fim da Copa. Nunca público — acesso só via server-side
-- (service role), que a rota /api/pesquisa/relatorio já protege com
-- autenticação + dono do palpite antes de servir o arquivo.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'relatorios',
  'relatorios',
  false,
  5242880,                       -- 5 MB por arquivo, folga generosa
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Sem políticas de RLS pra authenticated/anon — só o service role (que
-- ignora RLS) lê e escreve neste bucket, via a rota da API e o script de
-- geração em lote.
