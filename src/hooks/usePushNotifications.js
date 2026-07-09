import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getFCMToken } from '../lib/firebase';

export function usePushNotifications(userId) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'Notification' in window;
    setIsSupported(supported);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (userId) checkSubscription();
  }, [userId]);

  const checkSubscription = async () => {
    if (!userId) return;
    try {
      let endpoint = null;
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        endpoint = subscription?.endpoint || null;
      }

      let query = supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);

      // Se riusciamo a identificare l'endpoint di QUESTO dispositivo,
      // controlliamo solo quello (altrimenti il toggle risultava "ON" anche
      // su un device che non si era mai iscritto, solo perché un altro
      // device dello stesso utente lo era). Su iOS getSubscription() spesso
      // non espone una vera Push subscription finché non si richiede di
      // nuovo il token: in quel caso restiamo sul controllo "per utente" per
      // non nascondere una sottoscrizione reale.
      if (endpoint) {
        query = query.eq('endpoint', endpoint);
      }

      const { data } = await query;
      setIsSubscribed(data && data.length > 0);
    } catch (err) {
      console.error('❌ Errore check sub:', err);
    }
  };

  const subscribeToPushNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('--- 🚀 INIZIO SOTTOSCRIZIONE ---');

      // 1. Permessi
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permessi notifiche negati');
      console.log('✅ 1. Permessi concessi');

      // 2. Ottieni Service Worker
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ 2. Service Worker pronto');

      // 3. Tenta di ottenere la sottoscrizione browser (fondamentale per iPhone)
      // Usiamo un try/catch interno per non bloccare tutto se il VAPID fallisce
      let browserSub = null;
      try {
        browserSub = await registration.pushManager.getSubscription();
        if (!browserSub) {
          // Se non esiste, proviamo a crearla (opzionale per Android, utile per iOS)
          console.log('🟡 Tentativo di sottoscrizione browser push...');
          // Se hai una chiave VAPID mettila qui, altrimenti lascia commentato
          // browserSub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: '...' });
        }
      } catch (e) {
        console.warn('⚠️ Nota: Sottoscrizione browser non riuscita, procedo solo con FCM', e);
      }

      // 4. Ottieni Token FCM (Firebase)
      console.log('🔐 3. Richiesta token Firebase...');
      const fcmToken = await getFCMToken();
      if (!fcmToken) throw new Error('Firebase non ha restituito alcun token');
      console.log('✅ 4. Token ricevuto:', fcmToken.substring(0, 15) + '...');

      // 5. Salva nel DB
      await saveTokenToDB(browserSub, fcmToken);

      setIsSubscribed(true);
      return { success: true };
    } catch (err) {
      console.error('❌ ERRORE CRITICO:', err.message);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const saveTokenToDB = async (browserSub, fcmToken) => {
    console.log('📡 5. Inizio salvataggio su DB Supabase...');

    if (!userId) {
      console.error('❌ Errore: userId mancante nel salvataggio');
      return;
    }

    // const endpoint = `https://fcm.googleapis.com/fcm/send/${fcmToken}`;
    const endpoint = browserSub ? browserSub.endpoint : `https://fcm.googleapis.com/fcm/send/${fcmToken}`;

    let p256dh = 'fcm-token';
    let auth = 'fcm-token';

    // Se abbiamo dati crittografici dal browser, usiamoli (per iOS)
    if (browserSub && browserSub.getKey) {
      try {
        const rawP256 = browserSub.getKey('p256dh');
        const rawAuth = browserSub.getKey('auth');
        if (rawP256 && rawAuth) {
          p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(rawP256)));
          auth = btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuth)));
          console.log('✅ Chiavi crittografiche estratte correttamente');
        }
      } catch (e) {
        console.error('❌ Errore estrazione chiavi:', e);
      }
    }

    const payload = {
      user_id: userId,
      endpoint: endpoint,
      p256dh: p256dh,
      auth: auth,
      browser_name: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Safari',
      device_name: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iOS' : 'Android',
      is_active: true,
      last_used_at: new Date().toISOString(),
    };

    console.log('📤 Invio UPSERT a Supabase:', payload);

    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'user_id,endpoint' });

    if (upsertError) {
      console.error('❌ Errore Database Supabase:', upsertError.message);
      throw upsertError;
    }

    console.log('✨ 6. DATABASE AGGIORNATO CON SUCCESSO!');
  };

  const unsubscribeFromPushNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('--- 🚫 INIZIO DISISCRIZIONE ---');

      // 1. Ottieni la sottoscrizione corrente
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      let endpoint = subscription?.endpoint || null;

      // 2. Disiscrivi dal browser (se esiste)
      if (subscription) {
        const unsubscribed = await subscription.unsubscribe();
        if (unsubscribed) {
          console.log('✅ 1. Disiscrizione browser riuscita');
        } else {
          console.warn('⚠️ Disiscrizione browser non riuscita');
        }
      }

      if (!endpoint) {
        // iOS non crea una vera Push subscription: saveTokenToDB usa come
        // endpoint un URL fittizio derivato dal token FCM, quindi lo
        // ricaviamo allo stesso modo per identificare la riga di QUESTO
        // dispositivo. Il permesso è già concesso a questo punto, quindi
        // non riapre nessun prompt.
        try {
          const fcmToken = await getFCMToken();
          if (fcmToken) endpoint = `https://fcm.googleapis.com/fcm/send/${fcmToken}`;
        } catch (e) {
          console.warn('⚠️ Impossibile ricavare l\'endpoint per la disiscrizione mirata', e);
        }
      }

      // 3. Disattiva nel database: solo la subscription di QUESTO
      // dispositivo quando riusciamo a identificarla, altrimenti (fallback)
      // tutte quelle dell'utente come comportamento precedente.
      let updateQuery = supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', userId);
      if (endpoint) {
        updateQuery = updateQuery.eq('endpoint', endpoint);
      }
      const { error: dbError } = await updateQuery;

      if (dbError) {
        console.error('❌ Errore Database:', dbError.message);
        throw dbError;
      }

      console.log('✅ 2. Database aggiornato');
      setIsSubscribed(false);
      return { success: true };
    } catch (err) {
      console.error('❌ ERRORE DISISCRIZIONE:', err.message);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications
  };
}