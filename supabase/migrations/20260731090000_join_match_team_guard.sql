-- Blocca l'iscrizione alle partite di squadra CHIUSE (is_public = false) da
-- parte di chi non è né il creatore né un membro della squadra. Le partite di
-- squadra sono nascoste dal feed ai non-membri, ma la RPC di join non
-- controllava la squadra: chiunque avesse il link diretto poteva iscriversi,
-- anche dopo che il creatore aveva "richiuso" la partita (is_public = false).
--
-- Regole:
--   • partita NON di squadra (team_id null)      -> chiunque, come prima
--   • partita di squadra con is_public = true     -> chiunque (aperta col link)
--   • partita di squadra con is_public = false     -> solo creatore o membri
--
-- Nuovo valore di ritorno: 'not_allowed' (gestito lato frontend).

CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id uuid, p_user_id uuid, p_username text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$DECLARE
    v_max_players INT;
    v_current_confirmed INT;
    v_waitlist_pos INT;
    v_creator_id UUID;
    v_match_title TEXT;
    v_team_id UUID;
    v_is_public BOOLEAN;
BEGIN
    SELECT max_players, creator_id, title, team_id, is_public
    INTO v_max_players, v_creator_id, v_match_title, v_team_id, v_is_public
    FROM matches WHERE id = p_match_id;

    -- Partita di squadra chiusa: solo creatore o membri della squadra.
    IF v_team_id IS NOT NULL AND coalesce(v_is_public, false) = false THEN
        IF p_user_id <> v_creator_id AND NOT EXISTS (
            SELECT 1 FROM team_members
            WHERE team_id = v_team_id AND user_id = p_user_id
        ) THEN
            RETURN 'not_allowed';
        END IF;
    END IF;

    SELECT count(*) INTO v_current_confirmed FROM participants
    WHERE match_id = p_match_id AND status = 'confirmed';

    IF EXISTS (SELECT 1 FROM participants WHERE match_id = p_match_id AND user_id = p_user_id) THEN
        RETURN 'already_registered';
    END IF;

    IF v_current_confirmed < v_max_players THEN
        -- Caso 1: C'è posto
        INSERT INTO participants (match_id, user_id, status) VALUES (p_match_id, p_user_id, 'confirmed');
        UPDATE matches SET current_players = current_players + 1 WHERE id = p_match_id;

        -- Notifica all'organizzatore (quella che avevi nel frontend)
        --INSERT INTO notifications (user_id, sender_id, title, content, type, link, send_push)
        --VALUES (v_creator_id, p_user_id, 'Nuovo partecipante! ⚽', p_username || ' si è iscritto a ' || --v_match_title, 'match_join', '/matches/' || p_match_id, true);

        RETURN 'confirmed';
    ELSE
        -- Caso 2: Lista d'attesa
        SELECT coalesce(max(waitlist_order), 0) + 1 INTO v_waitlist_pos FROM participants
        WHERE match_id = p_match_id AND status = 'waiting';

        INSERT INTO participants (match_id, user_id, status, waitlist_order)
        VALUES (p_match_id, p_user_id, 'waiting', v_waitlist_pos);

        RETURN 'waiting';
    END IF;
END;$function$;
