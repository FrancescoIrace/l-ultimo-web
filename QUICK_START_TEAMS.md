# ⚽ QUICK START - TeamsManager (5 minuti)

## 🚀 Subito Funzionante

Il componente è **già integrato** nella dashboard PWA. Clicca il bottone "La tua squadra" per aprirlo!

---

## 📋 Prerequisiti

### Tabella Teams Reale (Già Esiste)

La tua tabella ha già questo schema:
```sql
teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  invite_code VARCHAR(10) UNIQUE,  -- Codice univoco per invitare
  created_at TIMESTAMP,
  created_by UUID REFERENCES auth.users(id)
)
```

✅ Se la tabella esiste, sei a posto!

### Database Setup (Una sola volta)

Apri la console SQL di Supabase e copia-incolla:

```sql
-- 1. Abilita estensione per ricerca veloce (se non già abilitato)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Se NON hai la tabella team_members, creala:
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 3. Crea indici
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_teams_code ON teams(invite_code);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- 4. Abilita RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 5. Crea policy (lettura teams)
CREATE POLICY "teams_can_be_read" ON teams
  FOR SELECT USING (true);

-- 6. Crea policy (team_members)
CREATE POLICY "users_can_read_team_members" ON team_members
  FOR SELECT USING (true);

CREATE POLICY "users_can_insert_team_members" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_delete_team_members" ON team_members
  FOR DELETE USING (auth.uid() = user_id);
```

✅ Fatto! Il database è pronto.

---

## 🎮 Test Subito

### Aggiungi squadre test:

```sql
-- Genera un invite code di 10 caratteri (es: GALA26XXXX)
INSERT INTO teams (name, description, logo_url, invite_code, created_by)
VALUES (
  'Calcetto Pubblico',
  'Squadra aperta a tutti - Test',
  NULL,
  UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 10)),
  (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO teams (name, description, logo_url, invite_code, created_by)
VALUES (
  'Padel Elite',
  'Per gli esperti - Test',
  NULL,
  UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 10)),
  (SELECT id FROM auth.users LIMIT 1)
);
```

### Accedi all'app → PWA Dashboard → Bottone "La tua squadra"

Dovresti vedere:
- **Tab "I miei Gruppi"**: Vuoto (non sei ancora in nessuna squadra)
- **Tab "Scopri"**: Le 2 squadre test
- Card con **logo placeholder** (⚽) o logo_url se impostato
- **Codice invito copiabile** (con click copy-to-clipboard)
- Clicca "Unisciti" → Vieni aggiunto a team_members ✅

---

## 🎯 Funzionalità

### I miei Gruppi
- ✅ Mostra squadre dell'utente
- ✅ Card con logo, nome, descrizione
- ✅ **Bottone copiacola** per codice invito
- ✅ Accedi da team_members

### Scopri
- ✅ Barra ricerca (nome + codice invito)
- ✅ Filtro ILIKE performante
- ✅ Card con logo e bottone "Unisciti"
- ✅ Debounce ricerca 300ms

### Codice Invito
Il sistema **copia-incolla** il codice:
```
[GALA26] → Click → Copia al clipboard
```

---

## 📁 File Creati

```
src/
├── components/
│   └── TeamsManager.jsx          ← Componente card-based ⭐
├── lib/
│   └── teamService.js             ← 17 funzioni utility
└── pages/
    └── PWADashboard.jsx           ← Integrato nel layout
```

---

## 🔄 Flusso Utente

```
PWA Dashboard
    ↓
[Click "La tua squadra"] 
    ↓
TeamsManager appare come card (NON fullscreen)
    ├─ TAB 1: "I miei Gruppi"
    │  ├─ Mostra squadre utente
    │  └─ Click codice → copia al clipboard
    │
    └─ TAB 2: "Scopri"
       ├─ Barra ricerca
       ├─ Lista risultati
       └─ Click "Unisciti" → Aggiunge a team_members ✅
```

---

## 💡 Prossimi Step

### 1. Logo delle Squadre
Aggiungi `logo_url` durante creazione:
```javascript
await createTeam({
  name: 'Calcetto',
  description: 'Desc',
  logo_url: 'https://example.com/logo.jpg'  // ← Aggiungi URL
}, userId);
```

### 2. Invita per Codice
Vuoi che gli amici si iscrivano con codice?
```javascript
import { joinTeamByInviteCode } from '../lib/teamService';

await joinTeamByInviteCode('GALA26', userId);
```

### 3. Creazione Team
Copia form da `EXAMPLE_TEAMS_USAGE.jsx` sez. 3

---

## 🎨 Personalizzare Colori

Tutti i colori sono in `TeamsManager.jsx`:

**Giallo** (squadre):
```jsx
border-yellow-200  ← Bordo card "I miei Gruppi"
bg-yellow-100      ← Avatar background
text-yellow-500    ← Tab attivo
```

**Blu** (azioni):
```jsx
from-blue-500 to-blue-600  ← Bottone "Unisciti"
focus:ring-blue-500        ← Input focus
```

---

## 🧪 Testing Mobile

Apri su device mobile:
- [ ] Tab funzionano
- [ ] Ricerca filtra squadre
- [ ] Bottone "Unisciti" responsivo
- [ ] Click codice copia al clipboard
- [ ] Smooth animations

---

## ⚡ Performance

- Debounce ricerca: 300ms ✅
- Indici database: name, invite_code, user_id ✅
- Real-time ready: Canali Supabase pronti ✅

---

## 🐛 Se Non Funziona

**"Nessuna squadra trovata"**
→ Aggiungi squadre test con SQL sopra

