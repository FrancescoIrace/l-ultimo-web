-- Colonna di visibilita' per i centri creati dall'admin: un centro non
-- ancora pronto (o non in regola con l'abbonamento, in futuro) puo' essere
-- nascosto dalla lista pubblica senza disattivarne l'account.

alter table public.profiles add column if not exists is_visible boolean not null default true;

-- Gli admin possono aggiornare qualunque profilo (serve per il toggle
-- visibilita' dei centri dal pannello admin).
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
