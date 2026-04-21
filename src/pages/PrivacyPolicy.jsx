import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

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
        className="mb-6 inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 transition-all active:scale-95"
      >
        TORNA INDIETRO
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
          Il titolare del trattamento è <strong>L'ULTIMO</strong>. Per qualsiasi richiesta relativa alla privacy, puoi scriverci a: <span className="text-blue-600 font-medium">iracefrancesco99@outlook.it</span>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Quali dati raccogliamo</h2>
        <p className="text-slate-600 leading-relaxed">
          Quando ti registri e utilizzi l'app, raccogliamo:
        </p>
        <ul className="list-disc pl-5 text-slate-600 mt-3 space-y-2">
          <li><strong>Identificativi:</strong> Email, Username e immagine profilo.</li>
          <li><strong>Sicurezza:</strong> Password (criptata e gestita da <Link to="https://supabase.com" target="_blank" className='text-blue-600 underline' rel="noopener noreferrer">Supabase</Link>).</li>
          <li><strong>Caratteristiche:</strong> Genere e preferenze di gioco.</li>
          <li><strong>Posizione:</strong> Coordinate geografiche (Lat/Lng) e località, usate esclusivamente per mostrarti i match vicini.</li>
          <li><strong>Log Tecnici:</strong> Indirizzo IP e dati del browser per la prevenzione di abusi.</li>
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
        <h2 className="text-xl font-bold mb-2 text-slate-800">Trasferimento e Sicurezza</h2>
        <p className="text-slate-600 leading-relaxed">
          I dati sono ospitati su server protetti forniti da <strong>Supabase</strong> e <strong>Vercel</strong>. Tali fornitori operano in conformità alle clausole contrattuali standard dell'Unione Europea per il trasferimento dei dati extra-UE.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Conservazione</h2>
        <p className="text-slate-600 leading-relaxed text-justify">
          I dati vengono conservati per l'intera durata della tua iscrizione. Qualora decidessi di eliminare il profilo, i tuoi dati personali saranno rimossi dai nostri sistemi entro 30 giorni, salvo obblighi di legge.
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