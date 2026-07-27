-- Campi pubblici (parchi comunali, gratuiti, senza gestore) accanto ai
-- centri sportivi: niente prezzo/orari/prenotazione, quindi tabella satellite
-- a parte invece di riadattare sports_courts/profiles (che presuppongono un
-- centro proprietario che fa login e accetta/rifiuta prenotazioni). Non
-- tocca profiles/sports_courts/matches.
--
-- status/submitted_by esistono gia' pronti per un'eventuale futura feature
-- "gli utenti propongono nuovi campi, l'admin approva" - in questo giro
-- restano sempre rispettivamente 'approved' e null: la curazione e' solo
-- admin, nessuna coda di moderazione viene costruita ora.

create table if not exists public.public_courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport_type text not null,
  address text,
  lat double precision,
  lng double precision,
  is_outdoor boolean not null default true,
  description text,
  photo_url text,
  is_active boolean not null default true,
  status text not null default 'approved' check (status in ('approved', 'pending')),
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.public_courts enable row level security;

-- Lettura pubblica dei soli campi attivi e approvati.
drop policy if exists "public_courts_select_authenticated" on public.public_courts;
create policy "public_courts_select_authenticated"
  on public.public_courts for select to authenticated using (
    is_active = true and status = 'approved'
  );

-- Scrittura solo admin (stesso pattern gia' usato per profiles_update_admin):
-- niente form di segnalazione utente in questo giro, il catalogo lo cura
-- solo il pannello admin.
drop policy if exists "public_courts_all_admin" on public.public_courts;
create policy "public_courts_all_admin" on public.public_courts
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

revoke insert, update, delete on public.public_courts from anon;
