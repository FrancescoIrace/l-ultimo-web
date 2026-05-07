import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from './lib/supabase';
import { usePushNotifications } from './hooks/usePushNotifications';
import Auth from './pages/Auth';
import CreateMatch from './pages/CreateMatch';
import FindFriends from './pages/FindFriends';
import Home from './pages/Home';
import NotFound from './pages/404';
import MatchDetail from './pages/MatchDetail';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import AppSettings from './pages/AppSettings';
import InstallGuide from './pages/InstallGuide';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PublicMatchLanding from './pages/PublicMatchLanding';
import WelcomeModal from './components/WelcomeModal';
import PWADashboard from './pages/PWADashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { NotificationBell } from './components/NotificationBell';
import { AlertProvider } from './components/AlertComponent';
import { usePWAMode } from './hooks/usePWAMode';
import BusinessDashboard from './pages/business/BusinessDashboard';
import GestisciCampi from './pages/business/GestisciCampi';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const navigate = useNavigate();
  const isPWA = usePWAMode();
  const { isSupported, isSubscribed, subscribeToPushNotifications } = usePushNotifications(session?.user?.id);

  const [userRole, setUserRole] = useState(null); // Nuovo stato per il ruolo

  useEffect(() => {
    // 1. Gestione Sessione Iniziale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    // 2. Ascolto Cambiamenti di Stato (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      if (!loading) setLoading(false); // Se non c'è sessione, smetti di caricare
      return;
    }

    // Recupero Dati Profilo (Avatar e Ruolo)
    supabase
      .from('profiles')
      .select('avatar_url, role')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setSession(prev => ({ ...prev, avatar_url: data.avatar_url }));
          setUserRole(data.role); // Imposta il ruolo dal DB
        } else {
          setUserRole('player'); // Fallback se il profilo non esiste
        }
        setLoading(false); // Ora il caricamento è davvero finito
      });
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id && localStorage.getItem('newUserRegistered') === 'true') {
      alert('👋 Benvenuto! Per la miglior esperienza, aggiungi l\'app alla tua home.');
      localStorage.removeItem('newUserRegistered');
    }

    if (session?.user?.id) {
      const today = new Date().toDateString();
      if (localStorage.getItem('lastWelcomeDay') !== today) {
        setShowWelcome(true);
        localStorage.setItem('lastWelcomeDay', today);
      }
    }
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-blue-600">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: [1, 1.1, 1], opacity: 1 }}
          transition={{ duration: 1, repeat: Infinity }}
          className="flex flex-col items-center"
        >
          <h1 className="text-5xl font-black tracking-tighter">L'ULTIMO</h1>
          <div className="mt-4 flex gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return (
      <AlertProvider>
        <Routes>
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/install-guide" element={<InstallGuide />} />
          <Route path="/match/:id" element={<PublicMatchLanding />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Auth />} />
        </Routes>
      </AlertProvider>
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
      <div className="w-full max-w-md mx-auto bg-slate-50 min-h-screen">
        <header className="bg-white border-b p-1 flex justify-between items-center sticky top-0 z-10">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 pl-4 cursor-pointer hover:scale-105 transition-transform">
            <h1 className="text-3xl font-black text-blue-600 tracking-tighter">L'ULTIMO</h1>
          </button>

          <div className="flex items-center gap-2">
            <NotificationBell userId={session.user.id} />

            {isSupported && !isSubscribed && (
              <button onClick={subscribeToPushNotifications} className="text-2xl active:scale-95 transition-transform">
                🔔
              </button>
            )}

            <button
              onClick={() => navigate('/profile')}
              className="mr-3 border-2 border-blue-600 rounded-full hover:bg-blue-50 transition-all overflow-hidden"
            >
              {session.avatar_url ? (
                <img src={session.avatar_url} alt="avatar" className="w-12 h-12 object-cover" />
              ) : (
                <div className="w-12 h-12 bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-600">
                  {session.user?.user_metadata?.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          </div>
        </header>

        <Routes>
          {/* 1. Rotta Home: Carica la dashboard corretta in base al ruolo */}
          <Route
            path="/"
            element={
              userRole === 'center' ? (
                <BusinessDashboard user={session.user} name={session.user.user_metadata.username} />
              ) : (
                <PWADashboard user={session.user} onLogout={() => setSession(null)} />
              )
            }
          />

          {/* 2. Rotte specifiche per il Centro Sportivo (Center) */}
          {userRole === 'center' && (
            <>
              <Route path="/gestisci-campi" element={<GestisciCampi centerId={session.user.id} />} />
              {/* Qui potrai aggiungere /gestisci-orari, /calendario-business, ecc. */}
            </>
          )}

          {/* 3. Rotte specifiche per il Giocatore (Player) */}
          {userRole === 'player' && (
            <>
              <Route path="/partite" element={<Home session={session} isPWA={false} />} />
              <Route path="/trova-amici" element={<FindFriends user={session.user} />} />
              <Route path="/organizza" element={<CreateMatch />} />
              <Route path="/modifica/:id" element={<CreateMatch />} />
            </>
          )}

          {/* 4. Rotte comuni sempre accessibili */}
          <Route path="/match/:id" element={<MatchDetail user={session.user} />} />
          <Route path="/profile" element={<Profile session={session} />} />
          <Route path="/settings" element={<AppSettings session={session} />} />
          <Route path="/profile/:id" element={<PublicProfile />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/install-guide" element={<InstallGuide />} />

          {/* 5. Fallback per pagine non trovate */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </AlertProvider>
  );
}

export default App;