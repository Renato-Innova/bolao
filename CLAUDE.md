# Bolao Copa 2026 - Project Instructions

## Overview
A FIFA World Cup 2026 sweepstakes (bolÃ£o) platform where users sign up, create predictions for all matches, and compete for prizes. Access is free, but each prediction entry must be paid to count in the competition.

The admin (Renato) is the only one who inserts match results and manages platform settings.

---

## Getting Started â€” Do This First

Follow this exact order when setting up the project:

### Step 1 â€” Clone the repository
```bash
git clone https://github.com/Renato-Innova/bolao
cd bolao
```

### Step 2 â€” Create the Next.js project
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

### Step 3 â€” Install dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install @google-fonts/bebas-neue
```

### Step 4 â€” Create the .env.local file
```
NEXT_PUBLIC_SUPABASE_URL=https://tdumchsivwormisjonrg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdW1jaHNpdndvcm1pc2pvbnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTc0ODksImV4cCI6MjA5NTczMzQ4OX0.6_LyGdBRA_Ge2nlTdGN5N4yaru0ipMOISxNsxwL30lk
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdW1jaHNpdndvcm1pc2pvbnJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE1NzQ4OSwiZXhwIjoyMDk1NzMzNDg5fQ.qYrWZHPax-o0hCRgx1h0VcvGKO9mxBGc-71tAIUerL8
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=renatoclpereira@gmail.com
```

### Step 5 â€” Create the database tables on Supabase
Run the SQL scripts in this order on the Supabase SQL Editor:
1. Create tables (users, jogos_copa, resultados, palpites, palpites_jogos, configuracoes_pontuacao)
2. Run the seed script to insert all 104 World Cup matches with flag codes

### Step 6 â€” Build the app in this priority order
1. Layout and Header component
2. Authentication (email + password via Supabase Auth)
3. Official standings page (tabela) â€” all 12 groups with real flags
4. Dashboard page
5. Predictions page (palpites)
6. Ranking page
7. Instructions page
8. Admin panel (results + configuration)

### Step 7 â€” Run locally
```bash
npm run dev
```

### Step 8 â€” Push to GitHub
```bash
git add .
git commit -m "initial project setup"
git push origin main
```

---

## Tech Stack
- **Frontend/Backend:** Next.js with TypeScript (App Router)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Email and password via Supabase Auth (Google OAuth can be added later)
- **Hosting:** Vercel (connected to GitHub repo â€” auto-deploy on push to main)
- **Styling:** Tailwind CSS + Google Fonts (Bebas Neue + Inter)
- **Flags:** flagcdn.com public API
- **Repository:** https://github.com/Renato-Innova/bolao

---

## Design System â€” FIFA World Cup 2026â„¢ Visual Identity

### Reference
Design inspired by the official FIFA website: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026
Dark navy blue background, semi-transparent cards, white text, blue accents. Premium and clean look.

### Color Palette
```
--color-bg-primary:     #020F2A   /* main background, FIFA navy blue */
--color-bg-card:        #0D1E3D   /* cards and panels */
--color-bg-card-hover:  #112347   /* card hover state */
--color-bg-hero:        #091a42   /* hero strips and highlighted sections */
--color-accent:         #4A90D9   /* light blue â€” highlights, points, borders */
--color-accent-light:   #7BB8F0   /* secondary highlight text */
--color-border:         rgba(74, 144, 217, 0.15)  /* default borders */
--color-border-accent:  rgba(74, 144, 217, 0.40)  /* active borders */
--color-text-primary:   #FFFFFF
--color-text-secondary: rgba(255, 255, 255, 0.45)
--color-text-muted:     rgba(255, 255, 255, 0.25)
--color-success:        #4ade80   /* green â€” live status, active */
--color-danger:         rgba(255, 100, 100, 0.7)  /* negative goal difference */
```

### Typography
- **Titles and logo:** `Bebas Neue` â€” bold, uppercase, spaced
- **Body and UI:** `Inter` â€” weights 400, 500, 600, 700
- Section labels: uppercase, letter-spacing 0.5â€“1px, font-size 10â€“11px
- Never use dark blue as text color â€” always white or white tones

### Logo in Header
The Copa 2026 logo is represented typographically using Bebas Neue:
```
26          â† large font, white, negative letter-spacing
FIFA        â† smaller, uppercase, spaced
WORLD CUPâ„¢  â† even smaller, rgba(255,255,255,0.4)
```
No background, no black box. The logo floats directly over `#020F2A`.
To the right: subtle vertical divider + "BolÃ£o Copa 2026" in Inter 700.

