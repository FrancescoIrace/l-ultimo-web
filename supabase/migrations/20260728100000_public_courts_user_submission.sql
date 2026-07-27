-- Segnalazione campi pubblici da parte degli utenti (previsto ma non
-- costruito nella prima versione di public_courts, vedi 20260727100000):
-- un utente puo' inserire una riga solo con status='pending' e
-- submitted_by=se stesso - resta invisibile a tutti (la select pubblica
-- filtra su status='approved') finche' un admin non la approva dal
-- pannello (semplice update a status='approved', o delete se rifiutata).
-- Si somma (non sostituisce) alla policy admin "for all" gia' esistente.

drop policy if exists "public_courts_insert_pending_self" on public.public_courts;
create policy "public_courts_insert_pending_self" on public.public_courts
  for insert
  to authenticated
  with check (
    status = 'pending'
    and submitted_by = auth.uid()
  );
