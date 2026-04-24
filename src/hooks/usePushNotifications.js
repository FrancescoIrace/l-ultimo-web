import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getFCMToken } from '../lib/firebase';

/**
 * Hook per gestire le push notifications con Firebase Cloud Messaging
 * 
 * FUNZIONAMENTO:
 * ===============
 * 1. Registra Firebase Cloud Messaging
 * 2. Richiede permesso all'utente
 * 3. Genera token FCM e lo salva in DB
 * 4. Permette invio push native Android + Web
 * 
 * VANTAGGI:
 * - Notifiche native Android (belle, bold, anche app chiusa)
 * - Firebase gestisce il delivery
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
      'Notification' in window;

    console.log('🔔 usePushNotifications (Firebase): isSupported =', supported);
    setIsSupported(supported);
    setIsLoading(false);

    if (!supported) {
      console.log('Push notifications non supportate su questo browser');
      return;
    }

    // Registra i Service Worker
    registerServiceWorkers();
  }, []);

  // Quando userId è disponibile, controlla la subscription
  useEffect(() => {
    if (userId) {
      console.log('🔄 userId disponibile, controllando subscription...');
      checkSubscription();
    }
  }, [userId]);

  const registerServiceWorkers = async () => {
    try {
      if (!('serviceWorker' in navigator)) return;

      // 1. Registra il SW standard per Real-time
      const registration1 = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('✅ Service Worker (Real-time) registrato:', registration1);

      // Controlla lo stato di subscription
      checkSubscription();
    } catch (err) {
      console.error('❌ Errore registrazione Service Worker:', err);
      setError('Errore nella registrazione del servizio');
    }
  };

  const checkSubscription = async () => {
    try {
      // Se userId non è disponibile, salta il check
      if (!userId) {
        console.log('⏳ userId non ancora disponibile, skipping subscription check');
        return;
      }

      console.log('🔍 Controllando subscription per userId:', userId.substring(0, 8) + '...');

      // Controlla se l'utente ha già un token salvato nel DB
      const { data, error: dbError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (dbError) throw dbError;

      if (data && data.length > 0) {
        console.log('✅ Token FCM attivo trovato nel DB:', data.length);
        setIsSubscribed(true);
      } else {
        console.log('❌ Nessun token FCM attivo nel DB');
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Errore nel controllo della subscription:', err);
    }
  };

  /**
   * Richiedi permesso e sottoscrivi alle push Firebase
   */
  const subscribeToPushNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔔 Inizio subscription Firebase...');

      // 1. Richiedi permesso notifiche
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

      console.log('✅ Permessi notifiche concessi');

      // 2. Ottieni il token FCM
      console.log('🔐 Generando token FCM...');
      const fcmToken = await getFCMToken();

      if (!fcmToken) {
        throw new Error('Impossibile generare token FCM. Riprova.');
      }

      console.log('✅ Token FCM generato:', fcmToken.substring(0, 30) + '...');

      // 3. Salva nel database
      await saveTokenToDB(fcmToken);
      console.log('✅ Token salvato nel DB');

      setIsSubscribed(true);
      console.log('✅ isSubscribed settato a TRUE');

      return { success: true, token: fcmToken };
    } catch (err) {
      console.error('❌ Errore subscription:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Salva il token FCM nel database come "endpoint"
   */
  const saveTokenToDB = async (fcmToken) => {
    try {
      const endpoint = `https://fcm.googleapis.com/fcm/send/${fcmToken}`;

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint, // Formato FCM
            p256dh: 'fcm-token', // Placeholder per FCM
            auth: 'fcm-token', // Placeholder per FCM
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
      console.log('✅ Token FCM salvato nel database');
    } catch (err) {
      console.error('❌ Errore salvataggio token:', err);
      throw err;
    }
  };

  /**
   * Annulla la subscription alle push Firebase
   */
  const unsubscribeFromPushNotifications = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Rimuovi tutti i token per questo utente
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (error) throw error;

      setIsSubscribed(false);
      console.log('✅ Unsubscribed dalle push Firebase');
    } catch (err) {
      console.error('❌ Errore unsubscribe:', err);
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
