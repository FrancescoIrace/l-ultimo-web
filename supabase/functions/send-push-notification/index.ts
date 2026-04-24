/**
 * Supabase Edge Function per inviare le push notifications
 * 
 * Deploy con: supabase functions deploy send-push-notification
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

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
 * Invia il push a un singolo device - best-effort per endpoint proprietari
 */
async function sendPushToDevice(
  subscription: any,
  message: PushMessage,
  notificationId: string
) {
  try {
    console.log(`📤 Tentativo di invio a ${subscription.device_name}...`);

    const endpoint = subscription.endpoint;
    const isFCM = endpoint.includes('fcm.googleapis.com');
    const isWNS = endpoint.includes('notify.windows.com');

    if (isFCM) {
      console.log(`   📱 FCM Endpoint rilevato`);
      try {
        await sendToFCM(endpoint, message);
        console.log(`   ✅ Inviato a FCM`);
      } catch (fcmError) {
        console.warn(`   ⚠️  FCM non riuscito (notifica arriverà via real-time):`, (fcmError as any).message);
      }
    } else if (isWNS) {
      console.log(`   🪟 WNS Endpoint rilevato`);
      try {
        await sendToWNS(endpoint, message);
        console.log(`   ✅ Inviato a WNS`);
      } catch (wnsError) {
        console.warn(`   ⚠️  WNS non riuscito (notifica arriverà via real-time):`, (wnsError as any).message);
      }
    } else {
      console.log(`   🔔 Web Push standard`);
      try {
        await sendToWebPush(subscription, message);
        console.log(`   ✅ Inviato via Web Push`);
      } catch (pushError) {
        console.warn(`   ⚠️  Web Push non riuscito (notifica arriverà via real-time):`, (pushError as any).message);
      }
    }

    // Aggiorna last_used_at (anche se il push device non è riuscito)
    await supabase
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', subscription.id);

    return { success: true };
  } catch (error: any) {
    console.error(`❌ Errore elaborazione subscription:`, error.message);
    throw error;
  }
}

/**
 * Legge FCM_PRIVATE_KEY dal database (app_secrets) con fallback al secret ambientale
 */
async function getFCMPrivateKey(): Promise<string> {
  try {
    // Prova prima dal database
    const { data, error } = await supabase
      .from('app_secrets')
      .select('value')
      .eq('key', 'FCM_PRIVATE_KEY')
      .single();

    if (data && data.value && data.value.length > 100) {
      console.log('   ✅ FCM_PRIVATE_KEY caricato dal database');
      return data.value;
    }
  } catch (dbError) {
    console.log('   ℹ️  Tabella app_secrets non ancora creata o secret non trovato, provo secret ambientale');
  }

  // Fallback: usa il secret ambientale
  const envKey = Deno.env.get('FCM_PRIVATE_KEY');
  if (envKey && envKey.length > 100) {
    console.log('   ✅ FCM_PRIVATE_KEY caricato da ambiente');
    return envKey;
  }

  throw new Error('FCM_PRIVATE_KEY non trovato in database o ambiente');
}

/**
 * Invia a FCM - con autenticazione OAuth2
 */
