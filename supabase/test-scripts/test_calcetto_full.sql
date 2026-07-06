-- ============================================================
-- SCRIPT DI TEST (non una migration) — crea una partita di
-- calcetto 5vs5 PIENA (10/10) usando profili già esistenti.
-- Esegui in Supabase Dashboard -> SQL Editor (serve il ruolo
-- postgres/service, che bypassa RLS; l'anon key non basterebbe
-- per leggere auth.users).
-- ============================================================

DO $$
DECLARE
  v_creator_email text := 'admin@admin.it'; -- <-- cambia con l'email dell'organizzatore che vuoi usare
  v_creator_id uuid;
  v_match_id uuid;
  v_max_players int := 10;
  v_other_ids uuid[];
  v_total_players int;
BEGIN
  SELECT id INTO v_creator_id FROM auth.users WHERE email = v_creator_email;
  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Nessun utente trovato con email %', v_creator_email;
  END IF;

  -- Altri profili esistenti (esclude l'organizzatore), fino a riempire i posti restanti
  SELECT array_agg(id) INTO v_other_ids
  FROM (
    SELECT id FROM public.profiles
    WHERE id <> v_creator_id
    ORDER BY random()
    LIMIT (v_max_players - 1)
  ) sub;

  v_total_players := 1 + COALESCE(array_length(v_other_ids, 1), 0);

  INSERT INTO public.matches (
    title, sport, datetime, location, location_lat, location_lng,
    max_players, description, court_id, creator_id, team_id,
    reservation_status, current_players, team1_name, team2_name
  ) VALUES (
    'Test Calcetto FULL',
    'Calcetto',
    (now() + interval '2 days')::timestamp,
    'Centro Sportivo Test',
    41.9028, 12.4964,
    v_max_players,
    'Partita di test generata via SQL per verificare il comportamento a rosa completa.',
    NULL, v_creator_id, NULL,
    'none', v_total_players,
    'Squadra A (Colorati)', 'Squadra B (Bianchi)'
  ) RETURNING id INTO v_match_id;

  -- Organizzatore come primo partecipante confermato, Squadra A
  INSERT INTO public.participants (match_id, user_id, status, team_number)
  VALUES (v_match_id, v_creator_id, 'confirmed', 1);

  -- Altri partecipanti, alternati tra Squadra A e B
  IF v_other_ids IS NOT NULL THEN
    INSERT INTO public.participants (match_id, user_id, status, team_number)
    SELECT v_match_id, uid, 'confirmed', CASE WHEN (row_number() OVER ()) % 2 = 0 THEN 1 ELSE 2 END
    FROM unnest(v_other_ids) AS uid;
  END IF;

  RAISE NOTICE 'Match % creato con % giocatori su % (creator_id=%)', v_match_id, v_total_players, v_max_players, v_creator_id;
  IF v_total_players < v_max_players THEN
    RAISE NOTICE 'ATTENZIONE: nel DB ci sono solo % profili totali disponibili: la partita NON è realmente piena (%/%). Per testare lo stato "al completo" servono almeno % account distinti.', v_total_players, v_total_players, v_max_players, v_max_players;
  END IF;
END $$;

-- ============================================================
-- CLEANUP (facoltativo): rimuove la partita di test e i suoi
-- partecipanti. Esegui quando hai finito di testare.
-- ============================================================
-- DELETE FROM public.participants WHERE match_id IN (SELECT id FROM public.matches WHERE title = 'Test Calcetto FULL');
-- DELETE FROM public.matches WHERE title = 'Test Calcetto FULL';
