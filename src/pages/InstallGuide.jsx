import { Link } from 'react-router-dom';
import { ChevronRight, ArrowRight, Smartphone, Apple } from 'lucide-react';

const TESTER_STEPS = [
  { n: '1', t: 'Iscriviti al gruppo tester', d: 'due click, self-service', href: 'https://groups.google.com/g/ultimo-app-testers' },
  { n: '2', t: 'Conferma di voler essere tester', d: 'apri il link e accetta', href: 'https://play.google.com/apps/testing/app.lultimo.twa' },
  { n: '3', t: "Scarica l'app dal Play Store", d: 'installala come una normale app', href: 'https://play.google.com/store/apps/details?id=app.lultimo.twa' },
];

export default function InstallGuide() {
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

      <h1 className="text-3xl font-black text-slate-900 mb-4">Guida all'installazione</h1>

      {/* Avviso BETA */}
      <div className="mb-6 rounded-3xl bg-slate-900 text-white p-5">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-300 bg-lime-300/10 px-3 py-1.5 rounded-full mb-3">
          ● Beta chiusa
        </span>
        <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
          L'Ultimo è ancora in <span className="font-bold text-white">beta</span>. Per ora ci si accede così:
          su <span className="font-bold text-white">Android</span> entrando come tester, su <span className="font-bold text-white">iPhone</span> installando l'app dal browser (i passaggi qui sotto).
          Dal <span className="font-bold text-lime-300">1° settembre</span> sarà disponibile per tutti negli store.
        </p>
      </div>

      {/* Android — accesso tester */}
      <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><Smartphone size={22} className="text-blue-600" /> Android</h2>
        <p className="text-sm text-slate-500 mb-4">In beta l'app si scarica dal Play Store come tester, in 3 passi:</p>
        <ol className="space-y-2.5">
          {TESTER_STEPS.map((step) => (
            <li key={step.n}>
              <a
                href={step.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-2xl px-4 py-3 transition-colors"
              >
                <span className="w-8 h-8 flex-shrink-0 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center">{step.n}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm leading-tight text-slate-800">{step.t}</span>
                  <span className="block text-xs text-slate-500">{step.d}</span>
                </span>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              </a>
            </li>
          ))}
        </ol>
        <a
          href="/#beta"
          className="mt-4 flex items-center justify-center gap-2 w-full rounded-2xl bg-blue-600 text-white font-black uppercase text-sm tracking-wide px-4 py-3.5 hover:bg-blue-700 transition-colors"
        >
          Vuoi diventare un nostro tester? <ArrowRight size={18} />
        </a>
      </section>

      {/* iPhone — installazione PWA */}
      <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><Apple size={22} className="text-slate-800" /> iPhone / iPad</h2>
        <p className="text-sm text-slate-500 mb-4">Per ora su iPhone l'app si installa dal browser (PWA):</p>
        <ol className="list-decimal pl-5 space-y-3 text-slate-700">
          <li>Apri il sito con Safari.</li>
          <li>Tocca il pulsante <span className="font-bold">Condividi</span> (l'icona con la freccia verso l'alto).</li>
          <li>Seleziona <span className="font-bold">Aggiungi a Home</span>.</li>
          <li>Conferma il nome e tocca <span className="font-bold">Aggiungi</span>.</li>
          <li>L'app verrà inserita nella schermata iniziale come una vera app.</li>
        </ol>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-2xl font-bold mb-3">Perché installarla</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Accesso più rapido dal telefono.</li>
          <li>Interfaccia più pulita senza la barra degli indirizzi.</li>
          <li>Migliori notifiche e comportamento da app.</li>
          <li>Meno rischi di dimenticare il sito tra le schede del browser.</li>
        </ul>
      </section>

      <p className="mt-6 text-sm text-slate-500">
        Su iPhone, se non trovi l'opzione, prova ad aggiornare Safari o a chiudere e riaprire la pagina. La voce può comparire solo dopo qualche secondo dal caricamento.
      </p>

      <p className="mt-4 text-sm text-blue-600">
        Oppure torna a <Link to="/" className="underline">Home</Link> o continua con il login/registrazione.
      </p>
    </div>
  );
}
