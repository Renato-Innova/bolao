export const GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export const FASES: Record<string, string> = {
  GS:  'Fase de Grupos',
  R32: '16 Avos de Final',
  R16: 'Oitavas de Final',
  QF:  'Quartas de Final',
  SF:  'Semifinal',
  TPL: 'Decisão do 3º Lugar',
  F:   'Final',
}

// Ordered for display (dropdown, tabs, scoring config)
export const FASES_ORDER = ['GS', 'R32', 'R16', 'QF', 'SF', 'TPL', 'F'] as const
export type FaseCode = typeof FASES_ORDER[number]

export const TEAMS: Record<string, { nome: string; codigo: string }> = {
  // Grupo A
  'México':          { nome: 'México',          codigo: 'mx' },
  'África do Sul':   { nome: 'África do Sul',   codigo: 'za' },
  'Coreia do Sul':   { nome: 'Coreia do Sul',   codigo: 'kr' },
  'Tchéquia':        { nome: 'Tchéquia',        codigo: 'cz' },
  // Grupo B
  'Canadá':                  { nome: 'Canadá',                  codigo: 'ca' },
  'Bósnia e Herzegovina':    { nome: 'Bósnia e Herzegovina',    codigo: 'ba' },
  'Suíça':                   { nome: 'Suíça',                   codigo: 'ch' },
  'Catar':                   { nome: 'Catar',                   codigo: 'qa' },
  // Grupo C
  'Brasil':   { nome: 'Brasil',   codigo: 'br' },
  'Marrocos': { nome: 'Marrocos', codigo: 'ma' },
  'Haiti':    { nome: 'Haiti',    codigo: 'ht' },
  'Escócia':  { nome: 'Escócia',  codigo: 'gb-sct' },
  // Grupo D
  'EUA':       { nome: 'EUA',       codigo: 'us' },
  'Paraguai':  { nome: 'Paraguai',  codigo: 'py' },
  'Austrália': { nome: 'Austrália', codigo: 'au' },
  'Turquia':   { nome: 'Turquia',   codigo: 'tr' },
  // Grupo E
  'Alemanha':        { nome: 'Alemanha',        codigo: 'de' },
  'Curaçao':         { nome: 'Curaçao',         codigo: 'cw' },
  'Costa do Marfim': { nome: 'Costa do Marfim', codigo: 'ci' },
  'Equador':         { nome: 'Equador',         codigo: 'ec' },
  // Grupo F
  'Holanda': { nome: 'Holanda', codigo: 'nl' },
  'Japão':   { nome: 'Japão',   codigo: 'jp' },
  'Suécia':  { nome: 'Suécia',  codigo: 'se' },
  'Tunísia': { nome: 'Tunísia', codigo: 'tn' },
  // Grupo G
  'Bélgica':      { nome: 'Bélgica',      codigo: 'be' },
  'Egito':        { nome: 'Egito',        codigo: 'eg' },
  'Irã':          { nome: 'Irã',          codigo: 'ir' },
  'Nova Zelândia':{ nome: 'Nova Zelândia',codigo: 'nz' },
  // Grupo H
  'Espanha':       { nome: 'Espanha',       codigo: 'es' },
  'Cabo Verde':    { nome: 'Cabo Verde',    codigo: 'cv' },
  'Arábia Saudita':{ nome: 'Arábia Saudita',codigo: 'sa' },
  'Uruguai':       { nome: 'Uruguai',       codigo: 'uy' },
  // Grupo I
  'França':  { nome: 'França',  codigo: 'fr' },
  'Senegal': { nome: 'Senegal', codigo: 'sn' },
  'Iraque':  { nome: 'Iraque',  codigo: 'iq' },
  'Noruega': { nome: 'Noruega', codigo: 'no' },
  // Grupo J
  'Argentina': { nome: 'Argentina', codigo: 'ar' },
  'Argélia':   { nome: 'Argélia',   codigo: 'dz' },
  'Áustria':   { nome: 'Áustria',   codigo: 'at' },
  'Jordânia':  { nome: 'Jordânia',  codigo: 'jo' },
  // Grupo K
  'Portugal':          { nome: 'Portugal',          codigo: 'pt' },
  'Rep. Dem. do Congo':{ nome: 'Rep. Dem. do Congo',codigo: 'cd' },
  'Uzbequistão':       { nome: 'Uzbequistão',       codigo: 'uz' },
  'Colômbia':          { nome: 'Colômbia',           codigo: 'co' },
  // Grupo L
  'Inglaterra': { nome: 'Inglaterra', codigo: 'gb-eng' },
  'Croácia':    { nome: 'Croácia',    codigo: 'hr' },
  'Gana':       { nome: 'Gana',       codigo: 'gh' },
  'Panamá':     { nome: 'Panamá',     codigo: 'pa' },
}

export const ALL_TEAMS = Object.keys(TEAMS).sort((a, b) => a.localeCompare(b, 'pt-BR'))

