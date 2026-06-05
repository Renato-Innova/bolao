# Bolão Copa 2026 — Project Instructions

## Overview
A FIFA World Cup 2026 sweepstakes (bolão) platform. Users sign up, create prediction entries (palpites) for all 104 matches, and compete for prizes. Each entry must be paid via PIX to count in the competition.

The admin (Renato) is the only one who inserts official match results and manages platform settings.

---

## Commands

```bash
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint check
```

---

## Tech Stack

- **Frontend/Backend:** Next.js with TypeScript (App Router, `src/` dir)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Email + password via Supabase Auth
- **Hosting:** Vercel — auto-deploy on push to `main`
- **Styling:** Tailwind CSS + inline styles (no tailwind.config content array)
- **Fonts:** Bebas Neue (titles) + Inter (body) via Google Fonts
- **Flags:** flagcdn.com public API — never use emoji flags in tables
- **Repository:** https://github.com/Renato-Innova/bolao

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://tdumchsivwormisjonrg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   ← server-side only, never exposed to frontend
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=renatoclpereira@gmail.com
```

---

## Folder Structure

```
src/
  app/
    layout.tsx
    page.tsx
    globals.css           ← CSS variables, responsive rules, global styles
    dashboard/page.tsx
    tabela/page.tsx
    palpites/page.tsx
    ranking/page.tsx
    instrucoes/page.tsx
    admin/
      resultados/page.tsx
      configuracoes/page.tsx
    auth/
      login/page.tsx
      register/page.tsx
      callback/route.ts
    api/
      admin/
        resultado/route.ts
        advance-bracket/route.ts
      palpites/
        [id]/route.ts
        [id]/downstream-impact/route.ts
        [id]/cascade-clear/route.ts
  components/
    layout/
      Header.tsx
      BottomNav.tsx
      Footer.tsx
      HeroStrip.tsx
      HeroStripWrapper.tsx
    palpites/
      PalpitesClient.tsx    ← main palpites UI (all tabs, MatchCard, KO logic)
    admin/
      AdminResultadosClient.tsx
      AdminConfigClient.tsx
    ranking/
      RankingPodio.tsx
      RankingTabela.tsx
    tabela/
      TabelaClient.tsx
    ui/
      Button.tsx
      Card.tsx
      Badge.tsx
      FlagImg.tsx
  lib/
    supabase/
      client.ts             ← browser Supabase client
      server.ts             ← server Supabase client
  services/
    jogos.ts
    palpites.ts
    pontuacao.ts
    ranking.ts
    resultados.ts
    bracketSlots.ts
  types/
    index.ts                ← all shared TypeScript interfaces
  utils/
    constants.ts            ← PIX_VALOR, PIX_CHAVE, GRUPOS, TEAM_ABBR, FASES
    helpers.ts
  proxy.ts
