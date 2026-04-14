import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import MatchCard from './components/MatchCard'; // Assicurati che l'import sia corretto

function App() {
  const [session, setSession] = useState(null);
  const [matches, setMatches] = useState([]); // Stato per le partite
  const [loading, setLoading] = useState(true); // Stato per il caricamento

  useEffect(() => {
    // 1. Gestione Sessione
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // 2. Recupero Partite dal Database
    async function fetchMatches() {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('datetime', { ascending: true });
      
      if (error) console.error('Errore caricamento partite:', error);
      else setMatches(data);
      setLoading(false);
    }

    fetchMatches();

    return () => subscription.unsubscribe();
  }, []);

  // Se non c'è sessione, mostra Auth
  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-10">
        {/* <h1 className="text-2xl font-black text-blue-600 tracking-tighter">L'ULTIMO</h1> */}
        <h1 className="text-2xl font-black text-green-600 tracking-tighter">InCampo</h1>
        <button 
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-red-500 font-bold border border-red-200 px-3 py-1 rounded-full hover:bg-red-50"
        >
          LOGOUT
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Partite vicino a te
        </h2>
        
        {loading ? (
          <p className="text-center text-slate-400 mt-10">Caricamento partite...</p>
        ) : (
          <div className="grid gap-4">
            {matches.length > 0 ? (
              matches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))
            ) : (
              <p className="text-center text-slate-500 mt-10">Nessuna partita trovata. Creane una tu!</p>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-light hover:bg-blue-700 transition-transform active:scale-95">
        +
      </button>
    </div>
  );
}

export default App;