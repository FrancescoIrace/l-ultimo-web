import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, Undo2, MapPin, Check, X } from 'lucide-react';
import { GetSportStyle } from '../pages/business/BusinessUtils';
import { useAlert } from './AlertComponent';
import LocationPicker from './LocationPicker';

const EMPTY_COURT = {
    name: '',
    sport_type: 'Calcio',
    is_outdoor: true,
    description: '',
    photo_url: '',
    location: '',
    location_lat: null,
    location_lng: null,
};

/**
 * CRUD admin per il catalogo "Campi pubblici" (parchi comunali, gratuiti,
 * senza gestore) - stesso pattern di GestisciCampi.jsx ma su public_courts:
 * niente prezzo/telecamera (non pertinenti), indirizzo scelto via
 * LocationPicker (autocomplete Google) invece di testo libero, cosi'
 * lat/lng si popolano da soli.
 */
export default function GestisciCampiPubblici() {
    const [courts, setCourts] = useState([]);
    const [newCourt, setNewCourt] = useState(EMPTY_COURT);
    const [openAdd, setOpenAdd] = useState(false);
    const [editingCourtId, setEditingCourtId] = useState(null);
    const [subTab, setSubTab] = useState('catalogo'); // 'catalogo' | 'segnalazioni'
    const { success, error, confirmDangerous } = useAlert();

    async function fetchCourts() {
        const { data } = await supabase
            .from('public_courts')
            .select('*, submitted_by(username, full_name)')
            .order('created_at', { ascending: false });
        setCourts(data || []);
    }

    useEffect(() => {
        fetchCourts();
    }, []);

    const pendingCourts = courts.filter((c) => c.status === 'pending');
    const approvedCourts = courts.filter((c) => c.status !== 'pending');

    async function approveCourt(id) {
        const { error: err } = await supabase
            .from('public_courts')
            .update({ status: 'approved' })
            .eq('id', id);
        if (!err) {
            fetchCourts();
            success('Campo approvato e pubblicato!');
        } else {
            error("Errore durante l'approvazione");
        }
    }

    async function rejectCourt(id) {
        confirmDangerous(
            'Rifiutare questa segnalazione? Verrà eliminata definitivamente.',
            async () => {
                const { error: err } = await supabase.from('public_courts').delete().eq('id', id);
                if (!err) {
                    fetchCourts();
                    success('Segnalazione rifiutata');
                } else {
                    error("Errore durante il rifiuto della segnalazione");
                }
            }
        );
    }

    function resetForm() {
        setNewCourt(EMPTY_COURT);
        setEditingCourtId(null);
        setOpenAdd(false);
    }

    async function saveCourt() {
        if (!newCourt.name) return;

        const payload = {
            name: newCourt.name,
            sport_type: newCourt.sport_type,
            address: newCourt.location || null,
            lat: newCourt.location_lat,
            lng: newCourt.location_lng,
            is_outdoor: newCourt.is_outdoor,
            description: newCourt.description || null,
            photo_url: newCourt.photo_url || null,
        };

        if (editingCourtId) {
            const { error: err } = await supabase
                .from('public_courts')
                .update(payload)
                .eq('id', editingCourtId);

            if (!err) {
                resetForm();
                fetchCourts();
                success('Campo pubblico aggiornato!');
            } else {
                error("Errore durante l'aggiornamento del campo pubblico");
            }
        } else {
            const { error: err } = await supabase
                .from('public_courts')
                .insert([{ ...payload, is_active: true, status: 'approved' }]);

            if (!err) {
                resetForm();
                fetchCourts();
                success('Campo pubblico creato!');
            } else {
                error('Errore durante la creazione del campo pubblico');
            }
        }
    }

    async function deleteCourt(id) {
        confirmDangerous(
            'Sei sicuro di voler eliminare questo campo pubblico?',
            async () => {
                const { error: err } = await supabase.from('public_courts').delete().eq('id', id);
                if (!err) {
                    fetchCourts();
                    success('Campo pubblico eliminato');
                } else {
                    error("Errore durante l'eliminazione");
                }
            }
        );
    }

    const courtForm = (
        <div className="space-y-3">
            <input
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Nome (es: Campetto Parco Sempione)"
                value={newCourt.name}
                onChange={(e) => setNewCourt({ ...newCourt, name: e.target.value })}
            />
            <select
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                value={newCourt.sport_type}
                onChange={(e) => setNewCourt({ ...newCourt, sport_type: e.target.value })}
            >
                <option value="Calcio">Calcio</option>
                <option value="Padel">Padel</option>
                <option value="Basket">Basket</option>
                <option value="Tennis">Tennis</option>
            </select>

            <LocationPicker
                value={{ location: newCourt.location, location_lat: newCourt.location_lat, location_lng: newCourt.location_lng }}
                onChange={(loc) => setNewCourt((prev) => ({ ...prev, ...loc }))}
            />

            <textarea
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                rows={2}
                placeholder="Descrizione (opzionale, es: campo in cemento, canestri senza rete)"
                value={newCourt.description}
                onChange={(e) => setNewCourt({ ...newCourt, description: e.target.value })}
            />
            <input
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="URL foto (opzionale)"
                value={newCourt.photo_url}
                onChange={(e) => setNewCourt({ ...newCourt, photo_url: e.target.value })}
            />

            <label className="flex items-center justify-between gap-2 cursor-pointer font-bold text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                <span className="flex items-center gap-2">⛅ All'aperto</span>
                <input
                    type="checkbox"
                    checked={newCourt.is_outdoor === true}
                    onChange={(e) => setNewCourt({ ...newCourt, is_outdoor: e.target.checked })}
                    className="w-5 h-5 accent-blue-600 rounded-lg cursor-pointer"
                />
            </label>

            <button
                onClick={saveCourt}
                className={`w-full text-white font-bold p-3 rounded-xl transition-colors ${editingCourtId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {editingCourtId ? 'Aggiorna Campo' : 'Conferma e Crea'}
            </button>
            {editingCourtId && (
                <button
                    onClick={resetForm}
                    className="w-full text-slate-500 font-bold p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
                >
                    Annulla modifica
                </button>
            )}
        </div>
    );

    return (
        <div className="p-4 lg:p-6 pb-24">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Campi Pubblici</h2>
                    <p className="text-xs text-slate-500">{approvedCourts.length} campi nel catalogo</p>
                </div>
                {subTab === 'catalogo' && (
                    <button
                        onClick={() => (openAdd ? resetForm() : setOpenAdd(true))}
                        className={`lg:hidden ${openAdd ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white p-3 rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all`}
                    >
                        {openAdd ? <Undo2 size={20} /> : <Plus size={20} />}
                    </button>
                )}
            </div>

            {/* Sub-tab: catalogo pubblicato vs coda di moderazione */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
                <button
                    type="button"
                    onClick={() => setSubTab('catalogo')}
                    className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${subTab === 'catalogo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Catalogo
                </button>
                <button
                    type="button"
                    onClick={() => setSubTab('segnalazioni')}
                    className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${subTab === 'segnalazioni' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Segnalazioni{pendingCourts.length > 0 ? ` (${pendingCourts.length})` : ''}
                </button>
            </div>

            {subTab === 'catalogo' && (
            <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
                <div className="lg:col-span-4">
                    {openAdd && (
                        <motion.div
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="lg:hidden bg-white p-5 rounded-2xl border-2 border-blue-100 shadow-xl mb-6"
                        >
                            <h3 className="font-black text-slate-800 mb-4 uppercase text-sm">
                                {editingCourtId ? 'Modifica Campo Pubblico' : 'Nuovo Campo Pubblico'}
                            </h3>
                            {courtForm}
                        </motion.div>
                    )}

                    <div className="hidden lg:block bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-xl sticky top-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className={`p-2 rounded-lg ${editingCourtId ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                {editingCourtId ? <Edit2 size={18} /> : <Plus size={18} />}
                            </div>
                            <h3 className="font-black text-slate-800 uppercase text-sm">
                                {editingCourtId ? 'Modifica Campo Pubblico' : 'Nuovo Campo Pubblico'}
                            </h3>
                        </div>
                        {courtForm}
                    </div>
                </div>

                <div className="lg:col-span-8">
                    {approvedCourts.length === 0 ? (
                        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 flex flex-col items-center text-center">
                            <p className="text-slate-400 font-bold text-sm">Nessun campo pubblico configurato</p>
                            <p className="text-slate-300 text-xs mt-1">Usa il form per aggiungere il primo campo</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {approvedCourts.map((court) => {
                                const style = GetSportStyle(court.sport_type);
                                const isEditing = editingCourtId === court.id;
                                return (
                                    <div
                                        key={court.id}
                                        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isEditing ? 'border-amber-300 ring-2 ring-amber-200' : 'border-slate-200'}`}
                                    >
                                        <div className={`h-3 w-full ${style.bg}`} style={{ backgroundImage: style.pattern, backgroundSize: '20px 20px' }} />

                                        <div className="p-4 flex items-start gap-3">
                                            <div className={`w-12 h-12 ${style.bg} rounded-xl flex items-center justify-center text-white shadow-inner relative overflow-hidden flex-shrink-0`}>
                                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: style.pattern, backgroundSize: '8px 8px' }} />
                                                <span className="relative z-10 text-[9px] font-black uppercase rotate-[-15deg] leading-tight text-center">
                                                    {court.sport_type.split(' ')[0]}
                                                </span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-slate-800 leading-tight truncate">{court.name}</h4>
                                                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{court.sport_type}</p>
                                                {court.address && (
                                                    <div className="flex items-center gap-1 text-slate-500 mt-1.5">
                                                        <MapPin size={11} className="flex-shrink-0" />
                                                        <p className="text-[11px] truncate">{court.address}</p>
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${court.is_outdoor ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {court.is_outdoor ? "⛅ All'aperto" : '🏟️ Coperto'}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-green-100 text-green-700">
                                                        Gratuito
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1 flex-shrink-0 lg:flex-row lg:items-center">
                                                <button
                                                    onClick={() => {
                                                        setEditingCourtId(court.id);
                                                        setNewCourt({
                                                            name: court.name,
                                                            sport_type: court.sport_type,
                                                            is_outdoor: court.is_outdoor,
                                                            description: court.description || '',
                                                            photo_url: court.photo_url || '',
                                                            location: court.address || '',
                                                            location_lat: court.lat,
                                                            location_lng: court.lng,
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
            )}

            {subTab === 'segnalazioni' && (
                pendingCourts.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 flex flex-col items-center text-center">
                        <p className="text-slate-400 font-bold text-sm">Nessuna segnalazione da approvare</p>
                        <p className="text-slate-300 text-xs mt-1">Le segnalazioni degli utenti compariranno qui</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {pendingCourts.map((court) => {
                            const style = GetSportStyle(court.sport_type);
                            const reporterName = court.submitted_by?.username || court.submitted_by?.full_name;
                            return (
                                <div key={court.id} className="bg-amber-50 rounded-2xl border-2 border-amber-200 overflow-hidden">
                                    <div className={`h-3 w-full ${style.bg}`} style={{ backgroundImage: style.pattern, backgroundSize: '20px 20px' }} />
                                    <div className="p-4">
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className={`w-12 h-12 ${style.bg} rounded-xl flex items-center justify-center text-white shadow-inner relative overflow-hidden flex-shrink-0`}>
                                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: style.pattern, backgroundSize: '8px 8px' }} />
                                                <span className="relative z-10 text-[9px] font-black uppercase rotate-[-15deg] leading-tight text-center">
                                                    {court.sport_type.split(' ')[0]}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-slate-800 leading-tight truncate">{court.name}</h4>
                                                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{court.sport_type}</p>
                                                {court.address && (
                                                    <div className="flex items-center gap-1 text-slate-500 mt-1.5">
                                                        <MapPin size={11} className="flex-shrink-0" />
                                                        <p className="text-[11px] truncate">{court.address}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {court.description && (
                                            <p className="text-xs text-slate-500 italic mb-3">"{court.description}"</p>
                                        )}
                                        {reporterName && (
                                            <p className="text-[11px] text-slate-400 mb-3">Segnalato da <span className="font-bold text-slate-600">{reporterName}</span></p>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => approveCourt(court.id)}
                                                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl py-2 transition-colors"
                                            >
                                                <Check size={15} />
                                                Approva
                                            </button>
                                            <button
                                                onClick={() => rejectCourt(court.id)}
                                                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-xl py-2 transition-colors"
                                            >
                                                <X size={15} />
                                                Rifiuta
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}
