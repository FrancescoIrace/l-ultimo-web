// ESEMPIO: Come usare HomeFilters in altri componenti
// File: src/pages/PublicMatchLanding.jsx (esempio)

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import MatchCard from '../components/MatchCard';
import HomeFilters from '../components/HomeFilters';
import MatchSkeleton from '../components/MatchSkeleton';

export default function PublicMatchLanding() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Stati filtri
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusKm, setRadiusKm] = useState(20);
  const [showNearby, setShowNearby] = useState(true);
  const [showOngoingMatches, setShowOngoingMatches] = useState(false);
  const [showTodayMatches, setShowTodayMatches] = useState(false);
  
  // Stati geolocalizzazione
  const [position, setPosition] = useState(null);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Carica partite
  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('datetime', { ascending: true });

      if (error) {
        console.error('Errore caricamento:', error);
      } else {
        setMatches(data || []);
      }
      setLoading(false);
    };

    fetchMatches();
  }, []);

  // Geolocalizzazione
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalizzazione non supportata');
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
      },
      (error) => {
        setLocationAllowed(false);
        setLocationError(`Errore: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Calcola distanze
  const matchesWithDistance = useMemo(() => {
    if (!position) return matches;

    return matches.map((match) => {
      const lat = parseFloat(match.location_lat);
      const lng = parseFloat(match.location_lng);

      if (!lat || !lng) return null;

      const distance = calculateDistanceKm(
        position.lat,
        position.lng,
        lat,
        lng
      );
      return { ...match, distance };
    }).filter(Boolean);
  }, [matches, position]);

  // Filtra per distanza + query
  const filteredMatches = useMemo(() => {
    let result = matchesWithDistance;

    // Filtro distanza
    if (showNearby && position) {
      result = result.filter((match) => match.distance <= radiusKm);
    }

    // Filtro ricerca
    if (searchQuery.trim()) {
      const normalized = normalizeSearch(searchQuery);
      result = result.filter((match) =>
        normalizeSearch(match.title || '').includes(normalized)
      );
    }

    // Filtro temporale
    const parseLocalDatetime = (dt) => 
      new Date(dt.replace(' ', 'T')).getTime();
    const now = new Date().getTime();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneHourFromNow = now + (60 * 60 * 1000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (showTodayMatches) {
      result = result.filter((match) => {
        const matchTime = parseLocalDatetime(match.datetime);
        return matchTime >= startOfToday.getTime() && matchTime < oneHourAgo;
      });
    } else if (showOngoingMatches) {
      result = result.filter((match) => {
        const matchTime = parseLocalDatetime(match.datetime);
        return matchTime >= oneHourAgo && matchTime <= oneHourFromNow;
      });
    }

    return result;
  }, [matchesWithDistance, showNearby, position, radiusKm, searchQuery, showOngoingMatches, showTodayMatches]);

  return (
    <main className="max-w-md mx-auto p-4 pb-24">
      {/* Usa il componente HomeFilters */}
      <HomeFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        radiusKm={radiusKm}
        onRadiusChange={setRadiusKm}
        showOngoingMatches={showOngoingMatches}
        onShowOngoingChange={setShowOngoingMatches}
        showTodayMatches={showTodayMatches}
        onShowTodayChange={setShowTodayMatches}
        showNearby={showNearby}
        onShowNearbyChange={setShowNearby}
        locationAllowed={locationAllowed}
        locationError={locationError}
        usingManualPosition={false}
        nearbyMatchesCount={
          showNearby ? matchesWithDistance.filter(m => m.distance <= radiusKm).length : undefined
        }
      />

      {/* Contenuto */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((n) => <MatchSkeleton key={n} />)}
        </div>
      ) : filteredMatches.length > 0 ? (
        <div className="grid gap-4">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              extraInfo={
                match.distance !== undefined
                  ? `${match.distance.toFixed(1)} km`
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-slate-500 mt-10">
          <p>Nessuna partita trovata</p>
        </div>
      )}
    </main>
  );
}

// Helper functions
const EARTH_RADIUS_KM = 6371;

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function normalizeSearch(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
