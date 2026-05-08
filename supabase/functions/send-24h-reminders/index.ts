/**
 * Edge Function: send-24h-reminders
 *
 * Trova le partite che iniziano tra 23 e 25 ore da adesso e
 * invia una notifica a tutti i partecipanti confermati.
 *
 * Da eseguire ogni ora via cron (vedi migration SQL).
 * Deploy: supabase functions deploy send-24h-reminders
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const supabase = createClient(
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
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // +23h
    const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000); // +25h

    // 1. Trova partite nel range 23-25h che non hanno ancora ricevuto il reminder
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('id, title')
      .gte('datetime', windowStart.toISOString())
      .lte('datetime', windowEnd.toISOString())
      .eq('reminder_24h_sent', false);

    if (matchError) throw matchError;

    console.log(`📅 Partite da notificare: ${matches?.length ?? 0}`);

    let notificationsSent = 0;

    for (const match of matches ?? []) {
      // 2. Prendi i partecipanti confermati
      const { data: participants, error: partError } = await supabase
        .from('participants')
        .select('user_id')
        .eq('match_id', match.id)
        .eq('status', 'confirmed');

      if (partError) {
        console.error(`❌ Errore partecipanti per match ${match.id}:`, partError);
        continue;
      }

      if (!participants || participants.length === 0) {
        // Nessun partecipante, segna comunque il reminder come inviato
        await supabase.from('matches').update({ reminder_24h_sent: true }).eq('id', match.id);
        continue;
      }

      // 3. Crea una notifica per ogni partecipante tramite RPC
      const notificationIds: string[] = [];

      for (const p of participants) {
        const { data: notifId, error: notifError } = await supabase.rpc(
          'create_notification_with_push',
          {
            p_user_id:   p.user_id,
            p_sender_id: null,
            p_type:      'match_reminder',
            p_title:     '⏰ Domani si gioca!',
            p_content:   `La partita "${match.title}" inizia tra circa 24 ore. Sei pronto?`,
            p_link:      `/match/${match.id}`,
            p_metadata:  { matchId: match.id },
            p_send_push: true,
          }
        );

        if (notifError) {
          console.error(`❌ Errore creazione notifica per ${p.user_id}:`, notifError);
          continue;
        }

        if (notifId) {
          notificationIds.push(notifId);
          notificationsSent++;
        }
      }

      // 4. Invia push per ogni notifica creata
      for (const notifId of notificationIds) {
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: { notificationId: notifId },
          });
        } catch (pushErr) {
          console.error(`❌ Errore push per notifica ${notifId}:`, pushErr);
        }
      }

      // 5. Segna il match come "reminder 24h inviato"
      const { error: updateError } = await supabase
        .from('matches')
        .update({ reminder_24h_sent: true })
        .eq('id', match.id);

      if (updateError) {
        console.error(`❌ Errore aggiornamento reminder_24h_sent per match ${match.id}:`, updateError);
      }

      console.log(`✅ Match ${match.id}: ${notificationIds.length} notifiche inviate`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        matchesProcessed: matches?.length ?? 0,
        notificationsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('❌ Errore generale in send-24h-reminders:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
