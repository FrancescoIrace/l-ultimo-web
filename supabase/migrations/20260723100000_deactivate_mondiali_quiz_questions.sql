-- Le 149 domande a tema "Mondiali 2026" lasciano spazio a un pool piu' vario
-- (storia del calcio, trasferimenti storici, aneddoti da spogliatoio, maglie/sponsor
-- - vedi 20260723110000). Disattiviamo invece di cancellare: is_active=false toglie
-- le vecchie domande dal pool servito al client (select in SfidaGiornaliera.jsx non
-- filtra per is_active perche' la RLS lo fa gia', vedi 20260715120000) senza perdere
-- lo storico, nel caso si voglia far ruotare i temi in futuro.
update public.quiz_questions
set is_active = false
where theme = 'mondiali_2026';
