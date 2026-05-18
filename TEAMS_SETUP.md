# 👥 Teams Manager - Setup e Documentazione

## Panoramica

Il componente **TeamsManager** è un gestore di squadre integrato nella dashboard PWA (non fullscreen). Consente agli utenti di:

- ✅ Visualizzare le proprie squadre ("I miei Gruppi")
- ✅ Scoprire nuove squadre ("Scopri") con ricerca per nome/codice invito
- ✅ Unirsi a squadre pubbliche (1-click)
- ✅ Copiare il codice invito per condividere
- ✅ Visualizzare logo squadra e informazioni

---

## 🔧 Setup Supabase

### Tabella `teams` (Schema Reale)

La tabella è già presente con schema:

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,                          -- URL logo squadra
  invite_code VARCHAR(10) UNIQUE NOT NULL, -- Codice univoco (es: GALA26)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Indici per performance
CREATE INDEX idx_teams_name ON teams USING GIN (name gin_trgm_ops);
CREATE INDEX idx_teams_invite_code ON teams(invite_code);
CREATE INDEX idx_teams_created_by ON teams(created_by);
```

### Tabella `team_members` (Relazione)

Se non esiste, creala:

```sql
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Indici
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
```

### Estensione PostgreSQL Richiesta

Per la ricerca con `ilike`, abilita `pg_trgm`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### RLS Policies (Autorizzazione)

```sql
-- Leggi teams (pubblico)
CREATE POLICY "teams_can_be_read" ON teams
  FOR SELECT USING (true);

-- Leggi team_members
CREATE POLICY "users_can_read_team_members" ON team_members
  FOR SELECT USING (true);

-- Iscrizione a team
CREATE POLICY "users_can_insert_team_members" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Abbandono team
CREATE POLICY "users_can_delete_team_members" ON team_members
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 📱 Utilizzo del Componente

### Layout

Il componente è integrato nella **dashboard come card** (NON fullscreen):
- Clicca bottone "La tua squadra" 
- Appare card con tab system
- Padding e margini tipo altri componenti

### Props

```jsx
<TeamsManager userId={user?.id} />
```

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `userId` | `string` | ID dell'utente corrente (obbligatorio) |

---

## 🎨 Caratteristiche UI

### Tab System
- **I miei Gruppi**: Squadre dell'utente (da team_members)
- **Scopri**: Ricerca squadre pubbliche (ilike nome + codice)

### Styling
- **Colori**: 
  - Giallo (#facc15) per le squadre ("I miei Gruppi")
  - Blu (#0066cc) per le azioni principali ("Unisciti")
  - Card con bordi 2px per focus visivo
  
- **Layout**: Card-based, responsive mobile

### Funzionalità Speciale
- **Codice Invito Copiacola**: Click sul codice → copia al clipboard
- **Logo Squadra**: Visualizzazione URL o placeholder ⚽
- **Ricerca Avanzata**: Nome (ilike) + codice invito

---

## 📚 Team Service Utilities

### File: `src/lib/teamService.js`

Funzioni disponibili per operazioni su team:

#### Lettura Dati

```javascript
// Recupera team dell'utente
const teams = await getUserTeams(userId);

// Cerca squadre (nome + codice invito)
const results = await searchTeams('calcetto');

// Conta membri di un team
const count = await getTeamMemberCount(teamId);

// Verifica appartenenza
const isMember = await isUserTeamMember(teamId, userId);

// Dettagli team
const team = await getTeamDetails(teamId);

// Team by invite_code
const team = await getTeamByInviteCode('GALA26');

// Membri team
const members = await getTeamMembers(teamId);
```

#### Operazioni di Modifica

```javascript
// Aggiunge utente a team
await addUserToTeam(teamId, userId);

// Rimuove utente da team
await removeUserFromTeam(teamId, userId);

// Aggiunge più utenti (batch)
await addManyUsersToTeam(teamId, [userId1, userId2]);

// Crea nuovo team (genera invite_code automatico)
const newTeam = await createTeam({
  name: 'Squadra Calcetto',
  description: 'Descrizione opzionale',
  logo_url: 'https://example.com/logo.jpg' // opzionale
}, userId);

// Aggiorna team
await updateTeam(teamId, { name: 'Nuovo Nome' });

// Rigenerati il codice invito
const newCode = await regenerateInviteCode(teamId);

// Elimina team (solo creatore)
await deleteTeam(teamId, userId);

// Iscriviti a team
await joinTeam(teamId, userId);

// Iscriviti usando codice invito
const team = await joinTeamByInviteCode('GALA26', userId);
```

---

## 🔄 Real-Time Features

Il componente è pronto per aggiornamenti real-time. Per abilitare:

```javascript
// In TeamsManager.jsx, dopo fetchMyTeams():
useEffect(() => {
  const channel = supabase
    .channel(`user_teams_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'team_members',
        filter: `user_id=eq.${userId}`
      },
      () => fetchMyTeams()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [userId]);
