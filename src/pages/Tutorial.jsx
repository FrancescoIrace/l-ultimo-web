import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Zap, MapPin, Users, HelpCircle, Star, UserPlus, ChevronRight } from 'lucide-react';

const SECTIONS = [
  {
    icon: Zap,
    title: 'Organizza una partita',
    steps: [
      'Vai su "Organizza" e scegli sport, data, orario e luogo.',
      'Imposta il numero di giocatori richiesti.',
      'Scegli la visibilità: "Pubblico" per farla trovare a chiunque nella zona, oppure "Squadra" per riservarla ai membri di una tua squadra.',
      'Pubblica: la partita comparirà nella lista e i giocatori potranno unirsi con un tap.',
    ],
    link: { to: '/organizza', label: 'Organizza una partita' },
  },
  {
    icon: MapPin,
    title: 'Trova partite vicino a te',
    steps: [
      'Vai su "Partite" e sfoglia quelle organizzate nella tua zona.',
      'Usa i filtri per sport e distanza per restringere la ricerca.',
      'Tocca una partita per vedere dettagli, orario e giocatori già iscritti.',
      'Unisciti con un tap: se i posti sono pieni entri in lista d\'attesa.',
    ],
    link: { to: '/partite', label: 'Trova partite' },
  },
  {
    icon: Users,
    title: 'Crea e gestisci una squadra',
    steps: [
      'Vai su "Squadre" e crea la tua squadra scegliendo nome, sport e (facoltativo) un logo.',
      'Invita i tuoi amici direttamente dal dettaglio squadra.',
      'Usa la formazione casuale per dividere i giocatori in due squadre in un tap, senza discussioni.',
    ],
    link: { to: '/squadre', label: 'Vai a Squadre' },
  },
  {
    icon: UserPlus,
    title: 'Trova e aggiungi amici',
    steps: [
      'Vai su "Trova amici" e cerca per username.',
      'Invia una richiesta di amicizia: l\'altro utente la vedrà tra le sue richieste in sospeso.',
      'Una volta accettata, potrai invitarlo direttamente alle tue partite e squadre.',
    ],
    link: { to: '/trova-amici', label: 'Trova amici' },
  },
  {
    icon: HelpCircle,
    title: 'Il Quiz del giorno',
    steps: [
      'Una volta al giorno puoi rispondere a 3 domande sportive a tempo.',
      'Ogni risposta corretta vale punti per la classifica generale.',
      'A fine quiz trovi il riepilogo con le risposte giuste e quelle sbagliate.',
      'Torna domani per una nuova sfida: un solo tentativo al giorno per account.',
    ],
    link: { to: '/sfida', label: 'Fai il quiz di oggi' },
  },
  {
    icon: Star,
    title: 'Recensioni e reputazione',
    steps: [
      'Dopo ogni partita puoi lasciare una recensione ai compagni con cui hai giocato.',
      'Le recensioni ricevute costruiscono la tua reputazione: più sei affidabile, più gli altri si fideranno di giocare con te.',
      'Puoi consultare le recensioni ricevute (e quelle scritte) dalla tua sezione personale.',
    ],
    link: { to: '/recensioni', label: 'Vai a Recensioni' },
  },
];

export default function Tutorial() {
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

      <h1 className="text-3xl font-black text-slate-900 mb-2">Come funziona L'ULTIMO</h1>
      <p className="text-slate-500 mb-6">
        Una guida rapida alle azioni principali dell'app.
      </p>

      {fromSettings && (
        <div className="mb-5 rounded-2xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
          Sei arrivato qui dalle Impostazioni: torna indietro quando vuoi.
        </div>
      )}

      <div className="space-y-5">
        {SECTIONS.map((section) => (
          <section key={section.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0">
                <section.icon size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">{section.title}</h2>
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-slate-700 text-sm">
              {section.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <Link
              to={section.link.to}
              className="inline-block mt-4 text-sm font-bold text-blue-600 underline"
            >
              {section.link.label} &rarr;
            </Link>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-slate-500">
        Hai altri dubbi? Scrivici a{' '}
        <a href="mailto:info@lultimo.app" className="text-blue-600 font-medium underline">info@lultimo.app</a>.
      </p>
    </div>
  );
}
