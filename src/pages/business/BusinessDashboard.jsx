import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Zap, MapPin, UserPlus, User, LogOut, Puzzle, Trophy, Calendar, Info, ArrowRight, ArrowLeft, LayoutDashboard, Clock, Pencil, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { GetSportStyle } from './BusinessUtils';
import ModalOrari from '../../components/ModalOrari';


export default function BusinessDashboard({ user, name }) {
    const navigate = useNavigate();
    const [campi, setCampi] = useState([]);
    const [orari, setOrari] = useState([]);
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const [isOrariOpen, setIsOrariOpen] = useState(false);

    async function fetchHours() {
        const { data } = await supabase.from('business_hours').select('*').eq('center_id', user.id).order('day_of_week');
        // Se la tabella è vuota, inizializziamo dei valori di default
        if (data?.length === 0) {
            setOrari(days.map((_, i) => ({ day_of_week: i, open_time: '09:00', close_time: '22:00', is_closed: false })));
        } else {
            setOrari(data);
        }
    }

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

            {/* PANNELLO CALENDARIO - Il più importante */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Calendar size={20} />
                    </div>
                    <h3 className="font-bold text-slate-800">Calendario Prenotazioni</h3>
                </div>
                {/* Qui andrà un mini-calendario o la lista del giorno */}
                <p className="text-sm text-slate-500">3 partite in programma per oggi.</p>
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






