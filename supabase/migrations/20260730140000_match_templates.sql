-- Partite ricorrenti nei gruppi: il creatore della squadra salva una volta la
-- configurazione fissa (sport, campo, n° giocatori, ecc.) come "template" e poi
-- genera la partita della settimana indicando solo giorno/ora. Elimina la
-- frizione di ricompilare CreateMatch ogni volta. La generazione vera e propria
-- resta un normale insert in matches (RLS matches esistenti); qui serve solo la
-- tabella dei template.

create table if not exists public.match_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text,
  sport text not null,
  title text,
  location text,
  location_lat double precision,
  location_lng double precision,
  max_players integer not null default 10,
  description text,
  court_id uuid,
  default_weekday smallint check (default_weekday between 0 and 6), -- 0=Dom .. 6=Sab (JS getDay)
  default_time text,                                                 -- 'HH:MM'
  created_at timestamptz not null default now()
);

create index if not exists match_templates_team_idx on public.match_templates (team_id);

alter table public.match_templates enable row level security;

-- Lettura: i membri della squadra possono vedere i template ricorrenti.
drop policy if exists "match_templates_select_member" on public.match_templates;
create policy "match_templates_select_member"
  on public.match_templates for select to authenticated using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = match_templates.team_id and tm.user_id = auth.uid()
    )
  );

-- Scrittura: solo il creatore della squadra crea/modifica/elimina i template.
drop policy if exists "match_templates_write_owner" on public.match_templates;
create policy "match_templates_write_owner"
  on public.match_templates for all to authenticated
  using (
    exists (select 1 from public.teams t where t.id = match_templates.team_id and t.created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.teams t where t.id = match_templates.team_id and t.created_by = auth.uid())
  );

revoke all on public.match_templates from anon;
