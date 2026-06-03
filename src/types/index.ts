export interface User {
  id: string           // UUID — auth.users
  email: string
  nome: string
  telefone?: string
  is_admin: boolean
  criado_em: string
  atualizado_em: string
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
  artilheiro_copa?: string
  inserido_em: string
  atualizado_em: string
}

export interface Palpite {
  id: number           // SERIAL
  usuario_id: string   // UUID — foreign key to users
  nome: string
  status: 'ativo' | 'inativo'
  artilheiro?: string
  melhor_jogador?: string
  melhor_goleiro?: string
  json_backup?: Record<string, unknown>
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
  pontos: number
  submitted_at?: string | null
  criado_em: string
  atualizado_em: string
  jogo?: JogoCopa
}

export interface ConfiguracaoPontuacao {
  id: number           // SERIAL
  fase: string
  tipo_acerto: 'placar_exato' | 'vencedor'
  pontos: number
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
  variacao: number
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
