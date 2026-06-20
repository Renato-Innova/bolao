export interface User {
  id: string           // UUID — auth.users
  email: string
  nome: string
  telefone?: string
  is_admin: boolean
  criado_em: string
  atualizado_em: string
  last_sign_in_at?: string | null  // merged from auth.users in admin page
}

export interface JogoCopa {
  id: number           // SERIAL
  numero_jogo?: number
  fase: 'GS' | 'R32' | 'R16' | 'QF' | 'SF' | 'TPL' | 'F'
  grupo?: string
  rodada?: number
  data: string
  horario: string
  time_a: string
  time_b: string
  codigo_pais_a?: string
  codigo_pais_b?: string
  estadio?: string
  cidade?: string
  pais_sede?: string
  criado_em: string
  resultado?: Resultado
}

export interface Resultado {
  id: number           // SERIAL
  jogo_id: number
  placar_real_a: number
  placar_real_b: number
  placar_penalti_a?: number | null
  placar_penalti_b?: number | null
  artilheiro_copa?: string
  inserido_em: string
  atualizado_em: string
}

export interface Palpite {
  id: number           // SERIAL
  usuario_id: string   // UUID — foreign key to users
  nome: string
  status: 'ativo' | 'inativo'
  // Special predictions
  campeao?: string
  vice_campeao?: string
  artilheiro?: string
  melhor_jogador?: string
  melhor_goleiro?: string
  // Points earned from special predictions (updated by admin)
  pontos_especiais: number
  // Points earned from correctly predicted group-stage qualifiers (updated by admin)
  pontos_classificacao: number
  json_backup?: Record<string, unknown>
  avatar_type?: string | null
  avatar_value?: string | null
  criado_em: string
  atualizado_em: string
  usuario?: User
  palpites_jogos?: PalpiteJogo[]
}

export interface PalpiteJogo {
  id: number           // SERIAL
  palpite_id: number
  jogo_id: number
  placar_palpite_a?: number
  placar_palpite_b?: number
  placar_penalti_a?: number | null
  placar_penalti_b?: number | null
  pontos: number
  submitted_at?: string | null
  criado_em: string
  atualizado_em: string
  jogo?: JogoCopa
}

export interface ConfiguracaoPontuacao {
  id: number           // SERIAL
  fase: string
  tipo_acerto: 'placar_exato' | 'empate' | 'vencedor' | 'gols_equipe' | 'penalti' | 'classificacao'
    | 'campeao' | 'vice_campeao' | 'artilheiro' | 'melhor_jogador' | 'melhor_goleiro'
  pontos: number
  atualizado_em: string
}

// Official special result — single row table resultados_especiais
export interface ResultadoEspecial {
  id: 1
  campeao: string | null
  vice_campeao: string | null
  artilheiro: string | null
  melhor_jogador: string | null
  melhor_goleiro: string | null
  atualizado_em: string
}

export interface ClassificacaoGrupo {
  id: number
  grupo: string
  pais_nome: string
  pais_codigo: string
  j: number
  c: number
  e: number
  d: number
  m: number
  s: number
  dg: number
  pts: number
  ultimos_resultados: string
  atualizado_em: string
}

export interface RankingEntry {
  posicao: number
  palpite_id: number
  nome: string
  usuario_nome: string
  usuario_id: string   // UUID
  total_pontos: number
  acertos_exatos: number
  acertos_vencedor: number
  variacao: number           // point gain/loss vs yesterday
  variacao_posicao: number   // position change vs yesterday (positive = moved up)
  avatar_type?: string | null
  avatar_value?: string | null
  status?: string | null      // 'ativo' | 'inativo'
}

export interface ActivityLog {
  id: number
  usuario_id: string | null
  palpite_id: number | null
  jogo_id: number | null
  action: string
  criado_em: string
  // joined
  usuario?: { nome: string; email: string } | null
  palpite?: { nome: string } | null
  jogo?: { numero_jogo: number; time_a: string; time_b: string } | null
}

export interface BracketSlot {
  id: number
  palpite_id: number
  jogo_id: number
  time_a: string | null
  time_b: string | null
  codigo_a: string | null
  codigo_b: string | null
  is_valid: boolean
  created_at: string
  updated_at: string
}
