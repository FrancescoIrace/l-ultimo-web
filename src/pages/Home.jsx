import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus } from 'lucide-react';
import MatchCard from '../components/MatchCard';
import MatchSkeleton from '../components/MatchSkeleton';
import PWADashboard from './PWADashboard';

const EARTH_RADIUS_KM = 6371;

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

export default function Home({ session, isPWA }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [position, setPosition] = useState(null);
  const [profileLocation, setProfileLocation] = useState(null);
  const [appSettings, setAppSettings] = useState(null);
  const [usingManualPosition, setUsingManualPosition] = useState(false);
  const [showNearby, setShowNearby] = useState(true);
  const [radiusKm, setRadiusKm] = useState(20);
  const [locationError, setLocationError] = useState('');
  const navigate = useNavigate();

  const fetchMatches = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('datetime', { ascending: true });

    if (error) {
      console.error('Errore:', error);
    } else {
      setMatches(data || []);
    }
    setLoading(false);
  };

  const fetchProfileLocation = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('location_lat, location_lng')
      .eq('id', session.user.id)
      .single();

    if (!error && data?.location_lat && data?.location_lng) {
      setProfileLocation({
        lat: parseFloat(data.location_lat),
        lng: parseFloat(data.location_lng),
      });
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    fetchMatches();
    fetchProfileLocation();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (position) return;

    const stored = localStorage.getItem('appSettings');
    let parsedSettings = null;

    if (stored) {
      try {
        parsedSettings = JSON.parse(stored);
        setAppSettings(parsedSettings);
      } catch (error) {
        console.warn('Errore lettura impostazioni app:', error);
      }
    }

    const setManualFromSettings = (settings) => {
      const manual = settings?.manualLocation;
      if (manual?.location_lat && manual?.location_lng) {
        setPosition({
          lat: manual.location_lat,
          lng: manual.location_lng,
        });
        setLocationAllowed(true);
        setUsingManualPosition(true);
        setLocationError('Posizione impostata manualmente.');
        return true;
      }
      return false;
    };

    if (parsedSettings?.useGeolocation === false && setManualFromSettings(parsedSettings)) {
      return;
    }

    const tryProfileFallback = () => {
      if (profileLocation) {
        setPosition(profileLocation);
        setLocationAllowed(true);
        setUsingManualPosition(true);
        setLocationError('Usando la posizione del profilo come fallback.');
        return true;
      }
      return false;
    };

    if (!navigator.geolocation) {
      if (!tryProfileFallback()) {
        setLocationError('Geolocalizzazione non supportata dal browser.');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationAllowed(true);
        setLocationError('');
        setUsingManualPosition(false);
      },
      (error) => {
        if (parsedSettings?.useGeolocation === false && setManualFromSettings(parsedSettings)) {
          return;
        }

        if (tryProfileFallback()) {
          return;
        }

        setLocationAllowed(false);
        setLocationError('Attiva la geolocalizzazione per vedere le partite vicine.');
        console.warn('Errore geolocalizzazione:', error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [profileLocation]);

  const distances = useMemo(() => {
    if (!position) return [];

    return matches
      .map((match) => {
        const lat = parseFloat(match.location_lat);
        const lng = parseFloat(match.location_lng);

        if (!lat || !lng) return null;

        const distance = calculateDistanceKm(position.lat, position.lng, lat, lng);
        return {
          ...match,
          distance,
        };
      })
      .filter(Boolean);
  }, [matches, position]);

  const nearbyMatches = useMemo(() => {
    if (!position) return [];
    return distances
      .filter((match) => match.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }, [distances, position, radiusKm]);

  const matchList = useMemo(() => {
    if (showNearby) {
      return nearbyMatches;
    }

    return matches.map((match) => ({
      ...match,
      distance: distances.find((item) => item?.id === match.id)?.distance,
    }));
  }, [matches, nearbyMatches, showNearby, distances]);

  if (isPWA) {
    return <PWADashboard user={session.user} onLogout={() => supabase.auth.signOut()} />;
  }

  return (
    <main className="max-w-md mx-auto p-4 pb-24 bg-slate-100">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Partite
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowNearby(true)}
            className={`rounded-2xl py-3 text-sm font-bold transition-all ${showNearby ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            Per distanza
          </button>
          <button
            onClick={() => setShowNearby(false)}
            className={`rounded-2xl py-3 text-sm font-bold transition-all ${!showNearby ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            Tutte
          </button>
        </div>
        {showNearby && (
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">Raggio</span>
                <span className="text-sm text-slate-500">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="mt-3 w-full"
              />
            </div>
            <p className="text-xs text-slate-500">
              {locationAllowed
                ? `${usingManualPosition ? 'Usando posizione manuale. ' : ''}Mostro solo le partite entro ${radiusKm} km da te (${nearbyMatches.length} trovate).`
                : locationError || 'Sto cercando la tua posizione...'}`
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((n) => (
            <MatchSkeleton key={n} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {showNearby && !position && !loading ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              Attiva la geolocalizzazione per vedere le partite vicine o passa a "Tutte".
            </div>
          ) : matchList.length > 0 ? (
            matchList.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                user={session.user}
                extraInfo={match.distance != null ? `${match.distance.toFixed(1)} km` : undefined}
              />
            ))
          ) : (
            <>
              <p className="text-center text-slate-500 mt-10">
                {showNearby
                  ? 'Nessuna partita nelle vicinanze. Prova a mostrare tutte le partite.'
                  : 'Nessuna partita trovata. Creane una tu!'}
              </p>

              <button
                disabled={loading}
                onClick={() => navigate('/organizza')}
                className="w-full cursor-pointer bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Caricamento...' : 'Organizza una partita'}
              </button>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => navigate('/organizza')}
        className="fixed bottom-6 right-6 w-[80px] h-20 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center font-light hover:bg-blue-700 transition-transform active:scale-90 cursor-pointer"
      >
        <Plus size={60} strokeWidth={2.5} className='active:animate-spin' />
      </button>
    </main>
  );
}
