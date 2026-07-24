import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { notifyFriendRequest, notifyFriendAccepted } from '../lib/notificationService';
import { UserPlus, UserCheck, Clock, UserX, ChevronRight, MapPin, Building2, Phone, Globe, Info, Dumbbell, Calendar, MessageCircle, Navigation, MoreVertical, ShieldCheck, Award } from 'lucide-react';
import Loader from '../components/Loader';
import { useAlert } from '../components/AlertComponent';

// Stessa mappatura di Profile.jsx/ClassificaMinigame.jsx: rank 1/2/3 = podio,
// rank nullo = ha comunque partecipato alla stagione.
const SEASON_RANK_META = {
    1: { label: 'Oro', className: 'bg-yellow-400 text-yellow-900' },
    2: { label: 'Argento', className: 'bg-slate-300 text-slate-700' },
    3: { label: 'Bronzo', className: 'bg-amber-600 text-white' },
    default: { label: 'Partecipante', className: 'bg-slate-100 text-slate-500' },
};

export default function PublicProfile() {
    const { id } = useParams(); // Prende l'ID dall'URL
    const navigate = useNavigate();
    const { success, error: showError, confirmDangerous } = useAlert();
    const [profile, setProfile] = useState(null);
    const [courts, setCourts] = useState([]);
    const [businessHours, setBusinessHours] = useState([]);
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
    const [expandedSquads, setExpandedSquads] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockActionLoading, setBlockActionLoading] = useState(false);
    const [blockMenuOpen, setBlockMenuOpen] = useState(false);
    const blockMenuRef = useRef(null);
    const [isEarlyTester, setIsEarlyTester] = useState(false);
    const [seasonBadges, setSeasonBadges] = useState([]);

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
                if (data.role === 'center') {
                    const { data: courtsData } = await supabase.from('sports_courts').select('*').eq('center_id', id);
                    if (courtsData) setCourts(courtsData);

                    const { data: hoursData } = await supabase.from('business_hours').select('*').eq('center_id', id);
                    if (hoursData) setBusinessHours(hoursData);
                }
            }
            setLoading(false);
        }

        // Badge: "Tester Interno" + podi delle stagioni classifica passate,
        // visibili anche agli altri utenti (stessa logica di Profile.jsx).
        async function getBadges() {
            const { data: earlyTesterRow } = await supabase
                .from('early_testers')
                .select('profile_id')
                .eq('profile_id', id)
                .maybeSingle();
            setIsEarlyTester(!!earlyTesterRow);

            const { data: seasonResultsData } = await supabase
                .from('quiz_season_results')
                .select('rank, points, quiz_seasons(name)')
                .eq('profile_id', id)
                .order('created_at', { ascending: false });
            setSeasonBadges(seasonResultsData || []);
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
            getBadges();
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

            const { data: blockData } = await supabase
                .from('user_blocks')
                .select('id')
                .eq('blocker_id', user.id)
                .eq('blocked_id', id)
                .maybeSingle();

            setIsBlocked(!!blockData);
        }
        if (id) loadCurrentUserAndFriendship();
    }, [id]);

    // Chiude il menu contestuale al click fuori
    useEffect(() => {
        function handleClickOutside(e) {
            if (blockMenuRef.current && !blockMenuRef.current.contains(e.target)) {
                setBlockMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (loading) return <Loader variant="page" />;
    if (!profile) return null;

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

    const handleBlockUser = async () => {
        setBlockMenuOpen(false);
        if (!currentUser) return;

        const confirmed = await confirmDangerous(
            `Bloccare ${profile?.username}? Non vedrai più le sue recensioni e non potrete più interagire.`
        );
        if (!confirmed) return;

        setBlockActionLoading(true);
        const { error } = await supabase
            .from('user_blocks')
            .insert({ blocker_id: currentUser.id, blocked_id: id });
        setBlockActionLoading(false);

        if (error) {
            console.error('Errore blocco utente:', error.message);
            showError('Impossibile bloccare l\'utente');
            return;
        }

        setIsBlocked(true);
        success(`${profile?.username} è stato bloccato`);
    };

    const handleUnblockUser = async () => {
        setBlockMenuOpen(false);
        if (!currentUser) return;

        setBlockActionLoading(true);
        const { error } = await supabase
            .from('user_blocks')
            .delete()
            .eq('blocker_id', currentUser.id)
            .eq('blocked_id', id);
        setBlockActionLoading(false);

        if (error) {
            console.error('Errore sblocco utente:', error.message);
            showError('Impossibile sbloccare l\'utente');
            return;
        }

        setIsBlocked(false);
        success(`${profile?.username} è stato sbloccato`);
    };

    if (profile.role === 'center') {
        const formatPhoneForWA = (phone) => {
            const num = String(phone).replace(/\D/g, '');
            return num.startsWith('39') ? num : '39' + num;
        };

        return (
            <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-10">
                {/* Header background gradient and avatar */}
                <div className="relative h-48 mb-16">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-indigo-900 overflow-hidden">
                        {/* Pattern Overlay */}
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                    </div>
                    
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-4 left-4 flex flex-row items-center gap-1.5 text-xs font-bold uppercase text-white/90 hover:text-white transition bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm z-10"
                    >
                        <ChevronRight size={14} className="rotate-180" />
                        Indietro
                    </button>

                    {/* Avatar Scudo Centrato */}
                    <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 z-10">
                        <div className="w-28 h-28 rounded-2xl bg-white p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                            <img
                                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username || 'Centro')}&background=random&size=150`}
                                alt="Logo Centro"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover rounded-xl bg-slate-100"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-6 text-center">
                    <h1 className="text-2xl font-black uppercase text-slate-900 tracking-tight">
                        {profile.full_name || profile.username || 'Centro Sportivo'}
                    </h1>
                    <div className="flex items-center justify-center gap-1.5 mt-2.5 text-slate-500 text-sm font-semibold">
                        <MapPin size={16} className="text-blue-500 flex-shrink-0" />
                        <span className="line-clamp-2">{profile.business_address || 'Indirizzo non specificato'}</span>
                    </div>
                    {totalReviews > 0 && (
                        <div className="flex items-center justify-center gap-1.5 mt-4">
                            <span className="font-black text-amber-500 text-xl">{avgRating}</span>
                            <span className="text-amber-500 shrink-0">★</span>
                            <span className="text-slate-400 text-xs font-bold uppercase ml-1">({totalReviews} recensioni)</span>
                        </div>
                    )}
                </div>

                {/* Pulsanti Azione Rapida */}
                <div className="flex justify-center gap-6 mt-8 px-6">
                    {profile.cellulare && (
                        <>
                            <a
                                href={`https://wa.me/${formatPhoneForWA(profile.cellulare)}?text=${encodeURIComponent("Ciao, ti contatto dall'app ULTIMO per avere informazioni")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex flex-col items-center gap-2"
                            >
                                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm border border-green-200 group-hover:scale-110 transition-transform">
                                    <MessageCircle size={26} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">WhatsApp</span>
                            </a>
                            <a
                                href={`tel:${profile.cellulare}`}
                                className="group flex flex-col items-center gap-2"
                            >
                                <div className="w-14 h-14 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shadow-sm border border-sky-200 group-hover:scale-110 transition-transform">
                                    <Phone size={24} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chiama</span>
                            </a>
                        </>
                    )}
                    {profile.business_address && (
                        <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(profile.business_address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col items-center gap-2"
                        >
                            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-200 group-hover:scale-110 transition-transform">
                                <Navigation size={24} className="ml-0.5" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mappa</span>
                        </a>
                    )}
                    {profile.website && (
                        <a
                            href={profile.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col items-center gap-2"
                        >
                            <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 shadow-sm border border-slate-300 group-hover:scale-110 transition-transform">
                                <Globe size={24} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sito Web</span>
                        </a>
                    )}
                </div>

                <div className="px-5 mt-10 space-y-6">
                    {/* Informazioni */}
                    {profile.bio && (
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                                <Info size={16} className="text-blue-500" /> Il Centro
                            </h2>
                            <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {profile.bio}
                            </p>
                        </div>
                    )}

                    {/* Orari */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-5 flex items-center gap-2">
                            <Clock size={16} className="text-blue-500" /> Orari di Apertura
                        </h2>
                        {businessHours && businessHours.length > 0 ? (
                            <div className="space-y-2">
                                {businessHours.sort((a,b) => (a.day_of_week === 0 ? 7 : a.day_of_week) - (b.day_of_week === 0 ? 7 : b.day_of_week)).map(h => (
                                    <div key={h.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                        <span className="font-bold text-slate-600">
                                            {['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][h.day_of_week]}
                                        </span>
                                        {h.is_closed ? (
                                            <span className="text-red-500 font-bold text-xs uppercase bg-red-50 px-2 py-0.5 rounded-md">Chiuso</span>
                                        ) : (
                                            <span className="font-semibold text-slate-700">{h.open_time.slice(0,5)} - {h.close_time.slice(0,5)}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                <p className="text-sm font-bold text-slate-400">Orari non aggiunti</p>
                            </div>
                        )}
                    </div>

                    {/* Campi */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-5 flex items-center gap-2">
                            <Building2 size={16} className="text-blue-500" /> I Nostri Campi
                        </h2>
                        {courts && courts.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {courts.map(court => (
                                    <div key={court.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 group">
                                        <div className="flex flex-col">
                                            <span className="font-extrabold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{court.name}</span>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] font-bold text-white bg-slate-400 px-2 py-0.5 rounded-full uppercase">
                                                    {court.sport_type}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                    {court.indoor ? 'Indoor' : 'Outdoor'}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                    {court.hasCamera ? '📷 Con Telecamera' : '🏟️ Senza Telecamera'}
                                                </span>
                                            </div>
                                        </div>
                                        {court.price_p_p && (
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-emerald-600">{Number(court.price_p_p).toFixed(2).replace(/\.00$/, '')}€</span>
                                                <span className="text-[9px] font-bold uppercase text-slate-400">/persona</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                <p className="text-sm font-bold text-slate-400">Nessun campo aggiunto</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Fallback: qualunque valore di role diverso da 'center' (player, ma
    // anche null/non impostato - il flusso di signup in Auth.jsx non scrive
    // mai questo campo) usa la vista giocatore standard. Prima il controllo
    // esplicito `=== 'player'` lasciava la pagina bianca per i profili
    // senza `role` impostato.
    return (
            <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
                {/* Tasto Indietro + menu contestuale */}
                <div className="mb-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        type="button"
                        className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
                    >
                        <ChevronRight size={14} className="rotate-180" />
                        Indietro
                    </button>

                    {currentUser && currentUser.id !== id && (
                        <div className="relative" ref={blockMenuRef}>
                            <button
                                type="button"
                                onClick={() => setBlockMenuOpen(!blockMenuOpen)}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                                aria-label="Altre opzioni"
                                disabled={blockActionLoading}
                            >
                                <MoreVertical size={18} />
                            </button>

                            {blockMenuOpen && (
                                <div className="absolute right-0 top-8 z-10 w-48 bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden">
                                    {isBlocked ? (
                                        <button
                                            type="button"
                                            onClick={handleUnblockUser}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                        >
                                            <UserX size={14} />
                                            Sblocca Utente
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleBlockUser}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <UserX size={14} />
                                            Blocca Utente
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center mb-6">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4 border-4 border-blue-50 shadow-xl overflow-hidden">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                            <span className="font-black text-blue-600">{profile?.username?.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <h2 className="w-full px-2 text-3xl font-black uppercase tracking-tighter text-slate-800 text-center truncate">
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
                        <button 
                            onClick={() => navigate(`/recensioni/${id}`, { state: { username: profile?.username } })}
                            className="flex-1 flex flex-col items-center py-3 border-r border-slate-100 hover:bg-blue-50 transition active:scale-95"
                        >
                            <span className="text-xl font-black text-slate-800">{totalReviews}</span>
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Recensioni</span>
                        </button>
                        <button 
                            onClick={() => navigate(`/recensioni/${id}`, { state: { username: profile?.username } })}
                            className="flex-1 flex flex-col items-center py-3 hover:bg-blue-50 transition active:scale-95"
                        >
                            <span className="text-xl font-black text-yellow-500">{avgRating > 0 ? avgRating : '—'}</span>
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Media voti</span>
                        </button>
                    </div>

                    {/* Friendship button (non mostrato se stai guardando il tuo profilo) */}
                    {currentUser && currentUser.id !== id && (
                        <div className="mt-4 w-full p-4">
                            {friendActionLoading ? (
                                <Loader variant="inline" size={32} className="mx-auto" />
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

                {/* ── BADGE ── */}
                {(isEarlyTester || seasonBadges.length > 0) && (
                    <div className="mb-4 p-4 bg-slate-50 rounded-3xl">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Badge</p>
                        <div className="flex flex-wrap gap-2">
                            {isEarlyTester && (
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700">
                                    <ShieldCheck size={13} />
                                    Tester Interno
                                </span>
                            )}
                            {seasonBadges.map((badge, i) => {
                                const meta = SEASON_RANK_META[badge.rank] || SEASON_RANK_META.default;
                                return (
                                    <span key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black ${meta.className}`}>
                                        <Award size={13} />
                                        {meta.label} · {badge.quiz_seasons?.name}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── SQUADS (SOLO SE HA SQUADS) ── */}
                {squads.length > 0 && (
                    <div className="mx-0 mb-4 p-4 bg-slate-50 rounded-3xl shadow-sm overflow-hidden">
                        <div className="mb-5 flex items-center">
                            <p className="text-[14px] font-black uppercase text-slate-400 tracking-widest mb-3">Squadre</p>
                            <p className='ml-auto text-[14px] font-black uppercase font-black text-blue-600 tracking-widest mb-3'>({squads.length})</p>
                        </div>
                        {(expandedSquads ? squads : squads.slice(0, 3)).map((squad) => (
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
                        {squads.length > 3 && (
                            <button
                                onClick={() => setExpandedSquads(!expandedSquads)}
                                className="w-full mt-3 py-2 text-sm font-bold uppercase text-blue-600 hover:bg-blue-50 rounded-2xl transition"
                            >
                                {expandedSquads ? 'Mostra meno' : 'Mostra altro'}
                            </button>
                        )}
                    </div>
                )}


                {/* ── RECENSIONI (PULSANTE) ── */}
                <div className="mx-0 mb-4">
                    <button
                        onClick={() => navigate(`/recensioni/${id}`, { state: { username: profile?.username } })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-3xl shadow-sm px-4 py-4 flex items-center gap-3 hover:bg-slate-100 transition active:scale-95"
                    >
                        <div className="w-9 h-9 bg-yellow-100 rounded-xl flex items-center justify-center border border-yellow-200">
                            <span className="text-yellow-500 text-lg font-black leading-none">★</span>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-black text-slate-800 text-sm">Recensioni Ricevute</p>
                            <p className="text-xs text-slate-400">Visualizza i {totalReviews} voti ricevuti</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-300" />
                    </button>
                </div>

            </div>
        );
}