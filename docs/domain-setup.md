# Setup dominio `lultimo.app`

Registrato su Cloudflare (registrar a prezzo di costo, no markup). Riepilogo di
come è collegato, per non doverlo ricostruire a memoria in futuro.

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

### Prossimo passo (da fare)
Una volta che Resend segna il dominio come **Verified**, configurare il
Custom SMTP su Supabase:

Authentication → Settings → SMTP Settings → Enable Custom SMTP:
- Sender email: `noreply@mail.lultimo.app`
- Sender name: `L'Ultimo`
- Host: `smtp.resend.com`
- Port: `465` (SSL) o `587` (TLS)
- Username: `resend`
- Password: la API key Resend

## Ancora da fare

- [ ] Configurare Custom SMTP su Supabase (sopra) una volta che Resend è verificato
- [ ] Se si usa "Accedi con Google": aggiungere `https://lultimo.app` tra gli
      Authorized JavaScript origins/redirect URIs nel client OAuth su Google
      Cloud Console
- [ ] Quando si impacchetta la TWA per il Play Store: puntarla a `lultimo.app`
      e servire `https://lultimo.app/.well-known/assetlinks.json`
