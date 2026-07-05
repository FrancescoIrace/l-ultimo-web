-- Ruoli preferiti per sport (es. Portiere/Difensore per il calcio,
-- Playmaker/Ala per il basket). Tabella normalizzata invece di un campo
-- unico sul profilo: un utente puo' avere piu' ruoli per sport, e il
-- catalogo ruoli e' diverso per ogni famiglia di sport.

create table if not exists public.user_sport_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sport text not null,
  role text not null,
  created_at timestamptz not null default now(),
  unique (user_id, sport, role)
);

alter table public.user_sport_roles enable row level security;

-- Visibili a chiunque sia loggato: servono per mostrare il ruolo di un
-- giocatore nella lista partecipanti di una partita, non solo al proprietario.
drop policy if exists "user_sport_roles_select_all" on public.user_sport_roles;
create policy "user_sport_roles_select_all" on public.user_sport_roles
  for select
  to authenticated
  using (true);

drop policy if exists "user_sport_roles_insert_own" on public.user_sport_roles;
create policy "user_sport_roles_insert_own" on public.user_sport_roles
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_sport_roles_delete_own" on public.user_sport_roles;
create policy "user_sport_roles_delete_own" on public.user_sport_roles
  for delete
  to authenticated
  using (user_id = auth.uid());
