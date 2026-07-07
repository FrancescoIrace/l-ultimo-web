import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import LocationPicker from '../components/LocationPicker';
import { useAlert } from '../components/AlertComponent';
import { Info, ChevronRight, Building2 } from 'lucide-react';
import Loader from '../components/Loader';
import CenterCourtPicker from '../components/CenterCourtPicker';
import GetSportStyle, { validateBookingTime, getSportCategoryForMatch } from '../pages/business/BusinessUtils';
import { getWeather, isWithinSevenDays } from '../lib/weatherService';
import { notifyMatchUpdate } from '../lib/notificationService';


// Converti da datetime-local string (YYYY-MM-DDTHH:mm) a formato timestamp locale
// Per colonna timestamp (senza timezone) su Supabase
function formatDatetimeForTimestamp(dateTimeString) {
    if (!dateTimeString) return null;
    // Converti "2024-05-07T15:30" a "2024-05-07 15:30:00"
    return dateTimeString.replace('T', ' ') + ':00';
}

export default function CreateMatch() {
    const { id } = useParams(); // Se c'è un ID, siamo in modalità modifica
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [activeMatchCount, setActiveMatchCount] = useState(0);
    const [userId, setUserId] = useState(null);
    const [tooltipActive, setTooltipActive] = useState(false);
    const { success, error, alert, confirmDangerous } = useAlert();
    const [formData, setFormData] = useState({
        sport: 'Calcetto',
        title: '',
        datetime: '',
        location: '',
        location_lat: null,
        location_lng: null,
        max_players: 10, // Default per Calcetto
        description: '',
        team_id: null
    });
    const [centers, setCenters] = useState([]);
    const [selectedCenter, setSelectedCenter] = useState(null); // sempre l'id (stringa) del centro, mai l'oggetto
    const [selectedCourtInfo, setSelectedCourtInfo] = useState(null); // {id, name, sport_type} solo per la label del bottone
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [myTeams, setMyTeams] = useState([]);
    const [originalMatch, setOriginalMatch] = useState(null); // Snapshot pre-modifica, per capire cosa notificare

    const SPORT_MAX_PLAYERS = {
        'Calcetto': 10,
        'Calcio a 7': 14,
        'Calcio a 11': 22,
        'Padel': 4,
        'Basket (allenamento)': 2,
        'Basket (3vs3)': 6,
        'Basket (5vs5)': 10,
        'Tennis singolo': 2,
        'Tennis doppio': 4,
        'Volley': 12,
        'Corsa': formData.max_players,
        'Palestra': formData.max_players,
        'Personalizzato': formData.max_players
    };

    async function fetchCenters() {
        const { data } = await supabase.from('profiles').select('id, username, full_name, business_address, lat, lng').eq('role', 'center');
        setCenters(data || []);
        // console.log("Centri affiliati:", data);
    }

    const handleSportChange = (e) => {
        const selectedSport = e.target.value;
        setFormData({
            ...formData,
            sport: selectedSport,
            max_players: SPORT_MAX_PLAYERS[selectedSport]
        });
    };

    // Gestisce la selezione fatta dalla modale centro/campo
    function handlePickerSelect(center, court) {
        setSelectedCenter(center.id);
        setSelectedCourtInfo({ id: court.id, name: court.name, sport_type: court.sport_type });
        setFormData(prev => ({
            ...prev,
            court_id: court.id,
            location: center.business_address || prev.location,
            location_lat: center.lat != null ? parseFloat(center.lat) : prev.location_lat,
            location_lng: center.lng != null ? parseFloat(center.lng) : prev.location_lng,
        }));
        setIsPickerOpen(false);
    }

    // Solo in creazione (in modifica lo sport è bloccato): se cambia lo sport dopo
    // aver già scelto un campo, azzera la selezione se la categoria non corrisponde più.
    useEffect(() => {
        if (id || !selectedCourtInfo) return;
        const category = getSportCategoryForMatch(formData.sport);
        if (category && category !== GetSportStyle(selectedCourtInfo.sport_type).type) {
            setSelectedCenter(null);
            setSelectedCourtInfo(null);
            setFormData(prev => ({ ...prev, court_id: null }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.sport]);

    // Rileva se la descrizione contiene link
    const containsLinks = (text) => {
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,})/gi;
        return urlRegex.test(text);
    };

    const roundToHalfHour = (dateTimeString) => {
        if (!dateTimeString) return '';

        // Il formato nativo è YYYY-MM-DDTHH:MM
        const [date, time] = dateTimeString.split('T');
        if (!time) return dateTimeString;

        let [hours, minutes] = time.split(':');
        let mins = parseInt(minutes, 10);

        // Arrotonda al blocco di 30 minuti più vicino (00 o 30)
        if (mins < 15) {
            mins = 0;
        } else if (mins >= 15 && mins < 45) {
            mins = 30;
        } else {
            mins = 0;
            // Se va a 60, aumentiamo l'ora di 1
            let hrs = parseInt(hours, 10) + 1;
            hours = hrs < 10 ? `0${hrs}` : `${hrs}`;
        }

        const finalMinutes = mins === 0 ? '00' : '30';
        return `${date}T${hours}:${finalMinutes}`;
    };

    // Carica l'ID utente e conta le partite attive
    useEffect(() => {
        async function loadUserAndCountMatches() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);

                // Conta le partite attive (datetime > now)
                const now = new Date().toISOString();
                const { data: activeMatches, error: countError } = await supabase
                    .from('matches')
                    .select('id', { count: 'exact' })
                    .eq('creator_id', user.id)
                    .gt('datetime', now);

                if (!countError && activeMatches) {
                    setActiveMatchCount(activeMatches.length);
                }

                // Fetch delle squadre dell'utente
                const { data: teamsData, error: teamsError } = await supabase
                    .from('team_members')
                    .select('teams(id, name)')
                    .eq('user_id', user.id);

                if (!teamsError && teamsData) {
                    const uniqueTeams = teamsData
                        .map(item => item.teams)
                        .filter((v, i, a) => v && a.findIndex(t => t?.id === v?.id) === i);
                    setMyTeams(uniqueTeams || []);
                }
            }
        }
        fetchCenters();
        loadUserAndCountMatches();
    }, []);

    // 1. Se c'è un ID, carichiamo i dati attuali dal DB
    useEffect(() => {
        if (id) { // id preso da useParams
            const fetchMatchData = async () => {
                setLoading(true);

                // Recuperiamo il match includendo i dati del campo e del profilo del centro
                const { data: matchData } = await supabase
                    .from('matches')
                    .select(`
                    *,
                    sports_courts (
                        *,
                        profiles (*) 
                    )
                `)
                    .eq('id', id)
                    .single();

                if (matchData) {

                    // Per timestamp (senza timezone), Supabase restituisce "2024-05-07 15:30:00" o "2024-05-07T15:30:00"
                    // Convertiamo in formato input datetime-local: "2024-05-07T15:30"
                    let datetimeForInput = '';
                    if (matchData.datetime) {
                        // Sostituisci spazio con T se presente, altrimenti usa come-is
                        const dt = matchData.datetime.replace(' ', 'T');
                        datetimeForInput = dt.slice(0, 16); // Prendi solo YYYY-MM-DDTHH:mm
                    }

                    // 1. Popoliamo il form con la data formattata
                    setFormData({
                        ...matchData,
                        datetime: datetimeForInput,
                    });
                    // Teniamo uno snapshot dei valori originali per capire cosa
                    // è cambiato quando l'utente salva (per il testo della notifica)
                    setOriginalMatch({
                        ...matchData,
                        datetime: datetimeForInput,
                    });

                    // 2. IMPOSTIAMO IL CENTRO E IL CAMPO (già joinati nella query sopra)
                    if (matchData.sports_courts?.profiles) {
                        const center = matchData.sports_courts.profiles;
                        setSelectedCenter(center.id);
                        setSelectedCourtInfo({
                            id: matchData.sports_courts.id,
                            name: matchData.sports_courts.name,
                            sport_type: matchData.sports_courts.sport_type,
                        });
                    }
                }
                setLoading(false);

            };
            fetchMatchData();
        }
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (containsLinks(formData.description)) {
            error("La descrizione non può contenere link.");
            setLoading(false);
            return;
        }

        try {
            // 1. Recuperiamo l'utente
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("Utente non autenticato");

            // 2. Verifica limite partite attive
            if (activeMatchCount >= 5) {
                error(`Hai già ${activeMatchCount} partite attive.`);
                setLoading(false);
                return;
            }

            // 3. VALIDAZIONE ORARI (CORRETTA PER FUSO ORARIO)
            if (selectedCenter) {
                // Passiamo formData.datetime così com'è (stringa locale dal picker)
                const { isValid, isClosed, message } = await validateBookingTime(supabase, formData.datetime, selectedCenter);

                if (!isValid) {
                    if (isClosed) {
                        const targetCenterObj = centers.find(c => c.id === selectedCenter);
                        const nomeCampo = targetCenterObj ? (targetCenterObj.full_name || targetCenterObj.username) : "Il centro";
                        error(`impossibile creare partita, ${nomeCampo} chiuso in questo giorno`);
                    } else {
                        error(message);
                    }
                    setLoading(false);
                    return; // Blocca la creazione se l'orario non è valido nel fuso locale
                }
            }

            // 4. Gestione Posizione
            let locationData = {
                location: formData.location,
                location_lat: formData.location_lat,
                location_lng: formData.location_lng,
            };

            // const weather = await getWeather(locationData.location_lat, locationData.location_lng, formData.datetime);
            // if (weather) {
            //     console.log("Dati meteo per la partita:", weather);
            // }

            if (!locationData.location_lat || !locationData.location_lng) {
                const { data: userProfile } = await supabase
                    .from('profiles')
                    .select('location, location_lat, location_lng')
                    .eq('id', user.id)
                    .single();

                if (userProfile) {
                    locationData = {
                        location: userProfile.location,
                        location_lat: userProfile.location_lat,
                        location_lng: userProfile.location_lng,
                    };
                }
            }

            // 5. INSERIMENTO / AGGIORNAMENTO PARTITA
            // Usiamo l'ID se presente per capire se è un update o un insert
            const isUpdate = !!id;

            const formattedDatetime = formatDatetimeForTimestamp(formData.datetime);

            const matchPayload = {
                title: formData.title,
                sport: formData.sport,
                datetime: formattedDatetime, // Formato locale per timestamp (senza timezone)
                location: locationData.location,
                location_lat: locationData.location_lat,
                location_lng: locationData.location_lng,
                max_players: formData.max_players,
                description: formData.description,
                court_id: formData.court_id || null,
                creator_id: user.id,
                team_id: formData.team_id || null,
                reservation_status: formData.court_id ? (id ? undefined : 'draft') : 'none'
                // Nota: se è un update, potresti voler NON sovrascrivere lo stato della prenotazione
            };

            let query = supabase.from('matches');

            if (id) {
                // Rimuoviamo campi che non devono cambiare durante l'update se necessario
                delete matchPayload.creator_id;
                const { data, error: updateError } = await query
                    .update(matchPayload)
                    .eq('id', id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                success("Partita aggiornata con successo!");
                navigate(`/match/${id}`, { replace: true });
            } else {
                const { data, error: insertError } = await query
                    .insert([{ ...matchPayload, current_players: 1 }])
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Aggiunta creatore ai partecipanti (solo su INSERT)
                await supabase.from('participants').insert([{
                    match_id: data.id,
                    user_id: user.id,
                    status: 'confirmed'
                }]);

                success(formData.court_id ? "Richiesta inviata al centro!" : "Partita creata!");
                navigate(`/match/${data.id}`, { replace: true });
            };
        } catch (err) {
            error("Errore creazione partita: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (containsLinks(formData.description)) {
            error("La descrizione non può contenere link.");
            setLoading(false);
            return;
        }

        const formattedDatetime = formatDatetimeForTimestamp(formData.datetime);

        // const date = new Date(formData.datetime.replace(' ', 'T'));
        // const weather = await getWeather(formData.location_lat, formData.location_lng, date);
        // if (weather && isWithinSevenDays(date) && weather.rainProbability === 0) {
        //     console.log("Probabilità di pioggia:", weather.rainProbability);
        //     confirmDangerous(`⚠️ Attenzione! C'è una probabilità di pioggia del ${weather.rainProbability}% alla data e ora selezionata. Vuoi comunque procedere con l'aggiornamento?`, async () => {
        //         return;
        //     });
        // }

        // 1. Aggiorniamo la partita esistente
        const updatePayload = {
            title: formData.title,
            location: formData.location,
            location_lat: formData.location_lat,
            location_lng: formData.location_lng,
            datetime: formattedDatetime, // Formato locale per timestamp (senza timezone)
            description: formData.description,
            team_id: formData.team_id || null,
            court_id: formData.court_id || null,
        };

        // Se il campo è stato aggiunto, rimosso o cambiato, avviamo/azzeriamo
        // il ciclo di richiesta al centro sportivo. Se il campo non cambia,
        // non tocchiamo lo stato (es. una richiesta già inviata resta tale).
        const courtChanged = (formData.court_id || null) !== (originalMatch?.court_id || null);
        if (courtChanged) {
            updatePayload.reservation_status = formData.court_id ? 'draft' : 'none';
            updatePayload.request_count = 0;
            updatePayload.rejection_reason = null;
        }

        const { data: updatedMatch, error: matchError } = await supabase
            .from('matches')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (matchError) {
            alert("Errore aggiornamento partita: " + matchError.message);
            setLoading(false);
            return;
        }

        // 2. Notifica i partecipanti confermati di cosa è cambiato
        const changes = [];
        if (originalMatch?.datetime !== formData.datetime) changes.push('orario');
        if (originalMatch?.location !== formData.location) changes.push('luogo');
        if (originalMatch?.title !== formData.title) changes.push('titolo');
        if (originalMatch?.description !== formData.description) changes.push('descrizione');

        if (changes.length > 0) {
            const { data: participantsData } = await supabase
                .from('participants')
                .select('user_id')
                .eq('match_id', id)
                .eq('status', 'confirmed');

            const recipientIds = (participantsData || [])
                .map(p => p.user_id)
                .filter(uid => uid !== updatedMatch.creator_id);

            if (recipientIds.length > 0) {
                notifyMatchUpdate(id, updatedMatch.title, `Sono stati modificati: ${changes.join(', ')}`, recipientIds);
            }
        }

        alert("Partita aggiornata con successo!");
        navigate('/match/' + id);
        setLoading(false);
    };

    if (loading) return <Loader variant="page" />;

    // In modifica, se la richiesta al centro è già stata inviata (in attesa di
    // risposta) o accettata, il campo non è più modificabile: cambiarlo ora
    // lascerebbe il vecchio campo prenotato mentre la partita punta altrove.
    const isCourtLocked = !!id && (formData.reservation_status === 'requested' || formData.reservation_status === 'confirmed');

    // SE C'È UN ID, MOSTRIAMO IL FORM DI MODIFICA
    if (id !== undefined && id !== null) {
        return (
            <div className="max-w-md mx-auto p-6 bg-slate-50/50 min-h-screen antialiased">
                <button
                    onClick={() => navigate('/match/' + id)}
                    type="button"
                    className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase text-red-500 hover:text-red-700 transition"
                >
                    <ChevronRight size={14} className="rotate-180" />
                    Torna alla pagina del match
                </button>
                <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">Modifica Match</h2>

                <form onSubmit={handleUpdate} className="space-y-5">
                    {/* SPORT */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sport</label>
                        <select
                            disabled
                            className="w-full p-3.5 bg-slate-100 border border-slate-200 rounded-xl outline-none cursor-not-allowed opacity-60 font-medium text-slate-700"
                            value={formData.sport}
                            onChange={handleSportChange}
                        >
                            <option value="Calcetto">⚽ Calcetto</option>
                            <option value="Calcio a 7">⚽ Calcio a 7</option>
                            <option value="Calcio a 11">⚽ Calcio a 11</option>
                            <option value="Padel">🎾 Padel</option>
                            <option value="Basket (allenamento)">🏀 Basket (allenamento)</option>
                            <option value="Basket (3vs3)">🏀 Basket (3vs3)</option>
                            <option value="Basket (5vs5)">🏀 Basket (5vs5)</option>
                            <option value="Tennis singolo">🎾 Tennis singolo</option>
                            <option value="Tennis doppio">🎾 Tennis doppio</option>
                            <option value="Volley">🏐 Volley</option>
                            <option value="Corsa">🏃 Corsa</option>
                            <option value="Palestra">🏋️ Palestra</option>
                            <option value="Personalizzato">⚙️ Personalizzato</option>
                        </select>
                    </div>

                    {/* VISIBILITÀ MATCH */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Visibilità Match</label>
                        <div className="flex gap-2">
                            <div className={`flex-1 p-3.5 border rounded-xl text-center font-bold text-sm opacity-60 cursor-not-allowed transition-all ${formData.team_id === null ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10' : 'bg-white border-slate-100 text-slate-400'}`}>
                                🌐 Pubblico
                            </div>
                            <div className={`flex-1 p-3.5 border rounded-xl text-center font-bold text-sm opacity-60 cursor-not-allowed transition-all ${formData.team_id !== null ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/10' : 'bg-white border-slate-100 text-slate-400'}`}>
                                🛡️ Squadra
                            </div>
                        </div>
                    </div>

                    {/* TITOLO */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Titolo <span className="text-slate-400 text-[10px] lowercase italic normal-case">(max 32 caratteri)</span>
                        </label>
                        <input
                            type="text"
                            maxLength={32}
                            className="w-full p-3.5 bg-white border border-gray-100 rounded-xl outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-800"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    {/* DATA E GIOCATORI */}
                    {/* QUANDO (Data e Ora) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quando</label>
                        <input
                            type="datetime-local"
                            lang="it-IT"
                            step="1800" // Mostra intervalli di 30 minuti sulla ghiera nativa
                            required
                            className="w-full p-3.5 bg-white border border-gray-100 rounded-xl outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-800"
                            value={formData.datetime || ''}
                            onChange={(e) => {
                                const roundedValue = roundToHalfHour(e.target.value);
                                setFormData({ ...formData, datetime: roundedValue });
                            }}
                        />
                    </div>

                    {/* GIOCATORI TOTALI */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Giocatori Totali</label>
                        <input
                            type="number"
                            required
                            disabled={formData.sport !== 'Personalizzato' && formData.sport !== 'Corsa' && formData.sport !== 'Palestra'}
                            min="2"
                            className="w-full p-3.5 bg-white border border-gray-100 rounded-xl outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-800 disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                            value={formData.max_players}
                            onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                        />
                    </div>

                    {/* SELEZIONE CENTRO AFFILIATO */}
                    <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Centro affiliato <span className="lowercase italic normal-case font-normal text-slate-400">(opzionale)</span>
                            </label>
                        </div>
                        <button
                            type="button"
                            disabled={isCourtLocked}
                            onClick={() => setIsPickerOpen(true)}
                            className={`w-full p-3 border rounded-xl text-left text-sm flex items-center justify-between gap-2 transition-colors ${isCourtLocked ? 'bg-slate-100 border-slate-100 opacity-60 cursor-not-allowed' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                <Building2 size={16} className="text-slate-400 flex-shrink-0" />
                                <span className="truncate text-slate-800 font-medium">
                                    {selectedCourtInfo
                                        ? `${centers.find(c => c.id === selectedCenter)?.full_name || centers.find(c => c.id === selectedCenter)?.username || 'Centro'} — ${selectedCourtInfo.name}`
                                        : 'Scegli un centro sportivo...'}
                                </span>
                            </span>
                            <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                        </button>
                        {isCourtLocked && (
                            <p className="text-[11px] text-slate-400 mt-2 leading-snug">
                                {formData.reservation_status === 'confirmed'
                                    ? 'Non modificabile: la prenotazione è già stata confermata dal centro.'
                                    : 'Non modificabile: la richiesta è già stata inviata al centro, in attesa di risposta.'}
                            </p>
                        )}
                    </div>

                    <CenterCourtPicker
                        isOpen={isPickerOpen}
                        onClose={() => setIsPickerOpen(false)}
                        sport={formData.sport}
                        centers={centers}
                        userId={userId}
                        initialCenterId={selectedCenter}
                        onSelect={handlePickerSelect}
                    />

                    {/* LUOGO E DESCRIZIONE */}
                    <LocationPicker
                        value={formData}
                        onChange={(locationData) => setFormData(prev => ({ ...prev, ...locationData }))}
                    />

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Descrizione <span className="text-slate-400 text-[10px] lowercase italic normal-case">(max 300 caratteri)</span>
                        </label>
                        <textarea
                            maxLength={300}
                            className={`w-full h-32 resize-none p-3.5 bg-white border rounded-xl outline-none shadow-sm transition-all font-medium text-slate-800 focus:ring-1 ${containsLinks(formData.description)
                                ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                                : 'border-gray-100 focus:border-blue-500 focus:ring-blue-500'
                                }`}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                        {containsLinks(formData.description) && (
                            <p className="mt-1.5 text-xs text-red-600 font-bold flex items-center gap-1">❌ Link non consentiti nella descrizione</p>
                        )}
                    </div>

                    <button
                        disabled={loading}
                        className="w-full mt-2 cursor-pointer bg-amber-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-[0.99] disabled:opacity-50"
                    >
                        {loading ? 'Salvataggio...' : 'SALVA MODIFICHE'}
                    </button>
                </form>
            </div>
        );
    }

    // SE NON C'È UN ID, MOSTRIAMO IL FORM DI CREAZIONE NORMALE
    return (
        <div className="max-w-md mx-auto p-6 bg-slate-50/50 min-h-screen antialiased">
            <button
                onClick={() => navigate(-1)}
                type="button"
                className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
            >
                <ChevronRight size={14} className="rotate-180" />
                Indietro
            </button>
            <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">Organizza Match</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* BADGE PARTITE ATTIVE - PREMIUM CARD STYLE */}
                <div className={`border rounded-2xl p-4 shadow-sm bg-white transition-all duration-300 ${activeMatchCount >= 5 ? 'border-red-100' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold uppercase tracking-wider ${activeMatchCount >= 5 ? 'text-red-500' : 'text-slate-400'}`}>
                            Partite attive nello slot
                        </p>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setTooltipActive(!tooltipActive)}
                                className={`p-1 rounded-full transition ${activeMatchCount >= 5 ? 'text-red-500 hover:bg-red-50' : 'text-blue-500 hover:bg-blue-50'}`}
                            >
                                <Info size={16} />
                            </button>
                            {tooltipActive && (
                                <div className="absolute bottom-full right-0 mb-2 bg-slate-900 text-white text-[11px] font-medium rounded-xl px-3 py-1.5 whitespace-nowrap z-10 shadow-xl animate-fade-in">
                                    Puoi avere max 5 partite attive contemporaneamente
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className={`text-3xl font-black ${activeMatchCount >= 5 ? 'text-red-600' : 'text-blue-600'}`}>{activeMatchCount}</span>
                        <span className="text-slate-400 font-bold text-sm">/ 5 disponibili</span>
                    </div>
                    {activeMatchCount >= 5 && (
                        <p className="mt-2 text-xs text-red-600 font-bold bg-red-50/50 p-2 rounded-lg border border-red-100">
                            ❌ Hai raggiunto il limite. Aspetta che una partita finisca.
                        </p>
                    )}
                </div>

                {/* SPORT */}
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sport</label>
                    <select
                        className="w-full p-3.5 bg-white border border-gray-100 rounded-xl outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-800"
                        value={formData.sport}
                        onChange={handleSportChange}
                    >
                        <option value="Calcetto">⚽ Calcetto</option>
                        <option value="Calcio a 7">⚽ Calcio a 7</option>
                        <option value="Calcio a 11">⚽ Calcio a 11</option>
                        <option value="Padel">🎾 Padel</option>
                        <option value="Basket (allenamento)">🏀 Basket (allenamento)</option>
                        <option value="Basket (3vs3)">🏀 Basket (3vs3)</option>
                        <option value="Basket (5vs5)">🏀 Basket (5vs5)</option>
                        <option value="Tennis singolo">🎾 Tennis singolo</option>
                        <option value="Tennis doppio">🎾 Tennis doppio</option>
                        <option value="Volley">🏐 Volley</option>
                        <option value="Corsa">🏃 Corsa</option>
                        <option value="Palestra">🏋️ Palestra</option>
                        <option value="Personalizzato">⚙️ Personalizzato</option>
                    </select>
                </div>

                {/* VISIBILITÀ MATCH - SELETTORI PREMIUM */}
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Visibilità Match</label>
                    <div className="flex gap-2">
                        <label className={`flex-1 p-3.5 border rounded-xl text-center cursor-pointer font-bold text-sm transition-all duration-200 ${formData.team_id === null ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 active:scale-[0.98]' : 'bg-white border-gray-100 text-slate-500 hover:bg-slate-50'}`}>
                            <input type="radio" className="hidden" name="visibility" checked={formData.team_id === null} onChange={() => setFormData({ ...formData, team_id: null })} />
                            🌐 Pubblico
                        </label>
                        <label className={`flex-1 p-3.5 border rounded-xl text-center cursor-pointer font-bold text-sm transition-all duration-200 ${formData.team_id !== null ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20 active:scale-[0.98]' : 'bg-white border-gray-100 text-slate-500 hover:bg-slate-50'}`}>
                            <input type="radio" className="hidden" name="visibility" checked={formData.team_id !== null} onChange={() => setFormData({ ...formData, team_id: myTeams.length > 0 ? myTeams[0].id : '' })} />
                            🛡️ Squadra
                        </label>
                    </div>

                    {formData.team_id !== null && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2"
                        >
                            {myTeams.length > 0 ? (
                                <select
                                    className="w-full p-3.5 bg-white border border-indigo-100 rounded-xl outline-none shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium text-indigo-900"
                                    value={formData.team_id || ''}
                                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                                >
                                    <option value="" disabled>Seleziona una squadra...</option>
                                    {myTeams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl text-xs font-medium">
                                    <p className="font-bold">Nessuna squadra trovata.</p>
                                    <p className="text-slate-500 mt-0.5 font-normal">Crea o unisciti a un team per organizzare match privati.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* TITOLO */}
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Titolo <span className="text-slate-400 text-[10px] lowercase italic normal-case">(max 32 caratteri)</span>
                    </label>
                    <input
                        type="text"
                        maxLength={32}
                        className="w-full p-3.5 bg-white border border-gray-100 rounded-xl outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-800"
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                {/* DATA E GIOCATORI */}
                {/* QUANDO (Data e Ora) */}
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quando</label>
                    <input
                        type="datetime-local"
                        lang="it-IT"
                        // Arrotonda il valore minimo all'inizio dell'ora corrente per non sballare lo step dei 30 minuti
                        min={(() => {
                            const now = new Date();
                            now.setMinutes(0, 0, 0); // Imposta i minuti a :00
                            // Converte in ISO string mantenendo il fuso orario locale corretto per l'input nativo
                            const offset = now.getTimezoneOffset() * 60000;
                            return new Date(now.getTime() - offset).toISOString().slice(0, 16);
                        })()}
                        step="1800" // Intervalli perfetti di 30 minuti
                        required
                        className="w-full p-3.5 bg-white border border-gray-100 rounded-xl outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-800"
                        value={formData.datetime || ''}
                        onChange={(e) => {
                            const roundedValue = roundToHalfHour(e.target.value);
                            setFormData({ ...formData, datetime: roundedValue });
                        }}
                    />
                </div>

                {/* GIOCATORI TOTALI */}
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Giocatori Totali</label>
                    <input
                        type="number"
                        required
                        disabled={formData.sport !== 'Personalizzato' && formData.sport !== 'Corsa' && formData.sport !== 'Palestra'}
                        min="2"
                        className="w-full p-3.5 bg-white border border-gray-100 rounded-xl outline-none shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-slate-800 disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                        value={formData.max_players}
                        onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                    />
                </div>

                {/* SELEZIONE CENTRO AFFILIATO */}
                <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Centro affiliato <span className="lowercase italic normal-case font-normal text-slate-400">(opzionale)</span>
                        </label>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsPickerOpen(true)}
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-left text-sm flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors"
                    >
                        <span className="flex items-center gap-2 min-w-0">
                            <Building2 size={16} className="text-slate-400 flex-shrink-0" />
                            <span className="truncate text-slate-800 font-medium">
                                {selectedCourtInfo
                                    ? `${centers.find(c => c.id === selectedCenter)?.full_name || centers.find(c => c.id === selectedCenter)?.username || 'Centro'} — ${selectedCourtInfo.name}`
                                    : 'Scegli un centro sportivo...'}
                            </span>
                        </span>
                        <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                    </button>
                </div>

                <CenterCourtPicker
                    isOpen={isPickerOpen}
                    onClose={() => setIsPickerOpen(false)}
                    sport={formData.sport}
                    centers={centers}
                    userId={userId}
                    initialCenterId={selectedCenter}
                    onSelect={handlePickerSelect}
                />

                {/* LUOGO E DESCRIZIONE */}
                <LocationPicker
                    value={formData}
                    onChange={(locationData) => setFormData(prev => ({ ...prev, ...locationData }))}
                />

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Descrizione <span className="text-slate-400 text-[10px] lowercase italic normal-case">(max 300 caratteri)</span>
                    </label>
                    <textarea
                        maxLength={300}
                        className={`w-full h-32 resize-none p-3.5 bg-white border rounded-xl outline-none shadow-sm transition-all font-medium text-slate-800 focus:ring-1 ${containsLinks(formData.description)
                            ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                            : 'border-gray-100 focus:border-blue-500 focus:ring-blue-500'
                            }`}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                    {containsLinks(formData.description) && (
                        <p className="mt-1.5 text-xs text-red-600 font-bold flex items-center gap-1">❌ Link non consentiti nella descrizione</p>
                    )}
                </div>

                <button
                    disabled={loading || activeMatchCount >= 5}
                    className="w-full cursor-pointer bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Creazione in corso...' : 'PUBBLICA PARTITA'}
                </button>
            </form>
        </div>
    );

}
