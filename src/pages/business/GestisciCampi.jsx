import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, warning } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Edit2, StepBack, SendToBack, LucideStepBack, Undo2 } from 'lucide-react';
import { GetSportStyle } from './BusinessUtils';
import { useAlert } from '../../components/AlertComponent';

export default function GestisciCampi({ centerId }) {
    const [courts, setCourts] = useState([]);
    const [newCourt, setNewCourt] = useState({ name: '', sport_type: 'Calcio a 5' });
    const [openAdd, setOpenAdd] = useState(false);
    const { alert, success, error, confirm, confirmDangerous } = useAlert();
    const navigate = useNavigate();


    // Caricamento campi
    useEffect(() => {
        fetchCourts();
    }, [centerId]);

    async function fetchCourts() {
        const { data } = await supabase
            .from('sports_courts')
            .select('*')
            .eq('center_id', centerId);
        setCourts(data || []);
    }

    async function addCourt() {
        if (!newCourt.name) return;
        const { error } = await supabase
            .from('sports_courts')
            .insert([{ ...newCourt, center_id: centerId }]);

        if (!error) {
            setNewCourt({ name: '', sport_type: 'Calcio a 5' });
            fetchCourts();
        }
    }

    async function deleteCourt(id) {
        confirmDangerous(
            'Sei sicuro di voler eliminare questo campo? Tutte le prenotazioni associate potrebbero essere influenzate.',
            async () => {
                const { error: err } = await supabase
                    .from('sports_courts')
                    .delete()
                    .eq('id', id);

                if (!err) {
                    fetchCourts();
                    success('Campo eliminato con successo!'); // Messaggio corretto
                } else {
                    error('Errore durante l\'eliminazione');
                    console.error('Errore eliminazione campo:', err);
                }
            }
            // Nota: Il terzo parametro di confirmDangerous solitamente è la callback di annullamento
            // Se passi error('...') direttamente, verrà eseguito immediatamente. 
            // Meglio passare una funzione anonima o nulla.
        );
    }

    return (
        <div className="p-4 space-y-6 pb-24">
            {/* Header con Azione */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">I tuoi Campi</h2>
                    <p className="text-xs text-slate-500">{courts.length} strutture configurate</p>
                </div>
                <button
                    onClick={() => setOpenAdd(!openAdd)}
                    className={`${openAdd ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white p-3 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all`}
                >
                    {openAdd ? <Undo2 size={20} /> : <Plus size={20} />}
                </button>
            </div>

            {/* Form Aggiunta Compatto (Condizionale) */}
            {openAdd && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-5 rounded-2xl border-2 border-blue-100 shadow-xl"
                >
                    <h3 className="font-black text-slate-800 mb-4 uppercase text-sm">Configura Nuovo Campo</h3>
                    <div className="space-y-3">
                        <input
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Nome (es: Centrale, Campo 1...)"
                            value={newCourt.name}
                            onChange={e => setNewCourt({ ...newCourt, name: e.target.value })}
                        />
                        <select
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            value={newCourt.sport_type}
                            onChange={e => setNewCourt({ ...newCourt, sport_type: e.target.value })}
                        >
                            <option value="Calcio a 5">Calcio a 5</option>
                            <option value="Padel">Padel</option>
                            <option value="Basket">Basket</option>
                            <option value="Tennis">Tennis</option>
                        </select>
                        <button
                            onClick={addCourt}
                            className="w-full bg-blue-600 text-white font-bold p-3 rounded-xl hover:bg-blue-700 transition-colors"
                        >
                            Conferma e Crea
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Lista Campi Gestionale */}
            <div className="space-y-3">
                {courts.map(court => {
                    const style = GetSportStyle(court.sport_type);
                    return (
                        <div key={court.id} className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                            {/* Anteprima Colore/Sport */}
                            <div className={`w-14 h-14 ${style.bg} rounded-xl flex items-center justify-center text-white shadow-inner relative overflow-hidden`}>
                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: style.pattern, backgroundSize: '10px 10px' }}></div>
                                <span className="relative z-10 text-[10px] font-black uppercase rotate-[-20deg] leading-tight text-center">
                                    {court.sport_type.split(' ')[0]}
                                </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-800 leading-tight">{court.name}</h4>
                                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{court.sport_type}</p>
                            </div>

                            {/* Azioni */}
                            <div className="flex gap-1">
                                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Edit2 size={18} />
                                </button>
                                <button
                                    onClick={() => deleteCourt(court.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}