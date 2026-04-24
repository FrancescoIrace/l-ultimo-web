// Service Worker per gestire le push notifications
// Questo file riceve le notifiche dal server anche quando l'app è chiusa

self.addEventListener('push', (event) => {
  console.log('📨 Push ricevuta dal server:', event);

  if (!event.data) {
    console.log('Push senza dati ricevuta');
    return;
  }

  let notificationData;
  try {
    notificationData = event.data.json();
  } catch (e) {
    // Se non è JSON, usa il testo
    notificationData = {
      title: 'L\'ULTIMO',
      body: event.data.text(),
    };
  }

  const {
    title = 'L\'ULTIMO',
    body = 'Nuova notifica',
    icon = '/icon-192x192.png',
    badge = '/badge-72x72.png',
    tag = 'notification',
    requireInteraction = false,
    data = {},
  } = notificationData;

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
    sound: '/notification-sound.mp3',
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
