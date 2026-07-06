import { data, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Zap, MapPin, UserPlus, User, LogOut, Puzzle, Trophy, Calendar as CalendarIcon, Info, ArrowRight, ArrowLeft, LayoutDashboard, Clock, Pencil, Edit2, Search, X, AlertCircle, List, ChevronLeft, ChevronRight, CheckCircle, Download, XCircle, MessageCircle, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { GetSportStyle } from './BusinessUtils';
import ModalOrari from '../../components/ModalOrari';
import { useAlert } from '../../components/AlertComponent';
import { notifyReservationConfirmed, notifyReservationRejected } from '../../lib/notificationService';


export default function BusinessDashboard({ user, name }) {
    const navigate = useNavigate();
    const [campi, setCampi] = useState([]);
    const [orari, setOrari] = useState([]);
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const [isOrariOpen, setIsOrariOpen] = useState(false);
    const [requests, setRequests] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [calendarView, setCalendarView] = useState('list'); // 'list' | 'calendar'
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [processingId, setProcessingId] = useState(null);
    const [rejectingMatchId, setRejectingMatchId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('Campo occupato (Torneo / Scuola Calcio)');
    const [customReason, setCustomReason] = useState('');
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [appointmentParticipants, setAppointmentParticipants] = useState([]);
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);

    // Blocca lo scroll della pagina sotto la modale: senza questo, su mobile lo
    // scroll "buca" oltre la lista dei giocatori fino al contenuto sottostante.
    useEffect(() => {
        if (!isAppointmentModalOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [isAppointmentModalOpen]);

    // Nuovi stati per il Day Modal (multi-partite)
    const [selectedDayAppointments, setSelectedDayAppointments] = useState(null);
    const [selectedDayDate, setSelectedDayDate] = useState(null);

    const [isSavingParticipants, setIsSavingParticipants] = useState(false);
    const { success, error, alert, confirm } = useAlert();

    const handleSendOrganizerNotification = async (appointment) => {
        if (!appointment?.profiles?.id) return;
        confirm("Vuoi inviare una notifica all'organizzatore per chiedergli di farsi vivo?", async () => {
            const { error: notifError } = await supabase
                .from('notifications')
                .insert([
                    {
                        user_id: appointment.creator_id,
                        sender_id: user.id, // ID del centro
                        type: 'system',
                        title: 'Messaggio dal Centro Sportivo',
                        content: `Ciao ${appointment.profiles?.full_name || appointment.profiles?.username}, ${name ? `il ${name}` : 'il centro sportivo'} ti vuole contattare.`,
                        link: `/partite/${appointment.id}`
                    }
                ]);

            if (notifError) {
                console.error(notifError);
                error("Errore nell'invio della notifica.");
            } else {
                success("Notifica inviata all'organizzatore!");
            }
        });
    };

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
                center_id,
                price_p_p,
                isOutdoor,
                hasCamera
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
                .select('id, username, full_name, cellulare')
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
            current_players,
            max_players,
            reservation_status,
            creator_id,
            sports_courts!inner (
                name,
                center_id,
                price_p_p,
                isOutdoor
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
                .select('id, username, full_name, cellulare')
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

        if (newStatus === 'rejected') {
            setRejectingMatchId(matchId);
            setRejectionReason('Campo occupato (Torneo / Scuola Calcio)');
            setCustomReason('');
            return;
        }

        const actionText = "ACCETTARE";

        // Messaggio per l'alert
        const message = `Sei sicuro di voler ${actionText} questa richiesta di prenotazione?`;

        // Utilizzo del tuo alert: confirm(messaggio, callback)
        confirm(message, async () => {
            await executeStatusUpdate(matchId, newStatus, null);
        });
    };

    const handleConfirmReject = async () => {
        if (!rejectingMatchId) return;
        const finalReason = rejectionReason === 'Altro' ? customReason : rejectionReason;
        const matchId = rejectingMatchId;
        setRejectingMatchId(null);
        await executeStatusUpdate(matchId, 'rejected', finalReason);
    };

    const executeStatusUpdate = async (matchId, newStatus, reason) => {
        const isConfirming = newStatus === 'confirmed';
        setProcessingId(matchId); // Inizia caricamento (mostra spinner sul bottone)

        try {
            // Preparo l'oggetto per l'update
            const updatePayload = { reservation_status: newStatus };
            if (newStatus === 'rejected') {
                updatePayload.rejection_reason = reason;
            }

            // 1. Aggiorna lo stato della partita
            const { data: updatedMatch, error: matchError } = await supabase
                .from('matches')
                .update(updatePayload)
                .eq('id', matchId)
                .select('creator_id, title, sport')
                .single();

            if (matchError) throw matchError;

            // 2. Crea la notifica per TUTTI i partecipanti iscritti e per il creatore
            const { data: participants } = await supabase
                .from('participants')
                .select('user_id')
                .eq('match_id', matchId)
                .eq('status', 'confirmed');

            const usersToNotify = new Set([updatedMatch.creator_id]);
            if (participants && participants.length > 0) {
                participants.forEach(p => usersToNotify.add(p.user_id));
            }

            // Notifica in-app + push tramite il service (un insert diretto qui
            // fallirebbe per RLS: il centro non può scrivere notifiche per altri utenti)
            await Promise.all(
                Array.from(usersToNotify).map(userId =>
                    isConfirming
                        ? notifyReservationConfirmed(userId, updatedMatch.title, updatedMatch.sport, matchId, user.id)
                        : notifyReservationRejected(userId, updatedMatch.title, reason, matchId, user.id)
                )
            );

            // 3. Feedback UI e aggiornamento lista locale
            setRequests(prev => prev.filter(r => r.id !== matchId));
            if (!isConfirming) {
                setAppointments(prev => prev.filter(a => a.id !== matchId));
                // Aggiorna anche il modal del giorno multi-partita se aperto
                if (selectedDayAppointments) {
                    setSelectedDayAppointments(prevDay => prevDay ? prevDay.filter(a => a.id !== matchId) : null);
                }
                // Chiudi il modal dettaglio se è quello della partita annullata
                if (isAppointmentModalOpen && selectedAppointment?.id === matchId) {
                    setIsAppointmentModalOpen(false);
                    setSelectedAppointment(null);
                }
            }
            success(isConfirming ? "Confermata e notifica inviata!" : "Annullata con successo e notifiche inviate.");

        } catch (err) {
            console.error(err);
            error("Errore durante l'operazione: " + err.message);
        } finally {
            setProcessingId(null); // Fine caricamento
        }
    };

    const handleOpenAppointmentModal = async (app) => {
        setSelectedAppointment(app);
        setIsAppointmentModalOpen(true);
        setAppointmentParticipants([]); // Reset inside modal

        let { data: partData, error } = await supabase
            .from('participants')
            .select(`
                *,
                profiles (full_name, username)
            `)
            .eq('match_id', app.id)
            .order('status', { ascending: true });

        if (error) {
            console.error("Error fetching participants:", error);
        }

        if (partData) {
            // Mappiamo indipendentemente se c'è isPagato o ispagato per sicurezza
            const mappedData = partData.map(p => ({
                ...p,
                isPagato: p.isPagato !== undefined ? p.isPagato : (p.ispagato !== undefined ? p.ispagato : false)
            }));
            setAppointmentParticipants(mappedData);
        }
    };

    const toggleHasPaid = (participantId, currentStatus) => {
        const newStatus = !currentStatus;


        // Solo ottimistico. Il salvataggio reale avverrà premendo "Salva Modifiche"
        setAppointmentParticipants(prev => prev.map(p =>
            p.id === participantId ? { ...p, isPagato: newStatus } : p
        ));
    };

    const saveParticipantsList = async () => {
        if (!selectedAppointment || appointmentParticipants.length === 0) return;
        setIsSavingParticipants(true);
        try {
            // Eseguiamo gli update uno alla volta loggando per capire esattamamente l'errore del DB
            let hasErrors = false;
            let lastErrorMsg = "";

            for (const part of appointmentParticipants) {
                // Proviamo prima con the quoted version: "isPagato"
                let { data: updatedRows, error: errFirst } = await supabase
                    .from('participants')
                    .update({ isPagato: part.isPagato })
                    .eq('id', part.id)
                    .select();

                if (errFirst) {

                    // Fallback to lowercase
                    let { data: updatedRowsFallback, error: errSecond } = await supabase
                        .from('participants')
                        .update({ ispagato: part.isPagato })
                        .eq('id', part.id)
                        .select();

                    if (errSecond) {
                        hasErrors = true;
                        lastErrorMsg = errSecond.message;
                    } else if (!updatedRowsFallback || updatedRowsFallback.length === 0) {
                        hasErrors = true;
                        lastErrorMsg = "Salvataggio bloccato dalle policy del database (RLS silent fail).";
                    }
                } else if (!updatedRows || updatedRows.length === 0) {
                    hasErrors = true;
                    lastErrorMsg = "Permessi insufficienti (RLS): Modifica bloccata senza errori dal DB.";
                }
            }

            if (hasErrors) {
                error(`Errore durante il salvataggio: ${lastErrorMsg}`);
            } else {
                success("Stati di pagamento aggiornati con successo.");
            }
        } catch (err) {
            error("Impossibile salvare alcune modifiche.");
        } finally {
            setIsSavingParticipants(false);
        }
    };

    const printParticipantsList = () => {
        if (!selectedAppointment || appointmentParticipants.length === 0) return;

        const matchTitle = `${selectedAppointment.sport} - ${selectedAppointment.title}`;
        const matchDate = new Date(selectedAppointment.datetime).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        let htmlContent = `
            <!DOCTYPE html>
            <html lang="it">
            <head>
                <meta charset='utf-8'>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lista Partecipanti</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; color: #000; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #000; padding: 10px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h1>Lista Partecipanti Partita</h1>
                <h3>${matchTitle}</h3>
                <p><strong>Data e Ora:</strong> ${matchDate}</p>
                <p><strong>Campo:</strong> ${selectedAppointment.sports_courts?.name || "Non specificato"}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Nominativo</th>
                            <th>Ha Pagato?</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        appointmentParticipants.forEach(p => {
            const name = p.profiles?.full_name || p.profiles?.username || "Utente Sconosciuto";
            htmlContent += `
                        <tr>
                            <td>${name}</td>
                            <td></td>
                        </tr>
            `;
        });

        htmlContent += `
                    </tbody>
                </table>
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        } else {
            alert("Per favore abilita i popup per poter stampare la lista.");
        }
    }

    useEffect(() => {
        async function loadCampi() {
            const { data, error } = await supabase
                .from('sports_courts')
                .select('id, name, sport_type, price_p_p, isOutdoor,hasCamera')
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


    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
        const startDay = firstDay === 0 ? 6 : firstDay - 1; // Start with Monday

        const days = [];
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayAppointments = appointments.filter(app => {
                const appDate = new Date(app.datetime);
                return appDate.getFullYear() === year && appDate.getMonth() === month && appDate.getDate() === d;
            });

            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

            days.push(
                <div key={d} className={`min-h-[80px] md:min-h-[100px] p-1 md:p-2 flex flex-col rounded-xl border ${isToday ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200 bg-white'} overflow-hidden`}>
                    <span className={`text-xs md:text-sm font-bold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full mb-1 flex-shrink-0 ${isToday ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{d}</span>
                    <div className="flex flex-col gap-1 w-full overflow-y-auto scrollbar-hide">
                        {dayAppointments.length > 2 ? (
                            <div 
                                onClick={() => { setSelectedDayDate(dateStr); setSelectedDayAppointments(dayAppointments); }}
                                className="text-[10px] md:text-[11px] mt-1 bg-indigo-500 text-white px-1 md:px-2 py-1.5 rounded-lg font-black text-center cursor-pointer shadow-sm hover:bg-indigo-600 active:scale-95 transition-all"
                            >
                                {dayAppointments.length} Partite
                            </div>
                        ) : (
                            dayAppointments.map(app => {
                                const time = new Date(app.datetime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div
                                        key={app.id}
                                        onClick={() => handleOpenAppointmentModal(app)}
                                        className="text-[9px] md:text-[10px] bg-blue-100 text-blue-800 px-0.5 md:px-1.5 py-1 rounded font-bold truncate flex-shrink-0 cursor-pointer hover:bg-blue-200 active:scale-95 transition-all text-center md:text-left"
                                        title={`${time} - ${app.title}`}>
                                        {time} <span className="hidden xl:inline ml-1">{app.sports_courts?.name || app.sport}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            );
        }

        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

        const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
        const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));

        return (
            <div className="flex flex-col gap-4 animate-fade-in">
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl">
                    <button onClick={prevMonth} className="p-2 bg-white text-slate-600 rounded-xl hover:bg-slate-100 shadow-sm border border-slate-200 transition-colors"><ChevronLeft size={20} /></button>
                    <h4 className="font-black text-slate-800 text-lg uppercase tracking-tighter">{monthNames[month]} {year}</h4>
                    <button onClick={nextMonth} className="p-2 bg-white text-slate-600 rounded-xl hover:bg-slate-100 shadow-sm border border-slate-200 transition-colors"><ChevronRight size={20} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                    {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
                        <div key={d} className="text-center text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest py-2">{d}</div>
                    ))}
                    {days}
                </div>
            </div>
        );
    };

    const getFilteredAppointmentsForList = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 7);
        maxDate.setHours(23, 59, 59, 999);

        return appointments.filter(app => {
            const appDate = new Date(app.datetime);
            return appDate >= today && appDate <= maxDate;
        }).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    };

    const listAppointments = getFilteredAppointmentsForList();

    return (
        <div className="p-2 md:p-6 lg:p-4 max-w-[1700px] mx-auto bg-slate-50/50 min-h-screen /50 rounded-3xl">

            {/* Modal Partite del Giorno (Multi-Partite) */}
            {selectedDayAppointments && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in /50" onClick={() => setSelectedDayAppointments(null)}>
                    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-2xl max-w-sm md:max-w-xl w-full mx-auto animate-slide-up relative flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-lg md:text-2xl font-black text-slate-800 uppercase tracking-tighter">
                                Partite del {new Date(selectedDayDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </h3>
                            <button onClick={() => setSelectedDayAppointments(null)} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 ">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex flex-col gap-3 overflow-y-auto scrollbar-hide pr-1">
                            {selectedDayAppointments.map(app => {
                                const time = new Date(app.datetime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div 
                                        key={app.id} 
                                        onClick={() => {
                                            setSelectedDayAppointments(null);
                                            handleOpenAppointmentModal(app);
                                        }}
                                        className="bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl p-4 cursor-pointer active:scale-95 transition-all flex justify-between items-center"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-xl font-black text-blue-900 ">{time}</span>
                                            <span className="text-sm font-bold text-blue-600 uppercase tracking-tight">{app.sports_courts?.name || app.sport}</span>
                                            <span className="text-xs font-semibold text-slate-500 mt-1">{app.title}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-full shadow-sm text-blue-500 ">
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Dettaglio Partita Prenotata */}
            {isAppointmentModalOpen && selectedAppointment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in /50" onClick={() => setIsAppointmentModalOpen(false)}>
                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-lg md:max-w-3xl lg:max-w-5xl w-full mx-auto animate-slide-up relative flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between mb-6 flex-shrink-0">
                            <h3 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-800 uppercase tracking-tighter ">
                                Dettagli Prenotazione
                            </h3>
                            <button onClick={() => setIsAppointmentModalOpen(false)} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-blue-50/50 rounded-2xl p-4 md:p-6 border border-blue-100 flex flex-col gap-2 mb-6 flex-shrink-0">
                            <span className="text-xs md:text-sm lg:text-base font-bold uppercase text-blue-600 tracking-widest">{selectedAppointment.sport} - {selectedAppointment.sports_courts?.name}</span>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-700 md:text-xl">{selectedAppointment.title}</span>
                                <span className="text-sm md:text-base lg:text-lg font-black bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
                                    {new Date(selectedAppointment.datetime).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex mt-3 md:mt-4 pt-3 md:pt-4 border-t border-blue-100 justify-between items-center">
                                <span className="text-sm md:text-base lg:text-lg text-slate-600 font-medium">Giocatori iscritti:</span>
                                <span className="font-black text-lg md:text-2xl lg:text-3xl text-slate-800 ">{selectedAppointment.current_players || 0} / {selectedAppointment.max_players || '-'}</span>
                            </div>
                        </div>

                        {(() => {
                            const hasPhone = !!selectedAppointment.profiles?.cellulare;
                            return (
                                <div className={`rounded-2xl p-4 md:p-5 border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 flex-shrink-0 ${hasPhone ? 'bg-green-50/50 border-green-200 ' : 'bg-slate-50/50 border-slate-200 '}`}>
                                    <div className="flex flex-col">
                                        <span className={`text-xs md:text-[13px] font-bold uppercase tracking-widest ${hasPhone ? 'text-green-700 ' : 'text-slate-500 '}`}>Organizzatore Partita</span>
                                        <span className="text-base md:text-lg font-black text-slate-800 ">{selectedAppointment.profiles?.full_name || selectedAppointment.profiles?.username}</span>
                                        <span className="text-xs md:text-sm font-bold text-slate-500 mt-0.5">{selectedAppointment.profiles?.cellulare || "Nessun numero fornito"}</span>
                                    </div>
                                    {hasPhone ? (
                                        <a 
                                            href={`https://wa.me/${String(selectedAppointment.profiles.cellulare).replace(/\D/g, '').startsWith('39') ? String(selectedAppointment.profiles.cellulare).replace(/\D/g, '') : '39' + String(selectedAppointment.profiles.cellulare).replace(/\D/g, '')}?text=Ciao%20${encodeURIComponent(selectedAppointment.profiles.full_name || selectedAppointment.profiles.username)}!%20Ti%20contattiamo%20dal%20centro%20sportivo%20per%20la%20tua%20prenotazione%20di%20${encodeURIComponent(selectedAppointment.sport)}.`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="w-full sm:w-auto bg-[#25D366] text-white flex items-center justify-center gap-2 px-5 py-3 md:px-6 md:py-3.5 rounded-xl font-bold shadow-lg shadow-[#25D366]/30 active:scale-95 transition-all text-sm md:text-base hover:bg-[#20bd5a]"
                                        >
                                            <MessageCircle size={20} className="md:w-6 md:h-6" /> Contatta su WhatsApp
                                        </a>
                                    ) : (
                                        <button 
                                            onClick={() => handleSendOrganizerNotification(selectedAppointment)}
                                            className="w-full sm:w-auto bg-slate-800 text-white flex items-center justify-center gap-2 px-5 py-3 md:px-6 md:py-3.5 rounded-xl font-bold shadow-lg active:scale-95 transition-all text-sm md:text-base hover:bg-slate-700"
                                        >
                                            <Bell size={20} className="md:w-6 md:h-6" /> Invia notifica In-App
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="flex-1 min-h-0 max-h-[45vh] overflow-y-auto overscroll-contain mb-4 border border-slate-100 rounded-2xl p-2 md:p-4 bg-slate-50 relative ">
                            {appointmentParticipants.length === 0 ? (
                                <div className="text-center p-6 text-sm font-bold text-slate-400 ">Nessun partecipante caricato.</div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-2 md:p-4 text-[10px] md:text-sm lg:text-base uppercase font-black tracking-wider text-slate-400 border-b">Nome</th>
                                            <th className="p-2 md:p-4 text-[10px] md:text-sm lg:text-base uppercase font-black tracking-wider text-slate-400 border-b text-center">Pagato?</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointmentParticipants.map(part => {
                                            const isConfirmed = part.status === 'confirmed';
                                            return (
                                                <tr key={part.id} className="border-b last:border-0 border-slate-100 hover:bg-slate-100/50 /50 transition-colors">
                                                    <td className="p-2 md:p-4 text-sm md:text-base lg:text-lg font-bold text-slate-700 ">
                                                        {part.profiles?.full_name || part.profiles?.username || "Utente Sconosciuto"}
                                                    </td>

                                                    <td className="p-2 md:p-4 align-middle">
                                                        <div className="flex justify-center">
                                                            <button
                                                                onClick={() => toggleHasPaid(part.id, part.isPagato)}
                                                                className={`flex items-center gap-1 md:gap-2 px-3 py-1 md:px-4 md:py-2 rounded-xl active:scale-95 text-xs md:text-sm lg:text-base font-bold transition-all ${part.isPagato ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300 '}`}
                                                            >
                                                                {part.isPagato ? <CheckCircle size={16} className="md:w-5 md:h-5 lg:w-6 lg:h-6" /> : <XCircle size={16} className="md:w-5 md:h-5 lg:w-6 lg:h-6" />}
                                                                {part.isPagato ? 'Sì' : 'No'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row gap-2 md:gap-4 w-full mt-2 flex-shrink-0">
                            <button
                                onClick={() => handleUpdateStatus(selectedAppointment.id, 'rejected')}
                                disabled={processingId === selectedAppointment.id}
                                className="flex-1 bg-red-600 border-b-4 border-red-700 active:border-b-0 active:translate-y-[4px] text-white font-bold p-4 md:p-5 rounded-xl shadow-xl shadow-red-200 transition-all text-sm md:text-base lg:text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <X size={18} className="md:w-5 md:h-5 lg:w-6 lg:h-6" /> {processingId === selectedAppointment.id ? "ANNULLAMENTO..." : "ANNULLA PARTITA"}
                            </button>
                            <button
                                onClick={saveParticipantsList}
                                disabled={appointmentParticipants.length === 0 || isSavingParticipants}
                                className="flex-1 bg-green-600 border-b-4 border-green-700 active:border-b-0 active:translate-y-[4px] text-white font-bold p-4 md:p-5 rounded-xl shadow-xl shadow-green-200 transition-all text-sm md:text-base lg:text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSavingParticipants ? "SALVATAGGIO..." : "SALVA MODIFICHE"}
                            </button>
                            <button
                                onClick={printParticipantsList}
                                disabled={appointmentParticipants.length === 0}
                                className="flex-1 bg-slate-900 border-b-4 border-slate-950 active:border-b-0 active:translate-y-[4px] text-white font-bold p-4 md:p-5 rounded-xl shadow-xl shadow-slate-200 transition-all text-sm md:text-base lg:text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Download size={18} className="md:w-5 md:h-5 lg:w-6 lg:h-6" /> STAMPA LISTA
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Rifiuto */}
            {rejectingMatchId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in /80">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full mx-auto animate-slide-up relative">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 mx-auto shadow-inner">
                            <AlertCircle size={24} />
                        </div>
                        <h3 className="text-xl font-black text-center text-slate-800 uppercase tracking-tighter mb-4">Motivo Annullamento / Rifiuto</h3>
                        <div className="space-y-3 mb-6">
                            {[
                                "Campo occupato (Torneo / Scuola Calcio)",
                                "Orario non disponibile / Chiusura straordinaria",
                                "Altro"
                            ].map(reason => (
                                <label key={reason} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                        type="radio"
                                        name="rejectionReason"
                                        value={reason}
                                        checked={rejectionReason === reason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="w-4 h-4 accent-red-600 focus:ring-red-500"
                                    />
                                    <span className="text-sm font-bold text-slate-700 ">{reason}</span>
                                </label>
                            ))}
                            {rejectionReason === 'Altro' && (
                                <textarea
                                    className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 mt-2"
                                    placeholder="Specifica il motivo manuale..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    rows="2"
                                />
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setRejectingMatchId(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 transition-transform">Indietro</button>
                            <button
                                onClick={handleConfirmReject}
                                disabled={rejectionReason === 'Altro' && !customReason.trim()}
                                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-transform disabled:opacity-50"
                            >
                                Conferma
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PANNELLO DATI CENTRO (HEADER) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 /50 /50">
                <div >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-red-100 text-red-600 rounded-xl shadow-inner">
                            <MapPin size={24} />
                        </div>
                        <h2 className="text-slate-800 text-2xl">Centro Sportivo <i className='font-black'>{name || ''}</i></h2>
                    </div>
                    <p className="sm:text-sm text-slate-500 max-w-lg md:text-lg">Benvenuto 👏<br className="md:hidden" /> nella tua dashboard direzionale. Qui puoi gestire il centro, controllare le richieste di prenotazione, le tue risorse e gli orari di apertura.</p>
                </div>
                {/* Statistiche Rapide */}
                <div className="flex flex-wrap md:flex-nowrap gap-3 mt-4 md:mt-0 w-full md:w-auto">
                    <div className="flex-1 md:flex-none bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[120px] shadow-sm">
                        <span className="text-3xl font-black text-blue-600">{requests.length}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider text-center">Richieste<br/>Da Gestire</span>
                    </div>
                    <div className="flex-1 md:flex-none bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[120px] shadow-sm">
                        <span className="text-3xl font-black text-slate-800">{listAppointments.length}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider text-center">Prenotazioni<br/>Settimana</span>
                    </div>
                    <div className="flex-1 md:flex-none bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[120px] shadow-sm">
                        <span className="text-3xl font-black text-green-600">{campi.length}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider text-center">Campi<br/>Totali</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 ">

                {/* COLONNA SINISTRA PRINCIPALE SOTTO HEADER */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                    {/* SEZIONE RICHIESTE */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                Richieste <span className="text-blue-600 ">Pendenti</span>
                            </h2>
                            <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm">
                                {requests.length} da gestire
                            </span>
                        </div>

                        {/* CAROUSEL CONTAINER */}
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-1">
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
                                            <div key={req.id} className={`flex-shrink-0 w-[80vw] md:w-[350px] rounded-[40px] p-2 border shadow-2xl shadow-slate-200/50 snap-center transition-all ${isExpired ? 'bg-red-50 border-red-200 shadow-red-200/50 /50' : 'bg-white border-slate-100 '}`}>
                                                <div className="flex flex-col h-full">

                                                    {/* 1. SEZIONE TEMPO (Il focus principale) */}
                                                    <div className={`flex items-center gap-4 p-4 rounded-[35px] text-white ${isExpired ? 'bg-red-700' : 'bg-slate-900'}`}>
                                                        {/* Blocco Data */}
                                                        <div className={`flex flex-col items-center justify-center rounded-[25px] w-16 h-16 shadow-lg ${isExpired ? 'bg-red-600 shadow-red-500/30' : 'bg-blue-600 shadow-blue-500/30'}`}>
                                                            <span className="text-xl font-black leading-none ">{giorno}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider ">{mese}</span>
                                                        </div>

                                                        {/* Blocco Orario */}
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orario Inizio</span>
                                                            <span className="text-2xl font-black tracking-tighter ">{orario}</span>
                                                        </div>

                                                        <div className="ml-auto pr-2">
                                                            <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center ">
                                                                <Clock size={18} className={isExpired ? 'text-red-500' : 'text-blue-500'} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 2. SEZIONE CAMPO (Identificazione immediata) */}
                                                    <div className="px-6 py-5 ">
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
                                                    <div className="mt-auto p-2 flex gap-2 ">
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
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm ">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shadow-inner">
                                    <CalendarIcon size={20} />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Calendario <span className='text-blue-600 '>Prenotazioni</span></h3>
                            </div>
                            {/* Switch Visibilità */}
                            <div className="flex p-1 bg-slate-100 rounded-xl max-w-min">
                                <button
                                    onClick={() => setCalendarView('list')}
                                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${calendarView === 'list' ? 'bg-white shadow-sm text-blue-600 ' : 'text-slate-500 hover:text-slate-700 '}`}
                                    title="Visualizzazione a lista"
                                >
                                    <List size={18} />
                                </button>
                                <button
                                    onClick={() => setCalendarView('calendar')}
                                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${calendarView === 'calendar' ? 'bg-white shadow-sm text-blue-600 ' : 'text-slate-500 hover:text-slate-700 '}`}
                                    title="Visualizzazione a calendario"
                                >
                                    <CalendarIcon size={18} />
                                </button>
                            </div>
                        </div>
                        {/* Qui andrà un mini-calendario o la lista del giorno */}
                        {calendarView === 'list' ? (
                            listAppointments.length === 0 ? (
                                <div className="w-full bg-slate-50 rounded-[32px] p-10 border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                                    <p className="text-slate-400 font-bold text-sm">Nessuna prenotazione nei prossimi 7 giorni</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-4">
                                        {listAppointments.map(app => {
                                            const dateObj = new Date(app.datetime);
                                            const giorno = dateObj.getDate();
                                            const mese = dateObj.toLocaleString('it-IT', { month: 'long' });
                                            const orario = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                                            return (
                                                <div
                                                    key={app.id}
                                                    onClick={() => handleOpenAppointmentModal(app)}
                                                    className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors rounded-[32px] p-4 border-2 border-dashed border-slate-200 flex items-center gap-4">
                                                    {/* Blocco Giorno */}
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl font-black leading-none">{giorno}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">{mese}</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-400 ">{orario}</span>
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
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <p className="text-sm font-bold text-blue-600">
                                                                {app.sport} • {app.title}
                                                            </p>
                                                            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-bold ml-auto">
                                                                {app.current_players || 0}/{app.max_players || '-'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )) : renderCalendar()}
                    </div>

                </div> {/*  CHIUSURA COLONNA SINISTRA */}

                {/* COLONNA DESTRA */}
                <div className="lg:col-span-4 flex flex-col gap-6">

                    {/* PANNELLO CAMPI */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 ">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-green-100 text-green-600 rounded-xl shadow-inner">
                                <LayoutDashboard size={20} />
                            </div>
                            <h3 className="font-bold text-slate-800 uppercase tracking-tighter">I tuoi Campi</h3>
                            <button onClick={() => navigate('/gestisci-campi')} className="ml-auto text-sm text-slate-400 hover:text-green-600 flex items-center gap-2 transition-colors">
                                <span className="hidden sm:inline">Gestisci</span>
                                <Pencil size={18} />
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
                                        <div className="relative z-0 p-4 flex justify-between items-start h-full text-white">
                                            <div>
                                                <h4 className="text-xl font-black uppercase tracking-tight drop-shadow-md">
                                                    {court.name}
                                                </h4>
                                                <span className="bg-black/20 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                                                    {court.sport_type}
                                                </span>
                                                <span className={`backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold uppercase ml-2 text-white shadow-sm border ${(court.isOutdoor ?? court.isoutdoor ?? court.is_outdoor ?? true) ? 'bg-amber-500/90 border-amber-400' : 'bg-slate-600/90 border-slate-500'}`}>
                                                    {court.isOutdoor ? "All'aperto" : "Coperto"}
                                                </span>
                                                <span className={`backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold uppercase ml-2 text-white shadow-sm border ${(court.hasCamera ?? court.has_camera ?? court.hascamera ?? false) ? 'bg-amber-500/90 border-amber-400' : 'bg-slate-600/90 border-slate-500'}`}>
                                                    {court.hasCamera ? "📷 Con Telecamera" : "🏟️ Senza Telecamera"}
                                                </span>
                                                {court.price_p_p != null && (
                                                    <span className="bg-blue-600/90 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold uppercase ml-2 text-white shadow-sm border border-blue-400">
                                                        {court.price_p_p}€ / p
                                                    </span>
                                                )}
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
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1 ">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl shadow-inner">
                                <Clock size={20} />
                            </div>
                            <h3 className="font-bold text-slate-800 uppercase tracking-tighter">Orari d'apertura</h3>
                            <button onClick={() => setIsOrariOpen(true)} className="ml-auto text-sm text-slate-400 hover:text-orange-600 flex items-center gap-2 transition-colors">
                                <span className="hidden sm:inline">Modifica</span>
                                <Edit2 size={18} />
                            </button>
                            <ModalOrari
                                isOpen={isOrariOpen}
                                onClose={() => setIsOrariOpen(false)}
                                centerId={user.id}
                            />
                        </div>
                        <div className="space-y-2">
                            {orari.map(item => (
                                <div key={item.day_of_week} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 ">
                                    <span className="font-bold text-slate-700 w-24">{days[item.day_of_week]}</span>
                                    <span className="text-slate-600 ">{item.is_closed ? 'Chiuso' : `${item.open_time.slice(0, 5)} - ${item.close_time.slice(0, 5)}`}</span>
                                    <span className={`ml-auto px-2 py-1 rounded-lg text-[10px] font-black uppercase ${item.is_closed ? 'bg-red-100 text-red-600 ' : 'bg-green-100 text-green-600 '}`}>
                                        {item.is_closed ? 'Chiuso' : 'Aperto'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div> {/* CHIUDE COLONNA DESTRA */}
            </div> {/* CHIUDE GRID WRAPPER */}
        </div>
    );
}






