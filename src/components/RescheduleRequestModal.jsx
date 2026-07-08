import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { roundToHalfHour, getMinDatetimeLocal, formatDatetimeForTimestamp } from '../lib/datetime';
import { notifyRescheduleRequest } from '../lib/notificationService';
import { useAlert } from './AlertComponent';

/**
 * Modale lato organizzatore per richiedere al centro un cambio orario su
 * una partita già confermata. Inserisce una riga in match_reschedule_requests
 * (il centro accetta/rifiuta dalla propria dashboard) e notifica il centro.
 */
export default function RescheduleRequestModal({
    isOpen,
    onClose,
    matchId,
    matchTitle,
    currentDatetime,
    organizerId,
    organizerName,
    centerId,
    onRequested,
}) {
    const [newDatetime, setNewDatetime] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { success, error: showError } = useAlert();

    if (!isOpen) return null;

    async function handleSubmit() {
        if (!newDatetime) {
            showError('Scegli il nuovo orario proposto');
            return;
        }

        setSubmitting(true);
        const { error } = await supabase
            .from('match_reschedule_requests')
            .insert({
                match_id: matchId,
                requested_by: organizerId,
                center_id: centerId,
                // match.datetime arriva già nel formato timestamp Postgres (spazio, non "T"):
                // va passato così com'è, solo il nuovo orario scelto nell'input va convertito.
                current_datetime: currentDatetime,
                proposed_datetime: formatDatetimeForTimestamp(newDatetime),
                reason: reason.trim() || null,
            });
        setSubmitting(false);

        if (error) {
            console.error('Errore invio richiesta modifica orario:', error.message);
            showError('Impossibile inviare la richiesta. Riprova tra poco.');
            return;
        }

        const label = new Date(newDatetime).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        notifyRescheduleRequest(centerId, organizerId, matchId, matchTitle, organizerName || 'Un organizzatore', label);

        success('Richiesta inviata al centro!');
        setNewDatetime('');
        setReason('');
        onRequested?.();
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full mx-auto relative" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Clock size={20} className="text-amber-600" /> Richiedi modifica orario
                    </h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200">
                        <X size={18} />
                    </button>
                </div>

                <p className="text-sm text-slate-500 mb-4">
                    Proponi un nuovo orario al centro sportivo. La partita resta confermata fino a quando non risponde.
                </p>

                <div className="space-y-3">
                    <input
                        type="datetime-local"
                        lang="it-IT"
                        min={getMinDatetimeLocal()}
                        step="1800"
                        value={newDatetime}
                        onChange={(e) => setNewDatetime(roundToHalfHour(e.target.value))}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Motivo (opzionale)..."
                        rows={3}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full mt-5 py-3 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                    {submitting ? 'Invio...' : 'Invia richiesta al centro'}
                </button>
            </div>
        </div>
    );
}
