# 🔔 Sistema di Notifiche In-App

Documentazione per il sistema di notifiche in tempo reale per L'ULTIMO.

## 📋 Indice

1. [Setup Iniziale](#setup-iniziale)
2. [Struttura](#struttura)
3. [Come Usare](#come-usare)
4. [Esempi Pratici](#esempi-pratici)
5. [Prossimi Step](#prossimi-step)

---

## 🚀 Setup Iniziale

### 1. Creare la Tabella su Supabase

Esegui lo script SQL in `supabase/migrations/create_notifications_table.sql`:
- Vai su Supabase Dashboard → SQL Editor
- Copia il contenuto del file
- Esegui

La tabella `notifications` verrà creata con:
- RLS policies per la privacy
- Indici per performance
- Constraints sul tipo

### 2. File Creati

```
src/
├── hooks/
│   └── useNotifications.js          # Hook per gestire notifiche
├── components/
│   └── NotificationBell.jsx         # Componente campanella UI
├── lib/
│   └── notificationService.js       # Funzioni helper per creare notifiche
└── App.jsx                          # Aggiornato con NotificationBell
```

---

## 📦 Struttura

### `useNotifications(userId)`
Hook React che gestisce:
- Fetch notifiche iniziali
- Real-time subscription via Supabase
- Marcatura come letta
- Eliminazione
- Conteggio non lette

**Return:**
```javascript
{
  notifications,      // Array di notifiche
  unreadCount,        // Numero non lette
  loading,            // Stato caricamento
  error,              // Errore se presente
  markAsRead,         // Funzione
  markAllAsRead,      // Funzione
  deleteNotification, // Funzione
  deleteAllRead,      // Funzione
  refetch,            // Ricarica manuale
}
```

### `NotificationBell` Component
Componente UI con:
- Campanella con badge contatore
- Dropdown menu
- Azioni (leggi, elimina, etc.)
- Auto-close fuori dal dropdown

### `notificationService.js`
Funzioni helper per creare notifiche:
- `createNotification()` - Notifica generica
- `notifyMatchJoin()` - Quando qualcuno si unisce
- `notifyMatchUpdate()` - Aggiornamento match
- `notifyMatchCancelled()` - Cancellazione match
- `notifyMatchReminder()` - Reminder prima del match
- `notifyTeamInvite()` - Invito team
- `notifyGeneric()` - Personalizzata

---

## 💻 Come Usare

### 1. Usare l'Hook nei Tuoi Componenti

```javascript
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const { notifications, unreadCount } = useNotifications(userId);
  
  return (
    <div>
      <p>Notifiche non lette: {unreadCount}</p>
      {notifications.map(notif => (
        <div key={notif.id}>{notif.title}</div>
      ))}
    </div>
  );
}
```

### 2. Creare una Notifica

```javascript
import { notifyMatchJoin } from '../lib/notificationService';

// Quando qualcuno si unisce a un match
async function handlePlayerJoin(matchId, playerId, organizerId) {
  await notifyMatchJoin(
    matchId,
    'Calcio Mercoledì',
    'Marco',
    organizerId,
    playerId
  );
}
```

### 3. La Campanella Appare Automaticamente

Nel file `App.jsx` è già integrata:
```javascript
{session?.user?.id && <NotificationBell userId={session.user.id} />}
```

Apparirà nella header accanto al profilo.

---

## 🔥 Esempi Pratici

### Notifica quando qualcuno si unisce

```javascript
// In CreateMatch.jsx o dove gestisci l'aggiunta di giocatori
import { notifyMatchJoin } from '../lib/notificationService';

async function addPlayerToMatch(matchId, playerId) {
  // ... logica per aggiungere il giocatore ...
  
  // Notifica l'organizzatore
  await notifyMatchJoin(
    matchId,
    match.title,
    player.username,
    match.organizer_id,
    playerId
  );
}
```

### Notifica reminder (da eseguire da backend/cron)

```javascript
import { notifyMatchReminder } from '../lib/notificationService';

// Questa dovrebbe essere una function serverless (Supabase Edge Function)
export async function checkMatchReminders() {
  const matches = await supabase
    .from('matches')
    .select('id, title, scheduled_at, participants')
    .gte('scheduled_at', new Date())
    .lte('scheduled_at', new Date(Date.now() + 3 * 60 * 60 * 1000)); // Prossime 3 ore
  
  for (const match of matches.data) {
    const hoursLeft = (new Date(match.scheduled_at) - new Date()) / (1000 * 60 * 60);
    
    if (hoursLeft <= 1) { // Notifica a 1 ora
      await notifyMatchReminder(
        match.id,
        match.title,
        1,
        match.participants
      );
    }
  }
}
```

### Notifica personalizzata

```javascript
import { notifyGeneric } from '../lib/notificationService';

await notifyGeneric(
  userId,
  'custom_event',
  '🎉 Complimenti!',
  'Hai completato il tuo primo match!',
  '/profile',
  { achievement: 'first_match' }
);
```

---

## 🎯 Prossimi Step

### Fase 2: Push Notifications (Android)
- Integrare Web Push API
- Richiedere permessi all'utente
- Inviare notifiche quando l'app è chiusa

### Fase 3: Email Notifications
- Usare Supabase Auth emails
- Inviare email per match importanti
- Opzione di opt-out nelle settings

### Fase 4: Logica Automatica
- Trigger PostgreSQL per inserire notifiche
- Edge Functions per cron jobs
- Reminder automatici

---

## 🧪 Testing

### Test Locale

1. Apri la console di Supabase Studio
2. Inserisci una notifica direttamente:
```sql
INSERT INTO notifications (user_id, type, title, content, link)
VALUES ('YOUR_USER_ID', 'match_join', '🎯 Test', 'Notifica di test', '/match/1');
```

3. La campanella dovrebbe mostrare la notifica in tempo reale!

### Test Real-Time
- Apri due tab con account diversi
- Unisci un giocatore da un tab
- Verifica che la notifica appaia sull'altro tab istantaneamente

---

## 📝 Note Importanti

- ✅ RLS policies garantiscono che ogni utente veda solo le sue notifiche
- ✅ Real-time subscriptions usano Supabase Realtime (incluso nel piano gratuito)
- ⚠️ Le notifiche push richiedono implementazione aggiuntiva
- 💾 Le notifiche vecchie possono essere pulite con la funzione `delete_old_read_notifications()`

---

**Creato per:** L'ULTIMO - Branch Notifiche
**Data:** Aprile 2026
