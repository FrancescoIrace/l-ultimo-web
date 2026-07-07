-- Richieste di contatto dalla PWA (pubblicità / suggerimenti), a sostituire
-- i link diretti a WhatsApp. Stesso pattern email-alert di review_reports:
-- trigger su insert che chiama via pg_net l'Edge Function notify-contact-request.

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('advertising', 'suggestion')),
  email text not null,
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

drop policy if exists "contact_requests_insert_own" on public.contact_requests;
create policy "contact_requests_insert_own" on public.contact_requests
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "contact_requests_select_own" on public.contact_requests;
create policy "contact_requests_select_own" on public.contact_requests
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "contact_requests_select_admin" on public.contact_requests;
create policy "contact_requests_select_admin" on public.contact_requests
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "contact_requests_update_admin" on public.contact_requests;
create policy "contact_requests_update_admin" on public.contact_requests
  for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Alert email a ogni nuova richiesta di contatto, stesso trigger di
-- handle_new_review_report ma verso notify-contact-request.
create or replace function public.handle_new_contact_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://nnzsejowzbrjzpaisvpv.supabase.co/functions/v1/notify-contact-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uenNlam93emJyanpwYWlzdnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzI3NDEsImV4cCI6MjA5MTc0ODc0MX0.x3OD0_P_vslfcN95on_YYf8xUJhl3VJPVfSPXxz_y1c'
    ),
    body := jsonb_build_object(
      'request_id', new.id,
      'user_id', new.user_id,
      'type', new.type,
      'email', new.email,
      'message', new.message
    )
  );
  return new;
end;
$$;

drop trigger if exists on_contact_request_created on public.contact_requests;
create trigger on_contact_request_created
  after insert on public.contact_requests
  for each row
  execute function public.handle_new_contact_request();
