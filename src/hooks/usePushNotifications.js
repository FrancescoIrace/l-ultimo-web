import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook per gestire le push notifications
 * 
 * FUNZIONAMENTO:
 * ===============
 * 1. Registra il Service Worker
 * 2. Richiede permesso all'utente
 * 3. Genera e salva la subscription del device in DB
 * 4. Permette di inviare push dal server
 * 
 * VANTAGGI:
 * - Funziona anche con app chiusa
 * - Browser nativo, nessuna app store richiesta
 * - Realtime + push = copertura totale
 */
export function usePushNotifications(userId) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Controlla se il browser supporta le push
  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    console.log('🔔 usePushNotifications: isSupported =', supported);
    setIsSupported(supported);
    setIsLoading(false);

    if (!supported) {
      console.log('Push notifications non supportate su questo browser');
      return;
    }

    // Registra il Service Worker
    registerServiceWorker();
  }, []);

  const registerServiceWorker = async () => {
    try {
      if (!('serviceWorker' in navigator)) return;

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registrato:', registration);

      // Controlla lo stato di subscription
      checkSubscription(registration);
    } catch (err) {
      console.error('Errore registrazione Service Worker:', err);
      setError('Errore nella registrazione del servizio');
    }
  };

  const checkSubscription = async (registration) => {
    try {
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('✅ Subscription trovata nel browser:', subscription.endpoint);
        setIsSubscribed(true);
        
        // Auto-salva nel DB se non presente
        await saveSubscriptionToDB(subscription);
      } else {
        console.log('❌ Nessuna subscription nel browser');
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Errore nel controllo della subscription:', err);
    }
  };

  /**
   * Richiedi permesso e sottoscrivi alle push
   */
  const subscribeToPushNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔔 Inizio subscription...');

      // 1. Richiedi permesso
      if (Notification.permission === 'denied') {
        throw new Error('Permessi negati. Abilita le notifiche dalle impostazioni del browser');
      }

      if (Notification.permission !== 'granted') {
        console.log('📢 Richiedendo permessi...');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Permessi negati dall\'utente');
        }
      }

      console.log('✅ Permessi concessi');

      // 2. Ottieni la registrazione del Service Worker
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker pronto');

      // 3. Crea la subscription push
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        throw new Error('VITE_VAPID_PUBLIC_KEY non configurato nel .env.local');
      }
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      console.log('✅ Subscription creata:', subscription.endpoint);

      // 4. Salva nel database
      await saveSubscriptionToDB(subscription);
      console.log('✅ Subscription salvata nel DB');

      setIsSubscribed(true);
      console.log('✅ isSubscribed settato a TRUE');
      
      return { success: true, subscription };
    } catch (err) {
      console.error('❌ Errore subscription:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Salva la subscription nel database
   */
  const saveSubscriptionToDB = async (subscription) => {
    try {
      const subData = subscription.toJSON();

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint: subData.endpoint,
            p256dh: subData.keys.p256dh,
            auth: subData.keys.auth,
            browser_name: detectBrowser(),
            device_name: detectDevice(),
            is_active: true,
            last_used_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,endpoint',
          }
        );

      if (error) throw error;
      console.log('Subscription salvata nel database');
    } catch (err) {
      console.error('Errore salvataggio subscription:', err);
      throw err;
    }
  };

  /**
   * Annulla la subscription alle push
   */
  const unsubscribeFromPushNotifications = useCallback(async () => {
    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 1. Unsubscribe dal push manager
        await subscription.unsubscribe();

        // 2. Rimuovi dal database
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);

        setIsSubscribed(false);
        console.log('Unsubscribed dalle push');
      }
    } catch (err) {
      console.error('Errore unsubscribe:', err);
      setError(err.message);
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
    unsubscribeFromPushNotifications,
  };
}

/**
 * Converte la VAPID key da base64 a Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Rileva il browser
 */
function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.indexOf('Firefox') > -1) return 'Firefox';
  if (ua.indexOf('Chrome') > -1) return 'Chrome';
  if (ua.indexOf('Safari') > -1) return 'Safari';
  if (ua.indexOf('Edge') > -1) return 'Edge';
  return 'Unknown';
}

/**
 * Rileva il device
 */
function detectDevice() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'MacOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}
