/**
 * Supabase Edge Function per inviare le push notifications
 * 
 * Deploy con: supabase functions deploy send-push-notification
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";
// Se preferisci usare i singoli componenti come SignJWT:
const { SignJWT, importPKCS8 } = jose;

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
      subscriptions.map((sub) => {
        // --- LOGICA DI PULIZIA TOKEN ---
        let deviceToken = sub.endpoint;

        // Se l'endpoint contiene l'URL completo di Google, estraiamo solo il token finale
        // Esempio: da "https://fcm.googleapis.com/fcm/send/DEVICE_TOKEN" a "DEVICE_TOKEN"
        if (deviceToken.includes('/fcm/send/')) {
          const parts = deviceToken.split('/fcm/send/');
          deviceToken = parts[parts.length - 1];
        }

        // Rimuoviamo eventuali spazi bianchi o caratteri spuri
        deviceToken = deviceToken.trim();
        // -------------------------------

        // Ora chiamiamo la funzione di invio passando il token pulito
        // NOTA: Se la tua funzione 'sendPushToDevice' accetta l'intero oggetto 'sub', 
        // potresti dover modificare anche quella funzione per usare 'deviceToken' invece di 'sub.endpoint'
        return sendToFCM(deviceToken, pushMessage);
      })
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
  console.log(`DEBUG DB: Title="${notification.title}", Content="${notification.content}"`);
  return {
    title: notification.title || "Nuovo aggiornamento",
    body: notification.content || notification.message || "Tocca per vedere i dettagli", // Prova anche .message
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: {
      notificationId: notification.id,
      link: notification.link || '/',
      type: notification.type || 'general',
      ...notification.metadata,
    },
  };
}

/**
 * Invia il push a un singolo device - best-effort per endpoint proprietari
 */
async function sendPushToDevice(sub: any, pushMessage: any, notificationId: string) {
  try {
    let token = sub.endpoint;

    // Pulizia del token (Cruciale per FCM V1)
    if (token.includes('/fcm/send/')) {
      token = token.split('/fcm/send/').pop();
    }
    token = token.trim();

    // Log per debug (controlla che non sia un URL!)
    console.log(`📤 Tentativo di invio a Android. Token: ${token.substring(0, 15)}...`);

    // Chiama la funzione di invio che abbiamo sistemato nei messaggi precedenti
    return await sendToFCM(token, pushMessage);

  } catch (error) {
    console.error(`❌ Fallimento invio al device ${sub.id}:`, error.message);
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
    // Assicurati che 'message' sia l'oggetto restituito da buildPushMessage
    // Assicurati che 'message' sia quello che arriva da buildPushMessage
    const payload = {
      message: {
        token: deviceToken,
        // 1. Notifica standard (Android la legge qui)
        notification: {
          title: String(message.title).trim(),
          body: String(message.body).trim(),
        },
        // 2. Dati (Il Service Worker la legge qui)
        // Importante: forziamo title e body anche qui dentro
        data: {
          title: String(message.title).trim(),
          body: String(message.body).trim(),
          notificationId: String(message.data?.notificationId || ""),
          link: String(message.data?.link || "/"),
        },
        // 3. Configurazione Apple (iOS la legge qui)
        apns: {
          payload: {
            aps: {
              alert: {
                title: String(message.title).trim(),
                body: String(message.body).trim(),
              },
              sound: "default",
              badge: 1,
              "mutable-content": 1,
            },
          },
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert",
          }
        }
      }
    };

    // Log di controllo prima dell'invio (Cruciale per vedere se il JSON è rotto)
    console.log("🚀 Payload finale inviato a Google:", JSON.stringify(payload));

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
    const serviceAccount = JSON.parse(privateKeyJson);
    let pKey = serviceAccount.private_key;

    // 1. PULIZIA TOTALE
    // Trasformiamo i \n testuali in veri a capo e rimuoviamo spazi/virgolette extra
    pKey = pKey.replace(/\\n/g, '\n').replace(/"/g, '').trim();

    // 2. RICOSTRUZIONE PEM (Il "Tocco Magico")
    // Se la chiave è finita su una riga sola o ha spazi strani, la riformattiamo
    const header = "-----BEGIN PRIVATE KEY-----";
    const footer = "-----END PRIVATE KEY-----";

    if (pKey.includes(header) && pKey.includes(footer)) {
      // Estraiamo solo la parte Base64 tra header e footer
      const base64Part = pKey
        .replace(header, "")
        .replace(footer, "")
        .replace(/\s/g, ""); // Rimuove TUTTI gli spazi e gli a capo esistenti

      // Ricostruiamo la chiave con un a capo ogni 64 caratteri (formato standard)
      const matches = base64Part.match(/.{1,64}/g);
      pKey = `${header}\n${matches?.join("\n")}\n${footer}`;
    }

    // 3. GENERAZIONE JWT
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .sign(await importPKCS8(pKey, 'RS256'));

    // 4. SCAMBIO TOKEN
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(`OAuth Error: ${data.error_description}`);

    return data.access_token;
  } catch (error: any) {
    console.error('❌ Errore critico generazione token:', error.message);
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
