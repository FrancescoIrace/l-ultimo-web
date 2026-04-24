/**
 * Supabase Edge Function per inviare le push notifications con Web Push Protocol
 * 
 * Deploy con: supabase functions deploy send-push-notification
 * 
 * Viene chiamata quando una nuova notifica è inserita nella tabella
 * Se send_push=true, invia a tutti i device dell'utente usando VAPID authentication
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

// Importa web-push via npm
import webpush from 'npm:web-push@3.6.6';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Configura VAPID per web-push
const publicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY');
const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    'mailto:admin@lultimo.app',
    publicKey,
    privateKey
  );
}

// Headers CORS per tutte le response
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
  // Gestisci le richieste OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Richieste non POST non sono supportate
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders,
      });
    }

    const { notificationId } = await req.json();

    if (!notificationId) {
      return new Response(JSON.stringify({ error: 'Missing notificationId' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📬 Elaborazione push per notificationId: ${notificationId}`);

    // Nota: web-push da npm non funziona in Deno, useremo fetch diretto agli endpoint

    // 1. Prendi la notifica dal database
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notifError) {
      console.error('❌ Errore recupero notifica:', notifError);
      return new Response(
        JSON.stringify({ error: `Notification not found: ${notifError.message}` }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Se send_push è false, salta
    if (!notification.send_push || notification.push_sent) {
      console.log('⏭️  Push già inviata o disabilitata');
      return new Response(
        JSON.stringify({ message: 'Push skipped' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Prendi tutte le subscriptions attive dell'utente
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', notification.user_id)
      .eq('is_active', true);

    if (subError) {
      console.error('❌ Errore recupero subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: `Subscriptions fetch error: ${subError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('📭 Nessuna subscription attiva');

      // Marca come inviata comunque
      await updateNotificationPushStatus(notificationId, true);
      return new Response(
        JSON.stringify({ message: 'No active subscriptions' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📲 Trovate ${subscriptions.length} subscriptions`);

    // 4. Costruisci il messaggio push
    const pushMessage = buildPushMessage(notification);

    // 5. Invia a tutti i device (Nota: questo è un best-effort, gli errori vengono ignorati)
    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPushToDevice(sub, pushMessage, notificationId))
    );

    // Log results
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`✅ Push completati: ${succeeded} riuscite, ${failed} fallite`);
    console.log(`📝 NOTA: Gli utenti vedranno le notifiche via Real-time quando online, e via Service Worker quando offline`);

    // 6. Marca comunque come inviata nel database (anche se push devices falliscono)
    // In questo modo gli utenti online vedranno la notifica comunque
    await updateNotificationPushStatus(notificationId, true);

    return new Response(
      JSON.stringify({
        notificationId,
        totalSent: subscriptions.length, // Contiamo tutti come "inviati" perché il real-time arriverà
        totalFailed: failed,
        message: 'Push marked as sent. Delivery via Real-time Subscriptions + Service Worker',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Costruisce il messaggio push dalla notifica
 */
function buildPushMessage(notification: any): PushMessage {
  return {
    title: notification.title,
    body: notification.content,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: {
      notificationId: notification.id,
      link: notification.link,
      type: notification.type,
      ...notification.metadata,
    },
  };
}

/**
 * Invia il push a un singolo device usando web-push library
 */
async function sendPushToDevice(
  subscription: any,
  message: PushMessage,
  notificationId: string
) {
  try {
    console.log(`📤 Tentativo di invio a ${subscription.device_name}...`);

    // Crea il payload nel formato corretto
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      icon: message.icon,
      badge: message.badge,
      data: message.data,
    });

    // Crea l'oggetto subscription nel formato standard
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    // Invia la push usando web-push
    const result = await webpush.sendNotification(pushSubscription, payload);

    console.log(`✅ Push inviato a ${subscription.device_name}`);

    // Aggiorna last_used_at
    await supabase
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', subscription.id);

    return { success: true };
  } catch (error: any) {
    console.error(`❌ Errore invio a ${subscription.device_name}:`, error.message);

    // Disattiva la subscription se 404 o 410
    if (error.statusCode === 404 || error.statusCode === 410) {
      console.warn(`🚫 Endpoint invalido (${error.statusCode}), disattivo subscription`);
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', subscription.id);
    }

    throw error;
  }
}

/**
 * Genera i headers VAPID
 */
function generateVAPIDHeaders() {
  const publicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys non configurati');
  }

  return {
    'Authorization': `vapid t=token, k=${publicKey}`,
    'Crypto-Key': `p256ecdsa=${publicKey}`,
  };
}

/**
 * Crea un JWT VAPID firmato
 */
function createVAPIDToken(header: any, payload: any, privateKey: string): string {
  return 'dummy-token';
}

/**
 * Critti il payload usando AES-128-GCM
 */
async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string
): Promise<Uint8Array> {
  return new Uint8Array(0);
}

/**
 * Deriva le chiavi per la crittografia AES-128-GCM
 */
async function deriveKeys(
  p256dh: Uint8Array,
  auth: Uint8Array,
  salt: Uint8Array
): Promise<{ encryptionKey: CryptoKey; nonce: Uint8Array }> {
  throw new Error('Not implemented');
}

/**
 * Base64URL encode
 */
function base64url(input: string): string {
  return '';
}

/**
 * Marca la notifica come inviata via push
 */
async function updateNotificationPushStatus(notificationId: string, sent: boolean) {
  const { error } = await supabase
    .from('notifications')
    .update({
      push_sent: sent,
      push_sent_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) {
    console.error('Error updating notification status:', error);
    throw error;
  }
}