**Ricerca non funziona**
→ Abilita `pg_trgm`: `CREATE EXTENSION pg_trgm;`

**Click "Unisciti" non fa nulla**
→ Controlla RLS policies di Supabase

**Bottone disabilitato**
→ Assicurati che `userId` sia passato al componente

---

## 📚 Documentazione Completa

- **TEAMS_SETUP.md** → Setup + SQL + Troubleshooting
- **EXAMPLE_TEAMS_USAGE.jsx** → Snippet pronti da copiare
- **src/lib/teamService.js** → Funzioni disponibili (commentate)

---

## ✨ Pronto?

1. ✅ Copia SQL setup in Supabase
2. ✅ Apri PWA Dashboard → "La tua squadra"
3. ✅ Testa con squadre di esempio
4. ✅ Leggi TEAMS_SETUP.md per personalizzare

**Buon divertimento!** ⚽👥

---

**Versione**: 2.0 - Schema Reale  
**Aggiornato**: Maggio 2026


---

## 🎮 Test Subito

### Aggiungi squadre test:

```sql
INSERT INTO teams (name, description, is_private, created_by)
VALUES (
  'Calcetto Pubblico',
  'Squadra aperta a tutti - Test',
  false,
  (SELECT id FROM auth.users LIMIT 1)
);

INSERT INTO teams (name, description, is_private, password, created_by)
VALUES (
  'Calcetto Elite',
  'Solo per invitati - Test',
  true,
  'password123',
  (SELECT id FROM auth.users LIMIT 1)
);
```

### Accedi all'app → PWA Dashboard → Bottone "La tua squadra"

Dovresti vedere:
- **Tab "I miei Gruppi"**: Vuoto (non sei ancora in nessuna squadra)
- **Tab "Scopri"**: Le 2 squadre test
- Clicca "Unisciti" sulla prima (pubblica) - funziona subito ✅
- Clicca "Unisciti" sulla seconda (privata) - chiede password → inserisci "password123" ✅

---

## 🔑 RPC Facoltativa (Per Password)

Se vuoi verifica password **corretta** (al momento è placeholder), copia:

```sql
-- Crea funzione RPC
CREATE OR REPLACE FUNCTION verify_team_password(
  p_team_id UUID,
  p_password TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams
    WHERE id = p_team_id
    AND is_private = true
    AND password = p_password
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📁 File Creati

Nella tua cartella progetto hai ora:

```
src/
├── components/
│   └── TeamsManager.jsx          ← Componente principale ⭐
├── lib/
│   └── teamService.js             ← Funzioni utility
└── pages/
    └── PWADashboard.jsx           ← Modificato (integrazione)

📄 TEAMS_SETUP.md                  ← Setup completo + troubleshooting
📄 EXAMPLE_TEAMS_USAGE.jsx         ← 10 snippet di utilizzo
```

---

## 💡 Prossimo Passo: Creazione Team

Vuoi che gli utenti **creino** squadre? Aggiungi questo bottone in TeamsManager:

```jsx
// Nel tab "I miei Gruppi", prima del FAB (+)
<button
  onClick={() => setShowCreateForm(true)}
  className="w-full bg-yellow-400 text-white px-4 py-3 rounded-xl font-bold"
>
  ➕ Crea una Squadra
</button>
```

Poi copia il form da `EXAMPLE_TEAMS_USAGE.jsx` → sezione "3. FORM DI CREAZIONE TEAM"

---

## 🎨 Personalizzare Colori

Tutti i colori sono in `TeamsManager.jsx`:

**Giallo** (squadre):
```jsx
border-yellow-200  ← Bordo card
bg-yellow-400      ← Bottone "+"
text-yellow-500    ← Tab attivo
```

**Blu** (azioni):
```jsx
from-blue-500 to-blue-600  ← Bottone "Unisciti"
focus:ring-blue-500        ← Input focus
```

Cambia a tuo piacimento! 🎨

---

## 🧪 Testing Mobile

Apri su device mobile o emulatore:
- [ ] Tab funzionano
- [ ] Ricerca filtra squadre
- [ ] Bottone "Unisciti" responsivo
- [ ] Modal password appare bene
- [ ] Smooth animations

---

## ⚡ Performance Tips

1. **Caching**: Aggiungi React Query per cache automatico
2. **Real-time**: Abilita listener per aggiornamenti istantanei (vedi `TEAMS_SETUP.md`)
3. **Ricerca**: Debounce è già a 300ms - aumenta se server carico

---

## 🐛 Se Non Funziona

**Errore "Nessuna squadra trovata"**
→ Verifica che le tabelle esistano: `SELECT COUNT(*) FROM teams;`

**Ricerca non funziona**
→ Abilita `pg_trgm`: `CREATE EXTENSION pg_trgm;`

**Click "Unisciti" non fa nulla**
→ Controlla RLS policies di Supabase (sezione "Authorization")

**Bottone disabilitato**
→ Assicurati che `userId` sia passato al componente

→ Leggi **TEAMS_SETUP.md** sezione "Troubleshooting" completa

---

## 📚 Documentazione Completa

- **TEAMS_SETUP.md** → Setup + SQL + Troubleshooting (LEGGI QUESTA!)
- **EXAMPLE_TEAMS_USAGE.jsx** → Snippet pronti da copiare
- **src/lib/teamService.js** → Funzioni disponibili (con commenti)

---

## ✨ Pronto?

1. ✅ Copia SQL prerequisiti in Supabase
2. ✅ Apri PWA Dashboard → "La tua squadra"
3. ✅ Testa con squadre di esempio
4. ✅ Leggi TEAMS_SETUP.md per personalizzare

**Buon divertimento!** ⚽👥
