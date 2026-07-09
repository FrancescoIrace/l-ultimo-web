# L'Ultimo

App per organizzare partite sportive, trovare giocatori e prenotare campi presso centri sportivi affiliati. PWA installabile, pensata anche per la pubblicazione su Google Play come Trusted Web Activity (TWA).

## Stack

- **Frontend**: React 19 + Vite 8, Tailwind CSS 4, React Router 7
- **Backend**: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- **Notifiche push**: Firebase Cloud Messaging
- **Email transazionali**: Resend (via SMTP custom su Supabase Auth)
- **Meteo**: Open-Meteo (nessuna API key richiesta)
- **Monitoraggio errori**: Sentry · **Analytics**: Vercel Analytics
- **Hosting**: Vercel

## Funzionalità principali

- Creazione e ricerca partite (geolocalizzate, per sport/orario/giorno)
- Prenotazione campi presso centri sportivi affiliati (richiesta → conferma, modifica orario)
- Squadre pubbliche/private (con password), inviti, codice invito
- Sistema recensioni tra giocatori a fine partita
- Notifiche push + in-app in tempo reale (Supabase Realtime)
- Dashboard business per i centri sportivi (gestione campi, orari, prenotazioni, messaggi)
- Account eliminabile in autonomia dalle Impostazioni (richiesto da Google Play)

## Setup locale

```bash
npm install
cp .env.example .env.local   # poi compila le chiavi (vedi sotto)
npm run dev
```

### Variabili d'ambiente

Vedi `.env.example` per le chiavi pubbliche (safe da esporre lato client). Servono inoltre, in `.env.local`, solo per script locali che parlano direttamente con Supabase (mai per il client dell'app):

- `SUPABASE_SERVICE_ROLE_KEY` — usata da `scripts/insertFCMSecret.js`. **Non committare mai**, bypassa tutte le policy RLS.

Le chiavi Firebase/Supabase/Maps del client sono pubbliche per design (protette da RLS lato Supabase e da restrizioni di dominio lato Google/Firebase), ma restano comunque fuori da git per `.env*` — vanno configurate come variabili d'ambiente sul progetto Vercel per il deploy.

## Struttura del progetto

```
src/
  pages/          Pagine/rotte principali (una per file)
  pages/business/ Dashboard e strumenti per i centri sportivi
  components/     Componenti riutilizzabili
  hooks/          Hook custom (notifiche push, geolocalizzazione, ecc.)
  lib/            Client Supabase/Firebase, servizi (meteo, notifiche, date)
supabase/
  migrations/     Migration SQL, applicate con `supabase db push`
  functions/      Edge Functions (operazioni che richiedono la service_role key)
docs/             Note di setup che non stanno bene in un commit di codice
```

## Comandi utili

```bash
npm run dev       # dev server locale
npm run build     # build di produzione
npm run lint      # ESLint
npm run preview   # anteprima della build di produzione
```

Deploy: automatico su push a `main` (Vercel). Le migration Supabase **non** si applicano da sole — vanno lanciate a mano con `supabase db push` dopo averle pushate. Le Edge Function vanno ridistribuite a mano con `supabase functions deploy <nome>` quando cambiano.

## Documentazione aggiuntiva

- [`docs/domain-setup.md`](docs/domain-setup.md) — collegamento dominio `lultimo.app` (Vercel, Supabase Auth, Resend)
- [`docs/store-data-disclosure.md`](docs/store-data-disclosure.md) — dossier dati raccolti, pronto per i moduli "Data Safety" di Google Play e "Privacy Nutrition Label" di App Store
