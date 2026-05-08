import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { notifyFriendRequest } from '../lib/notificationService';
import { Search, UserPlus, UserCheck, Clock, Users } from 'lucide-react';

export default function FindFriends({ user }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  // map: profileId -> friendship status ('none' | 'pending_sent' | 'pending_received' | 'accepted')
  const [friendshipMap, setFriendshipMap] = useState({});
  const [actionLoading, setActionLoading] = useState(null); // profileId being acted on
  const navigate = useNavigate();

  const loadFriendships = useCallback(async () => {
    const { data } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    const map = {};
    (data || []).forEach(f => {
      const otherId = f.user_id === user.id ? f.friend_id : f.user_id;
      if (f.status === 'accepted') {
        map[otherId] = 'accepted';
      } else if (f.status === 'pending') {
        map[otherId] = f.user_id === user.id ? 'pending_sent' : 'pending_received';
      }
    });
    setFriendshipMap(map);
  }, [user.id]);

  useEffect(() => {
    async function loadProfiles() {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, gender,location')
        .neq('id', user.id)
        .neq('role','center')
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
    loadFriendships();
  }, [user.id, loadFriendships]);

  const sendFriendRequest = async (profile) => {
    setActionLoading(profile.id);
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: user.id, friend_id: profile.id, status: 'pending' });

    if (!error) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      await notifyFriendRequest(
        profile.id,
        myProfile?.username || 'Un utente',
        user.id
      );

      setFriendshipMap(prev => ({ ...prev, [profile.id]: 'pending_sent' }));
    }
    setActionLoading(null);
  };

  const cancelFriendRequest = async (profileId) => {
    setActionLoading(profileId);
    await supabase
      .from('friendships')
      .delete()
      .eq('user_id', user.id)
      .eq('friend_id', profileId)
      .eq('status', 'pending');

    setFriendshipMap(prev => ({ ...prev, [profileId]: undefined }));
    setActionLoading(null);
  };

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

      <button
        onClick={() => navigate('/richieste-amici')}
        className="w-full mb-4 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm hover:bg-blue-100 transition"
      >
        <Users size={18} className="text-blue-600" />
        <span className="text-sm font-bold text-blue-700">Gestisci richieste e amici</span>
      </button>

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
            <div
              key={profile.id}
              className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/profile/${profile.id}`)}
                  className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-xl font-bold text-slate-600"
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                  ) : (
                    profile.username?.charAt(0).toUpperCase() || '?'
                  )}
                </button>
                <button onClick={() => navigate(`/profile/${profile.id}`)} className="flex-1 text-left">
                  <p className="font-bold text-slate-900">{profile.username || 'Utente'}</p>
                  <p className="text-xs text-slate-500">{profile.location || 'Città non disponibile'}</p>
                </button>
                <FriendshipButton
                  status={friendshipMap[profile.id]}
                  loading={actionLoading === profile.id}
                  onSend={() => sendFriendRequest(profile)}
                  onCancel={() => cancelFriendRequest(profile.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function FriendshipButton({ status, loading, onSend, onCancel }) {
  if (loading) {
    return <div className="w-8 h-8 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />;
  }
  if (status === 'accepted') {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1.5 rounded-xl border border-green-100">
        <UserCheck size={13} />
        Amico
      </span>
    );
  }
  if (status === 'pending_sent') {
    return (
      <button
        onClick={onCancel}
        className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-red-50 hover:text-red-600 transition"
        title="Annulla richiesta"
      >
        <Clock size={13} />
        In attesa
      </button>
    );
  }
  if (status === 'pending_received') {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-100">
        <Clock size={13} />
        Rispondere
      </span>
    );
  }
  return (
    <button
      onClick={onSend}
      className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-100 transition active:scale-95"
    >
      <UserPlus size={13} />
      Aggiungi
    </button>
  );
}
