import { Bell, Building2, Calendar, MapPin, Pencil, Share2, Trash2, UserMinus, UserPlus, CircleQuestionMark, ChevronRight, RefreshCw, Info, Crown, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAlert } from '../components/AlertComponent';
import MatchAttendanceManager from '../components/MatchAttendanceManager';
import MatchMessageThread from '../components/MatchMessageThread';
import RescheduleRequestModal from '../components/RescheduleRequestModal';
import { useReminderRateLimit } from '../hooks/useReminderRateLimit';
import { notifyMatchJoin, notifyMatchReminder, notifyMatchFull, notifyMatchSpotFreed, notifyWaitlistPromoted, notifyOrganizerSpotFilled, notifyMatchCancelled, notifyReviewReceived, notifyReservationRequest, notifyMatchKicked, notifyMatchInvite } from '../lib/notificationService';
import { supabase } from '../lib/supabase';
import { getWeather, isWithinSevenDays } from '../lib/weatherService';
import { getSportFamily } from '../lib/sportRoles';
import { teamLabel } from './PagesUtils/utils';
import Loader from '../components/Loader';

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
    const [participantRoles, setParticipantRoles] = useState({}); // { user_id: [role, ...] }
    const [weatherData, setWeatherData] = useState(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(false);
    const [alertTemperatura, setAlertTemperatura] = useState("");
    const [localTeams, setLocalTeams] = useState(null);
    const [isSavingTeams, setIsSavingTeams] = useState(false);
    const [tooltipActive, setTooltipActive] = useState(false);
    const [team1NameLocal, setTeam1NameLocal] = useState('');
    const [team2NameLocal, setTeam2NameLocal] = useState('');
    const [isMessageThreadOpen, setIsMessageThreadOpen] = useState(false);
    const [rescheduleRequest, setRescheduleRequest] = useState(null);
    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteFriends, setInviteFriends] = useState([]);
    const [selectedInviteFriends, setSelectedInviteFriends] = useState(new Set());
    const [isSendingInvites, setIsSendingInvites] = useState(false);


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
        setTeam1NameLocal(fullMatchData.team1_name || '');
        setTeam2NameLocal(fullMatchData.team2_name || '');
        setParticipants(partData || []);
        setConfirmedPlayers(partData.filter(p => p.status === 'confirmed'));
        setWaitingPlayers(partData.filter(p => p.status === 'waiting').sort((a, b) => a.waitlist_order - b.waitlist_order));
        setIsJoined(!!partData.find(p => p.user_id === user.id));

        // Ruoli preferiti dei partecipanti per lo sport di questa partita
        // (es. Portiere/Attaccante solo se la partita è di calcio)
        const sportFamily = getSportFamily(matchData.sport);
        const participantIds = (partData || []).map(p => p.user_id);
        if (sportFamily && participantIds.length > 0) {
            const { data: rolesData } = await supabase
                .from('user_sport_roles')
                .select('user_id, role')
                .eq('sport', sportFamily)
                .in('user_id', participantIds);

            const rolesMap = {};
            (rolesData || []).forEach(r => {
                (rolesMap[r.user_id] ||= []).push(r.role);
            });
            setParticipantRoles(rolesMap);
        } else {
            setParticipantRoles({});
        }
        const { isMatchStarted, isMatchFinished } = checkMatchStatus(fullMatchData.datetime);
        setIsMatchStarted(isMatchStarted);
        setIsMatchFinished(isMatchFinished);
        // console.log('⏰ Stato partita aggiornato: ', { isMatchStarted, isMatchFinished });
        // console.log('✅ Dati partita caricati:', fullMatchData);
        // console.log('✅ Partecipanti caricati:', participants);
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

    const fetchRescheduleRequest = useCallback(async () => {
        const { data } = await supabase
            .from('match_reschedule_requests')
            .select('*')
            .eq('match_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        setRescheduleRequest(data || null);
    }, [id]);

    useEffect(() => {
        getDetails();
        fetchRescheduleRequest();

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
            // 3. Sottoscrizione alle richieste di modifica orario
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'match_reschedule_requests',
                    filter: `match_id=eq.${id}`,
                },
                () => {
                    fetchRescheduleRequest();
                }
            )
            // 4. SUBSCRIBE
            .subscribe();

        return () => {
            supabase.removeChannel(matchChannel);
        };

    }, [id, user.id, getDetails, fetchRescheduleRequest]);

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
                if (weather.temperature > 30) {
                    setAlertTemperatura("Attenzione: la temperatura è superiore a 30 gradi!");
                }
                if (weather.temperature < 0) {
                    setAlertTemperatura("Attenzione: la temperatura è inferiore a 0 gradi!");
                }
                if (weather.temperature <= 25 && weather.temperature >= 20) {
                    setAlertTemperatura("Temperatura ottimale per giocare!");
                }
                if (weather.temperature < 20 && weather.temperature >= 17) {
                    setAlertTemperatura("Temperatura buona per giocare!");
                }
            } catch (err) {
                console.error('Errore nel fetch dei dati meteo:', err);
            } finally {
                setIsLoadingWeather(false);
            }
        };

        fetchWeather();
        // console.log('⛅ dati meteo: ', weatherData)
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
        setIsSavingTeams(true);

        const newTeam1Name = team1NameLocal.trim() || null;
        const newTeam2Name = team2NameLocal.trim() || null;

        try {
            // Salva le assegnazioni dei giocatori solo se sono state modificate
            if (localTeams) {
                const payload = confirmedPlayers.map(p => ({
                    id: p.id,
                    match_id: id,
                    user_id: p.user_id,
                    team_number: localTeams[p.id] !== undefined ? localTeams[p.id] : p.team_number,
                    status: p.status
                }));

                const { error: bulkError } = await supabase
                    .from('participants')
                    .upsert(payload, { onConflict: 'id' });

                if (bulkError) throw bulkError;
            }

            // Salva i nomi personalizzati delle squadre sulla partita
            const { error: nameError } = await supabase
                .from('matches')
                .update({ team1_name: newTeam1Name, team2_name: newTeam2Name })
                .eq('id', id);

            if (nameError) throw nameError;

            setMatch(prev => (prev ? { ...prev, team1_name: newTeam1Name, team2_name: newTeam2Name } : prev));
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
        setTeam1NameLocal(match?.team1_name || '');
        setTeam2NameLocal(match?.team2_name || '');
    };

    // Ripesca il primo in lista d'attesa nel posto lasciato libero (da un
    // abbandono volontario o da una rimozione dell'organizzatore), oppure
    // avvisa gli altri confermati se la lista d'attesa è vuota. Condiviso
    // da handleLeave e handleKickPlayer.
    const promoteFromWaitlist = async (freedByName, otherConfirmedIds) => {
        const nextInLine = waitingPlayers.length > 0
            ? [...waitingPlayers].sort((a, b) => a.waitlist_order - b.waitlist_order)[0]
            : null;

        if (nextInLine) {
            const { error: promoteError } = await supabase
                .from('participants')
                .update({ status: 'confirmed', waitlist_order: null })
                .eq('match_id', id)
                .eq('user_id', nextInLine.user_id);

            if (promoteError) {
                console.error('❌ Errore ripescaggio lista d\'attesa:', promoteError);
            } else {
                notifyWaitlistPromoted(id, match.title, nextInLine.user_id);
                notifyOrganizerSpotFilled(
                    id,
                    match.title,
                    freedByName,
                    nextInLine.profiles?.username || 'Un giocatore',
                    match.creator_id
                );
            }
        } else if (otherConfirmedIds.length > 0) {
            notifyMatchSpotFreed(id, match.title, freedByName, otherConfirmedIds);
        }
    };

    const handleKickPlayer = (p) => {
        if (match.creator_id !== user.id || p.user_id === match.creator_id) return;

        if (checkMatchStatus(match.datetime).isMatchStarted) {
            error('La partita è già iniziata: non puoi più rimuovere giocatori.');
            return;
        }

        confirmDangerous(`Rimuovere ${p.profiles?.username || 'questo giocatore'} dalla partita?`, async () => {
            const { error: partError } = await supabase
                .from('participants')
                .delete()
                .eq('match_id', id)
                .eq('user_id', p.user_id);

            if (partError) {
                console.error('❌ Errore rimozione giocatore:', partError);
                error('Errore durante la rimozione: ' + partError.message);
                return;
            }

            const organizerName = user.user_metadata?.username || "L'organizzatore";
            notifyMatchKicked(p.user_id, id, match.title, organizerName);

            const wasFull = confirmedPlayers.length >= match.max_players;
            if (wasFull) {
                const otherConfirmedIds = confirmedPlayers
                    .map(cp => cp.user_id)
                    .filter(uid => uid !== p.user_id);
                await promoteFromWaitlist(organizerName, otherConfirmedIds);
            }

            success('Giocatore rimosso dalla partita.');
        });
    };

    const handleLeave = async () => {
        if (match.creator_id === user.id) {
            error("Sei l'organizzatore, Non puoi uscire dalla partita. Per annullare la partita usa il pulsante dedicato.");
            return;
        }

        // Ricalcola lo stato al momento del click (non fidarsi dello stato in
        // React, che si aggiorna solo al fetch e potrebbe essere "vecchio" se
        // la pagina è rimasta aperta a cavallo dell'orario di inizio).
        if (checkMatchStatus(match.datetime).isMatchStarted) {
            error('La partita è già iniziata: non puoi più abbandonarla.');
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

                    // 3. Se la partita era piena, gestisci il posto libero:
                    // - se c'è qualcuno in lista d'attesa, ripescalo e notifica lui + l'organizzatore
                    // - se la lista d'attesa è vuota, avvisa tutti i confermati rimasti
                    const wasFull = confirmedPlayers.length >= match.max_players;
                    if (wasFull) {
                        const otherConfirmedIds = confirmedPlayers
                            .map(p => p.user_id)
                            .filter(uid => uid !== user.id);
                        await promoteFromWaitlist(username, otherConfirmedIds);
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
            // Raccogliamo i destinatari prima di cancellare la riga: il cascade
            // rimuove anche i relativi participants, dopo non potremmo più leggerli.
            const recipientIds = [...confirmedPlayers, ...waitingPlayers]
                .map(p => p.user_id)
                .filter(uid => uid !== user.id);

            const { error: deleteError } = await supabase
                .from('matches')
                .delete()
                .eq('id', id);

            if (!deleteError) {
                if (!isMatchFinished && recipientIds.length > 0) {
                    notifyMatchCancelled(id, match.title, recipientIds);
                }
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

    // Carica gli amici accettati dell'utente per il modale "Invita amici",
    // stesso pattern di loadFriends in TeamDetail.jsx.
    const loadInviteFriends = async () => {
        const { data: friendships, error: friendsError } = await supabase
            .from('friendships')
            .select('friend_id')
            .eq('user_id', user.id)
            .eq('status', 'accepted');

        if (friendsError) {
            console.error('Errore caricamento amici:', friendsError);
            return;
        }

        const friendIds = (friendships || []).map(f => f.friend_id);
        if (friendIds.length === 0) {
            setInviteFriends([]);
            return;
        }

        const { data: friendProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', friendIds);

        if (profilesError) {
            console.error('Errore caricamento profili amici:', profilesError);
            return;
        }

        setInviteFriends(friendProfiles || []);
    };

    const handleOpenInviteModal = () => {
        setSelectedInviteFriends(new Set());
        setIsInviteModalOpen(true);
        if (inviteFriends.length === 0) loadInviteFriends();
    };

    const handleInviteFriendsToMatch = async () => {
        if (selectedInviteFriends.size === 0) {
            error('Seleziona almeno un amico');
            return;
        }

        setIsSendingInvites(true);
        const inviterName = user.user_metadata?.username || 'Un giocatore';

        await Promise.all(
            Array.from(selectedInviteFriends).map(friendId =>
                notifyMatchInvite(friendId, inviterName, match.title || match.sport, match.id, user.id)
            )
        );

        setIsSendingInvites(false);
        success(`Invito inviato a ${selectedInviteFriends.size} amico/i!`);
        setIsInviteModalOpen(false);
        setSelectedInviteFriends(new Set());
    };

    const handleSendReminders = async () => {
        if (checkMatchStatus(match.datetime).isMatchFinished) {
            error('La partita è terminata: non puoi più inviare reminder.');
            return;
        }

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
        if (checkMatchStatus(match.datetime).isMatchStarted) {
            error('La partita è già iniziata: non puoi più iscriverti.');
            return;
        }

        const playerName = user.user_metadata?.username || 'Un giocatore';

        // Chiamiamo la RPC che gestisce tutto: controllo posti, inserimento e incremento
        const { data: status, error: rpcError } = await supabase.rpc('join_match_v2', {
            p_match_id: match.id,
            p_user_id: user.id,
            p_username: playerName
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

        // Notifica push all'organizzatore: join_match_v2 NON lo fa più (l'INSERT
        // in notifications è commentato lato DB), quindi la mandiamo da qui.
        if ((status === 'confirmed' || status === 'waiting') && match.creator_id !== user.id) {
            notifyMatchJoin(match.id, match.title, playerName, match.creator_id, user.id);
        }

        // Se questa iscrizione ha riempito l'ultimo posto, avvisa l'organizzatore
        if (status === 'confirmed' && confirmedPlayers.length + 1 >= match.max_players && match.creator_id !== user.id) {
            notifyMatchFull(match.id, match.title, match.creator_id);
        }
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

            // Notifica il centro sportivo (in-app + push)
            const centerId = match.sports_courts?.center_id;
            if (centerId) {
                const organizerName = user.user_metadata?.username || 'Un organizzatore';
                notifyReservationRequest(centerId, match.title, organizerName, match.id, user.id);
            }

            success("Richiesta inviata al centro sportivo!");
            getDetails(); // Ricarica i dati per aggiornare UI
        } catch (err) {
            console.error("Errore nell'invio della richiesta:", err);
            error("Ops! Si è verificato un errore durante l'invio.");
        }
    };

    const submitReview = async (targetId, rating, comment) => {
        // Squadra (A/B) in cui giocava il recensore in questa partita, snapshot
        const reviewerTeamNumber = participants.find(p => p.user_id === user.id)?.team_number ?? null;

        const { error: reviewError } = await supabase
            .from('reviews')
            .insert({
                reviewer_id: user.id,
                target_id: targetId,
                match_id: match.id,
                rating: rating,
                comment: comment,
                reviewer_team_number: reviewerTeamNumber
            });

        if (reviewError) {
            if (reviewError.code === '23505') {
                error("Hai già recensito questo giocatore per questa partita!");
            } else {
                error("Errore: " + reviewError.message);
            }
        } else {
            success("Recensione inviata!");
            // Notifica il giocatore recensito (in-app + push)
            if (targetId !== user.id) {
                const reviewerName = user.user_metadata?.username || 'Un giocatore';
                notifyReviewReceived(targetId, reviewerName, rating, match.id, user.id);
            }
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
        const dettagli = `INFORMAZIONI DELLA PARTITA:\n 📅 ${day}/${month}/${year} ${hours}:${minutes}\n📝 ${match.description ? `${match.description.slice(0, 32)}...` : "Nessuna descrizione"}\n📍 ${match.location}`;

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: match.title || 'Partita di ' + match.sport + ' con L\'Ultimo',
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

    if (loading) return <Loader variant="page" />;
    if (!match) return <div className="p-10 text-center">Partita non trovata <button onClick={() => navigate('/')} className="text-blue-500 underline">Torna alla Home</button></div>;

    return (
        <>
            {/* <div className="px-4 py-3">
                <button
                    onClick={() => navigate(-1)}
                    type="button"
                    className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
                >
                    <ChevronRight size={14} className="rotate-180" />
                    Indietro
                </button>
            </div> */}
            {/* HEADER FISSO SUPERIORE - Azioni Admin (Invio reminder, modifica, elimina) - azioni Utente ordinario (condividi) */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                >
                    ‹ Indietro
                </button>
                <span className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-blue-50 text-blue-600 rounded-full">
                    {match.sport}
                </span>

                {/* AZIONI DI AMMINISTRAZIONE COMPATTE (Solo se admin) */}
                {match?.creator_id === user.id ? (
                    <div className="flex items-center gap-3">
                        {/* <button
                            disabled={isRemindersLoading || !canSendReminder}
                            onClick={handleSendReminders}
                            className={`p-2 rounded-xl transition-all ${canSendReminder ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-slate-300 bg-slate-50 cursor-not-allowed'}`}
                            title="Invia Reminder"
                        >
                            <Bell size={18} />
                        </button> */}
                        <button
                            onClick={handleOpenInviteModal}
                            disabled={isMatchFinished}
                            className="p-2 text-green-600 bg-green-50 rounded-xl hover:bg-green-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-50"
                            title="Invita amici"
                        >
                            <UserPlus size={18} />
                        </button>
                        <button
                            onClick={() => navigate(`/modifica/${match.id}`)}
                            disabled={isMatchFinished}
                            className="p-2 text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            onClick={handleDeleteMatch}
                            disabled={isMatchFinished}
                            className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {isJoined && (
                            <button
                                onClick={handleOpenInviteModal}
                                disabled={isMatchFinished}
                                className="p-2 text-green-600 bg-green-50 rounded-xl hover:bg-green-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-50"
                                title="Invita amici"
                            >
                                <UserPlus size={18} />
                            </button>
                        )}
                        {/* Tasto condividi standard se l'utente non è admin */}
                        <button
                            onClick={handleShare}
                            disabled={isMatchFinished}
                            className="p-2 text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
                        >
                            <Share2 size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* CONTENUTO DELLA PAGINA */}
            <div className="max-w-md mx-auto px-4 pt-4 pb-32 bg-slate-50/50 min-h-screen">

                {/* 1. BLOCCO TITOLO E DESCRIZIONE */}
                <div className="mb-5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                            {match.title || match.sport}
                        </h1>
                        {isMatchStarted && !isMatchFinished && (
                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow-md animate-pulse">
                                ● In corso
                            </span>
                        )}
                    </div>
                    {!match.title && (
                        <span className="text-sm text-slate-400">Titolo autogenerato</span>
                    )}
                    {match.description && (
                        <p className="mt-2 text-sm text-slate-500 font-medium bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm italic break-words">
                            "{match.description}"
                        </p>
                    )}
                    {!match.description && (
                        <p className="mt-2 text-sm text-slate-500 font-medium bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm italic break-words">Nessuna descrizione fornita</p>
                    )}
                </div>

                {/* 2. SUPER-CARD INFORMATIVA (Info Match + Centro Affiliato + Meteo) */}
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-5 space-y-4">

                    {/* Data e Ora & Luogo Standard */}
                    <div className="grid grid-cols-1 gap-3 pb-3 border-b border-slate-100">
                        {/* TOOLTIP INFO */}
                        <div className="flex items-center text-center gap-3 relative">
                            <div className="text-blue-600 rounded-xl absolute -top-2 -right-2">
                                <CircleQuestionMark
                                    size={18}
                                    onClick={() => setTooltipActive(!tooltipActive)}
                                    className="cursor-pointer"
                                />
                            </div>
                            {tooltipActive && (
                                <div className="flex-1 min-w-0 absolute -top-10 right-0 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg opacity-90">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clicca sulle icone per salvare sul calendario o per visualizzare il luogo</p>
                                </div>
                            )}
                        </div>

                        {/* CALENDARIO */}
                        <div className="calendar-menu-btn relative mb-3 flex items-center">
                            <button
                                onClick={() => setIsCalendarMenuOpen(!isCalendarMenuOpen)}
                                className=" text-slate-600 capitalize cursor-pointer hover:text-blue-600 transition-colors active:scale-95 text-left w-full flex items-center gap-2"
                            >
                                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                    <Calendar size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quando</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {new Date(match.datetime).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} ore {new Date(match.datetime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
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

                        {/* LUOGO */}
                        <div className="flex items-center gap-3">
                            {/* <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                    <MapPin size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Indirizzo</p>
                                <p className="text-sm font-bold text-slate-800 truncate">{match.location}</p>
                            </div> */}

                            <div className="relative location-menu-btn mb-3">
                                <button
                                    onClick={() => setIsLocationMenuOpen(!isLocationMenuOpen)}
                                    className="text-slate-600 capitalize cursor-pointer hover:text-blue-600 transition-colors active:scale-95 text-left w-full flex items-center gap-2"
                                >
                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                        <MapPin size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Indirizzo</p>
                                        <p className="text-sm font-bold text-slate-800">{match.location}</p>
                                    </div>
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
                        </div>

                        {/* INFO CENTRO SPORTIVO PER I PARTECIPANTI */}
                        {match?.creator_id !== user.id && match?.court_id && (
                            <>
                                <div className="flex items-center gap-3">

                                    <div className="relative location-menu-btn mb-3">
                                        <button
                                            onClick={() => navigate('//profile/:id'.replace(':id', match.sports_courts.center_id))}
                                            className="text-slate-600 capitalize cursor-pointer hover:text-blue-600 transition-colors active:scale-95 text-left w-full flex items-center gap-2"
                                        >
                                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                                <span>🏢</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Centro Sportivo</p>
                                                <p className="text-sm font-bold text-slate-800">{match.sports_courts.profiles.username}</p>
                                            </div>
                                        </button>

                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {weatherData && !isLoadingWeather && (
                        <>
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                    {/* <span>Previsioni Meteo:</span> */}
                                    <span className=''> {weatherData.description} </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs font-black text-slate-800">
                                    <span>{weatherData.emoji} {weatherData.temperature} °C</span>
                                    <span className="text-slate-400 font-normal">|</span>
                                    <span className="text-blue-600">🌧️ {weatherData.rainProbability}%</span>
                                </div>
                            </div>
                            <div className="">
                                {alertTemperatura !== "" && (
                                    <div className={`mt-2 text-sm ${weatherData.temperature > 30 ? 'text-red-600 border-red-100' : weatherData.temperature < 20 ? 'text-blue-600 border-blue-100' : 'text-green-600 border-green-100'} bg-white/50 p-3 rounded-xl border shadow-sm leading-tight`}>
                                        <p className="font-bold mb-1">{alertTemperatura}</p>
                                    </div>
                                )}
                            </div>
                        </>


                    )
                    }


                    {match?.creator_id === user.id && match?.court_id && (
                        <div className={`mb-6 p-4 border rounded-2xl relative ${match.reservation_status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                            <Info
                                size={22}
                                onClick={() => navigate('//profile/:id'.replace(':id', match.sports_courts.center_id))}
                                className="cursor-pointer text-slate-600 hover:text-slate-600 transition-colors absolute top-3 right-3"
                            />
                            <h4 className={`text-sm font-black uppercase mb-3 flex items-center gap-2 ${match.reservation_status === 'rejected' ? 'text-red-700' : 'text-slate-700'}`}>
                                <span>🏢</span> Stato Prenotazione Campo
                            </h4>
                            <div className="mb-4 flex flex-col gap-1">
                                <p className="text-sm font-medium text-slate-600 mb-1 tracking-tight">
                                    Centro: <span className="font-bold text-slate-800">{match.sports_courts.profiles.username}</span>
                                </p>
                                <p className="text-sm font-medium text-slate-600 tracking-tight">
                                    Campo: <span className="font-bold text-slate-800">{match.sports_courts.name}</span>
                                </p>
                            </div>

                            {(() => {
                                // Soglia minima: metà dei giocatori totali arrotondata per eccesso
                                const requiredPlayers = Math.ceil(match.max_players / 2);
                                const requestCount = match.request_count || 0;
                                const status = match.reservation_status;

                                if (status === 'confirmed') {
                                    return (
                                        <>
                                            <div className="w-full py-3 bg-green-100 text-green-700 border border-green-200 rounded-xl font-bold tracking-tight text-center flex items-center justify-center gap-2 shadow-sm">
                                                ✅ Prenotazione Confermata dal Gestore
                                            </div>

                                            {rescheduleRequest?.status === 'pending' ? (
                                                <button disabled className="w-full mt-3 py-3 bg-amber-500 text-white rounded-xl font-bold shadow-md shadow-amber-200 cursor-wait flex items-center justify-center gap-2 transition-all">
                                                    <Loader variant="inline" size={20} color="white" />
                                                    In attesa di risposta ({new Date(rescheduleRequest.proposed_datetime).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})
                                                </button>
                                            ) : (
                                                <>
                                                    {rescheduleRequest?.status === 'rejected' && (
                                                        <div className="mt-3 text-sm text-red-700 bg-white/50 p-3 rounded-xl border border-red-100 shadow-sm leading-tight">
                                                            <p className="font-bold mb-1">❌ Il centro ha rifiutato la modifica orario:</p>
                                                            <p className="italic opacity-80">{rescheduleRequest.rejection_reason || "Nessun motivo specificato."}</p>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => setIsRescheduleModalOpen(true)}
                                                        disabled={isMatchFinished}
                                                        className="w-full mt-3 py-3 bg-white border border-amber-200 text-amber-700 rounded-xl font-bold shadow-sm hover:bg-amber-50 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                                                    >
                                                        🕐 Richiedi modifica orario
                                                    </button>
                                                </>
                                            )}
                                        </>
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
                                            <Loader variant="inline" size={20} color="white" />
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
                                                disabled={isMatchFinished}
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex flex-col items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
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

                    {match?.creator_id === user.id && match?.court_id && (
                        <button
                            onClick={() => setIsMessageThreadOpen(true)}
                            className="w-full mb-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <MessageCircle size={18} className="text-blue-600" /> Invia messaggio al centro
                        </button>
                    )}

                    {match?.creator_id !== user.id && match?.court_id && (
                        <>
                            {(() => {

                                const status = match.reservation_status;

                                if (status === 'confirmed') {
                                    return (
                                        <div className="bg-green-100 text-green-700 text-sm font-bold p-3 rounded-xl border-2 border-green-200 shadow-sm leading-tight flex gap-2">
                                            Prenotazione confermata dal centro sportivo
                                        </div>
                                    );
                                }

                                if (status === 'requested') {
                                    return (
                                        <button disabled className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold shadow-md shadow-amber-200 cursor-wait flex items-center justify-center gap-2 transition-all">
                                            <Loader variant="inline" size={20} color="white" />
                                            è stata inviata una richiesta al centro...
                                        </button>
                                    );
                                }

                                if (status === 'rejected') {
                                    return (
                                        <>
                                            <div className="text-sm text-red-700 bg-red-100 p-3 rounded-xl border border-red-600 shadow-sm leading-tight">
                                                <p className="font-bold mb-1">Il centro sportivo ha rifiutato la richiesta</p>
                                            </div>
                                        </>
                                    );
                                }

                                return null;
                            })()}
                        </>
                    )}


                </div>

                <MatchAttendanceManager match={match} user={user} onUpdate={getDetails} />

                {match?.court_id && (
                    <MatchMessageThread
                        isOpen={isMessageThreadOpen}
                        onClose={() => setIsMessageThreadOpen(false)}
                        matchId={match.id}
                        currentUserId={user.id}
                        currentUserName={user.user_metadata?.username || 'Un organizzatore'}
                        otherUserId={match.sports_courts?.center_id}
                        otherUserName={match.sports_courts?.profiles?.username || 'Centro Sportivo'}
                        matchLabel={`${match.sport} — ${new Date(match.datetime.replace(' ', 'T')).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} — ${match.sports_courts?.name || ''}`}
                        recipientLink="/"
                    />
                )}

                {match?.court_id && (
                    <RescheduleRequestModal
                        isOpen={isRescheduleModalOpen}
                        onClose={() => setIsRescheduleModalOpen(false)}
                        matchId={match.id}
                        matchTitle={match.title}
                        currentDatetime={match.datetime}
                        organizerId={user.id}
                        organizerName={user.user_metadata?.username || 'Un organizzatore'}
                        centerId={match.sports_courts?.center_id}
                        onRequested={fetchRescheduleRequest}
                    />
                )}

                {isInviteModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setIsInviteModalOpen(false)}>
                        <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">Invita Amici</h2>
                                <p className="text-sm text-slate-500 mt-2">
                                    Seleziona gli amici da invitare a "{match.title || match.sport}"
                                </p>
                            </div>

                            {inviteFriends.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-slate-500">Non hai amici da invitare</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {inviteFriends.map((friend) => (
                                        <label
                                            key={friend.id}
                                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedInviteFriends.has(friend.id)}
                                                onChange={(e) => {
                                                    const newSelected = new Set(selectedInviteFriends);
                                                    if (e.target.checked) {
                                                        newSelected.add(friend.id);
                                                    } else {
                                                        newSelected.delete(friend.id);
                                                    }
                                                    setSelectedInviteFriends(newSelected);
                                                }}
                                                className="w-4 h-4 accent-blue-600"
                                            />
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {friend.avatar_url ? (
                                                    <img
                                                        src={friend.avatar_url}
                                                        alt={friend.username}
                                                        referrerPolicy="no-referrer"
                                                        className="w-full h-full object-cover"
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

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsInviteModalOpen(false); setSelectedInviteFriends(new Set()); }}
                                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="button"
                                    onClick={handleInviteFriendsToMatch}
                                    disabled={isSendingInvites || selectedInviteFriends.size === 0}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSendingInvites ? (
                                        <>
                                            <Loader variant="inline" size={16} color="white" />
                                            Invio...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={18} />
                                            Invita ({selectedInviteFriends.size})
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <h3 className="font-bold text-lg mb-4">Giocatori ({confirmedPlayers.length}/{match.max_players})</h3>

                {/* Controlli Organizzatore per Random e Salvataggio */}
                {user.id === match?.creator_id && confirmedPlayers.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4">
                        {/* Nomi personalizzati delle squadre */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={team1NameLocal}
                                onChange={(e) => setTeam1NameLocal(e.target.value)}
                                maxLength={30}
                                placeholder="Squadra A (Colorati)"
                                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700 placeholder:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <input
                                type="text"
                                value={team2NameLocal}
                                onChange={(e) => setTeam2NameLocal(e.target.value)}
                                maxLength={30}
                                placeholder="Squadra B (Bianchi)"
                                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            />
                        </div>

                        {!isMatchFinished && (
                            <button
                                onClick={generateRandomTeamsLocal}
                                className={`w-full py-3 active:scale-95 transition-all text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 ${localTeams ? 'bg-indigo-500 shadow-indigo-200' : 'bg-indigo-600 shadow-indigo-300'}`}
                            >
                                <RefreshCw size={18} /> Genera Squadre Casuali
                            </button>
                        )}

                        {!isMatchFinished && (localTeams || (team1NameLocal.trim() || null) !== (match?.team1_name || null) || (team2NameLocal.trim() || null) !== (match?.team2_name || null)) && (
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
                                    className="flex-[2] py-3 bg-green-500 hover:bg-green-600 active:scale-95 transition-all text-white rounded-xl font-bold shadow-lg shadow-green-200 flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isSavingTeams ? <Loader variant="inline" color="white" /> : 'Salva Modifiche Squadre'}
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
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-95 cursor-pointer ${p.user_id === user.id ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white'
                                }`}
                            onClick={() => { p.user_id !== user.id ? navigate(`/profile/${p.user_id}`) : navigate('/profile') }}
                        >
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="relative w-10 h-10 flex-shrink-0">
                                    <div className={`w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-500 overflow-hidden ${p.final_attendance ? 'ring-2 ring-green-400 ring-offset-2' : ''}`}>
                                        {p.profiles?.avatar_url ? (
                                            <img src={p.profiles.avatar_url} alt="avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                        ) : (
                                            p.profiles?.username?.charAt(0).toUpperCase() || '?'
                                        )}
                                    </div>
                                    {p.user_id === match.creator_id && (
                                        <span className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow border border-amber-200" title="Organizzatore">
                                            <Crown size={11} className="text-amber-500 fill-amber-400" />
                                        </span>
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate">
                                        {p.profiles?.username || 'Utente anonimo'}
                                        {p.user_id === user.id && <span className="text-blue-500 ml-2 text-xs">(Tu)</span>}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                                            {p.profiles?.gender === 'M' ? 'Uomo' : p.profiles?.gender === 'F' ? 'Donna' : 'Player'}
                                            {(participantRoles[p.user_id] || []).length > 0 && (
                                                <>
                                                    <span className="text-slate-300"> · </span>
                                                    <span className="text-blue-600">{participantRoles[p.user_id].join(', ')}</span>
                                                </>
                                            )}
                                        </p>
                                        {p.final_attendance && (
                                            <span className="text-[10px] font-black uppercase tracking-wide text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                                ✓ presente
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                {isMatchFinished && p.user_id !== user.id && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openReviewModal(p.profiles, p.user_id); }}
                                        className="text-[10px] font-black bg-slate-800 text-white px-3 py-1 rounded-full flex-shrink-0"
                                    >
                                        VOTA
                                    </button>
                                )}

                                {user.id === match.creator_id && !isMatchFinished && (
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
                                        {p.user_id !== match.creator_id && (
                                            <button
                                                onClick={() => handleKickPlayer(p)}
                                                className="w-8 h-8 flex items-center justify-center rounded-xl font-black text-sm transition-all shadow-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                                                title="Rimuovi dalla partita"
                                            >
                                                <UserMinus size={14} />
                                            </button>
                                        )}
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
                                        <span>{teamLabel(1, match)}</span>
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
                                        <span>{teamLabel(2, match)}</span>
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
                                    <div className="flex items-center gap-4 min-w-0">
                                        {/* Avatar o Iniziale */}
                                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-500 overflow-hidden flex-shrink-0">
                                            {p.profiles?.avatar_url ? (
                                                <img src={p.profiles.avatar_url} alt="avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                            ) : (
                                                p.profiles?.username?.charAt(0).toUpperCase() || '?'
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 truncate">
                                                {p.profiles?.username || 'Utente anonimo'}
                                                {p.user_id === user.id && <span className="text-blue-500 ml-2 text-xs">(Tu)</span>}
                                            </p>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                                                    {p.profiles?.gender === 'M' ? 'Uomo' : p.profiles?.gender === 'F' ? 'Donna' : 'Player'}
                                                    {(participantRoles[p.user_id] || []).length > 0 && (
                                                        <>
                                                            <span className="text-slate-300"> · </span>
                                                            <span className="text-blue-600">{participantRoles[p.user_id].join(', ')}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}




            </div>

            {/* 4. BARRA AZIONE STICKY BOTTOM (Segue l'utente sullo schermo) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-xl z-40 max-w-md mx-auto rounded-t-3xl">
                {isMatchStarted && match?.creator_id !== user.id ? (
                    <div className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-center border border-slate-200">
                        {isMatchFinished ? 'Partita terminata' : 'Partita in corso'}
                    </div>
                ) : isJoined && match?.creator_id !== user.id ? (
                    <button
                        onClick={handleLeave}
                        className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-red-600"
                    >
                        <UserMinus size={16} className="text-white" /> Abbandona Partita
                    </button>
                ) : !isJoined && match?.creator_id !== user.id ? (
                    <button
                        onClick={handleJoin}
                        className={`w-full text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${confirmedPlayers.length >= match.max_players
                            ? 'bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-500/20'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                            }`}
                    >
                        <UserPlus size={16} className="text-white" />
                        {confirmedPlayers.length >= match.max_players ? "Unisciti alla Lista d'Attesa" : 'Unisciti alla Partita'}
                    </button>
                ) : (match?.creator_id === user.id) && isMatchFinished ? (
                    <div className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-center border border-slate-200">
                        Partita terminata
                    </div>
                ) : (match?.creator_id === user.id) && (
                    <>
                        <button
                            disabled={isRemindersLoading || !canSendReminder}
                            onClick={handleSendReminders}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-yellow-200"
                        >
                            <Bell size={16} className="text-white" /> Invia Notifica ai Giocatori
                        </button>
                    </>
                )}
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