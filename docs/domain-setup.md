# Setup dominio `lultimo.app`

Registrato su Cloudflare (registrar a prezzo di costo, no markup). Riepilogo di
come è collegato, per non doverlo ricostruire a memoria in futuro.

**Stato attuale (10 luglio 2026): dominio live, email transazionali
funzionanti end-to-end (registrazione → SMTP Resend → link di reset
password → form → nuova password salvata).** Restano solo gli item in fondo
a "Ancora da fare".

## Perché `.app` e non `.it`

- `.it` non è tra i TLD venduti da Cloudflare Registrar (richiede residenza UE
  gestita diversamente da altri registri) — non è mai comparso tra le opzioni.
- `.com` puro (`lultimo.com`) non era disponibile.
- `.app` è un TLD Google che **forza HTTPS di default** (bonus di sicurezza
  gratuito) ed è pensato apposta per app come questa.
- Scartati `.uk` (segnala "sito britannico", pubblico è italiano) e `.org`
  (convenzionalmente per no-profit, non per un'app commerciale).

## Vercel — hosting del sito

Progetto Vercel → Settings → Domains → `lultimo.app` (dominio nudo, **senza**
`www`: la redirect automatica "apex → www" di Vercel è stata disattivata in
fase di aggiunta, per tenere l'URL breve e coerente ovunque).

Record DNS su Cloudflare (zona `lultimo.app` → DNS → Records):

| Type  | Name | Content                              | Proxy     |
|-------|------|---------------------------------------|-----------|
| CNAME | `@`  | `023cd3298efb078d.vercel-dns-017.com` | DNS only (nuvoletta grigia, **non** proxata) |

Il proxy Cloudflare va tenuto disattivato su questo record: se attivo, Vercel
non riesce a emettere il certificato SSL e la configurazione risulta "Invalid".

L'URL originale `l-ultimo-web.vercel.app` resta comunque attivo in parallelo
(stesso deploy, nessuna interruzione).

## Supabase — Auth URL Configuration

Authentication → URL Configuration:
- **Site URL**: `https://lultimo.app` (prima era l'URL vercel.app)
- **Redirect URLs**: aggiunto `https://lultimo.app/**` (il vecchio dominio è
  stato lasciato in lista durante la transizione)

## Resend — invio email transazionali

Dominio aggiunto su Resend come **sottodominio dedicato** `mail.lultimo.app`
(non il dominio nudo), su consiglio esplicito di Resend: isola la reputazione
dell'invio email da quella del dominio principale del sito.

- Region: Ireland (eu-west-1)
- Record DNS (DKIM, SPF, DMARC) aggiunti via integrazione automatica
  Resend↔Cloudflare ("Auto configure" / "Go to Cloudflare" nel pannello
  Resend) — niente copia-incolla manuale dei valori lunghi.
- "Enable Receiving" lasciato **disattivato**: serve solo inviare (reset
  password, notifiche), non ricevere email su questo dominio.
- Mittente email risultante: `noreply@mail.lultimo.app`
- Dominio verificato su Resend (DKIM + SPF confermati quasi subito, DMARC
  qualche minuto dopo — tutti via l'integrazione automatica con Cloudflare).

### Custom SMTP su Supabase — fatto

Authentication → Settings → SMTP Settings → Enable Custom SMTP:
- Sender email: `noreply@mail.lultimo.app`
- Sender name: `L'Ultimo`
- Host: `smtp.resend.com`
- Username: `resend`
- Password: API key Resend dedicata, creata apposta con nome
  `supabase-auth-smtp` (permission "Sending access") — **non riusata** una
  delle chiavi già esistenti (`ultimo-review-reports`, `Onboarding`), sia
  perché Resend non fa più vedere il valore di una chiave già creata, sia
  per tenere ogni integrazione su una chiave separata e revocabile a parte.

Verificato funzionante: email di reset password arrivata, link cliccato,
form di nuova password mostrato correttamente.

## Bug scoperti e risolti durante il setup

**404 dopo il click sul link di reset password.** `/reset-password` era
registrata come rotta solo nel ramo "utente non loggato" di `App.jsx`. Il
click sul link però chiama `supabase.auth.verifyOtp(...)`, che stabilisce
una vera sessione Supabase (di recupero) *mentre l'utente è ancora sulla
pagina* — l'app passa quindi al ramo "utente loggato" a metà flusso, dove
`/reset-password` non esisteva, e cadeva sul catch-all 404. Fix: la stessa
rotta è stata aggiunta anche al ramo autenticato (`src/App.jsx`, sezione
"Rotte comuni sempre accessibili"). Se in futuro si aggiungono altre pagine
raggiungibili da link email che possono stabilire una sessione a metà
flusso (magic link, inviti via email, ecc.), vale la stessa attenzione:
vanno registrate in **entrambi** i rami di rotte, non solo in quello
"pre-login" dove sembra logico metterle a prima vista.

## Ancora da fare

- [ ] Se si usa "Accedi con Google": aggiungere `https://lultimo.app` tra gli
      Authorized JavaScript origins/redirect URIs nel client OAuth su Google
      Cloud Console
- [ ] Quando si impacchetta la TWA per il Play Store: puntarla a `lultimo.app`
      e servire `https://lultimo.app/.well-known/assetlinks.json`
