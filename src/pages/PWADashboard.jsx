import { useNavigate } from 'react-router-dom';
import { Zap, MapPin, Trophy, User, LogOut } from 'lucide-react';
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
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-b-3xl shadow-lg">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-black">L'ULTIMO</h1>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-blue-600 overflow-hidden">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                user?.email?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            <div>
              <p className="font-bold text-lg">{user?.user_metadata?.username || 'User'}</p>
              <p className="text-blue-100 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

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
            onClick={() => navigate('/')}
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
            onClick={() => navigate('/leaderboard')}
            className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95"
          >
            <Trophy size={24} />
            Classifica
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mt-8">
          <h2 className="font-bold text-slate-800 mb-3">🚀 App Installata</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Stai utilizzando L'Ultimo come app nativa. La dashboard PWA ti permette accesso veloce a tutte le funzioni senza aprire il browser!
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
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
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
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
        </div>
      </div>
    </div>
  );
}
