import { useState, useEffect } from 'react';
import { X, Building2, Trees, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAlert } from './AlertComponent';
import LocationPicker from './LocationPicker';
import CenterCourtPicker from './CenterCourtPicker';
import PublicCourtPicker from './PublicCourtPicker';
import { MATCH_SPORTS, defaultPlayersForSport, isFixedPlayersSport, WEEKDAYS } from '../lib/matchSports';

const EMPTY = {
    name: '',
    sport: 'Calcetto',
    max_players: 10,
    location: '',
    location_lat: null,
    location_lng: null,
    court_id: null,
    description: '',
    default_weekday: 2, // Martedì
    default_time: '21:00',
};

/**
 * Form (modale) per creare/modificare un template di partita ricorrente di una
 * squadra. Riusa gli stessi selettori luogo/campo di CreateMatch. Salva in
 * match_templates; la partita vera si genera poi da SpawnRecurringMatchModal.
 */
export default function RecurringMatchForm({ isOpen, onClose, teamId, existing, onSaved }) {
    const { success, error } = useAlert();
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [centers, setCenters] = useState([]);
    const [userId, setUserId] = useState(null);
    const [courtLabel, setCourtLabel] = useState(''); // etichetta campo scelto (centro o pubblico)
    const [centerPickerOpen, setCenterPickerOpen] = useState(false);
    const [publicPickerOpen, setPublicPickerOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setForm(existing ? {
            name: existing.name || '',
            sport: existing.sport || 'Calcetto',
            max_players: existing.max_players ?? 10,
            location: existing.location || '',
            location_lat: existing.location_lat ?? null,
            location_lng: existing.location_lng ?? null,
            court_id: existing.court_id ?? null,
            description: existing.description || '',
            default_weekday: existing.default_weekday ?? 2,
            default_time: existing.default_time || '21:00',
        } : EMPTY);
        setCourtLabel(existing?.court_id ? (existing.location || 'Campo selezionato') : '');

        supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
        supabase.from('profiles')
            .select('id, username, full_name, business_address, lat, lng')
            .eq('role', 'center').eq('is_visible', true)
            .then(({ data }) => setCenters(data || []));
    }, [isOpen, existing]);

    if (!isOpen) return null;

    const handleSport = (sport) => {
        const def = defaultPlayersForSport(sport);
        setForm((p) => ({ ...p, sport, max_players: def ?? p.max_players }));
    };

    // Campo di un centro affiliato: valorizza court_id + luogo dal centro.
    const handleCenterSelect = (center, court) => {
        setForm((p) => ({
            ...p,
            court_id: court.id,
            location: center.business_address || p.location,
            location_lat: center.lat != null ? parseFloat(center.lat) : p.location_lat,
            location_lng: center.lng != null ? parseFloat(center.lng) : p.location_lng,
        }));
        setCourtLabel(`${center.full_name || center.username || 'Centro'} — ${court.name}`);
        setCenterPickerOpen(false);
    };

    // Campo pubblico: solo luogo (non è un court affiliato → court_id resta null).
    const handlePublicSelect = (court) => {
        setForm((p) => ({
            ...p,
            court_id: null,
            location: court.address ? `${court.name} — ${court.address}` : court.name,
            location_lat: court.lat ?? p.location_lat,
            location_lng: court.lng ?? p.location_lng,
        }));
        setCourtLabel(`${court.name} (campo pubblico)`);
        setPublicPickerOpen(false);
    };

    async function handleSave() {
        if (!form.name.trim()) { error('Dai un nome alla partita ricorrente (es. "Calcetto del martedì").'); return; }
        if (saving) return;
        setSaving(true);

        const payload = {
            team_id: teamId,
            created_by: userId,
            name: form.name.trim(),
            sport: form.sport,
            title: form.name.trim(),
            location: form.location || null,
            location_lat: form.location_lat,
            location_lng: form.location_lng,
            max_players: parseInt(form.max_players) || 2,
            description: form.description?.trim() || null,
            court_id: form.court_id || null,
            default_weekday: form.default_weekday,
            default_time: form.default_time || null,
        };

        const query = existing
            ? supabase.from('match_templates').update(payload).eq('id', existing.id)
            : supabase.from('match_templates').insert([payload]);

        const { error: err } = await query;
        setSaving(false);

        if (err) {
            error('Non è stato possibile salvare. Riprova.');
            return;
        }
        success(existing ? 'Partita ricorrente aggiornata!' : 'Partita ricorrente creata!');
        onSaved?.();
        onClose();
    }

    const fixed = isFixedPlayersSport(form.sport);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full mx-auto relative flex flex-col max-h-[88vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                        {existing ? 'Modifica ricorrente' : 'Nuova partita ricorrente'}
                    </h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 flex-shrink-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-3">
                    <div>
                        <label className="text-xs font-black uppercase text-slate-400 ml-1 mb-1.5 block">Nome</label>
                        <input
                            className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                            placeholder='es. "Calcetto del martedì"'
                            maxLength={40}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-black uppercase text-slate-400 ml-1 mb-1.5 block">Sport</label>
                            <select
                                className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                value={form.sport}
                                onChange={(e) => handleSport(e.target.value)}
                            >
                                {MATCH_SPORTS.map((s) => <option key={s.value} value={s.value}>{s.value}</option>)}
                            </select>
                        </div>
                        <div className="w-28">
                            <label className="text-xs font-black uppercase text-slate-400 ml-1 mb-1.5 block">Giocatori</label>
                            <input
                                type="number"
                                min="2"
                                disabled={fixed}
                                className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold disabled:opacity-60"
                                value={form.max_players}
                                onChange={(e) => setForm({ ...form, max_players: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Giorno + ora di default (pre-compilano lo spawn) */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-black uppercase text-slate-400 ml-1 mb-1.5 block">Di solito il</label>
                            <select
                                className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                value={form.default_weekday}
                                onChange={(e) => setForm({ ...form, default_weekday: parseInt(e.target.value) })}
                            >
                                {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="text-xs font-black uppercase text-slate-400 ml-1 mb-1.5 block">Alle</label>
                            <input
                                type="time"
                                className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                value={form.default_time}
                                onChange={(e) => setForm({ ...form, default_time: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Campo: centro affiliato o campo pubblico (opzionali) */}
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setCenterPickerOpen(true)}
                            className="flex-1 p-3 bg-slate-50 rounded-2xl text-left text-sm flex items-center gap-2 hover:bg-slate-100 transition-colors">
                            <Building2 size={16} className="text-slate-400 flex-shrink-0" />
                            <span className="truncate font-bold text-slate-700">Centro affiliato</span>
                            <ChevronRight size={16} className="text-slate-400 ml-auto flex-shrink-0" />
                        </button>
                        <button type="button" onClick={() => setPublicPickerOpen(true)}
                            className="flex-1 p-3 bg-slate-50 rounded-2xl text-left text-sm flex items-center gap-2 hover:bg-slate-100 transition-colors">
                            <Trees size={16} className="text-slate-400 flex-shrink-0" />
                            <span className="truncate font-bold text-slate-700">Campo pubblico</span>
                            <ChevronRight size={16} className="text-slate-400 ml-auto flex-shrink-0" />
                        </button>
                    </div>
                    {courtLabel && (
                        <p className="text-xs font-bold text-blue-600 ml-1">📍 {courtLabel}</p>
                    )}

                    <div>
                        <label className="text-xs font-black uppercase text-slate-400 ml-1 mb-1.5 block">Luogo</label>
                        <LocationPicker
                            value={{ location: form.location, location_lat: form.location_lat, location_lng: form.location_lng }}
                            onChange={(loc) => { setForm((p) => ({ ...p, ...loc })); if (!form.court_id) setCourtLabel(''); }}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-black uppercase text-slate-400 ml-1 mb-1.5 block">Descrizione</label>
                        <textarea
                            rows={2}
                            maxLength={300}
                            className="w-full p-3.5 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold resize-none"
                            placeholder="Note fisse per la squadra (opzionale)"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full p-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-60 uppercase text-sm tracking-wide"
                    >
                        {saving ? 'Salvataggio...' : existing ? 'Salva modifiche' : 'Crea ricorrente'}
                    </button>
                </div>

                <CenterCourtPicker
                    isOpen={centerPickerOpen}
                    onClose={() => setCenterPickerOpen(false)}
                    sport={form.sport}
                    centers={centers}
                    userId={userId}
                    initialCenterId={null}
                    onSelect={handleCenterSelect}
                />
                <PublicCourtPicker
                    isOpen={publicPickerOpen}
                    onClose={() => setPublicPickerOpen(false)}
                    userId={userId}
                    onSelect={handlePublicSelect}
                />
            </div>
        </div>
    );
}
