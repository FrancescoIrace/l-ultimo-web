-- Le squadre private venivano protette solo lato client: TeamsPage.jsx
-- selezionava la colonna teams.password per TUTTE le squadre (anche a chi
-- si limitava a sfogliare l'elenco "Esplora") e la confrontava in JS. La
-- password era quindi visibile a chiunque, membro o no. Questa RPC sposta
-- il confronto lato server: il client passa la password inserita e riceve
-- solo true/false, senza mai leggere il valore memorizzato.
create or replace function public.verify_team_password(p_team_id uuid, p_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id
      and is_private = true
      and password = p_password
  );
$$;

revoke all on function public.verify_team_password(uuid, text) from public;
grant execute on function public.verify_team_password(uuid, text) to authenticated;
