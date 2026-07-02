// Service Worker per gestire le push notifications
// Questo file riceve le notifiche dal server anche quando l'app è chiusa
const CACHE_NAME = 'ultimo-cache-v2'; // Incrementa la versione qui

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forza l'attivazione del nuovo SW ignorando quello vecchio
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Prende subito il controllo delle pagine aperte
});

self.addEventListener('push', (event) => {
  console.log('📨 Push ricevuta dal server:', event);

  if (!event.data) {
    console.log('Push senza dati ricevuta');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    // Se non è JSON, usa il testo
    payload = {
      notification: { title: 'L\'ULTIMO', body: event.data.text() },
    };
  }

  // FCM consegna il payload come { notification: {...}, data: {...} } annidati,
  // non come campi piatti: title/body vanno letti da notification.*, con
  // data.* come fallback per eventuali invii non passati da FCM.
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || 'L\'ULTIMO';
  const body = notification.body || data.body || 'Nuova notifica';
  const icon = notification.icon || data.icon || '/logo-192.png';
  const badge = data.badge || '/logo-192.png';
  const tag = data.tag || 'notification';
  const requireInteraction = data.requireInteraction === 'true' || data.requireInteraction === true;

  const options = {
    body,
    icon,
    badge,
    tag,
    requireInteraction,
    data: {
      link: data.link || '/',
      notificationId: data.notificationId,
      ...data,
    },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch(err => console.error('❌ Errore show notification:', err))
  );
});

// Click sulla notifica
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notifica cliccata:', event.notification.tag);
  event.notification.close();

  const urlToOpen = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Quando l'utente chiude la notifica
self.addEventListener('notificationclose', (event) => {
  console.log('Notifica chiusa:', event.notification.tag);
});

// Message dal client (per ricevere notifiche via postMessage)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    console.log('💬 Mostrando notifica via message:', title);
    self.registration.showNotification(title, options)
      .catch(err => console.error('❌ Errore:', err));
  }
});

// Mantieni il service worker aggiornato
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installato');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker attivato');
  event.waitUntil(clients.claim());
});

console.log('✅ Service Worker pronto per notifiche');
