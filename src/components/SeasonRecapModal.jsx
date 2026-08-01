import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SeasonBadge from './SeasonBadge';

// Pop-up di inizio stagione: alla prima apertura dopo la chiusura di una
// stagione, riepiloga com'è andata (podio + il risultato dell'utente) e invita
// a ripartire. Si mostra una sola volta per stagione (flag in localStorage).
// Auto-contenuto: fa da sé fetch e visibilità, se non c'è nulla ritorna null.
export default function SeasonRecapModal({ userId }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null); // { season, podium, myResult }

  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      const today = new Date().toISOString().split('T')[0];
      // Stagione conclusa più recente
      const { data: seasons } = await supabase
        .from('quiz_seasons')
        .select('id, name, season_number, ends_on')
        .lt('ends_on', today)
        .order('ends_on', { ascending: false })
        .limit(1);

      const season = seasons?.[0];
      if (!season) return;
      if (localStorage.getItem('season_recap_seen_' + season.id) === '1') return;

      const { data: results } = await supabase
        .from('quiz_season_results')
        .select('rank, points, profile_id, profiles(username, avatar_url)')
        .eq('season_id', season.id);

      const podium = (results || [])
        .filter((r) => r.rank != null)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 3);
      const myResult = (results || []).find((r) => r.profile_id === userId) || null;

      if (active) setData({ season, podium, myResult });
    })();

    return () => { active = false; };
  }, [userId]);

  if (!data) return null;
  const { season, podium, myResult } = data;

  const close = () => {
    localStorage.setItem('season_recap_seen_' + season.id, '1');
    setData(null);
  };

  const goToClassifica = () => {
    close();
    navigate('/leaderboard');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-5">
          <span className="inline-block text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-2">
            🏁 Stagione conclusa
          </span>
          <h2 className="text-2xl font-black text-slate-900">{season.name}</h2>
          <p className="text-sm text-slate-500 mt-1">Ecco com'è andata — ora si riparte tutti da zero!</p>
        </div>

        {podium.length > 0 && (
          <div className="flex justify-center items-start gap-4 mb-5">
            {podium.map((p) => (
              <div key={p.profile_id} className="flex flex-col items-center gap-1 w-20">
                <SeasonBadge rank={p.rank} seasonNumber={season.season_number} seasonName={season.name} showName={false} size={52} />
                <span className="text-xs font-black text-slate-800 truncate max-w-full">{p.profiles?.username || '—'}</span>
                <span className="text-[11px] text-slate-400 font-bold">{p.points} pt</span>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center mb-5">
          {myResult ? (
            <div className="flex flex-col items-center gap-2">
              <SeasonBadge rank={myResult.rank} seasonNumber={season.season_number} seasonName={season.name} showName={false} size={48} />
              {myResult.rank ? (
                <p className="text-sm font-bold text-slate-700">
                  Ti sei classificato <span className="text-blue-600 font-black">{myResult.rank}°</span> con {myResult.points} punti. Badge sbloccato! 🎉
                </p>
              ) : (
                <p className="text-sm font-bold text-slate-700">
                  Hai partecipato con {myResult.points} punti — badge partecipante sbloccato! 💪
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-700">
              Non hai giocato questa stagione. La nuova è appena iniziata: tocca a te! 🚀
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={goToClassifica} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-colors">
            Vedi la classifica
          </button>
          <button onClick={close} className="w-full py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors">
            Inizia la nuova stagione
          </button>
        </div>
      </div>
    </div>
  );
}
