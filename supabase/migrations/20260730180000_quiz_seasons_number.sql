-- Numero progressivo di stagione, usato per scegliere il set di badge
-- corretto (i badge di fine stagione hanno "STAGIONE N" inciso, quindi ogni
-- stagione ha immagini distinte: public/badges/badge-{1,2,3,p}-s{N}.svg).
-- Backfill assegnando 1,2,3... in ordine di data d'inizio (Ferie d'Agosto = 1).

alter table public.quiz_seasons add column if not exists season_number smallint;

with ordered as (
  select id, row_number() over (order by starts_on) as rn
  from public.quiz_seasons
)
update public.quiz_seasons q
set season_number = o.rn
from ordered o
where q.id = o.id and q.season_number is null;
