-- Prima stagione: "Ferie d'Agosto", 1-22 agosto 2026. Il reset di
-- profiles.total_points e lo snapshot del podio precedente (non applicabile
-- qui, e' la prima stagione) vanno eseguiti separatamente al momento giusto
-- (vedi piano: migrazione dedicata il 1 agosto).
insert into public.quiz_seasons (name, starts_on, ends_on)
values ('Ferie d''Agosto', '2026-08-01', '2026-08-22');
