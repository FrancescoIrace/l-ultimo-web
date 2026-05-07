import { data, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Zap, MapPin, UserPlus, User, LogOut, Puzzle, Trophy, Calendar, Info, ArrowRight, ArrowLeft, LayoutDashboard, Clock, Pencil, Edit2, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { GetSportStyle } from './BusinessUtils';
import ModalOrari from '../../components/ModalOrari';
import { useAlert } from '../../components/AlertComponent';


export default function BusinessDashboard({ user, name }) {
    const navigate = useNavigate();
    const [campi, setCampi] = useState([]);
    const [orari, setOrari] = useState([]);
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const [isOrariOpen, setIsOrariOpen] = useState(false);
    const [requests, setRequests] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [processingId, setProcessingId] = useState(null);
    const { success, error, alert, confirm } = useAlert();

    async function fetchHours() {
        const { data } = await supabase.from('business_hours').select('*').eq('center_id', user.id).order('day_of_week');
        // Se la tabella è vuota, inizializziamo dei valori di default
        if (data?.length === 0) {
            setOrari(days.map((_, i) => ({ day_of_week: i, open_time: '09:00', close_time: '22:00', is_closed: false })));
        } else {
            setOrari(data);
        }
    }

    const fetchIncomingRequests = async () => {
        // 1. Recuperiamo le partite per i campi di questo centro
        const { data: matches, error: mError } = await supabase
            .from('matches')
            .select(`
            id,
            sport,
            datetime,
            title,
            reservation_status,
            creator_id,
            sports_courts!inner (
                name,
                center_id
            )
        `)
            .eq('sports_courts.center_id', user.id)
            .eq('reservation_status', 'requested')
            .order('datetime', { ascending: true });

        if (mError) {
            console.error("Errore matches:", mError);
            return;
        }

        if (matches && matches.length > 0) {
            // 2. Recuperiamo i profili dei creatori separatamente
            // Dato che creator_id è un UUID di auth, lo usiamo per cercare nel profilo public
            const creatorIds = matches.map(m => m.creator_id);

            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('id, username, full_name')
                .in('id', creatorIds);

            if (pError) {
                console.error("Errore profili:", pError);
            }

            // 3. Uniamo i dati manualmente nel frontend
            const enrichedRequests = matches.map(match => ({
                ...match,
                profiles: profiles?.find(p => p.id === match.creator_id) || { username: "Utente" }
            }));

            setRequests(enrichedRequests);
        } else {
            setRequests([]);
        }
    };

    const fetchAppointments = async () => {
        const { data: matches, error: mError } = await supabase
            .from('matches')
            .select(`
            id,
            sport,
            datetime,
            title,
            reservation_status,
            creator_id,
            sports_courts!inner (
                name,
                center_id
            )
        `)
            .eq('sports_courts.center_id', user.id)
            .eq('reservation_status', 'confirmed')
            .order('datetime', { ascending: true });

        if (mError) {
            console.error("Errore matches:", mError);
            return;
        }

        if (matches && matches.length > 0) {
            // 2. Recuperiamo i profili dei creatori separatamente
            // Dato che creator_id è un UUID di auth, lo usiamo per cercare nel profilo public
            const creatorIds = matches.map(m => m.creator_id);

            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('id, username, full_name')
                .in('id', creatorIds);

            if (pError) {
                console.error("Errore profili:", pError);
            }

            // 3. Uniamo i dati manualmente nel frontend
            const enrichedAppointments = matches.map(match => ({
                ...match,
                profiles: profiles?.find(p => p.id === match.creator_id) || { username: "Utente" }
            }));

            setAppointments(enrichedAppointments);
        } else {
            setAppointments([]);
        }
    };

    const handleUpdateStatus = (matchId, newStatus) => {
        const isConfirming = newStatus === 'confirmed';
        const actionText = isConfirming ? "ACCETTARE" : "RIFIUTARE";

        // Messaggio per l'alert
        const message = `Sei sicuro di voler ${actionText} questa richiesta di prenotazione?`;

        // Utilizzo del tuo alert: confirm(messaggio, callback)
        confirm(message, async () => {
            setProcessingId(matchId); // Inizia caricamento (mostra spinner sul bottone)

            try {
                // 1. Aggiorna lo stato della partita
                const { data: updatedMatch, error: matchError } = await supabase
                    .from('matches')
                    .update({ reservation_status: newStatus })
                    .eq('id', matchId)
                    .select('creator_id, title, sport')
                    .single();

                if (matchError) throw matchError;

                // 2. Crea la notifica per il creatore
                const notificationContent = isConfirming
                    ? `La tua richiesta per la partita di ${updatedMatch.sport} è stata ACCETTATA!`
                    : `Spiacenti, la richiesta per la partita "${updatedMatch.title}" è stata rifiutata dal centro sportivo.`;

                const { error: notifError } = await supabase
                    .from('notifications')
                    .insert([
                        {
                            user_id: updatedMatch.creator_id,
                            sender_id: user.id, // ID del centro
                            type: 'match_update',
                            title: isConfirming ? 'Prenotazione Confermata! ✅' : 'Prenotazione Rifiutata ❌',
                            content: notificationContent,
                            link: `/match/${matchId}`,
                            is_read: false
                        }
                    ]);

                if (notifError) throw notifError;

                // 3. Feedback UI e aggiornamento lista locale
                setRequests(prev => prev.filter(r => r.id !== matchId));
                success(isConfirming ? "Confermata e notifica inviata!" : "Richiesta rifiutata.");

            } catch (err) {
                console.error(err);
                error("Errore durante l'operazione: " + err.message);
            } finally {
                setProcessingId(null); // Fine caricamento
            }
        });
    };

    useEffect(() => {
        async function loadCampi() {
            const { data, error } = await supabase
                .from('sports_courts')
                .select('id, name, sport_type')
                .eq('center_id', user.id);
            if (!error) {
                setCampi(data);
            }
        }
        loadCampi();
        fetchHours();
        fetchIncomingRequests();
        fetchAppointments();
        // Sottoscrizione Realtime
        const channel = supabase
            .channel('business_requests')
            .on(
                'postgres_changes',
                {
                    event: '*', // Ascolta insert, update e delete
                    schema: 'public',
                    table: 'matches'
                },
                () => {
                    // Ricarichiamo i dati quando succede qualcosa
                    fetchIncomingRequests();
                    fetchAppointments();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [user.id]);


    return (
        <div className="grid grid-cols-1 gap-4 p-4">

            {/* PANNELLO DATI CENTRO */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                        <MapPin size={20} />
                    </div>
                    <h2 className="text-slate-800">Centro Sportivo <i className='font-bold'>{name || ''}</i></h2>
                </div>
                {/* Piccolo testo di benvenuto per il centro */}
                <p className="text-sm text-slate-500">Benvenuto 👏<br /> qui potrai gestire il tuo centro sportivo. 💪</p>
                <p className="text-sm text-slate-500">Potrai gestire le prenotazioni, le partite e i campi. 🤓</p>
                <p className="text-sm text-slate-500">Anche i tuoi orari di apertura e chiusura. ⏱️</p>
            </div>

            <div className="py-6">
                <div className="px-4 mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                        Richieste <span className="text-blue-600">Pendenti</span>
                    </h2>
                    <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        {requests.length} da gestire
                    </span>
                </div>

                {/* CAROUSEL CONTAINER */}
                <div className="flex gap-4 overflow-x-auto px-4 pb-8 scrollbar-hide snap-x snap-mandatory">
                    {requests.length === 0 ? (
                        <div className="w-full bg-slate-50 rounded-[32px] p-10 border-2 border-dashed border-slate-200 flex flex-col items-center">
                            <p className="text-slate-400 font-bold text-sm">Nessuna richiesta attiva</p>
                        </div>
                    ) : (
                        <>
                            {requests.map((req) => {
                                const dateObj = new Date(req.datetime);
                                const isExpired = dateObj < new Date();
                                const giorno = dateObj.toLocaleDateString('it-IT', { day: '2-digit' });
                                const mese = dateObj.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
                                const orario = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

                                return (
                                    <div key={req.id} className={`flex-shrink-0 w-[80vw] md:w-[350px] rounded-[40px] p-2 border shadow-2xl shadow-slate-200/50 snap-center transition-all ${isExpired ? 'bg-red-50 border-red-200 shadow-red-200/50' : 'bg-white border-slate-100'}`}>
                                        <div className="flex flex-col h-full">

                                            {/* 1. SEZIONE TEMPO (Il focus principale) */}
                                            <div className={`flex items-center gap-4 p-4 rounded-[35px] text-white ${isExpired ? 'bg-red-700' : 'bg-slate-900'}`}>
                                                {/* Blocco Data */}
                                                <div className={`flex flex-col items-center justify-center rounded-[25px] w-16 h-16 shadow-lg ${isExpired ? 'bg-red-600 shadow-red-500/30' : 'bg-blue-600 shadow-blue-500/30'}`}>
                                                    <span className="text-xl font-black leading-none">{giorno}</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">{mese}</span>
                                                </div>

                                                {/* Blocco Orario */}
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orario Inizio</span>
                                                    <span className="text-2xl font-black tracking-tighter">{orario}</span>
                                                </div>

                                                <div className="ml-auto pr-2">
                                                    <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center">
                                                        <Clock size={18} className={isExpired ? 'text-red-500' : 'text-blue-500'} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2. SEZIONE CAMPO (Identificazione immediata) */}
                                            <div className="px-6 py-5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risorsa Richiesta</span>
                                                </div>
                                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter truncate">
                                                    {req.sports_courts?.name || "Campo non specificato"}
                                                </h3>
                                                <p className="text-sm font-bold text-blue-600 mt-1">
                                                    {req.sport} • {req.title}
                                                </p>
                                            </div>

                                            {/* 3. AZIONI RAPIDE */}
                                            <div className="mt-auto p-2 flex gap-2">
                                                <button
                                                    disabled={processingId === req.id}
                                                    onClick={() => handleUpdateStatus(req.id, 'rejected')}
                                                    className={`w-14 h-14 flex items-center justify-center rounded-[25px] transition-all ${isExpired ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
                                                    title={isExpired ? "Elimina richiesta scaduta" : "Rifiuta"}
                                                >
                                                    <X size={24} />
                                                </button>
                                                <button
                                                    disabled={processingId === req.id || isExpired}
                                                    onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                                                    className={`flex-1 h-14 rounded-[25px] font-bold text-sm uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 ${isExpired ? 'bg-slate-300 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white shadow-xl shadow-blue-200'}`}
                                                >
                                                    {processingId === req.id ? "Elaborazione..." : (isExpired ? "Scaduta" : "Approva Prenotazione")}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>

            {/* PANNELLO CALENDARIO - Il più importante */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Calendar size={20} />
                    </div>
                    <h3 className="font-bold text-slate-800">Calendario Prenotazioni</h3>
                </div>
                {/* Qui andrà un mini-calendario o la lista del giorno */}
                {appointments.length === 0 ? (
                    <div className="w-full bg-slate-50 rounded-[32px] p-10 border-2 border-dashed border-slate-200 flex flex-col items-center">
                        <p className="text-slate-400 font-bold text-sm">Nessuna prenotazione confermata</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            {appointments.map(app => {
                                const dateObj = new Date(app.datetime);
                                const giorno = dateObj.getDate();
                                const mese = dateObj.toLocaleString('it-IT', { month: 'long' });
                                const orario = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div key={app.id} className="bg-slate-50 rounded-[32px] p-4 border-2 border-dashed border-slate-200 flex items-center gap-4">
                                        {/* Blocco Giorno */}
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl font-black leading-none">{giorno}</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{mese}</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-400">{orario}</span>
                                        </div>

                                        {/* Blocco Campo */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campo</span>
                                            </div>
                                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter truncate">
                                                {app.sports_courts?.name || "Campo non specificato"}
                                            </h3>
                                            <p className="text-sm font-bold text-blue-600 mt-1">
                                                {app.sport} • {app.title}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* PANNELLO CAMPI */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                        <LayoutDashboard size={20} />
                    </div>
                    <h3 className="font-bold text-slate-800">I tuoi Campi</h3>
                    <button onClick={() => navigate('/gestisci-campi')} className="ml-auto text-sm text-slate-400 hover:text-slate-600 flex items-center gap-2">
                        <span>Gestisci Campi</span>
                        <Pencil size={16} />
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {campi.map(court => {
                        const style = GetSportStyle(court.sport_type);
                        return (
                            <div
                                key={court.id}
                                className={`relative h-32 rounded-xl overflow-hidden shadow-md border-b-4 ${style.borderColor} ${style.bg} transition-transform active:scale-95`}
                                style={{ backgroundImage: style.pattern, backgroundSize: '40px 40px' }}
                            >
                                {/* Linee del campo (Overlay visivo) */}
                                {/* Linee del campo con centraggio perfetto */}
                                <div className="absolute inset-0 m-3 pointer-events-none border border-white/20 rounded-sm">

                                    {/* Linea Mediana Comune a tutti gli sport */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-px h-full bg-white/30"></div>
                                    </div>

                                    {/* Dettagli Soccer / Padel / Basket */}
                                    {(style.type === 'soccer' || style.type === 'padel' || style.type === 'basket') && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-12 h-12 border border-white/30 rounded-full"></div>
                                        </div>
                                    )}

                                    {/* Dettagli specifici Basket */}
                                    {style.type === 'basket' && (
                                        <>
                                            <div className="absolute left-0 top-1/4 bottom-1/4 w-8 border-y border-r border-white/30 rounded-r-lg"></div>
                                            <div className="absolute right-0 top-1/4 bottom-1/4 w-8 border-y border-l border-white/30 rounded-l-lg"></div>
                                        </>
                                    )}

                                    {/* Dettagli specifici Tennis */}
                                    {style.type === 'tennis' && (
                                        <div className="absolute inset-x-0 top-4 bottom-4 border-y border-white/20">
                                            {/* Corridoi del doppio */}
                                        </div>
                                    )}
                                </div>

                                {/* Contenuto Informativo */}
                                <div className="relative z-10 p-4 flex justify-between items-start h-full text-white">
                                    <div>
                                        <h4 className="text-xl font-black uppercase tracking-tight drop-shadow-md">
                                            {court.name}
                                        </h4>
                                        <span className="bg-black/20 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                                            {court.sport_type}
                                        </span>
                                    </div>
                                </div>

                                {/* Badge Stato */}
                                <div className="absolute bottom-3 right-3">
                                    <span className="text-[10px] font-black bg-white text-slate-900 px-2 py-1 rounded-full shadow-lg uppercase">
                                        {court.is_active ? '● Attivo' : '○ Inattivo'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* PANNELLO ORARI */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <Clock size={20} />
                    </div>
                    <h3 className="font-bold text-slate-800">Orari del centro</h3>
                    <button onClick={() => setIsOrariOpen(true)} className="ml-auto text-sm text-slate-400 hover:text-slate-600 flex items-center gap-2">
                        <span>Modifica Orari</span>
                        <Edit2 size={16} />
                    </button>
                    <ModalOrari
                        isOpen={isOrariOpen}
                        onClose={() => setIsOrariOpen(false)}
                        centerId={user.id}
                    />
                </div>
                <div className="space-y-2">
                    {orari.map(item => (
                        <div key={item.day_of_week} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="font-bold text-slate-700 w-24">{days[item.day_of_week]}</span>
                            <span className="text-slate-600">{item.is_closed ? 'Chiuso' : `${item.open_time.slice(0, 5)} - ${item.close_time.slice(0, 5)}`}</span>
                            <span className={`ml-auto px-2 py-1 rounded-lg text-[10px] font-black uppercase ${item.is_closed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                {item.is_closed ? 'Chiuso' : 'Aperto'}
                            </span>
                        </div>
                    ))}
                </div>


            </div>
        </div>
    );
}






