import { createClient } from '@/lib/supabase/server'
import type { ConfiguracaoPontuacao } from '@/types'

export const dynamic = 'force-dynamic'

// All 7 phases including TPL (3rd-place play-off)
const FASES_ORDER = ['GS', 'R32', 'R16', 'QF', 'SF', 'TPL', 'F'] as const
const FASES_LABEL: Record<string, string> = {
  GS:  'Fase de Grupos',
  R32: 'Segundas de Final',
  R16: 'Oitavas de Final',
  QF:  'Quartas de Final',
  SF:  'Semifinal',
  TPL: 'Decisão do 3º Lugar',
  F:   'Final',
}

// Official regulation defaults (fallback if DB is empty)
const DEFAULTS: Record<string, Record<string, number>> = {
  GS:  { placar_exato: 20, empate: 15, vencedor: 10, gols_equipe:  5, penalti:  5 },
  R32: { placar_exato: 30, empate: 22, vencedor: 15, gols_equipe:  8, penalti:  8 },
  R16: { placar_exato: 40, empate: 30, vencedor: 20, gols_equipe: 10, penalti: 10 },
  QF:  { placar_exato: 60, empate: 40, vencedor: 30, gols_equipe: 15, penalti: 15 },
  SF:  { placar_exato: 80, empate: 60, vencedor: 40, gols_equipe: 20, penalti: 20 },
  TPL: { placar_exato:100, empate: 75, vencedor: 50, gols_equipe: 25, penalti: 25 },
  F:   { placar_exato:120, empate: 75, vencedor: 60, gols_equipe: 30, penalti: 30 },
}

const card: React.CSSProperties = {
  background: '#0D1E3D',
  border: '1px solid rgba(74,144,217,0.15)',
  borderRadius: 10,
  padding: '18px 20px',
  position: 'relative',
  overflow: 'hidden',
}
const topLine: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  background: 'linear-gradient(90deg, #4A90D9, #1a5ca8)',
}
const cardTitle = (icon: string, label: string) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 16 }}>{icon}</span> {label}
  </div>
)
const tip = (children: React.ReactNode) => (
  <div style={{ background: 'rgba(74,144,217,0.07)', border: '1px solid rgba(74,144,217,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#7BB8F0', lineHeight: 1.6, marginTop: 10 }}>
    {children}
  </div>
)

