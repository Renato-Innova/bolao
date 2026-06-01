export interface User {
  id: string
  email: string
  nome: string
  telefone?: string
  is_admin: boolean
  criado_em: string
  atualizado_em: string
}

export interface JogoCopa {
  id: string
  fase: 'grupos' | 'oitavas' | 'quartas' | 'semis' | 'final'
  grupo?: string
  rodada: number
  data: string
  horario: string
  time_a: string
  time_b: string
  codigo_pais_a: string
  codigo_pais_b: string
  estadio: string
  cidade: string
  criado_em: string
  resultado?: Resultado
}

export interface Resultado {
  id: string
  jogo_id: string
  placar_real_a: number
  placar_real_b: number
  artilheiro_copa?: string
  inserido_em: string
  atualizado_em: string
}

export interface Palpite {
  id: string
  usuario_id: string
  nome: string
  status: 'ativo' | 'inativo'
  artilheiro: string
  json_backup?: Record<string, unknown>
  criado_em: string
  atualizado_em: string
  usuario?: User
  palpites_jogos?: PalpiteJogo[]
}

export interface PalpiteJogo {
  id: string
  palpite_id: string
  jogo_id: string
  placar_palpite_a?: number
  placar_palpite_b?: number
  pontos: number
  submitted_at?: string | null
  criado_em: string
  atualizado_em: string
  jogo?: JogoCopa
}

export interface ConfiguracaoPontuacao {
  id: string
  fase: string
  tipo_acerto: 'placar_exato' | 'vencedor'
  pontos: number
  atualizado_em: string
}

export interface RankingEntry {
  posicao: number
  palpite_id: string
  nome: string
  usuario_nome: string
  usuario_id: string
  total_pontos: number
  acertos_exatos: number
  acertos_vencedor: number
  variacao: number
}

export interface GrupoStanding {
  grupo: string
  times: TeamStanding[]
}

export interface TeamStanding {
  time: string
  codigo_pais: string
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  gols_pro: number
  gols_contra: number
  saldo_gols: number
  pontos: number
}