```

---

## Design System

### Color Palette (CSS variables in `src/app/globals.css`)

```css
:root {
  --bg:    #020F2A          /* main background — FIFA navy */
  --card:  #0D1E3D          /* cards and panels */
  --accent:#4A90D9          /* light blue — highlights, borders, points */
  --al:    #7BB8F0          /* secondary highlight / lighter accent */
  --border:rgba(74,144,217,0.15)   /* default card borders */
  --ba:    rgba(74,144,217,0.40)   /* active/focused borders */
  --tm:    rgba(255,255,255,0.65)  /* secondary text */
  --td:    rgba(255,255,255,0.45)  /* muted text */
  --ok:    #4ade80          /* success / active / live */
  --err:   rgba(255,100,100,0.75)  /* error / negative */
}
```

Design reference: dark navy background, semi-transparent cards, white text, blue accents.
Premium FIFA-style look — never use dark blue as text color.

### Typography
- **Titles / logo:** `Bebas Neue` — bold, uppercase, letter-spacing
- **Body / UI:** `Inter` — weights 400, 500, 600, 700
- Section labels: uppercase, letter-spacing 0.5–1px, font-size 10–11px

### Flags
```
https://flagcdn.com/w40/{country-code}.png
```
Standard dimensions in tables: width 18–20px, height 12–14px, border-radius 2px.
Always use `flagcdn.com` images — never emoji flags.

### Cards
```css
background: #0D1E3D;
border: 1px solid rgba(74,144,217,0.15);
border-radius: 8–10px;
```

### Buttons
- **Primary:** `background: linear-gradient(90deg,#4A90D9,#1a5ca8)`, white text, uppercase, font-weight 700
- **Secondary:** `background: rgba(255,255,255,0.07)`, color rgba(255,255,255,0.6)

### Score inputs (ScoreControl / ScoreBtn)
- Unset state uses `-1` as sentinel value — displayed as `—` in the UI
- 0 is a valid score (a real nil-nil result)
- Increment from -1 goes to 0; decrement at 0 stays at 0; decrement at -1 stays at -1

---

## Database — Supabase

### Connection
- **Project ID:** tdumchsivwormisjonrg
- **URL:** https://tdumchsivwormisjonrg.supabase.co
- **Region:** sa-east-1 (São Paulo)

### users
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK — auth.users |
| email | text | unique |
| nome | text | |
| telefone | text | nullable |
| is_admin | boolean | default false |
| criado_em | timestamp | |
| atualizado_em | timestamp | |

### jogos_copa
| Field | Type | Notes |
|---|---|---|
| id | serial | PK |
| numero_jogo | integer | nullable |
| fase | text | `GS \| R32 \| R16 \| QF \| SF \| TPL \| F` |
| grupo | text | nullable (A–L, group stage only) |
| rodada | integer | nullable |
| data | date | |
| horario | time | Brasília timezone (BRT / UTC-3) |
| time_a | text | |
| time_b | text | |
| codigo_pais_a | text | flagcdn.com code |
| codigo_pais_b | text | flagcdn.com code |
| estadio | text | |
| cidade | text | |
| pais_sede | text | |
| criado_em | timestamp | |

Knockout team slots use bracket placeholders (e.g. `"Vencedor J3"`, `"1º Grupo A"`) until the admin fills them after the group stage. `isPlaceholder()` in `PalpitesClient.tsx` detects these.

### resultados
| Field | Type | Notes |
|---|---|---|
| id | serial | PK |
| jogo_id | integer | FK jogos_copa, unique |
| placar_real_a | integer | |
| placar_real_b | integer | |
| placar_penalti_a | integer | nullable — KO shootout only |
| placar_penalti_b | integer | nullable |
| artilheiro_copa | text | nullable — filled at end of tournament |
| inserido_em | timestamp | |
| atualizado_em | timestamp | |

### palpites
| Field | Type | Notes |
|---|---|---|
| id | serial | PK |
| usuario_id | uuid | FK users |
| nome | text | entry name shown in ranking |
| status | text | `ativo \| inativo` |
| artilheiro | text | predicted top scorer |
| melhor_jogador | text | predicted best player |
| melhor_goleiro | text | predicted best goalkeeper |
| json_backup | jsonb | nullable |
| criado_em | timestamp | |
| atualizado_em | timestamp | |

### palpites_jogos
| Field | Type | Notes |
|---|---|---|
| id | serial | PK |
| palpite_id | integer | FK palpites |
| jogo_id | integer | FK jogos_copa |
| placar_palpite_a | integer | nullable |
| placar_palpite_b | integer | nullable |
| placar_penalti_a | integer | nullable — KO shootout prediction |
| placar_penalti_b | integer | nullable |
| pontos | integer | default 0 — updated when admin enters result |
| submitted_at | timestamp | null = not yet submitted |
| criado_em | timestamp | |
| atualizado_em | timestamp | |

### configuracoes_pontuacao
| Field | Type | Notes |
|---|---|---|
| id | serial | PK |
| fase | text | |
| tipo_acerto | text | `placar_exato \| vencedor` |
| pontos | integer | |
| atualizado_em | timestamp | |

---

## Business Rules

### Predictions (Palpites)
- User creates a named entry — starts as `inativo`
- Entry is activated after admin confirms PIX payment (R$ 40,00 per entry)
- Inactive entries cannot be activated after the competition starts
- A user can have multiple entries

### Match Prediction Flow
- Unsubmitted scores use `-1` sentinel (displayed as `—`) — 0 is a valid score
- User sets both scores then clicks "Enviar placar" → `submitted_at` is set
- After submission, card shows official result + points earned (once admin enters result)
- Predictions can be edited up to 1 hour before kick-off
- Editing a KO game that feeds into later rounds triggers a cascade clear dialog

### Knockout Phase Locking
- R32 unlocks only after the admin fills all bracket slots (no placeholders)
- Each subsequent KO phase unlocks only after all games in the previous phase are submitted
- `isPhaseLocked()` in `PalpitesClient.tsx` enforces these rules

### Scoring — Official Regulation (Regulamento v1.0)

**Five cumulative criteria per match:**
| Criteria | Description |
|---|---|
| `placar_exato` | Exact 90+ET score — maximum, **not** cumulative with gols |
| `empate` | Predicted draw AND actual draw (wrong score) |
| `vencedor` | Correct winner (wrong score) |
| `gols_equipe` | Correct goals of ONE team — **cumulative** with vencedor/empate |
| `penalti` | Correct penalty-shootout winner — **cumulative** with all (KO only) |

**Official point values per phase:**
| Phase | Exato | Empate | Vencedor | Gols | Pênaltis |
|---|---|---|---|---|---|
| GS | 20 | 15 | 10 | 5 | 5 |
| R32 | 30 | 22 | 15 | 8 | 8 |
| R16 | 40 | 30 | 20 | 10 | 10 |
| QF | 60 | 40 | 30 | 15 | 15 |
| SF | 80 | 60 | 40 | 20 | 20 |
| TPL | 100 | 75 | 50 | 25 | 25 |
| F | 120 | 75 | 60 | 30 | 30 |

**KO rules:**
- Result = 90 min + extra time (admin enters ET score, not just 90-min)
- Penalty shootout scores are NOT counted as match goals (regulation note 4)
- KO draws that go to penalties: can score empate + penalti, or gols + penalti

**Special predictions:**
| Prediction | Points |
|---|---|
| Campeão | 100 |
| Vice-campeão | 70 |
| Artilheiro | 50 |
| Melhor Jogador | 50 |
| Melhor Goleiro | 50 |

**Group classification bonus:** 20 pts per team correctly predicted to qualify from the group stage (not yet implemented — Phase 2 backlog).

**Implementation:** `src/utils/scoring.ts` — `calcularPontos()` for match points, `calcularPontosEspeciais()` for special predictions. Values stored in `configuracoes_pontuacao` (admin-configurable). Special results stored in `resultados_especiais` (single-row table).

### Tournament Structure
- 48 teams in 12 groups of 4 (A–L)
- Top 2 from each group + 8 best third-place teams advance → 32 in KO
- Phases: Group Stage (GS) → Round of 32 (R32) → Round of 16 (R16) → Quarters (QF) → Semis (SF) → Third-place play-off (TPL) + Final (F)
- 104 matches total

### FIFA Standings Tiebreakers
1. Points (W=3, D=1, L=0)
2. Goal difference
3. Goals scored
4. Head-to-head result
5. Fair play (cards)
6. Drawing of lots

---

## Authentication
- Email + password via Supabase Auth
- On signup, email and name saved to `users` table
- Admin identified by `is_admin = true`
- `/admin/*` routes restricted to admins only

---

## Payment
- PIX — R$ 40,00 per entry
- Manual confirmation by admin → sets `status = 'ativo'`
- PIX key and value defined in `src/utils/constants.ts` (`PIX_CHAVE`, `PIX_VALOR`)

---

## Deployment

- **Vercel:** auto-deploy on push to `main`
- **GitHub:** https://github.com/Renato-Innova/bolao
- Set all `.env.local` vars in Vercel dashboard
- `SUPABASE_SERVICE_ROLE_KEY` must be server-side only — never in `NEXT_PUBLIC_*`

---

## Code Standards

- Score sentinel: always use `-1` for "not entered", never `0` as default
- Comments: explain the *why*, not the *what*
- No duplicate logic — reuse functions and hooks
- Keep `PalpitesClient.tsx` sections clearly separated by comment banners (`/* ─── */`)
- Match card components: `MatchCard` (group stage) and `KnockoutGameCard` (KO rounds) share the same bottom footer pattern — keep them in sync