export default async function InstrucoesPage() {
  const supabase = await createClient()
  const { data: configs } = await supabase
    .from('configuracoes_pontuacao')
    .select('*')
    .order('fase')

  // Build config map with official regulation defaults as fallback
  const configMap: Record<string, Record<string, number>> = {}
  for (const fase of FASES_ORDER) configMap[fase] = { ...DEFAULTS[fase] }
  for (const c of (configs ?? []) as ConfiguracaoPontuacao[]) {
    if (!configMap[c.fase]) configMap[c.fase] = {}
    configMap[c.fase][c.tipo_acerto] = c.pontos
  }

  function pts(fase: string, tipo: string) {
    return configMap[fase]?.[tipo] ?? 0
  }

  return (
    <div className="page-main" style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 48px', position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 4 }}>Instruções do bolão</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>Tudo que você precisa saber pra participar e ganhar</div>

      {/* WhatsApp group banner */}
      <a
        href="https://chat.whatsapp.com/LgoS1djS6eIDwtVBZP6DJ4"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.25)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 14,
          textDecoration: 'none',
        }}
      >
        <div style={{ width: 40, height: 40, background: 'rgba(37,211,102,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2 }}>Entre no grupo do WhatsApp</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Acompanhe as novidades, tire dúvidas e interaja com os outros participantes do bolão.</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 18, color: '#25D366', flexShrink: 0 }}>→</div>
      </a>

      {/* Row 1 — 2 cols */}
      <div className="instr-two" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Como funciona */}
        <div style={card}>
          <div style={topLine} />
          {cardTitle('⚽', 'Como funciona')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { n: 1, title: 'Crie sua conta', desc: <>Cadastre-se com nome, email e WhatsApp. O acesso à plataforma é <strong style={{ color: 'white' }}>gratuito</strong> — você pode acompanhar a Copa sem pagar nada.</> },
              { n: 2, title: 'Crie um palpite e dê um nome', desc: 'Cada palpite precisa de um nome único — esse nome vai aparecer no ranking pra todo mundo ver. Você pode criar quantos palpites quiser.' },
              { n: 3, title: 'Envie o placar de cada jogo individualmente', desc: <>Chute o placar de cada partida clicando em "Enviar placar". Indique também o <strong style={{ color: 'white' }}>campeão, vice, artilheiro, melhor jogador e melhor goleiro</strong>.</> },
              { n: 4, title: 'Ative pagando R$ 30,00 via PIX', desc: <>Palpites não pagos não valem pra competição. <strong style={{ color: 'white' }}>Após o início da Copa não é mais possível ativar.</strong> Não perca o prazo!</> },
              { n: 5, title: 'Continue no mata-mata', desc: <>Conforme cada fase avança, você edita seu palpite pra adicionar os próximos jogos. É possível editar até <strong style={{ color: 'white' }}>1 hora antes</strong> de cada partida.</> },
            ].map(s => (
              <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #4A90D9, #1a5ca8)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          {tip(<><strong style={{ color: 'white' }}>Dica:</strong> escolha um nome criativo pro seu palpite — ele vai aparecer no ranking e todo mundo vai ver!</>)}
        </div>

        {/* Right column: payment + prizes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Pagamento */}
          <div style={card}>
            <div style={topLine} />
            {cardTitle('💳', 'Pagamento e ativação')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '📱', title: 'PIX — R$ 30,00 por palpite', desc: <>Chave PIX (CPF do Ricardo): <strong style={{ color: 'white' }}>247.076.988-12</strong></> },
                { icon: '📲', title: 'Envie o comprovante no grupo do WhatsApp', desc: <>Após pagar, envie o comprovante <strong style={{ color: 'white' }}>no grupo do WhatsApp</strong> informando também o <strong style={{ color: 'white' }}>nome do seu palpite</strong>.</> },
                { icon: '✅', title: 'Ativação manual', desc: 'Após confirmação do pagamento pelo organizador, seu palpite é ativado e passa a valer no ranking.' },
                { icon: '⏰', title: 'Prazo de ativação', desc: <>Palpites não pagos <strong style={{ color: 'white' }}>não podem ser ativados após o início da Copa</strong>. Não deixe pra última hora.</> },
                { icon: '♾️', title: 'Mata-mata incluso', desc: 'Um único pagamento cobre todas as fases. Sem taxas adicionais.' },
              ].map(item => (
                <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Premiação */}
          <div style={card}>
            <div style={topLine} />
            {cardTitle('🏆', 'Premiação')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { medal: '🥇', place: '1º lugar', val: '60%' },
                { medal: '🥈', place: '2º lugar', val: '25%' },
                { medal: '🥉', place: '3º lugar', val: '15%' },
              ].map(p => (
                <div key={p.place} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{p.medal}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{p.place}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#4A90D9' }}>{p.val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>do total arrecadado</div>
                </div>
              ))}
            </div>
            {tip('O vencedor será contactado pelo WhatsApp cadastrado.')}
          </div>
        </div>
      </div>

      {/* Scoring table — full width */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={topLine} />
        {cardTitle('📊', 'Sistema de pontuação')}

        {/* Criteria explanation */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 18 }}>
          {[
            { icon: '🎯', label: 'Placar exato', desc: 'Acertou o placar completo da partida', color: '#4A90D9' },
            { icon: '🤝', label: 'Empate', desc: 'Previu empate e o resultado foi empate (placar diferente)', color: '#7BB8F0' },
            { icon: '✅', label: 'Vencedor', desc: 'Acertou o vencedor, mas errou o placar', color: '#4ade80' },
            { icon: '⚽', label: 'Gols de uma equipe', desc: 'Acertou os gols de uma das equipes — cumulativo com vencedor', color: '#f59e0b' },
            { icon: '🥅', label: 'Pênaltis (KO)', desc: 'Acertou o classificado na disputa de pênaltis — cumulativo', color: '#f97316' },
          ].map(c => (
            <div key={c.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{c.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        {/* Points table */}
        <div className="instr-score-wrap">
          <table className="instr-score-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Fase', 'Exato', 'Empate', 'Vencedor', 'Gols', 'Pênaltis'].map((h, i) => (
                  <th key={h} style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '6px 10px', textAlign: i === 0 ? 'left' : 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FASES_ORDER.map((fase, idx) => {
                const isHighlight = idx % 2 === 1
                const isTPL = fase === 'TPL'
                return (
                  <tr key={fase} style={{ background: isHighlight ? 'rgba(74,144,217,0.07)' : 'transparent' }}>
                    <td style={{ fontSize: 12, color: isTPL ? 'rgba(255,255,255,0.5)' : 'white', fontWeight: 600, padding: '8px 10px', borderBottom: idx < FASES_ORDER.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', whiteSpace: 'nowrap' }}>
                      {FASES_LABEL[fase]}
                    </td>
                    {(['placar_exato', 'empate', 'vencedor', 'gols_equipe', 'penalti'] as const).map(tipo => (
                      <td key={tipo} style={{ fontSize: 12, fontWeight: 700, color: '#4A90D9', padding: '8px 10px', textAlign: 'center', borderBottom: idx < FASES_ORDER.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        {pts(fase, tipo)} pts
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {tip(<>
          <strong style={{ color: 'white' }}>Exemplo:</strong> México 2 × 1 África do Sul — você chutou 2 × 0.
          Vencedor correto (+{pts('GS', 'vencedor')} pts) + gols do México corretos (+{pts('GS', 'gols_equipe')} pts) = <strong style={{ color: 'white' }}>{pts('GS', 'vencedor') + pts('GS', 'gols_equipe')} pts</strong>.
          Placar exato valeria <strong style={{ color: 'white' }}>{pts('GS', 'placar_exato')} pts</strong>.
        </>)}
      </div>

      {/* Special predictions + group bonus */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={topLine} />
        {cardTitle('🌟', 'Palpites especiais')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
          {[
            { icon: '🏆', label: 'Campeão',        pts: 100 },
            { icon: '🥈', label: 'Vice-campeão',   pts: 70  },
            { icon: '⚽', label: 'Artilheiro',     pts: 50  },
            { icon: '🌟', label: 'Melhor Jogador', pts: 50  },
            { icon: '🧤', label: 'Melhor Goleiro', pts: 50  },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#4A90D9' }}>{s.pts} pts</div>
            </div>
          ))}
        </div>

        {/* Group classification bonus */}
        <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🏅</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 3 }}>Bônus de classificação de grupos</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
              Ao término da fase de grupos: <strong style={{ color: '#4ade80' }}>20 pontos</strong> para cada seleção que você previu corretamente como classificada para a fase eliminatória,
              dentro do respectivo grupo (top 2 de cada grupo + 8 melhores 3ºs colocados).
              Máximo de <strong style={{ color: '#4ade80' }}>640 pts</strong> neste critério (32 classificados × 20 pts).
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — 2 cols: rules + FAQ */}
      <div className="instr-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Regras FIFA */}
        <div style={card}>
          <div style={topLine} />
          {cardTitle('📋', 'Regras oficiais da Copa 2026')}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Formato do torneio</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {[
              { n: '48', text: <><strong style={{ color: 'white' }}>seleções</strong> divididas em 12 grupos de 4 times cada (grupos A a L)</> },
              { n: '32', text: <><strong style={{ color: 'white' }}>classificados</strong> — os 2 primeiros de cada grupo + os 8 melhores 3ºs colocados</> },
              { n: '104', text: <><strong style={{ color: 'white' }}>jogos no total</strong> — 48 na fase de grupos + 56 no mata-mata</> },
            ].map(r => (
              <div key={r.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 7, borderLeft: '2px solid rgba(74,144,217,0.4)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#4A90D9', minWidth: 18, marginTop: 1 }}>{r.n}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{r.text}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Critérios de classificação nos grupos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Pontos (vitória = 3 pts · empate = 1 pt · derrota = 0)',
              'Saldo de gols',
              'Gols marcados',
              'Resultado do confronto direto',
              'Fair play (menor número de cartões)',
              'Sorteio',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#4A90D9', minWidth: 18, textAlign: 'center' }}>{i + 1}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={card}>
          <div style={topLine} />
          {cardTitle('❓', 'Dúvidas frequentes')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              {
                q: 'O que conta como placar exato no mata-mata?',
                a: 'O placar ao final de 90 minutos + prorrogação. A cobrança de pênaltis não conta como gols da partida (regulamento, artigo 4).',
              },
              {
                q: 'Posso editar meu placar após enviar?',
                a: 'Sim. Cada partida pode ser editada até 1 hora antes do início do jogo. Atenção: editar um jogo do mata-mata pode apagar os palpites das fases seguintes.',
              },
              {
                q: 'Quantos palpites posso ter?',
                a: 'Ilimitados. Cada palpite pago custa R$ 30,00 e concorre de forma independente no ranking.',
              },
              {
                q: 'O que são os "gols de uma equipe" (cumulativo)?',
                a: <>Se o México ganha 2 × 0 e você chutou 2 × 1, você acerta o vencedor (+{pts('GS', 'vencedor')} pts) E os gols do México (+{pts('GS', 'gols_equipe')} pts), totalizando {pts('GS', 'vencedor') + pts('GS', 'gols_equipe')} pts.</>,
              },
              {
                q: 'Como funciona o empate no ranking?',
                a: 'Em caso de empate em pontos, vence quem tiver mais acertos de placar exato. Se ainda empatar, vence quem se cadastrou primeiro.',
              },
            ].map((faq, idx) => (
              <div key={idx} style={{ paddingTop: idx > 0 ? 12 : 0, borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', marginTop: idx > 0 ? 12 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 3 }}>{faq.q}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