### Country Flags
Use the public `flagcdn.com` API for all flags:
```
https://flagcdn.com/{country-code}.svg
```
Examples: `br.svg`, `ar.svg`, `fr.svg`, `de.svg`, `es.svg`, `pt.svg`
Standard dimensions in tables: width 18â€“20px, height 12â€“14px, border-radius 2px.
Never use emoji flags in tables â€” always use flagcdn.com images.

### Cards
```css
background: #0D1E3D;
border: 1px solid rgba(74, 144, 217, 0.15);
border-radius: 8px;
```
Selected/active card:
```css
border-color: #4A90D9;
background: #112347;
```
Highlighted card (e.g. next match):
```css
border-color: rgba(74, 144, 217, 0.40);
background: rgba(74, 144, 217, 0.06);
```

### Top accent line on cards
Every main card has a colored line at the top:
```css
position: relative;
::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #4A90D9, #1a5ca8);
}
```

### Buttons
- **Primary:** `background: linear-gradient(90deg, #4A90D9, #1a5ca8)`, white text, uppercase, font-weight 700
- **Secondary:** `background: rgba(255,255,255,0.07)`, color rgba(255,255,255,0.6)
- **Pay via PIX:** same as primary, prominent placement

### Badges / Pills
```css
/* Active / Live */
background: rgba(74, 222, 128, 0.15); color: #4ade80;

/* Inactive / Pending */
background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.4);

/* Phase / Category */
background: rgba(74,144,217,0.18); border: 1px solid rgba(74,144,217,0.35); color: #7BB8F0;

/* Finished */
background: rgba(74,144,217,0.15); color: #7BB8F0;

/* Today / Soon */
background: rgba(74,222,128,0.15); color: #4ade80;
```

### Points and Numeric Values
- Prediction points: `color: #4A90D9`, font-weight 700, larger font-size
- Ranking position: rgba(255,255,255,0.25) generic; #4A90D9 for the logged-in user's entry
- Positive goal difference: rgba(255,255,255,0.6)
- Negative goal difference: rgba(255,100,100,0.7)

### Score Inputs
```css
border: 1px solid rgba(74,144,217,0.4);
border-radius: 6px;
background: rgba(74,144,217,0.08);
color: #4A90D9; font-weight: 700; font-size: 16px;
text-align: center; width: 32px; height: 32px;
```

### Progress Bar
```css
/* Track */
background: rgba(255,255,255,0.08); height: 3px; border-radius: 2px;
/* Fill */
background: linear-gradient(90deg, #4A90D9, #7BB8F0);
```

### Hero Strip (context bar below header)
```css
background: linear-gradient(90deg, #04143a 0%, #091d50 50%, #0a1f4e 100%);
border-bottom: 1px solid rgba(74,144,217,0.18);
padding: 10px 20px;
```

### Mobile Responsiveness
- Mobile may have reduced features â€” evaluate case by case
- On mobile: hamburger menu, single column cards, horizontal scroll on tables
- Keep the visual identity â€” do not change background or colors on mobile

---

## Folder Structure (Modular)

