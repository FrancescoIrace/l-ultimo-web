-- Da quando un account cancellato lascia le sue partite create visibili con
-- creator_id = NULL (vedi Edge Function delete-own-account), qualunque
-- trigger che notifica "l'organizzatore" senza controllare se esiste ancora
-- rischia un insert con notifications.user_id = NULL, che viola il vincolo
-- NOT NULL e fa fallire l'operazione che l'ha innescato (es. un giocatore
-- che abbandona una partita orfana con lista d'attesa attiva).
--
-- handle_participant_withdrawal(): la notifica "ripescaggio completato"
-- all'organizzatore (v_creator_id) non controllava mai se fosse NULL.
create or replace function public.handle_participant_withdrawal()
returns trigger
language plpgsql
security definer
as $function$
DECLARE
    v_next_user_id UUID;
    v_next_username TEXT;
    v_match_title TEXT;
    v_match_sport TEXT;
    v_creator_id UUID;
    v_display_name TEXT;
BEGIN
    -- Scatta solo se chi se ne va era confermato
    IF OLD.status = 'confirmed' THEN

        -- 1. Recupero dati del match con COALESCE per evitare stringhe vuote
        SELECT
            m.title,
            m.sport,
            m.creator_id
        INTO
            v_match_title,
            v_match_sport,
            v_creator_id
        FROM public.matches m
        WHERE m.id = OLD.match_id;

        -- Determiniamo il nome da mostrare: Titolo o, se manca, lo Sport
        v_display_name := COALESCE(NULLIF(v_match_title, ''), v_match_sport, 'Partita');

        -- 2. Recupero il primo utente in lista d'attesa
        SELECT p.user_id, pr.username INTO v_next_user_id, v_next_username
        FROM public.participants p
        JOIN public.profiles pr ON p.user_id = pr.id
        WHERE p.match_id = OLD.match_id AND p.status = 'waiting'
        ORDER BY p.waitlist_order ASC, p.created_at ASC
        LIMIT 1;

        -- 3. Se c'è un ripescato, eseguiamo la promozione e inviamo le notifiche
        IF v_next_user_id IS NOT NULL THEN
            UPDATE public.participants
            SET status = 'confirmed', waitlist_order = NULL
            WHERE match_id = OLD.match_id AND user_id = v_next_user_id;

            -- Notifica per il giocatore ripescato
            INSERT INTO notifications (user_id, title, content, type, link, send_push)
            VALUES (
                v_next_user_id,
                'Sei in partita! 💪',
                'Si è liberato un posto in "' || v_display_name || '". Sei pronto?',
                'match_promotion',
                '/match/' || OLD.match_id,
                true
            );

            -- Notifica per l'organizzatore, solo se esiste ancora (l'account
            -- potrebbe essere stato cancellato, lasciando la partita orfana)
            IF v_creator_id IS NOT NULL THEN
                INSERT INTO notifications (user_id, title, content, type, link, send_push)
                VALUES (
                    v_creator_id,
                    'Ripescaggio completato 🔄',
                    v_next_username || ' è entrato in partita per "' || v_display_name || '".',
                    'match_promotion',
                    '/match/' || OLD.match_id,
                    false
                );
            END IF;
        ELSE
            -- Se non c'è nessuno in lista, scalo semplicemente il contatore
            UPDATE public.matches
            SET current_players = GREATEST(0, current_players - 1)
            WHERE id = OLD.match_id;
        END IF;
    END IF;

    RETURN OLD;
END;
$function$;

-- notify_match_leave(): "organizer_id != OLD.user_id" con organizer_id NULL
-- valuta a NULL (non TRUE) in SQL, quindi IF lo tratta già come falso e la
-- notifica viene saltata correttamente - ma solo per un dettaglio implicito
-- di three-valued logic. Reso esplicito per non fare affidamento su quella
-- sottigliezza.
create or replace function public.notify_match_leave()
returns trigger
language plpgsql
as $function$
DECLARE
  organizer_id uuid;
  match_title text;
  leaver_name text;
BEGIN
  SELECT creator_id, title INTO organizer_id, match_title
  FROM matches
  WHERE id = OLD.match_id;

  SELECT username INTO leaver_name
  FROM profiles
  WHERE id = OLD.user_id;

  IF organizer_id IS NOT NULL AND organizer_id != OLD.user_id THEN
    INSERT INTO notifications (user_id, sender_id, type, title, content, link)
    VALUES (
      organizer_id,
      OLD.user_id,
      'match_leave',
      '👋 Giocatore in Partenza',
      leaver_name || ' ha abbandonato "' || match_title || '"',
      '/match/' || OLD.match_id
    );
  END IF;

  RETURN OLD;
END;
$function$;
