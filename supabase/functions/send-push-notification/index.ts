/**
 * Supabase Edge Function per inviare le push notifications
 * Deploy: npx supabase functions deploy send-push-notification
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import * as jose from "https://esm.sh/jose@5.2.3";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushMessage {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const { notificationId } = await req.json();
    if (!notificationId) {
      return new Response(JSON.stringify({ error: 'Missing notificationId' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`📬 Elaborazione push per notificationId: ${notificationId}`);

    // 1. Recupero notifica
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notifError || !notification) {
      throw new Error(`Notifica non trovata: ${notifError?.message}`);
    }

    if (!notification.send_push || notification.push_sent) {
      console.log('⏭️ Push già inviata o disabilitata');
      return new Response(JSON.stringify({ message: 'Push skipped' }), { headers: corsHeaders });
    }

    // 2. Recupero subscriptions attive
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', notification.user_id)
      .eq('is_active', true);

    if (subError || !subscriptions || subscriptions.length === 0) {
      console.log('📭 Nessuna subscription attiva. Marcata come "inviata" per Real-time.');
      await updateNotificationPushStatus(notificationId, true);
      return new Response(JSON.stringify({ message: 'No active subscriptions' }), { headers: corsHeaders });
    }

    console.log(`📲 Trovate ${subscriptions.length} subscriptions`);

    // 3. Preparazione messaggio e invio
    const pushMessage = buildPushMessage(notification);
    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPushToDevice(sub, pushMessage))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`✅ Risultato invio: ${succeeded} OK, ${failed} Fallite`);

    await updateNotificationPushStatus(notificationId, true);

    return new Response(JSON.stringify({ success: true, succeeded, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

/**
 * Funzione principale invio FCM v1
 */
async function sendToFCM(deviceToken: string, message: PushMessage) {
  const fcmPrivateKeyString = Deno.env.get('FCM_PRIVATE_KEY');
  if (!fcmPrivateKeyString) throw new Error('FCM_PRIVATE_KEY mancante');

  const serviceAccount = JSON.parse(fcmPrivateKeyString);
  const accessToken = await generateFCMAccessToken(serviceAccount);

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

  const response = await fetch(fcmUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FCM v1 Error ${response.status}: ${errorText}`);
  }
}

/**
 * Genera il Token OAuth2
 */
async function generateFCMAccessToken(serviceAccount: any): Promise<string> {
  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  
  const cleanKey = serviceAccount.private_key
    .replace(header, "")
    .replace(footer, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");

  const rows = cleanKey.match(/.{1,64}/g);
  const pem = `${header}\n${rows?.join("\n")}\n${footer}`;

  const privateKeyObj = await jose.importPKCS8(pem, 'RS256');
  const now = Math.floor(Date.now() / 1000) - 10;

  const jwt = await new jose.SignJWT({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKeyObj);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth Failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

/**
 * Orchestratore invio per device
 */
async function sendPushToDevice(subscription: any, message: PushMessage) {
  const endpoint = subscription.endpoint;

  if (endpoint.includes('fcm.googleapis.com')) {
    // 1. Estraiamo il TOKEN puro dall'URL
    // Questo prende tutto quello che c'è dopo l'ultimo "/"
    const token = endpoint.split('/').pop(); 

    console.log(`🚀 Token estratto correttamente: ${token?.substring(0, 15)}...`);

    try {
      return await sendToFCM(token, message);
    } catch (fcmErr) {
      console.error(`🔴 Errore Google su questo token: ${fcmErr.message}`);
      throw fcmErr;
    }
  } 
  
  // Per gli altri browser (Safari/Firefox) usiamo il metodo standard
  return await sendToWebPush(subscription, message);
}

function buildPushMessage(notification: any): PushMessage {
  return {
    title: notification.title,
    body: notification.content,
    data: {
      notificationId: notification.id,
      link: notification.link || '',
    },
  };
}

async function sendToWebPush(subscription: any, message: PushMessage) {
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'TTL': '86400' },
    body: JSON.stringify(message),
  });
  if (!response.ok) throw new Error(`WebPush Error ${response.status}`);
}

async function updateNotificationPushStatus(notificationId: string, sent: boolean) {
  await supabase
    .from('notifications')
    .update({ push_sent: sent, push_sent_at: new Date().toISOString() })
    .eq('id', notificationId);
}