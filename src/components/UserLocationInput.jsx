import { useState } from 'react';
import { MapPin, Loader } from 'lucide-react';

const NominatimAgent = 'L-Ultimo-App (user-location-input)';

const getCityLabel = (address, fallback) => {
  if (!address) return fallback;
  return (
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    address.state ||
    address.region ||
    fallback
  );
};

const getProvince = (address) => {
  if (!address) return '';
  return address.county || address.state_district || address.state || address.region || '';
};

const getZipCode = (address) => {
  if (!address) return '';
  return address.postcode || '';
};

export default function UserLocationInput({ value, onChange }) {
  const [searchInput, setSearchInput] = useState(value?.location || value?.city || '');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      setError('Inserisci una località da cercare.');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': NominatimAgent,
          },
        }
      );
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data.map((item) => ({
          id: item.place_id,
          label: getCityLabel(item.address, item.display_name),
          province: getProvince(item.address),
          zip_code: getZipCode(item.address),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        })));
      } else {
        setError('Nessun risultato trovato. Prova con un indirizzo più preciso.');
      }
    } catch (err) {
      console.error('Errore Nominatim:', err);
      setError('Errore durante la ricerca della località. Riprovare.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (result) => {
    setSearchInput(result.label);
    setSearchResults([]);

    if (result.zip_code) {
      onChange({
        location: result.label,
        province: result.province || value?.province || '',
        zip_code: result.zip_code,
        location_lat: result.lat,
        location_lng: result.lng,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${result.lat}&lon=${result.lng}&addressdetails=1`,
        {
          headers: {
            'User-Agent': NominatimAgent,
          },
        }
      );
      const data = await response.json();
      const cityLabel = getCityLabel(data.address, result.label);
      onChange({
        location: cityLabel,
        province: getProvince(data.address) || result.province || value?.province || '',
        zip_code: getZipCode(data.address) || value?.zip_code || '',
        location_lat: result.lat,
        location_lng: result.lng,
      });
      setSearchInput(cityLabel);
    } catch (err) {
      console.error('Errore reverse geocoding selezione:', err);
      onChange({
        location: result.label,
        province: result.province || value?.province || '',
        zip_code: result.zip_code || value?.zip_code || '',
        location_lat: result.lat,
        location_lng: result.lng,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata.');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            {
              headers: {
                'User-Agent': NominatimAgent,
              },
            }
          );
          const data = await response.json();
          const locationString = getCityLabel(data.address, data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          setSearchInput(locationString);
          onChange({
            location: locationString,
            province: getProvince(data.address) || value?.province || '',
            zip_code: getZipCode(data.address) || value?.zip_code || '',
            location_lat: latitude,
            location_lng: longitude,
          });
        } catch (err) {
          console.error('Errore reverse geocoding:', err);
          setError('Impossibile ottenere l’indirizzo dalla posizione.');
          onChange({
            location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            location_lat: latitude,
            location_lng: longitude,
          });
        } finally {
          setLoading(false);
        }
      },
      (geoError) => {
        console.warn('Geolocalizzazione fallita:', geoError.message);
        setError('Geolocalizzazione fallita. Controlla i permessi.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-slate-500 uppercase">La città da dove parti</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            onChange({
              location: e.target.value,
              location_lat: value?.location_lat || null,
              location_lng: value?.location_lng || null,
            });
          }}
          placeholder="Es. Napoli"
          className="flex-1 p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-3 rounded-xl bg-blue-600 text-white text-xs uppercase font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader size={16} className="animate-spin" /> : 'Cerca città'}
        </button>
      </div>
      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        <MapPin size={16} />
        Usa posizione attuale
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase">CAP</label>
        <input
          type="text"
          value={value?.zip_code || ''}
          maxLength={5}
          onChange={(e) => onChange({
            ...(value || {}),
            zip_code: e.target.value,
          })}
          placeholder="Es. 80100"
          className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-slate-500">Controlla se il codice postale è corretto!</span>
        <br />
        <span className="text-xs text-slate-500">Se non lo è, inseriscilo manualmente.</span>
      </div>

      {searchResults.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {searchResults.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => handleSelect(result)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <p className="text-sm font-semibold text-slate-800">{result.label}</p>
              <p className="text-xs text-slate-500">{result.lat.toFixed(4)}, {result.lng.toFixed(4)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
