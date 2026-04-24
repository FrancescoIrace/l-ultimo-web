/**
 * Firebase Cloud Messaging Service Worker
 * Gestisce le notifiche push in background su Android
 * Deploy: Stare in public/firebase-messaging-sw.js
 */

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js');

// Configurazione Firebase IDENTICA al frontend
firebase.initializeApp({
  apiKey: "AIzaSyB2rqlQmlHjOJJkN9e7AyZWrHFCLk7z5zU",
  authDomain: "ultimo-web.firebaseapp.com",
  projectId: "ultimo-web",
  storageBucket: "ultimo-web.appspot.com",
  messagingSenderId: "987337082220", // 🔑 CRITICO: deve matchare il token generato
  appId: "1:987337082220:web:c1b4e8a0f4d3a1b2c3d4"
});

// Ottieni l'istanza di messaging
const messaging = firebase.messaging();

/**
 * Gestisci messaggi ricevuti in background
 */
messaging.onBackgroundMessage((payload) => {
  console.log('📬 Notifica ricevuta in background:', payload);

  const {
    notification: { title, body, icon, image },
    data,
  } = payload;

  const notificationOptions = {
    body,
    icon: icon || '/logo-192.png',
    image,
    badge: '/icons.svg',
    tag: 'firebase-notification',
    requireInteraction: false,
    data: data || {},
    // Permetti click per aprire il link
    click_action: data?.link || '/',
  };

  return self.registration.showNotification(title, notificationOptions);
});

/**
 * Gestisci click sulla notifica
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.link || '/';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Se l'app è già aperta, focalizza quella window
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri una nuova window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
