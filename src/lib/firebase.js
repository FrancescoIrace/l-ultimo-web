import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

/**
 * Configurazione Firebase per ultimo-web
 * Credenziali pubbliche (safe da esporre nel frontend)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: 'ultimo-web',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: '987337082220', // 🔑 Chiave essenziale per FCM
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Inizializza Firebase
 */
const app = initializeApp(firebaseConfig);

/**
 * Inizializza Cloud Messaging
 */
export const messaging = getMessaging(app);

/**
 * Ottiene il token FCM per questo device
 * Salva nel database push_subscriptions con endpoint FCM
 */
export async function getFCMToken() {
  try {
    const token = await getToken(messaging, {
      vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    });

    if (token) {
      console.log('✅ FCM Token generato:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.log('❌ Token non disponibile. Permessi negati?');
      return null;
    }
  } catch (error) {
    console.error('❌ Errore generazione FCM token:', error);
    return null;
  }
}

export default app;
