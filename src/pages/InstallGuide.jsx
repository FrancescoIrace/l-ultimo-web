import { Link } from 'react-router-dom';

export default function InstallGuide() {
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white min-h-screen">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="mb-6 inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 transition-all active:scale-95"
      >
        TORNA INDIETRO
      </button>

      <h1 className="text-3xl font-black text-slate-900 mb-6">Guida all'installazione</h1>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-2xl font-bold mb-3">Android</h2>
        <ol className="list-decimal pl-5 space-y-3 text-slate-700">
          <li>Apri il menu del browser (di solito i tre puntini in alto a destra).</li>
          <li>Seleziona <span className="font-bold">Aggiungi a schermata Home</span> o <span className="font-bold">Installa app</span>.</li>
          <li>Conferma l'installazione e trova l'app tra le tue app o sulla schermata iniziale.</li>
          <li>Da lì puoi aprire l'app direttamente, senza usare il browser.</li>
        </ol>
      </section>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-2xl font-bold mb-3">iPhone / iPad</h2>
        <ol className="list-decimal pl-5 space-y-3 text-slate-700">
          <li>Apri il sito con Safari.</li>
          <li>Tocca il pulsante <span className="font-bold">Condividi</span> (l'icona con la freccia verso l'alto).</li>
          <li>Seleziona <span className="font-bold">Aggiungi a Home</span>.</li>
          <li>Conferma il nome e tocca <span className="font-bold">Aggiungi</span>.</li>
          <li>L'app verrà inserita nella schermata iniziale come una vera app.</li>
        </ol>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-2xl font-bold mb-3">Perché usare la PWA</h2>
        <ul className="list-disc pl-5 space-y-2 text-slate-700">
          <li>Accesso più rapido dal telefono.</li>
          <li>Interfaccia più pulita senza la barra degli indirizzi.</li>
          <li>Migliori notifiche e comportamento da app.</li>
          <li>Meno rischi di dimenticare il sito tra le schede del browser.</li>
        </ul>
      </section>

      <p className="mt-6 text-sm text-slate-500">
        Se non trovi l'opzione, prova ad aggiornare il browser o a chiudere e riaprire la pagina. Su Android la voce può comparire solo dopo qualche secondo dal caricamento.
      </p>

      <p className="mt-4 text-sm text-blue-600">
        Oppure torna a <Link to="/" className="underline">Home</Link> o continua con il login/registrazione.
      </p>
    </div>
  );
}
