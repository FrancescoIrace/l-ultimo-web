-- Arricchimento del profilo utente: campi personalizzabili (soprannome,
-- disponibilita') + statistiche di "carriera" mostrate sul profilo.
-- La bio esiste gia' su profiles (finora usata solo dai centri) e viene
-- riusata per i giocatori: nessuna colonna nuova per quella.

alter table public.profiles add column if not exists soprannome text;
alter table public.profiles add column if not exists availability text[];

-- Statistiche profilo calcolate server-side. Serve una RPC security definer
-- perche' un profilo PUBBLICO mostra i numeri di un ALTRO utente: le RLS su
-- participants/matches non garantirebbero di poterne contare le righe dal
-- client. La funzione ritorna SOLO i due conteggi aggregati, nessun dato
-- riga-per-riga esposto.
--
-- "Giocata" = ha partecipato fino alla fine: participants.final_attendance
-- viene messo a true solo quando l'utente conferma la presenza nelle 24h
-- prima; se rinuncia la riga viene cancellata. Quindi final_attendance=true su
-- una partita gia' passata = ha giocato davvero (chi entra-ed-esce non ha
-- riga, non conta). "Organizzata" = partite create dall'utente gia' svolte.
create or replace function public.get_profile_stats(p_profile_id uuid)
returns table(matches_played bigint, matches_organized bigint)
language sql
security definer
set search_path = public
as $$
  select
    (
      select count(*)
      from public.participants p
      join public.matches m on m.id = p.match_id
      where p.user_id = p_profile_id
        and p.final_attendance = true
        and (m.datetime)::timestamp < now()
    ) as matches_played,
    (
      select count(*)
      from public.matches m
      where m.creator_id = p_profile_id
        and (m.datetime)::timestamp < now()
    ) as matches_organized;
$$;

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;
