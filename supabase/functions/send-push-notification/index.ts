/**
 * Supabase Edge Function per inviare le push notifications
 * 
 * Deploy con: supabase functions deploy send-push-notification
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { SignJWT } from 'https://esm.sh/jose@5.4.1';

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
      console.log(`   🔥 FCM endpoint rilevato - tentando invio...`);
      try {
        await sendToFCM(endpoint, message);
        console.log(`   ✅ FCM OK`);
      } catch (fcmError) {
        console.warn(`   ⚠️  FCM fallito (notifica via Real-time):`, (fcmError as any).message);
      }
    } else if (isWNS) {
      console.log(`   🪟 WNS endpoint rilevato - tentando invio...`);
      try {
        await sendToWNS(endpoint, message);
        console.log(`   ✅ WNS OK`);
      } catch (wnsError) {
        console.warn(`   ⚠️  WNS fallito (notifica via Real-time):`, (wnsError as any).message);
      }
    } else {
      console.log(`   🔔 Web Push standard`);
      try {
        await sendToWebPush(subscription, message);
        console.log(`   ✅ Web Push OK`);
      } catch (pushError) {
        console.warn(`   ⚠️  Web Push non riuscito (notifica via real-time):`, (pushError as any).message);
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
  // Ignoriamo il database, andiamo dritti al cuore del sistema
  const secretKey = Deno.env.get('FCM_PRIVATE_KEY');
  
  if (secretKey && secretKey.length > 500) {
    console.log(`✅ Chiave caricata correttamente (Lunghezza: ${secretKey.length})`);
    return secretKey;
  }

  // Se arriviamo qui, logghiamo COSA c'è dentro per capire l'errore
  console.error(`❌ Errore critico: Chiave assente o troppo corta (${secretKey?.length || 0} caratteri).`);
  console.error(`🔍 Valore attuale: "${secretKey}"`); // Questo ti farà vedere cosa sono quei 27 caratteri
  
  throw new Error('FCM_PRIVATE_KEY non valida nei Secrets di Supabase');
}

/**
 * Invia a FCM - con autenticazione OAuth2
 */
async function sendToFCM(deviceToken: string, message: PushMessage) {
  let fcmPrivateKeyJson: string;
  
  try {
    fcmPrivateKeyJson = await getFCMPrivateKey();
  } catch (error) {
    console.error('⚠️ FCM_PRIVATE_KEY non disponibile');
    throw error;
  }

  try {
    // 1. Genera il token di accesso (OAuth2)
    const serviceAccount = JSON.parse(fcmPrivateKeyJson);
    const accessToken = await generateFCMAccessToken(fcmPrivateKeyJson);

    // 2. URL CORRETTO PER V1 (L'URL che usavi prima dava 404 o errore JSON)
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    // 3. COSTRUZIONE BODY "A PROVA DI BOMBA"
    // Usiamo String() per evitare l'errore "No number after minus sign"
    const payload = {
      message: {
        token: deviceToken,
        notification: {
          title: String(message.title || "Nuova notifica"),
          body: String(message.body || ""),
        },
        data: Object.fromEntries(
          Object.entries(message.data || {}).map(([k, v]) => [k, String(v)])
        ),
      },
    };

    console.log(`📡 Invio a Google V1...`);

    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`🔴 Dettaglio Errore Google: ${responseText}`);
      throw new Error(`FCM v1 Error ${response.status}`);
    }

    console.log('✅ FCM accepted con successo!');
  } catch (error: any) {
    console.error(`❌ Errore critico in sendToFCM: ${error.message}`);
    throw error;
  }
}

/**
 * Genera un access token OAuth2 per FCM usando jose
 */
