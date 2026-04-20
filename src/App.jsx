import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Plus, CircleUser,Loader } from 'lucide-react';
import Auth from './pages/Auth';
import MatchCard from './components/MatchCard';
import CreateMatch from './pages/CreateMatch';
import MatchSkeleton from './components/MatchSkeleton';
import NotFound from './pages/404';
import MatchDetail from './pages/MatchDetail';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import WelcomeModal from './components/WelcomeModal';

function App() {
  const [session, setSession] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const navigate = useNavigate();

  // 1. Definiamo fetchMatches fuori dagli useEffect così è usabile ovunque
  async function fetchMatches() {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('datetime', { ascending: true });

    if (error) { console.error('Errore:', error); }
    else {
      setMatches(data);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.user?.id) return;

    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) {
          setSession(prev => ({ ...prev, avatar_url: data.avatar_url }));
        }
      });
  }, [session?.user?.id]);

  useEffect(() => {
    // Mostra alert per i nuovi registrati al primo accesso
    if (session?.user?.id && localStorage.getItem('newUserRegistered') === 'true') {
      alert('👋 Benvenuto! Per la miglior esperienza con l\'app, ti consigliamo di salvarla sulla homepage del tuo smartphone.\n\n📱 Su iPhone: Premi il bottone Condividi → Aggiungi alla schermata iniziale\n\n🤖 Su Android: Premi il menù (≡) → Installa app');
      localStorage.removeItem('newUserRegistered');
    }
  }, [session?.user?.id]);

  useEffect(() => {
    //DEBUG: mostra il welcome modal a ogni accesso (per testarlo)
    setShowWelcome(true);

    // Mostra il welcome modal una volta al giorno
    // if (!session?.user?.id) return;

    // const today = new Date().toDateString();
    // const lastWelcomeDay = localStorage.getItem('lastWelcomeDay');

    // // Se è un nuovo giorno o non è mai stato mostrato, mostra il modal
    // if (lastWelcomeDay !== today) {
    //   setShowWelcome(true);
    //   localStorage.setItem('lastWelcomeDay', today);
    // }
  }, [session?.user?.id]);

  useEffect(() => {
    // Gestione Sessione
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Caricamento partite quando la sessione è disponibile
    if (!session?.user?.id) return;

    // Caricamento iniziale
    fetchMatches();

    // Realtime subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // Se non c'è sessione, mostra Auth
  if (!session) {
    return <Auth />;
  }

  return (
    <>
      {showWelcome && (
        <WelcomeModal 
          onClose={() => setShowWelcome(false)}
          username={session.user?.user_metadata?.username || 'Giocatore'}
        />
      )}
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"></meta>
      <div className="w-full max-w-md mx-auto px-4 bg-slate-50">
        <header className="bg-white border-b p-1 flex justify-between items-center sticky top-0 z-10">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 pl-4 cursor-pointer hover:scale-105 transition-transform active:scale-95">
            <h1 className="text-3xl font-black text-blue-600 tracking-tighter">L'ULTIMO</h1>
            {/* <h1 className="text-2xl font-black text-green-600 tracking-tighter">InCampo</h1> */}
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="mr-3 text-blue-500 font-bold border border-blue-600 border-2 rounded-full hover:bg-blue-50 active:scale-95 transition-all ease-in-out"
          >
            {/* <CircleUser size={76} strokeWidth={1.75} /> */}
            <div className="">
              {session.avatar_url ? (
                <img src={session.avatar_url} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-semibold text-slate-600">
                  {session.user?.user_metadata?.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </button>

          {/* <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-red-500 font-bold border border-red-200 px-3 py-1 rounded-full hover:bg-red-50"
        >
          LOGOUT
        </button> */}
        </header>

        <Routes>
          <Route path="/" element={
            <main className="max-w-md mx-auto p-4 pb-24 bg-slate-100">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Partite vicino a te
              </h2>

              {loading ? (
                <div className="grid gap-4">
                  {/* Ne mostriamo 3 o 4 per riempire la pagina */}
                  {[1, 2, 3].map(n => <MatchSkeleton key={n} />)}
                </div>
              ) : (
                <div className="grid gap-4">
                  {matches.length > 0 ? (
                    matches.map(match => <MatchCard key={match.id} match={match} user={session.user} />)
                  ) : (
                    <>
                      <p className="text-center text-slate-500 mt-10">Nessuna partita trovata. Creane una tu!</p>

                      <button
                        disabled={loading}
                        onClick={() => navigate('/organizza')}
                        className="w-full cursor-pointer bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {loading ? 'Caricamento...' : 'Organizza una partita'}
                      </button>


                    </>
                  )}
                </div>
              )}


              {/* Floating Action Button */}
              <button
                onClick={() => navigate('/organizza')}
                className="fixed bottom-6 right-6 w-[80px] h-20 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center font-light hover:bg-blue-700 transition-transform active:scale-90 cursor-pointer"
              >
                <Plus size={60} strokeWidth={2.5} className='active:animate-spin' />
              </button>

            </main>
          } />
          <Route path="/organizza" element={<CreateMatch />} />

          <Route path="/modifica/:id" element={<CreateMatch />} />

          <Route path="/match/:id" element={<MatchDetail user={session.user} />} />

          <Route path="/profile" element={<Profile session={session} />} />

          <Route path="/profile/:id" element={<PublicProfile />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  );
}

export default App;