import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, Building2, ChevronRight, ChevronLeft, Sun, Video, VideoOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateDistanceKm } from '../lib/geo';
import GetSportStyle, { getSportCategoryForMatch } from '../pages/business/BusinessUtils';
import Loader from './Loader';

const isOutdoorValue = (court) => court.isOutdoor ?? court.isoutdoor ?? court.is_outdoor ?? true;
const hasCameraValue = (court) => court.hasCamera ?? court.has_camera ?? court.hascamera ?? false;

/**
 * Modale per scegliere centro sportivo + campo, al posto di due <select> classici.
 * Step 1: lista centri con ricerca, ordinata per vicinanza all'utente (se disponibile).
 * Step 2: campi del centro scelto (mai filtrati per sport - i valori di sport_type
 * non coincidono con quelli di formData.sport - ma quelli della categoria giusta
 * vengono ordinati per primi).
 */
export default function CenterCourtPicker({ isOpen, onClose, sport, centers, userId, initialCenterId, onSelect }) {
    const [step, setStep] = useState('centers');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCenterObj, setSelectedCenterObj] = useState(null);
    const [courts, setCourts] = useState([]);
    const [courtsLoading, setCourtsLoading] = useState(false);
    const [position, setPosition] = useState(null);
    const positionRef = useRef(null);
    const geoAttemptedRef = useRef(false);

    // Blocca lo scroll della pagina sotto la modale
    useEffect(() => {
        if (!isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [isOpen]);

    // All'apertura: resetta la ricerca e, se esiste già una selezione, salta
    // direttamente ai campi di quel centro.
    useEffect(() => {
        if (!isOpen) return;
        setSearchTerm('');
        const existing = initialCenterId ? centers.find(c => c.id === initialCenterId) : null;
        if (existing) {
            selectCenter(existing);
        } else {
            setStep('centers');
            setSelectedCenterObj(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Geolocalizzazione non bloccante, tentata una sola volta per apertura di sessione.
    // Fallback pigro (solo se il GPS fallisce) alla posizione salvata sul profilo.
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

    const centersWithDistance = useMemo(() => {
        return centers.map(c => {
            const lat = parseFloat(c.lat);
            const lng = parseFloat(c.lng);
            const hasCoords = !isNaN(lat) && !isNaN(lng);
            const distance = (position && hasCoords)
                ? calculateDistanceKm(position.lat, position.lng, lat, lng)
                : null;
            return { ...c, distance };
        });
    }, [centers, position]);

    const filteredCenters = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let list = centersWithDistance;
        if (term) {
            list = list.filter(c =>
                (c.full_name || c.username || '').toLowerCase().includes(term) ||
                (c.business_address || '').toLowerCase().includes(term)
            );
        }
        return [...list].sort((a, b) => {
            if (a.distance == null && b.distance == null) return 0;
            if (a.distance == null) return 1;
            if (b.distance == null) return -1;
            return a.distance - b.distance;
        });
    }, [centersWithDistance, searchTerm]);

    const matchCategory = getSportCategoryForMatch(sport);

    const sortedCourts = useMemo(() => {
        return [...courts].sort((a, b) => {
            const aMatch = !!matchCategory && GetSportStyle(a.sport_type).type === matchCategory;
            const bMatch = !!matchCategory && GetSportStyle(b.sport_type).type === matchCategory;
            if (aMatch === bMatch) return 0;
            return aMatch ? -1 : 1;
        });
    }, [courts, matchCategory]);

    async function selectCenter(center) {
        setSelectedCenterObj(center);
        setStep('courts');
        setCourtsLoading(true);
        const { data, error } = await supabase
            .from('sports_courts')
            .select('*')
            .eq('center_id', center.id)
            .eq('is_active', true);
        if (error) {
            console.error('Errore caricamento campi:', error);
            setCourts([]);
        } else {
            setCourts(data || []);
        }
        setCourtsLoading(false);
    }

    function handleBack() {
        setStep('centers');
        setSelectedCenterObj(null);
        setCourts([]);
    }

    function handleCourtClick(court) {
        onSelect(selectedCenterObj, court);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full mx-auto relative flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        {step === 'courts' && (
                            <button onClick={handleBack} className="p-1.5 -ml-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 flex-shrink-0">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter truncate">
                            {step === 'centers' ? 'Scegli un centro' : (selectedCenterObj?.full_name || selectedCenterObj?.username || 'Scegli il campo')}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 flex-shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {step === 'centers' && (
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm mb-4 flex-shrink-0">
                        <Search size={18} className="text-slate-400 flex-shrink-0" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cerca per nome o indirizzo..."
                            className="w-full bg-transparent outline-none text-sm text-slate-700"
                        />
                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                    {step === 'centers' ? (
                        centers.length === 0 ? (
                            <div className="text-center p-8 text-sm font-bold text-slate-400">Nessun centro disponibile.</div>
                        ) : filteredCenters.length === 0 ? (
                            <div className="text-center p-8 text-sm font-bold text-slate-400">Nessun centro trovato.</div>
                        ) : (
                            <div className="space-y-2">
                                {filteredCenters.map(center => (
                                    <div
                                        key={center.id}
                                        onClick={() => selectCenter(center)}
                                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex gap-4 items-center hover:bg-slate-50"
                                    >
                                        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                                            {center.avatar_url ? (
                                                <img src={center.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Building2 className="text-slate-400" size={24} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm truncate">{center.full_name || center.username}</h4>
                                            {center.business_address && (
                                                <div className="flex items-center gap-1 text-slate-500 mt-1">
                                                    <MapPin size={12} className="flex-shrink-0" />
                                                    <p className="text-xs truncate">{center.business_address}</p>
                                                </div>
                                            )}
                                        </div>
                                        {center.distance != null && (
                                            <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded-full flex-shrink-0">
                                                {center.distance.toFixed(1)} km
                                            </span>
                                        )}
                                        <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        courtsLoading ? (
                            <Loader variant="section" label="Caricamento campi..." />
                        ) : sortedCourts.length === 0 ? (
                            <div className="text-center p-8 text-sm font-bold text-slate-400">Nessun campo attivo per questo centro.</div>
                        ) : (
                            <div className="space-y-2">
                                {sortedCourts.map(court => {
                                    const outdoor = isOutdoorValue(court);
                                    const camera = hasCameraValue(court);
                                    const isMatch = !!matchCategory && GetSportStyle(court.sport_type).type === matchCategory;
                                    return (
                                        <div
                                            key={court.id}
                                            onClick={() => handleCourtClick(court)}
                                            className={`bg-white rounded-2xl p-4 border shadow-sm active:scale-[0.98] transition-all cursor-pointer hover:bg-slate-50 ${isMatch ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-100'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-bold text-slate-800 text-sm truncate">{court.name}</h4>
                                                {court.price_p_p != null && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-blue-100 text-blue-700 flex-shrink-0">
                                                        {court.price_p_p}€/p
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-slate-100 text-slate-600">
                                                    {court.sport_type}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1 ${outdoor ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    <Sun size={11} /> {outdoor ? "All'aperto" : "Coperto"}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1 ${camera ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {camera ? <Video size={11} /> : <VideoOff size={11} />} {camera ? 'Con Telecamera' : 'Senza Telecamera'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
