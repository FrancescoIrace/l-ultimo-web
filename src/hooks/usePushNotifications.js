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
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);
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

    const endpoint = `https://fcm.googleapis.com/fcm/send/${fcmToken}`;
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

  return { isSupported, isSubscribed, isLoading, error, subscribeToPushNotifications };
}