# Task: Implement Knockout Phase (Mata-Mata + Chave)

## Reference files
- `html_references/06-palpites-mata-mata-v1.html` → predictions tab for knockout games
- `html_references/06-chave-v2.html` → visual bracket (read-only)

Read both files in full before writing any code. All layout decisions,
interactions, and data rules are documented inside them as HTML comments.

---

## ⚠️ CRITICAL — COPA 2026 HAS AN EXTRA KNOCKOUT PHASE

FIFA World Cup 2026 has 5 knockout phases, not the usual 4.
There is a new phase called **"Segundas de Final"** (Round of 32)
that comes BEFORE the traditional Round of 16 (Oitavas de Final).

The correct phase order is:
1. Segundas de Final — 16 games — Jun 29 to Jul 3
2. Oitavas de Final  —  8 games — Jul 4 to Jul 7
3. Quartas de Final  —  4 games — Jul 9 to Jul 11
4. Semifinal         —  2 games — Jul 14 to Jul 15
5. Final             —  2 games — Jul 18 (3rd place) + Jul 19 (final)

This affects every part of the codebase that references knockout phases:
scoring config, locking logic, database queries, admin panel,
and any hardcoded phase lists. Update ALL of them.

---

## Database changes

### 1. Add the new phase codes to the matches table

The `phase` column must support these values:
```
'GS'  = Fase de Grupos      (already exists)
'R32' = Segundas de Final   ← NEW
'R16' = Oitavas de Final
'QF'  = Quartas de Final
'SF'  = Semifinal
'TPL' = Decisão do 3º Lugar
'F'   = Final
```

If `phase` is an enum in the database, add 'R32' to it.
If it is a varchar/text, no migration needed — just use the new value.

### 2. Seed knockout matches

Insert all 46 knockout matches into the `matches` table with:
- `phase` set to the correct code above
- `match_date` and `match_time` from the schedule below
- `home_team` and `away_team` set to NULL (teams not yet qualified)
- `result_home` and `result_away` set to NULL

Use the match codes (J74–J104) as the external reference.
Map them to the bracket slots exactly as shown in the reference HTML files.

Schedule summary:
- R32: J74–J87 (some match on Jun 28, most Jun 29–Jul 3)
- R16: J89–J96 (Jul 4–7)
- QF:  J97–J100 (Jul 9–11)
- SF:  J101–J102 (Jul 14–15)
- TPL: J103 (Jul 18)
- F:   J104 (Jul 19)

### 3. Scoring configuration

The `scoring_config` table (or wherever multipliers are stored) must have
one row per phase. Add 'R32' between 'GS' and 'R16'. Default multiplier
suggestion: 2x (same as R16), but keep it configurable by the admin.

---

## Feature 1 — "Mata-Mata" sub-tab in /palpites

### Location
Inside `/palpites` → main tab "Mata-Mata" → sub-tab "Mata-Mata"
(the other sub-tab is "Chave" — see Feature 2 below)

### Behavior
Identical input pattern to Fase de Grupos:
- [−] [score] [+] × [−] [score] [+] buttons
- Individual "Enviar palpite" button per game
- After submit: green border on score numbers, checkmark appears,
  edit menu (⋮) available until 1 hour before match start
- Minimum score: 0 (never go negative)

### Phase sections
Render one collapsible section per phase in chronological order:
Segundas de Final → Oitavas → Quartas → Semifinal → Final

Each section header shows:
- Phase name + date range
- Progress badge: "X / Y preenchidos"
- Lock icon when locked

Within each open section, games are grouped by day (same day-header
pattern as Fase de Grupos) and sorted chronologically.

### Phase locking rule
A phase is only open for predictions when ALL games in the
PREVIOUS phase have been submitted by the user
(predictions.submitted_at IS NOT NULL for every game in that phase,
for the currently selected palpite_id).

Chain:
- Fase de Grupos must be 100% submitted → unlocks Segundas de Final
- Segundas de Final 100% submitted → unlocks Oitavas de Final
- Oitavas 100% submitted → unlocks Quartas de Final
- Quartas 100% submitted → unlocks Semifinal
- Semifinal 100% submitted → unlocks Final

When locked, show a centered message inside the collapsed section:
lock icon + "Disponível após [previous phase name]" + subtitle text.

### "A definir" teams
When `home_team` or `away_team` is NULL:
- Show circular gray placeholder with "?" instead of flag
- Show "A definir" in muted italic instead of team name
- Score inputs still active (user can predict even before teams qualify)

### Prediction locking (match-level)
Each individual game locks 1 hour before `match_time`, same as group stage.
After locking: inputs disabled, no edit menu.

---

## Feature 2 — "Chave" sub-tab in /palpites

### Location
Inside `/palpites` → main tab "Mata-Mata" → sub-tab "Chave"

### Purpose
Read-only visual bracket. No prediction input here.

### Layout — SAME for desktop and mobile, linear left-to-right

**Desktop (>= 1024px):**
All 5 phase columns visible simultaneously, side by side.
Connector arrows (→) between columns.
Horizontal scroll if needed.
Phase pills hidden.

**Mobile (< 1024px):**
Phase pills shown at top: Seg. Final | Oitavas | Quartas | Semifinal | Final
Maximum 2 columns visible at a time.
Navigation rules:
- Tap a pill that's already visible → no change
- Only 1 column visible → add new one to the right
- 2 columns visible → drop left column, shift right to left, new enters right
Transition: CSS translateX on the track, 0.28s ease. Keep all 5 columns
in the DOM at all times — use transform, not display:none.

### Match cards (same structure on both breakpoints)
- Match code + date + time (small muted text)
- Team 1: flag + name + score
- "vs" divider
- Team 2: flag + name + score
- Winner row: blue left border accent + subtle blue background tint
- "A definir" + gray placeholder when team not yet qualified

### View toggle
Top-right: "Resultado Oficial" | "Meu Palpite"
- Resultado Oficial (default): scores from result_home / result_away
- Meu Palpite: scores from user's predictions for selected palpite_id
  Show "–" when no prediction exists for that game

### Special cards (Final column)
- J103: chip label "3º Lugar" in top-right of card
- J104: larger card with blue border, label "Grande Final" above,
  "— Campeão Mundial —" tag below once a winner exists

---

## Admin panel update

The admin result-entry panel must include the new phase.
When listing phases to filter or enter results, the order must be:
Fase de Grupos → Segundas de Final → Oitavas → Quartas → Semifinal → Final

The admin must be able to:
1. Select a phase
2. See all games in that phase
3. Enter result_home and result_away for each game
4. Confirm — which triggers score recalculation for all predictions
   of that game across all palpites

---

## Scoring recalculation

When the admin enters a result for any knockout game, the system must:
1. Find all predictions for that match_id across all palpites
2. For each prediction, calculate points using the scoring_config
   for the correct phase (use the phase multiplier for R32, R16, QF, etc.)
3. Update the score in the predictions table

The points logic (exact score vs correct winner vs wrong) is already
implemented for group stage — reuse the same function, just pass the
correct phase multiplier.

---

## Files to update (checklist for Claude Code)

- [ ] Database migration: add R32 phase, seed 46 knockout matches
- [ ] `scoring_config`: add R32 row
- [ ] `/palpites` page: implement Mata-Mata sub-tab with 5 phases
- [ ] `/palpites` page: implement Chave sub-tab (linear bracket)
- [ ] Admin panel: add Segundas de Final to phase list and result entry
- [ ] Scoring function: ensure R32 multiplier is applied correctly
- [ ] Any hardcoded phase arrays in the codebase: add R32 in the correct position