export const TEAM_ABBR: Record<string, string> = {
  // Grupo A
  'México':          'MEX',
  'África do Sul':   'AFS',
  'Coreia do Sul':   'COR',
  'Tchéquia':        'TCH',
  // Grupo B
  'Canadá':                'CAN',
  'Bósnia e Herzegovina':  'BOS',
  'Suíça':                 'SUI',
  'Catar':                 'CAT',
  // Grupo C
  'Brasil':   'BRA',
  'Marrocos': 'MAR',
  'Haiti':    'HAI',
  'Escócia':  'ESC',
  // Grupo D
  'EUA':       'EUA',
  'Paraguai':  'PAR',
  'Austrália': 'AUS',
  'Turquia':   'TUR',
  // Grupo E
  'Alemanha':        'ALE',
  'Curaçao':         'CUR',
  'Costa do Marfim': 'CDM',
  'Equador':         'EQU',
  // Grupo F
  'Holanda': 'HOL',
  'Japão':   'JAP',
  'Suécia':  'SUE',
  'Tunísia': 'TUN',
  // Grupo G
  'Bélgica':       'BEL',
  'Egito':         'EGI',
  'Irã':           'IRN',
  'Nova Zelândia': 'NZL',
  // Grupo H
  'Espanha':        'ESP',
  'Cabo Verde':     'CPV',
  'Arábia Saudita': 'SAU',
  'Uruguai':        'URU',
  // Grupo I
  'França':  'FRA',
  'Senegal': 'SEN',
  'Iraque':  'IRQ',
  'Noruega': 'NOR',
  // Grupo J
  'Argentina': 'ARG',
  'Argélia':   'ALG',
  'Áustria':   'AUT',
  'Jordânia':  'JOR',
  // Grupo K
  'Portugal':           'POR',
  'Rep. Dem. do Congo': 'RDC',
  'Uzbequistão':        'UZB',
  'Colômbia':           'COL',
  // Grupo L
  'Inglaterra': 'ING',
  'Croácia':    'CRO',
  'Gana':       'GAN',
  'Panamá':     'PAN',
}

export const PIX_VALOR = 30
export const PIX_CHAVE = '24707699812'

// Histórico de confrontos entre seleções — exibido na tela de palpites
// Chave: "TimeA|TimeB" em ordem alfabética para lookup bidirecional
export interface ConfrontoHistorico {
  ultimoConfronto: string   // ex: "Marrocos 2 x 1 Brasil (2023)"
  raioX: string             // ex: "3 jogos. Brasil 2V, Marrocos 1V"
  inedito?: boolean         // true quando nunca se enfrentaram oficialmente
}

