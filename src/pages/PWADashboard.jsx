import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Zap, MapPin, UserPlus, User, LogOut, Puzzle, Trophy, Building2, ChevronRight, ClipboardClock, MessageCircle,Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useContext } from 'react';
import { motion } from 'framer-motion';
import { AlertContext } from '../components/AlertComponent';
import { InstagramEmbed } from './PagesUtils/utils';

export default function PWADashboard({ user, onLogout, isSupported, isSubscribed, subscribeToPushNotifications }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('LOADING'); // LOADING, ALREADY_PLAYED, PLAYING, RESULTS, ERROR
  const { showAlert } = useContext(AlertContext);
  const [isTorneiNotReady, setIsTorneiNotReady] = useState(false);
  const getCurrentDate = () => new Date().toISOString().split('T')[0];


  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout?.();
    navigate('/');
  };

  const handleTorneiClick = () => {
    if (isTorneiNotReady) return; // Evita click ripetuti se è già attivo

    setIsTorneiNotReady(true);

    // Dopo 1 secondo (1000 millisecondi) torna come prima
    setTimeout(() => {
      setIsTorneiNotReady(false);
    }, 1000);
  };

  const handleActivateNotifications = async () => {
    try {
      const result = await subscribeToPushNotifications();
      if (result.success) {
        showAlert('✅ Notifiche push attivate!', 'success');
      } else {
        showAlert('❌ Errore: ' + result.error, 'error');
      }
    } catch (error) {
      showAlert('❌ Errore: ' + error.message, 'error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const todayDateStr = getCurrentDate();

        // 1. Check record su daily_game_attempts
        const { data: attempt, error: attemptError } = await supabase
          .from('daily_game_attempts')
          .select('id')
          .eq('user_id', user.id)
          .eq('played_at', todayDateStr)
          .maybeSingle();

        if (attemptError) throw attemptError;

        if (attempt) {
          setStatus('ALREADY_PLAYED');
          // console.log('Utente ha già giocato oggi');
        } else {
          setStatus('PLAYING');
          // console.log('Utente non ha giocato oggi, pronto per giocare');
        }
      } catch (err) {
        console.error('Errore durante il caricamento del quiz:', err);
        setStatus('ERROR');
      }
    };

    fetchData();
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">

      {/* Main Content */}
      <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
        {/* Notification Activation Box */}
        {isSupported && !isSubscribed && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-2xl shadow-lg border border-blue-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🔔</div>
                <div>
                  <h3 className="font-bold text-sm">Attiva Notifiche Push</h3>
                  <p className="text-xs opacity-90">Ricevi aggiornamenti sui tuoi match in tempo reale</p>
                </div>
              </div>
              <button
                onClick={handleActivateNotifications}
                className="bg-white text-blue-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors active:scale-95"
              >
                Attiva
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 p-4">
          <button
            onClick={() => navigate('/organizza')}
            className="flex flex-col items-center justify-center h-28 bg-blue-600 rounded-2xl shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <Zap size={24} className="text-white w-6 h-6" />
            <span className="text-sm font-bold text-white mt-2">Organizza Match</span>
          </button>

          <button
            onClick={() => navigate('/partite')}
            className="flex flex-col items-center justify-center h-28 bg-white border border-gray-100 rounded-2xl shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <MapPin size={24} className="text-blue-600 w-6 h-6" />
            <span className="text-slate-800 font-semibold text-sm mt-2">Trova Partite</span>
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center justify-center h-28 bg-white border border-gray-100 rounded-2xl shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <User size={24} className="text-blue-600 w-6 h-6" />
            <span className="text-slate-800 font-semibold text-sm mt-2">Il Mio Profilo</span>
          </button>

          <button
            onClick={() => navigate('/trova-amici')}
            className="flex flex-col items-center justify-center h-28 bg-white border border-gray-100 rounded-2xl shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <UserPlus size={24} className="text-blue-600 w-6 h-6" />
            <span className="text-slate-800 font-semibold text-sm mt-2">Trova amici</span>
          </button>

          <button
            onClick={() => navigate('/squadre')}
            className="flex flex-col items-center justify-center h-28 bg-white border border-gray-100 rounded-2xl shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <Puzzle size={24} className="text-blue-600 w-6 h-6" />
            <span className="text-slate-800 font-semibold text-sm mt-2">Squadre</span>
          </button>

          <button
            onClick={handleTorneiClick}
            className={`flex flex-col items-center justify-center h-28 rounded-2xl border transition-all duration-300 cursor-pointer active:scale-95 ${isTorneiNotReady
              ? "bg-slate-100 border-slate-200 shadow-none text-slate-400"
              : "bg-white border-gray-100 shadow-sm"
              }`}
          >
            {/* Se è cliccato nascondiamo l'icona e mostriamo solo il testo centrato */}
            {!isTorneiNotReady ? (
              <>
                <Trophy className="text-blue-600 w-6 h-6" />
                <span className="text-slate-800 font-semibold text-sm mt-2 transition-all">
                  Tornei
                </span>
              </>
            ) : (
              <>
                <Loader className="text-blue-600 w-6 h-6" />
                <span className="text-slate-800 font-semibold text-sm mt-2 transition-all">
                  Prossimamente
                </span>
              </>
            )}
          </button>
        </div>

        {/* Centri Associati (Pannello Bottone) */}
        <div
          onClick={() => navigate('/centri')}
          className="group flex items-center justify-between p-4 mx-4 my-2 bg-white border border-gray-100 rounded-2xl shadow-md cursor-pointer active:scale-[0.99] transition-transform duration-200"
        >
          {/* Blocco di sinistra: Icona + Testi */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors duration-200">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-base">Centri Associati</h3>
              <p className="text-slate-500 text-xs mt-0.5">Scopri i nostri partner ufficiali</p>
            </div>
          </div>

          {/* Freccia a destra: spinta fuori grazie al justify-between del padre */}
          <ChevronRight
            size={22}
            className="text-slate-400 flex-shrink-0 group-hover:text-slate-600 group-hover:translate-x-1 transition-all duration-200"
          />
        </div>

        {/* Banner Gamification - Sfida Giornaliera */}
        {status === 'PLAYING' ? (
          <>
            <div
              onClick={() => navigate('/sfida')}
              className="group relative overflow-hidden flex items-center justify-between p-5 mx-4 my-2 bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl shadow-md cursor-pointer active:scale-[0.99] transition-transform duration-200"
            >
              {/* Sfondo decorativo di luce sfocata */}
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none"></div>

              <div className="flex items-center gap-4 relative z-10 w-full">
                {/* Contenitore Icona Orologio/Quiz */}
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner flex-shrink-0">
                  <ClipboardClock className="text-amber-400 drop-shadow-md" size={24} />
                </div>

                {/* Testi e Badge Punti */}
                <div className="flex-1">
                  <h3 className="text-white font-black text-md leading-tight flex items-center gap-2 mb-3">
                    Quiz del Giorno ⚡️<br /> Mondiali 2026 🏆
                  </h3>
                  <p className="text-indigo-100/90 text-xs font-medium mt-1 leading-snug">
                    Sblocca fino a <span className="bg-white/20 px-1.5 py-0.5 rounded text-amber-300 font-bold border border-white/10">+60 pt</span> rispondendo a 3 domande flash!
                  </p>
                </div>

                {/* Freccetta d'azione */}
                <ChevronRight
                  className="text-white flex-shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200"
                  size={22}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              onClick={() => navigate('/leaderboard')}
              className="group relative overflow-hidden flex items-center justify-between p-5 mx-4 my-2 bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl shadow-md cursor-pointer active:scale-[0.99] transition-transform duration-200"
            >
              {/* Sfondo decorativo di luce sfocata */}
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500 pointer-events-none"></div>

              <div className="flex items-center gap-4 relative z-10 w-full">
                {/* Contenitore Icona Coppa */}
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner flex-shrink-0">
                  <Trophy className="text-amber-400" size={24} />
                </div>

                {/* Testi */}
                <div className="flex-1">
                  <h3 className="text-white font-black text-lg leading-tight">
                    Visualizza la Classifica
                  </h3>
                  <p className="text-indigo-100/90 text-xs font-medium mt-1 leading-snug">
                    Hai già giocato oggi! Dai un'occhiata alla classifica e riprova domani!
                  </p>
                </div>

                {/* Freccetta d'azione */}
                <ChevronRight
                  className="text-white flex-shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200"
                  size={22}
                />
              </div>
            </div>
          </>
        )}

        {/* Banner Richiesta Sponsorizzazione */}
        <a
          href={`https://wa.me/393285816683?text=Ciao%20L%27ultimo,%20siamo%20interessati%20a%20sponsorizzare%20la%20nostra%20attivit%C3%A0.`}
          target="_blank"
          rel="noreferrer"
          className="group relative flex items-center justify-between p-5 mx-4 my-2 bg-gradient-to-r from-sky-400 to-blue-500 rounded-2xl shadow-md active:scale-[0.99] transition-transform duration-200"
        >
          <div className="flex items-center gap-4 max-w-[85%]">
            <div className="flex flex-col">
              <p className="text-white font-bold text-base">In cerca di Pubblicità?</p>
              <p className="text-sky-50 text-xs mt-1 leading-relaxed">
                Contattaci per sponsorizzare la tua attività e raggiungere nuovi utenti!
              </p>
            </div>
          </div>

          <ChevronRight
            className="text-white flex-shrink-0 opacity-75 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200"
            size={22}
          />
        </a>

        {/* Banner Feedback */}
        <a
          href={`https://wa.me/393285816683?text=Ciao%20L%27ultimo,%20abbiamo%20dei%20suggerimenti%20per%20la%20tua%20app.`}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center justify-between p-5 mx-4 my-2 bg-white border border-gray-100 rounded-2xl shadow-md active:scale-[0.99] transition-transform duration-200"
        >
          <div className="flex items-center gap-4 max-w-[85%]">
            {/* Icona WhatsApp / Messaggio per dare un tocco di colore nativo */}
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors duration-200 flex-shrink-0">
              <MessageCircle size={22} />
            </div>
            <div className="flex flex-col">
              <p className="text-slate-900 font-bold text-sm">Hai dei suggerimenti?</p>
              <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                Facci sapere cosa ne pensi della nostra app e come possiamo migliorare!
              </p>
            </div>
          </div>

          <ChevronRight
            className="text-slate-400 flex-shrink-0 group-hover:text-slate-600 group-hover:translate-x-1 transition-all duration-200"
            size={22}
          />
        </a>


        {/* Banner esempio 1 */}
        {/* <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 rounded-3xl p-4 shadow-lg border border-cyan-100 mt-4 text-white">
          <div className="flex items-start gap-4">
            <div className="flex-none rounded-3xl bg-white/10 p-3">
              <span className="text-xs uppercase tracking-[0.2em] font-bold text-white/80">Sponsorizzato</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm">Nuove scarpe da calcetto</p>
              <p className="text-xs text-white/80 mt-1">Sconto 20% per utenti PWA: comfort e grip perfetto per ogni partita.</p>
            </div>
          </div>
          <button
            onClick={() => window.open('https://www.example.com', '_blank')}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-white text-slate-900 px-4 py-2 text-xs font-semibold shadow-sm hover:bg-slate-100 transition"
          >
            Scopri l'offerta
          </button>
        </div> */}

        {/* Banner esempio 2 */}
        {/* <div className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 rounded-3xl p-4 shadow-lg border border-yellow-100 mt-4 text-white">
          <div className="flex items-start gap-4">
            <div className="flex-none rounded-3xl bg-white/10 p-3">
              <span className="text-xs uppercase tracking-[0.2em] font-bold text-white/80">Sponsorizzato</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm">Fame post partita?</p>
              <p className="text-xs text-white/80 mt-1">Corri a mangiare il Panino da *Nome Paninoteca*</p>
            </div>
          </div>
          <button
            onClick={() => window.open('https://www.google.com/maps/search/?api=1&query=40.8161%2C14.3398', '_blank')}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-white text-slate-900 px-4 py-2 text-xs font-semibold shadow-sm hover:bg-slate-100 transition"
          >
            Apri in Maps
          </button>
        </div> */}

      </div>



      {/* NEWS */}
      {/* <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 rounded-3xl p-4 shadow-lg border border-cyan-100 mt-4 text-white">
          <InstagramEmbed />
        </div> */}

      {/* Stats */}
      {/* <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-2xl p-3 text-center border border-blue-100">
            <p className="text-2xl font-black text-blue-600">5</p>
            <p className="text-xs text-slate-600 mt-1">Partite</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
            <p className="text-2xl font-black text-green-600">4.2</p>
            <p className="text-xs text-slate-600 mt-1">Voto</p>
          </div>
          <div className="bg-purple-50 rounded-2xl p-3 text-center border border-purple-100">
            <p className="text-2xl font-black text-purple-600">12</p>
            <p className="text-xs text-slate-600 mt-1">Amici</p>
          </div>
        </div> */}

      {/* Recent Activity */}
      {/* <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">📅 Prossime Partite</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <div>
                <p className="font-bold text-sm text-slate-800">Calcetto</p>
                <p className="text-xs text-slate-600">Domani 18:00</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">Confermato</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <div>
                <p className="font-bold text-sm text-slate-800">Padel</p>
                <p className="text-xs text-slate-600">Mer 19:30</p>
              </div>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">In attesa</span>
            </div>
          </div>
        </div> */}
    </div >
  );
}
