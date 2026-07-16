-- Bonus di retention legato ai giorni consecutivi in cui si gioca la Sfida Giornaliera
-- (streak stile Duolingo: si perde saltando un giorno, non sbagliando il quiz).
-- Calcolato interamente da daily_game_attempts.played_at con la tecnica "gaps and
-- islands" (nessuna nuova colonna, non tocca profiles): per date consecutive in ordine
-- decrescente, played_at + row_number() resta costante, quindi contare le righe con lo
-- stesso valore del gruppo piu' recente da' la lunghezza della run consecutiva.
create or replace function public.get_daily_quiz_streak()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_played date;
  v_streak integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select max(played_at) into v_last_played
    from public.daily_game_attempts
    where user_id = v_user_id;

  if v_last_played is null or v_last_played < current_date - 1 then
    return 0;
  end if;

  select count(*) into v_streak
    from (
      select played_at,
             played_at + (row_number() over (order by played_at desc))::integer as grp
        from public.daily_game_attempts
        where user_id = v_user_id and played_at <= v_last_played
    ) t
    where grp = v_last_played + 1;

  return v_streak;
end;
$$;

revoke all on function public.get_daily_quiz_streak() from public;
grant execute on function public.get_daily_quiz_streak() to authenticated;

-- submit_daily_quiz_answers (20260715140000) calcolava solo i punti del quiz. Aggiunge
-- ora il bonus streak (progressivo, tetto +50pt) come scrittura separata in
-- leaderboard_history, cosi' la cronologia distingue chiaramente le due fonti di punti.
drop function if exists public.submit_daily_quiz_answers(jsonb);

create or replace function public.submit_daily_quiz_answers(p_answers jsonb)
returns table (points_awarded integer, already_played boolean, score integer, results jsonb, streak_days integer, streak_bonus integer)
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
  v_quiz_points integer;
  v_results jsonb;
  v_streak_days integer;
  v_streak_bonus integer;
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
  -- concorrentemente da un'altra richiesta) non assegniamo punti/bonus una seconda volta.
  insert into public.daily_game_attempts (user_id, played_at)
  values (v_user_id, current_date)
  on conflict (user_id, played_at) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return query select 0, true, 0, null::jsonb, 0, 0;
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

  v_quiz_points := v_score * 20;

  -- L'attempt di oggi e' gia' stato inserito sopra, quindi la streak calcolata qui include oggi.
  v_streak_days := public.get_daily_quiz_streak();
  v_streak_bonus := least(v_streak_days * 5, 50);

  if v_quiz_points > 0 or v_streak_bonus > 0 then
    update public.profiles
      set total_points = total_points + v_quiz_points + v_streak_bonus
      where id = v_user_id;
  end if;

  if v_quiz_points > 0 then
    insert into public.leaderboard_history (user_id, points, reason)
    values (v_user_id, v_quiz_points, format('Quiz del Giorno: %s/3 risposte esatte', v_score));
  end if;

  if v_streak_bonus > 0 then
    insert into public.leaderboard_history (user_id, points, reason)
    values (v_user_id, v_streak_bonus, format('Streak di %s giorni consecutivi', v_streak_days));
  end if;

  return query select (v_quiz_points + v_streak_bonus), false, v_score, v_results, v_streak_days, v_streak_bonus;
end;
$$;

revoke all on function public.submit_daily_quiz_answers(jsonb) from public;
grant execute on function public.submit_daily_quiz_answers(jsonb) to authenticated;
