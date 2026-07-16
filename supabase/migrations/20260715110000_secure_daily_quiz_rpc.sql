-- SfidaGiornaliera.jsx calcolava il punteggio lato client e lo scriveva su
-- daily_game_attempts/profiles/leaderboard_history con 3 richieste separate (select +
-- 2 insert/update in parallelo): nessuna atomicita', quindi race condition possibile
-- sui punti, e nessun controllo server-side sul tentativo giornaliero. Questa RPC
-- sposta insert del tentativo + assegnazione punti in un'unica operazione atomica,
-- usando il vincolo UNIQUE aggiunto in 20260715100000 per bloccare doppi tentativi
-- anche in caso di richieste concorrenti.
--
-- Limite noto: il punteggio (p_score) arriva comunque dal client, perche' le domande
-- e le risposte corrette vivono solo nel bundle JS (questionsMondiali in
-- SfidaGiornaliera.jsx), non a DB. Un utente smaliziato potrebbe ancora dichiarare un
-- punteggio falso chiamando direttamente questa funzione: la chiusura completa
-- richiede di spostare le domande a DB (prossimo step), da cui derivare il punteggio
-- server-side invece di riceverlo come parametro.
create or replace function public.submit_daily_quiz_score(p_score integer)
returns table (points_awarded integer, already_played boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_points integer;
  v_inserted_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_score is null or p_score < 0 or p_score > 3 then
    raise exception 'invalid_score';
  end if;

  v_points := p_score * 20;

  insert into public.daily_game_attempts (user_id, played_at)
  values (v_user_id, current_date)
  on conflict (user_id, played_at) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return query select 0, true;
    return;
  end if;

  if v_points > 0 then
    update public.profiles
      set total_points = total_points + v_points
      where id = v_user_id;

    insert into public.leaderboard_history (user_id, points, reason)
    values (v_user_id, v_points, format('Quiz del Giorno: %s/3 risposte esatte', p_score));
  end if;

  return query select v_points, false;
end;
$$;

revoke all on function public.submit_daily_quiz_score(integer) from public;
grant execute on function public.submit_daily_quiz_score(integer) to authenticated;

-- Da ora l'unica via per registrare un tentativo/punteggio del quiz e' questa RPC
-- (che gira coi permessi del proprietario e quindi bypassa comunque il revoke).
-- Non tocchiamo la tabella profiles: total_points resta scrivibile direttamente dal
-- client per ora (limite noto, vedi commento sopra).
revoke insert on public.daily_game_attempts from authenticated, anon;
revoke insert on public.leaderboard_history from authenticated, anon;