```
bolao/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ layout.tsx
â”‚   â”‚   â”œâ”€â”€ page.tsx
â”‚   â”‚   â”œâ”€â”€ dashboard/
â”‚   â”‚   â”‚   â””â”€â”€ page.tsx
â”‚   â”‚   â”œâ”€â”€ tabela/
â”‚   â”‚   â”‚   â””â”€â”€ page.tsx
â”‚   â”‚   â”œâ”€â”€ palpites/
â”‚   â”‚   â”‚   â””â”€â”€ page.tsx
â”‚   â”‚   â”œâ”€â”€ ranking/
â”‚   â”‚   â”‚   â””â”€â”€ page.tsx
â”‚   â”‚   â”œâ”€â”€ instrucoes/
â”‚   â”‚   â”‚   â””â”€â”€ page.tsx
â”‚   â”‚   â”œâ”€â”€ admin/
â”‚   â”‚   â”‚   â”œâ”€â”€ resultados/
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ page.tsx
â”‚   â”‚   â”‚   â””â”€â”€ configuracoes/
â”‚   â”‚   â”‚       â””â”€â”€ page.tsx
â”‚   â”‚   â””â”€â”€ auth/
â”‚   â”‚       â”œâ”€â”€ login/
â”‚   â”‚       â”‚   â””â”€â”€ page.tsx
â”‚   â”‚       â”œâ”€â”€ register/
â”‚   â”‚       â”‚   â””â”€â”€ page.tsx
â”‚   â”‚       â””â”€â”€ callback/
â”‚   â”‚           â””â”€â”€ route.ts
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ ui/
â”‚   â”‚   â”‚   â”œâ”€â”€ Button.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Card.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Badge.tsx
â”‚   â”‚   â”‚   â””â”€â”€ FlagImg.tsx        â† reusable flag component using flagcdn.com
â”‚   â”‚   â”œâ”€â”€ layout/
â”‚   â”‚   â”‚   â”œâ”€â”€ Header.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Navigation.tsx
â”‚   â”‚   â”‚   â””â”€â”€ Footer.tsx
â”‚   â”‚   â”œâ”€â”€ tabela/
â”‚   â”‚   â”‚   â”œâ”€â”€ TabelaOficial.tsx  â† all 12 groups
â”‚   â”‚   â”‚   â””â”€â”€ TabelaGrupo.tsx    â† single group card
â”‚   â”‚   â”œâ”€â”€ palpites/
â”‚   â”‚   â”‚   â”œâ”€â”€ CardPalpite.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ FormPalpite.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ JogoCard.tsx       â† match card with score inputs
â”‚   â”‚   â”‚   â””â”€â”€ ListaPalpites.tsx
â”‚   â”‚   â””â”€â”€ ranking/
â”‚   â”‚       â”œâ”€â”€ RankingPodio.tsx
â”‚   â”‚       â””â”€â”€ RankingTabela.tsx
â”‚   â”œâ”€â”€ lib/
â”‚   â”‚   â”œâ”€â”€ supabase/
â”‚   â”‚   â”‚   â”œâ”€â”€ client.ts          â† browser client
â”‚   â”‚   â”‚   â””â”€â”€ server.ts          â† server client
â”‚   â”‚   â””â”€â”€ utils.ts
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ auth.ts
â”‚   â”‚   â”œâ”€â”€ palpites.ts
â”‚   â”‚   â”œâ”€â”€ jogos.ts
â”‚   â”‚   â”œâ”€â”€ resultados.ts
â”‚   â”‚   â””â”€â”€ pontuacao.ts
â”‚   â”œâ”€â”€ types/
â”‚   â”‚   â””â”€â”€ index.ts
â”‚   â””â”€â”€ utils/
â”‚       â”œâ”€â”€ constants.ts           â† all 48 teams with flag codes
â”‚       â””â”€â”€ helpers.ts
â”œâ”€â”€ public/
â”œâ”€â”€ .env.local
â”œâ”€â”€ .env.example
â”œâ”€â”€ next.config.ts
â”œâ”€â”€ tailwind.config.ts
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ package.json
â””â”€â”€ README.md
```

---

## Database â€” Supabase Tables

### Connection Details
- **Project name:** Bolao Copa 2026
- **Project ID:** tdumchsivwormisjonrg
- **URL:** https://tdumchsivwormisjonrg.supabase.co
- **Region:** sa-east-1 (South America â€” SÃ£o Paulo)

