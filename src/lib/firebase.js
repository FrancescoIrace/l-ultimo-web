import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

/**
 * Configurazione Firebase per ultimo-web
 * Credenziali pubbliche (safe da esporre nel frontend)
 */
let app = null;
let messaging = null;

function initializeFirebase() {
  if (app) return app; // Già inizializzato

  console.log('🔍 Environment variables disponibili:');
  console.log('VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? '✅' : '❌');
  console.log('VITE_FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✅' : '❌');
  console.log('VITE_FIREBASE_STORAGE_BUCKET:', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? '✅' : '❌');
  console.log('VITE_FIREBASE_APP_ID:', import.meta.env.VITE_FIREBASE_APP_ID ? '✅' : '❌');

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: 'ultimo-web',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: '987337082220', // 🔑 Chiave essenziale per FCM
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  console.log('🔧 Inizializzo Firebase con config:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? '✅' : '❌',
  });

  if (!firebaseConfig.apiKey) {
    throw new Error('❌ VITE_FIREBASE_API_KEY non trovato. Controlla .env.local');
  }

  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);

  return app;
}

export function getMessagingInstance() {
  if (!messaging) {
    initializeFirebase();
  }
  return messaging;
}

/**
 * Ottiene il token FCM per questo device
 * Usa il Service Worker già registrato
 */
export async function getFCMToken() {
  try {
    const msg = getMessagingInstance();

    // Ottieni la registrazione del SW standard che è già registrato
    const registration = await navigator.serviceWorker.ready;
    
    console.log('📱 Ottenendo token FCM con SW:', registration.scope);

    const token = await getToken(msg, {
      vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration, // Usa il SW già registrato
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
    throw error;
  }
}

export default app;
