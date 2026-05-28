import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, warning } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Edit2, StepBack, SendToBack, LucideStepBack, Undo2 } from 'lucide-react';
import { GetSportStyle } from './BusinessUtils';
import { useAlert } from '../../components/AlertComponent';

export default function GestisciCampi({ centerId }) {
    const [courts, setCourts] = useState([]);
    const [newCourt, setNewCourt] = useState({ name: '', sport_type: 'Calcio a 5', price_p_p: '', isOutdoor: true });
    const [openAdd, setOpenAdd] = useState(false);
    const [editingCourtId, setEditingCourtId] = useState(null);
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

    async function saveCourt() {
        if (!newCourt.name) return;

        const updatePayload = {
            name: newCourt.name,
            sport_type: newCourt.sport_type,
            price_p_p: newCourt.price_p_p ? parseFloat(newCourt.price_p_p) : null,
            isOutdoor: newCourt.isOutdoor
        };

        const createPayload = {
            ...updatePayload,
            center_id: centerId,
        };

        if (editingCourtId) {
            const { error: err } = await supabase
                .from('sports_courts')
                .update(updatePayload)
                .eq('id', editingCourtId);

            if (!err) {
                setNewCourt({ name: '', sport_type: 'Calcio a 5', price_p_p: '', isOutdoor: true });
                setEditingCourtId(null);
                setOpenAdd(false);
                fetchCourts();
                success('Campo aggiornato!');
            } else {
                error('Errore durante l\'aggiornamento campo');
            }
        } else {
            const { error: err } = await supabase
                .from('sports_courts')
                .insert([createPayload]);

            if (!err) {
                setNewCourt({ name: '', sport_type: 'Calcio a 5', price_p_p: '', isOutdoor: true });
                setOpenAdd(false);
                fetchCourts();
                success('Campo creato!');
            } else {
                error('Errore durante la creazione campo');
            }
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

    const isOutdoorValue = (court) => court.isOutdoor ?? court.isoutdoor ?? court.is_outdoor ?? true;

    const courtForm = (
        <div className="space-y-3">
            <input
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Nome (es: Centrale, Campo 1...)"
                value={newCourt.name}
                onChange={e => setNewCourt({ ...newCourt, name: e.target.value })}
            />
            <div className="flex gap-3">
                <select
                    className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    value={newCourt.sport_type}
                    onChange={e => setNewCourt({ ...newCourt, sport_type: e.target.value })}
                >
                    <option value="Calcio a 5">Calcio a 5</option>
                    <option value="Padel">Padel</option>
                    <option value="Basket">Basket</option>
                    <option value="Tennis">Tennis</option>
                </select>
                <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="w-1/3 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="€ a persona"
                    value={newCourt.price_p_p}
                    onChange={e => setNewCourt({ ...newCourt, price_p_p: e.target.value })}
                />
            </div>
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700 w-1/2">
                    <input
                        type="radio"
                        name="courtFormIsOutdoor"
                        checked={newCourt.isOutdoor === true}
                        onChange={() => setNewCourt({ ...newCourt, isOutdoor: true })}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    ⛅ All'aperto
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700 w-1/2">
                    <input
                        type="radio"
                        name="courtFormIsOutdoor"
                        checked={newCourt.isOutdoor === false}
                        onChange={() => setNewCourt({ ...newCourt, isOutdoor: false })}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    🏟️ Coperto
                </label>
            </div>
            <button
                onClick={saveCourt}
                className={`w-full text-white font-bold p-3 rounded-xl transition-colors ${editingCourtId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {editingCourtId ? 'Aggiorna Campo' : 'Conferma e Crea'}
            </button>
            {editingCourtId && (
                <button
                    onClick={() => {
                        setEditingCourtId(null);
                        setNewCourt({ name: '', sport_type: 'Calcio a 5', price_p_p: '', isOutdoor: true });
                        setOpenAdd(false);
                    }}
                    className="w-full text-slate-500 font-bold p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
                >
                    Annulla modifica
                </button>
            )}
        </div>
    );

    return (
        <div className="p-4 lg:p-6 pb-24">

            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Gestione Campi</h2>
                    <p className="text-xs text-slate-500">{courts.length} strutture configurate</p>
                </div>
                {/* Mobile toggle — hidden on lg where form is always visible */}
                <button
                    onClick={() => {
                        if (openAdd) {
                            setOpenAdd(false);
                            setEditingCourtId(null);
                            setNewCourt({ name: '', sport_type: 'Calcio a 5', price_p_p: '', isOutdoor: true });
                        } else {
                            setOpenAdd(true);
                            setEditingCourtId(null);
                            setNewCourt({ name: '', sport_type: 'Calcio a 5', price_p_p: '', isOutdoor: true });
                        }
                    }}
                    className={`lg:hidden ${openAdd ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white p-3 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all`}
                >
                    {openAdd ? <Undo2 size={20} /> : <Plus size={20} />}
                </button>
            </div>

            {/* Desktop: 2-column layout. Mobile: stacked. */}
            <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">

                {/* ---- FORM PANEL ---- */}
                {/* Mobile: conditional. Desktop: always visible as sticky sidebar. */}
                <div className="lg:col-span-4">
                    {/* Mobile collapsible */}
                    {openAdd && (
                        <motion.div
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="lg:hidden bg-white p-5 rounded-2xl border-2 border-blue-100 shadow-xl mb-6"
                        >
                            <h3 className="font-black text-slate-800 mb-4 uppercase text-sm">
                                {editingCourtId ? 'Modifica Campo' : 'Configura Nuovo Campo'}
                            </h3>
                            {courtForm}
                        </motion.div>
                    )}

                    {/* Desktop always-on sticky panel */}
                    <div className="hidden lg:block bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-xl sticky top-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className={`p-2 rounded-lg ${editingCourtId ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                {editingCourtId ? <Edit2 size={18} /> : <Plus size={18} />}
                            </div>
                            <h3 className="font-black text-slate-800 uppercase text-sm">
                                {editingCourtId ? 'Modifica Campo' : 'Nuovo Campo'}
                            </h3>
                        </div>
                        {courtForm}
                    </div>
                </div>

                {/* ---- COURTS LIST ---- */}
                <div className="lg:col-span-8">
                    {courts.length === 0 ? (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 flex flex-col items-center text-center">
                            <p className="text-slate-400 font-bold text-sm">Nessun campo configurato</p>
                            <p className="text-slate-300 text-xs mt-1">Usa il form per aggiungere il primo campo</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {courts.map(court => {
                                const style = GetSportStyle(court.sport_type);
                                const outdoor = isOutdoorValue(court);
                                const isEditing = editingCourtId === court.id;
                                return (
                                    <div
                                        key={court.id}
                                        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isEditing ? 'border-amber-300 ring-2 ring-amber-200' : 'border-slate-200'}`}
                                    >
                                        {/* Coloured sport banner */}
                                        <div className={`h-3 w-full ${style.bg}`} style={{ backgroundImage: style.pattern, backgroundSize: '20px 20px' }} />

                                        <div className="p-4 flex items-start gap-3">
                                            {/* Sport icon block */}
                                            <div className={`w-12 h-12 ${style.bg} rounded-xl flex items-center justify-center text-white shadow-inner relative overflow-hidden flex-shrink-0`}>
                                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: style.pattern, backgroundSize: '8px 8px' }} />
                                                <span className="relative z-10 text-[9px] font-black uppercase rotate-[-15deg] leading-tight text-center">
                                                    {court.sport_type.split(' ')[0]}
                                                </span>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-slate-800 leading-tight truncate">{court.name}</h4>
                                                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{court.sport_type}</p>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${outdoor ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {outdoor ? "⛅ All'aperto" : "🏟️ Coperto"}
                                                    </span>
                                                    {court.price_p_p != null && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-blue-100 text-blue-700">
                                                            {court.price_p_p}€/p
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-1 flex-shrink-0 lg:flex-row lg:items-center">
                                                <button
                                                    onClick={() => {
                                                        setEditingCourtId(court.id);
                                                        setNewCourt({
                                                            name: court.name,
                                                            sport_type: court.sport_type,
                                                            price_p_p: court.price_p_p || '',
                                                            isOutdoor: isOutdoorValue(court)
                                                        });
                                                        setOpenAdd(true);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className={`p-2 lg:p-3 rounded-lg transition-colors ${isEditing ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                    title="Modifica"
                                                >
                                                    <Edit2 className="w-4 h-4 lg:w-[20px] lg:h-[20px]" />
                                                </button>
                                                <button
                                                    onClick={() => deleteCourt(court.id)}
                                                    className="p-2 lg:p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Elimina"
                                                >
                                                    <Trash2 className="w-4 h-4 lg:w-[20px] lg:h-[20px]" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}