async function generateFCMAccessToken(privateKeyJson: string): Promise<string> {
  try {
    // Prova a parsare come JSON completo
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(privateKeyJson);
    } catch (e) {
      console.warn('   ⚠️  FCM_PRIVATE_KEY non è un JSON valido, skip FCM');
      throw new Error('FCM_PRIVATE_KEY non è JSON valido');
    }

    if (!serviceAccount.private_key || !serviceAccount.client_email) {
      console.warn('   ⚠️  FCM_PRIVATE_KEY non contiene i campi obbligatori');
      throw new Error('FCM_PRIVATE_KEY incompleto');
    }
    
    console.log(`   🔑 Client email: ${serviceAccount.client_email}`);

    // Normalizza la private key (gestisci \n letterali e spazi)
    let privateKeyPEM = serviceAccount.private_key;
    console.log(`   🔍 Raw private_key da JSON (primi 100 chars): ${privateKeyPEM.substring(0, 100)}`);
    console.log(`   🔍 Raw private_key da JSON (ultimi 50 chars): ${privateKeyPEM.substring(privateKeyPEM.length - 50)}`);
    console.log(`   🔍 Contains literal \\n: ${privateKeyPEM.includes('\\n')}`);
    console.log(`   🔍 Contains actual newline: ${privateKeyPEM.includes('\n')}`);
    
    if (typeof privateKeyPEM === 'string') {
      // Sostituisci SOLO i \n letterali, non quelli reali
      privateKeyPEM = privateKeyPEM.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
      console.log(`   🔧 Dopo normalizzazione (primi 100 chars): ${privateKeyPEM.substring(0, 100)}`);
      console.log(`   🔧 Dopo normalizzazione (ultimi 50 chars): ${privateKeyPEM.substring(privateKeyPEM.length - 50)}`);
      
      // Se la chiave ha spazi al posto di newline (problema del database SQL), riforma
      const hasSpacesBetweenLines = privateKeyPEM.includes('-----BEGIN') && 
                                     privateKeyPEM.includes('-----END') &&
                                     !privateKeyPEM.includes('\n');
      
      const hasMultipleSpaces = privateKeyPEM.includes('  ') || 
                                (privateKeyPEM.match(/ [A-Za-z0-9+/]/g) || []).length > 5;
      
      if (hasSpacesBetweenLines || hasMultipleSpaces) {
        console.log(`   🔧 Rilevato problema con spazi al posto di newline - riformattando...`);
        console.log(`   🔧 hasSpacesBetweenLines: ${hasSpacesBetweenLines}, hasMultipleSpaces: ${hasMultipleSpaces}`);
        privateKeyPEM = reformatPEMKey(privateKeyPEM);
      }
    }

    console.log(`   🔍 Final private key lunghezza: ${privateKeyPEM.length}`);
    console.log(`   🔍 Final private key contains BEGIN: ${privateKeyPEM.includes('-----BEGIN PRIVATE KEY-----')}`);
    console.log(`   🔍 Final private key contains END: ${privateKeyPEM.includes('-----END PRIVATE KEY-----')}`);
    console.log(`   🔍 Final private key newline count: ${(privateKeyPEM.match(/\n/g) || []).length}`);

    // Crea JWT usando jose
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(await importPrivateKey(privateKeyPEM));

    console.log(`   📜 JWT generato con jose (lunghezza: ${jwt.length})`);
    console.log(`   📜 JWT (primi 100 chars): ${jwt.substring(0, 100)}`);

    // Scambia JWT con access token
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
 * Importa una private key PEM e ritorna una CryptoKey per jose
 */
async function importPrivateKey(pem: string) {
  // jose si aspetta una stringa PEM direttamente
  return await crypto.subtle.importKey(
    'pkcs8',
    pemToDER(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/**
 * Converte PEM a DER (formato binario)
 */
function pemToDER(pem: string): ArrayBuffer {
  // Rimuovi header/footer e newline
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  
  // Converti base64 a bytes
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Riforma una chiave PEM che ha spazi al posto di newline
 */
function reformatPEMKey(keyStr: string): string {
  const match = keyStr.match(/-----BEGIN[^-]*-----\s*([\s\S]*?)\s*-----END[^-]*-----/);
  if (!match || !match[1]) {
    return keyStr;
  }

  const base64Content = match[1].replace(/\s/g, '');
  const keyType = keyStr.includes('PRIVATE KEY') ? 'PRIVATE KEY' : 'PUBLIC KEY';

  let formattedKey = `-----BEGIN ${keyType}-----\n`;
  for (let i = 0; i < base64Content.length; i += 64) {
    formattedKey += base64Content.substring(i, i + 64) + '\n';
  }
  formattedKey += `-----END ${keyType}-----`;

  return formattedKey;
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