```

---

## 🔐 Codice Invito

### Generazione Automatica

Quando crei un team, il `invite_code` viene generato automaticamente:
```javascript
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};
// Risultato: "GALA26XXXX" (10 caratteri)
```

### Iscriversi con Codice

```javascript
const team = await joinTeamByInviteCode('GALA26', userId);
```

### Rigenerare Codice

```javascript
const newCode = await regenerateInviteCode(teamId);
// Genera un nuovo codice univoco
```

---

## ⚙️ Configurazione Avanzata

### Personalizzare Colori

Modifica in `TeamsManager.jsx`:

```jsx
// Colore bordo "I miei Gruppi"
border-yellow-200 → border-[TuoColore]-200

// Colore bottone "Unisciti"
from-blue-500 to-blue-600 → from-[TuoColore]-500 to-[TuoColore]-600

// Colore tab attivo
text-yellow-500 / text-blue-500 → text-[TuoColore]-500
```

### Aggiungere Logo Squadra

Quando crei/aggiorni team:
```javascript
await createTeam({
  name: 'Calcetto',
  logo_url: 'https://example.com/logo.jpg'
}, userId);
```

Se logo_url è NULL, mostra emoji ⚽

---

## 🧪 Testing

### Checklist di Test

- [ ] Tab "I miei Gruppi" mostra squadre dell'utente
- [ ] Ricerca in "Scopri" filtra per nome (ilike)
- [ ] Ricerca in "Scopri" filtra per codice invito
- [ ] Click "Unisciti" aggiunge all'utente
- [ ] Click codice invito copia al clipboard
- [ ] Logo visualizzato (o placeholder ⚽)
- [ ] Responsive su mobile
- [ ] Animazioni smooth
- [ ] Ricerca debounce 300ms

### Dati Test

```sql
-- Squadra 1
INSERT INTO teams (name, description, logo_url, invite_code, created_by)
VALUES (
  'Calcetto Pubblico',
  'Test pubblica',
  NULL,
  'GALA26',
  (SELECT id FROM auth.users LIMIT 1)
);

-- Squadra 2
INSERT INTO teams (name, description, logo_url, invite_code, created_by)
VALUES (
  'Padel Elite',
  'Test con logo',
  'https://via.placeholder.com/100',
  'PADEL01',
  (SELECT id FROM auth.users LIMIT 1)
);
```

---

## 🐛 Troubleshooting

### "Nessuna squadra trovata"

**Causa**: Nessuna squadra nel database
**Soluzione**: Aggiungi squadre test con SQL sopra

### Ricerca non funziona (ilike)

**Causa**: Estensione `pg_trgm` non abilitata
**Soluzione**: 
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### RLS error

**Causa**: Politiche RLS non configurate
**Soluzione**: Copia RLS policies da sezione sopra

### Click "Unisciti" disabilitato

**Causa**: `userId` non passato o utente già membro
**Soluzione**: Verifica che `userId={user?.id}` sia nel componente

---

## 🚀 Prossimi Step

1. **Avatar Utenti**: Mostra avatar in "I miei Gruppi"
2. **Gestione Ruoli**: Admin/moderator/member per team
3. **Inviti**: Sistema di inviti con notifiche
4. **Chat Team**: Messaggistica integrata
5. **Stats**: Statistiche squadra e ranking
6. **Tornei**: Sistema tornei (già placeholder)

---

## 📞 Supporto

Per problemi, consulta:
- [Documentazione Supabase](https://supabase.com/docs)
- [Documentazione React](https://react.dev)
- [Framer Motion](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com)

---

**Versione**: 2.0 - Schema Reale  
**Data**: Maggio 2026  
**Status**: ✅ Production Ready


---

## 📱 Utilizzo del Componente

### Integrazione nel PWADashboard

Il componente è già integrato nel `PWADashboard.jsx`. Clicca il bottone "La tua squadra" per aprirlo.

### Import e Props

```jsx
import TeamsManager from '../components/TeamsManager';

<TeamsManager
  userId={user?.id}                    // ID dell'utente loggato
  onClose={() => setShowTeamsManager(false)} // Callback chiusura
/>
```

### Props Disponibili

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `userId` | `string` | ID dell'utente corrente (obbligatorio) |
| `onClose` | `function` | Callback invocato al click su "Indietro" |

---

## 🎨 Caratteristiche UI/UX

### Tab System
- **I miei Gruppi**: Squadre a cui l'utente appartiene
- **Scopri**: Ricerca e scoperta di nuove squadre

### Styling
- **Colori**: 
  - Giallo (#facc15) per le squadre
  - Blu (#0066cc) per le azioni principali
  - Card con bordi 2px per focus visivo
  
- **Responsive**: Funziona perfettamente su mobile

### Animazioni (Framer Motion)
- Transizioni di ingresso/uscita per tab
- Hover effects su card
- Scale animations per bottoni

---

## 📚 Team Service Utilities

### File: `src/lib/teamService.js`

Funzioni disponibili per operazioni sui team:

#### Lettura Dati

```javascript
// Recupera team dell'utente
const teams = await getUserTeams(userId);

