-- Stagioni a tempo per la classifica (es. "Ferie d'Agosto"): la classifica
-- cumulativa da sempre scoraggia i nuovi utenti (chi ha iniziato prima ha un
-- vantaggio incolmabile). Con stagioni a tempo + reset periodico dei punti,
-- ogni stagione riparte da zero per tutti. Generico/riusabile: la prossima
-- stagione si aggiunge con un semplice insert in quiz_seasons, nessun nuovo
-- codice. Non tocca la tabella profiles (solo tabelle satellite nuove).

create table if not exists public.quiz_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  constraint quiz_seasons_dates_check check (ends_on >= starts_on)
);

-- Snapshot del podio + partecipanti a fine stagione (prima di azzerare
-- profiles.total_points per la stagione successiva). rank 1/2/3 = podio,
-- rank NULL = ha partecipato (total_points > 0) ma fuori dal podio. Il
-- colore del badge (oro/argento/bronzo/partecipante) si deriva dal rank
-- lato frontend, non e' salvato qui. Questa tabella e' anche l'Albo d'Oro:
-- tutte le stagioni passate con rank non nullo, ordinate per data.
create table if not exists public.quiz_season_results (
  season_id uuid not null references public.quiz_seasons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rank smallint check (rank between 1 and 3),
  points integer not null,
  created_at timestamptz not null default now(),
  primary key (season_id, profile_id)
);

-- Badge "Tester Interno": marca chi aveva gia' un account prima del lancio
-- pubblico. Backfillata una tantum (vedi 20260724110000) con tutti i profili
-- esistenti a quella data; chi si registra dopo non la riceve piu' - e'
-- proprio il punto, non e' un badge riottenibile.
create table if not exists public.early_testers (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  awarded_at timestamptz not null default now()
);

alter table public.quiz_seasons enable row level security;
alter table public.quiz_season_results enable row level security;
alter table public.early_testers enable row level security;

-- Sola lettura per il client: dati non sensibili (nomi stagione, podi,
-- badge), gia' visibili in classifica/profilo. Nessuna scrittura lato
-- client: le stagioni si aprono/chiudono solo via migrazione.
drop policy if exists "quiz_seasons_select_authenticated" on public.quiz_seasons;
create policy "quiz_seasons_select_authenticated"
  on public.quiz_seasons for select to authenticated using (true);

drop policy if exists "quiz_season_results_select_authenticated" on public.quiz_season_results;
create policy "quiz_season_results_select_authenticated"
  on public.quiz_season_results for select to authenticated using (true);

drop policy if exists "early_testers_select_authenticated" on public.early_testers;
create policy "early_testers_select_authenticated"
  on public.early_testers for select to authenticated using (true);

revoke insert, update, delete on public.quiz_seasons from authenticated, anon;
revoke insert, update, delete on public.quiz_season_results from authenticated, anon;
revoke insert, update, delete on public.early_testers from authenticated, anon;
