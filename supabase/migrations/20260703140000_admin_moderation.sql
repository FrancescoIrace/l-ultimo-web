-- Pannello admin: flag is_admin/is_banned sui profili, e permessi RLS
-- per far vedere agli admin tutte le segnalazioni e permettere loro di
-- rimuovere recensioni. Il ban vero e proprio (login bloccato) passa
-- dalla Auth Admin API in una Edge Function con service role, non da qui.

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists ban_reason text;

-- Promuove subito ad admin l'account admin@admin.it se esiste gia'.
update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id and u.email = 'admin@admin.it' and p.is_admin is distinct from true;

-- Se admin@admin.it si registra in futuro (o si ri-registra), il suo
-- profilo nasce gia' con is_admin = true, senza dover ripetere la migration.
create or replace function public.set_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from auth.users u where u.id = new.id and u.email = 'admin@admin.it') then
    new.is_admin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_created_set_admin on public.profiles;
create trigger on_profile_created_set_admin
  before insert on public.profiles
  for each row
  execute function public.set_admin_flag();

-- Gli admin vedono tutte le segnalazioni, non solo le proprie.
drop policy if exists "review_reports_select_admin" on public.review_reports;
create policy "review_reports_select_admin" on public.review_reports
  for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Gli admin possono aggiornare lo stato di una segnalazione (risolta/ignorata).
drop policy if exists "review_reports_update_admin" on public.review_reports;
create policy "review_reports_update_admin" on public.review_reports
  for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Gli admin possono eliminare qualunque recensione (rimozione contenuto).
drop policy if exists "reviews_delete_admin" on public.reviews;
create policy "reviews_delete_admin" on public.reviews
  for delete
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