### users
| Field | Type | Description |
|---|---|---|
| id | uuid | primary key |
| email | text | unique, not null |
| nome | text | not null |
| telefone | text | nullable |
| is_admin | boolean | default false |
| criado_em | timestamp | default now() |
| atualizado_em | timestamp | default now() |

### jogos_copa
| Field | Type | Description |
|---|---|---|
| id | uuid | primary key |
| fase | text | grupos, oitavas, quartas, semis, final |
| grupo | text | nullable (A through L) |
| rodada | integer | 1, 2, 3 within the phase |
| data | date | not null |
| horario | time | BrasÃ­lia timezone (BRT / UTC-3) |
| time_a | text | not null |
| time_b | text | not null |
| codigo_pais_a | text | flagcdn.com code (e.g. br, ar, fr) |
| codigo_pais_b | text | flagcdn.com code |
| estadio | text | not null |
| cidade | text | not null |
| criado_em | timestamp | default now() |

### resultados
| Field | Type | Description |
|---|---|---|
| id | uuid | primary key |
| jogo_id | uuid | foreign key jogos_copa, unique |
| placar_real_a | integer | not null |
| placar_real_b | integer | not null |
| artilheiro_copa | text | nullable, filled at end of tournament |
| inserido_em | timestamp | default now() |
| atualizado_em | timestamp | default now() |

### palpites
| Field | Type | Description |
|---|---|---|
| id | uuid | primary key |
| usuario_id | uuid | foreign key users |
| nome | text | entry name, shown in ranking |
| status | text | ativo, inativo |
| campeao | text | predicted champion team |
| vice_campeao | text | predicted runner-up team |
| artilheiro | text | predicted top scorer |
| json_backup | jsonb | full snapshot of the entry |
| criado_em | timestamp | default now() |
| atualizado_em | timestamp | default now() |

**Entry rules:**
- campeao, vice_campeao and artilheiro are filled during the group stage and locked after the competition starts
- Inactive entries cannot be activated after the competition starts
- A user can have unlimited entries

### palpites_jogos
| Field | Type | Description |
|---|---|---|
| id | uuid | primary key |
| palpite_id | uuid | foreign key palpites |
| jogo_id | uuid | foreign key jogos_copa |
| placar_palpite_a | integer | nullable |
| placar_palpite_b | integer | nullable |
| pontos | integer | default 0 |
| criado_em | timestamp | default now() |
| atualizado_em | timestamp | default now() |

### configuracoes_pontuacao
| Field | Type | Description |
|---|---|---|
| id | uuid | primary key |
| fase | text | grupos, oitavas, quartas, semis, final |
| tipo_acerto | text | placar_exato, vencedor |
| pontos | integer | not null |
| atualizado_em | timestamp | default now() |

**Scoring logic:**
- Points increase as the tournament advances through phases
- Correct exact score = more points than correct winner only
- Champion, runner-up and top scorer have extra configurable points
- All scoring configured by admin â€” never hardcoded
- Scoring configuration visible only in admin panel

---

## Business Rules

### Predictions (Palpites)
- User creates a named entry â€” starts as inactive
- Group stage: entries can be created and edited freely
- Activated entry = paid via PIX (R$ 40.00 per entry)
- After competition starts, inactive entries cannot be activated
- Group stage: user fills in all group matches + champion + runner-up + top scorer
- Knockout stage: user can edit predictions up to 1 hour before each match
- When editing knockout predictions, user can see all group stage results for reference

### Scoring System
- Correct exact score = more points
- Correct winner/draw = fewer points
- Points grow per phase (groups < round of 16 < quarters < semis < final)
- Champion, runner-up and top scorer = extra points (admin configurable)
- All points calculated automatically when admin inserts a result
- Scoring settings visible only in admin panel

### FIFA World Cup Standing Rules
Official table follows:
1. Points (win = 3, draw = 1, loss = 0)
2. Goal difference
3. Goals scored
4. Head-to-head result
5. Fair play (cards)
6. Drawing of lots

