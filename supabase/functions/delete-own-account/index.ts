/**
 * Supabase Edge Function per l'auto-cancellazione dell'account (richiesta
 * obbligatoria di Google Play per le app che permettono la creazione di un
 * account). Il client JS non può farlo da solo: auth.admin.deleteUser()
 * richiede la service_role key, che non deve mai stare nel frontend.
 *
 * L'utente cancella SOLO se stesso: l'id target è sempre quello ricavato
 * dal JWT della richiesta, mai un parametro passato dal client.
 *
 * Gli account centro (profiles.role = 'center') sono bloccati qui: la
 * chiusura di un centro tocca prenotazioni/campi di altri utenti e va
 * gestita a mano via supporto, non con la stessa cancellazione self-service.
 *
 * Deploy con: supabase functions deploy delete-own-account
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Non autenticato' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'center') {
      return new Response(
        JSON.stringify({ error: 'Gli account centro non si possono cancellare da qui. Contatta il supporto.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Tabelle "personali": nessun altro utente le vede o le possiede,
    // si cancellano senza toccare nient'altro.
    await supabaseAdmin.from('contact_requests').delete().eq('user_id', userId);
    await supabaseAdmin.from('daily_game_attempts').delete().eq('user_id', userId);
    await supabaseAdmin.from('leaderboard_history').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_sport_roles').delete().eq('user_id', userId);
    await supabaseAdmin.from('friendships').delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    await supabaseAdmin.from('user_blocks').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId);
    await supabaseAdmin.from('notifications').delete().or(`user_id.eq.${userId},sender_id.eq.${userId}`);
    await supabaseAdmin.from('match_messages').delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    await supabaseAdmin.from('match_message_reports').delete().or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`);
    await supabaseAdmin.from('match_reschedule_requests').delete().eq('requested_by', userId);

    // 2. Segnalazioni/recensioni: le review_reports che puntano a recensioni
    // dell'utente vanno cancellate PRIMA delle recensioni stesse, altrimenti
    // resterebbero orfane (review_reports.review_id non ha cascade nota).
    const { data: ownReviews } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .or(`reviewer_id.eq.${userId},target_id.eq.${userId}`);
    const ownReviewIds = (ownReviews || []).map((r) => r.id);
    if (ownReviewIds.length > 0) {
      await supabaseAdmin.from('review_reports').delete().in('review_id', ownReviewIds);
    }
    await supabaseAdmin.from('review_reports').delete().eq('reporter_id', userId);
    await supabaseAdmin.from('reviews').delete().or(`reviewer_id.eq.${userId},target_id.eq.${userId}`);

    // 3. Squadre create dall'utente: se ci sono altri membri, la proprietà
    // passa al membro più anziano (join più vecchia); se l'utente era
    // l'unico membro, la squadra viene eliminata (nessun altro la vede).
    const { data: ownedTeams } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('created_by', userId);

    for (const team of ownedTeams || []) {
      const { data: otherMembers } = await supabaseAdmin
        .from('team_members')
        .select('user_id, joined_at')
        .eq('team_id', team.id)
        .neq('user_id', userId)
        .order('joined_at', { ascending: true })
        .limit(1);

      if (otherMembers && otherMembers.length > 0) {
        await supabaseAdmin
          .from('teams')
          .update({ created_by: otherMembers[0].user_id })
          .eq('id', team.id);
      } else {
        // Nessun altro membro: prima orfaniamo eventuali partite assegnate
        // a questa squadra (matches.team_id -> teams ha FK, un delete diretto
        // fallirebbe con righe ancora collegate), poi eliminiamo la squadra.
        await supabaseAdmin.from('matches').update({ team_id: null }).eq('team_id', team.id);
        await supabaseAdmin.from('teams').delete().eq('id', team.id);
      }
    }

    // Le iscrizioni dell'utente a QUALSIASI squadra (comprese quelle appena
    // riassegnate/eliminate sopra) si cancellano ora, dopo aver deciso le
    // sorti delle squadre di cui era proprietario.
    await supabaseAdmin.from('team_members').delete().eq('user_id', userId);

    // 4. Partite create dall'utente: restano visibili agli altri iscritti
    // (matches.creator_id non ha FK, quindi impostarlo a null è sicuro),
    // solo l'organizzatore non risulta più collegato all'account cancellato.
    await supabaseAdmin.from('matches').update({ creator_id: null }).eq('creator_id', userId);

    // La partecipazione dell'utente a QUALSIASI partita (comprese le proprie,
    // di cui restava comunque partecipante come organizzatore) si cancella.
    await supabaseAdmin.from('participants').delete().eq('user_id', userId);

    // 5. Foto profilo su Storage (best-effort: se non esiste non è un errore)
    await supabaseAdmin.storage.from('avatars').remove([`${userId}/avatar.png`]);

    // 6. Il profilo pubblico
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // 7. L'account Auth vero e proprio: senza questo passaggio l'utente
    // potrebbe ancora accedere con le stesse credenziali dopo la
    // cancellazione, ritrovandosi senza un profilo collegato.
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) throw deleteAuthError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Errore delete-own-account:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
