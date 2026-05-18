import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { notifyFriendRequest, notifyFriendAccepted } from '../lib/notificationService';
import { UserPlus, UserCheck, Clock, UserX, ChevronRight, Loader } from 'lucide-react';

export default function PublicProfile() {
    const { id } = useParams(); // Prende l'ID dall'URL
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState([]);
    const [avgRating, setAvgRating] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);
    const [currentUser, setCurrentUser] = useState(null);
    const [friendshipStatus, setFriendshipStatus] = useState(null); // null | 'pending_sent' | 'pending_received' | 'accepted'
    const [friendshipId, setFriendshipId] = useState(null);
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [friendCount, setFriendCount] = useState(0);
    const [squads, setSquads] = useState([]);

    useEffect(() => {
        async function getPublicProfile() {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error("Profilo non trovato");
                navigate('/'); // O una pagina 404
            } else {
                setProfile(data);
            }
            setLoading(false);
        }

        async function getSquads() {
            const { data: squadsData } = await supabase
                .from('team_members')
                .select(`
                 team_id,
                 team:teams (
                 id,
                 name,
                 logo_url,
                 created_by
                )              
              `)
                .eq('user_id', id);

            if (squadsData) {
                setSquads(squadsData);
                console.log("Squads del profilo:", squadsData);
            }
        }

        async function getProfileStats() {
            const { data, error } = await supabase
                .from('reviews')
                .select('rating')
                .eq('target_id', id);

            if (data && data.length > 0) {
                const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
                const average = (sum / data.length).toFixed(1);
                setAvgRating(average);
                setTotalReviews(data.length);
            }
        }

        async function fetchReviews() {
            const { data, error } = await supabase
                .from('reviews')
                .select(`
                    rating,
                    comment,
                    created_at,
                    reviewer:reviewer_id ( username, avatar_url, id )
                `)
                .eq('target_id', id)
                .order('created_at', { ascending: false });

            if (data) {
                setReviews(data);
                const sum = data.reduce((acc, r) => acc + r.rating, 0);
                setAvgRating(data.length > 0 ? (sum / data.length).toFixed(1) : 0);
                setTotalReviews(data.length);
            }
        }

        if (id) {
            getPublicProfile();
            getProfileStats();
            getSquads();
            fetchReviews();

            // Conta gli amici del profilo visitato
            supabase
                .from('friendships')
                .select('id', { count: 'exact', head: true })
                .or(`user_id.eq.${id},friend_id.eq.${id}`)
                .eq('status', 'accepted')
                .then(({ count }) => setFriendCount(count ?? 0));
        }
    }, [id, navigate]);

    // Carica utente corrente e stato amicizia
    useEffect(() => {
        async function loadCurrentUserAndFriendship() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || user.id === id) return;
            setCurrentUser(user);

            const { data } = await supabase
                .from('friendships')
                .select('id, user_id, friend_id, status')
                .or(`and(user_id.eq.${user.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${user.id})`)
                .maybeSingle();

            if (data) {
                setFriendshipId(data.id);
                if (data.status === 'accepted') {
                    setFriendshipStatus('accepted');
                } else if (data.status === 'pending') {
                    setFriendshipStatus(data.user_id === user.id ? 'pending_sent' : 'pending_received');
                }
            }
        }
        if (id) loadCurrentUserAndFriendship();
    }, [id]);

    if (loading) return <div className="p-10 flex flex-col items-center text-center uppercase  font-black"><Loader size={56} strokeWidth={1.75} color="blue" className='loader-spin' /><span>attendi...</span></div>;

    const handleSendRequest = async () => {
        if (!currentUser) return;
        setFriendActionLoading(true);
        const { data, error } = await supabase
            .from('friendships')
            .insert({ user_id: currentUser.id, friend_id: id, status: 'pending' })
            .select('id')
            .single();

        if (!error) {
            const { data: myProfile } = await supabase
                .from('profiles').select('username').eq('id', currentUser.id).single();
            await notifyFriendRequest(id, myProfile?.username || 'Un utente', currentUser.id);
            setFriendshipId(data?.id);
            setFriendshipStatus('pending_sent');
        }
        setFriendActionLoading(false);
    };

    const handleCancelRequest = async () => {
        if (!friendshipId) return;
        setFriendActionLoading(true);
        await supabase.from('friendships').delete().eq('id', friendshipId);
        setFriendshipId(null);
        setFriendshipStatus(null);
        setFriendActionLoading(false);
    };

    const handleAcceptRequest = async () => {
        if (!friendshipId || !currentUser) return;
        setFriendActionLoading(true);
        await supabase
            .from('friendships')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', friendshipId);

        const { data: myProfile } = await supabase
            .from('profiles').select('username').eq('id', currentUser.id).single();
        await notifyFriendAccepted(id, myProfile?.username || 'Un utente', currentUser.id);
        setFriendshipStatus('accepted');
        setFriendActionLoading(false);
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
            {/* Tasto Indietro */}
            <button
                onClick={() => navigate(-1)}
                type="button"
                className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
            >
                <ChevronRight size={14} className="rotate-180" />
                Indietro
            </button>

            <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4 border-4 border-blue-50 shadow-xl overflow-hidden">
                    {profile?.avatar_url ? (
                        <img src={profile.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                        <span className="font-black text-blue-600">{profile?.username?.charAt(0).toUpperCase()}</span>
                    )}
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800">
                    {profile?.username}
                </h2>
                <p className="text-blue-600 font-bold text-sm uppercase tracking-widest mt-1">
                    {profile?.province}
                </p>

                {/* Stats row — stile Instagram */}
                <div className="flex items-center gap-0 mt-5 w-full border border-slate-100 rounded-2xl overflow-hidden bg-slate-50 shadow-sm">
                    <div className="flex-1 flex flex-col items-center py-3 border-r border-slate-100">
                        <span className="text-xl font-black text-slate-800">{friendCount}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Amici</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center py-3 border-r border-slate-100">
                        <span className="text-xl font-black text-slate-800">{totalReviews}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Recensioni</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center py-3">
                        <span className="text-xl font-black text-yellow-500">{avgRating > 0 ? avgRating : '—'}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Media voti</span>
                    </div>
                </div>

                {/* Friendship button (non mostrato se stai guardando il tuo profilo) */}
                {currentUser && currentUser.id !== id && (
                    <div className="mt-4 w-full p-4">
                        {friendActionLoading ? (
                            <div className="w-8 h-8 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin mx-auto" />
                        ) : friendshipStatus === 'accepted' ? (
                            <span className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-green-600 bg-green-50 px-4 py-2.5 rounded-2xl border border-green-200 shadow-sm">
                                <UserCheck size={15} />
                                Siete amici
                            </span>
                        ) : friendshipStatus === 'pending_sent' ? (
                            <button
                                onClick={handleCancelRequest}
                                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-slate-500 bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-red-50 hover:text-red-600 transition active:scale-95"
                            >
                                <Clock size={15} />
                                Richiesta inviata — Annulla
                            </button>
                        ) : friendshipStatus === 'pending_received' ? (
                            <button
                                onClick={handleAcceptRequest}
                                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2.5 rounded-2xl border border-blue-200 hover:bg-blue-100 transition active:scale-95"
                            >
                                <UserCheck size={15} />
                                Accetta richiesta
                            </button>
                        ) : (
                            <button
                                onClick={handleSendRequest}
                                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-blue-600 px-4 py-2.5 rounded-2xl shadow-sm shadow-blue-200 hover:bg-blue-700 transition active:scale-95"
                            >
                                <UserPlus size={15} />
                                Aggiungi amico
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Info aggiuntive */}
            {/* <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Sport Preferito</p>
                    <p className="font-bold text-slate-700">{profile?.favorite_sport ?? 'Non definito'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Affidabilità</p>
                    <p className="font-bold text-green-600">100%</p>
                </div>
            </div> */}


            {/* ── SQUADS (SOLO SE HA SQUADS) ── */}
            {squads.length > 0 && (
                <div className="mx-0 mb-4 p-4 bg-slate-50 rounded-3xl shadow-sm overflow-hidden">
                    <div className="mb-5 flex items-center">
                        <p className="text-[14px] font-black uppercase text-slate-400 tracking-widest mb-3">Squadre</p>
                        <p className='ml-auto text-[14px] font-black uppercase font-black text-blue-600 tracking-widest mb-3'>({squads.length})</p>
                    </div>
                    {squads.map((squad) => (
                        <div
                            key={squad.team_id}
                            onClick={() => navigate(`/squadre/${squad.team_id}`)}
                            className="flex justify-left bg-slate-50 gap-3 px-4 py-3 mb-3 shadow-md border border-slate-300 rounded-3xl items-center cursor-pointer hover:bg-slate-100 transition hover:scale-101"
                        >
                            <div className="w-10 flex justify-center">
                                {squad.team.logo_url ? (
                                    <img
                                        src={squad.team.logo_url}
                                        alt={squad.team.name}
                                        className="w-full h-full object-cover rounded-xl"
                                    />
                                ) : (
                                    <div className="w-10 h-10 bg-slate-200 rounded-3xl flex items-center justify-center text-slate-600 text-[18px] font-bold uppercase">
                                        {squad.team.name.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div>
                                <span className="font-bold text-slate-800 text-[16px]">{squad.team.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}


            {/* Lista Commenti */}
            <div className="space-y-4 p-4">
                {reviews.map((rev, index) => (
                    <div key={index} className="border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-black text-yellow-500">{'★'.repeat(rev.rating)}</span>
                            <span className="text-[10px] font-black uppercase text-slate-400">
                                da
                                <span onClick={() => navigate(`/profile/${rev.reviewer.id}`)}
                                    className="text-blue-600 cursor-pointer hover:underline ml-1">
                                    {rev.reviewer.username}
                                </span>
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 italic">"{rev.comment}"</p>
                        <span className="text-[10px] text-slate-400">{new Date(rev.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}