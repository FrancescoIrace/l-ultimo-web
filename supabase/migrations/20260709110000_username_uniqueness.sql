-- Gli username devono essere univoci (confronto case-insensitive) per
-- evitare ambiguità nei profili pubblici, negli inviti e nelle ricerche.
-- L'indice è la garanzia reale contro le race condition (es. due
-- registrazioni simultanee con lo stesso username); i controlli lato client
-- in Auth.jsx e Profile.jsx servono solo per un messaggio d'errore immediato.
-- I NULL restano ammessi più volte: postgres non li considera duplicati in
-- un indice unique.
create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username));
