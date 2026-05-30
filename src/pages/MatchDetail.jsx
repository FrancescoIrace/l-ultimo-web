import { Bell, Building2, Calendar, Loader, MapPin, Pencil, Share2, Trash2, UserMinus, UserPlus, ChevronRight, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAlert } from '../components/AlertComponent';
import MatchAttendanceManager from '../components/MatchAttendanceManager';
import { useReminderRateLimit } from '../hooks/useReminderRateLimit';
import { notifyMatchReminder } from '../lib/notificationService';
import { supabase } from '../lib/supabase';
import { getWeather, isWithinSevenDays } from '../lib/weatherService';

export default function MatchDetail({ user }) {
    const { id } = useParams();
    const [match, setMatch] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isJoined, setIsJoined] = useState(false);
    const navigate = useNavigate();
    const { alert, success, error, confirm, confirmDangerous } = useAlert();
    const { canSendReminder, recordReminder, isLoading: isRemindersLoading, setError: setReminderError } = useReminderRateLimit(id);
    const [selectedPlayer, setSelectedPlayer] = useState(null); // Memorizza il profilo da votare
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isCalendarMenuOpen, setIsCalendarMenuOpen] = useState(false);
    const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
    const [confirmedPlayers, setConfirmedPlayers] = useState([]);
    const [waitingPlayers, setWaitingPlayers] = useState([]);
    const [isMatchFinished, setIsMatchFinished] = useState(false);
    const [isMatchStarted, setIsMatchStarted] = useState(false);
    const [weatherData, setWeatherData] = useState(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(false);
    const [localTeams, setLocalTeams] = useState(null);
    const [isSavingTeams, setIsSavingTeams] = useState(false);

    const checkMatchStatus = (matchDatetime) => {
        const oraInizio = new Date(matchDatetime).getTime(); // Timestamp inizio match
        const oraAttuale = Date.now(); // Timestamp adesso

        const UN_ORA = 60 * 60 * 1000; // 60 minuti in millisecondi
        const TRENTA_MINUTI = 30 * 60 * 1000; // Per la tua idea del buffer

        // 1. La partita è iniziata? (Siamo oltre l'orario di inizio)
        const isMatchStarted = oraAttuale >= oraInizio;

        // 2. La partita è finita? (Assumendo duri 1 ora)
        const isMatchFinished = oraAttuale >= (oraInizio + UN_ORA);

        // 3. I bottoni sono ancora attivi? 
        // (Attivi fino a 30 minuti dopo l'inizio, come avevi chiesto)
        // const isButtonsActive = oraAttuale <= (oraInizio + TRENTA_MINUTI);

        // console.log('⏰ Ora attuale:', new Date(oraAttuale).toLocaleTimeString());
        // console.log('⏰ Ora inizio match:', new Date(oraInizio).toLocaleTimeString());
        // console.log('⏰ Ora fine match:', new Date(oraInizio + UN_ORA).toLocaleTimeString());
        // console.log('⏰ Match iniziato?', isMatchStarted);
        // console.log('⏰ Match finito?', isMatchFinished);
        // console.log('⏰ Ora fine bottoni:', new Date(oraInizio + TRENTA_MINUTI).toLocaleTimeString());
        return { isMatchStarted, isMatchFinished };
    };


    const getDetails = useCallback(async () => {
        setLoading(true);
        // 1. Prendi i dati della partita
        const { data: matchData } = await supabase
            .from('matches')
            .select(`
            *,
            sports_courts (
                name, sport_type, center_id, price_p_p,
                profiles (full_name, username)
            ),
            teams (
                id, name, logo_url, primary_color, secondary_color
            )
        `)
            .eq('id', id)
            .maybeSingle();

        if (!matchData) {
            setLoading(false);
            return;
        }

        // 2. Partecipanti + Dati del Profilo
        const { data: partData, error: partError } = await supabase
            .from('participants')
            .select(`id, user_id, status, waitlist_order, final_attendance, team_number, profiles (username, avatar_url, gender)`)
            .eq('match_id', id);

        if (partError) {
            console.error(partError);
            setLoading(false);
            return;
        }

        // Combina i dati
        const fullMatchData = {
            ...matchData,
            participants: partData || []
        };

        setMatch(fullMatchData);
        setParticipants(partData || []);
        setConfirmedPlayers(partData.filter(p => p.status === 'confirmed'));
        setWaitingPlayers(partData.filter(p => p.status === 'waiting').sort((a, b) => a.waitlist_order - b.waitlist_order));
        setIsJoined(!!partData.find(p => p.user_id === user.id));
        const { isMatchStarted, isMatchFinished } = checkMatchStatus(fullMatchData.datetime);
        setIsMatchStarted(isMatchStarted);
        setIsMatchFinished(isMatchFinished);
        // console.log('⏰ Stato partita aggiornato: ', { isMatchStarted, isMatchFinished });
        setLoading(false);
    }, [id, user.id]);

    // Funzione per aprire la modal
    const openReviewModal = (player, id_target) => {
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
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isCalendarMenuOpen, isLocationMenuOpen]);

    useEffect(() => {
        getDetails();

        if (!id || !user?.id) return;

        // CREIAMO UN UNICO CANALE PER LA PAGINA
        const matchChannel = supabase
            .channel(`match_page_${id}`)
            // 1. Sottoscrizione ai Partecipanti
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'participants',
                    filter: `match_id=eq.${id}`,
                },
                () => {
                    console.log('🔄 Cambio partecipanti rilevato, ricarico...');
                    getDetails();
                }
            )
            // 2. Sottoscrizione allo Stato Partita
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matches',
                    filter: `id=eq.${id}`
                },
                (payload) => {
                    console.log('✅ Stato partita aggiornato:', payload.new);
                    setMatch((prevMatch) => ({
                        ...prevMatch,
                        ...payload.new
                    }));
                }
            )
            // 3. SUBSCRIBE
            .subscribe();

        return () => {
            supabase.removeChannel(matchChannel);
        };

    }, [id, user.id, getDetails]);

    // Fetch dati meteo se la partita è entro i prossimi 7 giorni
    useEffect(() => {
        if (!match || !match.location_lat || !match.location_lng || !match.datetime) return;

        const date = new Date(match.datetime.replace(' ', 'T'));

        // Verifica se la partita è entro 7 giorni
        if (!isWithinSevenDays(date)) return;

        const fetchWeather = async () => {
            setIsLoadingWeather(true);
            try {
                const weather = await getWeather(match.location_lat, match.location_lng, date);
                setWeatherData(weather);
            } catch (err) {
                console.error('Errore nel fetch dei dati meteo:', err);
            } finally {
                setIsLoadingWeather(false);
            }
        };

        fetchWeather();
    }, [match?.location_lat, match?.location_lng, match?.datetime]);

    const handleSetTeamLocal = (participantId, teamNumber) => {
        setLocalTeams(prev => {
            const currentTeams = prev || confirmedPlayers.reduce((acc, p) => {
                acc[p.id] = p.team_number;
                return acc;
            }, {});
            return {
                ...currentTeams,
                [participantId]: teamNumber
            };
        });
    };

    const generateRandomTeamsLocal = () => {
        if (!confirmedPlayers.length) return;
        
        const shuffled = [...confirmedPlayers].sort(() => 0.5 - Math.random());
        const half = Math.ceil(shuffled.length / 2);
        
        const currentTeams = localTeams || confirmedPlayers.reduce((acc, p) => {
            acc[p.id] = p.team_number;
            return acc;
        }, {});

        const newTeams = { ...currentTeams };
        shuffled.forEach((p, index) => {
            newTeams[p.id] = index < half ? 1 : 2;
        });

        setLocalTeams(newTeams);
    };

    const handleSaveTeams = async () => {
        if (!localTeams) return;
        setIsSavingTeams(true);
        
        const payload = confirmedPlayers.map(p => ({
            id: p.id,
            match_id: id,
            user_id: p.user_id,
            team_number: localTeams[p.id] !== undefined ? localTeams[p.id] : p.team_number,
            status: p.status
        }));

        try {
            const { error: bulkError } = await supabase
                .from('participants')
                .upsert(payload, { onConflict: 'id' });

            if (bulkError) throw bulkError;
            success("Squadre salvate con successo!");
            setLocalTeams(null);
        } catch (err) {
            console.error('Errore salvataggio squadre:', err);
            error("Errore durante il salvataggio delle squadre");
        } finally {
            setIsSavingTeams(false);
        }
    };

    const handleCancelEditTeams = () => {
        setLocalTeams(null);
    };

    const handleLeave = async () => {
        if (match.creator_id === user.id) {
            error("Sei l'organizzatore, Non puoi uscire dalla partita. Per annullare la partita usa il pulsante dedicato.");
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

            // Controlla se aveva già confermato la presenza
            const myParticipant = confirmedPlayers.find(p => p.user_id === user.id);
            const hadConfirmed = myParticipant?.final_attendance === true;

            // Determina il messaggio in base al tempo rimanente
            let warningMessage = `Vuoi davvero abbandonare la partita? ${isWaitingListPopulated}`;
            if (hadConfirmed) {
                warningMessage = `⚠️ Avevi già confermato la tua presenza! Sei sicuro di voler abbandonare? ${isWaitingListPopulated}`;
            } else if (hoursUntilMatch <= 1) {
                warningMessage = `⚠️ Manca meno di 1 ora alla partita! Sei sicuro di voler abbandonare? ${isWaitingListPopulated}`;
            } else if (hoursUntilMatch <= 4) {
                warningMessage = `⚠️ Mancano meno di 4 ore alla partita! Sei sicuro di voler abbandonare? ${isWaitingListPopulated}`;
            } else if (hoursUntilMatch <= 8) {
                warningMessage = `⚠️ Mancano meno di 8 ore alla partita! Sei sicuro di voler abbandonare? ${isWaitingListPopulated}`;
            }

            confirmDangerous(warningMessage, async () => {
                try {
                    const username = user.user_metadata?.username || 'Un giocatore';

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

                    // 2. Se aveva confermato, notifica tutti gli altri partecipanti
                    if (hadConfirmed) {
                        const otherParticipantIds = confirmedPlayers
                            .map(p => p.user_id)
                            .filter(uid => uid !== user.id);

                        if (otherParticipantIds.length > 0) {
                            const notifications = otherParticipantIds.map(uid => ({
                                user_id: uid,
                                sender_id: user.id,
                                type: 'MATCH_LEAVE',
                                message: `${username} ha abbandonato la partita dopo la conferma.`,
                                related_match_id: id,
                            }));
                            await supabase.from('notifications').insert(notifications);
                        }
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
        confirmDangerous(isMatchFinished ? "Sicuro di voler eliminare la partita? non apparirà nel tuo storico" : "Sei l'organizzatore. Vuoi annullare definitivamente la partita?", async () => {
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
        const shareText = `Partecipa a ${match.title} il ${new Date(match.datetime).toLocaleString().slice(0, -3)} a ${match.location}.
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

    const handleSendRequest = async () => {
        if (!match.court_id) return;

        try {
            const { error: updateError } = await supabase
                .from('matches')
                .update({ 
                    reservation_status: 'requested',
                    request_count: (match.request_count || 0) + 1 
                })
                .eq('id', match.id);

            if (updateError) throw updateError;

            success("Richiesta inviata al centro sportivo!");
            getDetails(); // Ricarica i dati per aggiornare UI
        } catch (err) {
            console.error("Errore nell'invio della richiesta:", err);
            error("Ops! Si è verificato un errore durante l'invio.");
        }
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
        // Per timestamp locale, formatta senza convertire a UTC
        const date = new Date(match.datetime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        const startTime = `${year}${month}${day}T${hours}${minutes}${seconds}`;
        const endDate = new Date(date.getTime() + 60 * 60000);
        const endHours = String(endDate.getHours()).padStart(2, '0');
        const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
        const endSeconds = String(endDate.getSeconds()).padStart(2, '0');
        const endTime = `${year}${month}${day}T${endHours}${endMinutes}${endSeconds}`;
        const dettagli = `INFORMAZIONI DELLA PARTITA:\n 📅 ${match.datetime}\n📝 ${match.description ? `${match.description.slice(0, 32)}...` : "Nessuna nota"}\n📍 ${match.location}`;

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
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            // Formato locale senza Z (timestamp)
            return `${year}${month}${day}T${hours}${minutes}${seconds}`;
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
        DESCRIPTION:${match.description.length > 64 ? `${match.description.slice(0, 64)}...` : match.description}
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
                {/* <button
                    onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/partite')}
                    type="button"
                    className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-gradient-to-br from-red-500 to-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                >
                    TORNA INDIETRO
                </button> */}
                <button
                    onClick={() => navigate("/partite")}
                    type="button"
                    className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
                >
                    <ChevronRight size={14} className="rotate-180" />
                    Indietro
                </button>

                {/* TITOLO DELLA PARTITA */}
                <h2 className="text-3xl font-black uppercase mb-2 break-words">{match.title || match.sport}</h2>

                {match.court_id && (
                    <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-4 ${match.reservation_status === 'confirmed' ? 'bg-green-50 border-green-100' :
                        match.reservation_status === 'rejected' ? 'bg-red-50 border-red-100' :
                            'bg-amber-50 border-amber-100'
                        }`}>
                        {/* Icona dinamica in base allo stato */}
                        <div className={`p-3 rounded-xl ${match.reservation_status === 'confirmed' ? 'bg-green-600 text-white' :
                            match.reservation_status === 'rejected' ? 'bg-red-600 text-white' :
                                'bg-amber-500 text-white'
                            }`}>
                            <Building2 size={24} />
                        </div>


                        <div className="flex-1">
                            {/* Nome del Centro Sportivo */}
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">
                                Prenotazione presso
                            </p>
                            <h3
                                onClick={() => navigate(`/profile/${match.sports_courts.center_id}`)}
                                className="font-bold text-slate-800 text-lg leading-tight cursor-pointer hover:text-blue-600 transition-colors"
                            >
                                {match.sports_courts?.profiles?.username}
                            </h3>

                            {/* Nome del Campo specifico */}
                            <div className="flex items-center gap-2 mt-1 text-slate-600">
                                <MapPin size={14} className="text-blue-500" />
                                <span className="text-sm font-medium">{match.sports_courts?.name} ({match.sports_courts?.sport_type})</span>
                            </div>
                            
                            {/* Prezzo per Persona */}
                            {match.sports_courts?.price_p_p != null && (
                                <div className="flex items-center gap-2 mt-1 text-slate-600">
                                    <span className="font-black text-blue-600 text-sm">{match.sports_courts.price_p_p}€ <span className="text-[10px] font-bold text-slate-400 uppercase">/ persona</span></span>
                                </div>
                            )}

                            {/* Badge di Stato */}
                            <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${match.reservation_status === 'confirmed' ? 'bg-green-200 text-green-800' :
                                match.reservation_status === 'rejected' ? 'bg-red-200 text-red-800' :
                                    'bg-amber-200 text-amber-800'
                                }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${match.reservation_status === 'confirmed' ? 'bg-green-600' :
                                    match.reservation_status === 'rejected' ? 'bg-red-600' :
                                        'bg-amber-600 animate-pulse'
                                    }`} />
                                {match.reservation_status === 'confirmed' && "Campo Confermato"}
                                {match.reservation_status === 'rejected' && "Prenotazione Rifiutata"}
                                {match.reservation_status === 'requested' && "In attesa del centro..."}
                                {match.reservation_status === 'draft' && "BOZZA - DA INVIARE"}
                            </div>
                        </div>
                    </div>
                )}

                {/* Team Info (se presente team_id) */}
                {match.teams && (
                    <div className="mb-6 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-95" onClick={() => navigate(`/squadre/${match.teams.id}`)}>
                        <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: match.teams.primary_color || '#4f46e5' }}></div>
                        <div className={`w-12 h-12 rounded-xl overflow-hidden ${match.teams.primary_color && match.teams.secondary_color ? `bg-gradient-to-br from-[${match.teams.primary_color}] to-[${match.teams.secondary_color}]` : 'bg-gradient-to-br from-blue-500 to-indigo-600'} flex-shrink-0 border border-slate-100 shadow-sm flex justify-center items-center`}>
                            {match.teams.logo_url ? (
                                <img src={match.teams.logo_url} alt={match.teams.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="font-bold text-xl text-white">{match.teams.name.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-0.5 block flex items-center gap-1">
                                🛡️ ORGANIZZATO DAL TEAM
                            </span>
                            <h3 className="font-bold text-slate-800 text-base truncate pr-2">
                                {match.teams.name}
                            </h3>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
                    </div>
                )}

                {/* Box Meteo */}
                {weatherData && !isLoadingWeather && (
                    <div
                        onClick={() => window.open(`https://www.meteoblue.com/it/weather/forecast/${match.location_lat},${match.location_lng}`, '_blank')}
                        className={`mb-6 p-4 rounded-2xl ${weatherData.rainProbability < 30 ? 'bg-blue-50 border-blue-100' : weatherData.rainProbability < 60 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'} bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 shadow-md cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all active:scale-95`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
                                ✨ Previsioni Meteo
                            </h3>
                            <RefreshCw size={14} className="text-blue-400 opacity-60" title="Dati in tempo reale da Open-Meteo" />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-4xl">{weatherData.emoji}</span>
                            <div className="flex-1">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-2xl font-black text-slate-800">{weatherData.temperature}°C</span>
                                    <span className="text-sm text-slate-600 font-medium">{weatherData.description}</span>
                                </div>
                                <div className="flex items-center gap-1 text-sm text-blue-600 font-semibold">
                                    <span>💧 Probabilità pioggia:</span>
                                    <span className={weatherData.rainProbability > 60 ? 'text-red-500 font-black' : ''}>
                                        {weatherData.rainProbability}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isLoadingWeather && (
                    <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-blue-500" />
                        <span className="text-sm text-blue-600 font-semibold">Caricamento meteo...</span>
                    </div>
                )}



                <div className="bg-blue-50 p-4 rounded-2xl mb-6">
                    <div className="relative location-menu-btn mb-3">
                        <button
                            onClick={() => setIsLocationMenuOpen(!isLocationMenuOpen)}
                            className="text-slate-600 capitalize cursor-pointer hover:text-blue-600 transition-colors active:scale-95 text-left w-full flex items-center gap-2"
                        >
                            <span>📍 {match.location}</span>
                            {(match.location_lat && match.location_lng) && <span className="text-xs text-blue-500">↗</span>}
                            {match.sports_courts && (
                                <p className="text-xs text-blue-600 font-bold uppercase tracking-tight">
                                    {match.sports_courts.name}
                                </p>
                            )}
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
                    <p className={`text-slate-600 mb-3 break-words ${!match.description ? 'opacity-50' : ''} `}>📝 {match.description || 'Nessuna descrizione disponibile'}</p>
                </div>

                {isMatchStarted && !isMatchFinished && (
                    <div className='mb-4 text-center bg-green-500 border border-green-200 rounded-2xl italic text-2xl animate-pulse text-white font-black'>
                        <label>
                            PARTITA IN CORSO !!
                        </label>
                    </div>
                )}

                {/* Blocco Gestione Richiesta Campo per Organizzatore */}
                {match?.creator_id === user.id && match?.court_id && (
                    <div className={`mb-6 p-4 border rounded-3xl ${match.reservation_status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                        <h4 className={`text-sm font-black uppercase mb-3 flex items-center gap-2 ${match.reservation_status === 'rejected' ? 'text-red-700' : 'text-slate-700'}`}>
                            <span>🏢</span> Stato Prenotazione Campo
                        </h4>
                        {(() => {
                            // Soglia minima: metà dei giocatori totali arrotondata per eccesso
                            const requiredPlayers = Math.ceil(match.max_players / 2);
                            const requestCount = match.request_count || 0;
                            const status = match.reservation_status;
                            
                            if (status === 'confirmed') {
                                return (
                                    <div className="w-full py-3 bg-green-100 text-green-700 border border-green-200 rounded-xl font-bold tracking-tight text-center flex items-center justify-center gap-2 shadow-sm">
                                        ✅ Prenotazione Confermata dal Gestore
                                    </div>
                                );
                            }

                            if (confirmedPlayers.length < requiredPlayers) {
                                return (
                                    <button disabled className="w-full py-3 bg-slate-200 text-slate-400 rounded-xl font-bold shadow-sm cursor-not-allowed text-xs sm:text-sm transition-all">
                                        Raccogli più giocatori per inviare la richiesta ({confirmedPlayers.length}/{requiredPlayers})
                                    </button>
                                );
                            }
                            
                            if (status === 'requested') {
                                return (
                                    <button disabled className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold shadow-md shadow-amber-200 cursor-wait flex items-center justify-center gap-2 transition-all">
                                        <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
                                        In attesa del gestore...
                                    </button>
                                );
                            }

                            if (requestCount >= 3 && status === 'rejected') {
                                return (
                                    <>
                                        <div className="mb-3 text-sm text-red-700 bg-white/50 p-3 rounded-xl border border-red-100 shadow-sm leading-tight">
                                            <p className="font-bold mb-1">❌ Il centro sportivo ha rifiutato la richiesta per il seguente motivo:</p>
                                            <p className="italic opacity-80">{match.rejection_reason || "Nessun motivo specificato."}</p>
                                        </div>
                                        <button disabled className="w-full py-3 bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold shadow-sm cursor-not-allowed transition-all">
                                            Limite richieste esaurito (Hai superato i 3 tentativi)
                                        </button>
                                    </>
                                );
                            }

                            if (status === 'draft' || status === 'rejected') {
                                return (
                                    <>
                                        {status === 'rejected' && (
                                            <div className="mb-3 text-sm text-red-700 bg-white/50 p-3 rounded-xl border border-red-100 shadow-sm leading-tight">
                                                <p className="font-bold mb-1">❌ Il centro sportivo ha rifiutato la richiesta per il seguente motivo:</p>
                                                <p className="italic opacity-80">{match.rejection_reason || "Nessun motivo specificato."}</p>
                                            </div>
                                        )}
                                        <button 
                                            onClick={handleSendRequest}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex flex-col items-center justify-center gap-1"
                                        >
                                            <span className="flex items-center gap-2">🚀 {status === 'rejected' ? 'Riprova Invia Richiesta' : 'Invia Richiesta al Centro Sportivo'}</span>
                                            <span className="text-[10px] uppercase tracking-wider font-black opacity-80">
                                                {3 - requestCount} {3 - requestCount === 1 ? 'tentativo' : 'tentativi'} rimasti
                                            </span>
                                        </button>
                                    </>
                                );
                            }

                            return null;
                        })()}
                    </div>
                )}

                <MatchAttendanceManager match={match} user={user} onUpdate={getDetails} />

                <h3 className="font-bold text-lg mb-4">Giocatori ({confirmedPlayers.length}/{match.max_players})</h3>

                {/* Controlli Organizzatore per Random e Salvataggio */}
                {user.id === match?.creator_id && confirmedPlayers.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4">
                        <button
                            onClick={generateRandomTeamsLocal}
                            className={`w-full py-3 active:scale-95 transition-all text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 ${localTeams ? 'bg-indigo-500 shadow-indigo-200' : 'bg-indigo-600 shadow-indigo-300'}`}
                        >
                            <RefreshCw size={18} /> Genera Squadre Casuali
                        </button>
                        
                        {localTeams && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelEditTeams}
                                    className="flex-1 py-3 bg-red-100 hover:bg-red-200 text-red-600 active:scale-95 transition-all rounded-xl font-bold font-sm"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={handleSaveTeams}
                                    disabled={isSavingTeams}
                                    className="flex-[2] py-3 bg-green-500 hover:bg-green-600 active:scale-95 transition-all text-white rounded-xl font-bold shadow-lg shadow-green-200 flex justify-center items-center gap-2"
                                >
                                    {isSavingTeams ? <Loader className="animate-spin" size={18} /> : 'Salva Modifiche Squadre'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Funzione di utilità per renderizzare un singolo giocatore */}
                {(() => {
                    const activePlayers = localTeams ? confirmedPlayers.map(p => ({
                        ...p,
                        team_number: localTeams[p.id] !== undefined ? localTeams[p.id] : p.team_number
                    })) : confirmedPlayers;

                    const renderPlayer = (p) => (
                        <div
                            key={p.id}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-95 cursor-pointer ${
                                p.user_id === user.id ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white'
                            }`}
                            onClick={() => { p.user_id !== user.id ? navigate(`/profile/${p.user_id}`) : navigate('/profile') }}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-500 overflow-hidden flex-shrink-0 ${p.final_attendance ? 'ring-2 ring-green-400 ring-offset-2' : ''}`}>
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
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                                            {p.profiles?.gender === 'M' ? 'Uomo' : p.profiles?.gender === 'F' ? 'Donna' : 'Player'}
                                        </p>
                                        {p.final_attendance && (
                                            <span className="text-[10px] font-black uppercase tracking-wide text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                                ✓ presente
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isMatchFinished && p.user_id !== user.id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openReviewModal(p.profiles, p.user_id); }}
                                        className="text-[10px] font-black bg-slate-800 text-white px-3 py-1 rounded-full"
                                    >
                                        VOTA
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                {p.user_id === match.creator_id && (
                                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold">👑 Organizzatore</span>
                                )}
                                
                                {user.id === match.creator_id && (
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <button 
                                            onClick={() => handleSetTeamLocal(p.id, 1)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-xl font-black text-sm transition-all shadow-sm ${p.team_number === 1 ? 'bg-blue-600 text-white shadow-blue-200 ring-2 ring-blue-300 ring-offset-1' : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'}`}
                                        >
                                            A
                                        </button>
                                        <button 
                                            onClick={() => handleSetTeamLocal(p.id, 2)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-xl font-black text-sm transition-all shadow-sm ${p.team_number === 2 ? 'bg-slate-700 text-white shadow-slate-300 ring-2 ring-slate-400 ring-offset-1' : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'}`}
                                        >
                                            B
                                        </button>
                                         <button 
                                            onClick={() => handleSetTeamLocal(p.id, null)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-xl font-black text-sm transition-all shadow-sm ${!p.team_number ? 'bg-gray-400 text-white ring-2 ring-gray-300 ring-offset-1' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
                                            title="Rimuovi da squadra"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );

                    const team1Players = activePlayers.filter(p => p.team_number === 1);
                    const team2Players = activePlayers.filter(p => p.team_number === 2);
                    const unassignedPlayers = activePlayers.filter(p => !p.team_number || p.team_number === 0);

                    return (
                        <div className="space-y-4">
                            {/* Team 1  */}
                            {team1Players.length > 0 && (
                                <div className="bg-white rounded-2xl shadow-sm p-4 border border-blue-200">
                                    <h4 className="font-bold text-md text-blue-600 mb-3 flex justify-between items-center">
                                        <span>Squadra A (Colorati)</span>
                                        <span className="text-sm bg-blue-100 px-2 py-1 rounded-full">{team1Players.length}/{Math.ceil(match.max_players / 2)}</span>
                                    </h4>
                                    <div className="space-y-3">
                                        {team1Players.map(renderPlayer)}
                                    </div>
                                </div>
                            )}
                            
                            {(team1Players.length > 0 && team2Players.length > 0) && (
                                <div className="flex justify-center my-2">
                                     <span className="font-black italic text-slate-300 text-2xl">VS</span>
                                </div>
                            )}

                            {/* Team 2 */}
                            {team2Players.length > 0 && (
                                <div className="bg-white rounded-2xl shadow-sm p-4 border border-slate-200">
                                    <h4 className="font-bold text-md text-slate-600 mb-3 flex justify-between items-center">
                                        <span>Squadra B (Bianchi)</span>
                                        <span className="text-sm bg-slate-100 px-2 py-1 rounded-full">{team2Players.length}/{Math.floor(match.max_players / 2)}</span>
                                    </h4>
                                    <div className="space-y-3">
                                        {team2Players.map(renderPlayer)}
                                    </div>
                                </div>
                            )}

                            {/* Unassigned */}
                            {unassignedPlayers.length > 0 && (
                                <div className="bg-white rounded-2xl shadow-sm p-4 border border-dashed border-slate-300 mt-4">
                                    <h4 className="font-bold text-sm text-slate-500 mb-3 flex justify-between items-center">
                                        <span>In attesa di assegnazione</span>
                                        <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">{unassignedPlayers.length}</span>
                                    </h4>
                                    <div className="space-y-3">
                                        {unassignedPlayers.map(renderPlayer)}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

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

                    {isMatchFinished && (
                        <div className='mb-2 text-center bg-yellow-50 border border-yellow-200 rounded-2xl italic text-sm'>
                            <label>
                                Questa partita è già avvenuta. Se hai partecipato, lascia un feedback agli altri giocatori!
                            </label>
                        </div>
                    )}




                    {/* Azione principale — full width */}

                    {confirmedPlayers.some(p => p.user_id === user.id) ? (
                        <button
                            onClick={handleLeave}
                            disabled={isMatchFinished || (isMatchStarted && !isMatchFinished)}
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
                            className={`w-full cursor-pointer p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 ${confirmedPlayers.length >= match.max_players
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
                                disabled={isMatchFinished || isRemindersLoading}
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
                                disabled={isMatchFinished || isMatchStarted}
                            >
                                <Pencil size={24} />
                                Modifica
                            </button>
                            <button
                                onClick={handleDeleteMatch}
                                className="cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                disabled={isMatchFinished || isMatchStarted}
                            >
                                <Trash2 size={24} />
                                Elimina Partita
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