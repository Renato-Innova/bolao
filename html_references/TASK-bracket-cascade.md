# Task: Mata-Mata Layout + bracket_slots + Cascade Edit Logic

## Overview
This task covers three things:
1. Fix the `classificacao_grupos` table to include `palpite_id`
2. Create the `bracket_slots` table for knockout bracket inference
3. Implement cascade edit logic when a user edits a submitted prediction
4. Update the Mata-Mata layout to match the Fase de Grupos card pattern

Read `html_references/06-palpites-mata-mata-v1.html` for the layout reference.

---

## ⚠️ IMPORTANT — Copa 2026 has 5 knockout phases, not 4
R32 (Segundas de Final) → R16 (Oitavas) → QF (Quartas) → SF (Semifinal) → TPL/F (Final)
This affects every phase list, locking logic, and cascade chain below.

---

## 1. Fix `classificacao_grupos` table

### Problem
The current `classificacao_grupos` table has no `palpite_id` column.
This means all palpites share the same group classification, which is wrong.
Each palpite must have its own classification because each user predicts
different scores, leading to different group standings.

### Migration
```sql
-- Add palpite_id to classificacao_grupos
ALTER TABLE classificacao_grupos
  ADD COLUMN palpite_id UUID REFERENCES palpites(id) ON DELETE CASCADE;

-- The official classification uses palpite_id = NULL
-- (or create a reserved system palpite for the official table)

-- Add index for performance
CREATE INDEX idx_classificacao_grupos_palpite
  ON classificacao_grupos(palpite_id, group_code);

-- Make the combination unique
ALTER TABLE classificacao_grupos
  ADD CONSTRAINT uq_classificacao_palpite_team
  UNIQUE (palpite_id, team_id, group_code);
```

### Official classification
The admin-entered official results produce the "official" classification.
Store it with `palpite_id = NULL` to distinguish from user predictions.
The standings page always shows the official classification (palpite_id = NULL).
The palpite predictions page shows the user's own classification (palpite_id = their id).

---

## 2. Create `bracket_slots` table

### Purpose
Stores the inferred bracket for each palpite — which teams the system
calculated would face each other in each knockout match, based on the
user's predicted group stage scores.

This is needed because:
- Each palpite produces a different group classification
- Therefore each palpite has a different knockout bracket
- The "Meu Palpite" view in the Chave tab must show the user's bracket,
  not the official one

### Schema
```sql
CREATE TABLE bracket_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palpite_id    UUID NOT NULL REFERENCES palpites(id) ON DELETE CASCADE,
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home TEXT,   -- team name inferred for home slot
  predicted_away TEXT,   -- team name inferred for away slot
  is_valid      BOOLEAN NOT NULL DEFAULT true,
  -- false = slot was invalidated by an upstream edit and needs recalculation
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE (palpite_id, match_id)
);

CREATE INDEX idx_bracket_slots_palpite ON bracket_slots(palpite_id);
CREATE INDEX idx_bracket_slots_match   ON bracket_slots(match_id);
```

### When bracket_slots are created/updated
Trigger recalculation of bracket_slots whenever:
- A group stage prediction is submitted or edited (affects R32 slots)
- A knockout prediction is submitted or edited (affects next phase slots)

Recalculation steps for a given palpite_id:
1. Run group stage standings calculation using only that palpite's predictions
2. Resolve R32 matchups from standings (use official FIFA 2026 bracket mapping)
3. For each subsequent phase, infer winners from the palpite's knockout predictions
4. Upsert into bracket_slots

### bracket_slots validity
When a prediction is edited and cascade-cleared (see section 4),
mark the downstream bracket_slots rows as `is_valid = false`.
Recalculate them lazily when the user opens the Chave tab,
or eagerly in a background job after the edit.

---

## 3. Cascade edit logic

### When does cascade apply?
When a user edits a prediction that has ALREADY been submitted
(predictions.submitted_at IS NOT NULL) and there exist submitted
predictions in downstream phases for the same palpite.

Downstream chain:
- Edit group stage game → may affect R32, R16, QF, SF, F
- Edit R32 game → may affect R16, QF, SF, F
- Edit R16 game → may affect QF, SF, F
- Edit QF game → may affect SF, F
- Edit SF game → may affect F only
- Edit F game → no downstream

### Check before edit (server-side function)
```typescript
async function getDownstreamImpact(
  palpiteId: string,
  matchId: string
): Promise<{ affectedCount: number; affectedPhases: string[] }>
```
Returns how many submitted predictions would be cleared and which phases.

