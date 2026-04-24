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

    if (supported) {
      registerServiceWorkers();
    }
  }, []);

  useEffect(() => {
    if (userId) {
      checkSubscription();
    }
  }, [userId]);

  const registerServiceWorkers = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      checkSubscription();
    } catch (err) {
      console.error('❌ Errore SW:', err);
    }
  };

  const checkSubscription = async () => {
    if (!userId) return;
    try {
      const { data, error: dbError } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);

      if (dbError) throw dbError;
      setIsSubscribed(data && data.length > 0);
    } catch (err) {
      console.error('Errore check subscription:', err);
    }
  };

  const subscribeToPushNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (Notification.permission === 'denied') {
        throw new Error('Permessi negati. Abilita le notifiche nelle impostazioni.');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permessi negati');

      // 1. Otteniamo la subscription standard del browser (per p256dh e auth)
      const registration = await navigator.serviceWorker.ready;
      const browserSub = await registration.pushManager.getSubscription() 
                         || await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: 'IL_TUO_VAPID_PUBLIC_KEY' // Opzionale se usi solo Firebase
                         });

      // 2. Otteniamo il token FCM
      const fcmToken = await getFCMToken();
      if (!fcmToken) throw new Error('Impossibile generare token FCM');

      // 3. Salvataggio unico
      await saveTokenToDB(browserSub, fcmToken);

      setIsSubscribed(true);
      return { success: true, token: fcmToken };
    } catch (err) {
      console.error('❌ Errore subscription:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const saveTokenToDB = async (browserSub, fcmToken) => {
    try {
      if (!userId) return;

      // Costruiamo l'endpoint FCM
      const endpoint = `https://fcm.googleapis.com/fcm/send/${fcmToken}`;
      
      let p256dh = 'fcm-token';
      let auth = 'fcm-token';

      // Se abbiamo la sottoscrizione del browser, estraiamo le chiavi reali (PER IPHONE)
      if (browserSub && browserSub.getKey) {
        const rawP256 = browserSub.getKey('p256dh');
        const rawAuth = browserSub.getKey('auth');
        if (rawP256 && rawAuth) {
          p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(rawP256)));
          auth = btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuth)));
        }
      }

      console.log("📡 Salvataggio su DB per device:", detectDevice());

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          endpoint: endpoint,
          p256dh: p256dh,
          auth: auth,
          browser_name: detectBrowser(),
          device_name: detectDevice(),
          is_active: true,
          last_used_at: new Date().toISOString(),
        , { onConflict: 'user_id,endpoint' });

      if (error) throw error;
      console.log('✅ DATABASE AGGIORNATO');
    } catch (err) {
      console.error('❌ ERRORE UPSERT:', err.message);
    }
  };

  function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Unknown';
  }

  function detectDevice() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    return 'Desktop';
  }

  return { isSupported, isSubscribed, isLoading, error, subscribeToPushNotifications };
}