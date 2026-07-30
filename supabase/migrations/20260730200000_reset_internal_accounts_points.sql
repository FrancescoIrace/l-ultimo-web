-- Azzeramento dei punti classifica degli account interni (Franceschino,
-- Superadmin, ULTIMO): hanno giocato e accumulato punti prima di tutti in
-- fase di test, falsando la classifica per i tester reali. Match
-- case-insensitive sugli username. (Dal 1° agosto la stagione azzererà
-- comunque i punti di tutti, questo è per riequilibrare subito.)

update public.profiles
set total_points = 0
where lower(username) in ('franceschino', 'superadmin', 'ultimo');
