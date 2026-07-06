-- Snapshot della squadra (A/B) in cui giocava il recensore al momento della recensione.
-- Valori: 1 = Squadra A, 2 = Squadra B, NULL = non assegnato.
-- Additiva e non distruttiva.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_team_number smallint;