### User flow
1. User clicks edit (⋮) on a submitted prediction
2. Frontend calls `getDownstreamImpact`
3. If affectedCount === 0: allow edit directly, no modal
4. If affectedCount > 0: show confirmation modal:

   **Modal content:**
   Title: "Editar este palpite vai afetar as fases seguintes"
   Body: "X palpites nas fases [R32 / Oitavas / ...] serão apagados
          e precisarão ser preenchidos novamente."
   Buttons: [Cancelar] [Confirmar edição]

5. User confirms → call `cascadeEdit`:
   a. Update the edited prediction's score
   b. Clear all downstream submitted predictions for this palpite
      (set score_home = null, score_away = null, submitted_at = null)
   c. Invalidate bracket_slots for all affected phases
   d. Recalculate bracket_slots from scratch for this palpite
   e. Return success

6. User cancels → nothing changes

### Server-side function signature
```typescript
async function cascadeEdit(params: {
  palpiteId: string
  matchId:   string
  newHome:   number
  newAway:   number
}): Promise<void>

// Steps inside:
// 1. Update prediction for matchId
// 2. Get match phase (e.g. 'GS')
// 3. Determine all phases downstream of that phase
// 4. Delete/nullify predictions for those phases for this palpite
// 5. Delete bracket_slots for those phases for this palpite
// 6. Recalculate bracket_slots for this palpite from scratch
```

### Phase downstream map
```typescript
const PHASE_ORDER = ['GS', 'R32', 'R16', 'QF', 'SF', 'TPL', 'F']

function getDownstreamPhases(phase: string): string[] {
  const idx = PHASE_ORDER.indexOf(phase)
  return PHASE_ORDER.slice(idx + 1)
}
```

---

## 4. Mata-Mata tab layout update

### What changes
The Mata-Mata predictions tab must use the SAME card pattern as Fase de Grupos.
Previous layout (accordion phases with simple list) is replaced by:
- One collapsible section per phase
- Inside each section: games grouped by day with a day header
- Each day group: individual game cards identical to group stage cards

### Card structure (same as group stage)
```
┌─────────────────────────────────────────────────────┐
│ [Flag] Team Name        [−][score][+]×[−][score][+] │
│                                    Team Name [Flag]  │
│                              [Enviar palpite] or ✓⋮  │
│ Match code · Date · Time                             │
└─────────────────────────────────────────────────────┘
```

- Flag: from flagcdn.com using team's country code
- "A definir": gray placeholder + italic muted text when team is NULL
- Score inputs: [−] [value] [+] per side, minimum 0
- Submit button: disabled until user changes at least one score from default
- After submit: green border on scores, checkmark icon, ⋮ edit menu
- Edit menu: only visible until 1 hour before match_time
- Match locked: inputs disabled, no edit menu, show lock icon

### Phase sections
```
▼ Segundas de Final                    3 / 16 preenchidos
  ├─ Domingo · 29 de Junho
  │   ├─ [game card]
  │   └─ [game card]
  ├─ Segunda-feira · 30 de Junho
  │   └─ [game card]
  ...

🔒 Oitavas de Final                    0 / 8 preenchidos
   Disponível após Segundas de Final

🔒 Quartas de Final                    0 / 4 preenchidos
   Disponível após Oitavas de Final

🔒 Semifinal                           0 / 2 preenchidos
   Disponível após Quartas de Final

🔒 Final                               0 / 2 preenchidos
   Disponível após Semifinal
```

### Phase unlock rule
Phase N unlocks when ALL predictions for Phase N-1 are submitted
(submitted_at IS NOT NULL) for the current palpite_id.

### Teams in knockout cards
Use `bracket_slots` to get the predicted teams for each knockout match.
If bracket_slots has no row yet for a match → show "A definir" for both teams.
If bracket_slots has a row but predicted_home/away is null → show "A definir".
If bracket_slots has valid team names → show flag + name normally.

---

## 5. Files / components to create or update

- [ ] Migration: add palpite_id to classificacao_grupos
- [ ] Migration: create bracket_slots table
- [ ] Server function: calculateBracketSlots(palpiteId)
- [ ] Server function: getDownstreamImpact(palpiteId, matchId)
- [ ] Server function: cascadeEdit(params)
- [ ] Update: classificacao_grupos queries to always filter by palpite_id
- [ ] Update: standings calculation to write to classificacao_grupos with palpite_id
- [ ] Update: Mata-Mata tab UI — new card-based layout per reference HTML
- [ ] Update: Chave tab — use bracket_slots for "Meu Palpite" view
- [ ] Update: admin result entry — after entering official result, recalculate
       official bracket_slots (palpite_id = NULL) and trigger scoring
