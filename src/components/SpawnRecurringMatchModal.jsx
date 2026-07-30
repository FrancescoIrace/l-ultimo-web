import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Rocket } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAlert } from './AlertComponent';
import { getMinDatetimeLocal, formatDatetimeForTimestamp } from '../lib/datetime';

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Prossima occorrenza del giorno/ora di default del template (JS getDay 0-6).
// Se è oggi ma l'ora è già passata, va alla settimana successiva.
function nextOccurrence(weekday, timeStr) {
    const now = new Date();
    const [hh, mm] = (timeStr || '21:00').split(':').map((x) => parseInt(x, 10));
    const d = new Date(now);
    d.setHours(hh || 21, mm || 0, 0, 0);
    if (weekday == null) {
        if (d <= now) d.setDate(d.getDate() + 1);
        return d;
    }
    let diff = (weekday - d.getDay() + 7) % 7;
    if (diff === 0 && d <= now) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
}

/**
 * Modale "Programma la prossima": dato un template ricorrente, chiede solo
 * data+ora (pre-compilate alla prossima occorrenza) e genera la partita vera
 * con un insert diretto in matches, rispecchiando il flusso di CreateMatch.
 */
export default function SpawnRecurringMatchModal({ isOpen, onClose, template }) {
    const navigate = useNavigate();
    const { error } = useAlert();
    const [datetime, setDatetime] = useState('');
    const [spawning, setSpawning] = useState(false);

    useEffect(() => {
        if (isOpen && template) {
            setDatetime(toLocalInput(nextOccurrence(template.default_weekday, template.default_time)));
        }
    }, [isOpen, template]);

    if (!isOpen || !template) return null;

    async function handleSpawn() {
        if (!datetime) { error('Scegli data e ora.'); return; }
        if (spawning) return;
        setSpawning(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('not-auth');

            // Limite 5 partite attive per organizzatore (come CreateMatch).
            const now = new Date().toISOString();
            const { data: active } = await supabase
                .from('matches')
                .select('id')
                .eq('creator_id', user.id)
                .gt('datetime', now);
            if (active && active.length >= 5) {
                error(`Hai già ${active.length} partite attive: chiudine una prima di crearne un'altra.`);
                setSpawning(false);
                return;
            }

            const { data: match, error: insErr } = await supabase
                .from('matches')
                .insert([{
                    title: template.title || template.name || template.sport,
                    sport: template.sport,
                    datetime: formatDatetimeForTimestamp(datetime),
                    location: template.location,
                    location_lat: template.location_lat,
                    location_lng: template.location_lng,
                    max_players: template.max_players,
                    description: template.description,
                    court_id: template.court_id || null,
                    creator_id: user.id,
                    team_id: template.team_id,
                    reservation_status: template.court_id ? 'draft' : 'none',
                    current_players: 1,
                }])
                .select()
                .single();
            if (insErr) throw insErr;

            await supabase.from('participants').insert([{
                match_id: match.id,
                user_id: user.id,
                status: 'confirmed',
            }]);

            onClose();
            navigate(`/match/${match.id}`);
        } catch (e) {
            console.error('Spawn partita ricorrente:', e);
            error('Non è stato possibile creare la partita. Riprova.');
            setSpawning(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full mx-auto relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200">
                    <X size={18} />
                </button>
                <div className="w-11 h-11 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                    <Rocket size={22} />
                </div>
                <h3 className="text-lg font-black text-slate-800 leading-tight">{template.name || template.sport}</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Scegli quando giocare: il resto è già pronto.</p>

                <label className="text-xs font-black uppercase text-slate-400 ml-1 mb-1.5 block">Giorno e ora</label>
                <input
                    type="datetime-local"
                    step="1800"
                    min={getMinDatetimeLocal()}
                    className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold mb-4"
                    value={datetime}
                    onChange={(e) => setDatetime(e.target.value)}
                />

                <button
                    onClick={handleSpawn}
                    disabled={spawning}
                    className="w-full p-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-60 uppercase text-sm tracking-wide flex items-center justify-center gap-2"
                >
                    {spawning ? 'Creazione...' : <><Rocket size={18} /> Crea la partita</>}
                </button>
            </div>
        </div>
    );
}
