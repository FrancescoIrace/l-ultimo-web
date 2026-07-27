import { useState } from 'react';
import { X, Trees } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAlert } from './AlertComponent';
import LocationPicker from './LocationPicker';

const EMPTY_REPORT = {
    name: '',
    sport_type: 'Calcio',
    is_outdoor: true,
    description: '',
    location: '',
    location_lat: null,
    location_lng: null,
};

/**
 * Form con cui un utente segnala un campo pubblico non ancora in catalogo.
 * Inserisce una riga in public_courts con status='pending' - resta
 * invisibile a tutti (RLS select filtra su status='approved') finche' un
 * admin non la approva dal pannello (vedi GestisciCampiPubblici.jsx).
 */
export default function ReportPublicCourtModal({ isOpen, onClose, onSubmitted }) {
    const [report, setReport] = useState(EMPTY_REPORT);
    const [submitting, setSubmitting] = useState(false);
    const { success, error } = useAlert();

    if (!isOpen) return null;

    async function handleSubmit() {
        if (!report.name || submitting) return;
        setSubmitting(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            error('Devi essere loggato per segnalare un campo.');
            setSubmitting(false);
            return;
        }

        const { error: err } = await supabase.from('public_courts').insert([{
            name: report.name,
            sport_type: report.sport_type,
            address: report.location || null,
            lat: report.location_lat,
            lng: report.location_lng,
            is_outdoor: report.is_outdoor,
            description: report.description || null,
            status: 'pending',
            is_active: true,
            submitted_by: user.id,
        }]);

        setSubmitting(false);

        if (!err) {
            setReport(EMPTY_REPORT);
            success('Grazie! Un admin verificherà la segnalazione a breve.');
            onSubmitted?.();
            onClose();
        } else {
            error('Errore durante l\'invio della segnalazione');
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full mx-auto relative flex flex-col max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                        <Trees size={20} className="text-green-600" />
                        Segnala un campo
                    </h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 flex-shrink-0">
                        <X size={20} />
                    </button>
                </div>
                <p className="text-sm text-slate-400 font-semibold mb-4 flex-shrink-0">
                    Conosci un campetto gratuito in un parco che non c'è ancora? Segnalacelo, un admin lo verificherà prima di pubblicarlo.
                </p>

                <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-3">
                    <input
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Nome (es: Campetto Parco Sempione)"
                        value={report.name}
                        onChange={(e) => setReport({ ...report, name: e.target.value })}
                    />
                    <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        value={report.sport_type}
                        onChange={(e) => setReport({ ...report, sport_type: e.target.value })}
                    >
                        <option value="Calcio">Calcio</option>
                        <option value="Padel">Padel</option>
                        <option value="Basket">Basket</option>
                        <option value="Tennis">Tennis</option>
                    </select>

                    <LocationPicker
                        value={{ location: report.location, location_lat: report.location_lat, location_lng: report.location_lng }}
                        onChange={(loc) => setReport((prev) => ({ ...prev, ...loc }))}
                    />

                    <textarea
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                        rows={2}
                        placeholder="Descrizione (opzionale, es: campo in cemento, canestri senza rete)"
                        value={report.description}
                        onChange={(e) => setReport({ ...report, description: e.target.value })}
                    />

                    <label className="flex items-center justify-between gap-2 cursor-pointer font-bold text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                        <span className="flex items-center gap-2">⛅ All'aperto</span>
                        <input
                            type="checkbox"
                            checked={report.is_outdoor === true}
                            onChange={(e) => setReport({ ...report, is_outdoor: e.target.checked })}
                            className="w-5 h-5 accent-blue-600 rounded-lg cursor-pointer"
                        />
                    </label>

                    <button
                        onClick={handleSubmit}
                        disabled={!report.name || submitting}
                        className="w-full text-white font-bold p-3 rounded-xl transition-colors bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Invio in corso...' : 'Invia segnalazione'}
                    </button>
                </div>
            </div>
        </div>
    );
}
