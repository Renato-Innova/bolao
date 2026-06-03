import { createClient } from '@/lib/supabase/server'
import type { ConfiguracaoPontuacao } from '@/types'

export const dynamic = 'force-dynamic'

const FASES_ORDER = ['GS', 'R32', 'R16', 'QF', 'SF', 'F'] as const
const FASES_LABEL: Record<string, string> = {
  GS:  'Fase de Grupos',
  R32: 'Segundas de Final',
  R16: 'Oitavas de Final',
  QF:  'Quartas de Final',
  SF:  'Semifinal',
  F:   'Final',
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

  const configMap: Record<string, Record<string, number>> = {}
  for (const c of (configs ?? []) as ConfiguracaoPontuacao[]) {
    if (!configMap[c.fase]) configMap[c.fase] = {}
    configMap[c.fase][c.tipo_acerto] = c.pontos
  }

  function pts(fase: string, tipo: string, fallback: number) {
    return configMap[fase]?.[tipo] ?? fallback
  }

  // fallbacks matching reference HTML
  const scoring: Record<string, { exato: number; vencedor: number }> = {
    GS:  { exato: pts('GS',  'placar_exato',  10), vencedor: pts('GS',  'vencedor',   5) },
    R32: { exato: pts('R32', 'placar_exato',  20), vencedor: pts('R32', 'vencedor',  10) },
    R16: { exato: pts('R16', 'placar_exato',  40), vencedor: pts('R16', 'vencedor',  20) },
    QF:  { exato: pts('QF',  'placar_exato',  60), vencedor: pts('QF',  'vencedor',  30) },
    SF:  { exato: pts('SF',  'placar_exato',  80), vencedor: pts('SF',  'vencedor',  40) },
    F:   { exato: pts('F',   'placar_exato', 100), vencedor: pts('F',   'vencedor',  50) },
  }

  return (
    <div className="page-main" style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 48px', position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 4 }}>Instruções do bolão</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>Tudo que você precisa saber pra participar e ganhar</div>

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
              { n: 3, title: 'Envie o placar de cada jogo individualmente', desc: <>Chute o placar de cada partida clicando em "Enviar placar". Também indique o <strong style={{ color: 'white' }}>artilheiro</strong> da Copa — esse campo fica travado após o início.</> },
              { n: 4, title: 'Ative pagando R$ 40,00 via PIX', desc: <>Palpites não pagos não valem pra competição. <strong style={{ color: 'white' }}>Após o início da Copa não é mais possível ativar.</strong> Não perca o prazo!</> },
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
                { icon: '📱', title: 'PIX via QR Code', desc: <>Ao clicar em "Pagar e ativar", um QR code PIX é gerado. Valor: <strong style={{ color: 'white' }}>R$ 40,00 por palpite</strong>.</> },
                { icon: '✅', title: 'Ativação do palpite', desc: 'Após confirmação do pagamento, seu palpite é ativado automaticamente e passa a valer no ranking.' },
                { icon: '⏰', title: 'Prazo de ativação', desc: <>Palpites não pagos <strong style={{ color: 'white' }}>não podem ser ativados após o início da Copa</strong> (11 de junho). Não deixe pra última hora.</> },
                { icon: '♾️', title: 'Mata-mata incluso', desc: 'Um único pagamento cobre todas as fases. Conforme a Copa avança, você edita o mesmo palpite sem pagar novamente.' },
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
        <div className="instr-score-wrap">
        <table className="instr-score-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Fase', 'Placar exato', 'Vencedor / Empate', 'Artilheiro'].map((h, i) => (
                <th key={h} className={i === 3 ? 'instr-col-hide' : ''} style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '6px 10px', textAlign: h === 'Fase' ? 'left' : 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FASES_ORDER.map((fase, idx) => {
              const isHighlight = idx % 2 === 1
              const s = scoring[fase]
              return (
                <tr key={fase} style={{ background: isHighlight ? 'rgba(74,144,217,0.07)' : 'transparent' }}>
                  <td style={{ fontSize: 12, color: 'white', fontWeight: 600, padding: '8px 10px', borderBottom: idx < FASES_ORDER.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>{FASES_LABEL[fase]}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: '#4A90D9', padding: '8px 10px', textAlign: 'center', borderBottom: idx < FASES_ORDER.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>{s.exato} pts</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: '#4A90D9', padding: '8px 10px', textAlign: 'center', borderBottom: idx < FASES_ORDER.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>{s.vencedor} pts</td>
                  {idx === 0 && (
                    <td rowSpan={6} className="instr-col-hide" style={{ fontSize: 14, fontWeight: 700, color: '#4A90D9', padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>40 pts</td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>{/* instr-score-wrap */}

        {/* Mobile-only specials mini-grid (hidden on desktop via CSS) */}
        <div className="instr-specials-mini" style={{ display: 'none', gridTemplateColumns: '1fr', gap: 8, marginTop: 12 }}>
          {[{ icon: '⚽', label: 'Artilheiro', val: '40 pts' }].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#4A90D9' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {tip('Os pontos dobram a cada fase — quem não foi bem nos grupos ainda pode virar o jogo no mata-mata!')}
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
                q: 'Posso editar meu placar após enviar?',
                a: 'Sim. Cada partida pode ser editada até 1 hora antes do início do jogo. O palpite do artilheiro fica travado no início da Copa (11 de junho).',
              },
              {
                q: 'Quantos palpites posso ter?',
                a: 'Ilimitados. Cada palpite pago custa R$ 40,00 e concorre de forma independente no ranking. Você pode fazer pra sua família também.',
              },
              {
                q: 'Palpite não pago vale alguma coisa?',
                a: 'Não. Apenas palpites ativos (pagos) são contabilizados no ranking e podem ganhar prêmios.',
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
