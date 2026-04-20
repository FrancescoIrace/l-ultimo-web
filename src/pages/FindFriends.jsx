import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Search, UserPlus } from 'lucide-react';

export default function FindFriends({ user }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, gender')
        .neq('id', user.id)
        .order('username', { ascending: true });

      if (error) {
        console.error(error);
        setError('Errore nel caricamento degli utenti.');
      } else {
        setProfiles(data || []);
      }
      setLoading(false);
    }

    loadProfiles();
  }, [user.id]);

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    return profiles.filter((profile) =>
      profile.username?.toLowerCase().includes(search.toLowerCase()) 
    // ||
    //   profile.city?.toLowerCase().includes(search.toLowerCase())
    );
  }, [profiles, search]);

  return (
    <main className="max-w-md mx-auto p-4 pb-24 bg-slate-100">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 mb-2">Trova amici</h1>
        <p className="text-sm text-slate-500">Cerca chi è già registrato all'app e visita il profilo per scoprire le partite in zona.</p>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o città"
            className="w-full bg-transparent outline-none text-sm text-slate-700"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
        <h2 className="font-bold text-slate-800 mb-2">In futuro</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Qui potremo aggiungere la gestione amici, i filtri per utenti in zona e le richieste di amicizia.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-20 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : filteredProfiles.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Nessun utente trovato. Prova a cambiare ricerca.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProfiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => navigate(`/profile/${profile.id}`)}
              className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-xl font-bold text-slate-600">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                  ) : (
                    profile.username?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{profile.username || 'Utente'}</p>
                  <p className="text-xs text-slate-500">{profile.city || 'Città non disponibile'}</p>
                </div>
                <div className="text-slate-400">
                  <UserPlus size={18} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