export const CONFRONTOS_HISTORICOS: Record<string, ConfrontoHistorico> = {
  // Grupo A
  'África do Sul|México':        { ultimoConfronto: 'África do Sul 1 x 1 México',         raioX: '4 jogos. México: 1V · 2E · África do Sul: 1V' },
  'Coreia do Sul|México':        { ultimoConfronto: 'Coreia do Sul 1 x 2 México',          raioX: '14 jogos. México: 8V · 2E · Coreia do Sul: 4V' },
  // Grupo B
  'Bósnia e Herzegovina|Canadá': { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Catar|Suíça':                 { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  // Grupo C
  'Brasil|Marrocos':             { ultimoConfronto: 'Marrocos 2 x 1 Brasil (2023)',        raioX: '3 jogos. Brasil: 2V · Marrocos: 1V' },
  'Escócia|Marrocos':            { ultimoConfronto: 'Marrocos 3 x 0 Escócia (1998)',       raioX: '3 jogos. Marrocos: 2V · 1E' },
  'Brasil|Haiti':                { ultimoConfronto: 'Brasil 7 x 1 Haiti (2016)',            raioX: '3 jogos. Brasil venceu todos' },
  'Brasil|Escócia':              { ultimoConfronto: 'Brasil 2 x 1 Escócia (1998)',          raioX: '10 jogos. Brasil: 8V · 2E' },
  // Grupo D
  'EUA|Paraguai':                { ultimoConfronto: 'Estados Unidos 1 x 0 Paraguai (2018)',raioX: '8 jogos. EUA: 4V · 2E · Paraguai: 2V' },
  // Grupo E
  'Alemanha|Equador':            { ultimoConfronto: 'Equador 2 x 4 Alemanha (2013)',        raioX: '2 jogos. Alemanha venceu ambos' },
  'Alemanha|Curaçao':            { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Costa do Marfim|Curaçao':     { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  // Grupo F
  'Holanda|Japão':               { ultimoConfronto: 'Holanda 2 x 2 Japão (2013)',           raioX: '3 jogos. Holanda: 2V · 1E' },
  'Holanda|Suécia':              { ultimoConfronto: 'Holanda 2 x 0 Suécia (2017)',           raioX: '25 jogos. Holanda: 11V · Suécia: 8V · 6E' },
  // Grupo G
  'Bélgica|Egito':               { ultimoConfronto: 'Bélgica 1 x 2 Egito (2022)',            raioX: '4 jogos. Egito: 3V · Bélgica: 1V' },
  // Grupo H
  'Arábia Saudita|Uruguai':      { ultimoConfronto: 'Uruguai 1 x 0 Arábia Saudita (2018)',  raioX: '3 jogos. 1V cada · 1E' },
  // Grupo I
  'França|Senegal':              { ultimoConfronto: 'França 0 x 1 Senegal (2002)',            raioX: 'Único confronto oficial. Vitória do Senegal' },
  // Grupo J
  'Áustria|Jordânia':            { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Argentina|Jordânia':          { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  // Grupo K
  'Portugal|Uzbequistão':        { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Colômbia|Uzbequistão':        { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  // Grupo L
  'Croácia|Inglaterra':          { ultimoConfronto: 'Inglaterra 1 x 0 Croácia (Euro 2020)',  raioX: '11 jogos. Inglaterra: 6V · Croácia: 3V · 2E' },

  // 16 Avos de Final (R32)
  'África do Sul|Canadá':              { ultimoConfronto: 'África do Sul 2 x 0 Canadá (2007, amistoso)', raioX: '1 jogo. África do Sul venceu' },
  'Alemanha|Paraguai':                 { ultimoConfronto: 'Alemanha 3 x 3 Paraguai (2013, amistoso)', raioX: '2 jogos. Alemanha: 1V · 1E' },
  'Holanda|Marrocos':                  { ultimoConfronto: 'Holanda 2 x 1 Marrocos (2017, amistoso)', raioX: '3 jogos. Holanda: 2V · Marrocos: 1V' },
  'Brasil|Japão':                      { ultimoConfronto: 'Japão 3 x 2 Brasil (2025, amistoso)', raioX: '14 jogos. Brasil: 11V · 2E · Japão: 1V' },
  'França|Suécia':                     { ultimoConfronto: 'França 4 x 2 Suécia (2020)', raioX: '23 jogos. França: 12V · 5E · Suécia: 6V' },
  'Costa do Marfim|Noruega':           { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Equador|México':                    { ultimoConfronto: 'México 1 x 1 Equador (2025, amistoso)', raioX: '25 jogos. México: 14V · 7E · Equador: 4V' },
  'Inglaterra|Rep. Dem. do Congo':     { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Bósnia e Herzegovina|EUA':          { ultimoConfronto: 'EUA 4 x 3 Bósnia e Herzegovina (2013, amistoso)', raioX: '3 jogos. EUA: 2V · 1E' },
  'Bélgica|Senegal':                   { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Croácia|Portugal':                  { ultimoConfronto: 'Croácia 1 x 1 Portugal (2024)', raioX: '10 jogos. Portugal: 7V · 2E · Croácia: 1V' },
  'Áustria|Espanha':                   { ultimoConfronto: 'Áustria 1 x 5 Espanha (2009, amistoso)', raioX: '16 jogos. Espanha: 9V · 3E · Áustria: 4V' },
  'Argélia|Suíça':                     { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Argentina|Cabo Verde':              { ultimoConfronto: '—', raioX: 'Primeiro confronto oficial', inedito: true },
  'Colômbia|Gana':                     { ultimoConfronto: 'Colômbia 2 x 1 Gana (2006, amistoso)', raioX: '5 jogos. Colômbia leva vantagem no retrospecto' },
  'Austrália|Egito':                   { ultimoConfronto: 'Egito 3 x 0 Austrália (2010, amistoso)', raioX: '1 jogo. Egito venceu' },
  // Oitavas de Final
  'Canadá|Marrocos':                   { ultimoConfronto: 'Marrocos 2 x 1 Canadá (Copa 2022)', raioX: '4 jogos. Marrocos: 3V · 1E · Canadá: 0V' },
  'Brasil|Noruega':                    { ultimoConfronto: 'Noruega 1 x 1 Brasil (2006, amistoso)', raioX: '4 jogos. Noruega: 2V · 2E · Brasil: 0V' },
  'França|Paraguai':                   { ultimoConfronto: 'França 5 x 0 Paraguai (2017, amistoso)', raioX: '4 jogos. França: 3V · 1E · Paraguai: 0V' },
  'Inglaterra|México':                 { ultimoConfronto: 'Inglaterra 3 x 1 México (2010, amistoso)', raioX: '8 jogos. Inglaterra: 5V · 1E · México: 2V' },
  'Bélgica|EUA':                       { ultimoConfronto: 'Bélgica 5 x 2 EUA (2026, amistoso)', raioX: '7 jogos. Bélgica: 6V · EUA: 1V' },
  'Espanha|Portugal':                  { ultimoConfronto: 'Portugal 2 x 2 Espanha (Nations League 2025, Portugal venceu nos pênaltis)', raioX: '41 jogos. Espanha: 17V · 18E · Portugal: 6V' },
  'Argentina|Egito':                   { ultimoConfronto: 'Argentina 2 x 0 Egito (2008, amistoso)', raioX: 'Único confronto oficial. Argentina venceu' },
  'Colômbia|Suíça':                    { ultimoConfronto: 'Colômbia 2 x 0 Suíça (Copa 1994)', raioX: 'Único confronto oficial. Colômbia venceu' },
  // Quartas de Final (QF)
  'França|Marrocos':                   { ultimoConfronto: 'França 2 x 0 Marrocos (Copa 2022, semifinal)', raioX: '9 jogos. França: 6V · 3E · Marrocos: 0V' },
  'Bélgica|Espanha':                   { ultimoConfronto: 'Bélgica 0 x 2 Espanha (2016, amistoso)', raioX: '22 jogos. Espanha: 12V · 6E · Bélgica: 4V' },
  'Inglaterra|Noruega':                { ultimoConfronto: 'Inglaterra 1 x 0 Noruega (2014, amistoso)', raioX: '11 jogos. Inglaterra: 6V · 3E · Noruega: 2V' },
  'Argentina|Suíça':                   { ultimoConfronto: 'Argentina 1 x 0 Suíça (Copa 2014, oitavas, prorrogação)', raioX: '7 jogos. Argentina: 5V · 2E · Suíça: 0V' },
  // Semifinal (SF)
  'Espanha|França':                    { ultimoConfronto: 'Espanha 5 x 4 França (Nations League 2025, semifinal)', raioX: '38 jogos. Espanha: 18V · 7E · França: 13V' },
  'Argentina|Inglaterra':               { ultimoConfronto: 'Argentina 2 x 3 Inglaterra (2005, amistoso)', raioX: '14 jogos. Inglaterra: 6V · 5E · Argentina: 3V' },
}

// Retorna o histórico de confronto dado dois nomes de time (ordem não importa)
export function getConfrontoHistorico(timeA: string, timeB: string): ConfrontoHistorico | null {
  const key = [timeA, timeB].sort((a, b) => a.localeCompare(b, 'pt-BR')).join('|')
  return CONFRONTOS_HISTORICOS[key] ?? null
}

/* ─── Special prediction options ─────────────────────────────────────────────
 * Shared between PalpitesClient (user dropdowns) and AdminConfigClient
 * (official result dropdowns). Update as needed before the tournament.
 * ──────────────────────────────────────────────────────────────────────────── */

export const ARTILHEIRO_OPTIONS = [
  { value: 'Cristiano Ronaldo',    label: 'Cristiano Ronaldo (Portugal)'        },
  { value: 'Cyle Larin',           label: 'Cyle Larin (Canadá)'                 },
  { value: 'Dembélé',              label: 'Dembélé (França)'                    },
  { value: 'Elijah Just',          label: 'Elijah Just (Nova Zelândia)'         },
  { value: 'Endrick',              label: 'Endrick (Brasil)'                     },
  { value: 'Erling Haaland',       label: 'Erling Haaland (Noruega)'            },
  { value: 'Folarin Balogun',      label: 'Folarin Balogun (EUA)'               },
  { value: 'Harry Kane',           label: 'Harry Kane (Inglaterra)'             },
  { value: 'Ismael Saibari',       label: 'Ismael Saibari (Marrocos)'           },
  { value: 'Johan Manzambi',       label: 'Johan Manzambi (Suíça)'              },
  { value: 'Jonathan David',       label: 'Jonathan David (Canadá)'             },
  { value: 'Julian Alvarez',       label: 'Julian Alvarez (Argentina)'          },
  { value: 'Kai Havertz',          label: 'Kai Havertz (Alemanha)'              },
  { value: 'Kylian Mbappé',        label: 'Kylian Mbappé (França)'              },
  { value: 'Lamine Yamal',         label: 'Lamine Yamal (Espanha)'              },
  { value: 'Lionel Messi',         label: 'Lionel Messi (Argentina)'            },
  { value: 'Matheus Cunha',        label: 'Matheus Cunha (Brasil)'              },
  { value: 'Memphis Depay',        label: 'Memphis Depay (Holanda)'             },
  { value: 'Michael Olise',        label: 'Michael Olise (França)'              },
  { value: 'Jamal Musiala',        label: 'Jamal Musiala (Alemanha)'            },
  { value: 'Neymar Jr',            label: 'Neymar Jr (Brasil)'                  },
  { value: 'Nick Woltemade',       label: 'Nick Woltemade (Alemanha)'           },
  { value: 'Raphinha',             label: 'Raphinha (Brasil)'                   },
  { value: 'Rodri',                label: 'Rodri (Espanha)'                     },
  { value: 'Vinicius Junior',      label: 'Vinicius Junior (Brasil)'            },
  { value: 'Yasin Ayari',          label: 'Yasin Ayari (Suécia)'                },
].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

export const GOLEIRO_OPTIONS = [
  { value: 'Mike Maignan',        label: 'Mike Maignan (França)'                },
  { value: 'Emiliano Martínez',   label: 'Emiliano "Dibu" Martínez (Argentina)' },
  { value: 'Alisson Becker',      label: 'Alisson Becker (Brasil)'              },
  { value: 'Unai Simón',          label: 'Unai Simón (Espanha)'                 },
  { value: 'Jordan Pickford',     label: 'Jordan Pickford (Inglaterra)'         },
  { value: 'Manuel Neuer',        label: 'Manuel Neuer (Alemanha)'              },
  { value: 'Thibaut Courtois',    label: 'Thibaut Courtois (Bélgica)'           },
  { value: 'Gregor Kobel',        label: 'Gregor Kobel (Suíça)'                 },
  { value: 'Vozinha',             label: 'Vozinha (Cabo Verde)'                 },
  { value: 'Diogo Costa',         label: 'Diogo Costa (Portugal)'               },
  { value: 'Bart Verbruggen',     label: 'Bart Verbruggen (Holanda)'            },
  { value: 'Sergio Rochet',       label: 'Sergio Rochet (Uruguai)'              },
  { value: 'Raúl Rangel',         label: 'Raúl Rangel (México)'                 },
  { value: 'Matthew Freese',      label: 'Matthew Freese (EUA)'                 },
  { value: 'Zion Suzuki',         label: 'Zion Suzuki (Japão)'                  },
  { value: 'Lionel Mpasi',        label: 'Lionel Mpasi (Rep. Dem. do Congo)'    },
].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

/* ─── Qualifying info ─────────────────────────────────────────────────────────
 * Static data for all 48 teams. Sources:
 *   - CONMEBOL : Wikipedia (verified Jun 2026)
 *   - UEFA     : API-Football season 2024 (verified Jun 2026)
 *   - CAF      : API-Football season 2023 (verified Jun 2026)
 *   - CONCACAF : Wikipedia (verified Jun 2026)
 *   - AFC      : API-Football season 2024 + Wikipedia (verified Jun 2026)
 *   - OFC      : Wikipedia (verified Jun 2026)
 * Keys match exactly the team names used in jogos_copa (time_a / time_b).
 * null = stat not available (hosts, playoff teams without group stage stats)
 * ──────────────────────────────────────────────────────────────────────────── */

export type MetodoClassificacao = 'Direto' | 'Sede' | 'Playoff' | 'Repescagem'

export interface TeamQualInfo {
  confederacao: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC'
  zona: string                    // e.g. "CONMEBOL", "UEFA · Grupo A", "CAF · Grupo E"
  posicao: number | null          // final position in qualifying group
  metodo: MetodoClassificacao
  metodoDetalhe: string           // human-readable e.g. "1º CONMEBOL" or "Playoff UEFA"
  p:   number | null              // played
  v:   number | null              // won
  e:   number | null              // drawn
  d:   number | null              // lost
  gp:  number | null              // goals for
  gc:  number | null              // goals against
  pts: number | null              // points
  descricao: string               // narrative context shown in the card panel
  obs?: string                    // optional note e.g. "*−3pts penalização"
}

export const TEAM_QUAL: Record<string, TeamQualInfo> = {

  // ── CONMEBOL ─────────────────────────────────────────────────────────────
  'Argentina': {
    confederacao: 'CONMEBOL', zona: 'CONMEBOL', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CONMEBOL',
    p: 18, v: 12, e: 2, d: 4, gp: 31, gc: 10, pts: 38,
    descricao: 'Atual campeã mundial, liderou com autoridade. Teve a melhor defesa do torneio e foi a primeira sul-americana a se classificar matematicamente.',
  },
  'Equador': {
    confederacao: 'CONMEBOL', zona: 'CONMEBOL', posicao: 2,
    metodo: 'Direto', metodoDetalhe: '2º CONMEBOL',
    p: 18, v: 8, e: 8, d: 2, gp: 14, gc: 5, pts: 29,
    descricao: 'Superou uma punição inicial de perda de 3 pontos (caso Byron Castillo). Teve a melhor campanha como mandante na altitude de Quito.',
    obs: '* −3 pts por documentação falsa no ciclo anterior',
  },
  'Colômbia': {
    confederacao: 'CONMEBOL', zona: 'CONMEBOL', posicao: 3,
    metodo: 'Direto', metodoDetalhe: '3º CONMEBOL',
    p: 18, v: 7, e: 7, d: 4, gp: 28, gc: 18, pts: 28,
    descricao: 'Destacou-se pelo futebol ofensivo. Liderada por James Rodríguez e Luis Díaz, quebrou recordes de gols marcados contra rivais diretos.',
  },
  'Uruguai': {
    confederacao: 'CONMEBOL', zona: 'CONMEBOL', posicao: 4,
    metodo: 'Direto', metodoDetalhe: '4º CONMEBOL',
    p: 18, v: 7, e: 7, d: 4, gp: 22, gc: 12, pts: 28,
    descricao: 'Sob o comando de Marcelo Bielsa, implementou um estilo de alta intensidade, vencendo o Brasil e a Argentina em sequência no primeiro turno.',
  },
  'Brasil': {
    confederacao: 'CONMEBOL', zona: 'CONMEBOL', posicao: 5,
    metodo: 'Direto', metodoDetalhe: '5º CONMEBOL',
    p: 18, v: 8, e: 4, d: 6, gp: 24, gc: 17, pts: 28,
    descricao: 'Confirmou a vaga na 16ª rodada sob Carlo Ancelotti, batendo o Paraguai 1–0 na Arena Corinthians com gol de Vinicius Junior.',
  },
  'Paraguai': {
    confederacao: 'CONMEBOL', zona: 'CONMEBOL', posicao: 6,
    metodo: 'Direto', metodoDetalhe: '6º CONMEBOL',
    p: 18, v: 7, e: 7, d: 4, gp: 14, gc: 10, pts: 28,
    descricao: 'Garantiu a última vaga direta na rodada final. Sustentou-se com um sistema defensivo rígido que arrancou empates cruciais fora de casa.',
  },

  // ── UEFA — group winners (direct) ─────────────────────────────────────────
  'Alemanha': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo A', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo A',
    p: 6, v: 5, e: 0, d: 1, gp: 16, gc: 3, pts: 15,
    descricao: 'Apresentou futebol de transição rápida após reformulação tática pós-Eurocopa, assegurando o primeiro lugar com facilidade.',
  },
  'Suíça': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo B', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo B',
    p: 6, v: 4, e: 2, d: 0, gp: 14, gc: 2, pts: 14,
    descricao: 'Avançou dominando seu bloco regional com folga de pontos, exibindo solidez defensiva e eficiência nos contra-ataques.',
  },
  'Escócia': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo C', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo C',
    p: 6, v: 4, e: 1, d: 1, gp: 13, gc: 7, pts: 13,
    descricao: 'Surpreendeu os favoritos da chave com uma defesa sólida e o forte apoio de sua torcida em Glasgow.',
  },
  'França': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo D', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo D',
    p: 6, v: 5, e: 1, d: 0, gp: 16, gc: 4, pts: 16,
    descricao: 'Classificou-se invicta. Kylian Mbappé terminou como o artilheiro isolado das eliminatórias europeias.',
  },
  'Espanha': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo E', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo E',
    p: 6, v: 5, e: 1, d: 0, gp: 21, gc: 2, pts: 16,
    descricao: 'Dominou a posse de bola e garantiu a vaga com duas rodadas de antecedência, impulsionada por jovens talentos das categorias de base.',
  },
  'Portugal': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo F', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo F',
    p: 6, v: 4, e: 1, d: 1, gp: 20, gc: 7, pts: 13,
    descricao: 'Manteve 100% de aproveitamento nos jogos em casa. Cristiano Ronaldo ampliou seu recorde histórico de gols em eliminatórias.',
  },
  'Holanda': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo G', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo G',
    p: 8, v: 6, e: 2, d: 0, gp: 27, gc: 4, pts: 20,
    descricao: 'Superou um grupo equilibrado ao vencer confrontos diretos na base da força física e jogadas de bola parada.',
  },
  'Áustria': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo H', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo H',
    p: 8, v: 6, e: 1, d: 1, gp: 22, gc: 4, pts: 19,
    descricao: 'Avançou dominando seu bloco regional com folga de pontos, demonstrando consistência e organização tática ao longo de toda a campanha.',
  },
  'Noruega': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo I', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo I',
    p: 8, v: 8, e: 0, d: 0, gp: 37, gc: 5, pts: 24,
    descricao: 'Erling Haaland anotou gols decisivos que recolocaram o país no mapa do Mundial após um longo jejum de participações.',
  },
  'Bélgica': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo J', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo J',
    p: 8, v: 5, e: 3, d: 0, gp: 29, gc: 7, pts: 18,
    descricao: 'Passou por uma renovação em seu elenco principal, mas manteve a liderança da chave sem sofrer derrotas.',
  },
  'Inglaterra': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo K', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo K',
    p: 8, v: 8, e: 0, d: 0, gp: 22, gc: 0, pts: 24,
    descricao: 'Teve o melhor saldo de gols do continente, com Jude Bellingham e Harry Kane como pilares na reta final.',
  },
  'Croácia': {
    confederacao: 'UEFA', zona: 'UEFA · Grupo L', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º UEFA Grupo L',
    p: 8, v: 7, e: 1, d: 0, gp: 26, gc: 4, pts: 22,
    descricao: 'Garantiu a vaga na penúltima rodada demonstrando a tradicional resiliência em prorrogações e partidas truncadas.',
  },

  // ── UEFA — playoff winners ─────────────────────────────────────────────────
  'Bósnia e Herzegovina': {
    confederacao: 'UEFA', zona: 'UEFA · Playoff', posicao: null,
    metodo: 'Playoff', metodoDetalhe: 'Playoff UEFA (venceu Itália)',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Sobreviveu ao torneio de mata-mata da UEFA, eliminando a Itália em jogo único de alta tensão para garantir a vaga histórica.',
  },
  'Suécia': {
    confederacao: 'UEFA', zona: 'UEFA · Playoff', posicao: null,
    metodo: 'Playoff', metodoDetalhe: 'Playoff UEFA (venceu Polônia)',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Superou a Polônia no mata-mata da UEFA, assegurando o retorno ao Mundial após uma campanha de eliminatórias irregular.',
  },
  'Turquia': {
    confederacao: 'UEFA', zona: 'UEFA · Playoff', posicao: null,
    metodo: 'Playoff', metodoDetalhe: 'Playoff UEFA (venceu Kosovo)',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Venceu o Kosovo no playoff da UEFA, confirmando a vaga em um duelo decisivo que mobilizou a nação.',
  },
  'Tchéquia': {
    confederacao: 'UEFA', zona: 'UEFA · Playoff', posicao: null,
    metodo: 'Playoff', metodoDetalhe: 'Playoff UEFA (venceu Dinamarca)',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Eliminou a Dinamarca no mata-mata europeu, garantindo presença no Mundial com uma performance sólida nos jogos decisivos.',
  },

  // ── CAF ───────────────────────────────────────────────────────────────────
  'Egito': {
    confederacao: 'CAF', zona: 'CAF · Grupo A', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo A',
    p: 10, v: 8, e: 2, d: 0, gp: 20, gc: 2, pts: 26,
    descricao: 'Mohamed Salah liderou a equipe em assistências e gols, garantindo a classificação de forma antecipada no Cairo.',
  },
  'Senegal': {
    confederacao: 'CAF', zona: 'CAF · Grupo B', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo B',
    p: 10, v: 7, e: 3, d: 0, gp: 22, gc: 3, pts: 24,
    descricao: 'Confirmou o favoritismo amparado por um meio-campo físico e forte imposição técnica na região subsaariana.',
  },
  'África do Sul': {
    confederacao: 'CAF', zona: 'CAF · Grupo C', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo C',
    p: 10, v: 5, e: 3, d: 2, gp: 15, gc: 9, pts: 18,
    descricao: 'Retornou aos grandes holofotes mundiais após ajustar seu campeonato local e basear a seleção no clube Mamelodi Sundowns.',
  },
  'Cabo Verde': {
    confederacao: 'CAF', zona: 'CAF · Grupo D', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo D',
    p: 10, v: 7, e: 2, d: 1, gp: 16, gc: 8, pts: 23,
    descricao: 'Protagonizou a maior zebra do continente ao desbancar potências tradicionais e garantir uma vaga inédita na Copa do Mundo.',
  },
  'Marrocos': {
    confederacao: 'CAF', zona: 'CAF · Grupo E', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo E',
    p: 8, v: 8, e: 0, d: 0, gp: 22, gc: 2, pts: 24,
    descricao: 'Semifinalista em 2022, manteve a base tática e sobrou no grupo com uma defesa que sofreu pouquíssimos gols.',
  },
  'Costa do Marfim': {
    confederacao: 'CAF', zona: 'CAF · Grupo F', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo F',
    p: 10, v: 8, e: 2, d: 0, gp: 25, gc: 0, pts: 26,
    descricao: 'Atual campeã continental africana, manteve o ritmo embalado e assegurou o topo da tabela com folga.',
  },
  'Argélia': {
    confederacao: 'CAF', zona: 'CAF · Grupo G', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo G',
    p: 10, v: 8, e: 1, d: 1, gp: 24, gc: 8, pts: 25,
    descricao: 'Passou por transição de elenco, mas garantiu a vaga apoiada no excelente desempenho jogando em seus domínios.',
  },
  'Tunísia': {
    confederacao: 'CAF', zona: 'CAF · Grupo H', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo H',
    p: 10, v: 9, e: 1, d: 0, gp: 22, gc: 0, pts: 28,
    descricao: 'Classificação baseada na consistência tática e na experiência em jogos eliminatórios fora de casa.',
  },
  'Gana': {
    confederacao: 'CAF', zona: 'CAF · Grupo I', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CAF Grupo I',
    p: 10, v: 8, e: 1, d: 1, gp: 23, gc: 6, pts: 25,
    descricao: 'Garantiu o primeiro lugar em um grupo equilibrado, contando com gols decisivos nos acréscimos na penúltima rodada.',
  },
  'Rep. Dem. do Congo': {
    confederacao: 'CAF', zona: 'CAF · Repescagem', posicao: null,
    metodo: 'Repescagem', metodoDetalhe: 'Repescagem Intercontinental (venceu Jamaica 1–0)',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Ficou em segundo em sua chave, venceu os playoffs africanos e abocanhou a vaga na repescagem mundial da FIFA ao bater a Jamaica.',
  },

  // ── CONCACAF — hosts ──────────────────────────────────────────────────────
  'Canadá': {
    confederacao: 'CONCACAF', zona: 'CONCACAF · Sede', posicao: null,
    metodo: 'Sede', metodoDetalhe: 'País Sede',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Classificação automática como sede. Consolidou sua geração de ouro com foco no desenvolvimento nacional, jogando em Toronto e Vancouver.',
  },
  'México': {
    confederacao: 'CONCACAF', zona: 'CONCACAF · Sede', posicao: null,
    metodo: 'Sede', metodoDetalhe: 'País Sede',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Classificação automática como sede. Passou por intensa reformulação técnica, utilizando a Copa América como principal laboratório.',
  },
  'EUA': {
    confederacao: 'CONCACAF', zona: 'CONCACAF · Sede', posicao: null,
    metodo: 'Sede', metodoDetalhe: 'País Sede',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Classificação automática como sede. Usou o ciclo para amistosos de alto nível na Europa e testar a transição de jovens promessas da MLS.',
  },

  // ── CONCACAF — qualifiers ─────────────────────────────────────────────────
  'Panamá': {
    confederacao: 'CONCACAF', zona: 'CONCACAF · Grupo A', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CONCACAF Grupo A',
    p: 6, v: 3, e: 3, d: 0, gp: 9, gc: 4, pts: 12,
    descricao: 'Consolidou-se como a quarta força da região através de um futebol coletivo organizado e posse de bola estruturada.',
  },
  'Curaçao': {
    confederacao: 'CONCACAF', zona: 'CONCACAF · Grupo B', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CONCACAF Grupo B',
    p: 6, v: 3, e: 3, d: 0, gp: 13, gc: 3, pts: 12,
    descricao: 'Fez história com uma vaga inédita no Mundial, impulsionada por atletas que atuam no futebol holandês.',
  },
  'Haiti': {
    confederacao: 'CONCACAF', zona: 'CONCACAF · Grupo C', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º CONCACAF Grupo C',
    p: 6, v: 3, e: 2, d: 1, gp: 9, gc: 6, pts: 11,
    descricao: 'Surpreendeu ao liderar a chave invicto, quebrando um jejum de 52 anos longe da elite do futebol mundial.',
  },

  // ── AFC — 3rd round direct ─────────────────────────────────────────────────
  'Irã': {
    confederacao: 'AFC', zona: 'AFC · 3ª Rodada · Grupo A', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º AFC Grupo A (3ª Rodada)',
    p: 10, v: 7, e: 2, d: 1, gp: 19, gc: 8, pts: 23,
    descricao: 'Demonstrou força física e dominou o grupo com um ataque experiente no futebol europeu.',
  },
  'Uzbequistão': {
    confederacao: 'AFC', zona: 'AFC · 3ª Rodada · Grupo A', posicao: 2,
    metodo: 'Direto', metodoDetalhe: '2º AFC Grupo A (3ª Rodada)',
    p: 10, v: 6, e: 3, d: 1, gp: 14, gc: 7, pts: 21,
    descricao: 'Garantiu uma vaga histórica e inédita, colhendo os frutos de investimentos pesados em suas seleções de base na última década.',
  },
  'Coreia do Sul': {
    confederacao: 'AFC', zona: 'AFC · 3ª Rodada · Grupo B', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º AFC Grupo B (3ª Rodada)',
    p: 10, v: 6, e: 4, d: 0, gp: 20, gc: 7, pts: 22,
    descricao: 'Comandada por Son Heung-min, ditou o ritmo do grupo com transições em alta velocidade.',
  },
  'Jordânia': {
    confederacao: 'AFC', zona: 'AFC · 3ª Rodada · Grupo B', posicao: 2,
    metodo: 'Direto', metodoDetalhe: '2º AFC Grupo B (3ª Rodada)',
    p: 10, v: 6, e: 3, d: 1, gp: 17, gc: 8, pts: 21,
    descricao: 'Confirmou ascensão meteórica no cenário asiático e carimbou a vaga direta pela primeira vez na história do país.',
  },
  'Japão': {
    confederacao: 'AFC', zona: 'AFC · 3ª Rodada · Grupo C', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º AFC Grupo C (3ª Rodada)',
    p: 10, v: 9, e: 1, d: 0, gp: 28, gc: 3, pts: 28,
    descricao: 'Teve a campanha mais dominante da Ásia, aplicando goleadas expressivas e mostrando um elenco altamente técnico.',
  },
  'Austrália': {
    confederacao: 'AFC', zona: 'AFC · 3ª Rodada · Grupo C', posicao: 2,
    metodo: 'Direto', metodoDetalhe: '2º AFC Grupo C (3ª Rodada)',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Sofreu no início, mas garantiu a vaga direta na rodada final apostando no jogo aéreo e na experiência acumulada em Copas do Mundo.',
  },

  // ── AFC — 4th round direct ─────────────────────────────────────────────────
  'Catar': {
    confederacao: 'AFC', zona: 'AFC · 4ª Rodada · Grupo A', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º AFC Grupo A (4ª Rodada)',
    p: 2, v: 1, e: 1, d: 0, gp: 2, gc: 1, pts: 4,
    descricao: 'Venceu a 4ª rodada asiática como sede do grupo, assegurando o retorno ao Mundial após a experiência como país anfitrião em 2022.',
  },
  'Arábia Saudita': {
    confederacao: 'AFC', zona: 'AFC · 4ª Rodada · Grupo B', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º AFC Grupo B (4ª Rodada)',
    p: 2, v: 1, e: 1, d: 0, gp: 3, gc: 2, pts: 4,
    descricao: 'Confirmou presença no Mundial vencendo a 4ª rodada asiática, dando continuidade ao projeto de crescimento do futebol saudita.',
  },

  // ── AFC — intercontinental playoff ────────────────────────────────────────
  'Iraque': {
    confederacao: 'AFC', zona: 'AFC · Repescagem', posicao: null,
    metodo: 'Repescagem', metodoDetalhe: 'Repescagem Intercontinental (venceu Bolívia 2–1)',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Venceu a 5ª rodada asiática e superou o torneio de repescagem intercontinental da FIFA ao bater a Bolívia, garantindo o retorno ao Mundial após décadas.',
  },

  // ── OFC ───────────────────────────────────────────────────────────────────
  'Nova Zelândia': {
    confederacao: 'OFC', zona: 'OFC', posicao: 1,
    metodo: 'Direto', metodoDetalhe: '1º OFC',
    p: null, v: null, e: null, d: null, gp: null, gc: null, pts: null,
    descricao: 'Com o caminho livre após a mudança no regulamento da FIFA, goleou seus adversários na fase final em formato mata-mata e ficou com a única vaga direta da Oceania.',
  },
}
