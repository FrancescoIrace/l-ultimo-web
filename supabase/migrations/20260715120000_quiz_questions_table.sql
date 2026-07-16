-- Le domande della Sfida Giornaliera vivevano solo nel bundle JS (questionsMondiali in
-- SfidaGiornaliera.jsx), correctIndex incluso: chiunque apra la console del browser puo'
-- leggere le risposte corrette in anticipo. Questa tabella sposta il contenuto a DB e
-- concede al client solo le colonne necessarie a mostrare la domanda, MAI correct_index
-- (vedi grant a livello di colonna sotto): la correttezza si scopre solo rispondendo,
-- tramite la RPC submit_daily_quiz_answers (vedi 20260715140000).

create table if not exists public.quiz_questions (
  id integer primary key,
  question text not null,
  options jsonb not null,
  correct_index smallint not null check (correct_index between 0 and 3),
  theme text not null default 'mondiali_2026',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.quiz_questions enable row level security;

drop policy if exists "quiz_questions_select_authenticated" on public.quiz_questions;
create policy "quiz_questions_select_authenticated"
  on public.quiz_questions
  for select
  to authenticated
  using (is_active = true);

-- Grant a livello di colonna: authenticated puo' leggere domanda/opzioni/tema, mai
-- correct_index. Nessun grant ad anon (il quiz richiede gia' il login).
revoke all on public.quiz_questions from authenticated, anon;
grant select (id, question, options, theme) on public.quiz_questions to authenticated;
