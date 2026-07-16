-- daily_game_attempts e leaderboard_history sono state create a mano dal dashboard
-- Supabase per la Sfida Giornaliera (src/components/SfidaGiornaliera.jsx) senza mai
-- passare da una migrazione. Questo file le porta sotto version control e aggiunge
-- il vincolo UNIQUE mancante su (user_id, played_at), che oggi non esiste: il client
-- controlla "ho già giocato oggi?" con una SELECT prima di fare INSERT, quindi due
-- richieste concorrenti (es. due tab) potrebbero inserire due tentativi nello stesso
-- giorno. Il vincolo chiude la race condition a livello DB.
--
-- Se l'ALTER TABLE qui sotto fallisce per violazione dell'unique constraint, vuol
-- dire che in produzione esistono già righe duplicate (stesso user_id + played_at):
-- vanno deduplicate manualmente prima di poter applicare questo vincolo.

create table if not exists public.daily_game_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  played_at date not null default current_date
);

create table if not exists public.leaderboard_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_game_attempts_user_id_played_at_key'
  ) then
    alter table public.daily_game_attempts
      add constraint daily_game_attempts_user_id_played_at_key unique (user_id, played_at);
  end if;
end $$;

create index if not exists leaderboard_history_user_id_idx
  on public.leaderboard_history (user_id);
