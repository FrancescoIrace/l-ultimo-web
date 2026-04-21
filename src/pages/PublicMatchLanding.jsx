import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PublicMatchLanding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMatch() {
      const { data, error } = await supabase
        .from('matches')
        .select('id, title, sport, datetime, location, description, max_players, current_players')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Errore caricamento partita pubblica:', error);
        setError('Partita non trovata.');
      } else {
        setMatch(data);
      }
      setLoading(false);
    }

    loadMatch();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-6 min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="mt-4 text-slate-600">Caricamento partita...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-md mx-auto p-6 min-h-screen bg-white">
        <button
          onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 transition-all"
        >
          TORNA ALLA HOME
        </button>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
          <h1 className="text-2xl font-black mb-4">Partita non trovata</h1>
          <p className="text-slate-600">Controlla il link o torna sulla home per vedere altre partite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 min-h-screen bg-white">
      <div className="mb-6 flex justify-between items-center">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-slate-500 text-sm hover:underline"
        >
          ← Torna indietro
        </button>
        <span className="text-xs uppercase text-slate-400">Preview pubblica</span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h1 className="text-3xl font-black mb-4">{match.title || match.sport}</h1>
        <div className="space-y-3 text-sm text-slate-600">
          <p><span className="font-bold">Sport:</span> {match.sport}</p>
          <p><span className="font-bold">Quando:</span> {new Date(match.datetime).toLocaleString('it-IT', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p><span className="font-bold">Dove:</span> {match.location}</p>
          <p><span className="font-bold">Partecipanti:</span> {match.current_players}/{match.max_players}</p>
        </div>

        {match.description && (
          <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-4 text-slate-700">
            <h2 className="text-lg font-bold mb-2">Descrizione</h2>
            <p className="text-sm leading-relaxed">{match.description}</p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="text-xl font-black mb-3">Per accedere a questa partita</h2>
        <p className="text-slate-700 mb-4">Devi essere registrato e usare l'app installata sul tuo dispositivo.</p>
        <ol className="list-decimal pl-5 space-y-3 text-slate-700">
          <li>Registrati o effettua il login.</li>
          <li>Installa l'app come Progressive Web App dalla schermata del browser.</li>
          <li>Ritorna a questo link per partecipare o vedere tutti i dettagli.</li>
        </ol>
        <div className="mt-6 space-y-3">
          <Link
            to="/login"
            className="block w-full text-center rounded-2xl bg-blue-600 py-3 text-white font-bold hover:bg-blue-700 transition-all"
          >
            Vai al login
          </Link>
          <Link
            to="/install-guide"
            className="block w-full text-center rounded-2xl border border-blue-600 py-3 text-blue-600 font-bold hover:bg-blue-100 transition-all"
          >
            Guida all'installazione
          </Link>
        </div>
      </div>
    </div>
  );
}
