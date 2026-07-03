-- Enforcement del blocco utenti (user_blocks) su reviews e friendships.
-- Le policy sono tutte AS RESTRICTIVE: si combinano in AND con quelle
-- permissive gia' esistenti, quindi aggiungono un vincolo senza toccare
-- o sostituire i permessi che gia' funzionano oggi.

-- 1) RLS di base su user_blocks e review_reports.
--    Tabelle appena create: senza queste policy insert/select/delete
--    dal frontend falliscono con "permission denied".
alter table public.user_blocks enable row level security;
alter table public.review_reports enable row level security;

drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own" on public.user_blocks
  for select
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own" on public.user_blocks
  for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own" on public.user_blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "review_reports_select_own" on public.review_reports;
create policy "review_reports_select_own" on public.review_reports
  for select
  to authenticated
  using (reporter_id = auth.uid());

drop policy if exists "review_reports_insert_own" on public.review_reports;
create policy "review_reports_insert_own" on public.review_reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- 2) Impedisce di scrivere una recensione se tra reviewer e target
--    esiste un blocco, in una direzione o nell'altra.
drop policy if exists "reviews_block_insert" on public.reviews;
create policy "reviews_block_insert" on public.reviews
  as restrictive
  for insert
  to authenticated
  with check (
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = reviewer_id and b.blocked_id = target_id)
         or (b.blocker_id = target_id and b.blocked_id = reviewer_id)
    )
  );

-- 3) Nasconde una recensione a chiunque abbia un blocco (in una
--    direzione o nell'altra) con l'autore o il destinatario della
--    recensione. Copre sia "non vedo piu' le sue recensioni" sia
--    "l'utente bloccato non vede piu' le mie".
drop policy if exists "reviews_block_select" on public.reviews;
create policy "reviews_block_select" on public.reviews
  as restrictive
  for select
  to authenticated
  using (
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id in (reviewer_id, target_id))
         or (b.blocked_id = auth.uid() and b.blocker_id in (reviewer_id, target_id))
    )
  );

-- 4) Impedisce l'invio di richieste di amicizia tra utenti che si
--    sono bloccati a vicenda.
drop policy if exists "friendships_block_insert" on public.friendships;
create policy "friendships_block_insert" on public.friendships
  as restrictive
  for insert
  to authenticated
  with check (
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = user_id and b.blocked_id = friend_id)
         or (b.blocker_id = friend_id and b.blocked_id = user_id)
    )
  );

-- 5) Stesso controllo in fase di accettazione (nel caso la richiesta
--    fosse partita prima del blocco). Non limita il rifiuto, che nel
--    frontend passa da DELETE, non da UPDATE.
drop policy if exists "friendships_block_update" on public.friendships;
create policy "friendships_block_update" on public.friendships
  as restrictive
  for update
  to authenticated
  with check (
    not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = user_id and b.blocked_id = friend_id)
         or (b.blocker_id = friend_id and b.blocked_id = user_id)
    )
  );
