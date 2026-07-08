-- Permette all'organizzatore di una partita di rimuovere un giocatore
-- (kick) cancellando la sua riga in participants, oltre al caso già
-- coperto (un utente cancella la propria riga per abbandonare la partita).
-- Additiva: allarga il permesso di DELETE, non restringe nulla.

drop policy if exists "participants_delete_by_creator" on public.participants;
create policy "participants_delete_by_creator" on public.participants
  for delete to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = (select creator_id from public.matches where id = match_id)
  );
