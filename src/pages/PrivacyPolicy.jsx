import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

export default function PrivacyPolicy() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const fromSettings = params.get('from') === 'settings';

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white min-h-screen">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
      >
        <ChevronRight size={14} className="rotate-180" />
        Indietro
      </button>

      <h1 className="text-3xl font-black text-slate-900 mb-6">
        Informativa sul trattamento dei dati
      </h1>

      {fromSettings && (
        <div className="mb-5 rounded-2xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
          Hai aderito al trattamento dei dati personali.
        </div>
      )}

      {/* 1. TITOLARE - Obbligatorio per GDPR */}
      <section className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm">
        <h2 className="text-lg font-bold mb-2">Titolare del Trattamento</h2>
        <p className="text-slate-600 leading-relaxed">
          Il titolare del trattamento è <strong>L'ULTIMO</strong>. Per qualsiasi richiesta relativa alla privacy, puoi scriverci a: <a href="mailto:info@lultimo.app" className="text-blue-600 font-medium underline">info@lultimo.app</a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Quali dati raccogliamo</h2>
        <p className="text-slate-600 leading-relaxed">
          Quando ti registri e utilizzi l'app, raccogliamo:
        </p>
        <ul className="list-disc pl-5 text-slate-600 mt-3 space-y-2">
          <li><strong>Identificativi:</strong> Email, Username, Cellulare e immagine profilo.</li>
          <li><strong>Sicurezza:</strong> Password (criptata e gestita da <Link to="https://supabase.com" target="_blank" className='text-blue-600 underline' rel="noopener noreferrer">Supabase</Link>).</li>
          <li><strong>Caratteristiche:</strong> Genere e preferenze di gioco.</li>
          <li><strong>Posizione:</strong> Coordinate geografiche (Lat/Lng) e località, usate per mostrarti i match vicini e le previsioni meteo delle tue partite.</li>
          <li><strong>Notifiche push:</strong> Un identificativo del dispositivo/browser (endpoint), necessario per inviarti le notifiche che attivi tu stesso; puoi disattivarle in qualsiasi momento dalle Impostazioni.</li>
          <li><strong>Log Tecnici:</strong> Indirizzo IP e dati del browser per la prevenzione di abusi, e segnalazioni automatiche di errori dell'app (senza dati personali associati).</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Base giuridica e Finalità</h2>
        <p className="text-slate-600 leading-relaxed">
          Trattiamo i tuoi dati per:
        </p>
        <ul className="list-disc pl-5 text-slate-600 mt-3 space-y-2">
          <li><strong>Contratto:</strong> Consentirti di creare account, prenotare e organizzare partite.</li>
          <li><strong>Consenso:</strong> Per la geolocalizzazione, fornito tramite il tuo consenso esplicito al momento della registrazione o dell'uso.</li>
          <li><strong>Legittimo Interesse:</strong> Garantire la sicurezza della piattaforma.</li>
        </ul>
      </section>

      <section className="mb-8 border-t border-slate-100 pt-5">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Trasferimento, Sicurezza e Fornitori Terzi</h2>
        <p className="text-slate-600 leading-relaxed">
          I dati sono ospitati su server protetti forniti da <strong>Supabase</strong> (database e autenticazione) e <strong>Vercel</strong> (hosting e statistiche d'uso aggregate tramite Vercel Analytics). Per le notifiche push utilizziamo <strong>Firebase Cloud Messaging (Google)</strong>. Per la ricerca di indirizzi e la visualizzazione delle mappe utilizziamo le <strong>API di Google Maps</strong>. Per le previsioni meteo delle partite utilizziamo <strong>Open-Meteo</strong> (servizio che non richiede né memorizza dati identificativi). Per il monitoraggio di errori tecnici dell'app utilizziamo <strong>Sentry</strong>, configurato per non raccogliere dati personali identificativi. Tutti questi fornitori operano in conformità alle clausole contrattuali standard dell'Unione Europea per l'eventuale trasferimento di dati extra-UE.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Conservazione</h2>
        <p className="text-slate-600 leading-relaxed text-justify">
          I dati vengono conservati per l'intera durata della tua iscrizione. Se elimini il profilo dalle Impostazioni, il tuo account e i tuoi dati personali vengono rimossi immediatamente dai nostri sistemi (salvo il contenuto di eventuali backup di sicurezza, cancellati secondo il normale ciclo di rotazione, e i casi in cui la legge ci obbliga a conservare specifiche informazioni).
        </p>
      </section>

      <section className="mb-10 border-t border-slate-100 pt-5">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Come eliminare l'account su L'ULTIMO</h2>
        <p className="text-slate-600 leading-relaxed mb-3">
          Puoi eliminare in autonomia il tuo account e tutti i dati associati direttamente dall'app, in
          pochi passaggi:
        </p>
        <ol className="list-decimal pl-5 text-slate-600 space-y-1 mb-4">
          <li>Apri L'ULTIMO ed effettua l'accesso al tuo account.</li>
          <li>Vai su <strong>Impostazioni</strong>.</li>
          <li>Scorri fino alla sezione <strong>"Elimina profilo"</strong>.</li>
          <li>Tocca <strong>"Elimina il profilo"</strong> e conferma l'operazione.</li>
        </ol>
        <p className="text-slate-600 leading-relaxed mb-3">
          L'account e i dati personali vengono rimossi <strong>immediatamente</strong> dai nostri sistemi
          (salvo il contenuto di eventuali backup di sicurezza, cancellati secondo il normale ciclo di
          rotazione, e i casi in cui la legge ci obbliga a conservare specifiche informazioni, es. per
          adempimenti fiscali).
        </p>
        <p className="text-slate-600 leading-relaxed">
          Se non riesci ad accedere all'app o all'account, puoi richiedere la cancellazione scrivendo a{' '}
          <a href="mailto:info@lultimo.app" className="text-blue-600 font-medium underline">info@lultimo.app</a>{' '}
          indicando l'indirizzo email registrato: elaboreremo la richiesta entro pochi giorni lavorativi.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-2 text-slate-800">I tuoi diritti (GDPR)</h2>
        <p className="text-slate-600 leading-relaxed">
          Hai il diritto di accedere, rettificare o cancellare i tuoi dati, nonché il diritto alla portabilità. Puoi esercitare questi diritti scrivendo alla nostra email di supporto o eliminando autonomamente l'account.
        </p>
        <p className="mt-4 text-slate-600">
          Hai inoltre il diritto di presentare un reclamo al <strong>Garante Privacy</strong> (www.garanteprivacy.it).
        </p>
      </section>

      <footer className="mt-10 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs italic">
        Questa informativa è resa ai sensi del Regolamento UE 2016/679 (GDPR).
      </footer>
    </div>
  );
}