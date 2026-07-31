-- Nota di presentazione al momento dell'iscrizione: chi si unisce può scrivere
-- due parole per farsi riconoscere ("Sono Marco, gioco a centrocampo"). È
-- facoltativa e viene mostrata in piccolo sotto lo username nel dettaglio.
alter table public.participants add column if not exists join_note text;

-- join_match_v2 ora accetta la nota (opzionale) e la salva sulla riga del
-- partecipante. Mantiene il guard sulle partite di squadra chiuse.
drop function if exists public.join_match_v2(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id uuid, p_user_id uuid, p_username text, p_note text default null)
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
    v_note TEXT;
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

    -- Normalizza la nota: null se vuota, max 200 caratteri.
    v_note := nullif(btrim(left(coalesce(p_note, ''), 200)), '');

    SELECT count(*) INTO v_current_confirmed FROM participants
    WHERE match_id = p_match_id AND status = 'confirmed';

    IF EXISTS (SELECT 1 FROM participants WHERE match_id = p_match_id AND user_id = p_user_id) THEN
        RETURN 'already_registered';
    END IF;

    IF v_current_confirmed < v_max_players THEN
        -- Caso 1: C'è posto
        INSERT INTO participants (match_id, user_id, status, join_note)
        VALUES (p_match_id, p_user_id, 'confirmed', v_note);
        UPDATE matches SET current_players = current_players + 1 WHERE id = p_match_id;

        RETURN 'confirmed';
    ELSE
        -- Caso 2: Lista d'attesa
        SELECT coalesce(max(waitlist_order), 0) + 1 INTO v_waitlist_pos FROM participants
        WHERE match_id = p_match_id AND status = 'waiting';

        INSERT INTO participants (match_id, user_id, status, waitlist_order, join_note)
        VALUES (p_match_id, p_user_id, 'waiting', v_waitlist_pos, v_note);

        RETURN 'waiting';
    END IF;
END;$function$;
