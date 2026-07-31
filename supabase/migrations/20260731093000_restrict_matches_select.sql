-- Restringe la lettura delle partite. Prima la policy SELECT per i loggati era
-- "qual = true": qualsiasi utente autenticato poteva leggere QUALSIASI partita
-- via URL diretto, comprese le partite di squadra chiuse (anche dopo il
-- "Richiudi", is_public = false). Ora un loggato può leggere una partita solo se:
--   • è una partita aperta (team_id NULL), oppure
--   • is_public = true (aperta col link), oppure
--   • è il creatore, oppure
--   • è membro della squadra, oppure
--   • è già iscritto (così chi ha già fatto "Partecipa" continua a vederla
--     anche dopo che il creatore ha richiuso la partita).
--
-- La policy "Public match preview" (role public, is_public = true) resta invariata
-- e continua a gestire la preview da sloggato.
--
-- Rollback: in fondo al file.

-- Funzione helper in SECURITY DEFINER: legge team_members/participants senza
-- riapplicare le loro RLS, evitando ricorsione tra policy. auth.uid() continua
-- a restituire l'utente chiamante anche in definer.
create or replace function public.can_view_match(
    p_match_id uuid, p_team_id uuid, p_creator uuid, p_is_public boolean
) returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select
        p_team_id is null
        or coalesce(p_is_public, false) = true
        or auth.uid() = p_creator
        or exists (select 1 from team_members tm where tm.team_id = p_team_id and tm.user_id = auth.uid())
        or exists (select 1 from participants pa where pa.match_id = p_match_id and pa.user_id = auth.uid());
$$;

revoke all on function public.can_view_match(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.can_view_match(uuid, uuid, uuid, boolean) to authenticated;

drop policy if exists "Lettura per i loggati" on public.matches;
create policy "Lettura per i loggati" on public.matches
    for select to authenticated
    using ( public.can_view_match(id, team_id, creator_id, is_public) );

-- ---------------------------------------------------------------------------
-- ROLLBACK (eseguire solo se qualcosa si rompe):
--
-- drop policy if exists "Lettura per i loggati" on public.matches;
-- create policy "Lettura per i loggati" on public.matches
--     for select to authenticated using ( true );
-- ---------------------------------------------------------------------------
