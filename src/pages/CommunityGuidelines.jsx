import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

export default function CommunityGuidelines() {
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
        Linee Guida della Community
      </h1>

      {fromSettings && (
        <div className="mb-5 rounded-2xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
          Hai preso visione delle linee guida della community.
        </div>
      )}

      <section className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm">
        <h2 className="text-lg font-bold mb-2">Perché esistono</h2>
        <p className="text-slate-600 leading-relaxed">
          <strong>L'ULTIMO</strong> è una community di persone che si organizzano per giocare insieme. Perché
          l'esperienza resti positiva per tutti, chiediamo a ogni utente di rispettare queste regole quando
          crea un profilo, scrive una recensione o interagisce con altri giocatori.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Cosa non è consentito</h2>
        <p className="text-slate-600 leading-relaxed mb-3">
          Non è consentito pubblicare, in nessuna forma (nome utente, foto profilo, biografia, nome squadra,
          titolo partita, recensioni o commenti):
        </p>
        <ul className="list-disc pl-5 text-slate-600 space-y-2">
          <li>Linguaggio offensivo, discriminatorio, razzista, sessista o di incitamento all'odio.</li>
          <li>Molestie, minacce, bullismo o comportamenti persecutori verso altri utenti.</li>
          <li>Contenuti sessualmente espliciti o inappropriati.</li>
          <li>Recensioni false, diffamatorie o scritte in malafede per danneggiare un altro utente.</li>
          <li>Spam, pubblicità o contenuti commerciali non autorizzati.</li>
          <li>Furto d'identità o impersonificazione di un'altra persona.</li>
          <li>Contenuti illegali o che promuovono attività illegali.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Comportamento in campo</h2>
        <p className="text-slate-600 leading-relaxed">
          Chiediamo rispetto reciproco anche fuori dall'app: presentarsi agli impegni presi, avvisare per
          tempo in caso di rinuncia, ed evitare comportamenti scorretti o violenti durante le partite
          organizzate tramite la piattaforma.
        </p>
      </section>

      <section className="mb-8 border-t border-slate-100 pt-5">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Segnalare un abuso</h2>
        <p className="text-slate-600 leading-relaxed">
          Su ogni recensione trovi un menu (icona <strong>⋮</strong>) da cui puoi <strong>segnalare</strong> il
          contenuto indicando il motivo, oppure <strong>bloccare</strong> l'utente: non vedrai più le sue
          recensioni e lui non potrà più lasciartene o inviarti richieste di amicizia. Puoi sbloccare un
          utente in qualsiasi momento dallo stesso menu.
        </p>
        <p className="text-slate-600 leading-relaxed mt-3">
          Ogni segnalazione viene esaminata dal nostro team entro <strong>24 ore</strong>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Conseguenze delle violazioni</h2>
        <p className="text-slate-600 leading-relaxed mb-3">
          A seconda della gravità e della recidiva, una violazione di queste linee guida può portare a:
        </p>
        <ul className="list-disc pl-5 text-slate-600 space-y-2">
          <li>Rimozione del contenuto segnalato (recensione, foto, testo del profilo).</li>
          <li>Avviso formale all'utente responsabile.</li>
          <li>Sospensione temporanea dell'account.</li>
          <li>Ban permanente dalla piattaforma, in caso di violazioni gravi o ripetute.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-2 text-slate-800">Contattaci</h2>
        <p className="text-slate-600 leading-relaxed">
          Per segnalare situazioni non gestibili dal menu di segnalazione, fare ricorso su una decisione
          presa, o per qualsiasi dubbio su queste linee guida, scrivici a{' '}
          <a href="mailto:info@lultimo.app" className="text-blue-600 font-medium underline">info@lultimo.app</a>.
        </p>
      </section>

      <footer className="mt-10 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs italic">
        Queste linee guida possono essere aggiornate periodicamente per riflettere l'evoluzione della community.
      </footer>
    </div>
  );
}
