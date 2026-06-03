import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, ChevronLeft, MapPin, Loader, Crown } from 'lucide-react';

export default function ClassificaMinigame() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Recuperiamo i top 50 utenti per punti totali
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, location, total_points')
        .eq('role', 'player')
        .order('total_points', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (err) {
      console.error("Errore fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (index) => {
    switch (index) {
      case 0: return <Crown className="text-yellow-400 fill-yellow-400" size={24} />;
      case 1: return <Medal className="text-slate-400" size={24} />;
      case 2: return <Medal className="text-amber-600" size={24} />;
      default: return <span className="text-slate-400 font-black w-6 text-center">{index + 1}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-slate-500 font-medium">Caricamento campioni...</p>
      </div>
    );
  }

  const myPosition = leaderboard.findIndex(u => u.id === currentUser?.id);
  const myData = myPosition !== -1 ? leaderboard[myPosition] : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Fisso */}
      <div className="bg-white px-4 py-4 mb-4 border-b border-slate-200 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-slate-400 active:scale-90 transition-transform">
          <ChevronLeft size={28} />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Classifica <Trophy className="text-yellow-500" size={20} />
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Top 3 Giocatori</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full">
        {/* Podio (Top 3) */}
        {leaderboard.length >= 3 && (
          <div className="flex items-end justify-center gap-4 mb-10 mt-4 px-2">
            {/* Secondo Posto */}
            <div className="flex flex-col items-center flex-1">
              <div className="relative mb-2">
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 overflow-hidden bg-white shadow-lg">
                  <img src={leaderboard[1].avatar_url || `https://ui-avatars.com/api/?name=${leaderboard[1].username}`} alt="2nd" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-white">2</div>
              </div>
              <p className="text-xs font-black text-slate-700 truncate w-20 text-center">{leaderboard[1].username}</p>
              <p className="text-[10px] font-bold text-blue-600">{leaderboard[1].total_points} PT</p>
            </div>

            {/* Primo Posto */}
            <div className="flex flex-col items-center flex-1 -mt-6">
              <div className="relative mb-2">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <Crown className="text-yellow-400 fill-yellow-400 animate-bounce" size={32} />
                </div>
                <div className="w-20 h-20 rounded-full border-4 border-yellow-400 overflow-hidden bg-white shadow-[0_0_20px_rgba(250,204,21,0.3)] scale-110">
                  <img src={leaderboard[0].avatar_url || `https://ui-avatars.com/api/?name=${leaderboard[0].username}`} alt="1st" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-md border-2 border-white">1</div>
              </div>
              <p className="text-sm font-black text-slate-800 truncate w-24 text-center">{leaderboard[0].username}</p>
              <p className="text-xs font-black text-blue-600">{leaderboard[0].total_points} PT</p>
            </div>

            {/* Terzo Posto */}
            <div className="flex flex-col items-center flex-1">
              <div className="relative mb-2">
                <div className="w-16 h-16 rounded-full border-4 border-amber-600/30 overflow-hidden bg-white shadow-lg">
                  <img src={leaderboard[2].avatar_url || `https://ui-avatars.com/api/?name=${leaderboard[2].username}`} alt="3rd" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-amber-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-white">3</div>
              </div>
              <p className="text-xs font-black text-slate-700 truncate w-20 text-center">{leaderboard[2].username}</p>
              <p className="text-[10px] font-bold text-blue-600">{leaderboard[2].total_points} PT</p>
            </div>
          </div>
        )}

        {/* Lista Classifica (dal 4 in poi) */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posizione & Player</span>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Punteggio</span>
          </div>
          
          <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
            {leaderboard.map((user, idx) => (
              <div 
                key={user.id} 
                className={`flex items-center justify-between p-4 ${user.id === currentUser?.id ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 flex justify-center">
                    {getRankBadge(idx)}
                  </div>
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-100 bg-slate-100">
                    <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} alt={user.username} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className={`text-sm font-black ${user.id === currentUser?.id ? 'text-blue-600' : 'text-slate-800'}`}>
                      {user.username} {user.id === currentUser?.id && '(Tu)'}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                      <MapPin size={10} />
                      {user.location || 'Terra'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-800">{user.total_points}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Punti</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-black text-lg mb-1 leading-tight">Vuoi scalare la vetta? 🚀</h3>
            <p className="text-blue-100 text-xs font-medium leading-relaxed mb-4">
              Vinci le Sfide Giornaliere, organizza partite e ricevi recensioni positive per accumulare punti profilo!
            </p>
            <button 
              onClick={() => navigate('/sfida')}
              className="bg-white text-blue-600 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md"
            >
              Gioca Ora
            </button>
          </div>
          <Trophy className="absolute -bottom-4 -right-4 text-white/10" size={120} />
        </div>
      </div>
    </div>
  );
}
