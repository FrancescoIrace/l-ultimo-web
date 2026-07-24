-- Livello di esperienza sportiva auto-dichiarato dall'utente (Principiante/
-- Amatoriale/Intermedio/Esperto/Professionista/Veterano), campo singolo per
-- ora (non per-sport, si valuta in futuro se serve granularita' maggiore).
-- Stesso pattern di favorite_sport: text libero senza CHECK, validato lato
-- client con una select a opzioni fisse.
alter table public.profiles add column if not exists experience_level text;
