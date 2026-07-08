import { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from './lib/supabase';
import Loader from './components/Loader';
import { usePushNotifications } from './hooks/usePushNotifications';
import PWAInstallBanner from './components/PWAInstallBanner';
import { NotificationBell } from './components/NotificationBell';
import { AlertProvider } from './components/AlertComponent';
import { usePWAMode } from './hooks/usePWAMode';

// Ogni pagina viene scaricata solo quando l'utente ci naviga davvero,
// invece di finire tutta nel bundle iniziale (erano 33 pagine in un
// unico chunk da 1MB+ anche solo per vedere la schermata di login).
const Auth = lazy(() => import('./pages/Auth'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const CreateMatch = lazy(() => import('./pages/CreateMatch'));
const FindFriends = lazy(() => import('./pages/FindFriends'));
const FriendRequests = lazy(() => import('./pages/FriendRequests'));
const MyMatches = lazy(() => import('./pages/MyMatches'));
const UserReviews = lazy(() => import('./pages/UserReviews'));
const Home = lazy(() => import('./pages/Home'));
const NotFound = lazy(() => import('./pages/404'));
const MatchDetailV2 = lazy(() => import('./pages/MatchDetailV2'));
const Profile = lazy(() => import('./pages/Profile'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const AppSettings = lazy(() => import('./pages/AppSettings'));
const InstallGuide = lazy(() => import('./pages/InstallGuide'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const CommunityGuidelines = lazy(() => import('./pages/CommunityGuidelines'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PublicMatchLanding = lazy(() => import('./pages/PublicMatchLanding'));
const PWADashboard = lazy(() => import('./pages/PWADashboard'));
const CentersList = lazy(() => import('./pages/CentersList'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const BusinessDashboard = lazy(() => import('./pages/business/BusinessDashboard'));
const GestisciCampi = lazy(() => import('./pages/business/GestisciCampi'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const TeamDetail = lazy(() => import('./pages/TeamDetail'));
const SfidaGiornaliera = lazy(() => import('./components/SfidaGiornaliera'));
const ClassificaMinigame = lazy(() => import('./components/ClassificaMinigame'));

function RouteLoader() {
  return <Loader variant="page" label={null} />;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [splashElapsed, setSplashElapsed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const navigate = useNavigate();
  const isPWA = usePWAMode();
  const { isSupported, isSubscribed, subscribeToPushNotifications } = usePushNotifications(session?.user?.id);

  const [userRole, setUserRole] = useState(null); // Nuovo stato per il ruolo

  // Durata minima dello splash: anche se la sessione/il profilo sono già
  // pronti prima, l'animazione della "U" resta visibile per intero invece
  // di sparire a metà.
  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), 1700);
    return () => clearTimeout(timer);
  }, []);

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

  if (loading || !splashElapsed) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white text-blue-600 overflow-hidden">
        <motion.h1
          initial={{ scale: 0.1, opacity: 1 }}
          animate={{ scale: [0.1, 1.15, 3, 5], opacity: [1, 1, 1, 0] }}
          transition={{ duration: 1.6, times: [0, 0.4, 0.75, 1], ease: ['easeOut', 'easeIn', 'easeIn'] }}
          className="text-[7rem] leading-none font-black tracking-tighter"
        >
          U
        </motion.h1>
        <motion.p
          initial={{ scale: 0.9, opacity: 0.7 }}
          animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-6 text-sm font-bold uppercase tracking-widest text-blue-600"
        >
          Caricamento...
        </motion.p>
      </div>
    );
  }

  if (!session) {
    return (
      <AlertProvider>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={isPWA ? <Auth /> : <LandingPage />} />
            <Route path="/accedi" element={<Auth />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/community-guidelines" element={<CommunityGuidelines />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/install-guide" element={<InstallGuide />} />
            <Route path="/match/:id" element={<PublicMatchLanding />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Auth />} />
          </Routes>
        </Suspense>
      </AlertProvider>
    );
  }

  return (
    <AlertProvider>
      {/* {showWelcome && (
        <WelcomeModal
          onClose={() => setShowWelcome(false)}
          username={session.user?.user_metadata?.username || 'Giocatore'}
        />
      )} */}
      {/* QUESTO COMPONENTE NON CI SARA' PIU' QUANDO L'APP SI TROVERA' SUL PLAY STORE */}
      <PWAInstallBanner />
      <div className={`w-full mx-auto bg-slate-50 min-h-screen ${userRole === 'center' ? '' : 'max-w-md'}`}>
        <header className="bg-white border-blue-400 border-b-2 p-1 flex justify-between items-center sticky top-0 z-50">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 pl-4 cursor-pointer hover:scale-105 transition-transform">
            <h1 className="text-4xl font-black text-blue-600 tracking-tighter flex items-center">
                L'ULTIMO
                {userRole === 'center' && (
                  <span className="text-sm ml-2 bg-blue-600 text-white px-2.5 py-0.5 rounded-lg align-middle inline-block font-bold tracking-normal">BUSINESS</span>
                )}
            </h1>
          </button>

          <div className="flex items-center gap-2">
            <NotificationBell userId={session.user.id} />

            <button
              onClick={() => navigate('/profile')}
              className="mr-3 border-2 border-blue-600 rounded-full hover:bg-blue-50 transition-all overflow-hidden"
            >
              {session.avatar_url ? (
                <img src={session.avatar_url} alt="avatar" referrerPolicy="no-referrer" className="w-12 h-12 object-cover" />
              ) : (
                <div className="w-12 h-12 bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-600">
                  {session.user?.user_metadata?.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          </div>
        </header>

        <Suspense fallback={<RouteLoader />}>
          <Routes>
            {/* 1. Rotta Home: Carica la dashboard corretta in base al ruolo */}
            <Route
              path="/"
              element={
                userRole === 'center' ? (
                  <BusinessDashboard
                    user={session.user}
                    name={session.user.user_metadata.username}
                    isSupported={isSupported}
                    isSubscribed={isSubscribed}
                    subscribeToPushNotifications={subscribeToPushNotifications}
                    isPWA={isPWA}
                  />
                ) : (
                  <PWADashboard
                    user={session.user}
                    onLogout={() => setSession(null)}
                    isSupported={isSupported}
                    isSubscribed={isSubscribed}
                    subscribeToPushNotifications={subscribeToPushNotifications}
                    isPWA={isPWA}
                  />
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
                <Route path="/richieste-amici" element={<FriendRequests user={session.user} />} />
                <Route path="/le-mie-partite" element={<MyMatches session={session} />} />
                <Route path="/recensioni" element={<UserReviews session={session} />} />
                <Route path="/recensioni/:id" element={<UserReviews session={session} />} />
                <Route path="/organizza" element={<CreateMatch />} />
                <Route path="/modifica/:id" element={<CreateMatch />} />
                <Route path="/squadre" element={<TeamsPage session={session} />} />
                <Route path="/squadre/:id" element={<TeamDetail session={session} />} />
                <Route path="/centri" element={<CentersList />} />
                <Route path="/sfida" element={<SfidaGiornaliera />} />
                <Route path="/leaderboard" element={<ClassificaMinigame />} />

              </>
            )}

            {/* 4. Rotte comuni sempre accessibili */}
            <Route path="/match/:id" element={<MatchDetailV2 user={session.user} />} />
            <Route path="/profile" element={<Profile session={session} />} />
            <Route path="/settings" element={<AppSettings session={session} />} />
            <Route path="/admin" element={<AdminDashboard session={session} />} />
            <Route path="/profile/:id" element={<PublicProfile />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/community-guidelines" element={<CommunityGuidelines />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/install-guide" element={<InstallGuide />} />

            {/* 5. Fallback per pagine non trovate */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </div>
    </AlertProvider>
  );
}

export default App;