import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import LocationPicker from '../components/LocationPicker';
import { useAlert } from '../components/AlertComponent';
import { Info } from 'lucide-react';
import { validateBookingTime } from '../pages/business/BusinessUtils';
import { getWeather, isWithinSevenDays } from '../lib/weatherService';


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
    const [selectedCenter, setSelectedCenter] = useState(null);
    const [availableCourts, setAvailableCourts] = useState([]);
    const [myTeams, setMyTeams] = useState([]);

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
        'Personalizzato': formData.max_players
    };

    async function fetchCenters() {
        const { data } = await supabase.from('profiles').select('id, username, full_name, business_address, lat, lng').eq('role', 'center');
        setCenters(data || []);
        // console.log("Centri affiliati:", data);
    }

    async function handleCenterChange(centerId) {
        setSelectedCenter(centerId);
        if (!centerId) {
            setAvailableCourts([]);
            return;
        }

        const center = centers.find(c => c.id === centerId);

        if (center && center.business_address) {
            // Aggiorniamo la posizione nel form automaticamente
            setFormData(prev => ({
                ...prev,
                location: center.business_address,
                location_lat: center.lat,
                location_lng: center.lng
            }));
        }

        const { data } = await supabase
            .from('sports_courts')
            .select('*')
            .eq('center_id', centerId)
            .eq('is_active', true);
        setAvailableCourts(data || []);
    }

    const handleSportChange = (e) => {
        const selectedSport = e.target.value;
        setFormData({
            ...formData,
            sport: selectedSport,
            max_players: SPORT_MAX_PLAYERS[selectedSport]
        });
    };

    // Rileva se la descrizione contiene link
    const containsLinks = (text) => {
        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,})/gi;
        return urlRegex.test(text);
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

                    // 2. IMPOSTIAMO IL CENTRO (Questo farà apparire il centro selezionato)
                    if (matchData.sports_courts?.profiles) {
                        const center = matchData.sports_courts.profiles;
                        setSelectedCenter(center);

                        // 3. CARICHIAMO I CAMPI DI QUEL CENTRO (Questo farà apparire la lista campi)
                        const { data: courts } = await supabase
                            .from('sports_courts')
                            .select('*')
                            .eq('center_id', center.id);
                        setAvailableCourts(courts || []);
                    }
                }
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
                const targetCenterId = typeof selectedCenter === 'object' ? selectedCenter.id : selectedCenter;
                // Passiamo formData.datetime così com'è (stringa locale dal picker)
                const { isValid, isClosed, message } = await validateBookingTime(supabase, formData.datetime, targetCenterId);

                if (!isValid) {
                    if (isClosed) {
                        const targetCenterObj = typeof selectedCenter === 'object' 
                            ? selectedCenter 
                            : centers.find(c => c.id === targetCenterId);
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
        const { data: updatedMatch, error: matchError } = await supabase
            .from('matches')
            .update({
                title: formData.title,
                location: formData.location,
                location_lat: formData.location_lat,
                location_lng: formData.location_lng,
                datetime: formattedDatetime, // Formato locale per timestamp (senza timezone)
                description: formData.description,
                team_id: formData.team_id || null, // Aggiunto team_id per l'update
            })
            .eq('id', id)
            .select()
            .single();

        if (matchError) {
            alert("Errore aggiornamento partita: " + matchError.message);
            setLoading(false);
            return;
        }

        alert("Partita aggiornata con successo!");
        navigate('/match/' + id);
        setLoading(false);
    };

    // SE C'È UN ID, MOSTRIAMO IL FORM DI MODIFICA
    if (id !== undefined && id !== null) {
        return (
            <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
                <button
                    onClick={() => navigate('/match/' + id)}
                    type="button"
                    className="w-60 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                >
                    TORNA ALLA PAGINA DEL MATCH
                </button>
                <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase">Modifica Match</h2>

                <form onSubmit={handleUpdate} className="space-y-5">
                    {/* SPORT */}
                    <div>
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Sport</label>
                        <select
                            disabled
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed opacity-50"
                            value={formData.sport}
                            onChange={handleSportChange}  // ← NUOVO
                        >
                            <option value="Calcetto" className="bg-white text-slate-800 py-1 font-medium">⚽ Calcetto</option>
                            <option value="Calcio a 7" className="bg-white text-slate-800 py-1 font-medium">⚽ Calcio a 7</option>
                            <option value="Calcio a 11" className="bg-white text-slate-800 py-1 font-medium">⚽ Calcio a 11</option>
                            <option value="Padel" className="bg-white text-slate-800 py-1 font-medium">🎾 Padel</option>
                            <option value="Basket (allenamento)" className="bg-white text-slate-800 py-1 font-medium">🏀 Basket (allenamento)</option>
                            <option value="Basket (3vs3)" className="bg-white text-slate-800 py-1 font-medium">🏀 Basket (3vs3)</option>
                            <option value="Basket (5vs5)" className="bg-white text-slate-800 py-1 font-medium">🏀 Basket (5vs5)</option>
                            <option value="Tennis singolo" className="bg-white text-slate-800 py-1 font-medium">🎾 Tennis singolo</option>
                            <option value="Tennis doppio" className="bg-white text-slate-800 py-1 font-medium">🎾 Tennis doppio</option>
                            <option value="Volley" className="bg-white text-slate-800 py-1 font-medium">🏐 Volley</option>
                            <option value="Personalizzato" className="bg-white text-slate-800 py-1 font-medium">⚙️ Personalizzato</option>
                        </select>
                    </div>

                    {/* VISIBILIT� MATCH */}
                    <div>
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Visibilit� Match</label>
                        <div className="flex gap-2">
                            <label className={`flex-1 p-3 border rounded-xl text-center cursor-pointer transition-all ${formData.team_id === null ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 font-semibold hover:bg-slate-100'}`}>
                                <input type="radio" className="hidden" name="visibility" checked={formData.team_id === null} onChange={() => setFormData({ ...formData, team_id: null })} disabled />
                                ?? Pubblico
                            </label>
                            <label className={`flex-1 p-3 border rounded-xl text-center cursor-pointer transition-all ${formData.team_id !== null ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 font-semibold hover:bg-slate-100'}`}>
                                <input type="radio" className="hidden" name="visibility" checked={formData.team_id !== null} onChange={() => setFormData({ ...formData, team_id: myTeams.length > 0 ? myTeams[0].id : '' })} disabled />
                                ??? Squadra
                            </label>
                        </div>
                        
                        {formData.team_id !== null && (
                            <div className="mt-3">
                                <select
                                    disabled
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed opacity-50"
                                    value={formData.team_id || ''}
                                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                                >
                                    <option value="" disabled>Seleziona una squadra...</option>
                                    {myTeams.length > 0 ? myTeams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    )) : (
                                        /* In case it has a team_id but it's not in myTeams (maybe was fetched from matchData) we could just show the id or fetch it, but usually this is enough */
                                        <option value={formData.team_id}>Squadra selezionata</option>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* TITOLO */}
                    <div>
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Titolo <span className="text-slate-400 text-[10px] align-middle italic">(max 32 caratteri)</span></label>
                        <input
                            type="text"
                            maxLength={32}
                            
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    {/* DATA E GIOCATORI */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Quando</label>
                            <input
                                type="datetime-local"
                                lang="it-IT"
                                required
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.datetime || ''} // Ora è già in formato locale YYYY-MM-DDTHH:MM
                                onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Giocatori Totali</label>
                            <input
                                type="number"
                                required
                                disabled={formData.sport !== 'Personalizzato'}
                                min="2"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed opacity-50"
                                value={formData.max_players}
                                onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* SELEZIONE CENTRO AFFILIATO - DISABILITATO */}
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 opacity-60">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-amber-700 uppercase">Prenota in un centro affiliato (Opzionale)</label>
                            <span className="inline-block bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded"> Work in Progress</span>
                        </div>
                        <select
                            // disabled
                            className="w-full p-3 bg-slate-100 border border-amber-200 rounded-xl outline-none mb-3"
                            onChange={(e) => {
                                const centerId = e.target.value;
                                handleCenterChange(centerId);
                            }}
                        >
                            <option value="">Seleziona un centro...</option>
                            {centers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.username}</option>)}
                        </select>

                        {availableCourts.length > 0 && (
                            <select
                                // disabled
                                className="w-full p-3 bg-slate-100 border border-amber-200 rounded-xl outline-none"
                                onChange={(e) => setFormData({ ...formData, court_id: e.target.value, reservation_status: 'draft' })}
                            >
                                <option value="">Scegli il campo...</option>
                                {availableCourts.map(court => (
                                    <option key={court.id} value={court.id}>{court.name} ({court.sport_type})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* LUOGO E DESCRIZIONE */}
                    <LocationPicker
                        value={formData}
                        onChange={(locationData) => setFormData(prev => ({ ...prev, ...locationData }))}
                    />

                    <div>
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Descrizione <i className="text-slate-400 text-[10px]">(max 300 caratteri)</i></label>
                        <textarea
                            
                            maxLength={300}
                            className={`w-full h-50 resize-none p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${containsLinks(formData.description) ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
                                }`}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                        {containsLinks(formData.description) && (
                            <p className="mt-2 text-xs text-red-600 font-bold">❌ Non sono consentiti link nella descrizione</p>
                        )}
                    </div>

                    <button
                        disabled={loading}
                        className="w-full mt-4 cursor-pointer bg-yellow-50 text-yellow-600 border border-yellow-600 py-4 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-yellow-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Creazione in corso...' : 'SALVA MODIFICHE'}
                    </button>

                </form>
            </div>
        );
    }

    // SE NON C'È UN ID, MOSTRIAMO IL FORM DI CREAZIONE NORMALE
    return (
        <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
            <button
                onClick={() => navigate(-1)}
                type="button"
                className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
            >
                TORNA INDIETRO
            </button>
            <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase">Organizza Match</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Info partite attive */}
                <div className={`border rounded-xl p-3 text-xs font-semibold ${activeMatchCount >= 5 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                    <div className="flex items-center justify-between">
                        <p>
                            Partite attive: <span className="font-black">{activeMatchCount}</span>/5
                        </p>
                        <div className="relative cursor-help">
                            <button
                                type="button"
                                onClick={() => setTooltipActive(!tooltipActive)}
                                className="p-1 hover:opacity-70 transition-opacity"
                            >
                                <Info size={16} className="inline" />
                            </button>
                            {tooltipActive && (
                                <div className="absolute bottom-full right-0 mb-2 bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 animate-fade-in">
                                    Puoi avere max 5 partite attive contemporaneamente
                                </div>
                            )}
                        </div>
                    </div>
                    {activeMatchCount >= 5 && (
                        <p className="mt-1">❌ Hai raggiunto il limite. Aspetta che una partita finisca.</p>
                    )}
                </div>

                {/* SPORT */}
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Sport</label>
                    <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.sport}
                        onChange={handleSportChange}
                    >
                        <option value="Calcetto" className="bg-white text-slate-800 py-1 font-medium">⚽ Calcetto</option>
                        <option value="Calcio a 7" className="bg-white text-slate-800 py-1 font-medium">⚽ Calcio a 7</option>
                        <option value="Calcio a 11" className="bg-white text-slate-800 py-1 font-medium">⚽ Calcio a 11</option>
                        <option value="Padel" className="bg-white text-slate-800 py-1 font-medium">🎾 Padel</option>
                        <option value="Basket (allenamento)" className="bg-white text-slate-800 py-1 font-medium">🏀 Basket (allenamento)</option>
                        <option value="Basket (3vs3)" className="bg-white text-slate-800 py-1 font-medium">🏀 Basket (3vs3)</option>
                        <option value="Basket (5vs5)" className="bg-white text-slate-800 py-1 font-medium">🏀 Basket (5vs5)</option>
                        <option value="Tennis singolo" className="bg-white text-slate-800 py-1 font-medium">🎾 Tennis singolo</option>
                        <option value="Tennis doppio" className="bg-white text-slate-800 py-1 font-medium">🎾 Tennis doppio</option>
                        <option value="Volley" className="bg-white text-slate-800 py-1 font-medium">🏐 Volley</option>
                        <option value="Personalizzato" className="bg-white text-slate-800 py-1 font-medium">⚙️ Personalizzato</option>
                    </select>
                </div>

                {/* VISIBILIT� MATCH */}
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Visibilità Match</label>
                    <div className="flex gap-2">
                        <label className={`flex-1 p-3 border rounded-xl text-center cursor-pointer transition-all ${formData.team_id === null ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 font-semibold hover:bg-slate-100'}`}>
                            <input type="radio" className="hidden" name="visibility" checked={formData.team_id === null} onChange={() => setFormData({ ...formData, team_id: null })} />
                            🌐 Pubblico
                        </label>
                        <label className={`flex-1 p-3 border rounded-xl text-center cursor-pointer transition-all ${formData.team_id !== null ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 font-semibold hover:bg-slate-100'}`}>
                            <input type="radio" className="hidden" name="visibility" checked={formData.team_id !== null} onChange={() => setFormData({ ...formData, team_id: myTeams.length > 0 ? myTeams[0].id : '' })} />
                            🛡️ Squadra
                        </label>
                    </div>
                    
                    {formData.team_id !== null && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3"
                        >
                            {myTeams.length > 0 ? (
                                <select
                                    className="w-full p-3 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-indigo-900"
                                    value={formData.team_id || ''}
                                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                                >
                                    <option value="" disabled>Seleziona una squadra...</option>
                                    {myTeams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm">
                                    <p className="font-semibold">Nessuna squadra trovata.</p>
                                    <p className="text-xs mt-1">Devi unirti o creare una squadra per organizzare match privati per il team.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* TITOLO */}
                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Titolo <span className="text-slate-400 text-[10px] align-middle italic">(max 32 caratteri)</span></label>
                    <input
                        type="text"
                        maxLength={32}
                        
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                {/* DATA E GIOCATORI */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Quando</label>
                        <input
                            type="datetime-local"
                            lang="it-IT"
                            //la data passata non è selezionabile
                            min={new Date().toISOString().slice(0, 16)}
                            required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
                        />
                    </div>
                    <div>
                        {/* Il numero di giocatori cambia in base allo sport (principalmente), quindi sull'onchange della select dello sport */}
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Giocatori Totali</label>
                        <input
                            type="number"
                            required
                            disabled={formData.sport !== 'Personalizzato'}
                            min="2"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.max_players}
                            onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                        />
                    </div>
                </div>

                {/* SELEZIONE CENTRO AFFILIATO - DISABILITATO */}
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 opacity-60">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold text-amber-700 uppercase">Prenota in un centro affiliato (Opzionale)</label>
                        <span className="inline-block bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded"> Work in Progress</span>
                    </div>
                    <select
                        // disabled
                        className="w-full p-3 bg-slate-100 border border-amber-200 rounded-xl outline-none mb-3"
                        onChange={(e) => {
                            const centerId = e.target.value;
                            handleCenterChange(centerId);
                        }}
                    >
                        <option value="">Seleziona un centro...</option>
                        {centers.map(c => <option key={c.id} value={c.id}>{c.full_name || c.username}</option>)}
                    </select>

                    {availableCourts.length > 0 && (
                        <select
                            // disabled
                            className="w-full p-3 bg-slate-100 border border-amber-200 rounded-xl outline-none"
                            onChange={(e) => setFormData({ ...formData, court_id: e.target.value, reservation_status: 'draft' })}
                        >
                            <option value="">Scegli il campo...</option>
                            {availableCourts.map(court => (
                                <option key={court.id} value={court.id}>{court.name} ({court.sport_type})</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* LUOGO E DESCRIZIONE */}
                <LocationPicker
                    value={formData}
                    onChange={(locationData) => setFormData(prev => ({ ...prev, ...locationData }))}
                />

                <div>
                    <label className="block text-sm font-bold text-slate-500 uppercase mb-1.5">Descrizione <i className="text-slate-400 text-[10px]">(max 300 caratteri)</i></label>
                    <textarea
                        
                        maxLength={300}
                        className={`w-full h-50 resize-none p-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${containsLinks(formData.description) ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500'
                            }`}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                    {containsLinks(formData.description) && (
                        <p className="mt-2 text-xs text-red-600 font-bold">❌ Non sono consentiti link nella descrizione</p>
                    )}
                </div>

                <button
                    disabled={loading || activeMatchCount >= 5}
                    className="w-full cursor-pointer bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Creazione in corso...' : 'PUBBLICA PARTITA'}
                </button>

            </form>
        </div>
    );

}
