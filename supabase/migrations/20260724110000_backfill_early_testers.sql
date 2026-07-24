-- Assegna il badge "Tester Interno" a tutti i profili gia' esistenti a
-- questa data (chi c'era prima del lancio pubblico). One-shot: non va
-- rieseguita per i nuovi utenti futuri.
insert into public.early_testers (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;
