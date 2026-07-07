/**
 * Supabase Edge Function per inviare una mail di alert quando viene
 * creata una nuova richiesta in public.contact_requests (pubblicità o
 * suggerimento inviato dalla PWA).
 *
 * Deploy con: supabase functions deploy notify-contact-request
 * Richiede il secret: supabase secrets set RESEND_API_KEY=...
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const ALERT_EMAIL_TO = 'irace.dev@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TYPE_LABELS: Record<string, string> = {
  advertising: 'Pubblicità',
  suggestion: 'Suggerimento',
};

interface ContactRequestPayload {
  request_id: string;
  user_id: string | null;
  type: string;
  email: string;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { request_id, user_id, type, email, message } = (await req.json()) as ContactRequestPayload;

    if (!request_id || !type || !email || !message) {
      return new Response(JSON.stringify({ error: 'Payload incompleto' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let senderName = 'utente anonimo';
    if (user_id) {
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user_id).single();
      senderName = profile?.username || user_id;
    }

    const typeLabel = TYPE_LABELS[type] || type;

    const html = `
      <h2>Nuova richiesta di contatto: ${typeLabel}</h2>
      <p><strong>Da:</strong> ${senderName}</p>
      <p><strong>Email di risposta:</strong> ${email}</p>
      <p><strong>Messaggio:</strong> ${message}</p>
      <hr />
      <p style="color:#888;font-size:12px">request_id: ${request_id}</p>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ULTIMO Contatti <onboarding@resend.dev>',
        to: ALERT_EMAIL_TO,
        reply_to: email,
        subject: `📩 Nuova richiesta ${typeLabel} da ${senderName}`,
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
    console.error('❌ Errore notify-contact-request:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
