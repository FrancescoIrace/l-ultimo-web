import { useNavigate } from 'react-router-dom';
import { Zap, MapPin, UserPlus, User, LogOut,Trophy, Puzzle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PWADashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout?.();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">

      {/* Main Content */}
      <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mt-6">
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
            onClick={() => navigate('/')}
            className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95"
          >
            <Puzzle size={24} />
            La tua squadra
          </button>

          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95"
          >
            <Trophy size={24} />
            Tornei
          </button>
        </div>

        {/* Info Section */}
        {/* <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mt-8">
          <h2 className="font-bold text-slate-800 mb-3">🚀 App Installata</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Stai utilizzando L'Ultimo come app nativa. La dashboard PWA ti permette accesso veloce a tutte le funzioni senza aprire il browser!
          </p>
        </div> */}

        {/* Banner esempio 1 */}
        <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 rounded-3xl p-4 shadow-lg border border-cyan-100 mt-4 text-white">
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
        </div>

        {/* Banner esempio 2 */}
        <div className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 rounded-3xl p-4 shadow-lg border border-yellow-100 mt-4 text-white">
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
            onClick={() => window.open('https://www.google.com/maps/search/?api=1&query=45.4642%2C9.1900', '_blank')}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-white text-slate-900 px-4 py-2 text-xs font-semibold shadow-sm hover:bg-slate-100 transition"
          >
            Apri in Maps
          </button>
        </div>

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
    </div>
  );
}
