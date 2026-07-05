# Dossier Data Safety / Nutrition Label — L'ULTIMO

Riferimento pronto da copiare in **Google Play Console (Data Safety)** e **App Store Connect
(Privacy Nutrition Label)**, basato sui dati realmente raccolti dall'app: autenticazione Supabase,
notifiche push Firebase, geolocalizzazione Google Maps. Nessun SDK pubblicitario, nessun analytics
di terze parti, nessuna vendita dati a terzi.

> Versione visuale (tabelle/chip colorati): [Artifact su claude.ai](https://claude.ai/code/artifact/d24e36c4-c5ca-4a28-a7a9-56d62dd9c22f)
>
> Aggiornato: luglio 2026. **Va ricompilato ogni volta che si aggiunge un nuovo SDK, un nuovo campo
> raccolto, o si cambia fornitore** (es. sostituzione di Firebase con un altro servizio push). Un
> disallineamento tra quanto dichiarato e quanto l'app fa davvero è tra i motivi più comuni di
> rigetto o sospensione post-pubblicazione.

## Inventario dati reale

Ogni riga corrisponde a un dato che l'app raccoglie davvero oggi — verificato nel codice, non dedotto.

| Categoria | Campo | Raccolto | Collegato all'utente | Condiviso con terzi | Obbligatorio |
|---|---|---|---|---|---|
| Contatti | `email` — login, notifiche account | Sì | Sì | No | Sì |
| Contatti | `cellulare` — contatto WhatsApp tra utenti | Sì | Sì | No | No |
| Info personali | `username`, genere, sport preferito, provincia | Sì | Sì | No | Parziale |
| Foto | `avatar_url` — foto profilo caricata dall'utente | Sì | Sì | No | No |
| Posizione | `lat`/`lng` — coordinate per match vicini, via Google Maps | Sì | Sì | Sì* | No (opzionale) |
| Contenuti utente | reviews, teams, match, bio | Sì | Sì | No | Parziale |
| ID dispositivo | token FCM — invio push notification, via Firebase | Sì | Sì | Sì* | No (opzionale) |
| Diagnostica | IP, log tecnici — prevenzione abusi | Sì | No | No | Automatico |

\* "Condiviso con terzi" qui significa solo *processato da un fornitore infrastrutturale* (Google
Maps per geocoding, Firebase per la consegna push) — nessuno dei due lo riceve per scopi propri di
advertising o profilazione. Sia Play che Apple distinguono questo dalla "condivisione" in senso
pubblicitario: nei form vanno dichiarati come **elaborazione da parte di un service provider**, non
come vendita/condivisione a terzi.

## Cheat-sheet Google Play Console — Data Safety

- **Raccogli o condividi dati utente?** Sì, raccolgo.
- **Categorie di dati raccolti**: Info personali · Posizione approssimativa/precisa · Foto · ID dispositivo o altri ID.
- **I dati sono condivisi con terze parti?** No — solo elaborati da service provider (Supabase, Firebase, Google Maps, Vercel).
- **I dati sono crittografati in transito?** Sì (HTTPS/TLS, gestito da Supabase/Vercel).
- **L'utente può richiedere l'eliminazione dei dati?** Sì — autoeliminazione account in Impostazioni.

## Cheat-sheet App Store Connect — Privacy Nutrition Label

- **Dati usati per tracciarti (Tracking)?** No — nessun SDK ad/analytics di terze parti.
- **Data Used to Track You**: Nessuno.
- **Data Linked to You**: Contact Info · Location · User Content · Identifiers.
- **Data Not Linked to You**: Diagnostics (log IP per anti-abuso).
