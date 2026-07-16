-- submit_daily_quiz_score(integer) (20260715110000) chiudeva la race condition sui
-- tentativi giornalieri ma si fidava ancora del punteggio dichiarato dal client, perche'
-- le risposte corrette vivevano solo nel bundle JS. Ora che vivono in quiz_questions
-- (non leggibili dal client, vedi 20260715120000), questa RPC calcola il punteggio
-- server-side a partire dalle risposte effettive dell'utente.
drop function if exists public.submit_daily_quiz_score(integer);

create or replace function public.submit_daily_quiz_answers(p_answers jsonb)
returns table (points_awarded integer, already_played boolean, score integer, results jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_distinct_count integer;
  v_valid_count integer;
  v_inserted_id uuid;
  v_score integer;
  v_points integer;
  v_results jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 3 then
    raise exception 'invalid_answers';
  end if;

  select count(distinct (a.question_id))
    into v_distinct_count
    from jsonb_to_recordset(p_answers) as a(question_id integer, selected_index integer);

  if v_distinct_count <> 3 then
    raise exception 'invalid_answers';
  end if;

  select count(*)
    into v_valid_count
    from jsonb_to_recordset(p_answers) as a(question_id integer, selected_index integer)
    join public.quiz_questions q on q.id = a.question_id;

  if v_valid_count <> 3 then
    raise exception 'invalid_answers';
  end if;

  -- Blocco atomico del tentativo giornaliero: se la riga esiste gia' (o viene inserita
  -- concorrentemente da un'altra richiesta) non assegniamo punti una seconda volta.
  insert into public.daily_game_attempts (user_id, played_at)
  values (v_user_id, current_date)
  on conflict (user_id, played_at) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return query select 0, true, 0, null::jsonb;
    return;
  end if;

  select
    count(*) filter (where a.selected_index = q.correct_index),
    jsonb_agg(jsonb_build_object(
      'question_id', a.question_id,
      'selected_index', a.selected_index,
      'correct_index', q.correct_index,
      'is_correct', a.selected_index = q.correct_index
    ))
    into v_score, v_results
    from jsonb_to_recordset(p_answers) as a(question_id integer, selected_index integer)
    join public.quiz_questions q on q.id = a.question_id;

  v_points := v_score * 20;

  if v_points > 0 then
    update public.profiles
      set total_points = total_points + v_points
      where id = v_user_id;

    insert into public.leaderboard_history (user_id, points, reason)
    values (v_user_id, v_points, format('Quiz del Giorno: %s/3 risposte esatte', v_score));
  end if;

  return query select v_points, false, v_score, v_results;
end;
$$;

revoke all on function public.submit_daily_quiz_answers(jsonb) from public;
grant execute on function public.submit_daily_quiz_answers(jsonb) to authenticated;
