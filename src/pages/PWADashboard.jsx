import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Zap, MapPin, UserPlus, User, LogOut, Puzzle, Trophy, Building2, ChevronRight, ClipboardClock, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useContext } from 'react';
import { motion } from 'framer-motion';
import { AlertContext } from '../components/AlertComponent';
import { InstagramEmbed } from './PagesUtils/utils';

export default function PWADashboard({ user, onLogout, isSupported, isSubscribed, subscribeToPushNotifications }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('LOADING'); // LOADING, ALREADY_PLAYED, PLAYING, RESULTS, ERROR
  const { showAlert } = useContext(AlertContext);
  const getCurrentDate = () => new Date().toISOString().split('T')[0];


  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout?.();
    navigate('/');
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
          console.log('Utente ha già giocato oggi');
        } else {
          setStatus('PLAYING');
          console.log('Utente non ha giocato oggi, pronto per giocare');
        }
      } catch (err) {
        console.error('Errore durante il caricamento del quiz:', err);
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
        <div className="grid grid-cols-2 gap-3 mt-6 relative">
          <button
            onClick={() => navigate('/organizza')}
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95"
          >
            <Zap size={24} />
            Organizza Match
          </button>

          <button
            onClick={() => navigate('/partite')}
            className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95"
          >
            <MapPin size={24} />
            Trova Partite
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95"
          >
            <User size={24} />
            Il Mio Profilo
          </button>

          <button
            onClick={() => navigate('/trova-amici')}
            className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95"
          >
            <UserPlus size={24} />
            Trova amici
          </button>

          <button
            onClick={() => navigate('/squadre')}
            className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95 w-full"
          >
            <Puzzle size={24} />
            Squadre
          </button>

          <button
            onClick={() => navigate('/')}
            disabled
            className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95 w-full"
          >
            <Trophy size={24} />
            Tornei
          </button>
        </div>

        {/* Centri Associati (Pannello Bottone) */}
        <div
          onClick={() => navigate('/centri')}
          className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-5 shadow-lg border border-teal-100 mt-4 text-white cursor-pointer hover:shadow-xl transition-all active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl">
                <Building2 size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide">Centri Associati</h3>
                <p className="text-xs text-white/80 mt-1">Scopri i nostri partner ufficiali</p>
              </div>
            </div>
            <ChevronRight size={24} className="text-white/80" />
          </div>
        </div>

        {/* Banner Gamification - Sfida Giornaliera */}
        {status === 'PLAYING' ? (
          <>
            <div
              onClick={() => navigate('/sfida')}
              className="mt-4 bg-gradient-to-r from-emerald-600 to-lime-600 rounded-2xl p-5 shadow-lg shadow-emerald-200 cursor-pointer hover:shadow-xl active:scale-95 transition-all overflow-hidden relative group"
            >
              {/* Sfondo decorativo */}
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>

              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner flex-shrink-0">
                  <ClipboardClock className="text-white drop-shadow-md" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-black text-lg leading-tight flex items-center gap-2">
                    Quiz del Giorno ⚡️
                  </h3>
                  <p className="text-emerald-50 text-sm font-medium mt-0.5 leading-snug">
                    Sblocca fino a <span className="bg-emerald-600/50 px-1.5 py-0.5 rounded text-white font-bold opacity-100">+ {'60'} pt</span> rispondendo a 3 domande flash!
                  </p>
                </div>
                <ChevronRight className="text-white flex-shrink-0 opacity-80 group-hover:translate-x-1 transition-transform" size={24} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              onClick={() => navigate('/leaderboard')}
              className="mt-4 bg-gradient-to-r from-red-600 to-yellow-600 rounded-2xl p-5 shadow-lg shadow-emerald-200 cursor-pointer hover:shadow-xl active:scale-95 transition-all overflow-hidden relative group"
            >
              {/* Sfondo decorativo */}
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>

              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner flex-shrink-0">
                  <Trophy className="text-white drop-shadow-md" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-black text-lg leading-tight flex items-center gap-2">
                    Visualizza la Classifica
                  </h3>
                  <p className="text-emerald-50 text-sm font-medium mt-0.5 leading-snug">
                    Hai già giocato oggi! Dai un'occhiata alla classifica e riprova domani!
                  </p>
                </div>
                <ChevronRight className="text-white flex-shrink-0 opacity-80 group-hover:translate-x-1 transition-transform" size={24} />
              </div>
            </div>
          </>
        )}

        {/* Banner Richiesta Sponsorizzazione */}
        <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 rounded-3xl p-4 shadow-lg border border-cyan-100 mt-4 text-white">
          <div className="flex items-start gap-4">
            {/* <div className="flex-none rounded-3xl bg-white/10 p-3">
              <span className="text-xs uppercase tracking-[0.1em] font-bold text-white/80">Banner Pubblicitario</span>
            </div> */}
            <div className="min-w-0">
              <p className="font-bold text-sm">In cerca di Pubblicità?</p>
              <p className="text-xs text-white/80 mt-1">Contattaci per sponsorizzare la tua attività e raggiungere nuovi utenti!</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${String(3285816683).startsWith('39') ? String(3285816683) : '39' + String(3285816683)}?text=Ciao%20L%27ultimo,%20siamo%20interessati%20a%20sponsorizzare%20la%20nostra%20attivit%C3%A0.`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center justify-center rounded-full sm:w-auto bg-[#25D366] text-white flex items-center justify-center gap-2 px-5 py-3 md:px-6 md:py-3.5 rounded-xl font-bold shadow-lg shadow-[#25D366]/30 active:scale-95 transition-all text-sm md:text-base hover:bg-[#20bd5a]"
          >
            <MessageCircle size={20} className="md:w-6 md:h-6" /> Invia un Messaggio
          </a>
        </div>

        {/* Banner Feedback */}
        <div className="bg-fuchsia-500 rounded-3xl p-4 shadow-lg border border-cyan-100 mt-4 text-white">
          <div className="flex items-start gap-4">
            {/* <div className="flex-none rounded-3xl bg-white/10 p-3">
              <span className="text-xs uppercase tracking-[0.1em] font-bold text-white/80">Feedback</span>
            </div> */}
            <div className="min-w-0">
              <p className="font-bold text-sm">Hai dei suggerimenti?</p>
              <p className="text-xs text-white/80 mt-1">Facci sapere cosa ne pensi della nostra app e come possiamo migliorare!</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${String(3285816683).startsWith('39') ? String(3285816683) : '39' + String(3285816683)}?text=Ciao%20L%27ultimo,%20abbiamo%20dei%20suggerimenti%20per%20la%20tua%20app.`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center justify-center rounded-full sm:w-auto bg-[#25D366] text-white gap-2 px-5 py-3 md:px-6 md:py-3.5 rounded-xl font-bold shadow-lg shadow-[#25D366]/30 active:scale-95 transition-all text-sm md:text-base hover:bg-[#20bd5a]"
          >
            <MessageCircle size={20} className="md:w-6 md:h-6" /> Invia un Messaggio
          </a>
        </div>


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
    </div>
  );
}