// Cerca squadre
const results = await searchTeams('calcetto');

// Conta membri di un team
const count = await getTeamMemberCount(teamId);

// Verifica appartenenza
const isMember = await isUserTeamMember(teamId, userId);

// Dettagli team
const team = await getTeamDetails(teamId);

// Membri team
const members = await getTeamMembers(teamId);
```

#### Operazioni di Modifica

```javascript
// Aggiunge utente a team
await addUserToTeam(teamId, userId);

// Rimuove utente da team
await removeUserFromTeam(teamId, userId);

// Aggiunge più utenti (batch)
await addManyUsersToTeam(teamId, [userId1, userId2]);

// Crea nuovo team
await createTeam({
  name: 'Squadra Calcetto',
  description: 'Descrizione opzionale',
  is_private: false,
  password: 'optional-password'
}, userId);

// Aggiorna team
await updateTeam(teamId, { name: 'Nuovo Nome' });

// Elimina team (solo creatore)
await deleteTeam(teamId, userId);

// Iscrive utente con gestione password
await joinTeam(teamId, userId, password);

// Verifica password
const isValid = await verifyTeamPassword(teamId, password);
```

---

## 🔄 Real-Time Features (Futuro)

Il componente è pronto per real-time updates. Per abilitare:

```javascript
// In TeamsManager.jsx, aggiungi dopo fetchMyTeams():
useEffect(() => {
  const channel = supabase
    .channel(`user_teams_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'team_members',
        filter: `user_id=eq.${userId}`
      },
      () => fetchMyTeams()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [userId]);
```

---

## ⚙️ Configurazione Avanzata

### Personalizzare Colori

Modifica in `TeamsManager.jsx`:

```jsx
// Colore bordo "I miei Gruppi"
border-yellow-200 → border-[TuoColore]-200

// Colore bottone "Unisciti"
from-blue-500 to-blue-600 → from-[TuoColore]-500 to-[TuoColore]-600

// Colore tab attivo
text-yellow-500 / text-blue-500 → text-[TuoColore]-500
```

### Aggiungere Logica Custom

Per aprire un dettaglio team:

```jsx
// In renderMyTeamsTab()
onClick={() => {
  navigate(`/team/${team.id}`); // Aggiungi rotta
}}
```

---

## 🧪 Testing

### Checklist di Test

- [ ] Tab "I miei Gruppi" mostra squadre dell'utente
- [ ] Ricerca in "Scopri" funziona (nome + codice)
- [ ] Click "Unisciti" aggiunge all'utente
- [ ] Team privati chiedono password
- [ ] Password corretta consente accesso
- [ ] Password sbagliata mostra errore
- [ ] Button "+" funziona (mostra placeholder)
- [ ] Responsivo su mobile
- [ ] Animazioni smooth

### Dati Test

Crea squadre test in Supabase:

```sql
-- Squadra pubblica
INSERT INTO teams (name, description, is_private, created_by)
VALUES (
  'Calcetto Pubblico',
  'Squadra aperta a tutti',
  false,
  '11111111-1111-1111-1111-111111111111'
);

-- Squadra privata
INSERT INTO teams (name, description, is_private, password, created_by)
VALUES (
  'Calcetto Elite',
  'Solo per invitati',
  true,
  'password123',
  '11111111-1111-1111-1111-111111111111'
);
```

---

## 🐛 Troubleshooting

### "Errore nel caricamento delle squadre"

**Causa**: Politiche RLS di Supabase non configurate
**Soluzione**:

```sql
-- Abilita lettura team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their teams" ON team_members
  FOR SELECT USING (auth.uid() = user_id);

-- Abilita insert per unirsi
CREATE POLICY "Users can join teams" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Abilita delete per lasciare
CREATE POLICY "Users can leave teams" ON team_members
  FOR DELETE USING (auth.uid() = user_id);
```

### Ricerca non funziona (ilike)

**Causa**: Estensione `pg_trgm` non abilitata
**Soluzione**:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Password non verifica

**Causa**: RPC `verify_team_password` non esiste
**Soluzione**: Crea la RPC seguendo le istruzioni sopra

---

## 🚀 Prossimi Step

1. **Creazione Team**: Aggiungere form per creare nuove squadre
2. **Gestione Membri**: Visualizzare e gestire membri dei team
3. **Inviti**: Sistema di inviti a squadre
4. **Ruoli**: Admin, moderator, member per team
5. **Chat Team**: Messaggistica integrata
6. **Stats Team**: Statistiche e classifiche

---

## 📞 Supporto

Per problemi o domande, consulta:
- [Documentazione Supabase](https://supabase.com/docs)
- [Documentazione React](https://react.dev)
- [Framer Motion](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com)

---

**Versione**: 1.0.0  
**Ultimo Aggiornamento**: Maggio 2026
