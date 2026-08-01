-- RPC per gestire il rollover di stagione dal pannello admin (niente più SQL a
-- mano). Entrambe SECURITY DEFINER con verifica is_admin.

-- Chiude una stagione: fotografa la classifica corrente in quiz_season_results
-- (top 3 = podio, gli altri con punti > 0 = partecipanti) e azzera i punti.
-- Bloccata se la stagione è già stata chiusa (per non inquinare lo snapshot).
create or replace function public.admin_close_season(p_season_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Non autorizzato';
  end if;
  if not exists (select 1 from public.quiz_seasons where id = p_season_id) then
    raise exception 'Stagione inesistente';
  end if;
  if exists (select 1 from public.quiz_season_results where season_id = p_season_id) then
    raise exception 'Stagione già chiusa';
  end if;

  with ranked as (
    select p.id as profile_id, p.total_points,
           row_number() over (order by p.total_points desc, p.id) as rn
    from public.profiles p
    where p.role = 'player' and p.total_points > 0
  )
  insert into public.quiz_season_results (season_id, profile_id, rank, points)
  select p_season_id, r.profile_id,
         case when r.rn <= 3 then r.rn::smallint else null end,
         r.total_points
  from ranked r
  on conflict (season_id, profile_id) do nothing;
  get diagnostics v_inserted = row_count;

  update public.profiles set total_points = 0 where total_points is distinct from 0;

  return jsonb_build_object('inserted', v_inserted);
end;
$$;

revoke all on function public.admin_close_season(uuid) from public, anon;
grant execute on function public.admin_close_season(uuid) to authenticated;

-- Crea la prossima stagione (season_number = max attuale + 1). Solo admin.
create or replace function public.admin_create_season(p_name text, p_starts_on date, p_ends_on date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num smallint;
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Non autorizzato';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Nome mancante';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'La data di fine deve essere successiva o uguale all''inizio';
  end if;

  select coalesce(max(season_number), -1) + 1 into v_num from public.quiz_seasons;
  insert into public.quiz_seasons (name, starts_on, ends_on, season_number)
  values (btrim(p_name), p_starts_on, p_ends_on, v_num)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'season_number', v_num);
end;
$$;

revoke all on function public.admin_create_season(text, date, date) from public, anon;
grant execute on function public.admin_create_season(text, date, date) to authenticated;
