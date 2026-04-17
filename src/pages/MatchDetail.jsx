import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function MatchDetail({ user }) {
    const { id } = useParams();
    const [match, setMatch] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isJoined, setIsJoined] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        async function getDetails() {
            // 1. Prendi i dati della partita
            const { data: matchData } = await supabase
                .from('matches')
                .select('*')
                .eq('id', id)
                .single();

            setMatch(matchData);
            if (matchData) {
                const { data: participantData } = await supabase
                    .from('participants')
                    .select('*')
                    .eq('match_id', matchData.id)
                    .eq('user_id', user.id)
                    .single();
                setIsJoined(!!participantData);
            }

            // 2. Partecipanti + Dati del Profilo (JOIN)
            const { data: partData, error: partError } = await supabase
                .from('participants')
                .select(`id, user_id,profiles (username,avatar_url, gender)`) // JOIN con profiles per avere username e avatar dei partecipanti
                .eq('match_id', id);

            if (partError) console.error(partError);
            else setParticipants(partData || []);

            setLoading(false);
        }
        getDetails();
    }, [id]);

    const handleLeave = async () => {
        if (match.creator_id === user.id) {
            alert("Sei l'organizzatore, Non puoi uscire dalla partita a meno che non passi la partita a un altro giocatore. Per annullare la partita usa il pulsante dedicato.");
            return;
        }
        if (!confirm("Vuoi davvero abbandonare la partita?")) return;

        // 1. Rimuovi dai partecipanti
        const { error: partError } = await supabase
            .from('participants')
            .delete()
            .eq('match_id', id)
            .eq('user_id', user.id);

        if (!partError) {
            // 2. Decrementa il contatore in matches
            await supabase
                .from('matches')
                .update({ current_players: match.current_players - 1 })
                .eq('id', id);

            window.location.reload(); // Semplice refresh per aggiornare la UI
        }
    };

    const handleDeleteMatch = async () => {
        if (!confirm("Sei l'organizzatore. Vuoi annullare definitivamente la partita?")) return;

        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id);

        if (!error) navigate('/');
    };

    const handleJoin = async () => {
        const { error: partError } = await supabase
            .from('participants')
            .insert([{ match_id: match.id, user_id: user.id }]);

        if (!partError) {
            await supabase
                .from('matches')
                .update({ current_players: match.current_players + 1 })
                .eq('id', match.id);

            alert("Iscritto con successo!");
            setIsJoined(true);
        } else {
            alert("Errore durante l'iscrizione: " + partError.message);
        }
    };

    if (loading) return <div className="p-10 text-center">Caricamento...</div>;
    if (!match) return <div className="p-10 text-center">Partita non trovata.</div>;

    return (
        <div className="max-w-md mx-auto p-4">
            <button
                onClick={() => navigate('/')}
                type="button"
                className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
            >
                TORNA INDIETRO
            </button>
            <h2 className="text-3xl font-black uppercase mb-2">{match.title}</h2>
            <div className="bg-blue-50 p-4 rounded-2xl mb-6">
                <p className="text-slate-600">📍 {match.location}</p>
                <p className="text-slate-600">⏰ {new Date(match.datetime).toLocaleString()}</p>
                <p className="text-slate-600">📝 {match.description}</p>
            </div>

            <h3 className="font-bold text-lg mb-4">Giocatori ({participants.length}/{match.max_players})</h3>

            {/* Sezione Partecipanti nel return */}
            <div className="space-y-3">
                {participants.map((p, index) => (
                    
                    <div
                        key={p.id}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${p.user_id === user.id ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white'
                            }`}
                        onClick={() => {(p.user_id !== user.id) ? navigate(`/profile/${p.user_id}`) : navigate('/profile') }}
                    >
                        <div className="flex items-center gap-3">
                            {/* Avatar o Iniziale */}
                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-500 overflow-hidden">
                                {p.profiles?.avatar_url ? (
                                    <img src={p.profiles.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                    p.profiles?.username?.charAt(0).toUpperCase() || '?'
                                )}
                            </div>

                            <div>
                                <p className="font-bold text-slate-800">
                                    {p.profiles?.username || 'Utente anonimo'}
                                    {p.user_id === user.id && <span className="text-blue-500 ml-2 text-xs">(Tu)</span>}
                                </p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                                    {p.profiles?.gender === 'M' ? 'Uomo' : p.profiles?.gender === 'F' ? 'Donna' : 'Player'}
                                </p>
                            </div>
                        </div>

                        {/* Tag Organizzatore */}
                        {p.user_id === match.creator_id && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-lg uppercase">
                                Organizzatore
                            </span>
                        )}
                    </div>
                ))}
            </div>
            {/* BOTTONI VARI */}
            <div className="mt-10 pt-6 border-t border-slate-100">
                {participants.some(p => p.user_id === user.id) ? (
                    <button
                        onClick={handleLeave}
                        className="w-full cursor-pointer bg-red-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        ABBANDONA PARTITA
                    </button>
                ) : (
                    <button
                        disabled={participants.length >= match.max_players}
                        onClick={handleJoin}
                        className="w-full cursor-pointer bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {participants.length >= match.max_players ? 'PARTITA PIENA' : 'UNISCITI ORA'}
                    </button>
                )}

                {user.id === match.creator_id && (
                    <>
                        <button
                            onClick={() => { navigate(`/modifica/${match.id}`) }}
                            className="w-full mt-4 cursor-pointer bg-yellow-50 text-yellow-600 border border-yellow-600 py-4 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-yellow-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                            Modifica Partita (Admin)
                        </button>
                        <button
                            onClick={handleDeleteMatch}
                            className="w-full mt-4 cursor-pointer bg-red-50 text-red-600 border border-red-600 py-4 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-red-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                            Annulla Partita (Admin)
                        </button>
                    </>

                )}
            </div>
        </div>
    );
}