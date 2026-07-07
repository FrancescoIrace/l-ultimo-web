-- Aggiorna il trigger di creazione profilo per estrarre nome e avatar dai
-- metadati OAuth (es. Google: full_name/name, avatar_url/picture) quando
-- presenti, mantenendo il comportamento esistente per il signup email/password
-- (che crea comunque un profilo "vuoto", poi completato lato client con
-- l'upsert in Auth.jsx dopo la scelta di username/genere/posizione).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  extracted_username text;
  extracted_avatar text;
begin
  extracted_username := coalesce(
    nullif(meta->>'username', ''),
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    split_part(new.email, '@', 1)
  );

  extracted_avatar := coalesce(
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'picture', '')
  );

  insert into public.profiles (id, username, avatar_url)
  values (new.id, extracted_username, extracted_avatar)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
