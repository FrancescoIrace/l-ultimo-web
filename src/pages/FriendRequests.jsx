import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { notifyFriendAccepted, notifyFriendRejected } from '../lib/notificationService';
import { useAlert } from '../components/AlertComponent';
import { UserCheck, UserX, Users, Clock, ChevronRight } from 'lucide-react';

export default function FriendRequests({ user }) {
  const navigate = useNavigate();
  const { confirmDangerous, success } = useAlert();
  const [pending, setPending] = useState([]);   // richieste ricevute in attesa
  const [friends, setFriends] = useState([]);   // amici accettati
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'friends'

  const loadData = useCallback(async () => {
    setLoading(true);

    // Richieste ricevute in attesa
    const { data: pendingData } = await supabase
      .from('friendships')
      .select(`
        id,
        created_at,
        sender:user_id ( id, username, avatar_url )
      `)
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    // Amicizie accettate (in entrambe le direzioni)
    const { data: friendsData } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        friend_id,
        created_at,
        user_profile:user_id ( id, username, avatar_url ),
        friend_profile:friend_id ( id, username, avatar_url )
      `)
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');

    setPending(pendingData || []);

    // Normalizza: mostra sempre l'altro utente
    const normalizedFriends = (friendsData || []).map(f => ({
      id: f.id,
      created_at: f.created_at,
      profile: f.user_id === user.id ? f.friend_profile : f.user_profile,
    }));
    setFriends(normalizedFriends);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadData();

    // Realtime: ricarica quando cambiano righe che coinvolgono questo utente
    const channel = supabase
      .channel(`friendships:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${user.id}`,
        },
        () => loadData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${user.id}`,
        },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, user.id]);

  const handleAccept = async (friendship) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendship.id);

    if (!error) {
      // Notifica chi aveva inviato la richiesta
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      await notifyFriendAccepted(
        friendship.sender.id,
        myProfile?.username || 'Un utente',
        user.id
      );

      loadData();
    }
  };

  const handleReject = async (friendship) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendship.id);

    if (!error) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      await notifyFriendRejected(
        friendship.sender.id,
        myProfile?.username || 'Un utente',
        user.id
      );

      loadData();
    }
  };

  const handleRemoveFriend = async (friendshipId, username) => {
    const confirmed = await confirmDangerous(
      `Sicuro di voler rimuovere ${username} dagli amici?`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (!error) {
      success(`${username} rimosso dagli amici`);
      loadData();
    }
  };

  return (
    <main className="max-w-md mx-auto p-4 pb-24 bg-slate-100 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 mb-1">Amici</h1>
        <p className="text-sm text-slate-500">Gestisci le richieste e i tuoi amici.</p>
      </div>

      {/* Tab */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 rounded-2xl font-bold text-sm transition-all ${
            activeTab === 'requests'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Richieste
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 rounded-2xl font-bold text-sm transition-all ${
            activeTab === 'friends'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          I miei amici ({friends.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'requests' ? (
        pending.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Clock size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-600">Nessuna richiesta in attesa</p>
            <p className="text-xs text-slate-400 mt-1">
              Quando qualcuno ti invia una richiesta, apparirà qui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(req => (
              <div
                key={req.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => navigate(`/profile/${req.sender.id}`)}
                    className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0"
                  >
                    {req.sender.avatar_url ? (
                      <img
                        src={req.sender.avatar_url}
                        alt={req.sender.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-xl font-bold text-slate-600">
                        {req.sender.username?.charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{req.sender.username}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(req.created_at).toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition active:scale-95"
                  >
                    <UserCheck size={15} />
                    Accetta
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-red-50 hover:text-red-600 transition active:scale-95"
                  >
                    <UserX size={15} />
                    Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : friends.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Users size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-bold text-slate-600">Ancora nessun amico</p>
          <p className="text-xs text-slate-400 mt-1">
            Cerca nuovi giocatori nella sezione "Trova amici".
          </p>
          <button
            onClick={() => navigate('/trova-amici')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition"
          >
            Trova amici
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {friends.map(f => (
            <div
              key={f.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3"
            >
              <button
                onClick={() => navigate(`/profile/${f.profile.id}`)}
                className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0"
              >
                {f.profile.avatar_url ? (
                  <img
                    src={f.profile.avatar_url}
                    alt={f.profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-xl font-bold text-slate-600">
                    {f.profile.username?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </button>
              <div className="flex-1">
                <p className="font-bold text-slate-900">{f.profile.username}</p>
                <p className="text-xs text-slate-400">Amici dal {new Date(f.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <button
                onClick={() => navigate(`/profile/${f.profile.id}`)}
                className="text-slate-400 hover:text-blue-600 transition"
              >
                <ChevronRight size={20} />
              </button>
              <button
                onClick={() => handleRemoveFriend(f.id, f.profile.username)}
                className="text-slate-300 hover:text-red-500 transition"
                title="Rimuovi amico"
              >
                <UserX size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
