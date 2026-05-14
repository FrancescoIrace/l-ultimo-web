import { useState, useEffect } from 'react';
import { Plus, Users, Search, Copy, Check, ArrowLeft, ChevronRight, Lock, Info, UserPlus, UserMinus, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAlert } from '../components/AlertComponent';
import { useNavigate, useParams } from 'react-router-dom';

export default function TeamDetail({ session }) {
    const navigate = useNavigate();
    const { id: teamId } = useParams();
    const userId = session?.user?.id;

    // States
    const [loading, setLoading] = useState(true);
    const [teamDetails, setTeamDetails] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [copiedCode, setCopiedCode] = useState(false);
    const [isUserMember, setIsUserMember] = useState(false);
    const [isLoadingAction, setIsLoadingAction] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState(new Set());
    const [isSendingInvites, setIsSendingInvites] = useState(false);
    const { success, error, confirm } = useAlert();

    const loadTeamDetails = async () => {
        if (!teamId) return;
        setLoading(true);

        try {
            // Carica i dettagli della squadra
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select('*')
                .eq('id', teamId)
                .single();

            if (teamError) throw teamError;
            setTeamDetails(teamData);

            // Carica gli user_id dei membri della squadra
            const { data: membersList, error: membersError } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('team_id', teamId);

            if (membersError) throw membersError;

            // Se ci sono membri, carica i loro profili
            if (membersList && membersList.length > 0) {
                const userIds = membersList.map(m => m.user_id);
                const { data: profiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', userIds);

                if (profilesError) throw profilesError;

                // Mappa i profili ai membri
                const membersWithProfiles = membersList.map(member => ({
                    user_id: member.user_id,
                    profiles: profiles?.find(p => p.id === member.user_id)
                }));

                setTeamMembers(membersWithProfiles);
            } else {
                setTeamMembers([]);
            }

            // Controlla se l'utente è già membro
            if (userId && membersList) {
                const isMember = membersList.some(m => m.user_id === userId);
                setIsUserMember(isMember);
            }
        } catch (err) {
            console.error('Errore nel caricare i dettagli della squadra:', err);
            error('Errore nel caricamento della squadra');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!teamId) return;
        loadTeamDetails();
    }, [teamId, userId]);

    useEffect(() => {
        if (showInviteModal && !friends.length) {
            loadFriends();
        }
    }, [showInviteModal]);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(teamDetails?.invite_code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const handleLeaveTeam = async () => {
        if (teamDetails.created_by === userId) {
            error("Sei il creatore della squadra. Non puoi abbandonarla direttamente.");
            return;
        }

        confirm('Vuoi davvero uscire dalla squadra?', async () => {
            try {
                setIsLoadingAction(true);
                const { error: leaveError } = await supabase
                    .from('team_members')
                    .delete()
                    .eq('team_id', teamId)
                    .eq('user_id', userId);

                if (leaveError) throw leaveError;
                success('Hai abbandonato la squadra!');
                setIsUserMember(false);
                loadTeamDetails();
            } catch (err) {
                error('Errore nell\'abbandonare la squadra: ' + err.message);
            } finally {
                setIsLoadingAction(false);
            }
        });
    };

    const loadFriends = async () => {
        if (!userId) return;
        try {
            // Carica gli amici dell'utente
            const { data: friendships, error: friendsError } = await supabase
                .from('friendships')
                .select('friend_id')
                .eq('user_id', userId)
                .eq('status', 'accepted');

            if (friendsError) throw friendsError;

            if (friendships && friendships.length > 0) {
                const friendIds = friendships.map(f => f.friend_id);
                // Carica i profili degli amici
                const { data: friendProfiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', friendIds);

                if (profilesError) throw profilesError;
                setFriends(friendProfiles || []);
            } else {
                setFriends([]);
            }
        } catch (err) {
            console.error('Errore nel caricamento degli amici:', err);
        }
    };

    const handleInviteFriends = async () => {
        if (selectedFriends.size === 0) {
            error('Seleziona almeno un amico');
            return;
        }

        try {
            setIsSendingInvites(true);

            // Invia notifiche di invito
            const notifications = Array.from(selectedFriends).map(friendId => ({
                user_id: friendId,
                sender_id: userId,
                type: 'team_invite',
                title: `Sei stato convocato!`,
                content: `Hai ricevuto un invito a unirti alla squadra "${teamDetails.name}"`,
                link: `/squadre/${teamId}`,
                created_at: new Date().toISOString()
            }));

            const { error: notifError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifError) throw notifError;

            success(`Inviti inviati a ${selectedFriends.size} amico/i!`);
            setShowInviteModal(false);
            setSelectedFriends(new Set());
        } catch (err) {
            error('Errore nell\'invio degli inviti: ' + err.message);
        } finally {
            setIsSendingInvites(false);
        }
    };

    const handleShare = () => {
        const text = `Unisciti alla squadra "${teamDetails.name}"! Codice invito: ${teamDetails.invite_code}`;
        if (navigator.share) {
            navigator.share({
                title: teamDetails.name,
                text: text
            });
        } else {
            navigator.clipboard.writeText(text);
            success('Testo copiato!');
        }
    };

    const handleJoinTeam = async () => {
        if (!userId) {
            error('Devi essere loggato');
            return;
        }

        try {
            setIsLoadingAction(true);
            const { error: joinError } = await supabase
                .from('team_members')
                .insert({
                    team_id: teamId,
                    user_id: userId,
                    joined_at: new Date().toISOString()
                });

            if (joinError) throw joinError;
            success('Ti sei unito alla squadra!');
            setIsUserMember(true);
            loadTeamDetails();
        } catch (err) {
            error('Errore nell\'unirsi alla squadra: ' + err.message);
        } finally {
            setIsLoadingAction(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white max-w-md mx-auto p-4 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Caricamento...</p>
                </div>
            </div>
        );
    }

    if (!teamDetails) {
        return (
            <div className="min-h-screen bg-white max-w-md mx-auto p-4">
                <button
                    onClick={() => navigate("/squadre")}
                    type="button"
                    className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
                >
                    <ChevronRight size={14} className="rotate-180" />
                    Indietro
                </button>
                <div className="text-center py-12">
                    <p className="text-slate-600">Squadra non trovata</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white max-w-md mx-auto p-4 pb-20">
            {/* TASTO INDIETRO */}
            <button
                onClick={() => navigate("/squadre")}
                type="button"
                className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
            >
                <ChevronRight size={14} className="rotate-180" />
                Indietro
            </button>

            {/* HEADER CON LOGO E INFO */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 shadow-md mb-6"
            >
                {/* Logo */}
                <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    {teamDetails.logo_url ? (
                        <img
                            src={teamDetails.logo_url}
                            alt={teamDetails.name}
                            className="w-full h-full object-cover rounded-xl"
                        />
                    ) : (
                        <span className="text-4xl">⚽</span>
                    )}
                </div>

                {/* Nome e Type */}
                <div className="text-center mb-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <h1 className="text-3xl font-black text-slate-800">{teamDetails.name}</h1>
                        {teamDetails.is_private && (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                                <Lock size={14} />
                                Privata
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500">
                        {teamDetails.description || 'Nessuna descrizione'}
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-black text-blue-600">{teamMembers.length}</div>
                        <div className="text-xs text-blue-600 font-semibold">Membri</div>
                    </div>
                    <div
                        onClick={handleCopyCode}
                        className="bg-slate-100 hover:bg-slate-200 rounded-xl p-3 text-center cursor-pointer transition-colors"
                    >
                        <div className="text-lg font-mono font-bold text-slate-700">{teamDetails.invite_code}</div>
                        <div className="text-xs text-slate-500 font-semibold">{copiedCode ? 'Copiato!' : 'Codice Invito'}</div>
                    </div>
                </div>

                {/* Azioni */}
                <div className={`${!isUserMember ? 'grid-cols-2' : 'grid-cols-3'} grid gap-2`}>
                    {/* UNISCITI ALLA SQUADRA */}
                    {!isUserMember && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleJoinTeam}
                            disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            Unisciti alla Squadra
                        </motion.button>
                    )}
                    {isUserMember && (
                        <>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleLeaveTeam}
                                disabled={loading}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                <UserMinus size={16} />
                                Esci
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowInviteModal(true)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95"
                            >
                                <UserPlus size={16} />
                                Invita
                            </motion.button>
                        </>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleShare}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-200 shadow-lg hover:shadow-xl transition-all active:scale-95"
                    >
                        <Share2 size={16} />
                        Condividi
                    </motion.button>


                </div>
            </motion.div>



            {isUserMember && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
                    <p className="text-blue-700 font-semibold text-sm">✓ Sei membro di questa squadra</p>
                </div>
            )}

            {/* MEMBRI */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl p-6 shadow-md"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Users size={20} className="text-slate-700" />
                    <h2 className="text-lg font-black text-slate-800">Membri ({teamMembers.length})</h2>
                </div>

                {teamMembers.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">Nessun membro ancora</p>
                ) : (
                    <div className="space-y-2">
                        {teamMembers.map((member) => (
                            <div
                                key={member.user_id}
                                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                            >
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    {member.profiles?.avatar_url ? (
                                        <img
                                            src={member.profiles.avatar_url}
                                            alt={member.profiles.username}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-blue-600">
                                            {member.profiles?.username?.[0]?.toUpperCase() || '?'}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">
                                        {member.profiles?.username || 'Utente sconosciuto'}
                                    </p>
                                </div>
                                {member.user_id === teamDetails.created_by && (
                                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold">👑 Creator</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* MODALE INVITA AMICI */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-end z-50">
                    <motion.div
                        initial={{ y: 300, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 300, opacity: 0 }}
                        className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
                    >
                        <div>
                            <h2 className="text-2xl font-black text-slate-800">Invita Amici</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                Seleziona gli amici da invitare a "{teamDetails.name}"
                            </p>
                        </div>

                        {friends.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-slate-500">Non hai amici da invitare</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {friends.map((friend) => (
                                    <label
                                        key={friend.id}
                                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedFriends.has(friend.id)}
                                            onChange={(e) => {
                                                const newSelected = new Set(selectedFriends);
                                                if (e.target.checked) {
                                                    newSelected.add(friend.id);
                                                } else {
                                                    newSelected.delete(friend.id);
                                                }
                                                setSelectedFriends(newSelected);
                                            }}
                                            className="w-4 h-4 accent-blue-600"
                                        />
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            {friend.avatar_url ? (
                                                <img
                                                    src={friend.avatar_url}
                                                    alt={friend.username}
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-sm font-bold text-blue-600">
                                                    {friend.username?.[0]?.toUpperCase() || '?'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800 flex-1">
                                            {friend.username}
                                        </p>
                                    </label>
                                ))}
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3 pt-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={() => {
                                    setShowInviteModal(false);
                                    setSelectedFriends(new Set());
                                }}
                                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Annulla
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={handleInviteFriends}
                                disabled={isSendingInvites || selectedFriends.size === 0}
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSendingInvites ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Invio...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={18} />
                                        Invita ({selectedFriends.size})
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
