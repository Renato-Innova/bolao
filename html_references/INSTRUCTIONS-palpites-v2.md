# Palpites Page — v2 Instructions for Claude Code

## Files to reference
- Desktop: `reference-ui/06-palpites-v2.html`
- Mobile: `reference-ui/m-06-palpites-v2.html`

## Overview
Rebuild the palpites page (`/palpites`) to match the v2 reference files exactly.
This replaces the previous implementation entirely.

---

## 1. Database changes — apply first

```sql
-- Remove champion and runner-up columns (no longer used)
ALTER TABLE palpites DROP COLUMN IF EXISTS campeao;
ALTER TABLE palpites DROP COLUMN IF EXISTS vice_campeao;
```

Also update the `palpites_jogos` table to support per-match submission tracking:

```sql
-- Add submitted_at so we know when each match score was submitted
ALTER TABLE palpites_jogos ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
```

---

## 2. Match card layout

Each match card must show:

```
[meta: date · time · city]              [✓] [⋮]
[flag] [team]  [−][score][+] × [−][score][+]  [team] [flag]
               [Enviar placar button]
```

Rules:
- Home score and away score are fully independent
- Each score has its own [−] and [+] buttons on its LEFT and RIGHT respectively
- Layout: `[−] [number] [+]  ×  [−] [number] [+]` — all horizontal, inline
- Score minimum is 0 — clicking [−] when score is 0 does nothing
- No upper limit on score

---

## 3. Score state management (React)

Each match card manages its own state:

```typescript
interface MatchCardState {
  scoreA: number        // home score, default 0
  scoreB: number        // away score, default 0
  submitted: boolean    // true after "Enviar placar" is clicked
  submittedAt: Date | null
}
```

Use `useState` per match. On mount, load existing palpites_jogos row from Supabase and pre-fill scores if already submitted.

---

## 4. Per-match submission

Each match card has its own "Enviar placar" button.

On click:
1. Upsert the `palpites_jogos` row for this `(palpite_id, jogo_id)` pair
2. Set `placar_palpite_a`, `placar_palpite_b`, `submitted_at = now()`
3. On success: set card state to `submitted = true`
4. On error: show inline error message on that card only

```typescript
const submitMatch = async (palpit eId: string, jogoId: string, scoreA: number, scoreB: number) => {
  const { error } = await supabase
    .from('palpites_jogos')
    .upsert({
      palpite_id: palpiteId,
      jogo_id: jogoId,
      placar_palpite_a: scoreA,
      placar_palpite_b: scoreB,
      submitted_at: new Date().toISOString()
    }, { onConflict: 'palpite_id,jogo_id' })
  return error
}
```

---

## 5. Submitted state visual

When `submitted === true`:
- Score numbers get green border: `border: 2px solid rgba(74, 222, 128, 0.7)` and color `#4ade80`
- "Enviar placar" button is hidden (`display: none`)
- Green checkmark `✓` appears in top-right of card
- Edit menu `⋮` button appears next to the checkmark

---

## 6. Edit menu (⋮)

Only visible when `submitted === true`.

On click: opens a small dropdown with option "✏️ Editar placar".

Edit is allowed ONLY if the match starts more than 1 hour from now:

```typescript
const canEdit = (matchDate: Date): boolean => {
  const oneHourBefore = new Date(matchDate.getTime() - 60 * 60 * 1000)
  return new Date() < oneHourBefore
}
```

If `canEdit === true`: clicking "Editar placar" sets `submitted = false`, allowing the user to change scores and re-submit.

If `canEdit === false`: show the option as disabled with tooltip text "Prazo encerrado — jogo começa em menos de 1 hora".

---

## 7. Chronological order + day grouping

Fetch all matches from `jogos_copa` ordered by `data ASC, horario ASC`.

Group matches by day (date). Render a day separator before each group:

```
Dia 1   11 de junho · Quinta-feira  ————————————  3 jogos
[match cards]

Dia 2   12 de junho · Sexta-feira   ————————————  4 jogos
[match cards]
```

---

## 8. Progressive loading

On first render: show only Day 1 matches.

Below the last visible day, show a "Carregar próximo dia →" button with the label of the next day (e.g. "Dia 2 · 12 de junho · 4 jogos").

Each click reveals one more day. Button disappears when all days are loaded.

Implement with a `visibleDays` state counter:

```typescript
const [visibleDays, setVisibleDays] = useState(1)
const days = groupMatchesByDay(matches) // array of day groups
const visibleGroups = days.slice(0, visibleDays)
const hasMore = visibleDays < days.length
```

---

## 9. Locked matches

A match is locked (cannot be edited) when `new Date() >= matchStartTime`.

Locked card: `opacity: 0.4`, `pointer-events: none`, show "🔒 Jogo em andamento" message.

---

## 10. Special pick — artilheiro only

REMOVE champion and runner-up fields entirely from the UI.

Keep only artilheiro (top scorer):
- Text input field
- Saved to `palpites.artilheiro` column
- Locked after competition starts (June 11, 2026 at 15:00 BRT)

---

## 11. No global submit button

Remove the "Enviar palpite" button from the bottom of the page.
Each match is submitted individually. The only action in the bottom bar is the PIX activation button.

---

## 12. PIX bottom bar

Keep the existing PIX activation bar at the bottom showing:
- Entry status (ativo / inativo)
- "Pagar e ativar via PIX · R$ 40,00" button

---

## 13. Mobile specifics (max-width: 768px)

- Entry cards as horizontal scroll row (overflow-x: auto)
- Match cards in single column (flex-direction: column)
- Score buttons: min 36×36px touch targets
- PIX bar sticky above bottom nav
- Bottom nav with 5 icons (same as other mobile pages)

---

## 14. Update /instrucoes page

Remove all mentions of:
- "Campeão da Copa" pick
- "Vice-campeão" pick

Update scoring table and rules text to only mention artilheiro as a special pick.

---

## 15. TypeScript types to update

```typescript
// Remove from Palpite type:
campeao?: string
vice_campeao?: string

// palpites_jogos — add:
submitted_at?: string | null
```
