-- Avatar support for palpites
-- avatar_type: 'emoji' | 'camisa' | 'initials' (default/fallback)
-- avatar_value: emoji char (e.g. '🦁') or camisa key (e.g. 'Brasil')

ALTER TABLE public.palpites
  ADD COLUMN IF NOT EXISTS avatar_type  text DEFAULT 'initials',
  ADD COLUMN IF NOT EXISTS avatar_value text DEFAULT NULL;
