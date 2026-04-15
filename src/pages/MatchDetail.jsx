import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function MatchDetail({ user }) {
    const { id } = useParams();
    const [match, setMatch] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getDetails() {
            // 1. Prendi i dati della partita
            const { data: matchData } = await supabase
                .from('matches')
                .select('*')
                .eq('id', id)
                .single();

            setMatch(matchData);

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

    if (loading) return <div className="p-10 text-center">Caricamento...</div>;
    if (!match) return <div className="p-10 text-center">Partita non trovata.</div>;

    return (
        <div className="max-w-md mx-auto p-4">
            <h2 className="text-3xl font-black uppercase mb-2">{match.title}</h2>
            <div className="bg-blue-50 p-4 rounded-2xl mb-6">
                <p className="text-slate-600">📍 {match.location}</p>
                <p className="text-slate-600">⏰ {new Date(match.datetime).toLocaleString()}</p>
            </div>

            <h3 className="font-bold text-lg mb-4">Giocatori ({participants.length}/{match.max_players})</h3>

            {/* <div className="space-y-2">
                {participants.map((p, index) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-white border rounded-xl">
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center font-bold text-xs">
                            {index + 1}
                        </div>
                        <p className="font-medium text-slate-700">{p.profiles?.username || `Utente ${p.user_id.slice(0, 5)}...`}</p>
                        {p.user_id === match.creator_id && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-bold">ORG</span>
                        )}
                    </div>
                ))}
            </div> */}

            {/* Sezione Partecipanti nel return */}
            <div className="space-y-3">
                {participants.map((p, index) => (
                    <div
                        key={p.id}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${p.user_id === user.id ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white'
                            }`}
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
        </div>
    );
}