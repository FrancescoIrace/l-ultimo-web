-- Configurazione per-partita della nota d'ingresso:
--   • require_join_note: se true, per iscriversi bisogna scrivere una nota.
--   • join_note_prompt: testo/domanda mostrata sopra la nota nella modale
--     (se null, si usa il testo di default). Es. "Lascia nome e cellulare per
--     il gruppo WhatsApp" oppure "Il tuo Instagram".
alter table public.matches add column if not exists require_join_note boolean not null default false;
alter table public.matches add column if not exists join_note_prompt text;
