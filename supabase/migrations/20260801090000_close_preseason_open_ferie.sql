-- ROLLOVER 1° AGOSTO 2026 — chiusura "Pre-Stagione Estate" (Stagione 0) e
-- apertura di "Ferie d'Agosto" (Stagione 1, già inserita in precedenza).
--
-- Il periodo beta/tester di luglio non era una stagione formale: i punti
-- accumulati venivano azzerati senza premio. Su richiesta lo trasformiamo
-- nella Stagione 0 così i tester che hanno giocato ottengono badge e Albo
-- d'Oro. "Ferie d'Agosto" resta la Stagione 1 (nessuna rinumerazione).
--
-- Idempotente: rieseguirla non crea doppioni né rovina lo snapshot.

-- 1. Crea la Pre-Stagione (Stagione 0), se non esiste già.
insert into public.quiz_seasons (name, starts_on, ends_on, season_number)
select 'Pre-Stagione Estate', '2026-07-15', '2026-07-31', 0
where not exists (select 1 from public.quiz_seasons where season_number = 0);

-- 2. Snapshot della classifica ATTUALE nella Pre-Stagione: top 3 = podio
--    (rank 1/2/3), gli altri con punti > 0 = partecipanti (rank null).
--    Esclude i centri e gli account interni di test.
with s as (
  select id from public.quiz_seasons where season_number = 0
),
ranked as (
  select p.id as profile_id, p.total_points,
         row_number() over (order by p.total_points desc, p.id) as rn
  from public.profiles p
  where p.role = 'player'
    and p.total_points > 0
    and lower(coalesce(p.username, '')) not in ('franceschino', 'superadmin', 'ultimo')
)
insert into public.quiz_season_results (season_id, profile_id, rank, points)
select (select id from s), r.profile_id,
       case when r.rn <= 3 then r.rn::smallint else null end,
       r.total_points
from ranked r
on conflict (season_id, profile_id) do nothing;

-- 3. Azzera i punti per far ripartire da zero la nuova stagione.
update public.profiles set total_points = 0 where total_points is distinct from 0;
