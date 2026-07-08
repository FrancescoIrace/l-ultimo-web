-- Richiesta di modifica orario per una partita già confermata dal centro:
-- l'organizzatore propone un nuovo orario, il centro accetta o rifiuta.
-- Stesso pattern RLS di match_messages (join matches+sports_courts per
-- validare il rapporto organizzatore<->centro).

create table if not exists public.match_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  center_id uuid not null references public.profiles(id) on delete cascade,
  current_datetime timestamp not null,
  proposed_datetime timestamp not null,
  reason text,
  status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- Un solo pending per partita: evita spam di richieste duplicate.
create unique index if not exists match_reschedule_requests_one_pending_per_match
  on public.match_reschedule_requests(match_id) where status = 'pending';

alter table public.match_reschedule_requests enable row level security;

drop policy if exists "match_reschedule_requests_select_participant" on public.match_reschedule_requests;
create policy "match_reschedule_requests_select_participant" on public.match_reschedule_requests
  for select to authenticated
  using (requested_by = auth.uid() or center_id = auth.uid());

drop policy if exists "match_reschedule_requests_insert_organizer" on public.match_reschedule_requests;
create policy "match_reschedule_requests_insert_organizer" on public.match_reschedule_requests
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from public.matches m
      join public.sports_courts sc on sc.id = m.court_id
      where m.id = match_id and m.creator_id = auth.uid()
        and sc.center_id = center_id and m.reservation_status = 'confirmed'
    )
  );

drop policy if exists "match_reschedule_requests_update_center" on public.match_reschedule_requests;
create policy "match_reschedule_requests_update_center" on public.match_reschedule_requests
  for update to authenticated
  using (center_id = auth.uid());
