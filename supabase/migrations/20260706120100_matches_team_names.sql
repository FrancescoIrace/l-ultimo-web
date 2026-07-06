-- Nomi personalizzati delle 2 squadre di una partita, impostabili dall'organizzatore.
-- NULL = usa il fallback "Squadra A (Colorati)" / "Squadra B (Bianchi)".
-- Additiva e non distruttiva.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team1_name text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team2_name text;
