-- Segnalazione chat: consente a organizzatore/centro di segnalare una
-- conversazione (match_messages) all'admin, stesso pattern di review_reports.

create table if not exists public.match_message_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists match_message_reports_match_id_idx on public.match_message_reports(match_id);

alter table public.match_message_reports enable row level security;

drop policy if exists "match_message_reports_select_own" on public.match_message_reports;
create policy "match_message_reports_select_own" on public.match_message_reports
  for select to authenticated
  using (reporter_id = auth.uid());

drop policy if exists "match_message_reports_insert_own" on public.match_message_reports;
create policy "match_message_reports_insert_own" on public.match_message_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

-- Gli admin vedono e gestiscono tutte le segnalazioni chat.
drop policy if exists "match_message_reports_select_admin" on public.match_message_reports;
create policy "match_message_reports_select_admin" on public.match_message_reports
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "match_message_reports_update_admin" on public.match_message_reports;
create policy "match_message_reports_update_admin" on public.match_message_reports
  for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
