/**
 * Supabase Edge Function per inviare una mail di alert quando viene
 * creata una nuova segnalazione in public.review_reports.
 *
 * Deploy con: supabase functions deploy notify-review-report
 * Richiede il secret: supabase secrets set RESEND_API_KEY=...
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
// Resend in sandbox (senza dominio verificato) accetta solo l'indirizzo
// esatto con cui ci si e' registrati: un alias diverso viene rifiutato.
// Arriva comunque nella stessa casella Gmail. Per usare l'alias verificare
// un dominio proprio su resend.com/domains.
const ALERT_EMAIL_TO = 'irace.dev@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewReportPayload {
  report_id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { report_id, review_id, reporter_id, reason } = (await req.json()) as ReviewReportPayload;

    if (!report_id || !review_id || !reporter_id) {
      return new Response(JSON.stringify({ error: 'Payload incompleto' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Recupera il contesto della segnalazione: chi segnala, chi ha scritto
    // la recensione, chi ne è il destinatario e il testo della recensione
    const [{ data: reporter }, { data: review }] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', reporter_id).single(),
      supabase
        .from('reviews')
        .select(`
          comment,
          rating,
          target_id,
          reviewer:reviewer_id ( id, username ),
          target:target_id ( username )
        `)
        .eq('id', review_id)
        .single(),
    ]);

    const reporterName = reporter?.username || reporter_id;
    const reviewerName = review?.reviewer?.username || review?.reviewer?.id || 'sconosciuto';
    const targetName = review?.target?.username || 'sconosciuto';

    const html = `
      <h2>Nuova segnalazione recensione</h2>
      <p><strong>Segnalata da:</strong> ${reporterName}</p>
      <p><strong>Recensione scritta da:</strong> ${reviewerName}</p>
      <p><strong>Recensione su:</strong> ${targetName}</p>
      <p><strong>Voto:</strong> ${review?.rating ?? '—'}</p>
      <p><strong>Testo recensione:</strong> ${review?.comment ? `"${review.comment}"` : '(nessun commento)'}</p>
      <p><strong>Motivo segnalazione:</strong> ${reason}</p>
      <hr />
      <p style="color:#888;font-size:12px">report_id: ${report_id} — review_id: ${review_id}</p>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ULTIMO Moderazione <onboarding@resend.dev>',
        to: ALERT_EMAIL_TO,
        subject: `⚠️ Nuova segnalazione recensione (${reviewerName})`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('❌ Errore invio email Resend:', errText);
      return new Response(JSON.stringify({ error: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Errore notify-review-report:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