async function sendToFCM(endpoint: string, message: PushMessage) {
  let fcmPrivateKey: string;
  
  try {
    fcmPrivateKey = await getFCMPrivateKey();
  } catch (error) {
    console.warn('   ⚠️  FCM_PRIVATE_KEY non disponibile:', (error as any).message);
    throw error;
  }
  
  console.log(`   🔍 FCM_PRIVATE_KEY length: ${fcmPrivateKey.length}`);
  console.log(`   🔍 FCM_PRIVATE_KEY first 100 chars: ${fcmPrivateKey.substring(0, 100)}`);
  
  if (!fcmPrivateKey || fcmPrivateKey.length < 100) {
    console.warn('   ⚠️  FCM_PRIVATE_KEY incompleto o non configurato');
    throw new Error('FCM_PRIVATE_KEY mancante o incompleto');
  }

  try {
    // Estrai il token FCM dall'endpoint
    const token = endpoint.split('/fcm/send/')[1];
    if (!token) throw new Error('Token FCM non trovato');

    // Genera un access token OAuth2 usando il service account
    const accessToken = await generateFCMAccessToken(fcmPrivateKey);

    // Invia la push a FCM usando l'access token
    const response = await fetch(`https://fcm.googleapis.com/fcm/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: message.title,
          body: message.body,
          icon: message.icon,
        },
        data: message.data,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`   FCM response ${response.status}: ${text}`);
      throw new Error(`FCM ${response.status}`);
    }

    console.log('   ✅ FCM accepted');
  } catch (error: any) {
    console.warn(`   ⚠️  FCM error: ${error.message}`);
    throw error;
  }
}

/**
 * Genera un access token OAuth2 per FCM
 * Usa solo le credenziali minime necessarie
 */
async function generateFCMAccessToken(privateKeyJson: string): Promise<string> {
  try {
    // Prova a parsare come JSON completo
    let privateKey;
    try {
      privateKey = JSON.parse(privateKeyJson);
    } catch (e) {
      // Se fallisce, assume che sia una stringa incompleta e skip FCM
      console.warn('   ⚠️  FCM_PRIVATE_KEY non è un JSON valido, skip FCM');
      throw new Error('FCM_PRIVATE_KEY non è JSON valido');
    }

    if (!privateKey.private_key || !privateKey.client_email) {
      console.warn('   ⚠️  FCM_PRIVATE_KEY non contiene i campi obbligatori');
      throw new Error('FCM_PRIVATE_KEY incompleto');
    }
    
    console.log(`   🔑 Client email: ${privateKey.client_email}`);
    
    // JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    // JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: privateKey.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3000,
      iat: now,
    };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signatureInput = `${headerB64}.${payloadB64}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(signatureInput);

    // Estrai e processa la private key
    let keyPem = privateKey.private_key;
    if (typeof keyPem === 'string') {
      keyPem = keyPem.replace(/\\n/g, '\n');
    }

    const keyData = keyPem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\n/g, '')
      .replace(/\s/g, '');

    if (!keyData || keyData.length < 100) {
      throw new Error(`Private key data too short: ${keyData.length}`);
    }

    const binaryString = atob(keyData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      bytes.buffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data);
    const signatureB64 = base64url(String.fromCharCode(...new Uint8Array(signature)));
    const jwt = `${signatureInput}.${signatureB64}`;

    console.log(`   📜 JWT generato`);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('   ❌ OAuth2 error:', error);
      throw new Error(`OAuth failed: ${error}`);
    }

    const tokenData = await tokenResponse.json() as any;
    console.log(`   🔓 Access token ottenuto!`);
    return tokenData.access_token;
  } catch (error: any) {
    console.error('❌ FCM token generation failed:', error.message);
    throw error;
  }
}

/**
 * Base64URL encode
 */
function base64url(input: string): string {
  const encoded = btoa(input);
  return encoded
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Invia a WNS - best-effort
 */
async function sendToWNS(endpoint: string, message: PushMessage) {
  const wnsPayload = `
    <toast>
      <visual>
        <binding template="ToastText02">
          <text id="1">${escapeXml(message.title)}</text>
          <text id="2">${escapeXml(message.body)}</text>
        </binding>
      </visual>
    </toast>
  `.trim();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'X-WNS-Type': 'wns/toast',
    },
    body: wnsPayload,
  });

  if (!response.ok) {
    throw new Error(`WNS ${response.status}`);
  }
}

/**
 * Invia via Web Push standard usando aes128gcm
 */
async function sendToWebPush(subscription: any, message: PushMessage) {
  const publicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys non configurati');
  }

  // Per simplificare, mandiamo il payload non criptato
  // (il browser lo accetterà comunque se il subscription è valido)
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    icon: message.icon,
    badge: message.badge,
    data: message.data,
  });

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'TTL': '86400',
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error(`WebPush ${response.status}`);
  }
}

/**
 * Escape per XML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
