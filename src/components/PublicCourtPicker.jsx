import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateDistanceKm } from '../lib/geo';
import { GetSportStyle } from '../pages/business/BusinessUtils';
import Loader from './Loader';

/**
 * Modale per scegliere un campo pubblico (parco comunale, gratuito, senza
 * gestore) da usare come luogo di una partita - un solo step (a differenza
 * di CenterCourtPicker.jsx) perche' una riga di public_courts E' gia' il
 * campo, non serve scegliere prima una struttura e poi il campo al suo
 * interno.
 */
export default function PublicCourtPicker({ isOpen, onClose, userId, onSelect }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [courts, setCourts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [position, setPosition] = useState(null);
    const positionRef = useRef(null);
    const geoAttemptedRef = useRef(false);

    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) { setSearchTerm(''); return; }
        if (loaded) return;

        async function fetchCourts() {
            setLoading(true);
            const { data, error } = await supabase
                .from('public_courts')
                .select('id, name, sport_type, address, lat, lng, description')
                .eq('is_active', true)
                .eq('status', 'approved');
            if (!error) setCourts(data || []);
            setLoading(false);
            setLoaded(true);
        }
        fetchCourts();
    }, [isOpen, loaded]);

    useEffect(() => {
        if (!isOpen || positionRef.current || geoAttemptedRef.current) return;
        geoAttemptedRef.current = true;

        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                positionRef.current = coords;
                setPosition(coords);
            },
            async () => {
                if (!userId) return;
                const { data } = await supabase
                    .from('profiles')
                    .select('location_lat, location_lng')
                    .eq('id', userId)
                    .single();
                if (data?.location_lat && data?.location_lng) {
                    const coords = { lat: parseFloat(data.location_lat), lng: parseFloat(data.location_lng) };
                    positionRef.current = coords;
                    setPosition(coords);
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [isOpen, userId]);

    const filteredCourts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let list = courts.map((court) => {
            const hasCoords = court.lat != null && court.lng != null;
            const distance = (position && hasCoords)
                ? calculateDistanceKm(position.lat, position.lng, court.lat, court.lng)
                : null;
            return { ...court, distance };
        });
        if (term) {
            list = list.filter((c) =>
                (c.name || '').toLowerCase().includes(term) ||
                (c.address || '').toLowerCase().includes(term)
            );
        }
        return list.sort((a, b) => {
            if (a.distance == null && b.distance == null) return 0;
            if (a.distance == null) return 1;
            if (b.distance == null) return -1;
            return a.distance - b.distance;
        });
    }, [courts, searchTerm, position]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full mx-auto relative flex flex-col max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Scegli un campo pubblico</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 flex-shrink-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm mb-4 flex-shrink-0">
                    <Search size={18} className="text-slate-400 flex-shrink-0" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cerca un campo o un parco..."
                        className="w-full bg-transparent outline-none text-sm text-slate-700"
                    />
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                    {loading ? (
                        <Loader variant="section" label="Caricamento campi..." />
                    ) : courts.length === 0 ? (
                        <div className="text-center p-8 text-sm font-bold text-slate-400">Nessun campo pubblico disponibile.</div>
                    ) : filteredCourts.length === 0 ? (
                        <div className="text-center p-8 text-sm font-bold text-slate-400">Nessun campo trovato.</div>
                    ) : (
                        <div className="space-y-2">
                            {filteredCourts.map((court) => {
                                const style = GetSportStyle(court.sport_type);
                                return (
                                    <div
                                        key={court.id}
                                        onClick={() => onSelect(court)}
                                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex gap-4 items-center hover:bg-slate-50"
                                    >
                                        <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0 relative overflow-hidden`}>
                                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: style.pattern, backgroundSize: '8px 8px' }} />
                                            <span className="relative z-10 text-white text-[8px] font-black uppercase text-center leading-tight px-0.5">
                                                {court.sport_type}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{court.name}</h4>
                                            {court.address && (
                                                <div className="flex items-center gap-1 text-slate-500 mt-1">
                                                    <MapPin size={12} className="flex-shrink-0" />
                                                    <p className="text-xs truncate">{court.address}</p>
                                                </div>
                                            )}
                                        </div>
                                        {court.distance != null && (
                                            <span className="text-[10px] font-black uppercase bg-green-50 text-green-600 px-2 py-1 rounded-full flex-shrink-0">
                                                {court.distance.toFixed(1)} km
                                            </span>
                                        )}
                                        <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
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