### Tournament Structure
- 48 teams in 12 groups of 4 (groups A through L)
- Top 2 from each group advance + 8 best third-place teams
- Total of 32 teams in the knockout stage
- 104 matches total

---

## Pages and Features

### Dashboard (public)
- Quick metrics: active entries, matches played, leaderboard leader, next match
- Summarized official standings (featured group)
- Latest results and upcoming matches with date, time, city and flags
- Partial ranking with link to full ranking

### Official Standings â€” Tabela (public)
- All 12 groups with 4 teams each
- Each group shows: position, flag, team name, P, W, GD, GF, Pts
- Visual highlight for qualifying positions (1st and 2nd in each group)
- Legend explaining classification criteria
- Real flags via flagcdn.com

### Predictions â€” Palpites (requires login)
- User's entry cards showing name, status (active/inactive), points and progress
- Matches organized by group with score input fields
- Special fields: champion, runner-up, top scorer (locked after competition starts)
- Finished match: card blocked with visual indication
- "Pay and activate via PIX" button prominently at the bottom

### Ranking (public)
- Visual podium for top 3 (1st place highlighted with crown)
- Table with position, entry name, user, correct predictions, points, position change (â†‘â†“)
- Logged-in user's entry highlighted with blue border and "vocÃª" tag
- Updates automatically when admin inserts a result

### Instructions (public)
- How the sweepstakes works
- How to create and fill predictions
- Scoring system per phase (values defined by admin)
- How to activate entry via payment
- Importance of the entry name (shown in ranking)
- Official FIFA World Cup 2026 rules (standings, tiebreakers, knockout format)

### Admin â€” Results (admin only)
- Insert match scores
- System automatically calculates points for all affected entries
- Updates official standings and ranking

### Admin â€” Settings (admin only)
- Configure scoring per phase and prediction type
- Configure champion, runner-up and top scorer points
- Manage users
- Confirm payments and manually activate entries

---

## Authentication
- Email and password via Supabase Auth (Google OAuth can be added later)
- On signup, system saves email and name to users table
- Admin identified by is_admin = true in users table
- Route protection: /admin/* accessible only when is_admin = true

---

## Payment
- PIX with QR code â€” R$ 40.00 per entry
- Evaluating automatic release vs manual confirmation by admin
- Entry stays inactive until payment is confirmed
- Structure ready to integrate Mercado Pago or similar later

---

## Hosting and Deployment

### Vercel
- Account created and connected to GitHub repository
- Auto-deploy on every push to main branch
- Environment variables must be configured in Vercel dashboard (same as .env.local)

### GitHub
- Repository: https://github.com/Renato-Innova/bolao

---

## Development Priorities

### Phase 1 â€” Before competition starts (June 11) â€” CRITICAL
1. Next.js project setup + Supabase + Tailwind + fonts
2. Email and password authentication
3. Database seed: all 104 matches with flag codes
4. Official standings page with all 12 groups and real flags
5. Dashboard with metrics and matches
6. Predictions page (create, edit, list)
7. Instructions page
8. Admin: insert results and configure scoring

### Phase 2 â€” During the competition
1. Automatic scoring calculation when result is inserted
2. Dynamic ranking with position change tracking
3. PIX payment integration (Mercado Pago or manual)
4. Knockout stage prediction editing
5. Mobile UX improvements

### Phase 3 â€” Future
1. World Cup API integration for automatic updates
2. Graphic ranking visualization (soccer field style)
3. Email or WhatsApp notifications
4. Google OAuth login

---

## Important Notes
- Competition starts June 11, 2026. Phase 1 is critical â€” must be ready before that date
- Inactive entries cannot be activated after competition starts
- Scoring system must be flexible and configurable by admin â€” never hardcoded
- Responsive design but mobile may have reduced features
- All times displayed in BrasÃ­lia timezone (BRT / UTC-3)
- Flags always via flagcdn.com â€” never use emoji flags in tables
- Scoring settings visible ONLY in admin panel
- service_role key must never be exposed to the frontend â€” server-side only
