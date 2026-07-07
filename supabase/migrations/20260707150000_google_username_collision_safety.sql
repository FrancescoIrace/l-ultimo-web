-- Rende handle_new_user() più sicura per gli account Google: full_name/name
-- non sono garantiti univoci (es. due "Mario Rossi"), quindi solo quando lo
-- username viene derivato da metadati OAuth (non passato esplicitamente dal
-- form email/password) aggiungo un suffisso corto basato sull'id utente.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  explicit_username text := nullif(meta->>'username', '');
  extracted_username text;
  extracted_avatar text;
begin
  if explicit_username is not null then
    extracted_username := explicit_username;
  else
    extracted_username := regexp_replace(
      lower(coalesce(nullif(meta->>'full_name', ''), nullif(meta->>'name', ''), split_part(new.email, '@', 1))),
      '[^a-z0-9]+', '_', 'g'
    ) || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

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
