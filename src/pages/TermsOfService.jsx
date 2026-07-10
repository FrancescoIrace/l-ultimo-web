import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

export default function TermsOfService() {
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
        Termini di Servizio
      </h1>

      {fromSettings && (
        <div className="mb-5 rounded-2xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
          Hai preso visione dei termini di servizio.
        </div>
      )}

      <section className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm">
        <h2 className="text-lg font-bold mb-2">Accettazione dei termini</h2>
        <p className="text-slate-600 leading-relaxed">
          Utilizzando <strong>L'ULTIMO</strong> accetti questi Termini di Servizio, l'
          <a href="/privacy-policy" className="text-blue-600 underline">Informativa Privacy</a> e le{' '}
          <a href="/community-guidelines" className="text-blue-600 underline">Linee Guida della Community</a>.
          Se non li accetti, non puoi utilizzare l'app.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Il servizio</h2>
        <p className="text-slate-600 leading-relaxed">
          L'ULTIMO è una piattaforma che aiuta gli utenti a organizzare e trovare partite sportive con altri
          giocatori. Non siamo proprietari né gestori dei centri sportivi, dei campi o degli eventi organizzati
          dagli utenti: agiamo esclusivamente come intermediari tecnologici.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Il tuo account</h2>
        <ul className="list-disc pl-5 text-slate-600 space-y-2">
          <li>Devi avere almeno 16 anni per creare un account.</li>
          <li>Sei responsabile della riservatezza delle tue credenziali e di tutte le attività svolte con il tuo account.</li>
          <li>Le informazioni fornite in fase di registrazione devono essere veritiere e aggiornate.</li>
          <li>Puoi eliminare il tuo account in qualsiasi momento dalle Impostazioni.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Contenuti generati dagli utenti</h2>
        <p className="text-slate-600 leading-relaxed">
          Rimani proprietario dei contenuti che pubblichi (recensioni, foto profilo, nomi di squadra, ecc.), ma
          ci concedi una licenza non esclusiva per mostrarli all'interno dell'app agli altri utenti. Il rispetto
          delle regole sui contenuti è descritto nelle{' '}
          <a href="/community-guidelines" className="text-blue-600 underline">Linee Guida della Community</a>,
          la cui violazione può portare a rimozione dei contenuti, sospensione o ban dell'account.
        </p>
      </section>

      <section className="mb-8 border-t border-slate-100 pt-5">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Limitazione di responsabilità</h2>
        <p className="text-slate-600 leading-relaxed">
          L'ULTIMO facilita l'incontro tra giocatori ma non partecipa all'organizzazione fisica delle partite né
          garantisce la condotta degli altri utenti o le condizioni dei centri sportivi. Non siamo responsabili
          per infortuni, danni, controversie o perdite derivanti dalla partecipazione a partite organizzate
          tramite la piattaforma. L'utilizzo dell'app è a proprio rischio.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Sospensione e cessazione</h2>
        <p className="text-slate-600 leading-relaxed">
          Possiamo sospendere o eliminare un account che viola questi Termini o le Linee Guida della Community,
          senza preavviso in caso di violazioni gravi. Puoi interrompere l'utilizzo del servizio in qualsiasi
          momento.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Modifiche ai termini</h2>
        <p className="text-slate-600 leading-relaxed">
          Potremmo aggiornare questi Termini periodicamente. Le modifiche sostanziali saranno comunicate
          tramite notifica in-app. L'uso continuato del servizio dopo una modifica costituisce accettazione dei
          nuovi termini.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Legge applicabile e contatti</h2>
        <p className="text-slate-600 leading-relaxed">
          Questi Termini sono regolati dalla legge italiana. Per qualsiasi domanda scrivici a{' '}
          <a href="mailto:info@lultimo.app" className="text-blue-600 font-medium underline">info@lultimo.app</a>.
        </p>
      </section>

      <footer className="mt-10 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs italic">
        Ultimo aggiornamento: Luglio 2026.
      </footer>
    </div>
  );
}
