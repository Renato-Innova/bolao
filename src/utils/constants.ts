export const GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export const FASES: Record<string, string> = {
  GS:  'Fase de Grupos',
  R32: 'Segundas de Final',
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

export const ALL_TEAMS = Object.keys(TEAMS)

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

export const PIX_VALOR = 40
export const PIX_CHAVE = 'renatoclpereira@gmail.com'
