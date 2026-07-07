-- Thread di messaggi tra organizzatore e centro sportivo per una partita.
-- Sostituisce il vecchio meccanismo "usa e getta" (insert diretto su
-- notifications da BusinessDashboard.jsx, bloccato dalle RLS) con una vera
-- conversazione bidirezionale persistita.

create table if not exists public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists match_messages_match_id_idx on public.match_messages(match_id);
create index if not exists match_messages_recipient_id_idx on public.match_messages(recipient_id);

alter table public.match_messages enable row level security;

-- Ognuno dei due partecipanti al thread (mittente o destinatario) può leggerlo.
drop policy if exists "match_messages_select_participant" on public.match_messages;
create policy "match_messages_select_participant" on public.match_messages
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Si può scrivere solo a proprio nome (sender = se stessi), e solo se il
-- destinatario è davvero la controparte (organizzatore<->centro) di quella
-- partita specifica.
drop policy if exists "match_messages_insert_participant" on public.match_messages;
create policy "match_messages_insert_participant" on public.match_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      join public.sports_courts sc on sc.id = m.court_id
      where m.id = match_id
        and ((m.creator_id = auth.uid() and sc.center_id = recipient_id)
          or (sc.center_id = auth.uid() and m.creator_id = recipient_id))
    )
  );

-- Il destinatario può aggiornare (es. segnare come letto) i messaggi ricevuti.
drop policy if exists "match_messages_update_read" on public.match_messages;
create policy "match_messages_update_read" on public.match_messages
  for update to authenticated
  using (recipient_id = auth.uid());
