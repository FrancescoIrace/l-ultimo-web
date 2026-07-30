-- Fix: la colonna `bio` era stata data per esistente (referenziata nel codice
-- per i profili "centro") ma in realtà non era mai stata creata, quindi il
-- salvataggio del profilo con "Su di me" falliva con "Could not find the 'bio'
-- column". La aggiungiamo qui. Vale sia per i giocatori (Su di me) sia per i
-- centri (descrizione del centro).

alter table public.profiles add column if not exists bio text;
