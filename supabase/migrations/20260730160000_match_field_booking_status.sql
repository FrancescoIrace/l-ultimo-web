-- Stato prenotazione del campo per le partite NON gestite da un centro
-- affiliato (luogo libero o campo pubblico): oggi i giocatori non sanno se il
-- campo è davvero prenotato. L'organizzatore lo dichiara e lo aggiorna, così
-- si evita il classico "ma il campo è prenotato?". Distinto da
-- reservation_status, che riguarda la prenotazione tramite un centro nell'app.
--
-- 'booked' = prenotato, 'to_book' = da prenotare, 'not_needed' = non serve.
-- NULL = non applicabile (es. campo di un centro affiliato) o non impostato.

alter table public.matches add column if not exists field_booking_status text
  check (field_booking_status in ('booked', 'to_book', 'not_needed'));
alter table public.matches add column if not exists field_booking_note text;
