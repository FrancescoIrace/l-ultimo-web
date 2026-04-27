import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader, Calendar, Bell, Share2, UserPlus, UserMinus, Pencil, Trash2 } from 'lucide-react';
import { useAlert } from '../components/AlertComponent';
import { notifyMatchReminder, notifyMatchJoin } from '../lib/notificationService';
import { useReminderRateLimit } from '../hooks/useReminderRateLimit';

export default function MatchDetail({ user }) {
    const { id } = useParams();
    const [match, setMatch] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isJoined, setIsJoined] = useState(false);
    const navigate = useNavigate();
    const { alert, success, error, confirm, confirmDangerous } = useAlert();
    const { canSendReminder, recordReminder, isLoading: isRemindersLoading, setError: setReminderError } = useReminderRateLimit(id);
    const isMatchFinished = match ? new Date(match.datetime) < new Date() : false;
    const [selectedPlayer, setSelectedPlayer] = useState(null); // Memorizza il profilo da votare
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isCalendarMenuOpen, setIsCalendarMenuOpen] = useState(false);
    const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
    const [confirmedPlayers, setConfirmedPlayers] = useState([]);
    const [waitingPlayers, setWaitingPlayers] = useState([]);


    // Funzione per aprire la modal
    const openReviewModal = (player, id_target) => {
        //Controlliamo se l'utente che sta per recensiere ha partecipato alla partita (per sicurezza, anche se il pulsante è nascosto in caso contrario)
        const participated = participants.some(p => p.user_id === user.id);
        if (!participated) return;
        setSelectedPlayer({ ...player, id_target });
        setIsModalOpen(true);
    };

    // Funzione per chiudere e resettare
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedPlayer(null);
        setRating(5);
        setComment('');
    };


    useEffect(() => {
        // Chiudi i menu se si clicca fuori
        const handleClickOutside = (e) => {
            if (!e.target.closest('.calendar-menu-btn') && !e.target.closest('.calendar-menu')) {
                setIsCalendarMenuOpen(false);
            }
            if (!e.target.closest('.location-menu-btn') && !e.target.closest('.location-menu')) {
                setIsLocationMenuOpen(false);
            }
        };

        if (isCalendarMenuOpen || isLocationMenuOpen) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isCalendarMenuOpen, isLocationMenuOpen]);

    useEffect(() => {
        async function getDetails() {
            // 1. Prendi i dati della partita
            const { data: matchData } = await supabase
                .from('matches')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            setMatch(matchData);
            if (matchData) {
                const { data: participantData } = await supabase
                    .from('participants')
                    .select('*')
                    .eq('match_id', matchData.id)
                    .eq('user_id', user.id)
                    .maybeSingle();
                setIsJoined(!!participantData);
            }

            // 2. Partecipanti + Dati del Profilo (JOIN)
            const { data: partData, error: partError } = await supabase
                .from('participants')
                .select(`id, user_id,status, waitlist_order, profiles (username,avatar_url, gender)`) // JOIN con profiles per avere username e avatar dei partecipanti
                .eq('match_id', id);

            if (partError) console.error(partError);
            else {
                setParticipants(partData || []);
                setConfirmedPlayers(partData.filter(p => p.status === 'confirmed'));
                setWaitingPlayers(partData.filter(p => p.status === 'waiting')
                    .sort((a, b) => a.waitlist_order - b.waitlist_order));
            }

            setLoading(false);
        }
        getDetails();

        // Real-time subscription ai cambiamenti dei partecipanti (INSERT e DELETE) per aggiornare la lista senza ricaricare la pagina
        //Aggiunta controllo per i confermati e lista d'attesa per mantenere l'ordine corretto
        if (!id || !user?.id) return;

        const channel = supabase
            .channel(`match_participants_${id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Ascolta INSERT, UPDATE e DELETE
                    schema: 'public',
                    table: 'participants',
                    filter: `match_id=eq.${id}`,
                },
                async () => {
                    console.log('🔄 Cambiamento rilevato, ricarico i dati...');

                    // Riesegui la query completa per aggiornare tutti gli stati
                    const { data: partData, error: partError } = await supabase
                        .from('participants')
                        .select(`id, user_id, status, waitlist_order, profiles (username, avatar_url, gender)`)
                        .eq('match_id', id);

                    if (!partError && partData) {
                        setParticipants(partData);
                        setConfirmedPlayers(partData.filter(p => p.status === 'confirmed'));
                        setWaitingPlayers(partData.filter(p => p.status === 'waiting')
                            .sort((a, b) => a.waitlist_order - b.waitlist_order));

                        // Aggiorna isJoined cercando l'utente nei nuovi dati
                        const userSub = partData.find(p => p.user_id === user.id);
                        setIsJoined(!!userSub);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, user.id]);

    const handleLeave = async () => {
        if (match.creator_id === user.id) {
            error("Sei l'organizzatore, Non puoi uscire dalla partita a meno che non passi la partita a un altro giocatore. Per annullare la partita usa il pulsante dedicato.");
            return;
        }

        //Creiamo un messaggio di avviso diverso a seconda se fai parte dei confermati o della lista d'attesa
        const isConfirmed = confirmedPlayers.some(p => p.user_id === user.id);
        const isWaiting = waitingPlayers.some(p => p.user_id === user.id);
        const isWaitingListPopulated = waitingPlayers.length > 0 ? "(Entrerà un giocatore della lista d'attesa)" : "(Lista d'attesa vuota)";


        if (isConfirmed) {
            // Calcola il tempo rimanente prima della partita
            const now = new Date();
            const matchTime = new Date(match.datetime);
            const timeUntilMatch = matchTime - now;
            const hoursUntilMatch = timeUntilMatch / (1000 * 60 * 60);

            // Determina il messaggio in base al tempo rimanente
            let warningMessage = `Vuoi davvero abbandonare la partita? ${isWaitingListPopulated}`;
            if (hoursUntilMatch <= 1) {
                warningMessage = `⚠️ Manca meno di 1 ora alla partita! Sei sicuro di voler abbandonare? ${isWaitingListPopulated}`;
            } else if (hoursUntilMatch <= 4) {
                warningMessage = `⚠️ Mancano meno di 4 ore alla partita! Sei sicuro di voler abbandonare? ${isWaitingListPopulated}`;
            } else if (hoursUntilMatch <= 8) {
                warningMessage = `⚠️ Mancano meno di 8 ore alla partita! Sei sicuro di voler abbandonare? ${isWaitingListPopulated}`;
            }

            confirmDangerous(warningMessage, async () => {
                try {
                    // 1. Rimuovi dai partecipanti
                    const { error: partError } = await supabase
                        .from('participants')
                        .delete()
                        .eq('match_id', id)
                        .eq('user_id', user.id);

                    if (partError) {
                        console.error('❌ Errore delete partecipante:', partError);
                        error('Errore durante l\'abbandono: ' + partError.message);
                        return;
                    }

                    success('Hai abbandonato la partita!');
                } catch (err) {
                    console.error('❌ Errore generale:', err);
                    error('Errore: ' + err.message);
                }
            });
        } else if (isWaiting) {
            confirm('Sei in lista d\'attesa. Vuoi rimuovere la tua richiesta di partecipazione?', async () => {
                const { error: partError } = await supabase
                    .from('participants')
                    .delete()
                    .eq('match_id', id)
                    .eq('user_id', user.id);

                if (partError) {
                    console.error('❌ Errore uscita da lista d\'attesa:', partError);
                    error('Errore durante l\'abbandono: ' + partError.message);
                    return;
                } else {
                    success('✅ Hai rimosso la tua richiesta di partecipazione!');
                }
            });
        }
    };

    const handleDeleteMatch = async () => {
        confirmDangerous("Sei l'organizzatore. Vuoi annullare definitivamente la partita?", async () => {
            const { error: deleteError } = await supabase
                .from('matches')
                .delete()
                .eq('id', id);

            if (!deleteError) {
                success('Partita annullata!');
                setTimeout(() => navigate('/'), 1000);
            } else {
                error('Errore durante l\'annullamento della partita');
            }
        });
    };

    const handleShare = async () => {
        if (!match?.is_public) {
            const { error: publicError } = await supabase
                .from('matches')
                .update({ is_public: true })
                .eq('id', match.id);

            if (publicError) {
                error('Non è stato possibile rendere la partita visibile pubblicamente.');
                console.error('Errore impostazione is_public:', publicError);
                return;
            }

            setMatch(prev => (prev ? { ...prev, is_public: true } : prev));
        }

        //le icone vanno messe qui
        const shareText = `Partecipa a ${match.title} il ${new Date(match.datetime).toLocaleString('it-IT').slice(0, -3)} a ${match.location}.
Scopri di più qui: ${window.location.href}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: match.title,
                    text: shareText,
                });
                success('Link condiviso con successo!');
            } catch (shareError) {
                if (shareError.name !== 'AbortError') {
                    error('Impossibile condividere al momento.');
                }
            }
            return;
        }

        const shareFallback = async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(shareText);
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = shareText;
                    textarea.style.position = 'fixed';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                }
                success('Link copiato negli appunti!');
            } catch (copyError) {
                error('Copia non riuscita. Prova manualmente.');
            }
        };

        await shareFallback();
    };

    const handleSendReminders = async () => {
        const { canSend, nextResetIn } = canSendReminder();

        // if (!canSend) {
        //     const minutes = Math.floor(nextResetIn / 60);
        //     const seconds = nextResetIn % 60;
        //     const timeFormatted = `${minutes} minuti e ${seconds.toString().padStart(2, '0')} secondi`;
        //     error(`Puoi inviare un reminder ogni 30 minuti. Riprova tra ${timeFormatted}`);
        //     return;
        // }

        confirm('Inviare il reminder a tutti i partecipanti?', async () => {
            try {
                // Estrai gli ID dei partecipanti ESCLUSO il creatore
                let participantIds = participants
                    .map(p => p.user_id)
                    .filter(id => id !== match.creator_id);

                // Calcola le ore rimanenti
                const now = new Date();
                const matchTime = new Date(match.datetime);
                const hoursLeft = Math.ceil((matchTime - now) / (1000 * 60 * 60));

                // Invia i reminder
                const result = await notifyMatchReminder(id, match.title, hoursLeft, participantIds);

                // Registra nel rate limit
                recordReminder();

                success(`Reminder inviato a ${participantIds.length} partecipanti!`);
            } catch (err) {
                console.error('Errore nell\'invio del reminder:', err);
                error('Errore nell\'invio del reminder: ' + err.message);
            }
        });
    };

    const handleJoin = async () => {
        // Chiamiamo la RPC che gestisce tutto: controllo posti, inserimento, incremento e notifiche
        const { data: status, error: rpcError } = await supabase.rpc('join_match_v2', {
            p_match_id: match.id,
            p_user_id: user.id,
            p_username: user.user_metadata?.username || 'Un giocatore'
        });

        if (rpcError) {
            error("Errore durante l'iscrizione: " + rpcError.message);
            return;
        }

        // Gestiamo il feedback all'utente in base a cosa ha deciso il database
        switch (status) {
            case 'confirmed':
                success("Iscritto con successo! Sei in campo.");
                break;
            case 'waiting':
                success("Partita piena: sei stato inserito in lista d'attesa.");
                break;
            case 'already_registered':
                error("Sei già iscritto a questa partita.");
                break;
            default:
                success("Richiesta elaborata.");
        }

        // Non serve chiamare manualmente increment_match_players o notifyMatchJoin
        // perché lo fa già la funzione SQL join_match_v2!
    };


    const submitReview = async (targetId, rating, comment) => {
        const { error: reviewError } = await supabase
            .from('reviews')
            .insert({
                reviewer_id: user.id,
                target_id: targetId,
                match_id: match.id,
                rating: rating,
                comment: comment
            });

        if (reviewError) {
            if (reviewError.code === '23505') {
                error("Hai già recensito questo giocatore per questa partita!");
            } else {
                error("Errore: " + reviewError.message);
            }
        } else {
            success("Recensione inviata!");
        }
    };

    // Funzioni per salvare nel calendario
    const generateGoogleCalendarUrl = () => {
        if (!match) return '';
        const startTime = new Date(match.datetime).toISOString().replace(/-|:|\.\d{3}/g, '');
        const endTime = new Date(new Date(match.datetime).getTime() + 60 * 60000).toISOString().replace(/-|:|\.\d{3}/g, ''); // +60 minuti
        const dettagli = `INFORMAZIONI DELLA PARTITA:\n 📅 ${match.datetime}\n📝 ${match.description}\n📍 ${match.location}`;

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: match.title,
            details: dettagli,
            location: match.location,
            dates: `${startTime}/${endTime}`
        });

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    };

    const downloadICalendar = () => {
        if (!match) return;

        const startTime = new Date(match.datetime);
        const endTime = new Date(startTime.getTime() + 90 * 60000); // +90 minuti

        const formatICalDate = (date) => {
            return date.toISOString().replace(/-|:|\.\d{3}/g, '');
        };

        const icalContent = `BEGIN:VCALENDAR
        VERSION:2.0
        PRODID:-//L'Ultimo//L'Ultimo App//EN
        CALSCALE:GREGORIAN
        BEGIN:VEVENT
        UID:${match.id}@lultimo.app
        DTSTAMP:${formatICalDate(new Date())}
        DTSTART:${formatICalDate(startTime)}
        DTEND:${formatICalDate(endTime)}
        SUMMARY:${match.title}
        DESCRIPTION:${match.description}
        LOCATION:${match.location}
        END:VEVENT
        END:VCALENDAR`;

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icalContent));
        element.setAttribute('download', `${match.title.replace(/\s+/g, '_')}.ics`);
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    // Funzioni per aprire il navigatore
    const generateGoogleMapsUrl = () => {
        if (!match) return '';
        if (match.location_lat && match.location_lng) {
            return `https://www.google.com/maps/search/?api=1&query=${match.location_lat},${match.location_lng}`;
        }
        return `https://www.google.com/maps/search/${encodeURIComponent(match.location)}`;
    };

    const generateAppleMapsUrl = () => {
        if (!match) return '';
        if (match.location_lat && match.location_lng) {
            return `https://maps.apple.com/?q=${match.location}&ll=${match.location_lat},${match.location_lng}`;
        }
        return `https://maps.apple.com/?q=${encodeURIComponent(match.location)}`;
    };

    const generateGeoSchemeUrl = () => {
        if (!match || !match.location_lat || !match.location_lng) return '';
        return `geo:${match.location_lat},${match.location_lng}?q=${encodeURIComponent(match.location)}`;
    };

    if (loading) return <div className="p-10 flex flex-col items-center text-center uppercase font-black"><Loader size={56} strokeWidth={1.75} color="blue" className='loader-spin' /><span>attendi...</span></div>;
    if (!match) return <div className="p-10 text-center">Partita non trovata <button onClick={() => navigate('/')} className="text-blue-500 underline">Torna alla Home</button></div>;

    return (
        <>
            <div className="max-w-md mx-auto p-4">
                <button
                    onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
                    type="button"
                    className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-gradient-to-br from-red-500 to-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                >
                    TORNA INDIETRO
                </button>
                <h2 className="text-3xl font-black uppercase mb-2">{match.title || match.sport}</h2>
                <div className="bg-blue-50 p-4 rounded-2xl mb-6">
                    <div className="relative location-menu-btn mb-3">
                        <button
                            onClick={() => setIsLocationMenuOpen(!isLocationMenuOpen)}
                            className="text-slate-600 capitalize cursor-pointer hover:text-blue-600 transition-colors active:scale-95 text-left w-full flex items-center gap-2"
                        >
                            <span>📍 {match.location}</span>
                            {(match.location_lat && match.location_lng) && <span className="text-xs text-blue-500">↗</span>}
                        </button>

                        {isLocationMenuOpen && (match.location_lat && match.location_lng) && (
                            <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 min-w-max location-menu">
                                <button
                                    onClick={() => {
                                        window.open(generateGoogleMapsUrl(), '_blank');
                                        setIsLocationMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors text-sm font-bold text-slate-700 first:rounded-t-2xl"
                                >
                                    🗺️ Apri su Google Maps
                                </button>
                                <button
                                    onClick={() => {
                                        window.open(generateAppleMapsUrl(), '_blank');
                                        setIsLocationMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors text-sm font-bold text-slate-700 border-t border-slate-100"
                                >
                                    🍎 Apri su Apple Maps
                                </button>
                                {generateGeoSchemeUrl() && (
                                    <button
                                        onClick={() => {
                                            window.location.href = generateGeoSchemeUrl();
                                            setIsLocationMenuOpen(false);
                                        }}
                                        className="block w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors text-sm font-bold text-slate-700 last:rounded-b-2xl border-t border-slate-100"
                                    >
                                        📍 Apri Navigatore
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="relative calendar-menu-btn mb-3">
                        <button
                            onClick={() => setIsCalendarMenuOpen(!isCalendarMenuOpen)}
                            className="text-slate-600 capitalize cursor-pointer hover:text-blue-600 transition-colors active:scale-95 text-left w-full flex items-center gap-2"
                        >
                            <span>⏰ {new Date(match.datetime).toLocaleString("it-IT", { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long' })}</span>
                            <Calendar size={16} className="text-blue-500" />
                        </button>

                        {isCalendarMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 min-w-max calendar-menu">
                                <button
                                    onClick={() => {
                                        window.open(generateGoogleCalendarUrl(), '_blank');
                                        setIsCalendarMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors text-sm font-bold text-slate-700 first:rounded-t-2xl"
                                >
                                    📅 Aggiungi a Google Calendar
                                </button>
                                <button
                                    onClick={() => {
                                        downloadICalendar();
                                        setIsCalendarMenuOpen(false);
                                    }}
                                    className="block w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors text-sm font-bold text-slate-700 last:rounded-b-2xl border-t border-slate-100"
                                >
                                    📥 Scarica file .ics
                                </button>
                            </div>
                        )}
                    </div>
                    <p className={`text-slate-600 mb-3 ${!match.description ? 'opacity-50' : ''}`}>📝 {match.description || 'Nessuna descrizione disponibile'}</p>
                </div>

                <h3 className="font-bold text-lg mb-4">Giocatori ({confirmedPlayers.length}/{match.max_players})</h3>

                {/* Sezione Confermati */}
                <div className="space-y-3">
                    {confirmedPlayers.map((p, index) => (

                        <div
                            key={p.id}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-95 transition-all cursor-pointer  ${p.user_id === user.id ? 'border-blue-200 bg-blue-50 ' : 'border-slate-100 bg-white'
                                }`}
                            onClick={() => { (p.user_id !== user.id) ? navigate(`/profile/${p.user_id}`) : navigate('/profile') }}
                        >
                            <div className="flex items-center gap-4">
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

                                {/* Bottone Feedback: appare solo se il match è finito E non sono io */}
                                {isMatchFinished && p.user_id !== user.id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openReviewModal(p.profiles, p.user_id); }} // Una funzione che apre un form
                                        className="text-[10px] font-black bg-slate-800 text-white px-3 py-1 rounded-full"
                                    >
                                        VOTA
                                    </button>
                                )}
                            </div>

                            {/* Tag Organizzatore */}
                            {p.user_id === match.creator_id && (
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-2xl uppercase shadow-sm relative -top-6 -right-4">
                                    Organizzatore
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Sezione Lista d'attesa */}
                {waitingPlayers.length > 0 && (
                    <>
                        <h3 className="font-bold text-lg mt-8 mb-4">Lista d'attesa ({waitingPlayers.length})</h3>
                        <div className="space-y-3">
                            {waitingPlayers.map((p, index) => (
                                <div
                                    key={p.id}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-95 transition-all cursor-pointer  ${p.user_id === user.id ? 'border-blue-200 bg-blue-50 ' : 'border-slate-100 bg-white'
                                        }`}
                                    onClick={() => { (p.user_id !== user.id) ? navigate(`/profile/${p.user_id}`) : navigate('/profile') }}
                                >
                                    <div className="flex items-center gap-4">
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
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* BOTTONI VARI */}
                <div className="mt-10 pt-6 border-t border-slate-100">
                    {match.datetime && new Date(match.datetime) < new Date() && (
                        <>
                            <div className='mb-2 text-center bg-yellow-50 border border-slate-200 rounded-2xl italic text-sm'>
                                <label>
                                    Questa partita è già avvenuta. Se hai partecipato, lascia un feedback agli altri giocatori!
                                </label>
                            </div>
                        </>

                    )}

                    {/* Azione principale — full width */}
                    {confirmedPlayers.some(p => p.user_id === user.id) ? (
                        <button
                            onClick={handleLeave}
                            disabled={isMatchFinished}
                            className="w-full cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                        >
                            <UserMinus size={24} />
                            Abbandona Partita
                        </button>
                    ) : waitingPlayers.some(p => p.user_id === user.id) ? (
                        <button
                            onClick={handleLeave}
                            disabled={isMatchFinished}
                            className="w-full cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                        >
                            <UserMinus size={24} />
                            Esci dalla Lista d'Attesa
                        </button>
                    ) : (
                        <button
                            disabled={isMatchFinished}
                            onClick={handleJoin}
                            className={`w-full cursor-pointer p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 ${
                                confirmedPlayers.length >= match.max_players
                                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white'
                                    : 'bg-gradient-to-br from-green-500 to-green-600 text-white'
                            }`}
                        >
                            <UserPlus size={24} />
                            {confirmedPlayers.length >= match.max_players ? "Unisciti alla Lista d'Attesa" : 'Unisciti Ora'}
                        </button>
                    )}

                    {/* Azioni secondarie — griglia 2 colonne */}
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <button
                            onClick={handleShare}
                            className="cursor-pointer bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800 p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 border border-slate-200 shadow-lg hover:shadow-xl transition-all active:scale-95"
                        >
                            <Share2 size={24} />
                            Condividi
                        </button>

                        {user.id === match.creator_id && (
                            <button
                                onClick={handleSendReminders}
                                disabled={isRemindersLoading}
                                className="cursor-pointer bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Bell size={24} />
                                Invia Reminder
                            </button>
                        )}
                    </div>

                    {user.id === match.creator_id && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <button
                                onClick={() => { navigate(`/modifica/${match.id}`) }}
                                className="cursor-pointer bg-gradient-to-br from-yellow-400 to-yellow-500 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                disabled={isMatchFinished}
                            >
                                <Pencil size={24} />
                                Modifica
                            </button>
                            <button
                                onClick={handleDeleteMatch}
                                className="cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Trash2 size={24} />
                                Annulla Partita
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">

                            {/* Header Modal */}
                            <div className="text-center mb-6">
                                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-2">Lascia un feedback a</p>
                                <h3 className="text-xl font-black uppercase">{selectedPlayer?.username}</h3>
                            </div>

                            <div className="flex flex-col items-center mb-6">
                                <label className="text-[10px] font-black uppercase text-slate-400 mb-2">Valutazione</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setRating(star)}
                                            className="focus:outline-none transition-transform active:scale-90"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                className={`w-10 h-10 transition-colors ${star <= rating ? 'text-yellow-400' : 'text-slate-200'
                                                    }`}
                                            >
                                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-md font-bold text-slate-400 italic">
                                    {rating === 5 && "Eccellente! 🏆"}
                                    {rating === 4 && "Ottimo compagno 👏"}
                                    {rating === 3 && "Buona partita 👍"}
                                    {rating === 2 && "Poteva andare meglio 😕"}
                                    {rating === 1 && "Esperienza negativa 👎"}
                                </p>
                            </div>

                            {/* Commento */}
                            <div className="mb-6">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Commento</label>
                                <textarea
                                    rows="3"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={`Com'è andata la partita con ${selectedPlayer?.username}?`}
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold text-sm resize-none"
                                />
                            </div>

                            {/* Azioni */}
                            <div className="flex gap-3">
                                <button
                                    onClick={closeModal}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={() => {
                                        submitReview(selectedPlayer?.id_target, rating, comment);
                                        closeModal();
                                    }}
                                    className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-blue-200"
                                >
                                    Invia
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}