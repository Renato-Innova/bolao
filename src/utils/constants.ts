export const GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export const FASES = {
  grupos: 'Fase de Grupos',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semis: 'Semifinais',
  final: 'Final',
}

export const TEAMS: Record<string, { nome: string; codigo: string }> = {
  // Grupo A
  'México': { nome: 'México', codigo: 'mx' },
  'Canadá': { nome: 'Canadá', codigo: 'ca' },
  'Equador': { nome: 'Equador', codigo: 'ec' },
  'Colômbia': { nome: 'Colômbia', codigo: 'co' },
  // Grupo B
  'Brasil': { nome: 'Brasil', codigo: 'br' },
  'Argentina': { nome: 'Argentina', codigo: 'ar' },
  'Paraguai': { nome: 'Paraguai', codigo: 'py' },
  'Venezuela': { nome: 'Venezuela', codigo: 've' },
  // Grupo C
  'Espanha': { nome: 'Espanha', codigo: 'es' },
  'Portugal': { nome: 'Portugal', codigo: 'pt' },
  'Turquia': { nome: 'Turquia', codigo: 'tr' },
  'Geórgia': { nome: 'Geórgia', codigo: 'ge' },
  // Grupo D
  'Alemanha': { nome: 'Alemanha', codigo: 'de' },
  'França': { nome: 'França', codigo: 'fr' },
  'Bélgica': { nome: 'Bélgica', codigo: 'be' },
  'Suíça': { nome: 'Suíça', codigo: 'ch' },
  // Grupo E
  'Inglaterra': { nome: 'Inglaterra', codigo: 'gb-eng' },
  'Holanda': { nome: 'Holanda', codigo: 'nl' },
  'Dinamarca': { nome: 'Dinamarca', codigo: 'dk' },
  'Sérvia': { nome: 'Sérvia', codigo: 'rs' },
  // Grupo F
  'EUA': { nome: 'EUA', codigo: 'us' },
  'Uruguai': { nome: 'Uruguai', codigo: 'uy' },
  'Chile': { nome: 'Chile', codigo: 'cl' },
  'Bolívia': { nome: 'Bolívia', codigo: 'bo' },
  // Grupo G
  'Itália': { nome: 'Itália', codigo: 'it' },
  'Croácia': { nome: 'Croácia', codigo: 'hr' },
  'Eslováquia': { nome: 'Eslováquia', codigo: 'sk' },
  'Romênia': { nome: 'Romênia', codigo: 'ro' },
  // Grupo H
  'Japão': { nome: 'Japão', codigo: 'jp' },
  'Coreia do Sul': { nome: 'Coreia do Sul', codigo: 'kr' },
  'Austrália': { nome: 'Austrália', codigo: 'au' },
  'Indonésia': { nome: 'Indonésia', codigo: 'id' },
  // Grupo I
  'Marrocos': { nome: 'Marrocos', codigo: 'ma' },
  'Senegal': { nome: 'Senegal', codigo: 'sn' },
  'África do Sul': { nome: 'África do Sul', codigo: 'za' },
  'Benin': { nome: 'Benin', codigo: 'bj' },
  // Grupo J
  'Egito': { nome: 'Egito', codigo: 'eg' },
  'Argélia': { nome: 'Argélia', codigo: 'dz' },
  'Costa do Marfim': { nome: 'Costa do Marfim', codigo: 'ci' },
  'Tanzânia': { nome: 'Tanzânia', codigo: 'tz' },
  // Grupo K
  'Arábia Saudita': { nome: 'Arábia Saudita', codigo: 'sa' },
  'Irã': { nome: 'Irã', codigo: 'ir' },
  'Iraque': { nome: 'Iraque', codigo: 'iq' },
  'Jordânia': { nome: 'Jordânia', codigo: 'jo' },
  // Grupo L
  'Nova Zelândia': { nome: 'Nova Zelândia', codigo: 'nz' },
  'China': { nome: 'China', codigo: 'cn' },
  'Barein': { nome: 'Barein', codigo: 'bh' },
  'Taiti': { nome: 'Taiti', codigo: 'pf' },
}

export const ALL_TEAMS = Object.keys(TEAMS)

export const PIX_VALOR = 40
export const PIX_CHAVE = 'renatoclpereira@gmail.com'
