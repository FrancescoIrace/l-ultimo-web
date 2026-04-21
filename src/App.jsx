import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate,Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import CreateMatch from './pages/CreateMatch';
import FindFriends from './pages/FindFriends';
import Home from './pages/Home';
import NotFound from './pages/404';
import MatchDetail from './pages/MatchDetail';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import AppSettings from './pages/AppSettings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import WelcomeModal from './components/WelcomeModal';
import PWADashboard from './pages/PWADashboard';
import { AlertProvider } from './components/AlertComponent';
import { usePWAMode } from './hooks/usePWAMode';

function App() {
  const [session, setSession] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const navigate = useNavigate();
  const isPWA = usePWAMode();

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
    // setShowWelcome(true);

    // Mostra il welcome modal una volta al giorno
    if (!session?.user?.id) return;

    const today = new Date().toDateString();
    const lastWelcomeDay = localStorage.getItem('lastWelcomeDay');

    // Se è un nuovo giorno o non è mai stato mostrato, mostra il modal
    if (lastWelcomeDay !== today) {
      setShowWelcome(true);
      localStorage.setItem('lastWelcomeDay', today);
    }
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



  // Se non c'è sessione, mostra Auth e consenti l'accesso alla privacy policy
  if (!session) {
    return (
      <Routes>
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/signup" element={<Auth />} />
        <Route path="/login" element={<Auth />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  return (
    <AlertProvider>
      {showWelcome && (
        <WelcomeModal 
          onClose={() => setShowWelcome(false)}
          username={session.user?.user_metadata?.username || 'Giocatore'}
        />
      )}
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"></meta>
      <div className="w-full max-w-md mx-auto bg-slate-50">
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
          <Route path="/" element={<Home session={session} isPWA={isPWA} />} />
          <Route path="/partite" element={<Home session={session} isPWA={false} />} />
          <Route path="/organizza" element={<CreateMatch />} />

          <Route path="/modifica/:id" element={<CreateMatch />} />

          <Route path="/match/:id" element={<MatchDetail user={session.user} />} />

          <Route path="/profile" element={<Profile session={session} />} />
          <Route path="/settings" element={<AppSettings session={session} />} />

          <Route path="/profile/:id" element={<PublicProfile />} />

          <Route path="/trova-amici" element={<FindFriends user={session.user} />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/demo-pwa" element={<PWADashboard user={session.user} onLogout={() => setSession(null)} />} />
          <Route path="/PWADashboard" element={<PWADashboard user={session.user} onLogout={() => setSession(null)} />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </AlertProvider>
  );
}

export default App;