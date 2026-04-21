import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white min-h-screen">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="mb-6 inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 transition-all active:scale-95"
      >
        TORNA INDIETRO
      </button>

      <h1 className="text-3xl font-black text-slate-900 mb-6">Informativa sul trattamento dei dati</h1>

      <section className="mb-5">
        <h2 className="text-xl font-bold mb-2">Quali dati raccogliamo</h2>
        <p className="text-slate-600 leading-relaxed">
          Quando ti registri raccogliamo i dati necessari per creare e gestire il tuo account, tra cui:
        </p>
        <ul className="list-disc pl-5 text-slate-600 mt-3 space-y-1">
          <li>Email</li>
          <li>Password (gestita in sicurezza da <Link to="https://supabase.com" target="_blank" className='text-blue-600 underline' rel="noopener noreferrer">Supabase</Link>)</li>
          <li>Username</li>
          <li>Genere</li>
          <li>Posizione e coordinate</li>
          <li>Consenso al trattamento dei dati</li>
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="text-xl font-bold mb-2">Per quale motivo</h2>
        <p className="text-slate-600 leading-relaxed">
          I tuoi dati vengono usati per:
        </p>
        <ul className="list-disc pl-5 text-slate-600 mt-3 space-y-1">
          <li>gestire il tuo account e permettere il login</li>
          <li>mostrare le partite e gli utenti più vicini a te</li>
          <li>personalizzare il profilo e le preferenze</li>
          <li>fornire correttamente i servizi dell’app</li>
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="text-xl font-bold mb-2">Base giuridica</h2>
        <p className="text-slate-600 leading-relaxed">
          Il trattamento dei dati è basato sul tuo consenso esplicito attraverso il checkbox presente durante la registrazione.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="text-xl font-bold mb-2">Conservazione</h2>
        <p className="text-slate-600 leading-relaxed">
          I dati vengono conservati finché il tuo account esiste e fino a quando non richiedi la cancellazione. In caso di richiesta di rimozione, i dati verranno eliminati secondo la normativa vigente.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-2">I tuoi diritti</h2>
        <p className="text-slate-600 leading-relaxed">
          Puoi richiedere l'accesso, la correzione o la cancellazione dei tuoi dati in qualsiasi momento contattando il supporto o utilizzando le funzionalità del tuo account.
        </p>
      </section>
    </div>
  );
}
